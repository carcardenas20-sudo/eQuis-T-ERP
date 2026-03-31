import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseItem } from "@/entities/all";
import { X, Package } from "lucide-react";
import { formatColombiaDate } from "../utils/dateUtils";

const PAYMENT_LABELS = { cash: "Efectivo", transfer: "Transferencia", check: "Cheque", credit: "Crédito" };

export default function PurchaseDetailModal({ purchase, suppliers, locations, onClose }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    PurchaseItem.filter({ purchase_id: purchase.id })
      .then(setItems)
      .finally(() => setIsLoading(false));
  }, [purchase.id]);

  const supplier = suppliers.find(s => s.id === purchase.supplier_id);
  const location = locations.find(l => l.id === purchase.location_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Detalle de Compra — {purchase.purchase_number || `#${purchase.id.slice(-8)}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Info general */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><p className="text-slate-500">Proveedor</p><p className="font-medium">{supplier?.nombre || "—"}</p></div>
            <div><p className="text-slate-500">Sucursal</p><p className="font-medium">{location?.name || "—"}</p></div>
            <div><p className="text-slate-500">Fecha</p><p className="font-medium">{formatColombiaDate(purchase.purchase_date, 'dd/MM/yyyy')}</p></div>
            <div><p className="text-slate-500">Método de pago</p><p className="font-medium">{PAYMENT_LABELS[purchase.payment_method] || purchase.payment_method || "—"}</p></div>
            {purchase.supplier_invoice && <div><p className="text-slate-500">Factura proveedor</p><p className="font-medium">{purchase.supplier_invoice}</p></div>}
            <div>
              <p className="text-slate-500">Estado</p>
              <Badge className="bg-green-100 text-green-800 mt-0.5">Recibida</Badge>
            </div>
          </div>

          {/* Productos */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Productos comprados</p>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="font-medium">{item.product_name || item.product_id}</p>
                        <p className="text-xs text-slate-400">SKU: {item.product_id}</p>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity_ordered}</TableCell>
                      <TableCell className="text-right">${(item.unit_cost || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">${(item.line_total || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Totales */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 text-sm">
              {purchase.subtotal > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Subtotal:</span><span>${(purchase.subtotal || 0).toLocaleString()}</span></div>
              )}
              {purchase.tax_amount > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">IVA ({purchase.tax_rate || 0}%):</span><span>${(purchase.tax_amount || 0).toLocaleString()}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Total:</span>
                <span className="text-purple-700">${(purchase.total_amount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {purchase.notes && (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
              <span className="font-medium">Notas: </span>{purchase.notes}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}