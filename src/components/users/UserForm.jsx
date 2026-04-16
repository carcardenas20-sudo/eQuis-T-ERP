import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Shield, CheckCircle2, Building2, Eye, EyeOff } from "lucide-react";
import { Role } from "@/entities/Role";

const COMERCIAL_PERMS = ["pos_sales","sales_view","customers_view","products_view","expenses_view","reports_basic","credits_view","inventory_view"];

function getModulesForRole(role) {
  if (!role) return [];
  const perms = role.permissions || [];
  const modules = [];
  if (COMERCIAL_PERMS.some(p => perms.includes(p))) modules.push("comercial");
  if (perms.includes("produccion_view") || perms.includes("produccion_pipeline_view")) modules.push("produccion");
  if (perms.includes("operarios_view") || perms.includes("operarios_admin")) modules.push("operarios");
  return modules;
}

const MODULE_OPTIONS = [
  { value: "all",        label: "Todos los módulos",           hint: "Mostrar todos los roles disponibles" },
  { value: "comercial",  label: "🔵 Comercial",                hint: "POS, ventas, clientes, inventario" },
  { value: "produccion", label: "🟢 Producción",               hint: "Gestión de producción y materiales" },
  { value: "operarios",  label: "🟣 Operarios",                hint: "Despachos, entregas y pagos" },
];

