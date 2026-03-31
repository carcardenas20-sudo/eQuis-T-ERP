import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, Edit } from "lucide-react";

export default function StockMovementForm({ movement, products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(movement || {
    product_reference: "",
    movement_type: "entrada",
    quantity: "",
    movement_date: "",
    reason: "",
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.product_reference || !formData.quantity || !formData.movement_date) {
      alert("Por favor completa los campos requeridos");
      return;
    }

    onSubmit({
      ...formData,
      quantity: parseInt(formData.quantity, 10)
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getProductName = (reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : reference;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit className="w-5 h-5" />
          Editar Movimiento de Stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Producto</Label>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-800">
                  {getProductName(formData.product_reference)}
                </p>
                <p className="text-sm text-slate-600">
                  Ref: {formData.product_reference}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="movement_type">Tipo de Movimiento *</Label>
              <select
                id="movement_type"
                value={formData.movement_type}
                onChange={(e) => handleInputChange('movement_type', e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                required
                placeholder="Ej: 50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="movement_date">Fecha del Movimiento *</Label>
              <Input
                id="movement_date"
                type="date"
                value={formData.movement_date}
                onChange={(e) => handleInputChange('movement_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Motivo del Movimiento</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="Ej: Compra, Venta, Ajuste de inventario"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Información adicional sobre este movimiento..."
              className="h-20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Actualizar Movimiento
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}