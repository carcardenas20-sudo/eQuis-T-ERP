import React, { useEffect, useMemo, useState } from "react";
import { SyncInbox } from "@/entities/SyncInbox";
import { AccountPayable } from "@/entities/AccountPayable";
import { Location } from "@/entities/Location";
import { PayablePayment } from "@/entities/PayablePayment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Search, Link as LinkIcon } from "lucide-react";

function useLocations() {
  const [mapByCode, setMapByCode] = useState({});
  const [mapById, setMapById] = useState({});
  useEffect(() => {
    (async () => {
      const locs = await Location.list();
      const byCode = {};
      const byId = {};
      (locs || []).forEach((l) => {if (l.code) byCode[l.code] = l;byId[l.id] = l;});
      setMapByCode(byCode);
      setMapById(byId);
    })();
  }, []);
  return { mapByCode, mapById };
}

function normalizeMethod(m) {
  const v = String(m || "").toLowerCase();
  if (["cash", "efectivo"].includes(v)) return "cash";
  if (["card", "tarjeta"].includes(v)) return "card";
  if (["transfer", "transferencia", "bank", "nequi", "daviplata"].includes(v)) return "transfer";
  if (["qr"].includes(v)) return "qr";
  return "other";
}

function extractPaymentFields(rec) {
  const p = rec?.payload || {};
  const pay = p.payment || {};
  const amount = pay.amount ?? p.amount ?? 0;
  const paid_at = pay.paid_at ?? p.paid_at ?? new Date().toISOString();
  const method = pay.method ?? p.method ?? "transfer";
  const reference = pay.reference ?? p.reference ?? "";
  const payable_id = pay.payable_id ?? p.payable_id ?? null;
  const external_reference = p.external_reference ?? null;
  const invoice_number = pay.invoice_number ?? p.invoice_number ?? null;
  const location_code = p.location_code ?? pay.location_code ?? null;
  const payment_id = p.payment_id ?? pay.payment_id ?? rec.id;
  return { amount: Number(amount) || 0, paid_at, method, reference, payable_id, external_reference, invoice_number, location_code, payment_id };
}

