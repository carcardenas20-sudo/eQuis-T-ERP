import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, DollarSign, TrendingUp, TrendingDown, Calculator, Package, TruckIcon, Calendar as CalendarIcon, FileDown, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export default function EmployeeProfile() {
  const [employee, setEmployee] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [calculationSteps, setCalculationSteps] = useState([]);
  const [allCalculationSteps, setAllCalculationSteps] = useState([]);
  const [dateFilter, setDateFilter] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const employeeId = params.get('id');
      
      if (!employeeId) {
        setLoading(false);
        return;
      }

      const [employeeData, employeesData, deliveriesData, dispatchesData, paymentsData, productsData, purchasesData] = await Promise.all([
        base44.entities.Employee.filter({ employee_id: employeeId }),
        base44.entities.Employee.list(),
        base44.entities.Delivery.list(),
        base44.entities.Dispatch.list(),
        base44.entities.Payment.list(),
        base44.entities.Producto.list(),
        base44.entities.EmployeePurchase.filter({ employee_id: employeeId })
      ]);

      const emp = employeeData.length > 0 ? employeeData[0] : null;
      const normProductos = (productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra }));
      setEmployee(emp);
      setProducts(normProductos);
      
      if (emp) {
        const empDeliveries = deliveriesData.filter(d => d.employee_id === emp.employee_id);
        const empDispatches = dispatchesData.filter(d => d.employee_id === emp.employee_id);
        const empPayments = paymentsData.filter(p => p.employee_id === emp.employee_id);
        setDeliveries(empDeliveries);
        setDispatches(empDispatches);
        setPayments(empPayments);
        setPurchases(purchasesData || []);
        const steps = calculateBalance(empDeliveries, empDispatches, empPayments, normProductos, purchasesData || []);
        setAllCalculationSteps(steps);
        setCalculationSteps(steps);
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  const getProductName = (reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : reference;
  };

  const calculateBalance = (deliveriesData, dispatchesData, paymentsData, productsData, purchasesData = []) => {
    const steps = [];
    const events = [];

    dispatchesData.forEach(dispatch => {
      events.push({ date: dispatch.dispatch_date, type: 'dispatch', data: dispatch, wasDiscountedByPurchase: dispatch.status === 'entregado' && dispatch.quantity === 0 });
    });

    deliveriesData.forEach(delivery => {
      // Marcar las entregas generadas automáticamente por compra
      events.push({ date: delivery.delivery_date, type: 'delivery', data: delivery });
    });

    paymentsData.forEach(payment => {
      events.push({ date: payment.payment_date, type: 'payment', data: payment });
    });

    // Crear eventos de compras — el descuento va DESPUÉS de la entrega automática (mismo día)
    purchasesData.forEach(purchase => {
      if (purchase.payment_method === 'descuento_saldo') {
        events.push({ date: purchase.purchase_date, type: 'purchase_discount', data: purchase });
      } else {
        events.push({ date: purchase.purchase_date, type: 'purchase_other', data: purchase });
      }
    });

    // Ordenar cronológicamente
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Procesar eventos y calcular acumulados
    const pendingByProduct = {}; // Unidades despachadas pero no entregadas
    let saldoPendiente = 0; // Dinero ganado pero no pagado

    steps.push({
      type: 'header',
      description: '📊 TRAZABILIDAD CRONOLÓGICA COMPLETA',
      amount: null
    });

    events.forEach((event, index) => {
      if (event.type === 'dispatch') {
        const dispatch = event.data;
        const prodName = productsData.find(p => p.reference === dispatch.product_reference)?.name || dispatch.product_reference;
        
        // Guardar estado ANTES del despacho
        const beforePending = pendingByProduct[dispatch.product_reference]?.quantity || 0;
        const wasDiscountedByPurchase = event.wasDiscountedByPurchase;
        
        // Solo incrementar si no fue descontado por compra
        if (!wasDiscountedByPurchase) {
          if (!pendingByProduct[dispatch.product_reference]) {
            pendingByProduct[dispatch.product_reference] = { quantity: 0, name: prodName };
          }
          pendingByProduct[dispatch.product_reference].quantity += dispatch.quantity;
        }

        steps.push({
          type: 'dispatch',
          wasDiscountedByPurchase,
          date: dispatch.dispatch_date,
          description: `Despacho: ${dispatch.quantity} × ${prodName}`,
          quantity: dispatch.quantity,
          product: prodName,
          productRef: dispatch.product_reference,
          beforePending: beforePending,
          afterPending: pendingByProduct[dispatch.product_reference]?.quantity ?? 0,
          pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct)),
          saldoPendiente: saldoPendiente
        });
      } 
      else if (event.type === 'delivery') {
        const delivery = event.data;
        let deliveryTotal = delivery.total_amount;
        if (!deliveryTotal) {
          if (delivery.items && delivery.items.length > 0) {
            deliveryTotal = delivery.items.reduce((s, item) => s + (item.total_amount || (item.quantity * item.unit_price) || 0), 0);
          } else if (delivery.quantity && delivery.unit_price) {
            deliveryTotal = delivery.quantity * delivery.unit_price;
          } else {
            deliveryTotal = 0;
          }
        }
        saldoPendiente += deliveryTotal;

        let itemsDesc = '';
        let itemsArray = [];
        let deliveredItems = [];
        
        if (delivery.items && delivery.items.length > 0) {
          delivery.items.forEach(item => {
            const prodName = productsData.find(p => p.reference === item.product_reference)?.name || item.product_reference;
            itemsArray.push(`${item.quantity} × ${prodName}`);
            
            const beforePending = pendingByProduct[item.product_reference]?.quantity || 0;
            
            deliveredItems.push({
              product: prodName,
              quantity: item.quantity,
              beforePending: beforePending,
              reference: item.product_reference
            });
            
            // Reducir pendientes
            if (pendingByProduct[item.product_reference]) {
              pendingByProduct[item.product_reference].quantity -= item.quantity;
              if (pendingByProduct[item.product_reference].quantity <= 0) {
                delete pendingByProduct[item.product_reference];
              }
            }
          });
          itemsDesc = itemsArray.join(', ');
        } else if (delivery.product_reference) {
          const prodName = productsData.find(p => p.reference === delivery.product_reference)?.name || delivery.product_reference;
          itemsDesc = `${delivery.quantity} × ${prodName}`;
          
          const beforePending = pendingByProduct[delivery.product_reference]?.quantity || 0;
          
          deliveredItems.push({
            product: prodName,
            quantity: delivery.quantity,
            beforePending: beforePending,
            reference: delivery.product_reference
          });
          
          // Reducir pendientes
          if (pendingByProduct[delivery.product_reference]) {
            pendingByProduct[delivery.product_reference].quantity -= delivery.quantity;
            if (pendingByProduct[delivery.product_reference].quantity <= 0) {
              delete pendingByProduct[delivery.product_reference];
            }
          }
        }

        steps.push({
          type: 'delivery',
          date: delivery.delivery_date,
          description: `Entrega: ${itemsDesc}`,
          amount: deliveryTotal,
          deliveredItems: deliveredItems,
          pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct)),
          saldoPendiente: saldoPendiente
        });
      } 
      else if (event.type === 'payment') {
        const payment = event.data;
        saldoPendiente -= payment.amount;

        steps.push({
          type: 'payment',
          date: payment.payment_date,
          description: `Pago: $${payment.amount.toLocaleString()}${payment.description ? ' - ' + payment.description : ''}`,
          amount: payment.amount,
          pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct)),
          saldoPendiente: Math.max(0, saldoPendiente)
        });
      }
      else if (event.type === 'purchase_discount') {
        const purchase = event.data;
        // El Delivery ya sumó la manufactura; ahora descontamos el precio de venta del saldo
        saldoPendiente -= purchase.total_amount;
        const itemsSummary = purchase.items?.map(i => `${i.product_name || i.product_reference} (${i.quantity})`).join(', ') || '';
        steps.push({
          type: 'purchase',
          date: purchase.purchase_date,
          description: `Compra: ${itemsSummary}`,
          amount: purchase.total_amount,
          payment_method: purchase.payment_method,
          pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct)),
          saldoPendiente: Math.max(0, saldoPendiente)
        });
      }
      else if (event.type === 'purchase_other') {
        const purchase = event.data;
        const itemsSummary = purchase.items?.map(i => `${i.product_name || i.product_reference} (${i.quantity})`).join(', ') || '';
        steps.push({
          type: 'purchase',
          date: purchase.purchase_date,
          description: `Compra: ${itemsSummary}`,
          amount: purchase.total_amount,
          payment_method: purchase.payment_method,
          pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct)),
          saldoPendiente: saldoPendiente
        });
      }
    });

    steps.push({
      type: 'final',
      description: '💰 SALDO PENDIENTE TOTAL',
      amount: Math.max(0, saldoPendiente),
      pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct))
    });

    return steps;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`Auditoría: ${employee.name}`, 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`ID: ${employee.employee_id} | Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, y);
    y += 6;
    doc.text(`Total Ganado: $${totalEarned.toLocaleString()} | Total Pagado: $${totalPaid.toLocaleString()} | Saldo Pendiente: $${pendingBalance.toLocaleString()}`, 14, y);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    calculationSteps.forEach(step => {
      if (step.type === 'header') return;

      if (y > 270) { doc.addPage(); y = 20; }

      if (step.type === 'dispatch') {
        doc.setFillColor(219, 234, 254);
        doc.rect(14, y - 4, pageWidth - 28, 16, 'F');
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(`📤 DESPACHO - ${step.date}`, 16, y + 2);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`${step.quantity} unidades de ${step.product} | Inventario: ${step.beforePending} + ${step.quantity} = ${step.afterPending}`, 16, y + 9);
        y += 20;
      } else if (step.type === 'delivery') {
        doc.setFillColor(220, 252, 231);
        doc.rect(14, y - 4, pageWidth - 28, 16, 'F');
        doc.setFont(undefined, 'bold');
        doc.setTextColor(21, 128, 61);
        doc.text(`✅ ENTREGA - ${step.date}`, 16, y + 2);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`${step.description.replace('Entrega: ', '')} | +$${step.amount.toLocaleString()} | Saldo: $${step.saldoPendiente.toLocaleString()}`, 16, y + 9);
        y += 20;
      } else if (step.type === 'payment') {
        doc.setFillColor(243, 232, 255);
        doc.rect(14, y - 4, pageWidth - 28, 16, 'F');
        doc.setFont(undefined, 'bold');
        doc.setTextColor(126, 34, 206);
        doc.text(`💵 PAGO - ${step.date}`, 16, y + 2);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`-$${step.amount.toLocaleString()} | Saldo restante: $${step.saldoPendiente.toLocaleString()}`, 16, y + 9);
        y += 20;
      } else if (step.type === 'final') {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFillColor(249, 115, 22);
        doc.rect(14, y - 4, pageWidth - 28, 14, 'F');
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`💰 SALDO PENDIENTE TOTAL: $${step.amount.toLocaleString()}`, 16, y + 5);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        y += 20;
      }
    });

    doc.save(`auditoria_${employee.employee_id}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Hoja de resumen
    const resumenData = [
      ['AUDITORÍA CONTABLE', employee.name],
      ['ID Empleado', employee.employee_id],
      ['Generado', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['RESUMEN FINANCIERO', ''],
      ['Total Ganado', totalEarned],
      ['Total Pagado', totalPaid],
      ['Saldo Pendiente', pendingBalance],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Hoja de movimientos
    const movData = [
      ['Tipo', 'Fecha', 'Descripción', 'Monto / Cantidad', 'Saldo Pendiente ($)']
    ];
    calculationSteps.forEach(step => {
      if (step.type === 'header') return;
      if (step.type === 'dispatch') {
        movData.push(['DESPACHO', step.date, `${step.quantity} unidades de ${step.product}`, step.quantity, step.saldoPendiente]);
      } else if (step.type === 'delivery') {
        movData.push(['ENTREGA', step.date, step.description.replace('Entrega: ', ''), step.amount, step.saldoPendiente]);
      } else if (step.type === 'payment') {
        movData.push(['PAGO', step.date, step.description.replace('Pago: ', ''), -step.amount, step.saldoPendiente]);
      } else if (step.type === 'final') {
        movData.push(['', '', 'SALDO FINAL PENDIENTE', '', step.amount]);
      }
    });
    const wsMov = XLSX.utils.aoa_to_sheet(movData);
    wsMov['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 50 }, { wch: 20 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsMov, 'Movimientos');

    XLSX.writeFile(wb, `auditoria_${employee.employee_id}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  useEffect(() => {
    if (!dateFilter?.from || !dateFilter?.to) {
      setCalculationSteps(allCalculationSteps);
      return;
    }

    const fromDate = new Date(dateFilter.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(dateFilter.to);
    toDate.setHours(23, 59, 59, 999);

    const filtered = allCalculationSteps.filter(step => {
      if (step.type === 'header' || step.type === 'final') return true;
      if (!step.date) return false;
      const stepDate = new Date(step.date + 'T00:00:00');
      return stepDate >= fromDate && stepDate <= toDate;
    });
    
    setCalculationSteps(filtered);
  }, [dateFilter, allCalculationSteps]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8 text-slate-500">
              <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No se encontró el empleado</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getDeliveryAmount = (d) => {
    if (d.total_amount) return d.total_amount;
    if (d.items && d.items.length > 0) return d.items.reduce((s, item) => s + (item.total_amount || (item.quantity * item.unit_price) || 0), 0);
    if (d.quantity && d.unit_price) return d.quantity * d.unit_price;
    return 0;
  };
  const totalEarned = deliveries.reduce((sum, d) => sum + getDeliveryAmount(d), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingBalance = calculationSteps.find(s => s.type === 'final')?.amount || 0;

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <Link to={createPageUrl("Dashboard")} className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600 hover:text-blue-600 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{employee.name}</h1>
          <p className="text-xs sm:text-sm text-slate-600">ID: {employee.employee_id}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-green-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-slate-600">Total Ganado</p>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">${totalEarned.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-slate-600">Total Pagado</p>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">${totalPaid.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                  <TrendingDown className="w-5 h-5 text-orange-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-slate-600">Saldo Pendiente</p>
                  <p className="text-lg sm:text-2xl font-bold text-orange-700 truncate">${pendingBalance.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Calculator className="w-5 h-5 flex-shrink-0" />
                <span>Auditoría Contable</span>
              </CardTitle>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={exportToPDF} className="text-xs text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-initial">
                  <FileDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportToExcel} className="text-xs text-green-600 border-green-200 hover:bg-green-50 flex-1 sm:flex-initial">
                  <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Excel
                </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter?.from ? (
                      dateFilter.to ? (
                        <>
                          {format(dateFilter.from, "dd/MM/yyyy")} - {format(dateFilter.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(dateFilter.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Filtrar por fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateFilter?.from}
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    numberOfMonths={2}
                  />
                  {dateFilter && (
                    <div className="p-3 border-t">
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => setDateFilter(null)}
                      >
                        Limpiar filtro
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {calculationSteps.map((step, index) => {
                if (step.type === 'header') {
                  return (
                    <div key={index} className="bg-slate-800 text-white p-4 rounded-lg text-center font-bold text-lg mb-4">
                      {step.description}
                    </div>
                  );
                }

                if (step.type === 'dispatch') {
                   return (
                     <div key={index} className={`border-l-4 ${step.wasDiscountedByPurchase ? 'border-orange-400 bg-orange-50' : 'border-blue-500 bg-blue-50'} rounded-lg p-3 sm:p-4`}>
                       <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                         <TruckIcon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${step.wasDiscountedByPurchase ? 'text-orange-500' : 'text-blue-600'}`} />
                         <span className={`text-xs font-semibold px-2 py-1 rounded ${step.wasDiscountedByPurchase ? 'text-orange-800 bg-orange-200' : 'text-blue-800 bg-blue-200'}`}>📤 DESPACHO</span>
                         <span className="text-xs sm:text-sm font-semibold text-slate-900">{step.date}</span>
                         {step.wasDiscountedByPurchase && (
                           <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded font-semibold">🛍️ Compra Interna</span>
                         )}
                       </div>

                       <div className={`bg-white rounded-lg p-3 sm:p-4 border-2 ${step.wasDiscountedByPurchase ? 'border-orange-300' : 'border-blue-300'} mb-3`}>
                         {step.wasDiscountedByPurchase ? (
                           <div>
                             <p className="text-sm font-semibold text-orange-700 mb-1">Despacho descontado por compra interna</p>
                             <p className="text-xs text-slate-600">El operario tenía este material despachado y fue descontado como una compra interna. Las unidades se acreditaron como manufactura entregada.</p>
                           </div>
                         ) : (
                           <>
                             <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                               <p className="text-xs sm:text-sm font-semibold text-slate-700">Se despachó al operario:</p>
                               <p className="text-lg sm:text-xl font-bold text-blue-900">+{step.quantity} {step.product}</p>
                             </div>
                             <div className="bg-blue-50 rounded p-3 mt-2">
                               <p className="text-xs text-slate-600 mb-2">📦 Inventario de {step.product}:</p>
                               <div className="flex items-center gap-3 text-lg">
                                 <span className="font-medium text-slate-600">{step.beforePending}</span>
                                 <span className="text-green-600 font-bold">+ {step.quantity}</span>
                                 <span className="text-blue-600">=</span>
                                 <span className="font-bold text-blue-900">{step.afterPending}</span>
                               </div>
                             </div>
                           </>
                         )}
                      </div>

                      <div className="bg-slate-100 rounded-lg p-3">
                        <p className="text-xs text-slate-600 font-semibold mb-2">📦 Inventario TOTAL después de este despacho:</p>
                        {Object.keys(step.pendingByProduct).length > 0 ? (
                          <div className="space-y-1">
                            {Object.values(step.pendingByProduct).map((prod, i) => (
                              <p key={i} className="text-sm font-bold text-slate-900">
                                • {prod.quantity} unidades de {prod.name}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic">Sin inventario</p>
                        )}
                        <div className="mt-3 pt-3 border-t border-slate-300">
                          <p className="text-xs text-slate-600 mb-1">💰 Dinero por cobrar:</p>
                          <p className="text-xl font-bold text-orange-600">${step.saldoPendiente.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (step.type === 'delivery') {
                   return (
                     <div key={index} className="border-l-4 border-green-500 bg-green-50 rounded-lg p-3 sm:p-4">
                       <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                         <Package className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                         <span className="text-xs font-semibold text-green-800 bg-green-200 px-2 py-1 rounded">✅ ENTREGA</span>
                         <span className="text-xs sm:text-sm font-semibold text-slate-900">{step.date}</span>
                       </div>

                       <div className="bg-white rounded-lg p-3 sm:p-4 border-2 border-green-300 mb-3">
                         <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                           <p className="text-xs sm:text-sm font-semibold text-slate-700">El operario entregó:</p>
                           <p className="text-lg sm:text-lg font-bold text-green-900">+${step.amount.toLocaleString()}</p>
                         </div>
                        
                        {step.deliveredItems && step.deliveredItems.length > 0 && (
                          <div className="space-y-3">
                            {step.deliveredItems.map((item, idx) => (
                              <div key={idx} className="bg-green-50 rounded p-3 border border-green-200">
                                <p className="text-sm font-semibold text-green-900 mb-2">{item.quantity} unidades de {item.product}</p>
                                <p className="text-xs text-slate-600 mb-2">📦 Inventario de {item.product}:</p>
                                <div className="flex items-center gap-3 text-lg">
                                  <span className="font-medium text-slate-600">{item.beforePending}</span>
                                  <span className="text-red-600 font-bold">- {item.quantity}</span>
                                  <span className="text-green-600">=</span>
                                  <span className="font-bold text-green-900">{item.beforePending - item.quantity}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-100 rounded-lg p-3">
                        <p className="text-xs text-slate-600 font-semibold mb-2">📦 Inventario TOTAL después de esta entrega:</p>
                        {Object.keys(step.pendingByProduct).length > 0 ? (
                          <div className="space-y-1">
                            {Object.values(step.pendingByProduct).map((prod, i) => (
                              <p key={i} className="text-sm font-bold text-slate-900">
                                • {prod.quantity} unidades de {prod.name}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic">✓ Inventario vacío</p>
                        )}
                        <div className="mt-3 pt-3 border-t border-slate-300">
                          <p className="text-xs text-slate-600 mb-1">💰 Dinero por cobrar:</p>
                          <p className="text-xl font-bold text-orange-600">${step.saldoPendiente.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (step.type === 'purchase') {
                  const isDiscount = step.payment_method === 'descuento_saldo';
                  const methodLabel = isDiscount ? 'Descuento de saldo' : step.payment_method === 'contado' ? 'Contado' : 'A crédito';
                  return (
                    <div key={index} className="border-l-4 border-pink-500 bg-pink-50 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-pink-800 bg-pink-200 px-2 py-1 rounded">🛍️ COMPRA EMPLEADO</span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-900">{step.date}</span>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">{methodLabel}</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-pink-300 mb-2">
                        <p className="text-sm text-slate-700">{step.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {isDiscount ? (
                            <span className="text-sm font-bold text-red-600">−${step.amount.toLocaleString()} del saldo</span>
                          ) : (
                            <span className="text-sm font-bold text-slate-600">${step.amount.toLocaleString()} ({methodLabel})</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">✅ Las unidades ya cuentan como entregadas (manufactura acreditada)</p>
                      </div>
                      <div className="bg-slate-100 rounded p-2 text-xs text-slate-600">
                        💰 Saldo después: <span className="font-bold text-orange-600">${step.saldoPendiente.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                }

                if (step.type === 'payment') {
                   return (
                     <div key={index} className="border-l-4 border-purple-500 bg-purple-50 rounded-lg p-3 sm:p-4">
                       <div className="mb-3">
                         <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                           <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                           <span className="text-xs font-semibold text-purple-800 bg-purple-200 px-2 py-1 rounded">💵 PAGO</span>
                           <span className="text-xs sm:text-sm font-semibold text-slate-900">{step.date}</span>
                         </div>
                        <div className="bg-purple-100 rounded-lg p-3 border border-purple-300">
                          <p className="text-sm text-slate-800 mb-1">
                            <strong>Se pagó al operario:</strong>
                          </p>
                          <p className="text-lg font-bold text-purple-900">{step.description.replace('Pago: ', '')}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-purple-700 italic">💡 Se descontó del saldo pendiente</span>
                            <span className="text-lg font-bold text-red-700">-${step.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-3 pt-3 border-t border-purple-300">
                         <div className="bg-white rounded p-3 border border-slate-200">
                           <p className="text-xs text-slate-600 font-semibold mb-2">📦 Pendientes por Entregar:</p>
                          {Object.keys(step.pendingByProduct).length > 0 ? (
                            Object.values(step.pendingByProduct).map((prod, i) => (
                              <p key={i} className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded mb-1">
                                {prod.quantity} × {prod.name}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 italic">✓ Todo entregado</p>
                          )}
                        </div>
                        <div className="bg-white rounded p-3 border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold mb-2">💰 Saldo Pendiente:</p>
                          <p className="text-2xl font-bold text-orange-600">${step.saldoPendiente.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (step.type === 'final') {
                   return (
                     <div key={index} className="mt-4 sm:mt-6">
                       <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-4 sm:p-5 mb-3 shadow-lg">
                         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                           <p className="font-bold text-lg sm:text-xl">{step.description}</p>
                           <p className="text-2xl sm:text-3xl font-bold">${step.amount.toLocaleString()}</p>
                         </div>
                       </div>
                      {step.pendingByProduct && Object.keys(step.pendingByProduct).length > 0 && (
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                          <p className="font-semibold text-slate-900 mb-2">📦 Unidades Pendientes por Entregar:</p>
                          {Object.values(step.pendingByProduct).map((prod, i) => (
                            <p key={i} className="text-blue-700 font-medium">
                              • {prod.quantity} × {prod.name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}