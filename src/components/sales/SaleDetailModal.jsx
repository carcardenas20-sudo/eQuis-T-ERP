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
  const [printFormat, setPrintFormat] = useState('80mm');
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

    // Generate HTML content
    const printableContent = generatePrintableHTML(sale, enrichedItemsForPrint, companyInfo, paymentMethodLabels, printFormat);

    // Print via hidden iframe (better support on mobile)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const isThermal = printFormat === '58mm' || printFormat === '80mm';
    const widthMM = printFormat === '58mm' ? 58 : (printFormat === '80mm' ? 80 : (printFormat === 'half-letter' ? 140 : 216));
    const margin = isThermal ? '0' : '10mm';
    const pageStyle = isThermal
      ? `@media print { .print-container { width: ${widthMM}mm; margin: 0 auto; } table { page-break-inside: auto; } tr, td, th { page-break-inside: avoid; } }`
      : `@page { size: ${printFormat === 'half-letter' ? '140mm 216mm' : '216mm 279mm'}; margin: ${margin}; } @media print { .print-container { width: 100%; max-width: ${widthMM}mm; margin: 0 auto; } }`;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Recibo de Venta #${sale.invoice_number || sale.id.slice(-8)}</title>
<style>
  ${pageStyle}
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #f8f8f8; font-weight: bold; }
  /* Responsive on-screen preview */
  @media screen and (max-width: 480px) {
    .print-container { width: 100% !important; max-width: 100% !important; padding: 12px; }
    th, td { padding: 6px; font-size: 12px; }
    h1 { font-size: 18px; }
  }
</style>
</head>
<body>
  <div class="print-container">${printableContent}</div>
</body>
</html>`;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      const handleAfterPrint = () => {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 300);
        iframe.contentWindow?.removeEventListener?.('afterprint', handleAfterPrint);
      };
      iframe.contentWindow?.addEventListener?.('afterprint', handleAfterPrint);
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 300);
    } else {
      alert("No se pudo inicializar la impresión. Revisa el bloqueo de ventanas emergentes.");
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
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

  // Function to generate HTML content without React rendering
  const generatePrintableHTML = (sale, enrichedItems, companyInfo, paymentMethodLabels, printFormat = '80mm') => {
    const itemsHTML = enrichedItems.map(item => `
      <tr>
        <td>
          ${item.product?.name || 'Producto desconocido'}
          <br><small>SKU: ${item.product_id}</small>
        </td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">$${(item.unit_price || 0).toLocaleString()}</td>
        <td style="text-align: right;">$${(item.line_total || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    const paymentsHTML = sale.payment_methods?.map(p => `
      <tr>
        <td style="padding: 5px 8px; border: 0;">${paymentMethodLabels[p.method] || p.method}:</td>
        <td style="padding: 5px 8px; border: 0; text-align: right;">$${p.amount.toLocaleString()}</td>
      </tr>
    `).join('') || `
      <tr>
        <td colspan="2" style="padding: 5px 8px; border: 0; text-align: center; color: #777;">No se registraron pagos</td>
      </tr>
    `;

    const isThermal = printFormat === '58mm' || printFormat === '80mm';
    const containerMax = isThermal ? '100%' : '800px';
    const padding = isThermal ? '6mm' : '30px';
    const border = isThermal ? '0' : '1px solid #eee';
    const fontSize = isThermal ? '12px' : '16px';
    const headerSize = isThermal ? '16px' : '24px';

    return `
      <div style="max-width: ${containerMax}; margin: auto; padding: ${padding}; border: ${border}; font-size: ${fontSize}; font-family: Arial, sans-serif;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: ${headerSize}; color: #1f2937;">${companyInfo.name}</h1>
          ${companyInfo.receiptHeader ? `<p style="margin: 4px 0; font-size: 14px; font-style: italic; color: #666;">${companyInfo.receiptHeader}</p>` : ''}
          <div>
            <p style="margin: 2px 0; font-size: 14px;">${companyInfo.address}</p>
            <p style="margin: 2px 0; font-size: 14px;">NIT: ${companyInfo.document}</p>
            <p style="margin: 2px 0; font-size: 14px;">Tel: ${companyInfo.phone}</p>
            ${companyInfo.email ? `<p style="margin: 2px 0; font-size: 14px;">Email: ${companyInfo.email}</p>` : ''}
          </div>
        </div>

        <!-- Invoice Details -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px;">
          <div>
            <strong>Facturar a:</strong>
            <p style="margin: 2px 0;">${sale.customer_name || 'Cliente General'}</p>
            <p style="margin: 2px 0;">${sale.customer_document || ''}</p>
            <p style="margin: 2px 0;">${sale.customer_phone || ''}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 2px 0;"><strong>Factura #:</strong> ${sale.invoice_number || sale.id.slice(-8)}</p>
            <p style="margin: 2px 0;"><strong>Fecha:</strong> ${new Date(sale.created_date).toLocaleString('es-CO')}</p>
            <p style="margin: 2px 0;"><strong>Estado:</strong> ${statusLabels[sale.status] || sale.status}</p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f8f8f8;">
              <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Producto</th>
              <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-align: center;">Cant.</th>
              <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">Precio Unit.</th>
              <th style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <!-- Totals & Payments Section -->
        <div style="margin-top: 20px; display: flex; justify-content: space-between; flex-wrap: wrap;">
          <!-- Payment Methods -->
          <div style="width: 55%;">
            <h4 style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">Métodos de Pago</h4>
            <table style="width: 100%;">
              <tbody>
                ${paymentsHTML}
              </tbody>
            </table>
          </div>

          <!-- Totals Section -->
          <div style="width: 40%;">
            <table style="width: 100%;">
              <tbody>
                <tr>
                  <td style="padding: 5px 8px; border: 0;">Subtotal:</td>
                  <td style="padding: 5px 8px; border: 0; text-align: right;">$${(sale.subtotal || 0).toLocaleString()}</td>
                </tr>
                ${sale.discount_amount > 0 ? `
                  <tr>
                    <td style="padding: 5px 8px; border: 0;">Descuento:</td>
                    <td style="padding: 5px 8px; border: 0; text-align: right;">-$${(sale.discount_amount || 0).toLocaleString()}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 5px 8px; border: 0;">Impuestos:</td>
                  <td style="padding: 5px 8px; border: 0; text-align: right;">$${(sale.tax_amount || 0).toLocaleString()}</td>
                </tr>
                <tr style="font-weight: bold; font-size: 1.1em; border-top: 2px solid #333;">
                  <td style="padding: 5px 8px;">Total:</td>
                  <td style="padding: 5px 8px; text-align: right;">$${(sale.total_amount || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style="clear: both;"></div>

        <!-- Footer -->
        <div style="margin-top: 80px; text-align: center; font-size: 12px; color: #777;">
          <p>${companyInfo.receiptFooter}</p>
        </div>
      </div>
    `;
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