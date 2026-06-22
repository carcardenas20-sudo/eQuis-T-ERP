import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Banknote, RefreshCw, Plus, ShoppingCart, CreditCard,
  Trash2, Clock, CheckCircle2, XCircle, Loader2, Building2
} from "lucide-react";

const BANCOS = {
  bancolombia: "Bancolombia",
  bbva: "BBVA",
  nequi: "Nequi",
  daviplata: "Daviplata",
  davivienda: "Davivienda",
  bogota: "Banco de Bogotá",
};

const ESTADO_BADGE = {
  pendiente: "bg-amber-100 text-amber-800 border border-amber-200",
  vinculada: "bg-green-100 text-green-800 border border-green-200",
  descartada: "bg-slate-100 text-slate-500 border border-slate-200",
};

const ESTADO_ICON = {
  pendiente: <Clock className="w-3.5 h-3.5" />,
  vinculada: <CheckCircle2 className="w-3.5 h-3.5" />,
  descartada: <XCircle className="w-3.5 h-3.5" />,
};

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(dateStr).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatCOP(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(n);
}

function ConfirmacionCard({ conf, onFacturar, onAbonar, onDescartar }) {
  const isPendiente = conf.estado === "pendiente";
  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${isPendiente ? "border-amber-200 hover:border-amber-300" : "border-slate-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[conf.estado] || ""}`}>
              {ESTADO_ICON[conf.estado]}
              {conf.estado}
            </span>
            <span className="text-xs text-slate-400">
              {BANCOS[conf.banco_origen] || conf.banco_origen || "Banco"}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{timeAgo(conf.fecha_hora)}</span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl font-bold text-slate-800">{formatCOP(conf.monto)}</span>
            {conf.nombre_emisor && (
              <span className="text-sm text-slate-600 truncate">de <strong>{conf.nombre_emisor}</strong></span>
            )}
          </div>

          {conf.referencia && (
            <p className="text-xs text-slate-400 mt-0.5">Ref: {conf.referencia}</p>
          )}
          {conf.cuenta_destino && (
            <p className="text-xs text-slate-400">Cta. destino: {conf.cuenta_destino}</p>
          )}
          {conf.venta_vinculada_id && (
            <p className="text-xs text-green-600 mt-1">Vinculada a venta #{conf.venta_vinculada_id.slice(-8)}</p>
          )}
          {conf.credito_vinculado_id && (
            <p className="text-xs text-green-600 mt-1">Vinculada a crédito #{conf.credito_vinculado_id.slice(-8)}</p>
          )}
        </div>

        {isPendiente && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button size="sm" onClick={() => onFacturar(conf)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
              <ShoppingCart className="w-3.5 h-3.5 mr-1" />
              Facturar
            </Button>
            <Button size="sm" onClick={() => onAbonar(conf)} variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50 text-xs h-8">
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Abonar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDescartar(conf)}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs h-8">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Descartar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SimularModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    banco_origen: "bancolombia", monto: "", nombre_emisor: "", referencia: "", cuenta_destino: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.monto || !form.nombre_emisor) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("equist_token") || "";
      const res = await fetch("/api/confirmaciones/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, monto: parseFloat(form.monto) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onCreated();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.value ?? e }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            Simular transferencia
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Banco origen</Label>
            <Select value={form.banco_origen} onValueChange={set("banco_origen")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BANCOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Monto *</Label>
            <Input type="number" min="1" placeholder="1500000" required
              value={form.monto} onChange={set("monto")} />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre del emisor *</Label>
            <Input placeholder="Carlos Rodríguez" required
              value={form.nombre_emisor} onChange={set("nombre_emisor")} />
          </div>
          <div className="space-y-1.5">
            <Label>Referencia (opcional)</Label>
            <Input placeholder="1234567890" value={form.referencia} onChange={set("referencia")} />
          </div>
          <div className="space-y-1.5">
            <Label>Cuenta destino (opcional)</Label>
            <Input placeholder="Cta. Bancolombia 1234" value={form.cuenta_destino} onChange={set("cuenta_destino")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear confirmación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FILTROS = [
  { key: "pendiente", label: "Pendientes" },
  { key: "vinculada", label: "Vinculadas" },
  { key: "descartada", label: "Descartadas" },
  { key: "todas", label: "Todas" },
];

export default function ConfirmacionesBancarias() {
  const navigate = useNavigate();
  const [confirmaciones, setConfirmaciones] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [loading, setLoading] = useState(true);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [showSimular, setShowSimular] = useState(false);
  const [descartando, setDescartando] = useState(null);

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem("equist_token") || "";
      const params = filtro !== "todas" ? `?estado=${filtro}&limit=100` : "?limit=100";
      const res = await fetch(`/api/confirmaciones${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setConfirmaciones(Array.isArray(data) ? data : []);
      setUltimaSync(new Date());
    } catch (e) {
      console.error("[ConfirmacionesBancarias]", e.message);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleFacturar = (conf) => {
    sessionStorage.setItem("confirmacion_pendiente", JSON.stringify({
      id: conf.id,
      monto: conf.monto,
      nombre_emisor: conf.nombre_emisor,
      banco_origen: conf.banco_origen,
      referencia: conf.referencia,
    }));
    navigate(createPageUrl("POS"));
  };

  const handleAbonar = (conf) => {
    sessionStorage.setItem("confirmacion_pendiente", JSON.stringify({
      id: conf.id,
      monto: conf.monto,
      nombre_emisor: conf.nombre_emisor,
      banco_origen: conf.banco_origen,
      referencia: conf.referencia,
    }));
    navigate(createPageUrl("Credits"));
  };

  const handleDescartar = async (conf) => {
    if (!window.confirm(`¿Descartar la transferencia de ${formatCOP(conf.monto)} de ${conf.nombre_emisor || "emisor desconocido"}?`)) return;
    setDescartando(conf.id);
    try {
      const token = localStorage.getItem("equist_token") || "";
      const res = await fetch(`/api/confirmaciones/${conf.id}/descartar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      load();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setDescartando(null);
  };

  const total = confirmaciones.length;
  const pendientes = filtro === "todas" ? confirmaciones.filter((c) => c.estado === "pendiente").length : (filtro === "pendiente" ? total : null);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-800">Confirmaciones Bancarias</h1>
            {pendientes > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendientes}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {ultimaSync
              ? `Actualizado a las ${ultimaSync.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · cada 10 s`
              : "Cargando..."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowSimular(true)} variant="outline"
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <Plus className="w-4 h-4 mr-1" />
            Simular
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTROS.map(({ key, label }) => (
          <button key={key} onClick={() => setFiltro(key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
              filtro === key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : confirmaciones.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {filtro === "pendiente"
              ? "No hay transferencias pendientes"
              : `No hay confirmaciones ${filtro === "todas" ? "" : filtro + "s"}`}
          </p>
          <p className="text-sm text-slate-300 mt-1">
            Las transferencias detectadas por correo aparecerán aquí automáticamente
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {confirmaciones.map((conf) => (
            <ConfirmacionCard
              key={conf.id}
              conf={conf}
              onFacturar={handleFacturar}
              onAbonar={handleAbonar}
              onDescartar={descartando === conf.id ? () => {} : handleDescartar}
            />
          ))}
        </div>
      )}

      {showSimular && (
        <SimularModal onClose={() => setShowSimular(false)} onCreated={load} />
      )}
    </div>
  );
}
