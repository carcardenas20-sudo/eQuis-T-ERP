import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Building, Calendar, DollarSign, Link2, Eye, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";

export default function EstadoCuentaProveedor({ proveedor, facturas, pagos, onClose }) {
  const [linkCopiado, setLinkCopiado] = useState(false);
  
  const totalDeuda = facturas.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0);
  const totalFacturado = facturas.reduce((sum, f) => sum + (f.total || 0), 0);
  const totalPagado = pagos.reduce((sum, p) => sum + (p.monto || 0), 0);

  // Crear historial cronológico de transacciones
  const crearHistorialTransacciones = () => {
    const transacciones = [];
    
    // Agregar facturas
    facturas.forEach(factura => {
      transacciones.push({
        fecha: factura.fecha_factura,
        tipo: 'factura',
        descripcion: `Factura ${factura.numero_factura}`,
        monto: factura.total,
        esCredito: true, // Las facturas aumentan la deuda
        documento: factura.numero_factura,
        estado: factura.estado,
        id: factura.id
      });
    });
    
    // Agregar pagos
    pagos.forEach(pago => {
      transacciones.push({
        fecha: pago.fecha_pago,
        tipo: 'pago',
        descripcion: `Pago ${pago.numero_comprobante}`,
        monto: pago.monto,
        esCredito: false, // Los pagos disminuyen la deuda
        documento: pago.numero_comprobante,
        metodo: pago.metodo_pago,
        id: pago.id
      });
    });
    
    // Ordenar por fecha (más antiguos primero)
    transacciones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    // Calcular saldo después de cada transacción
    let saldoActual = 0;
    return transacciones.map(transaccion => {
      if (transaccion.esCredito) {
        saldoActual += transaccion.monto; // Factura aumenta deuda
      } else {
        saldoActual -= transaccion.monto; // Pago disminuye deuda
      }
      
      return {
        ...transaccion,
        saldoDespues: saldoActual
      };
    });
  };

  const historial = crearHistorialTransacciones();
  
  // Generar link único para el proveedor
  const linkPublico = `${window.location.origin}${createPageUrl('EstadoCuentaPublico')}?proveedor=${proveedor.id}&token=${btoa(proveedor.id + '_' + proveedor.nombre)}`;

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch (error) {
      alert('Error al copiar el link');
    }
  };

  const abrirEnNuevaVentana = () => {
    window.open(linkPublico, '_blank');
  };

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
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-6 h-6" />
                Estado de Cuenta - {proveedor.nombre}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 text-center">
                  <div className="text-sm font-medium text-red-600">Saldo Pendiente</div>
                  <div className="text-2xl font-bold text-red-700 flex items-center justify-center gap-1">
                    <DollarSign className="w-5 h-5" />
                    {totalDeuda.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <div className="text-sm font-medium text-blue-600">Total Facturado</div>
                  <div className="text-2xl font-bold text-blue-700 flex items-center justify-center gap-1">
                    <DollarSign className="w-5 h-5" />
                    {totalFacturado.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <div className="text-sm font-medium text-green-600">Total Pagado</div>
                  <div className="text-2xl font-bold text-green-700 flex items-center justify-center gap-1">
                    <DollarSign className="w-5 h-5" />
                    {totalPagado.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Link Público */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 mb-8">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
                      <Link2 className="w-4 h-4" />
                      Link para Proveedor
                    </h4>
                    <p className="text-sm text-slate-600">
                      Comparte este link con el proveedor para que revise su estado de cuenta en tiempo real
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={abrirEnNuevaVentana}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Vista Previa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copiarLink}
                      className={`${linkCopiado ? 'text-green-600 border-green-200' : 'text-purple-600 border-purple-200 hover:bg-purple-50'}`}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {linkCopiado ? '¡Copiado!' : 'Copiar Link'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Historial Cronológico */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Historial de Transacciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {historial.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No hay transacciones registradas
                    </div>
                  ) : (
                    historial.map((transaccion, index) => (
                      <div key={`${transaccion.tipo}-${transaccion.id}-${index}`} 
                           className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="text-sm font-medium text-slate-600">
                              {format(new Date(transaccion.fecha), "dd/MMM/yyyy")}
                            </div>
                            <Badge className={`${
                              transaccion.tipo === 'factura' 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            } text-xs`}>
                              {transaccion.tipo === 'factura' ? '📄 Factura' : '💳 Pago'}
                            </Badge>
                            {transaccion.metodo && (
                              <Badge variant="outline" className="text-xs">
                                {transaccion.metodo}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-700">
                            {transaccion.descripcion}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            transaccion.esCredito ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {transaccion.esCredito ? '+' : '-'}${transaccion.monto.toFixed(2)}
                          </div>
                          <div className="text-sm text-slate-500">
                            Saldo: <span className={`font-semibold ${
                              transaccion.saldoDespues > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${transaccion.saldoDespues.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}