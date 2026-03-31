import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function StockHistoryTable({ movements, products, onEdit, onDelete }) {
  const getProductName = (reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : reference;
  };

  const getMovementIcon = (type) => {
    switch (type) {
      case 'entrada': return <ArrowUp className="w-4 h-4 text-green-600" />;
      case 'salida': return <ArrowDown className="w-4 h-4 text-red-600" />;
      case 'ajuste': return <RefreshCw className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };

  const getMovementColor = (type) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800';
      case 'salida': return 'bg-red-100 text-red-800';
      case 'ajuste': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (movements.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No hay movimientos de stock registrados.</p>
        <p className="text-sm">Los movimientos aparecerán aquí una vez que agregues stock.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vista para móviles */}
      <div className="md:hidden space-y-4">
        {movements.map(movement => (
          <div key={movement.id} className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {getProductName(movement.product_reference)}
                </h3>
                <p className="text-sm text-slate-600">
                  Ref: {movement.product_reference}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(movement)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(movement)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Badge className={getMovementColor(movement.movement_type)}>
                  <span className="flex items-center gap-1">
                    {getMovementIcon(movement.movement_type)}
                    {movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1)}
                  </span>
                </Badge>
                <span className="font-bold text-lg">
                  {movement.movement_type === 'salida' ? '-' : '+'}{movement.quantity}
                </span>
              </div>
              
              <p className="text-sm text-slate-600">
                <strong>Fecha:</strong> {format(new Date(movement.movement_date), 'dd/MM/yyyy')}
              </p>
              
              {movement.reason && (
                <p className="text-sm text-slate-600">
                  <strong>Motivo:</strong> {movement.reason}
                </p>
              )}
              
              <div className="flex justify-between text-sm text-slate-500">
                <span>Stock anterior: {movement.previous_stock}</span>
                <span>Stock nuevo: {movement.new_stock}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vista para escritorio */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Fecha</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Producto</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Tipo</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Cantidad</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Stock Anterior</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Stock Nuevo</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Motivo</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {movements.map(movement => (
              <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-sm">
                  {format(new Date(movement.movement_date), 'dd/MM/yyyy')}
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {getProductName(movement.product_reference)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ref: {movement.product_reference}
                    </p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge className={getMovementColor(movement.movement_type)}>
                    <span className="flex items-center gap-1">
                      {getMovementIcon(movement.movement_type)}
                      {movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1)}
                    </span>
                  </Badge>
                </td>
                <td className="py-3 px-4 text-center font-bold">
                  <span className={movement.movement_type === 'salida' ? 'text-red-600' : 'text-green-600'}>
                    {movement.movement_type === 'salida' ? '-' : '+'}{movement.quantity}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-slate-600">
                  {movement.previous_stock}
                </td>
                <td className="py-3 px-4 text-center font-medium">
                  {movement.new_stock}
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">
                  {movement.reason || '-'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(movement)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(movement)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}