
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { motion } from "framer-motion";

export default function FormularioFactura({ factura, compras, proveedores, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(factura || {
    numero_factura: "",
    compra_id: "",
    proveedor_id: "",
    proveedor_nombre: "",
    fecha_factura: new Date().toISOString().split('T')[0],
    fecha_vencimiento: "",
    subtotal: 0,
    impuestos: 0,
    total: 0,
    saldo_pendiente: 0,
    estado: "pendiente",
    observaciones: ""
  });

  // Effect to calculate total and saldo_pendiente automatically
  useEffect(() => {
    const subtotal = parseFloat(formData.subtotal) || 0;
    const impuestos = parseFloat(formData.impuestos) || 0;
    const nuevoTotal = subtotal + impuestos;
    
    // Only update if the total or saldo_pendiente actually changed to avoid unnecessary re-renders
    if (formData.total !== nuevoTotal || formData.saldo_pendiente !== nuevoTotal) {
      setFormData(prev => ({
        ...prev,
        total: nuevoTotal,
        saldo_pendiente: nuevoTotal
      }));
    }
  }, [formData.subtotal, formData.impuestos, formData.total, formData.saldo_pendiente]); // Added total and saldo_pendiente to dependencies for completeness and to prevent infinite loop from setting the same values.

  const handleCompraChange = (compraId) => {
    if (compraId) {
      const compra = compras.find(c => c.id === compraId);
      if (compra) {
        setFormData({
          ...formData,
          compra_id: compraId,
          proveedor_id: compra.proveedor_id,
          proveedor_nombre: compra.proveedor_nombre,
          subtotal: compra.subtotal || 0,
          impuestos: compra.impuestos || 0,
          // total and saldo_pendiente will be recalculated by useEffect
        });
      }
    } else {
      setFormData({
        ...formData,
        compra_id: "",
        // When no purchase is selected, we might want to reset subtotal/impuestos or leave them for manual input.
        // For now, let's reset to allow manual input or re-selection
        subtotal: 0,
        impuestos: 0,
        // total and saldo_pendiente will be recalculated by useEffect
      });
    }
  };

  const handleProveedorChange = (proveedorId) => {
    const proveedor = proveedores.find(p => p.id === proveedorId);
    setFormData({
      ...formData,
      proveedor_id: proveedorId,
      proveedor_nombre: proveedor?.nombre || "",
      compra_id: "" // Reset compra when changing proveedor
    });
  };

  const calcularFechaVencimiento = (fechaFactura) => {
    const fecha = new Date(fechaFactura);
    fecha.setDate(fecha.getDate() + 30); // 30 días por defecto
    return fecha.toISOString().split('T')[0];
  };

  const handleFechaFacturaChange = (fecha) => {
    setFormData({
      ...formData,
      fecha_factura: fecha,
      fecha_vencimiento: formData.fecha_vencimiento || calcularFechaVencimiento(fecha)
    });
  };

  // handleTotalChange is no longer needed as total is calculated automatically.
  // const handleTotalChange = (total) => {
  //   const nuevoTotal = parseFloat(total) || 0;
  //   setFormData({
  //     ...formData,
  //     total: nuevoTotal,
  //     saldo_pendiente: nuevoTotal
  //   });
  // };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.numero_factura) {
      alert("El número de factura es obligatorio");
      return;
    }
    
    if (!formData.proveedor_id) {
      alert("Debe seleccionar un proveedor");
      return;
    }
    
    if (formData.total <= 0) {
      alert("El total debe ser mayor a cero");
      return;
    }
    
    onSubmit(formData);
  };

  // Filtrar compras por proveedor seleccionado
  const comprasFiltradas = compras.filter(c => 
    c.proveedor_id === formData.proveedor_id && 
    c.estado === 'recibida'
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-green-50 to-teal-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {factura ? 'Editar Factura' : 'Registrar Factura'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="numero_factura">Número de Factura *</Label>
                  <Input
                    id="numero_factura"
                    value={formData.numero_factura}
                    onChange={(e) => setFormData({...formData, numero_factura: e.target.value})}
                    placeholder="FAC-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="proveedor">Proveedor *</Label>
                  <Select
                    value={formData.proveedor_id}
                    onValueChange={handleProveedorChange}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {proveedores.filter(p => p.activo).map((proveedor) => (
                        <SelectItem key={proveedor.id} value={proveedor.id}>
                          {proveedor.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.proveedor_id && (
                <div>
                  <Label htmlFor="compra">Orden de Compra (Opcional)</Label>
                  <Select
                    value={formData.compra_id || ""} // Ensure value is a string, even if null
                    onValueChange={(value) => handleCompraChange(value === "" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Asociar con una orden de compra" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Sin asociar</SelectItem> {/* Changed to empty string for consistency */}
                      {comprasFiltradas.map((compra) => (
                        <SelectItem key={compra.id} value={compra.id}>
                          {compra.numero_orden} - ${compra.total.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fecha_factura">Fecha de Factura *</Label>
                  <Input
                    id="fecha_factura"
                    type="date"
                    value={formData.fecha_factura}
                    onChange={(e) => handleFechaFacturaChange(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento *</Label>
                  <Input
                    id="fecha_vencimiento"
                    type="date"
                    value={formData.fecha_vencimiento}
                    onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input
                    id="subtotal"
                    type="number"
                    step="0.01"
                    value={formData.subtotal}
                    onChange={(e) => setFormData({...formData, subtotal: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="impuestos">Impuestos</Label>
                  <Input
                    id="impuestos"
                    type="number"
                    step="0.01"
                    value={formData.impuestos}
                    onChange={(e) => setFormData({...formData, impuestos: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="total">Total *</Label>
                  <Input
                    id="total"
                    type="number"
                    step="0.01"
                    value={formData.total.toFixed(2)} // Display with 2 decimal places
                    placeholder="0.00"
                    readOnly // Made readOnly as it's calculated
                    className="bg-slate-100 font-bold"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => setFormData({...formData, estado: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagada_parcial">Pagada Parcial</SelectItem>
                    <SelectItem value="pagada_total">Pagada Total</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                >
                  {factura ? 'Actualizar' : 'Registrar'} Factura
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