export default function UserForm({ user, locations, roles: rolesProp, onSave, onCancel, isSaving }) {
  const [formData, setFormData] = useState(user || {});
  const [roles, setRoles] = useState(rolesProp || []);
  const [selectedRole, setSelectedRole] = useState(null);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [showPassword, setShowPassword] = useState(false);
  const isNew = !!user?._isNew;

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesData = rolesProp?.length ? rolesProp : await Role.list();
        setRoles(rolesData);
        if (user?.role_id) {
          const currentRole = rolesData.find(r => r.id === user.role_id);
          setSelectedRole(currentRole || null);
          if (currentRole) {
            const modules = getModulesForRole(currentRole);
            if (modules.length === 1) setModuleFilter(modules[0]);
          }
        }
      } catch (error) {
        console.error("Error loading roles:", error);
      }
    };
    fetchRoles();
    setFormData(user);
  }, [user]);

  const handleChange = (field, value) => {
    setFormData(p => ({ ...p, [field]: value }));
  };

  const handleRoleChange = (roleId) => {
    handleChange('role_id', roleId);
    const role = roles.find(r => r.id === roleId);
    setSelectedRole(role || null);
  };

  const hasInvalidRole = user?.role_id && !roles.find(r => r.id === user.role_id);
  const hasNoRole = !user?.role_id || user.role_id === '';

  const filteredRoles = roles.filter(role => {
    if (moduleFilter === "all") return true;
    const modules = getModulesForRole(role);
    return modules.includes(moduleFilter);
  });

  const selectedModules = getModulesForRole(selectedRole);

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {isNew ? "Nuevo Usuario" : `Editar Usuario: ${user.full_name}`}
          </DialogTitle>
          <DialogDescription>
            {isNew ? "Completa los datos para crear un nuevo usuario en el sistema." : "Modifica la información, rol y permisos del usuario."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic info fields — only for new users */}
          {isNew && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-700">Datos de acceso</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Nombre completo *</label>
                  <input
                    type="text"
                    value={formData.full_name || ''}
                    onChange={e => handleChange('full_name', e.target.value)}
                    placeholder="Ej: Juan García"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Email *</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password || ''}
                    onChange={e => handleChange('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Warning for invalid or missing role */}
          {(hasInvalidRole || hasNoRole) && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-800">
                {hasInvalidRole ? (
                  <div>
                    <strong>⚠️ Rol Inválido Detectado:</strong>
                    <br />
                    <span className="text-sm font-mono bg-red-100 px-2 py-1 rounded mt-1 inline-block">
                      role_id actual: {user.role_id}
                    </span>
                    <br />
                    <span className="text-sm mt-2 block">
                      Este rol no existe en el sistema. Selecciona un rol válido abajo para corregirlo.
                    </span>
                  </div>
                ) : (
                  <div>
                    <strong>⚠️ Sin Rol:</strong> Este usuario no tiene un rol asignado.
                    <br />
                    <span className="text-sm">Debe seleccionar un rol para que el usuario tenga permisos.</span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* User Basic Info */}
          <div className="bg-slate-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-slate-700 mb-3">Información del Usuario</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Nombre Completo</Label>
                <Input value={formData.full_name || ''} disabled className="bg-white" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Email</Label>
                <Input value={formData.email || ''} disabled className="bg-white" />
              </div>
            </div>
          </div>

          {/* Module selector + Role */}
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Asignación de Rol * (REQUERIDO)</h3>
            </div>

            {/* Module principal filter */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">Filtrar por módulo principal</Label>
              <div className="flex flex-wrap gap-1.5">
                {MODULE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setModuleFilter(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      moduleFilter === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Role selector */}
            <Select
              value={formData.role_id || ''}
              onValueChange={handleRoleChange}
            >
              <SelectTrigger className="w-full h-12 bg-white border-2 border-blue-300">
                <SelectValue placeholder="⚠️ Seleccionar rol..." />
              </SelectTrigger>
              <SelectContent>
                {filteredRoles.length === 0 ? (
                  <div className="py-3 px-4 text-sm text-slate-500 text-center">
                    No hay roles para este módulo.
                    <button
                      type="button"
                      onClick={() => setModuleFilter("all")}
                      className="block mx-auto mt-1 text-blue-600 underline text-xs"
                    >
                      Ver todos
                    </button>
                  </div>
                ) : (
                  filteredRoles.map(role => {
                    const mods = getModulesForRole(role);
                    return (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2 py-0.5">
                          <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium">{role.name}</span>
                          <div className="flex gap-1 ml-1">
                            {mods.includes("comercial") && <span className="text-xs">🔵</span>}
                            {mods.includes("produccion") && <span className="text-xs">🟢</span>}
                            {mods.includes("operarios") && <span className="text-xs">🟣</span>}
                          </div>
                          <Badge variant="outline" className="ml-auto text-xs shrink-0">
                            {role.permissions?.length || 0} permisos
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>

            {/* Preview of selected role */}
            {selectedRole && (
              <div className="bg-white p-3 rounded border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Módulos de "{selectedRole.name}":
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {selectedModules.includes("comercial") && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">🔵 Comercial</span>}
                    {selectedModules.includes("produccion") && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-200">🟢 Producción</span>}
                    {selectedModules.includes("operarios") && <span className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">🟣 Operarios</span>}
                    {selectedModules.length === 0 && <span className="text-xs text-slate-400 italic">Sin módulo</span>}
                  </div>
                </div>
                {selectedRole.permissions && selectedRole.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedRole.permissions.slice(0, 8).map((perm, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {perm.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                    {selectedRole.permissions.length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedRole.permissions.length - 8} más
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact & Employment Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={e => handleChange('phone', e.target.value)}
                placeholder="+57 300 123 4567"
              />
            </div>
            <div>
              <Label htmlFor="employee_id">ID de Empleado</Label>
              <Input
                id="employee_id"
                value={formData.employee_id || ''}
                onChange={e => handleChange('employee_id', e.target.value)}
                placeholder="EMP-001"
              />
            </div>
          </div>

          {/* Location Assignment */}
          <div>
            <Label htmlFor="location_id" className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Sucursal Asignada
            </Label>
            <Select
              value={formData.location_id || ''}
              onValueChange={value => handleChange('location_id', value)}
            >
              <SelectTrigger id="location_id" className="w-full">
                <SelectValue placeholder="Seleccionar sucursal..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.is_main && <Badge variant="outline" className="ml-2 text-xs">Principal</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Salary */}
          <div>
            <Label htmlFor="salary">Salario</Label>
            <Input
              type="number"
              id="salary"
              value={formData.salary || ''}
              onChange={e => handleChange('salary', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(formData)}
            disabled={isSaving || !formData.role_id}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
