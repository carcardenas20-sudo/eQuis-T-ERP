import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Receipt, Loader2, AlertCircle, Building2, Lock } from "lucide-react";
import { getCurrentDateString } from "../utils/dateUtils";
import { MobileSelect } from "@/components/ui/mobile-select";

export default function ExpenseForm({ expense, locations, currentUser, onSave, onCancel, isAdmin = false }) {
  // Determine default location based on user role
  const getDefaultLocationId = () => {
    if (expense?.location_id) return expense.location_id;
    if (isAdmin) return locations[0]?.id || "";
    return currentUser?.location_id || "";
  };

  const [formData, setFormData] = useState(expense || {
    description: "",
    amount: "",
    category: "otros",
    expense_date: getCurrentDateString(), // This now uses Colombia date
    location_id: getDefaultLocationId(),
    payment_method: "cash",
    receipt_number: "",
    supplier: "",
    is_recurring: false,
    notes: ""
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Check if user can modify location
  const canChangeLocation = isAdmin;
  
  // Get location name for display
  const getLocationName = (locationId) => {
    return locations.find(l => l.id === locationId)?.name || "Sin sucursal";
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.amount || !formData.category || !formData.location_id) {
      setError("Los campos descripción, monto, categoría y sucursal son obligatorios.");
      return;
    }

    if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
      setError("El monto debe ser un número mayor a 0.");
      return;
    }

    // Additional validation: non-admin users can only create expenses for their assigned location
    if (!canChangeLocation && formData.location_id !== currentUser?.location_id) {
      setError("Solo puedes registrar gastos en tu sucursal asignada.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const dataToSave = {
        ...formData,
        amount: parseFloat(formData.amount)
        // La fecha del gasto ya está en formato YYYY-MM-DD, lo cual es correcto
        // para campos de tipo "date" en la entidad
      };
      
      await onSave(dataToSave);
    } catch (error) {
      setError("Error al guardar el gasto. Inténtalo de nuevo.");
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-600" />
            {expense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Location Display/Selector - Prominently placed at the top */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-sm font-medium text-blue-900 flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4" />
              Sucursal donde se registra el gasto
            </Label>
            
            {canChangeLocation ? (
              <MobileSelect
                value={formData.location_id}
                onValueChange={(value) => handleChange('location_id', value)}
                placeholder="Seleccionar sucursal"
                options={locations.map(location => ({
                  value: location.id,
                  label: location.name
                }))}
                className="bg-white"
              />
            ) : (
              <div className="relative">
                <Input 
                  value={getLocationName(formData.location_id)}
                  readOnly 
                  disabled 
                  className="bg-gray-100 text-gray-700 pr-10" 
                />
                <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            )}
            
            {!canChangeLocation && (
              <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Solo puedes registrar gastos en tu sucursal asignada
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descripción del Gasto *</Label>
              <Input 
                id="description"
                placeholder="Ej: Pago de electricidad, compra de papel"
                value={formData.description} 
                onChange={(e) => handleChange('description', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input 
                id="amount"
                type="number"
                placeholder="0.00"
                value={formData.amount} 
                onChange={(e) => handleChange('amount', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <MobileSelect
                value={formData.category}
                onValueChange={(value) => handleChange('category', value)}
                placeholder="Seleccionar categoría"
                options={[
                  { value: "servicios_publicos", label: "Servicios Públicos" },
                  { value: "alquiler", label: "Alquiler" },
                  { value: "suministros", label: "Suministros" },
                  { value: "marketing", label: "Marketing" },
                  { value: "transporte", label: "Transporte" },
                  { value: "alimentacion", label: "Alimentación" },
                  { value: "mantenimiento", label: "Mantenimiento" },
                  { value: "salarios", label: "Salarios" },
                  { value: "impuestos", label: "Impuestos" },
                  { value: "seguros", label: "Seguros" },
                  { value: "telecomunicaciones", label: "Telecomunicaciones" },
                  { value: "otros", label: "Otros" }
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_date">Fecha del Gasto (Hora Colombia) *</Label>
              <Input 
                id="expense_date"
                type="date"
                value={formData.expense_date} 
                onChange={(e) => handleChange('expense_date', e.target.value)} 
                title="Fecha en zona horaria de Colombia"
              />
              <p className="text-xs text-slate-500">
                Las fechas se registran en hora de Colombia (UTC-5)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pago</Label>
              <MobileSelect
                value={formData.payment_method}
                onValueChange={(value) => handleChange('payment_method', value)}
                placeholder="Método de pago"
                options={[
                  { value: "cash", label: "Efectivo" },
                  { value: "card", label: "Tarjeta" },
                  { value: "transfer", label: "Transferencia" },
                  { value: "check", label: "Cheque" },
                  { value: "other", label: "Otro" }
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor/Empresa</Label>
              <Input 
                id="supplier"
                placeholder="Ej: EPM, Codensa, Office Depot"
                value={formData.supplier} 
                onChange={(e) => handleChange('supplier', e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt_number">Número de Factura/Recibo</Label>
            <Input 
              id="receipt_number"
              placeholder="Ej: 001-123456"
              value={formData.receipt_number} 
              onChange={(e) => handleChange('receipt_number', e.target.value)} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea 
              id="notes"
              placeholder="Detalles adicionales del gasto..."
              value={formData.notes} 
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="is_recurring" 
              checked={formData.is_recurring} 
              onCheckedChange={(checked) => handleChange('is_recurring', checked)} 
            />
            <Label htmlFor="is_recurring">Este es un gasto recurrente</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Registrar Gasto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}