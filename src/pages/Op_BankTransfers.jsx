import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, CreditCard, Filter } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import PaymentVoucher from "@/components/payments/PaymentVoucher";

export default function BankTransfers() {
  const [payments, setPayments] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [paymentsData, deliveriesData, employeesData, productsData] = await Promise.all([
        base44.entities.Payment.list('-payment_date'),
        base44.entities.Delivery.list(),
        base44.entities.Employee.list(),
        base44.entities.Producto.list(),
      ]);
      setPayments(paymentsData);
      setDeliveries(deliveriesData);
      setEmployees(employeesData);
      setProducts((productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
    setLoading(false);
  };

  const getLastDeliveryDate = (payment) => {
    // Primero: entregas explícitamente asociadas (sistema nuevo)
    if (payment.delivery_payments && payment.delivery_payments.length > 0) {
      const deliveriesForPayment = deliveries.filter(d => 
        payment.delivery_payments.some(dp => dp.delivery_id === d.id)
      );
      if (deliveriesForPayment.length > 0) {
        const dates = deliveriesForPayment.map(d => new Date(d.delivery_date));
        return new Date(Math.max(...dates));
      }
    }

    // Segundo: entregas por ID (sistema antiguo)
    if (payment.delivery_ids && payment.delivery_ids.length > 0) {
      const deliveriesForPayment = deliveries.filter(d => 
        payment.delivery_ids.includes(d.id)
      );
      if (deliveriesForPayment.length > 0) {
        const dates = deliveriesForPayment.map(d => new Date(d.delivery_date));
        return new Date(Math.max(...dates));
      }
    }

    // Tercero: todas las entregas del empleado hasta la fecha del pago
    const empDeliveries = deliveries.filter(d => 
      d.employee_id === payment.employee_id && 
      new Date(d.delivery_date) <= new Date(payment.payment_date)
    );
    
    if (empDeliveries.length > 0) {
      const dates = empDeliveries.map(d => new Date(d.delivery_date));
      return new Date(Math.max(...dates));
    }

    return null;
  };

  const getDeadline = (payment) => {
    const lastDelivery = getLastDeliveryDate(payment);
    if (!lastDelivery) return null;
    return addDays(lastDelivery, 12);
  };

  const getDaysUntilDeadline = (payment) => {
    const deadline = getDeadline(payment);
    if (!deadline) return null;
    return differenceInDays(deadline, new Date());
  };

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.employee_id === employeeId);
    return emp ? emp.name : employeeId;
  };

  // Abonos parciales de transferencia (guardados en data.transfer_payments).
  const getAbonos = (p) => (Array.isArray(p.transfer_payments) ? p.transfer_payments : []);
  const getPaid = (p) => getAbonos(p).reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const getRemaining = (p) => Math.max(0, (Number(p.amount) || 0) - getPaid(p));

  // Registrar un abono parcial (se transfirió una parte). Si con este abono se
  // completa el total, el pago pasa a "ejecutado" automáticamente.
  const handleRegisterPartial = async (payment) => {
    const remaining = getRemaining(payment);
    const raw = window.prompt(
      `Abono a ${getEmployeeName(payment.employee_id)}\n` +
      `Total: $${(Number(payment.amount) || 0).toLocaleString()}  ·  Ya abonado: $${getPaid(payment).toLocaleString()}  ·  Falta: $${remaining.toLocaleString()}\n\n` +
      `¿Cuánto se transfirió ahora?`,
      String(remaining)
    );
    if (raw === null) return;
    const amount = Math.round(Number(String(raw).replace(/[^0-9.-]/g, '')) || 0);
    if (amount <= 0) { alert('Ingresa un monto válido.'); return; }
    if (amount > remaining) { alert(`El abono no puede superar lo que falta ($${remaining.toLocaleString()}).`); return; }
    const note = window.prompt('Nota del abono (opcional):', '');
    if (note === null) return;
    const nowIso = new Date().toISOString();
    const transfer_payments = [...getAbonos(payment), { amount, date: nowIso, note: note || '' }];
    const paid = transfer_payments.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const fully = paid >= (Number(payment.amount) || 0) - 0.5;
    try {
      await base44.entities.Payment.update(payment.id, {
        transfer_payments,
        status: fully ? 'ejecutado' : 'registrado',
        ...(fully ? { transfer_executed_date: nowIso } : {}),
      });
      loadData();
    } catch (error) {
      console.error('Error registrando abono:', error);
      alert('No se pudo registrar el abono.');
    }
  };

  // Marcar como ejecutado = pagar de una vez lo que falte (o el total). Registra
  // el saldo restante como un abono para que el historial y los totales cuadren.
  const handleMarkAsExecuted = async (payment) => {
    const remaining = getRemaining(payment);
    const paid = getPaid(payment);
    const msg = paid > 0
      ? `¿Marcar como ejecutado? Se registrará el saldo restante ($${remaining.toLocaleString()}) como transferido.`
      : `¿Marcar como ejecutado (pago completo $${(Number(payment.amount) || 0).toLocaleString()})?`;
    if (!window.confirm(msg)) return;
    const nowIso = new Date().toISOString();
    const transfer_payments = remaining > 0
      ? [...getAbonos(payment), { amount: remaining, date: nowIso, note: paid > 0 ? 'Saldo restante' : 'Pago completo' }]
      : getAbonos(payment);
    try {
      await base44.entities.Payment.update(payment.id, {
        status: 'ejecutado',
        transfer_executed_date: nowIso,
        transfer_payments,
      });
      loadData();
    } catch (error) {
      console.error("Error actualizando pago:", error);
      alert('Error actualizando el pago.');
    }
  };

  // Bloque visual con el avance de abonos (solo si hay parciales reales).
  const renderPartial = (payment) => {
    const paid = getPaid(payment);
    const remaining = getRemaining(payment);
    const abonos = getAbonos(payment);
    if (paid <= 0) return null;
    if (remaining <= 0 && abonos.length <= 1) return null; // pago completo simple
    const total = Number(payment.amount) || 0;
    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    return (
      <div className="mt-3 bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex justify-between text-xs sm:text-sm mb-1">
          <span className="text-emerald-700 font-semibold">Abonado ${paid.toLocaleString()}</span>
          {remaining > 0 && <span className="text-red-600 font-semibold">Falta ${remaining.toLocaleString()}</span>}
        </div>
        <div className="h-2 bg-slate-200 rounded overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: pct + '%' }} />
        </div>
        <div className="mt-2 space-y-0.5">
          {abonos.map((a, i) => (
            <p key={i} className="text-[11px] text-slate-500">
              • ${Number(a.amount || 0).toLocaleString()} · {(() => { try { return format(new Date(a.date), 'dd/MM/yy'); } catch { return ''; } })()}{a.note ? ` — ${a.note}` : ''}
            </p>
          ))}
        </div>
      </div>
    );
  };

  const pendingTransfers = payments.filter(p => p.status === 'registrado');
  const executedPayments = payments.filter(p => p.status === 'ejecutado');

  const sumAmount = (list) => list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const sumRemaining = (list) => list.reduce((s, p) => s + getRemaining(p), 0);
  const sumPaid = (list) => list.reduce((s, p) => s + getPaid(p), 0);
  const executedTotal = sumAmount(executedPayments);

  const pendingWithDeadline = pendingTransfers.map(p => ({
    ...p,
    lastDelivery: getLastDeliveryDate(p),
    deadline: getDeadline(p),
    daysUntil: getDaysUntilDeadline(p)
  })).filter(p => p.deadline);

  // Filtrar por fecha si hay un filtro activo
  const filtered = filterDate 
    ? pendingWithDeadline.filter(p => format(p.lastDelivery, 'yyyy-MM-dd') === format(filterDate, 'yyyy-MM-dd'))
    : pendingWithDeadline;

  const overdue = filtered.filter(p => p.daysUntil < 0);
  const dueThis = filtered.filter(p => p.daysUntil >= 0 && p.daysUntil <= 2);
  const future = filtered.filter(p => p.daysUntil > 2);

  // Total en tránsito = lo que FALTA por transferir (no el monto completo), para
  // reflejar los pagos parciales. También expongo cuánto se ha abonado ya.
  const pendingBase = filterDate ? filtered : pendingTransfers;
  const pendingTotal = sumRemaining(pendingBase);
  const pendingPaid = sumPaid(pendingBase);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            Gestión de Transferencias Bancarias
          </h1>
          <p className="text-sm sm:text-base text-slate-600">Seguimiento de pagos registrados pendientes de transferencia. Plazo: 12 días desde la última entrega.</p>
          
          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {filterDate ? `Filtrar por: ${format(filterDate, 'dd/MM/yyyy')}` : 'Filtrar por fecha de entrega'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterDate}
                  onSelect={setFilterDate}
                />
                {filterDate && (
                  <div className="p-3 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setFilterDate(null)}
                    >
                      Limpiar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {filterDate && (
              <span className="text-sm text-slate-600">
                Mostrando {filtered.length} pago{filtered.length !== 1 ? 's' : ''} del {format(filterDate, 'dd/MM/yyyy')}
              </span>
            )}
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="pending" className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">En Tránsito</span> <span className="sm:hidden">Tránsito</span> ({pendingTransfers.length})
            </TabsTrigger>
            <TabsTrigger value="executed" className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              Ejecutados ({executedPayments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {(filterDate ? filtered.length > 0 : pendingTransfers.length > 0) && (
              <Card className="mb-4 border-blue-200 bg-blue-50">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs sm:text-sm text-blue-700 font-medium">
                      Falta por transferir{filterDate ? ` (${format(filterDate, 'dd/MM/yyyy')})` : ''}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-800 tabular-nums">${pendingTotal.toLocaleString()}</p>
                    {pendingPaid > 0 && (
                      <p className="text-xs text-emerald-700 mt-0.5">Ya abonado (parciales): ${pendingPaid.toLocaleString()}</p>
                    )}
                  </div>
                  <Badge className="bg-blue-600 text-white text-xs sm:text-sm">
                    {(filterDate ? filtered.length : pendingTransfers.length)} pago{(filterDate ? filtered.length : pendingTransfers.length) !== 1 ? 's' : ''}
                  </Badge>
                </CardContent>
              </Card>
            )}
            {filtered.length === 0 && pendingTransfers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-slate-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No hay pagos pendientes de transferencia en este momento.</p>
                </CardContent>
              </Card>
            ) : filtered.length === 0 && filterDate ? (
              <Card>
                <CardContent className="text-center py-12 text-slate-500">
                  <Filter className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No hay pagos registrados con entregas del {format(filterDate, 'dd/MM/yyyy')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* VENCIDOS */}
                {overdue.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <h2 className="text-lg font-bold text-red-700">⚠️ VENCIDOS ({overdue.length})</h2>
                    </div>
                    <div className="space-y-3">
                       {overdue.map(payment => (
                         <Card key={payment.id} className="border-red-300 bg-red-50">
                           <CardContent className="p-4 sm:p-6">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0 mb-4">
                               <div className="min-w-0">
                                 <h3 className="font-bold text-base sm:text-lg text-slate-900">{getEmployeeName(payment.employee_id)}</h3>
                                 <p className="text-xs sm:text-sm text-slate-600">Registro: {format(new Date(payment.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="sm:text-right">
                                 <p className="text-2xl sm:text-3xl font-bold text-red-600">${payment.amount.toLocaleString()}</p>
                               </div>
                             </div>

                             <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white p-3 sm:p-4 rounded-lg border border-red-200 mb-4">
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Última Entrega</p>
                                 <p className="font-bold text-xs sm:text-sm text-slate-900">{format(payment.lastDelivery, 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Plazo Vencía</p>
                                 <p className="font-bold text-xs sm:text-sm text-red-700">{format(payment.deadline, 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Días Atrasado</p>
                                 <p className="font-bold text-xs sm:text-sm text-red-700">{Math.abs(payment.daysUntil)} días</p>
                               </div>
                             </div>

                            {renderPartial(payment)}
                            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                              <Button
                                variant="outline"
                                onClick={() => handleRegisterPartial(payment)}
                                className="w-full sm:flex-1 text-sm border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                Abono parcial
                              </Button>
                              <Button
                                onClick={() => handleMarkAsExecuted(payment)}
                                className="w-full sm:flex-1 text-sm bg-red-600 hover:bg-red-700 text-white"
                              >
                                {getPaid(payment) > 0 ? 'Saldar y ejecutar' : 'Marcar como Ejecutado'}
                              </Button>
                              <div className="w-full sm:w-auto"><PaymentVoucher payment={payment} deliveries={deliveries} products={products} employeeName={getEmployeeName(payment.employee_id)} /></div>
                            </div>
                            </CardContent>
                            </Card>
                            ))}
                            </div>
                            </div>
                            )}

                            {/* PRÓXIMOS A VENCER */}
                {dueThis.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-bold text-amber-700">🔔 PRÓXIMOS A VENCER ({dueThis.length})</h2>
                    </div>
                    <div className="space-y-3">
                       {dueThis.map(payment => (
                         <Card key={payment.id} className="border-amber-300 bg-amber-50">
                           <CardContent className="p-4 sm:p-6">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0 mb-4">
                               <div className="min-w-0">
                                 <h3 className="font-bold text-base sm:text-lg text-slate-900">{getEmployeeName(payment.employee_id)}</h3>
                                 <p className="text-xs sm:text-sm text-slate-600">Registro: {format(new Date(payment.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="sm:text-right">
                                 <p className="text-2xl sm:text-3xl font-bold text-amber-600">${payment.amount.toLocaleString()}</p>
                               </div>
                             </div>

                             <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white p-3 sm:p-4 rounded-lg border border-amber-200 mb-4">
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Última Entrega</p>
                                 <p className="font-bold text-xs sm:text-sm text-slate-900">{format(payment.lastDelivery, 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Plazo Vence</p>
                                 <p className="font-bold text-xs sm:text-sm text-amber-700">{format(payment.deadline, 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Faltan</p>
                                 <p className="font-bold text-xs sm:text-sm text-amber-700">{payment.daysUntil} día{payment.daysUntil !== 1 ? 's' : ''}</p>
                               </div>
                             </div>

                            {renderPartial(payment)}
                            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                              <Button
                                variant="outline"
                                onClick={() => handleRegisterPartial(payment)}
                                className="w-full sm:flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                Abono parcial
                              </Button>
                              <Button
                                onClick={() => handleMarkAsExecuted(payment)}
                                className="w-full sm:flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                {getPaid(payment) > 0 ? 'Saldar y ejecutar' : 'Marcar como Ejecutado'}
                              </Button>
                              <div className="w-full sm:w-auto"><PaymentVoucher payment={payment} deliveries={deliveries} products={products} employeeName={getEmployeeName(payment.employee_id)} /></div>
                            </div>
                            </CardContent>
                            </Card>
                            ))}
                            </div>
                            </div>
                            )}

                            {/* FUTUROS */}
                {future.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-slate-700 mb-4">📅 Próximos Pagos ({future.length})</h2>
                    <div className="space-y-3">
                       {future.map(payment => (
                         <Card key={payment.id} className="border-slate-200">
                           <CardContent className="p-4 sm:p-6">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0 mb-4">
                               <div className="min-w-0">
                                 <h3 className="font-bold text-base sm:text-lg text-slate-900">{getEmployeeName(payment.employee_id)}</h3>
                                 <p className="text-xs sm:text-sm text-slate-600">Registro: {format(new Date(payment.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="sm:text-right">
                                 <p className="text-2xl sm:text-3xl font-bold text-blue-600">${payment.amount.toLocaleString()}</p>
                               </div>
                             </div>

                             <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 mb-4">
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Última Entrega</p>
                                 <p className="font-bold text-xs sm:text-sm text-slate-900">{format(payment.lastDelivery, 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Plazo Vence</p>
                                 <p className="font-bold text-xs sm:text-sm text-slate-900">{format(payment.deadline, 'dd/MM/yyyy')}</p>
                               </div>
                               <div className="text-center sm:text-left">
                                 <p className="text-xs text-slate-600 mb-1">Faltan</p>
                                 <p className="font-bold text-xs sm:text-sm text-slate-900">{payment.daysUntil} días</p>
                               </div>
                             </div>

                            {renderPartial(payment)}
                            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                              <Button
                                variant="outline"
                                onClick={() => handleRegisterPartial(payment)}
                                className="w-full sm:flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                Abono parcial
                              </Button>
                              <Button
                                onClick={() => handleMarkAsExecuted(payment)}
                                variant="outline"
                                className="w-full sm:flex-1"
                              >
                                {getPaid(payment) > 0 ? 'Saldar y ejecutar' : 'Marcar como Ejecutado'}
                              </Button>
                              <div className="w-full sm:w-auto"><PaymentVoucher payment={payment} deliveries={deliveries} products={products} employeeName={getEmployeeName(payment.employee_id)} /></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="executed">
            {executedPayments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No hay pagos ejecutados aún.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm text-green-700 font-medium">Total ejecutado</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-800 tabular-nums">${executedTotal.toLocaleString()}</p>
                    </div>
                    <Badge className="bg-green-600 text-white text-xs sm:text-sm">
                      {executedPayments.length} pago{executedPayments.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardContent>
                </Card>
                {executedPayments.map(payment => (
                  <Card key={payment.id} className="border-green-200 bg-green-50">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
                        <div className="min-w-0">
                          <h3 className="font-bold text-base sm:text-lg text-slate-900">{getEmployeeName(payment.employee_id)}</h3>
                          <p className="text-xs sm:text-sm text-slate-600">Fecha: {format(new Date(payment.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="sm:text-right flex flex-col items-end gap-2">
                          <p className="text-xl sm:text-2xl font-bold text-green-600">${payment.amount.toLocaleString()}</p>
                          <Badge className="bg-green-600 text-white text-xs">✓ Ejecutado</Badge>
                          <PaymentVoucher payment={payment} deliveries={deliveries} products={products} employeeName={getEmployeeName(payment.employee_id)} />
                        </div>
                      </div>
                      {getAbonos(payment).length > 1 && renderPartial(payment)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}