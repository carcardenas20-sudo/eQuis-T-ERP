import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, CheckCircle2, XCircle, Clock, HandCoins } from "lucide-react";
import { format } from "date-fns";

import PaymentForm from "../components/payments/PaymentForm";
import PaymentsHistory from "../components/payments/PaymentsHistory";
import ActivityHistory from "../components/history/ActivityHistory";
import AdvanceForm from "../components/payments/AdvanceForm";
import AdvancesPanel from "../components/payments/AdvancesPanel";
import { ADVANCE_TYPE, DEDUCTION_TYPE, DEDUCTION_STATUS, buildAdvances, splitAllocations, money } from "@/utils/advances";

export default function Payments() {
  const [employees, setEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [allPaymentRequests, setAllPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(null);
  // Anticipos: todos los pagos de operarios (incl. anticipos y cruces) para historial y saldos.
  const [historyPayments, setHistoryPayments] = useState([]);
  const [advanceFormFor, setAdvanceFormFor] = useState(null); // null | {} (sin empleado) | employee
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesData, deliveriesData, paymentsData, purchasesData, requestsData] = await Promise.all([
        base44.entities.Employee.list(),
        base44.entities.Delivery.list(),
        base44.entities.Payment.list('-payment_date'),
        base44.entities.EmployeePurchase.list(),
        base44.entities.PaymentRequest.list('-request_date'),
      ]);
      setAllEmployees(employeesData);
      setEmployees(employeesData.filter(e => e.is_active));
      setDeliveries(deliveriesData);
      // 'descuento_anticipo' cubre entregas (delivery_payments) → cuenta para el pendiente.
      // 'anticipo' NO: no está ligado a entregas; se descuenta con su cruce al liquidar.
      const OPERARIO_PAYMENT_TYPES = new Set(['avance', 'pago_completo', 'solicitud_aprobada', DEDUCTION_TYPE]);
      setPayments(paymentsData.filter(p => p.employee_id && OPERARIO_PAYMENT_TYPES.has(p.payment_type)));
      setHistoryPayments(paymentsData.filter(p => p.employee_id && (OPERARIO_PAYMENT_TYPES.has(p.payment_type) || p.payment_type === ADVANCE_TYPE)));
      setPurchases(purchasesData || []);
      setAllPaymentRequests(requestsData || []);
      setPaymentRequests((requestsData || []).filter(r => r.status === 'pending'));
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
    setLoading(false);
  };

  const getPendingPayments = () => {
    const pending = {};

    employees.forEach(emp => {
      pending[emp.employee_id] = { total: 0, count: 0, deliveries: [] };
    });

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

    // Calcular pendientes por entrega
    deliveries.forEach(delivery => {
      // Skip si está marcada como pagada (status en BD o sistema antiguo)
      if (delivery.status === 'pagado' || paidDeliveryIds.has(delivery.id)) return;
      // Skip entregas generadas automáticamente por compra interna
      if (delivery.notes && delivery.notes.includes('Compra empleado')) return;
      
      const paidAmount = deliveryPaidAmounts[delivery.id] || 0;
      const pendingAmount = (delivery.total_amount || 0) - paidAmount;
      
      // Solo considerar pendiente si el monto es mayor a $100 (evitar residuales)
      if (pendingAmount > 100) {
        if (!pending[delivery.employee_id]) {
          pending[delivery.employee_id] = { total: 0, count: 0, deliveries: [] };
        }
        pending[delivery.employee_id].total += pendingAmount;
        pending[delivery.employee_id].count++;
        pending[delivery.employee_id].deliveries.push({
          ...delivery,
          pending_amount: pendingAmount
        });
      }
    });

    // Aplicar pagos antiguos (sin delivery_payments) cronológicamente a las entregas pendientes
    // Ordenar pagos por fecha (más antiguos primero)
    const oldPayments = payments
      .filter(p => (!p.delivery_payments || p.delivery_payments.length === 0) && 
                   (!p.delivery_ids || p.delivery_ids.length === 0))
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    oldPayments.forEach(payment => {
      const employeePending = pending[payment.employee_id];
      if (!employeePending || !employeePending.deliveries || employeePending.deliveries.length === 0) return;
      
      // Ordenar entregas por fecha (más antiguas primero)
      employeePending.deliveries.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
      
      let remainingPayment = payment.amount;
      
      employeePending.deliveries.forEach(delivery => {
        if (remainingPayment <= 0) return;
        
        const currentPending = delivery.pending_amount || 0;
        const amountToApply = Math.min(remainingPayment, currentPending);
        
        if (amountToApply > 0) {
          delivery.pending_amount -= amountToApply;
          remainingPayment -= amountToApply;
        }
      });
      
      // Recalcular total y filtrar
      employeePending.total = employeePending.deliveries.reduce((sum, d) => sum + (d.pending_amount || 0), 0);
      employeePending.deliveries = employeePending.deliveries.filter(d => (d.pending_amount || 0) > 100);
      employeePending.count = employeePending.deliveries.length;
    });

    // Descontar compras por descuento_saldo del total pendiente de cada empleado
    // Permitir saldo negativo (empleado debe a la empresa)
    purchases
      .filter(p => p.payment_method === 'descuento_saldo')
      .forEach(purchase => {
        if (pending[purchase.employee_id]) {
          pending[purchase.employee_id].total -= purchase.total_amount;
          pending[purchase.employee_id].hasPurchaseDiscount = true;
        }
      });

    return pending;
  };

  const pendingPayments = getPendingPayments();
  const advances = buildAdvances(historyPayments);
  const activeAdvancesOf = (employeeId) => advances.filter(x => !x.settled && x.advance.employee_id === employeeId);
  const activeAdvancesCount = advances.filter(x => !x.settled).length;

  const handleCreatePayment = async (paymentData, deductions = []) => {
    try {
      const employee = employees.find(e => e.employee_id === paymentData.employee_id);
      const employeeName = employee?.name || paymentData.employee_id;
      // Pago con descuento de anticipo = varios registros de una misma liquidación:
      // un cruce por anticipo (sin plata) + el pago a transferir (lo que queda).
      const liquidation_id = deductions.length > 0 ? `liq_${Date.now()}` : undefined;
      const { byAdvance, rest } = splitAllocations(paymentData.delivery_payments, deductions);

      for (const d of byAdvance) {
        if (d.amount <= 0) continue;
        const cruce = await base44.entities.Payment.create({
          employee_id: paymentData.employee_id,
          employee_name: paymentData.employee_name,
          amount: 0,
          deducted_amount: d.amount,
          advance_id: d.advance_id,
          payment_date: paymentData.payment_date,
          payment_type: DEDUCTION_TYPE,
          status: DEDUCTION_STATUS,
          description: `Descuento de anticipo — ${money(d.amount)}`,
          delivery_payments: d.delivery_payments,
          liquidation_id,
        });
        await base44.entities.ActivityLog.create({
          entity_type: 'Payment',
          entity_id: cruce.id,
          action: 'created',
          description: `Descuento de anticipo - ${money(d.amount)}`,
          employee_id: paymentData.employee_id,
          employee_name: employeeName,
          amount: d.amount,
        });
      }

      const newPayment = paymentData.amount > 0.5
        ? await base44.entities.Payment.create({
            ...paymentData,
            delivery_payments: deductions.length > 0 ? rest : paymentData.delivery_payments,
            ...(liquidation_id ? {
              liquidation_id,
              // Para el comprobante: todas las entregas liquidadas y cuánto se cruzó del anticipo.
              liquidated_delivery_payments: paymentData.delivery_payments,
              advance_deducted: byAdvance.reduce((s, d) => s + d.amount, 0),
            } : {}),
            status: 'registrado'
          })
        : null;

      if (newPayment) await base44.entities.ActivityLog.create({
        entity_type: 'Payment',
        entity_id: newPayment.id,
        action: 'created',
        description: `Pago registrado - ${paymentData.payment_type === 'pago_completo' ? 'Pago completo' : 'Avance'} - $${paymentData.amount.toLocaleString()}`,
        employee_id: paymentData.employee_id,
        employee_name: employeeName,
        amount: paymentData.amount,
        new_data: paymentData
      });
      
      const pendingRequests = await base44.entities.PaymentRequest.filter({
        employee_id: paymentData.employee_id,
        status: 'pending'
      });

      if (pendingRequests.length > 0) {
        const colombiaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
        const processedDate = colombiaTime.toISOString().split('T')[0];
        
        const requestUpdates = pendingRequests.map(req =>
          base44.entities.PaymentRequest.update(req.id, {
            status: 'approved',
            processed_date: processedDate,
            admin_response: `Pago de $${paymentData.amount.toLocaleString()} registrado.`
          })
        );
        await Promise.all(requestUpdates);
      }
      
      alert("Pago registrado exitosamente");
      setShowForm(false);
      setSelectedEmployee(null);
      setEditingPayment(null);
      loadData();
    } catch (error) {
      console.error("Error al guardar el pago:", error);
      alert("Hubo un error al guardar el pago.");
    }
  };



  const handleDeletePayment = async (payment) => {
    // Un pago con anticipo descontado son varios registros (pago + cruces): se borran juntos
    // para que las entregas y el saldo del anticipo vuelvan a quedar como estaban.
    const siblings = payment.liquidation_id
      ? historyPayments.filter(p => p.liquidation_id === payment.liquidation_id && p.id !== payment.id)
      : [];
    const extra = siblings.length > 0
      ? '\n\nEste pago tiene un descuento de anticipo: también se eliminará ese descuento y el anticipo volverá a quedar pendiente por ese valor.'
      : payment.payment_type === ADVANCE_TYPE ? '\n\nEs un anticipo.' : '';
    const shown = payment.payment_type === DEDUCTION_TYPE ? payment.deducted_amount : payment.amount;
    if (window.confirm(`¿Estás seguro de eliminar este pago de $${(Number(shown) || 0).toLocaleString()}?${extra}`)) {
      try {
        const employee = employees.find(e => e.employee_id === payment.employee_id);
        
        await base44.entities.Payment.delete(payment.id);
        for (const sib of siblings) await base44.entities.Payment.delete(sib.id);

        await base44.entities.ActivityLog.create({
          entity_type: 'Payment',
          entity_id: payment.id,
          action: 'deleted',
          description: `Pago eliminado - $${payment.amount.toLocaleString()}`,
          employee_id: payment.employee_id,
          employee_name: employee?.name || payment.employee_id,
          amount: payment.amount,
          previous_data: payment
        });
        
        alert("Pago eliminado correctamente");
        loadData();
      } catch (error) {
        console.error("Error al eliminar el pago:", error);
        alert("Error al eliminar el pago.");
      }
    }
  };

  const handleCreateAdvance = async (data) => {
    setSavingAdvance(true);
    try {
      const adv = await base44.entities.Payment.create(data);
      await base44.entities.ActivityLog.create({
        entity_type: 'Payment',
        entity_id: adv.id,
        action: 'created',
        description: `Anticipo registrado - ${money(data.amount)}${data.advance_reason ? ` (${data.advance_reason})` : ''}`,
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        amount: data.amount,
        new_data: data,
      });
      setAdvanceFormFor(null);
      setActiveTab('advances');
      await loadData();
      alert(`Anticipo registrado. Quedó en Transferencias bancarias para transferir ${money(data.amount)}.`);
    } catch (err) {
      console.error(err);
      alert('No se pudo registrar el anticipo.');
    }
    setSavingAdvance(false);
  };

  const handleDeleteAdvance = async (item) => {
    const a = item.advance;
    if (item.deductions.length > 0) {
      alert('Este anticipo ya tiene descuentos aplicados. Para anularlo, elimina primero esos pagos desde el Historial.');
      return;
    }
    const warn = item.transferred ? '\n\nOJO: ya fue marcado como transferido.' : '';
    if (!window.confirm(`¿Anular el anticipo de ${money(a.amount)} a ${a.employee_name}?${warn}`)) return;
    try {
      await base44.entities.Payment.delete(a.id);
      await base44.entities.ActivityLog.create({
        entity_type: 'Payment',
        entity_id: a.id,
        action: 'deleted',
        description: `Anticipo anulado - ${money(a.amount)}`,
        employee_id: a.employee_id,
        employee_name: a.employee_name,
        amount: a.amount,
        previous_data: a,
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert('No se pudo anular el anticipo.');
    }
  };

  const openPaymentForm = (employee) => {
    setSelectedEmployee(employee);
    setEditingPayment(null);
    setShowForm(true);
  };

  const handleApproveRequest = async (request) => {
    if (!window.confirm(`¿Aprobar solicitud de $${request.requested_amount?.toLocaleString()} para ${request.employee_name}?`)) return;
    setProcessingRequest(request.id);
    try {
      const colombiaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      const todayStr = colombiaTime.toISOString().split('T')[0];

      // Distribuir el monto aprobado entre las entregas pendientes más antiguas
      const empPending = pendingPayments[request.employee_id];
      const sortedDeliveries = [...(empPending?.deliveries || [])]
        .sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));

      let remaining = request.requested_amount;
      const deliveryPayments = [];
      for (const delivery of sortedDeliveries) {
        if (remaining <= 0) break;
        const toApply = Math.min(remaining, delivery.pending_amount);
        if (toApply > 0) {
          deliveryPayments.push({ delivery_id: delivery.id, amount: toApply });
          remaining -= toApply;
        }
      }

      // Crear el pago vinculado a las entregas que cubre
      await base44.entities.Payment.create({
        employee_id: request.employee_id,
        employee_name: request.employee_name,
        amount: request.requested_amount,
        payment_date: todayStr,
        payment_type: 'solicitud_aprobada',
        status: 'registrado',
        description: `Solicitud aprobada — ${request.employee_name}`,
        delivery_payments: deliveryPayments,
      });

      // Marcar la solicitud como aprobada
      await base44.entities.PaymentRequest.update(request.id, {
        status: 'approved',
        processed_date: todayStr,
        admin_response: `Aprobado. Pago de $${request.requested_amount?.toLocaleString()} registrado.`,
      });

      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al aprobar la solicitud.');
    }
    setProcessingRequest(null);
  };

  const handleRejectRequest = async (request) => {
    const reason = window.prompt(`Motivo de rechazo para ${request.employee_name} (opcional):`);
    if (reason === null) return; // cancelado
    setProcessingRequest(request.id);
    try {
      const colombiaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      await base44.entities.PaymentRequest.update(request.id, {
        status: 'rejected',
        processed_date: colombiaTime.toISOString().split('T')[0],
        admin_response: reason || 'Rechazado por administrador.',
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al rechazar la solicitud.');
    }
    setProcessingRequest(null);
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Pagos a Empleados</h1>
          <p className="text-slate-600 text-sm sm:text-base">Gestión de pagos por entregas de producción.</p>
        </div>

        {advanceFormFor ? (
          <AdvanceForm
            employees={employees}
            employee={advanceFormFor.employee_id ? advanceFormFor : null}
            saving={savingAdvance}
            onSubmit={handleCreateAdvance}
            onCancel={() => setAdvanceFormFor(null)}
          />
        ) : showForm ? (
          <PaymentForm
            employee={selectedEmployee}
            payment={editingPayment}
            pendingDeliveries={pendingPayments[selectedEmployee?.employee_id]?.deliveries || []}
            advances={activeAdvancesOf(selectedEmployee?.employee_id)}
            onSubmit={handleCreatePayment}
            onCancel={() => {
              setShowForm(false);
              setSelectedEmployee(null);
              setEditingPayment(null);
            }}
          />
        ) : (
          <>
            <Tabs value={activeTab || (paymentRequests.length > 0 ? "requests" : "pending")} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="requests" className="text-xs sm:text-sm relative">
                  Solicitudes
                  {paymentRequests.length > 0 && (
                    <span className="ml-1 bg-red-500 text-white rounded-full text-xs px-1.5 py-0 font-bold">{paymentRequests.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs sm:text-sm">Pendientes</TabsTrigger>
                <TabsTrigger value="advances" className="text-xs sm:text-sm">
                  Anticipos
                  {activeAdvancesCount > 0 && (
                    <span className="ml-1 bg-amber-500 text-white rounded-full text-xs px-1.5 py-0 font-bold">{activeAdvancesCount}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs sm:text-sm">Cambios</TabsTrigger>
              </TabsList>

              <TabsContent value="requests">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      Solicitudes de Pago Pendientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {paymentRequests.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No hay solicitudes pendientes.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paymentRequests.map(req => {
                          const lastPayment = payments.find(p => p.employee_id === req.employee_id && p.payment_type !== DEDUCTION_TYPE);
                          return (
                          <div key={req.id} className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900">{req.employee_name}</p>
                              <p className="text-xs text-slate-500">ID: {req.employee_id} · Solicitó el {req.request_date}</p>
                              <p className="text-xl font-bold text-blue-700 mt-1">${req.requested_amount?.toLocaleString()}</p>
                              {lastPayment ? (
                                <p className="text-xs text-emerald-600 mt-1">
                                  Último pago: {format(new Date(lastPayment.payment_date + 'T00:00:00'), 'dd/MM/yy')} · ${lastPayment.amount.toLocaleString()}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-1">Sin pagos anteriores</p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={processingRequest === req.id}
                                onClick={() => handleApproveRequest(req)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50"
                                disabled={processingRequest === req.id}
                                onClick={() => handleRejectRequest(req)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Rechazar
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-orange-600" />
                      Pagos Pendientes por Empleado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                {Object.keys(pendingPayments).some(id => pendingPayments[id].total !== 0) ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {employees
                      .filter(emp => pendingPayments[emp.employee_id] && pendingPayments[emp.employee_id].total !== 0)
                      .map(employee => {
                        const pending = pendingPayments[employee.employee_id];
                        const lastPayment = payments.find(p => p.employee_id === employee.employee_id && p.payment_type !== DEDUCTION_TYPE);
                        const lastRequest = allPaymentRequests.find(r => r.employee_id === employee.employee_id);
                        return (
                          <Card key={employee.id} className="border-slate-200 flex flex-col">
                            <CardContent className="p-6 flex-1">
                              <h3 className="font-bold text-slate-900 text-lg mb-1">{employee.name}</h3>
                              <p className="text-sm text-slate-600 mb-1">ID: {employee.employee_id}</p>
                              <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                                {lastRequest ? (
                                  <p>Última sol.: {lastRequest.request_date} · ${lastRequest.requested_amount?.toLocaleString()}</p>
                                ) : (
                                  <p>Sin solicitudes previas</p>
                                )}
                                {lastPayment ? (
                                  <p className="text-emerald-600">Último pago: {format(new Date(lastPayment.payment_date + 'T00:00:00'), 'dd/MM/yy')} · ${lastPayment.amount.toLocaleString()}</p>
                                ) : (
                                  <p>Sin pagos anteriores</p>
                                )}
                              </div>
                              
                              <div className={`text-center p-4 rounded-lg mb-4 ${pending.total < 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                                <p className={`text-sm ${pending.total < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                                  {pending.total < 0 ? 'Saldo a favor de la empresa' : 'Monto Pendiente'}
                                </p>
                                <p className={`text-2xl font-bold ${pending.total < 0 ? 'text-red-800' : 'text-orange-800'}`}>
                                  {pending.total < 0 ? `-$${Math.abs(pending.total).toLocaleString()}` : `$${pending.total.toLocaleString()}`}
                                </p>
                                <p className={`text-xs ${pending.total < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                  {pending.total < 0 ? 'Compra interna descuenta del saldo' : `Basado en ${pending.count} entregas pendientes`}
                                </p>
                              </div>
                              {(() => {
                                const owed = activeAdvancesOf(employee.employee_id).reduce((s, x) => s + x.balance, 0);
                                if (owed <= 0) return null;
                                return (
                                  <div className="-mt-2 mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex justify-between">
                                    <span>💸 Anticipo por descontar</span>
                                    <b className="tabular-nums">{money(owed)}</b>
                                  </div>
                                );
                              })()}
                            </CardContent>
                            {pending.total > 0 && (
                              <div className="p-4 bg-slate-50 border-t">
                                <Button 
                                  className="w-full bg-blue-600 hover:bg-blue-700"
                                  onClick={() => openPaymentForm(employee)}
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Registrar Pago
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full mt-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                  onClick={() => setAdvanceFormFor(employee)}
                                >
                                  <HandCoins className="w-4 h-4 mr-1" /> Dar anticipo
                                </Button>
                              </div>
                            )}
                          </Card>
                        );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>No hay pagos pendientes en este momento.</p>
                  </div>
                )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="advances">
                <AdvancesPanel
                  advances={advances}
                  onNew={() => setAdvanceFormFor({})}
                  onDelete={handleDeleteAdvance}
                />
              </TabsContent>

              <TabsContent value="history">
                <PaymentsHistory
                  payments={historyPayments}
                  employees={allEmployees}
                  paymentRequests={allPaymentRequests}
                  onDelete={handleDeletePayment}
                />
              </TabsContent>

              <TabsContent value="activity">
                <ActivityHistory entityType="Payment" />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}