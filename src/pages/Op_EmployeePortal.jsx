import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { portalClient } from "@/api/portalClient";
const { Delivery, Dispatch, Payment, PaymentRequest, Producto: ProductoEntity, AppConfig, EmployeePurchase, CertificadoSolicitud } = {
  Delivery: portalClient.entities.Delivery,
  Dispatch: portalClient.entities.Dispatch,
  Payment: portalClient.entities.Payment,
  PaymentRequest: portalClient.entities.PaymentRequest,
  Producto: portalClient.entities.Producto,
  AppConfig: portalClient.entities.AppConfig,
  EmployeePurchase: portalClient.entities.EmployeePurchase,
  CertificadoSolicitud: portalClient.entities.CertificadoSolicitud,
};

// Carga empleado verificando PIN en el servidor
async function portalLogin(employeeId, pin) {
  const res = await fetch('/api/portal-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: employeeId, pin }),
  });
  if (res.status === 401) throw new Error('PIN_INCORRECTO');
  if (res.status === 404) throw new Error('NO_ENCONTRADO');
  if (!res.ok) throw new Error('ERROR_SERVIDOR');
  return res.json();
}
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, DollarSign, Clock, TrendingUp, Package, Calendar, Phone, Briefcase, Factory, BellRing, Hourglass, Calculator, TruckIcon, FileText } from "lucide-react";
import { format } from "date-fns";

import EmployeeTimeline from "../components/employees/EmployeeTimeline";
import EmployeePendingItems from "../components/employees/EmployeePendingItems";
import EmployeePaymentsSummary from "../components/employees/EmployeePaymentsSummary";

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_ES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve','treinta','treinta y uno'];
const ANIOS_ES = {2020:'dos mil veinte',2021:'dos mil veintiuno',2022:'dos mil veintidós',2023:'dos mil veintitrés',2024:'dos mil veinticuatro',2025:'dos mil veinticinco',2026:'dos mil veintiséis',2027:'dos mil veintisiete',2028:'dos mil veintiocho',2029:'dos mil veintinueve',2030:'dos mil treinta',2031:'dos mil treinta y uno'};

