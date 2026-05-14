import React, { useState, useEffect } from 'react';
import { Product, SystemSettings } from "@/entities/all"; // Added SystemSettings
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FileText, User, Calendar, DollarSign, Package, Printer, X, Download, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import MobilePageHeader from "../layout/MobilePageHeader";
import { sendInvoiceWhatsApp } from "@/utils/whatsappInvoice";

const statusColors = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-orange-100 text-orange-800",
  credit: "bg-sky-100 text-sky-800"
};

const statusLabels = {
  completed: "Completada",
  pending: "Pendiente",
  cancelled: "Cancelada",
  returned: "Devuelta",
  credit: "A Crédito"
};

export default function SaleDetailModal({ sale, onClose }) {
  const [products, setProducts] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null); // Added state for system settings
  const [printFormat, setPrintFormat] = useState('58mm');
  const [isExporting, setIsExporting] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, settingsData] = await Promise.all([
        Product.list(),
        SystemSettings.list() // Load system settings
      ]);
      setProducts(productsData);
      
      // Get the first (and should be only) system settings record
      setSystemSettings(settingsData.length > 0 ? settingsData[0] : null);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handlePrint = () => {
    // Ensure page CSS matches selected size
    // Re-enrich sale items with product details for printing context
    const enrichedItemsForPrint = sale.items?.map(item => {
      const product = products.find(p => p.sku === item.product_id);
      return { ...item, product };
    }) || [];

    const paymentMethodLabels = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      qr: "QR",
      credit: "Crédito",
      courtesy: "Cortesía"
    };

    // Use system settings or fallback to defaults
    const companyInfo = systemSettings ? {
      name: systemSettings.company_name || "JacketMaster POS",
      address: systemSettings.company_address || "Dirección no configurada",
      document: systemSettings.company_document || "NIT no configurado",
      phone: systemSettings.company_phone || "Teléfono no configurado",
      email: systemSettings.company_email || "",
      receiptHeader: systemSettings.receipt_header || "",
      receiptFooter: systemSettings.receipt_footer || "¡Gracias por su compra!"
    } : {
      name: "JacketMaster POS",
      address: "Dirección no configurada",
      document: "NIT no configurado", 
      phone: "Teléfono no configurado",
      email: "",
      receiptHeader: "",
      receiptFooter: "¡Gracias por su compra!"
    };

    const printableContent = generatePrintableHTML(sale, enrichedItemsForPrint, companyInfo, paymentMethodLabels, printFormat);

    const isThermal = printFormat === '58mm' || printFormat === '80mm';
    const widthMM = printFormat === '58mm' ? 58 : (printFormat === '80mm' ? 80 : (printFormat === 'half-letter' ? 140 : 216));

    const pageStyle = isThermal
      ? `@page { size: ${widthMM}mm auto; margin: 0; }`
      : `@page { size: ${printFormat === 'half-letter' ? '140mm 216mm' : '216mm 279mm'}; margin: 10mm; }`;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Recibo #${sale.invoice_number || (sale.id || '').slice(-8)}</title>
