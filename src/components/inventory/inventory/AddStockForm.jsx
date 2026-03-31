import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, Plus } from "lucide-react";

// Función auxiliar para obtener fecha de Colombia
const getColombiaTodayString = () => {
  const now = new Date();
  // Use toLocaleString with timeZone option to get the date components in the desired timezone
  // Then manually construct the YYYY-MM-DD string
  const colombiaDateOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: "America/Bogota"
  };
  const parts = new Intl.DateTimeFormat('en-CA', colombiaDateOptions).formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

export default function AddStockForm({ products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    product_reference: "",
    quantity: "",
    movement_date: getColombiaTodayString(),
    reason: "Adición de stock",
    notes: "",
    min_stock: "0",
    location: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.product_reference || !formData.quantity) {
      alert("Por favor completa Producto y Cantidad");
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      alert("La cantidad debe ser un número positivo");
      return;
    }

    const minStock = parseInt(formData.min_stock, 10) || 0;

    // Enviar datos limpios y validados
    onSubmit({
      product_reference: formData.product_reference,
      quantity: quantity,
      movement_date: formData.movement_date,
      reason: formData.reason || "Adición de stock",
      notes: formData.notes || "",
      min_stock: minStock,
      location: formData.location || ""
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Agregar Stock al Inventario
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_reference">Producto *</Label>
              <select
                id="product_reference"
                value={formData.product_reference}
                onChange={(e) => handleInputChange('product_reference', e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">Seleccione un producto</option>
                {products.filter(p => p.is_active).map(product => (
                  <option key={product.reference} value={product.reference}>
                    {product.name} ({product.reference})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad a Agregar *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                required
                placeholder="Ej: 100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="movement_date">Fecha de Ingreso</Label>
              <Input
                id="movement_date"
                type="date"
                value={formData.movement_date}
                onChange={(e) => handleInputChange('movement_date', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del Ingreso</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="Ej: Compra, Producción, Devolución"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_stock">Stock Mínimo</Label>
              <Input
                id="min_stock"
                type="number"
                min="0"
                value={formData.min_stock}
                onChange={(e) => handleInputChange('min_stock', e.target.value)}
                placeholder="Ej: 50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación en Almacén</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Ej: Estante A-1, Bodega Principal"
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

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Agregar al Inventario
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}