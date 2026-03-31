import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, X, UserPlus } from "lucide-react";

export default function EmployeeForm({ employee, onSubmit, onCancel, existingEmployees = [] }) {
  const [formData, setFormData] = useState(employee ? {
    ...employee,
    hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  } : {
    name: "",
    employee_id: "",
    phone: "",
    position: "",
    hire_date: new Date().toISOString().split('T')[0],
    is_active: true,
    salary_per_unit: ""
  });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    
    if (!formData.name || !formData.employee_id) {
      newErrors.general = "Por favor completa Nombre y ID de Empleado.";
    }
    
    // Validar ID duplicado (excepto si es el mismo empleado siendo editado)
    const idExists = existingEmployees.some(emp => 
      emp.employee_id === formData.employee_id && emp.id !== employee?.id
    );
    if (idExists) {
      newErrors.employee_id = "Este ID de empleado ya existe.";
    }
    
    // Validar teléfono duplicado (si hay teléfono)
    if (formData.phone) {
      const phoneExists = existingEmployees.some(emp => 
        emp.phone === formData.phone && emp.id !== employee?.id
      );
      if (phoneExists) {
        newErrors.phone = "Este número de teléfono ya está registrado.";
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    onSubmit({
      ...formData,
      salary_per_unit: formData.salary_per_unit ? parseFloat(formData.salary_per_unit) : undefined
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          {employee ? 'Editar Empleado' : 'Nuevo Empleado'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errors.general && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{errors.general}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder="Ej: Juan Carlos Pérez"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="employee_id">ID de Empleado *</Label>
              <Input
                id="employee_id"
                value={formData.employee_id}
                onChange={(e) => { handleInputChange('employee_id', e.target.value); setErrors(prev => ({ ...prev, employee_id: '' })); }}
                required
                placeholder="Ej: EMP001"
                className={errors.employee_id ? 'border-red-500' : ''}
              />
              {errors.employee_id && <p className="text-red-500 text-sm">{errors.employee_id}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => { handleInputChange('phone', e.target.value); setErrors(prev => ({ ...prev, phone: '' })); }}
                placeholder="Ej: +57 300 123 4567"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="position">Cargo/Posición</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => handleInputChange('position', e.target.value)}
                placeholder="Ej: Operario de manufactura"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hire_date">Fecha de Contratación</Label>
              <Input
                id="hire_date"
                type="date"
                value={formData.hire_date}
                onChange={(e) => handleInputChange('hire_date', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="salary_per_unit">Pago por Unidad ($)</Label>
              <Input
                id="salary_per_unit"
                type="number"
                step="0.01"
                value={formData.salary_per_unit}
                onChange={(e) => handleInputChange('salary_per_unit', e.target.value)}
                placeholder="Ej: 1500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label>Empleado activo</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {employee ? 'Actualizar Empleado' : 'Crear Empleado'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}