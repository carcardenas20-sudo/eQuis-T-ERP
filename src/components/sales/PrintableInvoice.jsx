import React from 'react';

// Este componente está diseñado para ser renderizado a un string HTML
// y luego inyectado en una nueva ventana para impresión.
export default function PrintableInvoice({ sale, enrichedItems, companyInfo }) {
  const paymentMethodLabels = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    qr: "QR",
    credit: "Crédito",
    courtesy: "Cortesía"
  };

  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <title>Factura #{sale.invoice_number}</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #fff;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 30px;
            border: 1px solid #eee;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
            font-size: 16px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #1f2937;
          }
          .company-details p {
            margin: 2px 0;
            font-size: 14px;
          }
          .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .invoice-details .client-info p, .invoice-details .sale-info p {
            margin: 2px 0;
          }
          .invoice-details strong {
            color: #1f2937;
          }
          table {
            width: 100%;
            line-height: inherit;
            text-align: left;
            border-collapse: collapse;
          }
          table td, table th {
            padding: 8px;
            vertical-align: top;
            border-bottom: 1px solid #eee;
          }
          table th {
            background: #f8f8f8;
            font-weight: bold;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-section {
            margin-top: 20px;
            float: right;
            width: 40%;
          }
          .totals-section table td {
            border: 0;
            padding: 5px 8px;
          }
          .totals-section .total {
            font-weight: bold;
            font-size: 1.1em;
            border-top: 2px solid #333;
          }
          .footer {
            margin-top: 80px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
          @media print {
            .invoice-box {
              box-shadow: none;
              border: 0;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="invoice-box">
          <header className="header">
            <h1>{companyInfo.name || "JacketMaster POS"}</h1>
            <div className="company-details">
              <p>{companyInfo.address || "Dirección no configurada"}</p>
              <p>NIT: {companyInfo.document || "NIT no configurado"}</p>
              <p>Tel: {companyInfo.phone || "Teléfono no configurado"}</p>
            </div>
          </header>

          <section className="invoice-details">
            <div className="client-info">
              <strong>Facturar a:</strong>
              <p>{sale.customer_name || 'Cliente General'}</p>
              <p>{sale.customer_document || ''}</p>
              <p>{sale.customer_phone || ''}</p>
            </div>
            <div className="sale-info text-right">
              <p><strong>Factura #:</strong> {sale.invoice_number || sale.id.slice(-8)}</p>
              <p><strong>Fecha:</strong> {new Date(sale.created_date).toLocaleString('es-CO')}</p>
              <p><strong>Estado:</strong> {sale.status}</p>
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-center">Cant.</th>
                <th className="text-right">Precio Unit.</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {enrichedItems.map((item, index) => (
                <tr key={index}>
                  <td>
                    {item.product?.name || 'Producto desconocido'}
                    <br />
                    <small>SKU: {item.product_id}</small>
                  </td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">${(item.unit_price || 0).toLocaleString()}</td>
                  <td className="text-right">${(item.line_total || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="totals-section">
            <table>
              <tbody>
                <tr>
                  <td>Subtotal:</td>
                  <td className="text-right">${(sale.subtotal || 0).toLocaleString()}</td>
                </tr>
                {sale.discount_amount > 0 && (
                  <tr>
                    <td>Descuento:</td>
                    <td className="text-right">-${(sale.discount_amount || 0).toLocaleString()}</td>
                  </tr>
                )}
                <tr>
                  <td>Impuestos:</td>
                  <td className="text-right">${(sale.tax_amount || 0).toLocaleString()}</td>
                </tr>
                <tr className="total">
                  <td>Total:</td>
                  <td className="text-right">${(sale.total_amount || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <div style={{ clear: 'both' }}></div>

          <footer className="footer">
            <p>{companyInfo.receiptFooter || "¡Gracias por su compra!"}</p>
          </footer>
        </div>
      </body>
    </html>
  );
}