import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, DollarSign, Building } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const getMethodColor = (metodo) => {
  const colors = {
    efectivo: 'bg-green-100 text-green-700 border-green-200',
    transferencia: 'bg-blue-100 text-blue-700 border-blue-200',
    cheque: 'bg-purple-100 text-purple-700 border-purple-200',
    tarjeta: 'bg-orange-100 text-orange-700 border-orange-200'
  };
  return colors[metodo] || colors.transferencia;
};

function TarjetaPago({ pago, onEdit, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar el pago "${pago.numero_comprobante}"?`)) {
      onDelete(pago.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-purple-300 transition-all duration-200 h-full group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                {pago.numero_comprobante}
              </CardTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${getMethodColor(pago.metodo_pago)} border font-medium`}>
                  {pago.metodo_pago}
                </Badge>
                {pago.referencia && (
                  <Badge variant="outline" className="text-xs border-slate-300">
                    {pago.referencia}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(pago)}
                className="hover:bg-purple-50 hover:text-purple-600 transition-colors h-8 w-8"
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
            <span className="font-medium text-slate-900 truncate">{pago.proveedor_nombre}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">
              Fecha: {format(new Date(pago.fecha_pago), "dd/MM/yyyy")}
            </span>
          </div>

          <div className="flex items-center justify-center pt-3 border-t border-slate-100">
            <div className="text-center">
              <div className="text-sm text-slate-500 font-medium">Monto Pagado</div>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-1 justify-center">
                <DollarSign className="w-5 h-5" />
                {pago.monto?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          {pago.observaciones && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm text-slate-600 line-clamp-2">
                {pago.observaciones}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaPago);