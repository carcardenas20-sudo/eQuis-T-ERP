import React from "react";
import { useSession } from "../components/providers/SessionProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

export default function TestPermisosPage() {
  const { currentUser, permissions, userRole } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test de Permisos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Usuario */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">Usuario:</p>
              <p className="font-bold text-lg">{currentUser?.email || "No encontrado"}</p>
            </div>

            {/* Rol */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">Rol:</p>
              <p className="font-bold text-lg">{userRole?.name || "Sin rol"}</p>
            </div>

            {/* Permisos */}
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">Cantidad de permisos:</p>
              <p className="font-bold text-lg">{permissions?.length || 0}</p>
            </div>

            {/* Permisos específicos */}
            <div className="space-y-2">
              <p className="font-semibold">Permisos de prueba:</p>
              
              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                {permissions?.includes('pos_sales') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span>pos_sales (Punto de Venta)</span>
              </div>

              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                {permissions?.includes('users_view') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span>users_view (Ver Usuarios)</span>
              </div>

              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                {permissions?.includes('pos_apply_discounts') ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span>pos_apply_discounts (Aplicar Descuentos)</span>
              </div>
            </div>

            {/* Todos los permisos */}
            {permissions && permissions.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-semibold mb-2">Todos tus permisos:</p>
                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                  {permissions.map((perm, idx) => (
                    <Badge key={idx} variant="secondary">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultado */}
        <Card className={permissions?.length > 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
          <CardContent className="p-6">
            <p className="text-center text-lg font-bold">
              {permissions?.length > 0 
                ? "✅ El sistema de permisos ESTÁ FUNCIONANDO"
                : "❌ El sistema de permisos NO está funcionando"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}