import React, { useMemo, useRef, useState } from "react";
import { getToken, getActiveCompany } from "@/api/localClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw } from "lucide-react";

const n = (v) => Number(v) || 0;
const money = (v) => `$${Math.round(n(v)).toLocaleString("es-CO")}`;

// Devolución de productos de una factura. El valor va primero al crédito abierto de la
// factura; lo que sobre queda como saldo a favor del cliente o se devuelve en efectivo.
export default function DevolucionModal({ sale, items, onClose, onDone }) {
  const [cant, setCant] = useState({});
  const [destino, setDestino] = useState(sale.customer_id ? "saldo" : "efectivo");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  // Ya devuelto por ítem (devoluciones anteriores)
  const yaDevuelto = useMemo(() => {
    const m = {};
    for (const d of sale.devoluciones || []) for (const it of d.items || []) m[it.sale_item_id] = (m[it.sale_item_id] || 0) + n(it.quantity);
    return m;
  }, [sale]);
  const sumLines = (items || []).reduce((s, i) => s + n(i.line_total), 0);
  const factor = sumLines > 0 ? n(sale.total_amount) / sumLines : 1;
  const unitValue = (i) => (n(i.quantity) > 0 ? (n(i.line_total) / n(i.quantity)) * factor : 0);
  const total = (items || []).reduce((s, i) => s + unitValue(i) * n(cant[i.id]), 0);
  const esCredito = sale.status === "credit";

  const guardar = async () => {
    if (savingRef.current) return;
    const sel = (items || []).filter((i) => n(cant[i.id]) > 0).map((i) => ({ sale_item_id: i.id, quantity: n(cant[i.id]) }));
    if (!sel.length) { setError("Escribe cuántas unidades se devuelven."); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const company = getActiveCompany();
      const res = await fetch("/api/devoluciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(company ? { "X-Company-Id": company } : {}),
        },
        body: JSON.stringify({ sale_id: sale.id, items: sel, destino_sobrante: destino, notas }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo registrar la devolución");
      onDone(d);
    } catch (e) {
      setError(e.message);
    }
    savingRef.current = false;
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-orange-600" /> Devolución</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Factura #{sale.invoice_number || String(sale.id).slice(-8)} · {sale.customer_name || "Cliente General"}
          </p>
          <div className="space-y-2">
            {(items || []).map((i) => {
              const max = n(i.quantity) - (yaDevuelto[i.id] || 0);
              return (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.product?.name || i.product_id}</p>
                    <p className="text-xs text-slate-500">
                      Vendidas {n(i.quantity)}{yaDevuelto[i.id] ? ` · ya devueltas ${yaDevuelto[i.id]}` : ""} · {money(unitValue(i))} c/u
                    </p>
                  </div>
                  <Input type="number" min="0" max={max} step="1" className="w-20" disabled={max <= 0}
                    value={cant[i.id] ?? ""} placeholder="0"
                    onChange={(e) => setCant((c) => ({ ...c, [i.id]: Math.max(0, Math.min(max, Math.round(n(e.target.value)))) }))} />
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Valor a devolver</span><b>{money(total)}</b></div>
            {esCredito && <p className="text-xs text-orange-800">Primero se descuenta del crédito de esta factura.</p>}
          </div>

          <div className="space-y-1.5">
            <Label>{esCredito ? "Si sobra después de saldar el crédito:" : "¿Cómo se le devuelve?"}</Label>
            <div className="flex flex-col gap-1.5 text-sm">
              <label className={`flex items-center gap-2 ${!sale.customer_id ? "opacity-50" : ""}`}>
                <input type="radio" disabled={!sale.customer_id} checked={destino === "saldo"} onChange={() => setDestino("saldo")} />
                Saldo a favor del cliente (lo usa en próximas compras)
                {!sale.customer_id && <span className="text-xs text-slate-500">— la venta no tiene cliente</span>}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={destino === "efectivo"} onChange={() => setDestino("efectivo")} />
                Devolver en efectivo (sale de la caja de la sucursal)
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Motivo (opcional)" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-500">Los productos vuelven al inventario de la sucursal donde se hizo la venta.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving || total <= 0} className="bg-orange-600 hover:bg-orange-700">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />} Registrar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
