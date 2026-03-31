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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Loader2, AlertCircle } from "lucide-react";

const defaultAccount = {
  name: "",
  account_number: "",
  account_type: "ahorros",
  holder_name: "",
  is_active: true
};

export default function BankAccountForm({ account, onSave, onCancel }) {
  const [formData, setFormData] = useState(account ? { ...defaultAccount, ...account } : defaultAccount);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.account_number || !formData.holder_name) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave(formData);
    } catch (error) {
      setError("Error al guardar la cuenta bancaria.");
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-6 h-6 text-blue-600" />
            {account ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
          </DialogTitle>
          <DialogDescription>
            Configura las cuentas donde puedes recibir transferencias.
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
              <Label htmlFor="name">Nombre del Banco *</Label>
              <Input 
                id="name"
                placeholder="Ej: Bancolombia, Davivienda, Nequi"
                value={formData.name} 
                onChange={(e) => handleChange('name', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Número de Cuenta *</Label>
              <Input 
                id="account_number"
                placeholder="Ej: 123-456789-01 o 3001234567"
                value={formData.account_number} 
                onChange={(e) => handleChange('account_number', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_type">Tipo de Cuenta</Label>
              <Select 
                value={formData.account_type} 
                onValueChange={(value) => handleChange('account_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ahorros">Ahorros</SelectItem>
                  <SelectItem value="corriente">Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="holder_name">Titular de la Cuenta *</Label>
              <Input 
                id="holder_name"
                placeholder="Ej: JacketMaster S.A.S."
                value={formData.holder_name} 
                onChange={(e) => handleChange('holder_name', e.target.value)} 
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
              <Label htmlFor="is_active">Cuenta activa para recibir pagos</Label>
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
              'Guardar Cuenta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}