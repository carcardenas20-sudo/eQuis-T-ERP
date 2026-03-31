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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Loader2, AlertCircle } from "lucide-react";

const defaultCustomer = {
  name: "",
  phone: "",
  is_active: true
};

export default function CustomerForm({ customer, onSave, onCancel }) {
  const [formData, setFormData] = useState(customer ? { ...defaultCustomer, ...customer } : defaultCustomer);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      setError("Nombre y teléfono son obligatorios.");
      return;
    }

    // Basic phone validation
    const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      setError("Por favor ingresa un número de teléfono válido.");
      return;
    }

    setIsSaving(true);
    setError("");

    await onSave(formData);
    setIsSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="w-6 h-6 text-blue-600" />
            {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            Rellena los datos básicos del cliente. Los campos con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input 
                id="name"
                placeholder="Ej: Juan Pérez"
                value={formData.name} 
                onChange={(e) => handleChange('name', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Número de Teléfono *</Label>
              <Input 
                id="phone"
                placeholder="Ej: 3001234567"
                value={formData.phone} 
                onChange={(e) => handleChange('phone', e.target.value)} 
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Switch 
                id="is_active" 
                checked={formData.is_active} 
                onCheckedChange={(value) => handleChange('is_active', value)} 
              />
              <Label htmlFor="is_active">Cliente activo</Label>
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
              'Guardar Cliente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}