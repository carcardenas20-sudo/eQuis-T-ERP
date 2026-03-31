import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Printer, X } from "lucide-react";

export default function QuoteModal({ cart, totals, customer, locationName, companyInfo, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const quoteNumber = `COT-${Date.now().toString().slice(-6)}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Presupuesto / Cotización
          </DialogTitle>
        </DialogHeader>

        <div className="bg-white border rounded-lg p-5 space-y-4 print:shadow-none" id="quote-content">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-xl font-bold text-slate-900">{companyInfo?.company_name || locationName || 'Punto de Venta'}</h2>
            {companyInfo?.company_document && <p className="text-xs text-slate-500">NIT: {companyInfo.company_document}</p>}
            {companyInfo?.company_address && <p className="text-xs text-slate-500">{companyInfo.company_address}</p>}
            {companyInfo?.company_phone && <p className="text-xs text-slate-500">Tel: {companyInfo.company_phone}</p>}
            {locationName && <p className="text-xs text-slate-400">Sucursal: {locationName}</p>}
            <p className="text-sm text-slate-500 mt-1">PRESUPUESTO / COTIZACIÓN</p>
            <p className="text-xs text-slate-400">N° {quoteNumber}</p>
            <p className="text-xs text-slate-400">{today}</p>
          </div>

          {/* Cliente */}
          <div className="bg-slate-50 rounded p-3 text-sm">
            <p className="font-semibold text-slate-700">Cliente:</p>
            <p className="text-slate-600">{customer?.name || 'Cliente General'}</p>
            {customer?.phone && <p className="text-slate-500">{customer.phone}</p>}
          </div>

          {/* Productos */}
          <div>
            <p className="font-semibold text-slate-700 mb-2 text-sm">Detalle de productos:</p>
            <div className="space-y-2">
              {cart.map((item, idx) => {
                const unitPrice = item.sale_price || item.product.sale_price || 0;
                const subtotal = unitPrice * item.quantity;
                const disc = (subtotal * (item.discount || 0)) / 100;
                const lineTotal = subtotal - disc;
                return (
                  <div key={idx} className="flex justify-between items-start py-2 border-b last:border-0 text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item.product.name}</p>
                      <p className="text-slate-500 text-xs">
                        {item.quantity} uds × ${unitPrice.toLocaleString()}
                        {item.discount > 0 && <span className="text-red-500"> (-{item.discount}%)</span>}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 ml-2">${lineTotal.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal:</span>
              <span>${totals.subtotal?.toLocaleString()}</span>
            </div>
            {totals.globalDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Descuento:</span>
                <span>-${totals.globalDiscountAmount?.toLocaleString()}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>IVA:</span>
                <span>${totals.taxAmount?.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 border-t pt-2 mt-2">
              <span>TOTAL:</span>
              <span className="text-blue-600">${totals.total?.toLocaleString()}</span>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 border-t pt-3">
            <p>Este presupuesto no constituye una factura de venta.</p>
            <p>Válido por 5 días hábiles.</p>
            {companyInfo?.receipt_footer && <p className="mt-1 italic">{companyInfo.receipt_footer}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="w-4 h-4" /> Cerrar
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4" /> Imprimir Presupuesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}