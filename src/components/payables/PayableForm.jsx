import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";

export default function PayableForm({ payable, suppliers, locations, userLocation, onSave, onCancel, isAdmin = false }) {
  const [formData, setFormData] = useState({
    supplier_id: "",
    supplier_name: "",
    type: "purchase",
    description: "",
    category: "otros",
    total_amount: "",
    due_date: "",
    invoice_number: "",
    location_id: payable?.location_id || userLocation?.id || "",
    notes: ""
  });

  useEffect(() => {
    if (payable) {
      setFormData({
        supplier_id: payable.supplier_id || "",
        supplier_name: payable.supplier_name || "",
        type: payable.type || "purchase",
        description: payable.description || "",
        category: payable.category || "otros",
        total_amount: payable.total_amount || "",
        due_date: payable.due_date || "",
        invoice_number: payable.invoice_number || "",
        location_id: payable.location_id || userLocation?.id || "",
        notes: payable.notes || ""
      });
    }
  }, [payable, userLocation]);

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData({
      ...formData,
      supplier_id: supplierId,
      supplier_name: supplier?.nombre || ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.supplier_name || !formData.description || !formData.total_amount) {
      alert("Completa todos los campos obligatorios");
      return;
    }

    const totalAmount = parseFloat(formData.total_amount);
    
    onSave({
      ...formData,
      total_amount: totalAmount,
      paid_amount: payable?.paid_amount || 0,
      pending_amount: totalAmount - (payable?.paid_amount || 0),
      status: payable?.status || "pending"
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{payable ? "Editar" : "Nueva"} Cuenta por Pagar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Proveedor */}
            <div className="space-y-2">
              <Label>Proveedor / Acreedor *</Label>
              <Select value={formData.supplier_id} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Ingresar manualmente</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.supplier_id === "manual" && (
                <Input
                  placeholder="Nombre del acreedor"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                />
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Compra/Factura</SelectItem>
                  <SelectItem value="recurring_expense">Gasto Recurrente</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="materia_prima">Materia Prima</SelectItem>
                  <SelectItem value="alquiler">Alquiler</SelectItem>
                  <SelectItem value="servicios_publicos">Servicios Públicos</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="seguros">Seguros</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Monto Total */}
            <div className="space-y-2">
              <Label>Monto Total *</Label>
              <Input
                type="number"
                placeholder="0"
                value={formData.total_amount}
                onChange={(e) => setFormData({...formData, total_amount: e.target.value})}
              />
            </div>

            {/* Fecha límite */}
            <div className="space-y-2">
              <Label>Fecha Límite de Pago *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              />
            </div>

            {/* Número de factura */}
            <div className="space-y-2">
              <Label>Número de Factura</Label>
              <Input
                placeholder="Ej: FAC-001"
                value={formData.invoice_number}
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
              />
            </div>

            {/* Sucursal */}
            <div className="space-y-2">
              <Label>Sucursal *</Label>
              <Select value={formData.location_id} onValueChange={(val) => setFormData({...formData, location_id: val})} disabled={!isAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Input
              placeholder="Descripción breve del concepto"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas adicionales..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}