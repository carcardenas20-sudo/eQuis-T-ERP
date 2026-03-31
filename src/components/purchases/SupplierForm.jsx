import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function SupplierForm({ supplier, onSave, onCancel }) {
  const [formData, setFormData] = useState(supplier || {
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    document: "",
    payment_terms: "cash",
    is_active: true
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.phone) {
      alert("Por favor completa los campos requeridos (Nombre y Teléfono).");
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre de la Empresa *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ej: Distribuidora ABC"
              />
            </div>
            <div>
              <Label htmlFor="contact_name">Nombre del Contacto</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="300 123 4567"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="document">NIT/Documento</Label>
            <Input
              id="document"
              value={formData.document}
              onChange={(e) => handleChange('document', e.target.value)}
              placeholder="123456789-1"
            />
          </div>

          <div>
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Dirección completa..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="payment_terms">Términos de Pago</Label>
            <Select
              value={formData.payment_terms}
              onValueChange={(value) => handleChange('payment_terms', value)}
            >
              <SelectTrigger id="payment_terms">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Contado</SelectItem>
                <SelectItem value="15_days">15 días</SelectItem>
                <SelectItem value="30_days">30 días</SelectItem>
                <SelectItem value="45_days">45 días</SelectItem>
                <SelectItem value="60_days">60 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Proveedor Activo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {supplier ? "Actualizar Proveedor" : "Crear Proveedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}