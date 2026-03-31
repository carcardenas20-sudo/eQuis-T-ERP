import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, DollarSign, Building } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const getStatusColor = (estado) => {
  const colors = {
    borrador: 'bg-slate-100 text-slate-700 border-slate-200',
    enviada: 'bg-blue-100 text-blue-700 border-blue-200',
    confirmada: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    recibida: 'bg-green-100 text-green-700 border-green-200',
    facturada: 'bg-purple-100 text-purple-700 border-purple-200',
    cancelada: 'bg-red-100 text-red-700 border-red-200'
  };
  return colors[estado] || colors.borrador;
};

function TarjetaCompra({ compra, onEdit, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar la orden "${compra.numero_orden}"?`)) {
      onDelete(compra.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-blue-300 transition-all duration-200 h-full group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                {compra.numero_orden}
              </CardTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${getStatusColor(compra.estado)} border font-medium`}>
                  {compra.estado}
                </Badge>
                <Badge variant="outline" className="text-xs border-slate-300">
                  {compra.items?.length || 0} items
                </Badge>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(compra)}
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
            <span className="font-medium text-slate-900 truncate">{compra.proveedor_nombre}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">
              Orden: {format(new Date(compra.fecha_orden), "dd/MM/yyyy")}
            </span>
          </div>

          {compra.fecha_entrega_esperada && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="text-slate-600">
                Entrega: {format(new Date(compra.fecha_entrega_esperada), "dd/MM/yyyy")}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <div className="text-sm text-slate-500 font-medium">Total</div>
              <div className="text-xl font-bold text-slate-900 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {compra.total?.toFixed(2) || '0.00'}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-slate-500 font-medium">Items</div>
              <div className="text-xl font-bold text-slate-900">
                {compra.items?.length || 0}
              </div>
            </div>
          </div>

          {compra.items && compra.items.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Materiales principales
              </div>
              <div className="space-y-1">
                {compra.items.slice(0, 3).map((item, index) => (
                  <div key={index} className="text-xs text-slate-600 flex justify-between">
                    <span className="truncate">{item.materia_prima_nombre}</span>
                    <span>{item.cantidad} {item.unidad_medida}</span>
                  </div>
                ))}
                {compra.items.length > 3 && (
                  <div className="text-xs text-slate-400">
                    +{compra.items.length - 3} materiales más...
                  </div>
                )}
              </div>
            </div>
          )}

          {compra.observaciones && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm text-slate-600 line-clamp-2">
                {compra.observaciones}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaCompra);