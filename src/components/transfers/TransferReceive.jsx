import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Package, Building2, AlertTriangle, RefreshCw } from "lucide-react";

function fmtCOP(n) {
  return (Number(n) || 0).toLocaleString("es-CO");
}

function ConteoItem({ item, productos, onChange }) {
  const prod = productos.find(p => p.sku === item.product_id || p.id === item.product_id);
  const prendasPorLona = prod?.prendas_por_lona || 0;
  const lonas = Number(item.lonas || 0);
  const sueltas = Number(item.sueltas || 0);
  const totalContado = lonas * prendasPorLona + sueltas;
  const diferencia = totalContado - item.cantidad_enviada;
  const ok = diferencia === 0;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${ok ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{prod?.name || item.product_id}</p>
          <p className="text-xs text-slate-500">Esperado: <span className="font-bold text-slate-700">{fmtCOP(item.cantidad_enviada)} uds</span></p>
        </div>
        {totalContado > 0 && (
          <div className={`text-sm font-bold px-2.5 py-1 rounded-full ${ok ? "bg-green-100 text-green-700" : diferencia > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"}`}>
            {ok ? "✓ Cuadra" : diferencia > 0 ? `+${diferencia} extra` : `${diferencia} faltante`}
          </div>
        )}
      </div>

      {prendasPorLona > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-slate-500 mb-1">Lonas completas × {prendasPorLona} prendas</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min="0"
                  value={item.lonas || ""}
                  onChange={e => onChange({ ...item, lonas: e.target.value })}
                  className="h-9 text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-slate-400 shrink-0">= {fmtCOP(lonas * prendasPorLona)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Prendas sueltas</p>
              <Input
                type="number" min="0"
                value={item.sueltas || ""}
                onChange={e => onChange({ ...item, sueltas: e.target.value })}
                className="h-9 text-sm"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
            <span className="text-xs text-slate-500">Total contado</span>
            <span className={`text-base font-bold ${ok ? "text-green-700" : "text-amber-700"}`}>
              {fmtCOP(totalContado)} uds
            </span>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-500 mb-1">Total recibido</p>
          <Input
            type="number" min="0"
            value={item.sueltas || ""}
            onChange={e => onChange({ ...item, sueltas: e.target.value, lonas: 0 })}
            className="h-9 text-sm"
            placeholder={String(item.cantidad_enviada)}
          />
          <p className="text-xs text-slate-400 mt-1">Configura "prendas por lona" en el producto para activar el asistente</p>
        </div>
      )}
    </div>
  );
}

export default function TransferReceive({ traslado, productos, locations, onDone, onCancel }) {
  const [items, setItems] = useState(
    (traslado.items || []).map(i => ({ ...i, lonas: "", sueltas: "" }))
  );
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const origen = locations.find(l => l.id === traslado.origen_location_id);
  const destino = locations.find(l => l.id === traslado.destino_location_id);

  const getTotalContado = (item) => {
    const prod = productos.find(p => p.sku === item.product_id || p.id === item.product_id);
    const ppl = prod?.prendas_por_lona || 0;
    return (Number(item.lonas || 0)) * ppl + Number(item.sueltas || 0);
  };

  const hasDiferencias = items.some(i => getTotalContado(i) !== i.cantidad_enviada && getTotalContado(i) > 0);
  const allContado = items.every(i => getTotalContado(i) > 0 || (!i.lonas && !i.sueltas));

  const callEndpoint = async (body) => {
    const res = await fetch("/api/portal/functions/aceptarTraslado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error del servidor");
    }
    return res.json();
  };

  const handleAceptar = async () => {
    setSaving(true);
    try {
      const conteoFinal = items.map(i => ({
        product_id: i.product_id,
        cantidad_enviada: i.cantidad_enviada,
        total_recibido: getTotalContado(i) || i.cantidad_enviada,
        lonas: Number(i.lonas || 0),
        sueltas: Number(i.sueltas || 0),
      }));
      await callEndpoint({ traslado_id: traslado.id, conteo: conteoFinal, notas, accion: "aceptar" });
      onDone();
    } catch (e) {
      alert("Error al aceptar: " + e.message);
    }
    setSaving(false);
  };

  const handleRechazar = async () => {
    if (!notas.trim()) return alert("Escribe el motivo del rechazo.");
    setSaving(true);
    try {
      await callEndpoint({ traslado_id: traslado.id, notas, accion: "rechazar" });
      onDone();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-slate-900">{traslado.numero_traslado}</p>
          <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Building2 className="w-4 h-4 text-red-500 shrink-0" />
          <span className="font-medium text-red-700">{origen?.name || traslado.origen_nombre}</span>
          <span className="text-slate-400">→</span>
          <Building2 className="w-4 h-4 text-green-500 shrink-0" />
          <span className="font-medium text-green-700">{destino?.name || traslado.destino_nombre}</span>
        </div>
      </div>

      {hasDiferencias && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Hay diferencias entre lo enviado y lo contado. Puedes aceptar igual dejando una nota.
        </div>
      )}

      {/* Items con asistente de conteo */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <ConteoItem
            key={idx}
            item={item}
            productos={productos}
            onChange={updated => setItems(prev => prev.map((it, i) => i === idx ? updated : it))}
          />
        ))}
      </div>

      {/* Notas */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">Notas de recepción (opcional)</p>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none"
          placeholder="Observaciones, diferencias, condición de las prendas..."
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="outline"
          onClick={handleRechazar}
          disabled={saving}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <XCircle className="w-4 h-4 mr-1" /> Rechazar
        </Button>
        <Button
          onClick={handleAceptar}
          disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
          Aceptar
        </Button>
      </div>
    </div>
  );
}
