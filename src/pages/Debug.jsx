import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Role } from "@/entities/Role";
import { useSession } from "../components/providers/SessionProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bug, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Shield,
  User as UserIcon
} from "lucide-react";

export default function DebugPage() {
  const sessionData = useSession();
  const [rawUser, setRawUser] = useState(null);
  const [allRoles, setAllRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [user, roles] = await Promise.all([
        User.me(),
        Role.list()
      ]);
      setRawUser(user);
      setAllRoles(roles);
    } catch (error) {
      console.error("Error loading debug data:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const userRoleMatch = allRoles.find(r => r.id === rawUser?.role_id);
  const hasValidRole = !!userRoleMatch;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Bug className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">🔍 Diagnóstico de Permisos</h1>
              <p className="text-slate-600 mt-1">Información detallada del sistema de roles</p>
            </div>
          </div>
          <Button onClick={loadData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Recargar
          </Button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={hasValidRole ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                {hasValidRole ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <p className="text-sm text-slate-600">Estado del Rol</p>
                  <p className={`text-lg font-bold ${hasValidRole ? 'text-green-900' : 'text-red-900'}`}>
                    {hasValidRole ? 'VÁLIDO' : 'INVÁLIDO'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-600">Permisos Activos</p>
                  <p className="text-lg font-bold text-blue-900">
                    {sessionData.permissions?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <UserIcon className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-slate-600">Roles en Sistema</p>
                  <p className="text-lg font-bold text-purple-900">
                    {allRoles.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Alert */}
        {!hasValidRole && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ PROBLEMA DETECTADO:</strong> El role_id del usuario no coincide con ningún rol en el sistema.
              <br />
              <strong>Solución:</strong> Ve a Usuarios → Editar → Asigna un rol válido.
            </AlertDescription>
          </Alert>
        )}

        {/* User Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-600" />
              Datos del Usuario Actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="font-mono text-sm">{rawUser?.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Nombre</p>
                <p className="font-mono text-sm">{rawUser?.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Role (legacy)</p>
                <p className="font-mono text-sm">{rawUser?.role || 'null'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Role ID</p>
                <p className="font-mono text-sm font-bold text-blue-600">
                  {rawUser?.role_id || 'null'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">🔍 Búsqueda de Rol:</p>
              <p className="text-xs text-blue-700 mb-2">Buscando role_id: <span className="font-mono font-bold">{rawUser?.role_id}</span></p>
              
              {hasValidRole ? (
                <div className="bg-green-100 border border-green-300 p-3 rounded">
                  <p className="text-sm font-bold text-green-900">✅ ROL ENCONTRADO:</p>
                  <p className="text-sm text-green-800 font-mono">{userRoleMatch.name}</p>
                  <p className="text-xs text-green-700 mt-1">
                    {userRoleMatch.permissions?.length || 0} permisos configurados
                  </p>
                </div>
              ) : (
                <div className="bg-red-100 border border-red-300 p-3 rounded">
                  <p className="text-sm font-bold text-red-900">❌ ROL NO ENCONTRADO</p>
                  <p className="text-xs text-red-700 mt-1">El role_id no existe en la lista de roles del sistema</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SessionProvider Data */}
        <Card>
          <CardHeader>
            <CardTitle>Datos del SessionProvider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 mb-1">Rol Detectado</p>
                <p className="font-mono text-sm">{sessionData.userRole?.name || 'null'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Permisos</p>
                <p className="font-mono text-sm">{sessionData.permissions?.length || 0}</p>
              </div>
            </div>

            {sessionData.permissions && sessionData.permissions.length > 0 ? (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-semibold text-green-900 mb-2">Permisos Activos:</p>
                <div className="flex flex-wrap gap-2">
                  {sessionData.permissions.map((perm, idx) => (
                    <Badge key={idx} variant="outline" className="bg-white">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Sin permisos activos. El usuario no podrá acceder a ninguna funcionalidad.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* All Roles */}
        <Card>
          <CardHeader>
            <CardTitle>Todos los Roles en el Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allRoles.map((role) => {
                const isUserRole = role.id === rawUser?.role_id;
                return (
                  <div 
                    key={role.id} 
                    className={`p-4 rounded-lg border-2 ${
                      isUserRole 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <p className="font-semibold">{role.name}</p>
                        {isUserRole && (
                          <Badge className="bg-blue-600">ROL ACTUAL</Badge>
                        )}
                      </div>
                      <Badge variant="outline">
                        {role.permissions?.length || 0} permisos
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mb-2">
                      ID: {role.id}
                    </p>
                    {role.description && (
                      <p className="text-sm text-slate-600 mb-2">{role.description}</p>
                    )}
                    {role.permissions && role.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {role.permissions.slice(0, 10).map((perm, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {role.permissions.length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 10} más
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>Comparación de IDs (Debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Rol</th>
                    <th className="text-left p-2">ID del Rol</th>
                    <th className="text-left p-2">user.role_id</th>
                    <th className="text-center p-2">Match?</th>
                  </tr>
                </thead>
                <tbody>
                  {allRoles.map((role) => {
                    const match = role.id === rawUser?.role_id;
                    return (
                      <tr key={role.id} className={match ? 'bg-green-50' : ''}>
                        <td className="p-2">{role.name}</td>
                        <td className="p-2 font-mono text-xs">{role.id}</td>
                        <td className="p-2 font-mono text-xs">{rawUser?.role_id}</td>
                        <td className="p-2 text-center">
                          {match ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}