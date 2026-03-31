import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, X, Shield } from "lucide-react";

export default function EditUserForm({ user, employees, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    role: user.role || 'employee',
    employee_id: user.employee_id || '',
    is_active: user.is_active !== false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(user.id, formData);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getRoleDisplayName = (role) => {
    const roles = {
      admin: 'Administrador',
      supervisor: 'Supervisor',
      employee: 'Empleado'
    };
    return roles[role] || role;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Editar Usuario: {user.full_name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información del usuario */}
          <div className="bg-slate-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-slate-900 mb-2">Información del Usuario</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Nombre:</span>
                <span className="ml-2 font-medium">{user.full_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Email:</span>
                <span className="ml-2 font-medium">{user.email}</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rol del Usuario</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800">Administrador</Badge>
                      <span className="text-sm">Acceso completo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="supervisor">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">Supervisor</Badge>
                      <span className="text-sm">Despachos y entregas</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">Empleado</Badge>
                      <span className="text-sm">Solo su información</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_id">Empleado Vinculado</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => handleInputChange('employee_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No vincular</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.employee_id}>
                      {emp.name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estado del Usuario</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <span className="text-sm text-slate-600">
                {formData.is_active ? 'Usuario activo' : 'Usuario inactivo'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}