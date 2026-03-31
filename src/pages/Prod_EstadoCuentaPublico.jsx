
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Proveedor, Factura, Pago } from "@/api/entitiesChaquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Calendar, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function EstadoCuentaPublico() {
  const [searchParams] = useSearchParams();
  const proveedorId = searchParams.get('proveedor');
  const token = searchParams.get('token');
  
  const [proveedor, setProveedor] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadEstadoCuenta = useCallback(async () => {
    if (!proveedorId || !token) {
      setError('Link inválido o incompleto');
      setIsLoading(false);
      return;
    }

    try {
      // Validar token básico
      // const tokenEsperado = btoa(proveedorId + '_' + 'TOKEN_VALIDATION'); // This line was commented in the original
      // En un sistema real, aquí validarías el token de forma más segura
      
      const [proveedorData, facturasData, pagosData] = await Promise.all([
        Proveedor.list(),
        Factura.list(),
        Pago.list()
      ]);

      const proveedorEncontrado = proveedorData.find(p => p.id === proveedorId);
      if (!proveedorEncontrado) {
        setError('Proveedor no encontrado');
        setIsLoading(false);
        return;
      }

      const facturasDelProveedor = facturasData.filter(f => f.proveedor_id === proveedorId);
      const pagosDelProveedor = pagosData.filter(p => p.proveedor_id === proveedorId);

      setProveedor(proveedorEncontrado);
      setFacturas(facturasDelProveedor);
      setPagos(pagosDelProveedor);
    } catch (error) {
      console.error('Error cargando estado de cuenta:', error);
      setError('Error al cargar la información');
    }

    setIsLoading(false);
  }, [proveedorId, token]);

  useEffect(() => {
    loadEstadoCuenta();
  }, [loadEstadoCuenta]);

  const crearHistorialTransacciones = () => {
    const transacciones = [];
    
    facturas.forEach(factura => {
      transacciones.push({
        fecha: factura.fecha_factura,
        tipo: 'factura',
        descripcion: `Factura ${factura.numero_factura}`,
        monto: factura.total,
        esCredito: true,
        estado: factura.estado
      });
    });
    
    pagos.forEach(pago => {
      transacciones.push({
        fecha: pago.fecha_pago,
        tipo: 'pago',
        descripcion: `Pago ${pago.numero_comprobante}`,
        monto: pago.monto,
        esCredito: false,
        metodo: pago.metodo_pago
      });
    });
    
    transacciones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    let saldoActual = 0;
    return transacciones.map(transaccion => {
      if (transaccion.esCredito) {
        saldoActual += transaccion.monto;
      } else {
        saldoActual -= transaccion.monto;
      }
      
      return {
        ...transaccion,
        saldoDespues: saldoActual
      };
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando estado de cuenta...</p>
        </div>
      </div>
    );
  }

  if (error || !proveedor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white shadow-xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDeuda = facturas.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0);
  const totalFacturado = facturas.reduce((sum, f) => sum + (f.total || 0), 0);
  const totalPagado = pagos.reduce((sum, p) => sum + (p.monto || 0), 0);
  const historial = crearHistorialTransacciones();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-8 bg-white shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <Building className="w-8 h-8" />
              Estado de Cuenta - {proveedor.nombre}
            </CardTitle>
            <p className="text-blue-100">
              Actualizado en tiempo real • {format(new Date(), "dd/MM/yyyy HH:mm")}
            </p>
          </CardHeader>
        </Card>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className={`${totalDeuda > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} shadow-lg`}>
            <CardContent className="p-6 text-center">
              <div className={`text-sm font-medium ${totalDeuda > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Saldo Pendiente
              </div>
              <div className={`text-3xl font-bold flex items-center justify-center gap-2 ${totalDeuda > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {totalDeuda > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                <DollarSign className="w-6 h-6" />
                {totalDeuda.toFixed(2)}
              </div>
              {totalDeuda === 0 && (
                <p className="text-green-600 text-sm font-medium mt-2">¡Al día!</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-sm font-medium text-blue-600">Total Facturado</div>
              <div className="text-3xl font-bold text-blue-700 flex items-center justify-center gap-1">
                <DollarSign className="w-6 h-6" />
                {totalFacturado.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-sm font-medium text-green-600">Total Pagado</div>
              <div className="text-3xl font-bold text-green-700 flex items-center justify-center gap-1">
                <DollarSign className="w-6 h-6" />
                {totalPagado.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Historial */}
        <Card className="bg-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Historial de Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {historial.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No hay movimientos registrados</p>
                </div>
              ) : (
                historial.map((transaccion, index) => (
                  <div key={index} 
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

        {/* Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>ChaquetasPro - Sistema de Gestión</p>
          <p>Para consultas, contacte directamente con la empresa</p>
        </div>
      </div>
    </div>
  );
}
