import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, CreditCard } from "lucide-react";
import { format } from 'date-fns';
import { suggestedDeduction, money, fmtDay } from "@/utils/advances";

const getColombiaTodayString = () => {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombiaTime.toISOString().split('T')[0];
};

const formatDateColombia = (dateString) => {
  const date = new Date(dateString + 'T00:00:00');
  return format(date, 'yyyy-MM-dd');
};

export default function PaymentForm({ employee, payment, pendingDeliveries, advances = [], onSubmit, onCancel }) {
  // Filtrar solo entregas con saldo pendiente real > $100
  const validPendingDeliveries = pendingDeliveries.filter(d => {
    const pending = d.pending_amount || 0;
    return pending > 100; // Evitar valores residuales o ya pagados
  });

  const [deliveryAmounts, setDeliveryAmounts] = useState({});
  const [description, setDescription] = useState(payment ? payment.description : "");
  const [paymentDate, setPaymentDate] = useState(
    payment ? formatDateColombia(payment.payment_date) : getColombiaTodayString()
  );

  const handleAmountChange = (deliveryId, value) => {
    const delivery = validPendingDeliveries.find(d => d.id === deliveryId);
    const maxAmt = delivery ? (delivery.pending_amount || 0) : 0;
    const numValue = Math.min(parseFloat(value) || 0, maxAmt);
    setDeliveryAmounts(prev => ({
      ...prev,
      [deliveryId]: numValue
    }));
  };

  const getTotalAmount = () => {
    return Object.values(deliveryAmounts).reduce((sum, amt) => sum + amt, 0);
  };

  const payAllPending = () => {
    setDeliveryAmounts(Object.fromEntries(validPendingDeliveries.map(d => [d.id, d.pending_amount || 0])));
  };

  // ── Anticipos por descontar ──────────────────────────────────────────────
  // Por defecto se propone el descuento de cada anticipo (todo o la cuota), sin
  // pasarse de lo que se está liquidando. El usuario puede quitarlo o cambiar el valor.
  const [skipAdvance, setSkipAdvance] = useState({});   // advance_id -> true (no descontar)
  const [editedAdvance, setEditedAdvance] = useState({}); // advance_id -> valor escrito
  const getDeductions = () => {
    let available = getTotalAmount();
    return advances.map(item => {
      const id = item.advance.id;
      let amount = 0;
      if (!skipAdvance[id]) {
        const wanted = editedAdvance[id] !== undefined
          ? Math.max(0, Math.min(Number(editedAdvance[id]) || 0, item.balance))
          : suggestedDeduction(item, available);
        amount = Math.min(wanted, available);
      }
      available -= amount;
      return { item, advance_id: id, amount };
    });
  };
  const deductions = getDeductions();
  const totalDeducted = deductions.reduce((s, d) => s + d.amount, 0);
  const toTransfer = getTotalAmount() - totalDeducted;

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalAmount = getTotalAmount();
    
    if (totalAmount <= 0) {
      alert("Debes asignar al menos un monto a una entrega.");
      return;
    }

    // Validar que ningún monto supere el pendiente real de cada entrega
    for (const [delivery_id, amount] of Object.entries(deliveryAmounts)) {
      if (amount <= 0) continue;
      const delivery = validPendingDeliveries.find(d => d.id === delivery_id);
      if (delivery && amount > (delivery.pending_amount || 0)) {
        alert(`El monto ingresado ($${amount.toLocaleString()}) supera el pendiente de la entrega ($${(delivery.pending_amount || 0).toLocaleString()}).`);
        return;
      }
    }

    const deliveryPayments = Object.entries(deliveryAmounts)
      .filter(([_, amount]) => amount > 0)
      .map(([delivery_id, amount]) => ({ delivery_id, amount }));

    const finalPaymentData = {
      employee_id: employee.employee_id,
      employee_name: employee.name,
      amount: totalAmount,
      payment_date: paymentDate,
      payment_type: 'avance',
      description: description || `Pago de $${totalAmount.toLocaleString()}`,
      delivery_payments: deliveryPayments
    };

    const finalDeductions = deductions
      .filter(d => d.amount > 0)
      .map(d => ({ advance_id: d.advance_id, amount: d.amount }));
    if (finalDeductions.length > 0) {
      finalPaymentData.amount = totalAmount - totalDeducted;
      finalPaymentData.description = description || `Pago de ${money(totalAmount)} (−${money(totalDeducted)} anticipo)`;
    }
    onSubmit(finalPaymentData, finalDeductions);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Registrar Pago para {employee.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Asignar Montos a Entregas</CardTitle>
                  <p className="text-sm text-slate-500">Indica cuánto pagas de cada entrega (puede ser parcial o total).</p>
                </div>
                {validPendingDeliveries.length > 0 && (
                  <Button type="button" size="sm" variant="outline" onClick={payAllPending} className="shrink-0">
                    Pagar todo lo pendiente
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {validPendingDeliveries.length > 0 ? validPendingDeliveries.map(delivery => {
                const pendingAmt = delivery.pending_amount || delivery.total_amount;
                return (
                  <div key={delivery.id} className="p-3 bg-slate-50 rounded-lg border">
                    <div className="mb-2">
                      <p className="font-medium text-sm">{format(new Date(delivery.delivery_date + 'T00:00:00'), 'dd/MM/yyyy')} - {delivery.quantity} unidades</p>
                      <p className="text-xs text-orange-600 font-medium">Pendiente: ${pendingAmt.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`amount-${delivery.id}`} className="text-sm min-w-[60px]">Pagar:</Label>
                      <Input
                        id={`amount-${delivery.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max={pendingAmt}
                        value={deliveryAmounts[delivery.id] || ''}
                        onChange={(e) => handleAmountChange(delivery.id, e.target.value)}
                        placeholder="0"
                        className="flex-1"
                      />
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-center text-slate-500 py-4">No hay entregas pendientes.</p>}
            </CardContent>
          </Card>

          {advances.length > 0 && (
            <div className="p-4 rounded-lg border-2 border-amber-300 bg-amber-50 space-y-3">
              <p className="font-semibold text-amber-900 text-sm">💸 Anticipos por descontar</p>
              {deductions.map(({ item, advance_id, amount }) => {
                const a = item.advance;
                return (
                  <div key={advance_id} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-white rounded-lg p-3 border border-amber-200">
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!skipAdvance[advance_id]}
                        onChange={e => setSkipAdvance(v => ({ ...v, [advance_id]: !e.target.checked }))}
                      />
                      <span>
                        Anticipo del {fmtDay(a.payment_date)}{a.advance_reason ? ` (${a.advance_reason})` : ''}
                        <span className="block text-xs text-slate-500">
                          Falta {money(item.balance)} de {money(a.amount)}
                          {a.advance_mode === 'cuotas' && Number(a.advance_installment) > 0 ? ` · cuota ${money(a.advance_installment)}` : ' · todo en este pago'}
                        </span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Descontar:</span>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        disabled={!!skipAdvance[advance_id]}
                        value={editedAdvance[advance_id] !== undefined ? editedAdvance[advance_id] : Math.round(amount)}
                        onChange={e => setEditedAdvance(v => ({ ...v, [advance_id]: e.target.value }))}
                        className="w-32"
                      />
                      {editedAdvance[advance_id] !== undefined && !skipAdvance[advance_id] && Number(editedAdvance[advance_id]) > amount && (
                        <span className="text-[11px] text-red-600">máx. {money(amount)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {getTotalAmount() <= 0 && (
                <p className="text-xs text-amber-800">Asigna primero los montos a las entregas (o usa "Pagar todo lo pendiente").</p>
              )}
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg space-y-1">
            {totalDeducted > 0 ? (
              <>
                <div className="flex justify-between text-sm text-slate-700">
                  <span>Entregas que se liquidan</span><span className="tabular-nums">{money(getTotalAmount())}</span>
                </div>
                <div className="flex justify-between text-sm text-amber-700">
                  <span>Menos anticipo</span><span className="tabular-nums">−{money(totalDeducted)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-blue-200">
                  <span className="font-medium text-blue-900">A transferir:</span>
                  <span className="text-2xl font-bold text-blue-900 tabular-nums">{money(toTransfer)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center">
                <span className="font-medium text-blue-900">Total del Pago:</span>
                <span className="text-2xl font-bold text-blue-900">${getTotalAmount().toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_date">Fecha de Pago *</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del pago..."
              className="h-20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Registrar Pago
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}