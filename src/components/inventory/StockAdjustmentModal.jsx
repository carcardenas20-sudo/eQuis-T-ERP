import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Loader2, AlertCircle } from "lucide-react";

export default function StockAdjustmentModal({ item, onSave, onCancel }) {
  const [newStock, setNewStock] = useState(item?.current_stock || 0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (newStock < 0) {
      setError("El stock no puede ser negativo.");
      return;
    }

    if (!reason.trim()) {
      setError("Debe proporcionar un motivo para el ajuste.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        newStock: parseInt(newStock, 10),
        reason: reason.trim(),
        previousStock: item.current_stock
      });
    } catch (err) {
      setError("Error al guardar el ajuste de stock.");
    }
    setIsSaving(false);
  };

  const stockDifference = newStock - (item?.current_stock || 0);

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="w-6 h-6 text-blue-600" />
            Ajustar Stock
          </DialogTitle>
          <DialogDescription>
            Actualiza el stock del producto "{item?.product?.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">SKU:</span>
              <span className="text-sm text-slate-900">{item?.product_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Ubicación:</span>
              <span className="text-sm text-slate-900">{item?.location?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Stock Actual:</span>
              <span className="text-sm font-bold text-slate-900">{item?.current_stock} uds</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newStock">Nuevo Stock *</Label>
              <Input 
                id="newStock"
                type="number"
                min="0"
                placeholder="Cantidad"
                value={newStock} 
                onChange={(e) => setNewStock(parseInt(e.target.value, 10) || 0)} 
              />
              {stockDifference !== 0 && (
                <p className={`text-sm ${stockDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stockDifference > 0 ? '+' : ''}{stockDifference} unidades
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del Ajuste *</Label>
              <Textarea 
                id="reason"
                placeholder="Ej: Conteo físico, productos dañados, corrección de error..."
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar Ajuste'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}