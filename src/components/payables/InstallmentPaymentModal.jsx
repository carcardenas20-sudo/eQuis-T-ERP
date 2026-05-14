import React, { useEffect, useMemo, useState } from "react";
import { PayableInstallment } from "@/entities/PayableInstallment";
import { PayablePayment, Expense, BankAccount } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, DollarSign, CreditCard, Building2, CheckCircle2 } from "lucide-react";

export default function InstallmentPaymentModal({ payable, onClose, onSaved }) {
  const [installments, setInstallments] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [locationId, setLocationId] = useState(payable.location_id || "");
  const [notes, setNotes] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    load();
    loadBankAccounts();
  }, [payable?.id]);

  const load = async () => {
    const list = await PayableInstallment.filter({ payable_id: payable.id });
    const filtered = (list||[]).filter(i => (i.status !== 'paid') && (Math.max(0,(i.amount||0)-(i.paid_amount||0))>0));
    setInstallments(filtered.sort((a,b)=>(a.sequence_number||0)-(b.sequence_number||0)));
  };

  const loadBankAccounts = async () => {
    try {
      const accounts = await BankAccount.filter({ is_active: true });
      setBankAccounts(accounts||[]);
    } catch (e) { console.error(e); }
  };

  const pendingById = useMemo(() => Object.fromEntries(installments.map(i => [i.id, Math.max(0,(i.amount||0)-(i.paid_amount||0))])), [installments]);
  const totalEntered = useMemo(() => Object.entries(amounts).reduce((s,[id,val])=> s + (Number(val)||0), 0), [amounts]);

  const paymentMethods = [
    { value: "cash", label: "Efectivo", icon: DollarSign },
    { value: "transfer", label: "Transferencia", icon: Building2 },
    { value: "card", label: "Tarjeta", icon: CreditCard },
    { value: "check", label: "Cheque", icon: CheckCircle2 }
  ];

  const handleSubmit = async () => {
    if (totalEntered <= 0) { alert("Ingresa al menos un monto"); return; }
    if (!locationId) { alert("Selecciona una sucursal"); return; }
    if (method === 'transfer' && !bankAccountId) { alert("Selecciona una cuenta bancaria"); return; }

    // Validar límites por cuota
    for (const [id, val] of Object.entries(amounts)) {
      const v = Number(val)||0;
      if (v < 0) { alert("Montos inválidos"); return; }
      if (v > (pendingById[id]||0)) { alert("Un monto excede el saldo de su cuota"); return; }
    }

    // Crear pagos por cuota y actualizar cuotas; además actualizar totales del payable
    let totalPaidNow = 0;
    for (const inst of installments) {
      const v = Number(amounts[inst.id]||0);
      if (!v) continue;
      totalPaidNow += v;

      const payment = await PayablePayment.create({
        payable_id: payable.id,
        payment_date: new Date().toISOString(),
        amount: v,
        method,
        reference: reference || "",
        bank_account_id: bankAccountId || null,
        location_id: locationId,
        notes: notes ? `${notes} | Cuota #${inst.sequence_number}` : `Pago cuota #${inst.sequence_number}`
      });

      if (method === 'cash') {
        const expense = await Expense.create({
          description: `Pago cuota #${inst.sequence_number} a ${payable.supplier_name} - ${payable.description}`,
          amount: v,
          category: payable.category || "otros",
          expense_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
          location_id: locationId,
          payment_method: 'cash',
          receipt_number: reference || "",
          supplier: payable.supplier_name,
          notes: `Abono a CxP #${payable.id} cuota #${inst.sequence_number}`
        });
        await PayablePayment.update(payment.id, { expense_id: expense.id });
      }

      const newPaid = Number((inst.paid_amount||0) + v);
      const pending = Math.max(0, (inst.amount||0) - newPaid);
      await PayableInstallment.update(inst.id, { paid_amount: newPaid, status: pending <= 0 ? 'paid' : 'partial' });
    }

    const newPaidAmount = Number((payable.paid_amount||0) + totalPaidNow);
    const newPendingAmount = Math.max(0, Number((payable.total_amount||0) - newPaidAmount));
    await AccountPayable.update(payable.id, { paid_amount: newPaidAmount, pending_amount: newPendingAmount, status: newPendingAmount <= 0 ? 'paid' : 'partial' });

    onSaved && onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Abonar por cuota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg text-sm">
            <div className="grid md:grid-cols-3 gap-3">
              <div><span className="text-slate-600">Proveedor:</span> <strong>{payable.supplier_name}</strong></div>
              <div><span className="text-slate-600">Pendiente CxP:</span> <strong className="text-red-600">${(payable.pending_amount||0).toLocaleString()}</strong></div>
              <div><span className="text-slate-600">Total a registrar:</span> <strong className="text-green-700">${totalEntered.toLocaleString()}</strong></div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2">#</th>
                  <th>Vence</th>
                  <th>Monto</th>
                  <th>Abonado</th>
                  <th>Pendiente</th>
                  <th>Monto a pagar</th>
                </tr>
              </thead>
              <tbody>
                {installments.map(inst => {
                  const pending = Math.max(0,(inst.amount||0)-(inst.paid_amount||0));
                  return (
                    <tr key={inst.id} className="border-t">
                      <td className="py-2">{inst.sequence_number}</td>
                      <td>{inst.due_date}</td>
                      <td>${(inst.amount||0).toLocaleString()}</td>
                      <td className="text-green-700">${(inst.paid_amount||0).toLocaleString()}</td>
                      <td className="text-red-700 font-semibold">${pending.toLocaleString()}</td>
                      <td style={{minWidth:120}}>
                        <Input type="number" placeholder="0" value={amounts[inst.id]||""} onChange={e=>setAmounts(a=>({...a,[inst.id]:e.target.value}))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Método de Pago *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {paymentMethods.map(pm=>{
                  const Icon = pm.icon;
                  return (
                    <Button key={pm.value} type="button" variant={method===pm.value?"default":"outline"} onClick={()=>setMethod(pm.value)} className="gap-2">
                      <Icon className="w-4 h-4"/> {pm.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Referencia</Label>
              <Input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Ej: TRANS-123" />
            </div>
            <div>
              <Label>Sucursal *</Label>
              <Input value={locationId} onChange={e=>setLocationId(e.target.value)} placeholder="ID de sucursal" />
            </div>
          </div>

          {method === 'transfer' && (
            <div>
              <Label>Cuenta Bancaria *</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} - {acc.account_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Notas</Label>
            <Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit}>Registrar Pagos</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}