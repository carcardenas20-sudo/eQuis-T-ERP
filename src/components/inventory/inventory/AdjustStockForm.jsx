import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, Settings } from "lucide-react";

// Función auxiliar para obtener fecha de Colombia
const getColombiaTodayString = () => {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombiaTime.toISOString().split('T')[0];
};

export default function AdjustStockForm({ products, inventoryItems, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    product_reference: "",
    adjustment_type: "subtract", // subtract, add, set_to
    quantity: "",
    new_quantity: "", // for set_to type
    movement_date: getColombiaTodayString(),
    reason: "Ajuste de inventario",
    notes: ""
  });

  const [currentStock, setCurrentStock] = useState(0);

  const handleProductChange = (reference) => {
    setFormData(prev => ({ ...prev, product_reference: reference }));
    
    const inventory = inventoryItems.find(item => item.product_reference === reference);
    setCurrentStock(inventory ? inventory.current_stock : 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.product_reference) {
      alert("Selecciona un producto");
      return;
    }

    if (formData.adjustment_type === 'set_to') {
      if (!formData.new_quantity || formData.new_quantity === '') {
        alert("Especifica la nueva cantidad de stock");
        return;
      }
      if (parseFloat(formData.new_quantity) < 0) {
        alert("La cantidad no puede ser negativa");
        return;
      }
    } else {
      if (!formData.quantity || formData.quantity === '') {
        alert("Especifica la cantidad a ajustar");
        return;
      }
      if (parseFloat(formData.quantity) <= 0) {
        alert("La cantidad debe ser mayor a 0");
        return;
      }
    }

    const submitData = {
      ...formData,
      quantity: formData.quantity ? parseFloat(formData.quantity) : 0,
      new_quantity: formData.new_quantity ? parseFloat(formData.new_quantity) : 0
    };

    onSubmit(submitData);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPreviewStock = () => {
    if (formData.adjustment_type === 'set_to' && formData.new_quantity) {
      return parseFloat(formData.new_quantity);
    } else if (formData.adjustment_type === 'subtract' && formData.quantity) {
      return Math.max(0, currentStock - parseFloat(formData.quantity));
    } else if (formData.adjustment_type === 'add' && formData.quantity) {
      return currentStock + parseFloat(formData.quantity);
    }
    return currentStock;
  };

  return (
    <Card className="mb-6 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <Settings className="w-5 h-5" />
          Ajustar Stock de Inventario
        </CardTitle>
        <p className="text-sm text-orange-600">
          Realiza ajustes, correcciones o registra mermas en el inventario
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_reference">Producto *</Label>
              <select
                id="product_reference"
                value={formData.product_reference}
                onChange={(e) => handleProductChange(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">Seleccione un producto</option>
                {inventoryItems.map(item => {
                  const product = products.find(p => p.reference === item.product_reference);
                  return (
                    <option key={item.product_reference} value={item.product_reference}>
                      {product ? product.name : item.product_reference} (Stock actual: {item.current_stock})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment_type">Tipo de Ajuste *</Label>
              <select
                id="adjustment_type"
                value={formData.adjustment_type}
                onChange={(e) => handleInputChange('adjustment_type', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="subtract">Restar Cantidad</option>
                <option value="add">Sumar Cantidad</option>
                <option value="set_to">Ajustar a Cantidad Específica</option>
              </select>
            </div>
          </div>

          {formData.product_reference && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">Stock actual: <span className="font-bold text-slate-800">{currentStock}</span></p>
            </div>
          )}

          {formData.adjustment_type === 'set_to' ? (
            <div className="space-y-2">
              <Label htmlFor="new_quantity">Nueva Cantidad Total *</Label>
              <Input
                id="new_quantity"
                type="number"
                min="0"
                step="1"
                value={formData.new_quantity}
                onChange={(e) => handleInputChange('new_quantity', e.target.value)}
                placeholder="Ej: 100"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Cantidad a {formData.adjustment_type === 'add' ? 'Sumar' : 'Restar'} *
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                placeholder="Ej: 25"
                required
              />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="movement_date">Fecha del Ajuste *</Label>
              <Input
                id="movement_date"
                type="date"
                value={formData.movement_date}
                onChange={(e) => handleInputChange('movement_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del Ajuste</Label>
              <select
                id="reason"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="Ajuste de inventario">Ajuste de inventario</option>
                <option value="Merma/Pérdida">Merma/Pérdida</option>
                <option value="Producto dañado">Producto dañado</option>
                <option value="Corrección por conteo físico">Corrección por conteo físico</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Describe el motivo específico del ajuste..."
              className="h-20"
            />
          </div>

          {(formData.quantity || formData.new_quantity) && formData.product_reference && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Vista previa del ajuste:</p>
              <div className="flex justify-between items-center">
                <span className="text-blue-800">Stock resultante:</span>
                <span className="text-2xl font-bold text-blue-800">{getPreviewStock()}</span>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {formData.adjustment_type === 'set_to' 
                  ? `Ajustar de ${currentStock} a ${formData.new_quantity}`
                  : `${formData.adjustment_type === 'add' ? 'Sumar' : 'Restar'} ${formData.quantity} ${formData.adjustment_type === 'add' ? 'a' : 'de'} ${currentStock}`
                }
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
              <Save className="w-4 h-4 mr-2" />
              Realizar Ajuste
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}