<style>
  ${pageStyle}
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; }
  @media print {
    body { margin: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>${printableContent}</body>
</html>`;

    // window.open() sincrónico desde gesto de usuario — funciona en iOS y Android
    const pw = window.open('', '_blank');
    if (!pw) {
      alert('Permite ventanas emergentes para imprimir, o usa el botón de descarga PDF.');
      return;
    }
    pw.document.open();
    pw.document.write(fullHtml);
    pw.document.close();
    // onload asegura que el contenido está renderizado antes de disparar print()
    pw.onload = () => { pw.focus(); pw.print(); };
    // Fallback: algunos browsers no disparan onload en document.write
    pw.focus();
    pw.print();
  };

  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    // Re-enrich sale items with product details for PDF
    const enrichedItemsForPrint = sale.items?.map(item => {
      const product = products.find(p => p.sku === item.product_id);
      return { ...item, product };
    }) || [];

    const paymentMethodLabels = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      qr: "QR",
      credit: "Crédito",
      courtesy: "Cortesía"
    };

    const companyInfo = systemSettings ? {
      name: systemSettings.company_name || "JacketMaster POS",
      address: systemSettings.company_address || "Dirección no configurada",
      document: systemSettings.company_document || "NIT no configurado",
      phone: systemSettings.company_phone || "Teléfono no configurado",
      email: systemSettings.company_email || "",
      receiptHeader: systemSettings.receipt_header || "",
      receiptFooter: systemSettings.receipt_footer || "¡Gracias por su compra!"
    } : {
      name: "JacketMaster POS",
      address: "Dirección no configurada",
      document: "NIT no configurado", 
      phone: "Teléfono no configurado",
      email: "",
      receiptHeader: "",
      receiptFooter: "¡Gracias por su compra!"
    };

    const printableContent = generatePrintableHTML(sale, enrichedItemsForPrint, companyInfo, paymentMethodLabels, printFormat);

    // Create offscreen container sized to selected format
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    const widthMM = printFormat === '58mm' ? 58 : (printFormat === '80mm' ? 80 : (printFormat === 'half-letter' ? 140 : 216));
    container.style.width = `${widthMM}mm`;
    container.style.maxWidth = `${widthMM}mm`;
    container.style.background = '#ffffff';
    container.innerHTML = `<div class="print-container" style="width:${widthMM}mm; max-width:${widthMM}mm;">${printableContent}</div>`;
    document.body.appendChild(container);

    try {
      await new Promise(r => setTimeout(r, 0));
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const pageWidth = widthMM;
      const pageHeight = (canvas.height * pageWidth) / canvas.width;

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pageWidth, pageHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      pdf.save(`Factura_${sale.invoice_number || sale.id.slice(-8)}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('No se pudo generar el PDF. Intenta nuevamente.');
    } finally {
      if (container.parentNode) container.parentNode.removeChild(container);
      setIsExporting(false);
    }
  };

  const generatePrintableHTML = (sale, enrichedItems, companyInfo, paymentMethodLabels, printFormat = '80mm') => {
    const isThermal = printFormat === '58mm' || printFormat === '80mm';
    const fecha = new Date(sale.created_date || Date.now()).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

    if (isThermal) {
      const fs = printFormat === '58mm' ? '7pt' : '9pt';
      const fsH = printFormat === '58mm' ? '9pt' : '11pt';
      const pad = printFormat === '58mm' ? '2mm' : '3mm';
      const sep = `<div style="border-top:1px dashed #000;margin:3pt 0;"></div>`;

      const itemsHTML = enrichedItems.map(item => `
        <div style="margin-bottom:3px;">
          <div style="font-weight:bold;">${item.product?.name || item.product_id}</div>
          <div style="display:flex;justify-content:space-between;">
            <span>${item.quantity} × $${(item.unit_price || 0).toLocaleString()}</span>
            <span style="font-weight:bold;">$${(item.line_total || 0).toLocaleString()}</span>
          </div>
        </div>`).join('');

      const paymentsHTML = (sale.payment_methods || []).map(p => `
        <div style="display:flex;justify-content:space-between;">
          <span>${paymentMethodLabels[p.method] || p.method}</span>
          <span>$${(p.amount || 0).toLocaleString()}</span>
        </div>`).join('');

      return `
        <div style="width:100%;font-family:'Courier New',Courier,monospace;font-size:${fs};padding:${pad};box-sizing:border-box;">
          <div style="text-align:center;margin-bottom:4px;">
            <div style="font-size:${fsH};font-weight:bold;">${companyInfo.name}</div>
            ${companyInfo.receiptHeader ? `<div style="font-style:italic;">${companyInfo.receiptHeader}</div>` : ''}
            <div>${companyInfo.address}</div>
            <div>NIT: ${companyInfo.document}</div>
            <div>Tel: ${companyInfo.phone}</div>
          </div>
          ${sep}
          <div style="margin-bottom:3px;">
            <div><b>Fact. #${sale.invoice_number || (sale.id || '').slice(-8)}</b></div>
            <div>${fecha}</div>
            <div>Cliente: ${sale.customer_name || 'General'}</div>
            ${sale.customer_document ? `<div>Doc: ${sale.customer_document}</div>` : ''}
          </div>
          ${sep}
          ${itemsHTML}
          ${sep}
          ${sale.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Descuento</span><span>-$${(sale.discount_amount || 0).toLocaleString()}</span></div>` : ''}
          ${sale.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Impuestos</span><span>$${(sale.tax_amount || 0).toLocaleString()}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:${fsH};font-weight:bold;margin-top:2px;">
            <span>TOTAL</span>
            <span>$${(sale.total_amount || 0).toLocaleString()}</span>
          </div>
          ${sep}
          ${paymentsHTML}
          ${sep}
          <div style="text-align:center;margin-top:6px;">${companyInfo.receiptFooter || '¡Gracias por su compra!'}</div>
        </div>`;
    }

    // ─── Formato A4 / media carta ─────────────────────────────────────────────
    const itemsHTML = enrichedItems.map(item => `
      <tr>
        <td>${item.product?.name || item.product_id}<br><small style="color:#888;">SKU: ${item.product_id}</small></td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">$${(item.unit_price || 0).toLocaleString()}</td>
        <td style="text-align:right;">$${(item.line_total || 0).toLocaleString()}</td>
      </tr>`).join('');

    const paymentsHTML = (sale.payment_methods || []).map(p => `
      <tr>
        <td style="padding:5px 8px;border:0;">${paymentMethodLabels[p.method] || p.method}:</td>
        <td style="padding:5px 8px;border:0;text-align:right;">$${(p.amount || 0).toLocaleString()}</td>
      </tr>`).join('') || `<tr><td colspan="2" style="padding:5px 8px;border:0;text-align:center;color:#777;">Sin pagos</td></tr>`;

    return `
      <div style="max-width:800px;margin:auto;padding:30px;font-size:16px;font-family:Arial,sans-serif;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="margin:0;font-size:24px;">${companyInfo.name}</h1>
          ${companyInfo.receiptHeader ? `<p style="margin:4px 0;font-style:italic;color:#666;">${companyInfo.receiptHeader}</p>` : ''}
          <p style="margin:2px 0;">${companyInfo.address}</p>
          <p style="margin:2px 0;">NIT: ${companyInfo.document} · Tel: ${companyInfo.phone}</p>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:14px;">
          <div>
            <strong>Cliente:</strong>
            <p style="margin:2px 0;">${sale.customer_name || 'General'}</p>
            ${sale.customer_document ? `<p style="margin:2px 0;">${sale.customer_document}</p>` : ''}
          </div>
          <div style="text-align:right;">
            <p style="margin:2px 0;"><strong>Factura #:</strong> ${sale.invoice_number || (sale.id || '').slice(-8)}</p>
            <p style="margin:2px 0;"><strong>Fecha:</strong> ${fecha}</p>
            <p style="margin:2px 0;"><strong>Estado:</strong> ${statusLabels[sale.status] || sale.status}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#f8f8f8;">
              <th style="padding:8px;border-bottom:1px solid #eee;">Producto</th>
              <th style="padding:8px;border-bottom:1px solid #eee;text-align:center;">Cant.</th>
              <th style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Precio Unit.</th>
              <th style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:20px;">
          <div style="min-width:45%;">
            <h4 style="margin-bottom:8px;">Métodos de Pago</h4>
            <table style="width:100%;"><tbody>${paymentsHTML}</tbody></table>
          </div>
          <div style="min-width:40%;">
            <table style="width:100%;"><tbody>
              <tr><td style="padding:5px 8px;border:0;">Subtotal:</td><td style="padding:5px 8px;border:0;text-align:right;">$${(sale.subtotal || 0).toLocaleString()}</td></tr>
              ${sale.discount_amount > 0 ? `<tr><td style="padding:5px 8px;border:0;">Descuento:</td><td style="padding:5px 8px;border:0;text-align:right;">-$${(sale.discount_amount || 0).toLocaleString()}</td></tr>` : ''}
              ${sale.tax_amount > 0 ? `<tr><td style="padding:5px 8px;border:0;">Impuestos:</td><td style="padding:5px 8px;border:0;text-align:right;">$${(sale.tax_amount || 0).toLocaleString()}</td></tr>` : ''}
              <tr style="font-weight:bold;border-top:2px solid #333;"><td style="padding:5px 8px;">Total:</td><td style="padding:5px 8px;text-align:right;">$${(sale.total_amount || 0).toLocaleString()}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div style="margin-top:30px;text-align:center;font-size:12px;color:#777;">
          <p>${companyInfo.receiptFooter || '¡Gracias por su compra!'}</p>
        </div>
      </div>`;
  };

  // Enrich sale items with product details for display in the modal
  const enrichedItems = sale.items?.map(item => {
    const product = products.find(p => p.sku === item.product_id);
    return { ...item, product };
  }) || [];

  const paymentMethodLabels = {
    cash: "Efectivo",
    card: "Tarjeta", 
    transfer: "Transferencia",
    qr: "QR",
    credit: "Crédito",
    courtesy: "Cortesía"
  };

  // Company info for WhatsApp/PDF when needed outside specific handlers
  const derivedCompanyInfo = systemSettings ? {
    name: systemSettings.company_name || "JacketMaster POS",
    address: systemSettings.company_address || "Dirección no configurada",
    document: systemSettings.company_document || "NIT no configurado",
    phone: systemSettings.company_phone || "Teléfono no configurado",
    email: systemSettings.company_email || "",
    receiptHeader: systemSettings.receipt_header || "",
    receiptFooter: systemSettings.receipt_footer || "¡Gracias por su compra!"
  } : {
    name: "JacketMaster POS",
    address: "Dirección no configurada",
    document: "NIT no configurado",
    phone: "Teléfono no configurado",
    email: "",
    receiptHeader: "",
    receiptFooter: "¡Gracias por su compra!"
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
        <MobilePageHeader 
          title={`Venta #${sale.invoice_number || sale.id.slice(-8)}`}
          showBack={true}
          onBack={onClose}
        />
        <DialogHeader className="hidden lg:flex">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-6 h-6 text-blue-600 select-none" />
            Detalle de Venta #{sale.invoice_number || sale.id.slice(-8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sale Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Fecha de Venta</span>
              </div>
              <p className="font-semibold">
                {format(new Date(sale.created_date), "EEEE, dd MMMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>Cliente</span>
              </div>
              <div>
                <p className="font-semibold">{sale.customer_name || 'Cliente General'}</p>
                {sale.customer_phone && (
                  <p className="text-sm text-slate-500">{sale.customer_phone}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <DollarSign className="w-4 h-4" />
                <span>Estado</span>
              </div>
              <Badge className={statusColors[sale.status] || "bg-gray-100 text-gray-800"}>
                {statusLabels[sale.status] || sale.status}
              </Badge>
            </div>
          </div>

          {/* Sale Items */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Productos Vendidos
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                            {item.product?.image_url ? (
                              <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {item.product?.name || 'Producto desconocido'}
                            </p>
                            <p className="text-xs text-slate-500">SKU: ${item.product_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${(item.unit_price || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.discount_percentage ? (
                          <span className="text-orange-600">
                            -{item.discount_percentage}%
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${(item.line_total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Métodos de Pago</h3>
              <div className="space-y-3">
                {sale.payment_methods?.map((payment, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <div>
                      <span className="font-medium">
                        {paymentMethodLabels[payment.method] || payment.method}
                      </span>
                      {payment.method === 'transfer' && payment.bank_account && (
                        <p className="text-xs text-slate-500">
                          a {payment.bank_account}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold">${payment.amount.toLocaleString()}</span>
                  </div>
                )) || (
                  <p className="text-slate-500">No se registraron métodos de pago</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen de Totales</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${(sale.subtotal || 0).toLocaleString()}</span>
                </div>
                {sale.discount_amount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Descuento:</span>
                    <span>-${sale.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Impuestos:</span>
                  <span>${(sale.tax_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total:</span>
                  <span className="text-green-600">${(sale.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Notas</h3>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-slate-700">{sale.notes}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="w-full sm:w-56">
            <Select value={printFormat} onValueChange={setPrintFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Formato de impresión" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58 mm (térmica)</SelectItem>
                <SelectItem value="80mm">80 mm (térmica)</SelectItem>
                <SelectItem value="half-letter">Media carta</SelectItem>
                <SelectItem value="letter">Carta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handlePrint} className="gap-2 select-none">
            <Printer className="w-4 h-4 select-none" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isExporting} className="gap-2 select-none">
            <Download className={`w-4 h-4 select-none ${isExporting ? 'animate-pulse' : ''}`} />
            {isExporting ? 'Generando…' : 'Descargar PDF'}
          </Button>
          <Button variant="outline" onClick={() => sendInvoiceWhatsApp({ sale, items: enrichedItems, companyInfo: derivedCompanyInfo, printFormat, defaultPhone: sale.customer_phone })} className="gap-2 select-none" disabled={isExporting}>
           <Send className="w-4 h-4" /> Enviar WhatsApp
          </Button>
          <Button onClick={onClose} className="select-none">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}