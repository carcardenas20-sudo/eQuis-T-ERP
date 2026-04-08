import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Plus, Loader2, AlertTriangle, Search, Filter, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, EyeOff, Eye, Trash2 } from "lucide-react";
import { Location } from "@/entities/Location";
import { Role } from "@/entities/Role";
import UserForm from "../components/users/UserForm";
import RoleManager from "../components/settings/RoleManager";

const COMERCIAL_PERMS = ["pos_sales","sales_view","customers_view","products_view","expenses_view","reports_basic","credits_view","inventory_view"];

function getModulesForRole(role, user) {
  if (user?.role === 'admin') return ["comercial", "produccion", "operarios"];
  if (!role) return [];
  const perms = role.permissions || [];
  const modules = [];
  if (COMERCIAL_PERMS.some(p => perms.includes(p))) modules.push("comercial");
  if (perms.includes("produccion_view") || perms.includes("produccion_pipeline_view")) modules.push("produccion");
  if (perms.includes("operarios_view") || perms.includes("operarios_admin")) modules.push("operarios");
  return modules;
}

function ModuleBadges({ modules }) {
  return (
    <div className="flex flex-wrap gap-1">
      {modules.includes("comercial") && (
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200 font-medium">🔵 Comercial</span>
      )}
      {modules.includes("produccion") && (
        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-200 font-medium">🟢 Producción</span>
      )}
      {modules.includes("operarios") && (
        <span className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200 font-medium">🟣 Operarios</span>
      )}
      {modules.length === 0 && (
        <span className="text-xs text-slate-400 italic">Sin módulo</span>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersData, locationsData, rolesData] = await Promise.all([
        User.list("-created_date"),
        Location.list(),
        Role.list()
      ]);
      setUsers(usersData);
      setLocations(locationsData);
      setRoles(rolesData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getRoleById = (roleId) => roles.find(r => r.id === roleId) || null;
  const getRoleName = (roleId) => getRoleById(roleId)?.name || null;
  const hasInvalidRole = (user) => user.role_id && !roles.find(r => r.id === user.role_id);

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (moduleFilter === "all") return true;

    const role = getRoleById(user.role_id);
    const modules = getModulesForRole(role, user);
    if (moduleFilter === "sin_modulo") return modules.length === 0;
    return modules.includes(moduleFilter);
  });

  const handleOpenEditForm = (user) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleOpenCreateForm = () => {
    setEditingUser({ _isNew: true, full_name: '', email: '', password: '', role_id: '', location_id: '', role: 'user', is_active: true });
    setIsFormOpen(true);
  };

  const handleSaveUser = async (userData) => {
    setIsSaving(true);

    const role = getRoleById(userData.role_id);
    const hasPerms = role && (role.permissions?.length > 0);
    if (!userData.role_id || !hasPerms) {
      const proceed = window.confirm(
        "⚠️ Advertencia: Este usuario no tiene permisos asignados (sin rol o rol sin permisos).\n\n" +
        "El usuario no podrá acceder a ningún módulo. ¿Deseas guardar de todas formas?"
      );
      if (!proceed) {
        setIsSaving(false);
        return;
      }
    }

    try {
      const isNew = userData._isNew;
      const { id, _isNew: _, role: _role, ...dataToSend } = userData;
      if (dataToSend.created_date) delete dataToSend.created_date;
      if (dataToSend.updated_date) delete dataToSend.updated_date;
      if (dataToSend.created_by) delete dataToSend.created_by;
      if (dataToSend.salary) dataToSend.salary = parseFloat(dataToSend.salary);

      if (isNew) {
        if (!dataToSend.email || !dataToSend.password || !dataToSend.full_name) {
          alert("Por favor completa nombre, email y contraseña.");
          setIsSaving(false);
          return;
        }
        await User.create(dataToSend);
        setIsFormOpen(false);
        setEditingUser(null);
        loadData();
        alert("Usuario creado exitosamente.");
      } else {
        const { email, full_name, ...dataToUpdate } = dataToSend;
        await User.update(id, dataToUpdate);

        const currentUser = await User.me();
        if (currentUser.email === userData.email) {
          alert("Tu rol o datos sensibles han sido actualizados. La sesión se cerrará para aplicar los cambios.");
          setTimeout(async () => {
            await User.logout();
            window.location.reload();
          }, 2000);
          return;
        }

        setIsFormOpen(false);
        setEditingUser(null);
        loadData();
        alert("Usuario actualizado exitosamente.");
      }
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Error al guardar usuario: " + error.message);
    }
    setIsSaving(false);
  };

  const handleToggleActive = async (user) => {
    try {
      await User.update(user.id, { is_active: !user.is_active });
      loadData();
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario "${user.full_name}"? Esta acción no se puede deshacer.`)) {
      try {
        await User.delete(user.id);
        loadData();
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  const MODULE_FILTERS = [
    { value: "all",        label: "Todos los módulos" },
    { value: "comercial",  label: "🔵 Comercial" },
    { value: "produccion", label: "🟢 Producción" },
    { value: "operarios",  label: "🟣 Operarios" },
    { value: "sin_modulo", label: "Sin módulo" },
  ];

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Usuarios y Permisos</h1>
          <p className="text-slate-600 mt-1">Administra usuarios, roles y accesos del personal.</p>
        </div>

        <Tabs defaultValue="usuarios">
          <TabsList className="mb-2">
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="w-4 h-4" /> Usuarios
              <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{users.length}</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="w-4 h-4" /> Roles y Permisos
              <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{roles.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="space-y-4">
            {/* Header tab usuarios */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex gap-1 flex-wrap">
                    {MODULE_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setModuleFilter(f.value)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          moduleFilter === f.value
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleOpenCreateForm} className="gap-2 shrink-0">
                <Plus className="w-5 h-5" /> Nuevo Usuario
              </Button>
            </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            filteredUsers.map((user) => {
              const role = getRoleById(user.role_id);
              const roleName = role?.name || null;
              const invalidRole = hasInvalidRole(user);
              const noRole = !user.role_id;
              const location = locations.find(l => l.id === user.location_id);
              const modules = getModulesForRole(role, user);
              return (
                <Card key={user.id} className={invalidRole || noRole ? 'bg-red-50 border-red-200' : 'border-0 shadow-sm'}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{user.full_name}</div>
                        <div className="text-sm text-slate-500 truncate max-w-[220px]">{user.email}</div>
                        {invalidRole && (
                          <div className="text-xs text-red-600 mt-1 font-mono">role_id: {user.role_id}</div>
                        )}
                        <div className="mt-2">
                          <ModuleBadges modules={modules} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {invalidRole ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Rol Inválido</Badge>
                        ) : noRole ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Sin Rol</Badge>
                        ) : (
                          <Badge variant="secondary">{roleName}</Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditForm(user)}>
                              <Edit className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                              {user.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</> : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-600">{location ? location.name : 'Sin asignar'}</span>
                      <Badge variant={user.is_active ? 'default' : 'destructive'} className={user.is_active ? 'bg-emerald-500' : ''}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
          {!isLoading && filteredUsers.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">No hay usuarios que coincidan con el filtro.</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <Card className="shadow-lg border-0 hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Módulos con acceso</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      No hay usuarios que coincidan con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const role = getRoleById(user.role_id);
                    const roleName = role?.name || null;
                    const invalidRole = hasInvalidRole(user);
                    const noRole = !user.role_id;
                    const location = locations.find(l => l.id === user.location_id);
                    const modules = getModulesForRole(role, user);
                    return (
                      <TableRow key={user.id} className={invalidRole || noRole ? 'bg-red-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-sm text-slate-500">{user.email}</div>
                              {invalidRole && (
                                <div className="text-xs text-red-600 mt-1 font-mono">role_id: {user.role_id}</div>
                              )}
                            </div>
                            {(invalidRole || noRole) && (
                              <AlertTriangle className="w-4 h-4 text-red-600" title="Rol inválido o faltante" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invalidRole ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Rol Inválido</Badge>
                          ) : noRole ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Sin Rol</Badge>
                          ) : (
                            <Badge variant="secondary">{roleName}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ModuleBadges modules={modules} />
                        </TableCell>
                        <TableCell>
                          {location
                            ? <span className="text-sm">{location.name}</span>
                            : <span className="text-sm text-slate-400">Sin asignar</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'destructive'} className={user.is_active ? 'bg-emerald-500' : ''}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEditForm(user)}>
                                <Edit className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                {user.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</> : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="roles">
            <RoleManager roles={roles} onRefresh={loadData} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>

      {isFormOpen && editingUser && (
        <UserForm
          user={editingUser}
          locations={locations}
          roles={roles}
          onSave={handleSaveUser}
          onCancel={() => setIsFormOpen(false)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