export default function ConciliacionPagos() {
  const [loading, setLoading] = useState(true);
  const [financeEvents, setFinanceEvents] = useState([]); // SyncInbox source=finance
  const [payables, setPayables] = useState([]); // pending/partial
  const [showProcessed, setShowProcessed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const { mapByCode, mapById } = useLocations();

  const reload = async () => {
    setLoading(true);
    const [finInbox, opInbox, aps] = await Promise.all([
      SyncInbox.filter({ source: 'finance' }),
      SyncInbox.filter({ source: 'operarios' }),
      AccountPayable.filter({}).then((r) => (r || []).filter((x) => x.status === 'pending' || x.status === 'partial'))
    ]);
    const merged = [...(finInbox || []), ...(opInbox || [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    setFinanceEvents(merged);
    setPayables(aps);
    setLoading(false);
  };

  useEffect(() => {reload();}, []);

  const candidatesFor = (rec) => {
    const f = extractPaymentFields(rec);
    const lc = f.location_code ? mapByCode[f.location_code] : null;

    const exact = [];
    const near = [];

    (payables || []).forEach((ap) => {
      let score = 0;
      if (f.payable_id && ap.id === f.payable_id) score = 100;else
      if (f.external_reference && ap.external_reference === f.external_reference) score = 95;else
      if (f.invoice_number && ap.invoice_number && ap.invoice_number === f.invoice_number) score = 80;
      if (lc && ap.location_id === lc.id) score += 5;
      const pending = Math.max(0, ap.pending_amount || 0);
      const diff = Math.abs(pending - f.amount);
      if (diff < 1) score += 20;else if (diff <= 1000) score += 10;else if (diff <= 5000) score += 5;
      if (score >= 95) exact.push({ ap, score });else near.push({ ap, score });
    });

    exact.sort((a, b) => b.score - a.score);
    near.sort((a, b) => b.score - a.score);
    return { exact, near: near.slice(0, 5) };
  };

  const approveOn = async (rec, ap) => {
    const f = extractPaymentFields(rec);
    const method = normalizeMethod(f.method);

    // 1) Crear PayablePayment
    const payment = await PayablePayment.create({
      payable_id: ap.id,
      payment_date: new Date(f.paid_at).toISOString(),
      amount: f.amount,
      method,
      reference: f.reference || "",
      bank_account_id: null,
      location_id: ap.location_id,
      notes: `Importado desde Finanzas • payment_id=${f.payment_id}`
    });

    // 2) Actualizar AccountPayable
    const newPaid = (ap.paid_amount || 0) + f.amount;
    const newPending = Math.max(0, (ap.total_amount || 0) - newPaid);
    const newStatus = newPending <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    await AccountPayable.update(ap.id, { paid_amount: newPaid, pending_amount: newPending, status: newStatus });

    // 3) Marcar SyncInbox como procesado
    await SyncInbox.update(rec.id, { processed: true, process_error: null });

    await reload();
    setSelectedId(null);
    alert('Abono aplicado correctamente');
  };

  const rejectRec = async (rec, reason = "Rechazado manualmente") => {
    await SyncInbox.update(rec.id, { processed: true, process_error: reason });
    await reload();
    setSelectedId(null);
  };

  const filteredEvents = useMemo(() => {
    let list = financeEvents;
    if (!showProcessed) list = list.filter((r) => !r.processed);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const f = extractPaymentFields(r);
        return String(f.reference || "").toLowerCase().includes(q) ||
        String(f.invoice_number || "").toLowerCase().includes(q) ||
        String(f.payable_id || "").toLowerCase().includes(q) ||
        String(r.event_type || "").toLowerCase().includes(q);
      });
    }
    return list;
  }, [financeEvents, showProcessed, search]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Conciliación de Pagos (Finanzas → CxP)</h1>
            <p className="text-slate-600 text-sm">Aprueba o rechaza abonos recibidos desde Finanzas y asígnalos a la cuenta por pagar correcta.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reload} className="gap-2"><RefreshCw className="w-4 h-4" />Actualizar</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <input id="processed" type="checkbox" checked={showProcessed} onChange={(e) => setShowProcessed(e.target.checked)} />
            <label htmlFor="processed" className="text-sm text-slate-700">Mostrar procesados</label>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por referencia / factura / payable_id" className="pl-8 w-full sm:w-72" />
          </div>
        </div>

        {loading ?
        <div className="h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> :

        <div className="grid lg:grid-cols-2 gap-3 sm:gap-6">
            {/* Columna izquierda: eventos de finanzas */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Pagos recibidos ({filteredEvents.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-slate-50 divide-y">
                  {filteredEvents.length === 0 ?
                <div className="p-6 text-slate-500 text-center">No hay registros</div> :
                filteredEvents.map((rec) => {
                  const f = extractPaymentFields(rec);
                  const lc = f.location_code && mapByCode[f.location_code];
                  const { exact, near } = candidatesFor(rec);
                  const suggested = exact[0]?.ap || near[0]?.ap;
                  const isSelected = selectedId === rec.id;
                  return (
                    <button key={rec.id} onClick={() => setSelectedId(isSelected ? null : rec.id)} className={`w-full text-left p-4 hover:bg-slate-50 ${isSelected ? 'bg-slate-50' : ''}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">${f.amount.toLocaleString()}</span>
                              {rec.processed ?
                            <Badge className="bg-green-600">Procesado</Badge> :
                            exact.length > 0 ?
                            <Badge className="bg-blue-600">Match exacto</Badge> :

                            <Badge variant="outline">Revisión</Badge>
                            }
                            </div>
                            <div className="text-xs text-slate-600 mt-1 space-x-2">
                              <span>Ref: {f.reference || '—'}</span>
                              {f.invoice_number && <span>• Factura: {f.invoice_number}</span>}
                              {f.payable_id && <span>• Payable: {f.payable_id}</span>}
                              {f.external_reference && <span>• ExtRef: {f.external_reference}</span>}
                              {lc && <span>• Sucursal: {lc.name}</span>}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(f.paid_at).toLocaleString()}
                          </div>
                        </div>
                        {isSelected && suggested &&
                      <div className="mt-3 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="w-3.5 h-3.5" /> Sugerencia: {suggested.supplier_name} • Pendiente ${Math.max(0, suggested.pending_amount || 0).toLocaleString()} • Vence {suggested.due_date}
                            </div>
                          </div>
                      }
                      </button>);

                })}
                </div>
              </CardContent>
            </Card>

            {/* Columna derecha: detalle y asignación */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Detalle y asignación</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedId ?
              <p className="text-slate-500">Selecciona un pago de la izquierda para conciliarlo.</p> :
              (() => {
                const rec = financeEvents.find((r) => r.id === selectedId);
                if (!rec) return <p className="text-slate-500">Registro no encontrado.</p>;
                const f = extractPaymentFields(rec);
                const { exact, near } = candidatesFor(rec);
                const list = [...exact.map((x) => x.ap), ...near.map((x) => x.ap)];
                return (
                  <div className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-3 text-sm">
                        <div className="flex flex-wrap gap-3 items-center">
                          <Badge variant="outline">Monto ${f.amount.toLocaleString()}</Badge>
                          <Badge variant="outline">{new Date(f.paid_at).toLocaleString()}</Badge>
                          <Badge variant="outline">{normalizeMethod(f.method)}</Badge>
                          {f.reference && <Badge variant="outline">Ref {f.reference}</Badge>}
                          {f.invoice_number && <Badge variant="outline">Factura {f.invoice_number}</Badge>}
                        </div>
                      </div>

                      {list.length === 0 ?
                    <div className="text-slate-600 text-sm">No hay sugerencias; busca la cuenta por pagar en la página de Cuentas por Pagar y registra el abono manualmente, o ajusta el payload desde Finanzas.</div> :

                    <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">Sugerencias de cuenta por pagar</p>
                          <div className="max-h-72 overflow-auto border rounded-lg">
                            {list.map((ap) =>
                        <div key={ap.id} className="p-3 border-b last:border-b-0 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium">{ap.supplier_name} <span className="text-xs text-slate-500">(#{ap.id.slice(-6)})</span></div>
                                  <div className="text-xs text-slate-600 space-x-2">
                                    <span>Total ${Number(ap.total_amount || 0).toLocaleString()}</span>
                                    <span>• Pagado ${Number(ap.paid_amount || 0).toLocaleString()}</span>
                                    <span>• Pendiente ${Number(ap.pending_amount || 0).toLocaleString()}</span>
                                    {ap.invoice_number && <span>• Factura {ap.invoice_number}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" className="gap-1" onClick={() => approveOn(rec, ap)}>
                                    <CheckCircle2 className="w-4 h-4" /> Aprobar
                                  </Button>
                                </div>
                              </div>
                        )}
                          </div>
                        </div>
                    }

                      <div className="flex items-center justify-between pt-2">
                        <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => {
                        const reason = prompt('Motivo de rechazo:', 'No corresponde');
                        if (reason !== null) rejectRec(rec, reason || 'Rechazado manualmente');
                      }}>
                          <XCircle className="w-4 h-4" /> Rechazar
                        </Button>
                      </div>
                    </div>);

              })()}
              </CardContent>
            </Card>
          </div>
        }
      </div>
    </div>);

}