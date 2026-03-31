import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export default function ExchangeReceipt({ data, onClose }) {
  const {
    exchangeRef,
    returnItems = [],
    takeItems = [],
    returnTotal = 0,
    takeTotal = 0,
    difference = 0,
    paymentMethods = [],
    customerName,
    notes,
    companyName = "JacketMaster",
    date = new Date().toLocaleString("es-CO"),
  } = data;

  const PAYMENT_NAMES = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", qr: "QR", credit: "Crédito" };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=400,height=700");
    const content = document.getElementById("exchange-receipt-content").innerHTML;
    printWindow.document.write(`
      <html><head><title>Comprobante de Cambio</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 10px; max-width: 300px; margin: auto; }
        h2 { text-align: center; font-size: 14px; margin: 0; }
        p { margin: 2px 0; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .big { font-size: 14px; }
      </style></head><body>
      ${content}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">Comprobante de Cambio</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div id="exchange-receipt-content" className="font-mono text-xs space-y-1 bg-white p-3 border rounded-lg">
          <h2 className="text-center font-bold text-sm">{companyName}</h2>
          <p className="text-center">COMPROBANTE DE CAMBIO</p>
          <p className="text-center">━━━━━━━━━━━━━━━━━━━━</p>
          <p>Ref: {exchangeRef}</p>
          <p>Fecha: {date}</p>
          {customerName && <p>Cliente: {customerName}</p>}
          {notes && <p>Motivo: {notes}</p>}

          <p className="border-t border-dashed pt-1 mt-1 font-bold">PRODUCTOS DEVUELTOS:</p>
          {returnItems.length === 0
            ? <p className="text-slate-400">Ninguno</p>
            : returnItems.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="flex-1 truncate">{item.product_name || item.product?.name}</span>
                <span className="ml-2">{item.quantity}x ${item.unit_price?.toLocaleString()}</span>
              </div>
            ))
          }
          <div className="flex justify-between font-bold">
            <span>Subtotal devolución:</span>
            <span>-${returnTotal.toLocaleString()}</span>
          </div>

          <p className="border-t border-dashed pt-1 mt-1 font-bold">PRODUCTOS ENTREGADOS:</p>
          {takeItems.length === 0
            ? <p className="text-slate-400">Ninguno</p>
            : takeItems.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="flex-1 truncate">{item.product_name || item.product?.name}</span>
                <span className="ml-2">{item.quantity}x ${item.unit_price?.toLocaleString()}</span>
              </div>
            ))
          }
          <div className="flex justify-between font-bold">
            <span>Subtotal entrega:</span>
            <span>+${takeTotal.toLocaleString()}</span>
          </div>

          <p className="border-t border-dashed pt-1 mt-1"></p>
          <div className="flex justify-between font-bold text-sm">
            <span>{difference > 0 ? "Cliente pagó excedente:" : "Cambio sin costo:"}</span>
            <span>{difference > 0 ? `$${difference.toLocaleString()}` : "$0"}</span>
          </div>

          {paymentMethods.length > 0 && (
            <>
              <p className="border-t border-dashed pt-1 mt-1 font-bold">MEDIOS DE PAGO:</p>
              {paymentMethods.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{PAYMENT_NAMES[p.method] || p.method}</span>
                  <span>${p.amount?.toLocaleString()}</span>
                </div>
              ))}
            </>
          )}

          <p className="text-center border-t border-dashed pt-1 mt-2">¡Gracias por su compra!</p>
        </div>

        <Button onClick={handlePrint} className="w-full gap-2 mt-2">
          <Printer className="w-4 h-4" />
          Imprimir Comprobante
        </Button>
      </DialogContent>
    </Dialog>
  );
}