import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Warehouse, Package } from 'lucide-react';

export default function AvailableForDispatch({ inventory, products }) {
  const operarioInventory = useMemo(() => {
    return inventory.filter(item => item.product_reference);
  }, [inventory]);

  const availableStock = useMemo(() => {
    return operarioInventory
      .filter(item => item.current_stock > 0)
      .map(item => {
        const product = products.find(p => p.reference === item.product_reference);
        return {
          productName: product ? product.name : item.nombre || item.product_name || item.product_reference,
          quantity: item.current_stock
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [operarioInventory, products]);

  const totalStockValue = useMemo(() => {
    return operarioInventory.reduce((sum, item) => sum + (item.current_stock || 0), 0);
  }, [operarioInventory]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-green-600" />
          Stock Disponible para Despacho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold text-green-700">{totalStockValue.toLocaleString()}</p>
        <p className="text-sm text-slate-500 mb-4">
          Total de unidades en inventario listas para ser asignadas a los empleados.
        </p>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Productos en Stock:</h4>
          {availableStock.length > 0 ? (
            availableStock.map((item, index) => (
              <div key={index} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  {item.productName}
                </span>
                <span className="font-bold text-green-800">{item.quantity.toLocaleString()}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No hay stock disponible.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
