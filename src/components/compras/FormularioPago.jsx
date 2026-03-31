import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

export default function FormularioPago({ pago, factura, facturas, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(pago || {
    numero_comprobante: `PAG-${Date.now()}`,
    factura_id: factura?.id || "",
    proveedor_id: factura?.proveedor_id || "",
    proveedor_nombre: factura?.proveedor_nombre || "",
    fecha_pago: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo_pago: "transferencia",
    referencia: "",
    observaciones: ""
  });

  const [facturaSeleccionada, setFacturaSeleccionada] = useState(factura || null);
  
  useEffect(() => {
    if (factura) {
      setFacturaSeleccionada(factura);
      setFormData(prev => ({
        ...prev,
        factura_id: factura.id,
        proveedor_id: factura.proveedor_id,
        proveedor_nombre: factura.proveedor_nombre,
        monto: factura.saldo_pendiente || 0
      }));
    }
  }, [factura]);

  const handleFacturaChange = (facturaId) => {
    const facturaEncontrada = facturas.find(f => f.id === facturaId);
    if (facturaEncontrada) {
      setFacturaSeleccionada(facturaEncontrada);
      setFormData({
        ...formData,
        factura_id: facturaId,
        proveedor_id: facturaEncontrada.proveedor_id,
        proveedor_nombre: facturaEncontrada.proveedor_nombre,
        monto: facturaEncontrada.saldo_pendiente || 0
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.factura_id) {
      alert("Debe seleccionar una factura");
      return;
    }
    
    if (formData.monto <= 0) {
      alert("El monto debe ser mayor a cero");
      return;
    }
    
    if (facturaSeleccionada && formData.monto > facturaSeleccionada.saldo_pendiente) {
      alert("El monto no puede ser mayor al saldo pendiente de la factura");
      return;
    }
    
    onSubmit(formData);
  };

  // Filtrar facturas que tienen saldo pendiente
  const facturasConSaldo = facturas.filter(f => 
    f.estado !== 'pagada_total' && (f.saldo_pendiente || 0) > 0
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
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-6 h-6" />
                {pago ? 'Editar Pago' : 'Registrar Pago'}
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
                  <Label htmlFor="numero_comprobante">Número de Comprobante *</Label>
                  <Input
                    id="numero_comprobante"
                    value={formData.numero_comprobante}
                    onChange={(e) => setFormData({...formData, numero_comprobante: e.target.value})}
                    placeholder="PAG-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_pago">Fecha de Pago *</Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={formData.fecha_pago}
                    onChange={(e) => setFormData({...formData, fecha_pago: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="factura">Factura a Pagar *</Label>
                <Select
                  value={formData.factura_id}
                  onValueChange={handleFacturaChange}
                  required
                  disabled={!!factura} // Si viene desde una factura específica, no permitir cambiar
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar factura" />
                  </SelectTrigger>
                  <SelectContent>
                    {facturasConSaldo.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.numero_factura} - {f.proveedor_nombre} (Saldo: ${f.saldo_pendiente?.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {facturaSeleccionada && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Información de la Factura</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Proveedor:</span>
                      <div className="font-medium">{facturaSeleccionada.proveedor_nombre}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Factura:</span>
                      <div className="font-medium">${facturaSeleccionada.total?.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Saldo Pendiente:</span>
                      <div className="font-bold text-red-600">${facturaSeleccionada.saldo_pendiente?.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Estado:</span>
                      <Badge className={
                        facturaSeleccionada.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                        facturaSeleccionada.estado === 'pagada_parcial' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }>
                        {facturaSeleccionada.estado.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="monto">Monto del Pago *</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    value={formData.monto}
                    onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    max={facturaSeleccionada?.saldo_pendiente}
                    required
                  />
                  {facturaSeleccionada && (
                    <div className="text-xs text-slate-500 mt-1">
                      Máximo: ${facturaSeleccionada.saldo_pendiente?.toFixed(2)}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="metodo_pago">Método de Pago</Label>
                  <Select
                    value={formData.metodo_pago}
                    onValueChange={(value) => setFormData({...formData, metodo_pago: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="referencia">Referencia / Número de Cheque</Label>
                <Input
                  id="referencia"
                  value={formData.referencia}
                  onChange={(e) => setFormData({...formData, referencia: e.target.value})}
                  placeholder="Número de referencia, cheque, etc."
                />
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

              {facturaSeleccionada && formData.monto > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Resultado del Pago</h4>
                  <div className="text-sm text-green-700">
                    <p>Saldo actual: ${facturaSeleccionada.saldo_pendiente?.toFixed(2)}</p>
                    <p>Monto a pagar: ${formData.monto.toFixed(2)}</p>
                    <p className="font-bold">
                      Nuevo saldo: ${(facturaSeleccionada.saldo_pendiente - formData.monto).toFixed(2)}
                    </p>
                    {formData.monto >= facturaSeleccionada.saldo_pendiente && (
                      <p className="text-green-800 font-bold">✓ Factura quedará pagada completamente</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {pago ? 'Actualizar' : 'Registrar'} Pago
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}