import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, DollarSign, Building, CreditCard, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";

const getStatusColor = (estado) => {
  const colors = {
    pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    pagada_parcial: 'bg-blue-100 text-blue-700 border-blue-200',
    pagada_total: 'bg-green-100 text-green-700 border-green-200',
    vencida: 'bg-red-100 text-red-700 border-red-200'
  };
  return colors[estado] || colors.pendiente;
};

function TarjetaFactura({ factura, onEdit, onDelete, onPagar }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar la factura "${factura.numero_factura}"?`)) {
      onDelete(factura.id);
    }
  };

  const safeDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const fechaVenc = safeDate(factura.fecha_vencimiento);
  const diasVencimiento = fechaVenc ? differenceInDays(fechaVenc, new Date()) : null;
  const estaVencida = diasVencimiento !== null && diasVencimiento < 0;
  const proximaVencer = diasVencimiento !== null && diasVencimiento <= 7 && diasVencimiento >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`bg-white border-slate-200 hover:border-green-300 transition-all duration-200 h-full group ${
        estaVencida ? 'border-l-4 border-l-red-500' : proximaVencer ? 'border-l-4 border-l-orange-500' : ''
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                {factura.numero_factura}
              </CardTitle>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={`${getStatusColor(factura.estado)} border font-medium`}>
                  {factura.estado.replace('_', ' ')}
                </Badge>
                {estaVencida && (
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Vencida
                  </Badge>
                )}
                {proximaVencer && !estaVencida && (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Próxima a vencer
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {factura.estado !== 'pagada_total' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onPagar(factura)}
                  className="hover:bg-green-50 hover:text-green-600 transition-colors h-8 w-8"
                  title="Registrar pago"
                >
                  <CreditCard className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(factura)}
                className="hover:bg-blue-50 hover:text-blue-600 transition-colors h-8 w-8"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="hover:bg-red-50 hover:text-red-600 transition-colors h-8 w-8"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Building className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900 truncate">{factura.proveedor_nombre}</span>
          </div>

          {safeDate(factura.fecha_factura) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                Factura: {format(safeDate(factura.fecha_factura), "dd/MM/yyyy")}
              </span>
            </div>
          )}

          {fechaVenc && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className={`w-4 h-4 ${estaVencida ? 'text-red-400' : proximaVencer ? 'text-orange-400' : 'text-slate-400'}`} />
              <span className={`${estaVencida ? 'text-red-600 font-semibold' : proximaVencer ? 'text-orange-600 font-semibold' : 'text-slate-600'}`}>
                Vence: {format(fechaVenc, "dd/MM/yyyy")}
                {estaVencida && ` (${Math.abs(diasVencimiento)} días vencida)`}
                {proximaVencer && ` (${diasVencimiento} días)`}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <div className="text-sm text-slate-500 font-medium">Total</div>
              <div className="text-xl font-bold text-slate-900 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {factura.total?.toFixed(2) || '0.00'}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-slate-500 font-medium">Pendiente</div>
              <div className={`text-xl font-bold flex items-center gap-1 ${
                factura.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                <DollarSign className="w-4 h-4" />
                {factura.saldo_pendiente?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          {factura.saldo_pendiente > 0 && factura.saldo_pendiente < factura.total && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-700">
                <strong>Pagado:</strong> ${(factura.total - factura.saldo_pendiente).toFixed(2)} 
                <span className="text-blue-600 ml-2">
                  ({(((factura.total - factura.saldo_pendiente) / factura.total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {factura.observaciones && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm text-slate-600 line-clamp-2">
                {factura.observaciones}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaFactura);