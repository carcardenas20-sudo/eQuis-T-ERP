import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { esperadoOjaleteo, recibidoOjaleteo, OJALETEADOR_CONFIG_KEY } from "@/utils/ojaleteo";

const n = (v) => Number(v) || 0;
const money = (v) => `$${Math.round(n(v)).toLocaleString("es-CO")}`;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// Recepción (parcial) del ojaleteado externo de un presupuesto, por referencia y talla.
// Queda como entrega de la ojaleteadora → suma a su saldo y la puede cobrar desde su portal.
export default function RecibirOjaleteado({ presupuesto, productos, onClose, onDone }) {
  const [empleados, setEmpleados] = useState([]);
  const [ojId, setOjId] = useState("");
  const [cfgId, setCfgId] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [cant, setCant] = useState({});
  const [fecha, setFecha] = useState(today());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [emps, cfg, ents] = await Promise.all([
          base44.entities.Employee.list(),
          base44.entities.AppConfig.filter({ key: OJALETEADOR_CONFIG_KEY }),
          base44.entities.Delivery.filter({ presupuesto_id: presupuesto.id }),
        ]);
        setEmpleados((emps || []).filter((e) => e.is_active !== false));
        if (cfg?.[0]) { setCfgId(cfg[0].id); setOjId(cfg[0].value || ""); }
        setEntregas(ents || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [presupuesto.id]);

  const filas = useMemo(() => esperadoOjaleteo(presupuesto, productos), [presupuesto, productos]);
  const recibido = useMemo(() => recibidoOjaleteo(entregas), [entregas]);
  const ojaleteadora = empleados.find((e) => e.employee_id === ojId);
  const total = filas.reduce((s, f) => s + n(cant[f.key]) * f.precio, 0);
  const totalUds = filas.reduce((s, f) => s + n(cant[f.key]), 0);

  const guardar = async () => {
    if (savingRef.current) return;
    if (!ojaleteadora) { setError("Elige quién es la ojaleteadora."); return; }
    const items = filas.filter((f) => n(cant[f.key]) > 0).map((f) => ({
      product_reference: f.reference, talla: f.talla, quantity: n(cant[f.key]),
      unit_price: f.precio, total_amount: n(cant[f.key]) * f.precio,
    }));
    if (!items.length) { setError("Escribe cuántas unidades se reciben."); return; }
    savingRef.current = true; setSaving(true); setError("");
    try {
      // Recordar la ojaleteadora por defecto
      if (cfgId) { if (ojId) await base44.entities.AppConfig.update(cfgId, { value: ojId }); }
      else await base44.entities.AppConfig.create({ key: OJALETEADOR_CONFIG_KEY, value: ojId });
      await base44.entities.Delivery.create({
        employee_id: ojaleteadora.employee_id,
        employee_name: ojaleteadora.name,
        delivery_date: fecha,
        status: "pendiente",
        tipo_entrega: "ojaletear",
        presupuesto_id: presupuesto.id,
        presupuesto_numero: presupuesto.numero_presupuesto || "",
        items,
        total_amount: Math.round(total),
        notes: `Ojaleteado externo · presupuesto ${presupuesto.numero_presupuesto || ""}`,
      });
      onDone();
    } catch (e) { setError("No se pudo guardar: " + e.message); }
    savingRef.current = false; setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Recibir ojaleteado · {presupuesto.numero_presupuesto}</DialogTitle></DialogHeader>
        {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ojaleteadora</Label>
                <select value={ojId} onChange={(e) => setOjId(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-2 text-sm">
                  <option value="">Selecciona…</option>
                  {empleados.map((e) => <option key={e.id} value={e.employee_id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de entrega</Label>
                <Input type="date" value={fecha} max={today()} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            {filas.length === 0 ? (
              <p className="text-sm text-slate-500">Este presupuesto no tiene productos con ojaleteado externo.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr><th className="text-left px-2 py-1.5">Ref · talla</th><th className="px-2">Pedido</th><th className="px-2">Recibido</th><th className="px-2">Falta</th><th className="px-2">Recibe hoy</th></tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const rec = recibido[f.key] || 0;
                      const falta = Math.max(0, f.esperado - rec);
                      return (
                        <tr key={f.key} className="border-t">
                          <td className="px-2 py-1.5"><b>{f.reference}</b> {f.nombre} · <b>{f.talla}</b></td>
                          <td className="text-center">{f.esperado}</td>
                          <td className="text-center">{rec}</td>
                          <td className={`text-center ${falta ? "text-amber-700 font-semibold" : "text-emerald-700"}`}>{falta || "✓"}</td>
                          <td className="px-2 py-1">
                            <Input type="number" min="0" max={falta} step="1" className="h-8 w-20" disabled={!falta}
                              value={cant[f.key] ?? ""} onChange={(e) => setCant((c) => ({ ...c, [f.key]: Math.max(0, Math.min(falta, Math.round(n(e.target.value)))) }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm flex justify-between">
              <span>Recibe hoy: <b>{totalUds}</b> uds</span><b>{money(total)}</b>
            </div>
            <p className="text-xs text-slate-500">Queda en el saldo de la ojaleteadora: la puede cobrar desde su portal y se paga en Pagos a Empleados.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving || loading || totalUds <= 0} className="bg-indigo-600 hover:bg-indigo-700">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Registrar recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
