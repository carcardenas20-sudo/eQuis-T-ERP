import React, { useEffect, useMemo, useState } from "react";
import { PayableInstallment } from "@/entities/PayableInstallment";
import { AccountPayable, PayablePayment, Expense } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Save, X, DollarSign } from "lucide-react";
import InstallmentPaymentModal from "./InstallmentPaymentModal";

export default function InstallmentsManager({ payable, onClose, onSaved }) {
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genBaseDate, setGenBaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [genCount, setGenCount] = useState(8);
  const [genRangeDays, setGenRangeDays] = useState(45);
  const [drafts, setDrafts] = useState([]);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    load();
  }, [payable?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await PayableInstallment.filter({ payable_id: payable.id });
      const sorted = (list || []).sort((a,b) => (a.sequence_number||0)-(b.sequence_number||0));
      setInstallments(sorted);
    } catch (e) {
      console.error("Load installments error", e);
    }
    setLoading(false);
  };

  const totalInstallmentsPending = useMemo(() => {
    return installments.reduce((sum, i) => sum + Math.max(0, (i.amount||0) - (i.paid_amount||0)), 0);
  }, [installments]);

  const generateDrafts = () => {
    const base = new Date(genBaseDate + "T00:00:00");
    const n = Math.max(1, Number(genCount)||8);
    const span = Math.max(1, Number(genRangeDays)||45);
    const per = Math.floor(payable.pending_amount / n * 100) / 100; // 2 dec floor
    const draftsLocal = [];
    let accumulated = 0;
    for (let i=0;i<n;i++) {
      const offset = Math.round(i * (span / Math.max(1,(n-1))))
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      let amount = (i === n-1) ? Number((payable.pending_amount - accumulated).toFixed(2)) : per;
      accumulated = Number((accumulated + amount).toFixed(2));
      draftsLocal.push({
        sequence_number: i+1,
        due_date: d.toISOString().split('T')[0],
        amount,
      });
    }
    setDrafts(draftsLocal);
  };

  useEffect(() => { if (showGenerator) generateDrafts(); }, [showGenerator, genBaseDate, genCount, genRangeDays]);

  const saveDrafts = async () => {
    // Delete existing pending installments? No: keep add-only; but usually we replace.
    // Minimal: if none exists, create; if exists, ask confirm to append.
    if (installments.length > 0 && !confirm("Ya existen cuotas. ¿Agregar además de las existentes?")) {
      return;
    }
    for (const d of drafts) {
      await PayableInstallment.create({
        payable_id: payable.id,
        sequence_number: d.sequence_number,
        due_date: d.due_date,
        amount: d.amount,
        paid_amount: 0,
        status: "pending",
        location_id: payable.location_id || null,
      });
    }
    await load();
    setShowGenerator(false);
    onSaved && onSaved();
  };

  const updateInline = async (inst, patch) => {
    await PayableInstallment.update(inst.id, { ...patch });
    await load();
  };

  const deleteInst = async (inst) => {
    if (!confirm("¿Eliminar esta cuota?")) return;
    await PayableInstallment.delete(inst.id);
    await load();
  };

  return (
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Cuotas de: {payable.supplier_name}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGenerator(v=>!v)} className="gap-2">
              <Plus className="w-4 h-4"/> Generar 8 cuotas (45 días)
            </Button>
            {installments.length > 0 && (
              <Button onClick={() => setShowPayModal(true)} className="gap-2">
                <DollarSign className="w-4 h-4"/> Abonar por cuota
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="gap-2"><X className="w-4 h-4"/> Cerrar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showGenerator && (
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Fecha de factura (base)</label>
                  <Input type="date" value={genBaseDate} onChange={e=>setGenBaseDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-slate-600"># de cuotas</label>
                  <Input type="number" min={1} value={genCount} onChange={e=>setGenCount(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Rango en días</label>
                  <Input type="number" min={1} value={genRangeDays} onChange={e=>setGenRangeDays(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-2">#</th>
                      <th>Vencimiento sugerido</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map(d => (
                      <tr key={d.sequence_number} className="border-t">
                        <td className="py-2">{d.sequence_number}</td>
                        <td><Input type="date" value={d.due_date} onChange={e=>setDrafts(prev=>prev.map(x=>x.sequence_number===d.sequence_number?{...x, due_date:e.target.value}:x))} /></td>
                        <td><Input type="number" value={d.amount} onChange={e=>setDrafts(prev=>prev.map(x=>x.sequence_number===d.sequence_number?{...x, amount: Number(e.target.value)}:x))} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>setShowGenerator(false)}><X className="w-4 h-4 mr-1"/>Cancelar</Button>
                <Button onClick={saveDrafts}><Save className="w-4 h-4 mr-1"/>Guardar cuotas</Button>
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-lg flex flex-wrap items-center gap-4 text-sm">
            <span>Total pendiente del plan: <strong className="text-amber-700">${totalInstallmentsPending.toLocaleString()}</strong></span>
            <Badge variant="outline">Cuotas: {installments.length}</Badge>
          </div>

          {loading ? (
            <p className="text-center text-slate-500 py-8">Cargando...</p>
          ) : installments.length === 0 ? (
            <div className="text-center text-slate-600 py-8">
              No hay cuotas registradas. Usa "Generar 8 cuotas (45 días)" para crearlas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2">#</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th>Abonado</th>
                    <th>Pendiente</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map(inst => {
                    const pending = Math.max(0, (inst.amount||0) - (inst.paid_amount||0));
                    return (
                      <tr key={inst.id} className="border-t">
                        <td className="py-2">{inst.sequence_number}</td>
                        <td>
                          <Input type="date" value={inst.due_date} onChange={e=>updateInline(inst,{ due_date: e.target.value })} />
                        </td>
                        <td>
                          <Input type="number" value={inst.amount} onChange={e=>updateInline(inst,{ amount: Number(e.target.value) })} />
                        </td>
                        <td className="text-green-700 font-medium">${(inst.paid_amount||0).toLocaleString()}</td>
                        <td className="text-red-700 font-semibold">${pending.toLocaleString()}</td>
                        <td>
                          <Badge className={inst.status === 'paid' ? 'bg-green-500' : inst.status === 'partial' ? 'bg-blue-500' : 'bg-amber-500'}>
                            {inst.status}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <Button size="sm" variant="outline" onClick={()=>deleteInst(inst)}>Eliminar</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showPayModal && (
        <InstallmentPaymentModal
          payable={payable}
          onClose={()=>setShowPayModal(false)}
          onSaved={()=>{ setShowPayModal(false); load(); onSaved && onSaved(); }}
        />
      )}
    </div>
  );
}