function generateCertificadoHTML(emp, salarioCalculado) {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const dia = hoy.getDate();
  const mes = MESES[hoy.getMonth()];
  const anio = hoy.getFullYear();
  const diaEs = DIAS_ES[dia] || String(dia);
  const anioEs = ANIOS_ES[anio] || String(anio);

  const esFemenino = (emp.genero || 'F') === 'F';
  const tratamiento = esFemenino ? 'la señora' : 'el señor';
  const identificadoA = esFemenino ? 'identificada' : 'identificado';

  const hireDate = emp.hire_date ? new Date(emp.hire_date + 'T00:00:00') : null;
  const mesInicio = hireDate ? MESES[hireDate.getMonth()] : '';
  const anioInicio = hireDate ? hireDate.getFullYear() : '';

  let periodoLaboral = '';
  if (emp.fecha_retiro) {
    const retiro = new Date(emp.fecha_retiro + 'T00:00:00');
    periodoLaboral = `desde ${mesInicio} de ${anioInicio} hasta ${MESES[retiro.getMonth()]} de ${retiro.getFullYear()}`;
  } else {
    periodoLaboral = `desde ${mesInicio} de ${anioInicio} a la actualidad`;
  }

  const salario = salarioCalculado > 0
    ? Number(salarioCalculado).toLocaleString('es-CO') + ' de pesos'
    : 'a convenir';

  const cedula = emp.cedula || '[cédula no registrada]';
  const cargo = emp.position || '[cargo no registrado]';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado Laboral - ${emp.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; }
  .page { width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 2.2cm 2.5cm; position: relative; }
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-20deg);
    font-size: 130px; font-weight: 900; letter-spacing: 8px;
    color: rgba(0,0,0,0.045); z-index: 0; white-space: nowrap;
    pointer-events: none; user-select: none;
  }
  .content { position: relative; z-index: 1; }
  .header { text-align: center; margin-bottom: 1.6cm; }
  .header h1 { font-size: 28px; font-weight: 900; color: #111; margin-bottom: 6px; }
  .header .info { color: #c8960a; font-size: 12px; line-height: 1.7; }
  .footer-header { text-align: center; margin-top: 1.4cm; }
  .footer-header h1 { font-size: 22px; font-weight: 900; color: #111; margin-bottom: 4px; }
  .footer-header .info { color: #c8960a; font-size: 11px; line-height: 1.7; }
  .fecha { margin-bottom: 1cm; font-size: 13px; }
  .ref { margin-bottom: 0.8cm; font-size: 13px; }
  .yo { margin-bottom: 0.7cm; font-size: 13px; }
  .certifico { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 0.6cm; }
  .cuerpo { margin-bottom: 0.7cm; font-size: 13px; line-height: 1.75; text-align: justify; }
  .damos-fe { margin-bottom: 0.9cm; font-size: 13px; line-height: 1.75; text-align: justify; }
  .constancia { margin-bottom: 1.4cm; font-size: 13px; line-height: 1.75; text-align: justify; }
  .cordialmente { margin-bottom: 0.4cm; font-size: 13px; }
  .firma-espacio { height: 2.4cm; }
  .firmante { font-size: 13px; }
  .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; }
  button {
    background: #1e40af; color: #fff; border: none; padding: 10px 22px;
    border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  button:hover { background: #1d4ed8; }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff; }
    .page { padding: 1.5cm 2cm; }
    .watermark { position: fixed; }
  }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>
<div class="watermark">eQuis T</div>
<div class="page">
  <div class="content">
    <div class="header">
      <h1>eQuis - T</h1>
      <div class="info">
        Calle 10 # 11 20<br>
        321 233 4884<br>
        Nit.: 1.024.543.179-8<br>
        Calle 10 # 11 - 20
      </div>
    </div>

    <div class="fecha">Bogotá, ${dia} de ${mes} de ${anio}</div>

    <div class="ref">
      Ref.: Certificación laboral<br>
      Ciudad
    </div>

    <div class="yo">Yo <strong>Carlos Cárdenas,</strong> Líder general de <strong>eQuis - T</strong></div>

    <div class="certifico">CERTIFICO:</div>

    <div class="cuerpo">
      Que ${tratamiento} <strong>${emp.name},</strong> ${identificadoA} con cédula de ciudadanía No.
      <strong>${cedula}</strong> expedida en Bogotá labora en nuestra empresa ${periodoLaboral},
      desempeñando el cargo de <strong>${cargo}</strong> con un contrato a término indefinido
      y devengando un salario a ${anio} de ${salario}.
    </div>

    <div class="damos-fe">
      Damos fe de sus valores morales, entre los cuales destacan la responsabilidad y la honestidad.
    </div>

    <div class="constancia">
      Para constancia de lo anterior se firma en Bogotá a los ${diaEs} (${dia}) días del mes de
      ${mes} del ${anioEs} (${anio}).
    </div>

    <div class="cordialmente">Cordialmente,</div>
    <div class="firma-espacio"></div>
    <div class="firmante">
      Carlos Cárdenas - Tel Cel.:&nbsp; <strong>315 592 52 80</strong><br>
      C.C 1.024.543.179 expedida en Bogotá
    </div>

    <div class="footer-header">
      <h1>eQuis - T</h1>
      <div class="info">
        Calle 10 # 11 20<br>
        321 233 4884<br>
        Nit.: 1.024.543.179-8<br>
        Calle 10 # 11 - 20
      </div>
    </div>
  </div>
</div>
<script>
  // Auto-abrir el diálogo de impresión cuando se carga
  window.onload = function() {
    setTimeout(function() { window.print(); }, 600);
  };
</script>
</body>
</html>`;
}

export default function EmployeePortal() {
  const [employee, setEmployee] = useState(null);
  const [data, setData] = useState({ deliveries: [], dispatches: [], payments: [], products: [], purchases: [] });
  const [stats, setStats] = useState({ totalEarned: 0, pendingAmount: 0, totalDelivered: 0, pendingUnits: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPaymentWindowOpen, setIsPaymentWindowOpen] = useState(false);
  const [paymentWindowClosesAt, setPaymentWindowClosesAt] = useState(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [solicitudCert, setSolicitudCert] = useState(null);   // última solicitud de certificado
  const [loadingSolicitud, setLoadingSolicitud] = useState(false);
  const [calculationSteps, setCalculationSteps] = useState([]);

  // PIN state
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [employeeDbId, setEmployeeDbId] = useState(null); // UUID del empleado

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const employeeId = params.get('employee_id');  // employee_id lógico (EMP001, etc.)
  const employeeDbIdParam = params.get('id');     // UUID de BD (alternativa)

  // Efecto: verificar PIN y cargar datos una vez verificado
  useEffect(() => {
    if (!pinVerified || !employeeDbId) return;

    const checkPaymentWindow = async () => {
      try {
        const configs = await AppConfig.filter({ key: "payment_window_opened_at" });
        if (configs.length > 0 && configs[0].value) {
          const openedAt = new Date(configs[0].value);
          const now = new Date();
          const diffHours = (now - openedAt) / (1000 * 60 * 60);
          const isOpen = diffHours >= 0 && diffHours < 5;
          setIsPaymentWindowOpen(isOpen);
          if (isOpen) {
            const closesAt = new Date(openedAt.getTime() + 5 * 60 * 60 * 1000);
            setPaymentWindowClosesAt(closesAt.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }));
          } else {
            setPaymentWindowClosesAt(null);
          }
        } else {
          setIsPaymentWindowOpen(false);
          setPaymentWindowClosesAt(null);
        }
      } catch(e) {
        setIsPaymentWindowOpen(false);
      }
    };

    checkPaymentWindow();
    const interval = setInterval(checkPaymentWindow, 60000);

    const loadAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const empId = employee?.employee_id || employeeId;

        const [deliveries, dispatches, payments, products, existingRequests, purchases, certSolicitudes] = await Promise.all([
          Delivery.filter({ employee_id: empId }),
          Dispatch.filter({ employee_id: empId }),
          Payment.filter({ employee_id: empId }, '-payment_date'),
          ProductoEntity.list(),
          PaymentRequest.filter({ employee_id: empId, status: 'pending' }),
          EmployeePurchase.filter({ employee_id: empId }),
          CertificadoSolicitud.filter({ employee_id: empId }, '-request_date'),
        ]);

        const normProducts = (products || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra }));
        setData({ deliveries, dispatches, payments, products: normProducts, purchases: purchases || [] });
        setHasPendingRequest(existingRequests.length > 0);
        // Tomar la solicitud de certificado más reciente
        const ultimaSolicitud = (certSolicitudes || []).sort((a, b) => new Date(b.request_date) - new Date(a.request_date))[0] || null;
        setSolicitudCert(ultimaSolicitud);
        calculateStats(deliveries, dispatches, payments, purchases || []);
        calculateBalance(deliveries, dispatches, payments, normProducts, purchases || []);

      } catch (err) {
        console.error("Error cargando datos del empleado:", err);
        setError("Error al cargar los datos del empleado.");
      }
      setLoading(false);
    };

    loadAllData();

    return () => clearInterval(interval);
  }, [pinVerified, employeeDbId]);

  const calculateStats = (deliveries, dispatches, payments, purchases = []) => {
    const totalEarned = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Calcular pagos por entrega (sistema nuevo)
    const deliveryPaidAmounts = {};
    payments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    // Marcar entregas pagadas completamente (sistema antiguo)
    const paidDeliveryIds = new Set();
    payments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) {
        p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
      }
    });

    // Calcular pendiente total
    let pendingAmount = 0;
    deliveries.forEach(d => {
      // Skip si está marcada como pagada (status en BD o sistema antiguo)
      if (d.status === 'pagado' || paidDeliveryIds.has(d.id)) return;
      // Skip entregas generadas automáticamente por compra interna
      if (d.notes && d.notes.includes('Compra empleado')) return;
      
      const paidAmt = deliveryPaidAmounts[d.id] || 0;
      const remaining = d.total_amount - paidAmt;
      if (remaining > 0) pendingAmount += remaining;
    });

    // Restar TODOS los pagos sin entregas asociadas (avances, solicitudes aprobadas, etc.)
    // Los pagos con delivery_payments ya están descontados entrega a entrega arriba.
    // Los pagos con delivery_ids (pago_completo) ya marcaron las entregas como skip arriba.
    const unlinkedPayments = payments.filter(p =>
      (!p.delivery_ids || p.delivery_ids.length === 0) &&
      (!p.delivery_payments || p.delivery_payments.length === 0)
    ).reduce((sum, p) => sum + p.amount, 0);

    pendingAmount -= unlinkedPayments;

    // Descontar compras con descuento_saldo
    const purchaseDiscounts = purchases
      .filter(p => p.payment_method === 'descuento_saldo')
      .reduce((sum, p) => sum + p.total_amount, 0);
    pendingAmount -= purchaseDiscounts;

    // Clamp a 0 para consistencia con el dashboard (no mostrar deuda negativa)
    pendingAmount = Math.max(0, pendingAmount);

    const totalDelivered = deliveries.reduce((sum, d) => {
      if (d.items && d.items.length > 0) {
        return sum + d.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }
      return sum + (d.quantity || 0);
    }, 0);

    const pendingUnits = {};

    setStats({ totalEarned, pendingAmount, totalDelivered, pendingUnits });
  };

  const getProductName = (reference) => {
    const product = data.products.find(p => p.reference === reference);
    return product ? product.name : reference;
  };

  const calculateBalance = (deliveriesData, dispatchesData, paymentsData, productsData, purchasesData = []) => {
    const steps = [];
    const events = [];

    dispatchesData.forEach(dispatch => {
      events.push({ date: dispatch.dispatch_date, type: 'dispatch', data: dispatch });
    });
    deliveriesData.forEach(delivery => {
      events.push({ date: delivery.delivery_date, type: 'delivery', data: delivery });
    });
    paymentsData.forEach(payment => {
      events.push({ date: payment.payment_date, type: 'payment', data: payment });
    });
    purchasesData.forEach(purchase => {
      events.push({ date: purchase.purchase_date, type: purchase.payment_method === 'descuento_saldo' ? 'purchase_discount' : 'purchase_other', data: purchase });
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
        
        const beforePending = pendingByProduct[dispatch.product_reference]?.quantity || 0;
        const wasDiscountedByPurchase = dispatch.status === 'entregado' && dispatch.quantity === 0;
        
        // Solo incrementar si aún tiene unidades pendientes
        if (!wasDiscountedByPurchase) {
          if (!pendingByProduct[dispatch.product_reference]) {
            pendingByProduct[dispatch.product_reference] = { quantity: 0, name: prodName };
          }
          pendingByProduct[dispatch.product_reference].quantity += dispatch.quantity;
        }

        const afterPendingQty = pendingByProduct[dispatch.product_reference]?.quantity ?? 0;
        steps.push({
          type: 'dispatch',
          wasDiscountedByPurchase,
          date: dispatch.dispatch_date,
          description: `Despacho: ${dispatch.quantity} × ${prodName}`,
          quantity: dispatch.quantity,
          product: prodName,
          productRef: dispatch.product_reference,
          beforePending: beforePending,
          afterPending: afterPendingQty,
          pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct)),
          saldoPendiente: saldoPendiente
        });
      } 
      else if (event.type === 'delivery') {
        const delivery = event.data;
        // Si es entrega generada por compra interna, no sumar al saldo (la compra ya lo descuenta)
        const isInternalPurchaseDelivery = delivery.notes && delivery.notes.includes('Compra empleado');
        let deliveryTotal = isInternalPurchaseDelivery ? 0 : (delivery.total_amount || 0);
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
      amount: saldoPendiente,
      pendingByProduct: JSON.parse(JSON.stringify(pendingByProduct))
    });

    setCalculationSteps(steps);
  };
  
  const calcularSalarioPromedio = () => {
    const mesActual = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
      .toISOString().substring(0, 7);
    const byMonth = {};
    data.deliveries.forEach(d => {
      if (!d.delivery_date || !d.total_amount) return;
      if (d.notes && d.notes.includes('Compra empleado')) return;
      byMonth[d.delivery_date.substring(0, 7)] = (byMonth[d.delivery_date.substring(0, 7)] || 0) + d.total_amount;
    });
    const meses = Object.keys(byMonth).sort().filter(m => m < mesActual).slice(-3);
    if (meses.length > 0) {
      return Math.round((meses.reduce((s, m) => s + byMonth[m], 0) / meses.length) / 10000) * 10000;
    }
    const todos = Object.keys(byMonth);
    if (todos.length > 0) {
      return Math.round((todos.reduce((s, m) => s + byMonth[m], 0) / todos.length) / 10000) * 10000;
    }
    return 0;
  };

  const handleSolicitarCertificado = async () => {
    if (!employee.cedula) {
      alert('Tu perfil no tiene cédula registrada. Pídele al administrador que la configure.');
      return;
    }
    setLoadingSolicitud(true);
    try {
      const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
        .toISOString().split('T')[0];
      const solicitud = await CertificadoSolicitud.create({
        employee_id: employee.employee_id,
        employee_name: employee.name,
        cedula: employee.cedula,
        cargo: employee.position || '',
        hire_date: employee.hire_date || '',
        fecha_retiro: employee.fecha_retiro || '',
        genero: employee.genero || 'F',
        monto_sugerido: calcularSalarioPromedio(),
        status: 'pendiente',
        request_date: hoy,
      });
      setSolicitudCert(solicitud);
    } catch (e) {
      alert('Error al enviar la solicitud. Intenta de nuevo.');
    }
    setLoadingSolicitud(false);
  };

  const handleDescargarCertificadoAprobado = () => {
    if (!solicitudCert || solicitudCert.status !== 'aprobado') return;
    const html = generateCertificadoHTML(employee, solicitudCert.monto_aprobado);
    const win = window.open('', '_blank');
    if (!win) {
      alert('Tu navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const handleRequestPayment = async () => {
    if (stats.pendingAmount <= 0) {
      alert("No tienes saldo pendiente para solicitar.");
      return;
    }
    if (hasPendingRequest) {
      alert("Ya tienes una solicitud de pago pendiente.");
      return;
    }

    if (window.confirm(`¿Confirmas la solicitud de pago por $${stats.pendingAmount.toLocaleString()}?`)) {
      try {
        // Usar hora de Colombia para el timestamp
        const colombiaTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Bogota"}));
        const requestData = {
          employee_id: employee.employee_id,
          employee_name: employee.name,
          requested_amount: stats.pendingAmount,
          request_date: colombiaTime.toISOString().split('T')[0],
          request_time: colombiaTime.toTimeString().split(' ')[0],
          status: 'pending'
        };
        await PaymentRequest.create(requestData);
        setHasPendingRequest(true);
        alert("Tu solicitud de pago ha sido enviada con éxito.");
      } catch (error) {
        console.error("Error al crear la solicitud de pago:", error);
        alert("Hubo un error al enviar tu solicitud. Por favor, intenta de nuevo.");
      }
    }
  };

  // ── Pantalla de PIN ────────────────────────────────────────────────────────
  const handleVerifyPin = async () => {
    if (!employeeId) {
      setPinError('URL inválida: falta el ID del empleado.');
      return;
    }
    setPinError('');
    try {
      const empData = await portalLogin(employeeId, pinInput);
      setEmployee(empData);
      setEmployeeDbId(empData.id);
      setPinVerified(true);
    } catch (e) {
      if (e.message === 'PIN_INCORRECTO') setPinError('PIN incorrecto. Intenta de nuevo.');
      else if (e.message === 'NO_ENCONTRADO') setPinError('Empleado no encontrado.');
      else setPinError('Error de conexión. Intenta de nuevo.');
    }
  };

  if (!pinVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Factory className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Portal de Empleado</h1>
            <p className="text-slate-500 text-sm mt-1">Ingresa tu PIN para continuar</p>
          </div>
          <div className="space-y-3">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] focus:outline-none focus:border-blue-500"
              autoFocus
            />
            {pinError && <p className="text-red-600 text-sm font-medium">{pinError}</p>}
            <button
              onClick={handleVerifyPin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-slate-600">Cargando tu portal de empleado...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-xl font-bold text-red-700">Error</h2>
            <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="p-8">
            <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No se encontró información del empleado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-screen">
      <header className="bg-white shadow-sm py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Factory className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h2 className="font-bold text-slate-900 text-base sm:text-lg">Producción eQuis-T</h2>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <User className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
                {employee.name}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />ID: {employee.employee_id}</span>
                {employee.position && <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{employee.position}</span>}
                {employee.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{employee.phone}</span>}
                {employee.hire_date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />Desde: {format(new Date(employee.hire_date), 'dd/MM/yyyy')}</span>}
              </div>
            </div>
            <Badge className={employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {employee.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6">
          <Card>
            <CardContent className="p-6 flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><DollarSign className="w-6 h-6 text-green-600" /></div><div><p className="text-sm text-slate-600">Total Recibido</p><p className="text-2xl font-bold text-green-700">${stats.totalEarned.toLocaleString()}</p></div></CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.pendingAmount < 0 ? 'bg-red-100' : 'bg-orange-100'}`}>
                <Clock className={`w-6 h-6 ${stats.pendingAmount < 0 ? 'text-red-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className="text-sm text-slate-600">Saldo Pendiente</p>
                <p className={`text-2xl font-bold ${stats.pendingAmount < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                  {stats.pendingAmount < 0 ? `-$${Math.abs(stats.pendingAmount).toLocaleString()}` : `$${stats.pendingAmount.toLocaleString()}`}
                </p>
                {stats.pendingAmount < 0 && <p className="text-xs text-red-500">Deuda pendiente</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="w-6 h-6 text-blue-600" /></div><div><p className="text-sm text-slate-600">Unidades Entregadas</p><p className="text-2xl font-bold text-blue-700">{stats.totalDelivered.toLocaleString()}</p></div></CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-3"><div className="p-2 bg-purple-100 rounded-lg"><Package className="w-6 h-6 text-purple-600" /></div><div><p className="text-sm text-slate-600">Productos Pendientes</p><p className="text-2xl font-bold text-purple-700">{Object.keys(stats.pendingUnits).length}</p></div></CardContent>
          </Card>
        </div>
        
        <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 text-white rounded-full p-3">
                        <BellRing className="w-6 h-6"/>
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-900">Solicitud de Pago</h3>
                        {isPaymentWindowOpen ? (
                             <p className="text-sm text-blue-700">✅ La ventana para solicitar pagos está abierta. ¡Puedes solicitar tu saldo ahora!{paymentWindowClosesAt && <span className="ml-1 font-semibold">Cierra a las {paymentWindowClosesAt}.</span>}</p>
                        ) : (
                             <p className="text-sm text-blue-700">⏰ La ventana de pagos está cerrada. Espera a que el planillador registre las entregas.</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                            Hora actual Colombia: {new Date().toLocaleString("es-CO", {timeZone: "America/Bogota"})}
                        </p>
                    </div>
                </div>
                {isPaymentWindowOpen && stats.pendingAmount > 0 ? (
                    <Button 
                        onClick={handleRequestPayment}
                        disabled={hasPendingRequest}
                        className={`min-w-[180px] ${hasPendingRequest ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {hasPendingRequest ? <><Hourglass className="w-4 h-4 mr-2"/> Solicitud Pendiente</> : `Solicitar $${stats.pendingAmount.toLocaleString()}`}
                    </Button>
                ) : stats.pendingAmount === 0 ? (
                    <div className="text-center">
                        <p className="text-sm text-slate-500">No tienes saldo pendiente</p>
                    </div>
                ) : !isPaymentWindowOpen ? (
                    <div className="text-center">
                        <p className="text-sm text-slate-500">Fuera del horario de solicitud</p>
                    </div>
                ) : null}
            </CardContent>
        </Card>

        {/* Certificado Laboral */}
        <Card className={`mb-6 ${
          !solicitudCert ? 'border-emerald-200 bg-emerald-50' :
          solicitudCert.status === 'pendiente' ? 'border-amber-200 bg-amber-50' :
          solicitudCert.status === 'aprobado' ? 'border-emerald-200 bg-emerald-50' :
          'border-red-200 bg-red-50'
        }`}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`text-white rounded-full p-3 shrink-0 ${
                  solicitudCert?.status === 'pendiente' ? 'bg-amber-500' :
                  solicitudCert?.status === 'aprobado' ? 'bg-emerald-600' :
                  solicitudCert?.status === 'rechazado' ? 'bg-red-500' :
                  'bg-emerald-600'
                }`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Certificado Laboral</h3>
                  {!solicitudCert && (
                    <p className="text-sm text-slate-600">
                      {employee.cedula
                        ? `Salario referencia: $${calcularSalarioPromedio().toLocaleString('es-CO')} (promedio últimos meses). El administrador revisará y aprobará.`
                        : 'Falta tu cédula en el perfil. Pídele al administrador que la configure.'}
                    </p>
                  )}
                  {solicitudCert?.status === 'pendiente' && (
                    <p className="text-sm text-amber-700">⏳ Solicitud enviada el {solicitudCert.request_date} — en espera de aprobación del administrador.</p>
                  )}
                  {solicitudCert?.status === 'aprobado' && (
                    <p className="text-sm text-emerald-700">✅ Aprobado — monto: <strong>${Number(solicitudCert.monto_aprobado).toLocaleString('es-CO')}</strong>. Listo para descargar.</p>
                  )}
                  {solicitudCert?.status === 'rechazado' && (
                    <div>
                      <p className="text-sm text-red-700">❌ Solicitud rechazada.{solicitudCert.admin_notes && ` Motivo: ${solicitudCert.admin_notes}`}</p>
                      <p className="text-xs text-slate-500 mt-1">Puedes enviar una nueva solicitud.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full sm:w-auto shrink-0">
                {(!solicitudCert || solicitudCert.status === 'rechazado') && (
                  <Button
                    onClick={handleSolicitarCertificado}
                    disabled={!employee.cedula || loadingSolicitud}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {loadingSolicitud ? 'Enviando...' : 'Solicitar Certificado'}
                  </Button>
                )}
                {solicitudCert?.status === 'pendiente' && (
                  <span className="inline-flex items-center gap-2 text-amber-700 text-sm font-medium px-4 py-2 bg-amber-100 rounded-lg">
                    <Hourglass className="w-4 h-4" /> En revisión
                  </span>
                )}
                {solicitudCert?.status === 'aprobado' && (
                  <Button
                    onClick={handleDescargarCertificadoAprobado}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de precios por referencia */}
        {data.products.filter(p => p.is_active !== false).length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <h3 className="font-bold text-amber-900 mb-1 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Precios de manufactura por referencia
              </h3>
              <p className="text-xs text-amber-700 mb-4">Úsala para verificar que tu saldo coincida con lo que aparece en el botón de solicitud.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.products
                  .filter(p => p.is_active !== false)
                  .map(p => (
                    <div key={p.reference} className="bg-white rounded-lg border border-amber-200 px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                        <p className="text-xs text-slate-400">Ref: {p.reference}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-amber-800 text-base">${(p.manufacturing_price || 0).toLocaleString('es-CO')}</p>
                        <p className="text-xs text-slate-400">por unidad</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calculator className="w-6 h-6" />
              Auditoría Contable - Trazabilidad Completa
            </h2>
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
                    <div key={index} className={`border-l-4 ${step.wasDiscountedByPurchase ? 'border-orange-400 bg-orange-50' : 'border-blue-500 bg-blue-50'} rounded-lg p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <TruckIcon className={`w-5 h-5 ${step.wasDiscountedByPurchase ? 'text-orange-500' : 'text-blue-600'}`} />
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${step.wasDiscountedByPurchase ? 'text-orange-800 bg-orange-200' : 'text-blue-800 bg-blue-200'}`}>📤 DESPACHO</span>
                        <span className="font-semibold text-slate-900">{step.date}</span>
                        {step.wasDiscountedByPurchase && (
                          <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded font-semibold">🛍️ Compra Interna</span>
                        )}
                      </div>
                      
                      <div className={`bg-white rounded-lg p-4 border-2 ${step.wasDiscountedByPurchase ? 'border-orange-300' : 'border-blue-300'} mb-3`}>
                        {step.wasDiscountedByPurchase ? (
                          <div>
                            <p className="text-sm font-semibold text-orange-700 mb-1">Despacho descontado por compra interna</p>
                            <p className="text-xs text-slate-600">El operario tenía este material despachado y fue descontado como una compra interna. Las unidades se acreditaron como manufactura entregada.</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-slate-700">Se despachó al operario:</p>
                              <p className="text-xl font-bold text-blue-900">+{step.quantity} {step.product}</p>
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
                    <div key={index} className="border-l-4 border-green-500 bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-5 h-5 text-green-600" />
                        <span className="text-xs font-semibold text-green-800 bg-green-200 px-2 py-1 rounded">✅ ENTREGA</span>
                        <span className="font-semibold text-slate-900">{step.date}</span>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border-2 border-green-300 mb-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-slate-700">El operario entregó:</p>
                          <p className="text-lg font-bold text-green-900">+${step.amount.toLocaleString()}</p>
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
                    <div key={index} className="border-l-4 border-pink-500 bg-pink-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-pink-800 bg-pink-200 px-2 py-1 rounded">🛍️ COMPRA PRENDA</span>
                        <span className="font-semibold text-slate-900">{step.date}</span>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">{methodLabel}</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-pink-300 mb-2">
                        <p className="text-sm text-slate-700">{step.description}</p>
                        {isDiscount ? (
                          <p className="text-sm font-bold text-red-600 mt-1">−${step.amount.toLocaleString()} descontado de tu saldo</p>
                        ) : (
                          <p className="text-sm font-bold text-slate-600 mt-1">${step.amount.toLocaleString()} ({methodLabel})</p>
                        )}
                        <p className="text-xs text-green-600 mt-1">✅ Unidades acreditadas como manufactura entregada</p>
                      </div>
                      <div className="bg-slate-100 rounded p-2 text-xs">
                        💰 Saldo después: <span className="font-bold text-orange-600">${step.saldoPendiente.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                }

                if (step.type === 'payment') {
                  return (
                    <div key={index} className="border-l-4 border-purple-500 bg-purple-50 rounded-lg p-4">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-5 h-5 text-purple-600" />
                          <span className="text-xs font-semibold text-purple-800 bg-purple-200 px-2 py-1 rounded">💵 PAGO</span>
                          <span className="font-semibold text-slate-900">{step.date}</span>
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
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-purple-300">
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
                  const isNegative = step.amount < 0;
                  return (
                    <div key={index} className="mt-6">
                      <div className={`bg-gradient-to-r ${isNegative ? 'from-red-500 to-red-600' : 'from-orange-500 to-orange-600'} text-white rounded-lg p-5 mb-3 shadow-lg`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-xl">{isNegative ? '⚠️ Saldo a favor de la empresa' : step.description}</p>
                            {isNegative && <p className="text-sm opacity-80">El empleado debe a la empresa por compra interna</p>}
                          </div>
                          <p className="text-3xl font-bold">{isNegative ? `-$${Math.abs(step.amount).toLocaleString()}` : `$${step.amount.toLocaleString()}`}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <EmployeeTimeline 
              dispatches={data.dispatches}
              deliveries={data.deliveries}
              payments={data.payments}
              purchases={data.purchases}
              getProductName={getProductName}
              pendingAmount={stats.pendingAmount}
            />
          </div>
          <div className="space-y-6">
            <EmployeePendingItems 
              pendingUnits={stats.pendingUnits}
              getProductName={getProductName}
            />
            <EmployeePaymentsSummary 
              payments={data.payments}
            />
          </div>
        </div>
      </main>
    </div>
  );
}