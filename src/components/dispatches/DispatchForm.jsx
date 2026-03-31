import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X, TruckIcon } from "lucide-react";
// This import is kept as it might be used for other formatting or good to have.

// Función auxiliar para obtener fecha de Colombia
const getColombiaTodayString = () => {
  const now = new Date();
  // Using toLocaleString with America/Bogota timezone to get the correct date components.
  // Then converting back to a Date object to get ISO string for 'YYYY-MM-DD'.
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombiaTime.toISOString().split('T')[0];
};

export default function DispatchForm({ dispatch, employees, products, inventory, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(dispatch || {
    product_reference: "",
    employee_id: "",
    quantity: "",
    dispatch_date: getColombiaTodayString(),
    status: "despachado"
  });

  const getAvailableStock = (productReference) => {
    const inventoryItem = inventory.find(inv => inv.product_reference === productReference);
    return inventoryItem ? inventoryItem.current_stock : 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.employee_id || !formData.product_reference || !formData.quantity) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    const availableStock = getAvailableStock(formData.product_reference);

    if (quantity > availableStock) {
      alert(`No hay suficiente stock disponible. Stock actual: ${availableStock}`);
      return;
    }

    onSubmit({
      ...formData,
      quantity: quantity
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TruckIcon className="w-5 h-5" />
          {dispatch ? 'Editar Despacho' : 'Nuevo Despacho de Material'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_reference">Referencia del Producto *</Label>
              <select
                id="product_reference"
                value={formData.product_reference}
                onChange={(e) => handleInputChange('product_reference', e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">Seleccione una referencia</option>
                {products.filter(p => p.is_active).map(product => {
                  const stock = getAvailableStock(product.reference);
                  return (
                    <option key={product.reference} value={product.reference}>
                      {product.name} ({product.reference}) - Stock: {stock}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="employee_id">Operario *</Label>
              <select
                id="employee_id"
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">Seleccione un operario</option>
                {employees.filter(e => e.is_active).map(employee => (
                  <option key={employee.employee_id} value={employee.employee_id}>
                    {employee.name} ({employee.employee_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad a Despachar *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={formData.product_reference ? getAvailableStock(formData.product_reference) : undefined}
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                required
                placeholder="Ej: 100"
              />
              {formData.product_reference && (
                <p className="text-sm text-slate-600">
                  Stock disponible: <span className="font-medium">{getAvailableStock(formData.product_reference)}</span>
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dispatch_date">Fecha de Despacho *</Label>
              <Input
                id="dispatch_date"
                type="date"
                value={formData.dispatch_date}
                onChange={(e) => handleInputChange('dispatch_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="status">Estado del Despacho</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="despachado">Despachado</option>
                <option value="en_proceso">En Proceso</option>
                <option value="entregado">Entregado</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {dispatch ? 'Actualizar' : 'Registrar'} Despacho
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}