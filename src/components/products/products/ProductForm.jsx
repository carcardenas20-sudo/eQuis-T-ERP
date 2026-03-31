import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, X, PackagePlus } from "lucide-react";

export default function ProductForm({ product, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(product || {
    name: "",
    reference: "",
    description: "",
    manufacturing_price: "",
    employee_price: "",
    is_active: true,
    category: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.reference || !formData.manufacturing_price) {
        alert("Nombre, Referencia y Precio son campos obligatorios.");
        return;
    }
    onSubmit({
      ...formData,
      manufacturing_price: parseFloat(formData.manufacturing_price) || 0,
      employee_price: parseFloat(formData.employee_price) || 0
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            {product ? 'Editar Producto' : 'Nuevo Producto'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder="Ej: Widget Premium"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia *</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value.toUpperCase())}
                required
                placeholder="Ej: WID001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturing_price">Precio de Manufactura ($) *</Label>
              <Input
                id="manufacturing_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.manufacturing_price}
                onChange={(e) => handleInputChange('manufacturing_price', e.target.value)}
                required
                placeholder="Ej: 2.50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_price">Precio Venta Empleado ($)</Label>
              <Input
                id="employee_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.employee_price}
                onChange={(e) => handleInputChange('employee_price', e.target.value)}
                placeholder="Precio especial para operarios"
              />
              <p className="text-xs text-slate-500">Si no se configura, se usará el precio de manufactura.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="Ej: Básicos, Premium, Componentes"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descripción detallada del producto..."
              className="h-20"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active" className="text-sm text-slate-600">
                {formData.is_active ? 'Producto Activo' : 'Producto Inactivo'}
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {product ? 'Actualizar Producto' : 'Crear Producto'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}