import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileSelect } from "@/components/ui/mobile-select";

const categories = [
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
];

const paymentMethods = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "check", label: "Cheque" },
  { value: "other", label: "Otro" }
];

export default function TemplateForm({ open, onClose, onSave, locations }) {
  const [form, setForm] = useState({
    supplier: "",
    category: "otros",
    day_suggested: 1,
    default_amount: "",
    payment_method: "transfer",
    location_id: locations?.[0]?.id || "",
    is_active: true,
    notes: ""
  });

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    if (!form.supplier || !form.category || !form.location_id) return;
    const payload = {
      ...form,
      day_suggested: Number(form.day_suggested || 1),
      default_amount: form.default_amount === "" ? undefined : Number(form.default_amount)
    };
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Plantilla</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Proveedor / Etiqueta</Label>
            <Input value={form.supplier} onChange={e => update('supplier', e.target.value)} placeholder="Ej: Energía EPM" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoría</Label>
              <MobileSelect value={form.category} onValueChange={v => update('category', v)} options={categories} placeholder="Categoría" />
            </div>
            <div className="space-y-1">
              <Label>Día sugerido</Label>
              <Input type="number" min={1} max={31} value={form.day_suggested} onChange={e => update('day_suggested', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Método pago (opcional)</Label>
              <MobileSelect value={form.payment_method} onValueChange={v => update('payment_method', v)} options={paymentMethods} placeholder="Método" />
            </div>
            <div className="space-y-1">
              <Label>Monto por defecto (opcional)</Label>
              <Input type="number" value={form.default_amount} onChange={e => update('default_amount', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Sucursal</Label>
            <MobileSelect value={form.location_id} onValueChange={v => update('location_id', v)} options={locations.map(l => ({ value: l.id, label: l.name }))} placeholder="Sucursal" />
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}