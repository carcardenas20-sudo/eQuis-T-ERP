import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "../components/providers/SessionProvider";
import { Sale, Credit } from "@/entities/all";
import SaleDetailModal from "../components/sales/SaleDetailModal";
import CreditDetailModal from "../components/credits/CreditDetailModal";

import {
  Banknote, RefreshCw, Plus, ShoppingCart, CreditCard,
  Trash2, Clock, CheckCircle2, XCircle, Loader2, Building2,
  Search, Link as LinkIcon, Unlink, ExternalLink, Receipt
} from "lucide-react";

const BANCOS = {
  bancolombia: "Bancolombia",
  bbva: "BBVA",
  nequi: "Nequi",
  daviplata: "Daviplata",
  davivienda: "Davivienda",
  bogota: "Banco de Bogotá",
};

const BANK_STYLES = {
  bancolombia: {
    bg: "border-amber-200 bg-amber-50/10",
    badge: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold",
  },
  nequi: {
    bg: "border-purple-200 bg-purple-50/10",
    badge: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 font-bold",
  },
  daviplata: {
    bg: "border-rose-200 bg-rose-50/10",
    badge: "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 font-bold",
  },
  bbva: {
    bg: "border-blue-200 bg-blue-50/10",
    badge: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 font-bold",
  },
  davivienda: {
    bg: "border-red-200 bg-red-50/10",
    badge: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 font-bold",
  },
  bogota: {
    bg: "border-slate-300 bg-slate-50/15",
    badge: "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100 font-bold",
  }
};

const ESTADO_BADGE = {
  pendiente: "bg-amber-100 text-amber-800 border border-amber-200 shadow-sm",
  vinculada: "bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm",
  descartada: "bg-slate-100 text-slate-500 border border-slate-200 shadow-sm",
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

function ConfirmacionCard({
  conf,
  onFacturar,
  onAbonar,
  onDescartar,
  onVincular,
  onDesvincular,
  onViewSale,
  onViewCredit,
  isAdmin
}) {
  const isPendiente = conf.estado === "pendiente";
  const isVinculada = conf.estado === "vinculada";
  const bankKey = conf.banco_origen?.toLowerCase() || "";
  const bankStyle = BANK_STYLES[bankKey] || {
    bg: "border-slate-200",
    badge: "bg-slate-100 text-slate-800 border-slate-200"
  };

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-all duration-200 ${
      isPendiente
        ? `border-amber-200 hover:border-amber-300 ${bankStyle.bg}`
        : isVinculada
          ? "border-emerald-200 hover:border-emerald-300 bg-emerald-50/5"
          : "border-slate-100 bg-slate-50/30 opacity-75"
    }`}>
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[conf.estado] || ""}`}>
              {ESTADO_ICON[conf.estado]}
              {conf.estado}
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${bankStyle.badge}`}>
              {BANCOS[conf.banco_origen] || conf.banco_origen || "Banco"}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo(conf.fecha_hora)}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl font-bold text-slate-800">{formatCOP(conf.monto)}</span>
            {conf.nombre_emisor && (
              <span className="text-sm text-slate-600 truncate">de <strong>{conf.nombre_emisor}</strong></span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            {conf.referencia && (
              <p className="text-xs text-slate-400">Ref: <span className="font-mono">{conf.referencia}</span></p>
            )}
            {conf.cuenta_destino && (
              <p className="text-xs text-slate-400">Cta. destino: <span className="font-mono">{conf.cuenta_destino}</span></p>
            )}

            {isVinculada && (
              <div className="pt-2 border-t mt-2 flex flex-col gap-1.5">
                {conf.venta_vinculada_id && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-500">Vinculada a:</span>
                    <button
                      onClick={() => onViewSale(conf.venta_vinculada_id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-0.5 hover:underline"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Venta #{conf.venta_vinculada_id.slice(-8)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                {conf.credito_vinculado_id && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-500">Vinculada a:</span>
                    <button
                      onClick={() => onViewCredit(conf.credito_vinculado_id)}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold inline-flex items-center gap-0.5 hover:underline"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Crédito #{conf.credito_vinculado_id.slice(-8)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                {conf.vinculado_por_user_id && (
                  <p className="text-[10px] text-slate-400 italic">
                    Conciliado por: {conf.vinculado_por_user_id}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-row sm:flex-col gap-1.5 w-full sm:w-auto shrink-0 justify-end flex-wrap">
          {isPendiente && (
            <>
              <Button size="sm" onClick={() => onFacturar(conf)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 flex-1 sm:flex-initial">
                <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                Facturar
              </Button>
              <Button size="sm" onClick={() => onAbonar(conf)} variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs h-8 flex-1 sm:flex-initial">
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                Abonar
              </Button>
              <Button size="sm" onClick={() => onVincular(conf)} variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs h-8 flex-1 sm:flex-initial">
                <LinkIcon className="w-3.5 h-3.5 mr-1" />
                Vincular
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDescartar(conf)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs h-8 w-full sm:w-auto">
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Descartar
              </Button>
            </>
          )}
          {isVinculada && isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => onDesvincular(conf)}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs h-8 w-full sm:w-auto mt-auto">
              <Unlink className="w-3.5 h-3.5 mr-1" />
              Desvincular
            </Button>
          )}
        </div>
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

function VincularExistenteModal({ conf, onClose, onLinked }) {
  const [activeTab, setActiveTab] = useState("ventas");
  const [sales, setSales] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [linkingId, setLinkingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "ventas") {
        const data = await Sale.filter({}, "-created_date", 50);
        setSales(data || []);
      } else {
        const data = await Credit.filter({}, "-created_date", 50);
        setCredits(data || []);
      }
    } catch (e) {
      console.error("[VincularExistenteModal] loadData", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLink = async (targetId) => {
    setLinkingId(targetId);
    try {
      const token = localStorage.getItem("equist_token") || "";
      const body = activeTab === "ventas" ? { venta_id: targetId } : { credito_id: targetId };
      const res = await fetch(`/api/confirmaciones/${conf.id}/vincular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onLinked();
      onClose();
    } catch (e) {
      alert("Error al vincular: " + e.message);
    } finally {
      setLinkingId(null);
    }
  };

  const cleanQuery = searchQuery.trim().toLowerCase();

  const filteredSales = sales
    .filter(sale => {
      if (!cleanQuery) return true;
      return (
        sale.id?.toLowerCase().includes(cleanQuery) ||
        sale.customer_name?.toLowerCase().includes(cleanQuery) ||
        sale.invoice_number?.toLowerCase().includes(cleanQuery)
      );
    })
    .sort((a, b) => {
      const matchA = a.total_amount === conf.monto ? 1 : 0;
      const matchB = b.total_amount === conf.monto ? 1 : 0;
      return matchB - matchA;
    });

  const filteredCredits = credits
    .filter(credit => {
      if (!cleanQuery) return true;
      return (
        credit.id?.toLowerCase().includes(cleanQuery) ||
        credit.customer_name?.toLowerCase().includes(cleanQuery) ||
        credit.sale_id?.toLowerCase().includes(cleanQuery)
      );
    })
    .sort((a, b) => {
      const matchA = a.pending_amount === conf.monto ? 1 : 0;
      const matchB = b.pending_amount === conf.monto ? 1 : 0;
      return matchB - matchA;
    });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-indigo-600" />
            Vincular transferencia de {formatCOP(conf.monto)}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Emisor: {conf.nombre_emisor || "Desconocido"} {conf.referencia ? `· Ref: ${conf.referencia}` : ""}
          </p>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-2 mb-3">
          <button
            onClick={() => setActiveTab("ventas")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === "ventas" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Ventas Recientes
          </button>
          <button
            onClick={() => setActiveTab("creditos")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === "creditos" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Créditos Activos
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder={activeTab === "ventas" ? "Buscar por cliente, nro factura..." : "Buscar por cliente..."}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px] pr-1 space-y-2">
          {loading ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : activeTab === "ventas" ? (
            filteredSales.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">No se encontraron ventas</p>
            ) : (
              filteredSales.map((sale) => {
                const isExactMatch = sale.total_amount === conf.monto;
                return (
                  <div
                    key={sale.id}
                    className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-all ${
                      isExactMatch ? "bg-emerald-50/50 border-emerald-200" : "bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm">
                          {sale.invoice_number ? `Factura ${sale.invoice_number}` : `Venta #${sale.id?.slice(-8)}`}
                        </span>
                        {isExactMatch && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px]">
                            Monto Coincide
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Cliente: {sale.customer_name || "Cliente General"}</p>
                      <p className="text-[11px] text-slate-400">
                        Fecha: {new Date(sale.sale_date || sale.created_date).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800">{formatCOP(sale.total_amount)}</span>
                      <Button
                        size="sm"
                        disabled={linkingId === sale.id}
                        onClick={() => handleLink(sale.id)}
                        className={`text-xs ${isExactMatch ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        {linkingId === sale.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Vincular"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredCredits.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">No se encontraron créditos</p>
            ) : (
              filteredCredits.map((credit) => {
                const isExactMatch = credit.pending_amount === conf.monto;
                return (
                  <div
                    key={credit.id}
                    className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-all ${
                      isExactMatch ? "bg-emerald-50/50 border-emerald-200" : "bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm">
                          Crédito de {credit.customer_name}
                        </span>
                        {isExactMatch && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px]">
                            Monto Coincide
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Monto total: {formatCOP(credit.total_amount)}</p>
                      <p className="text-[11px] text-slate-400">
                        Vence: {new Date(credit.due_date).toLocaleDateString("es-CO", { dateStyle: "short" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-slate-800">{formatCOP(credit.pending_amount)}</p>
                        <p className="text-[10px] text-slate-400">pendiente</p>
                      </div>
                      <Button
                        size="sm"
                        disabled={linkingId === credit.id}
                        onClick={() => handleLink(credit.id)}
                        className={`text-xs ${isExactMatch ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        {linkingId === credit.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Vincular"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
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
  const { currentUser, userRole } = useSession();
  const [confirmaciones, setConfirmaciones] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [bancoFilter, setBancoFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [showSimular, setShowSimular] = useState(false);
  const [vincularConf, setVincularConf] = useState(null);
  const [descartando, setDescartando] = useState(null);

  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState(null);
  const [selectedCreditForDetail, setSelectedCreditForDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || userRole?.name === 'Administrador';

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem("equist_token") || "";
      const res = await fetch(`/api/confirmaciones?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setConfirmaciones(Array.isArray(data) ? data : []);
      setUltimaSync(new Date());
    } catch (e) {
      console.error("[ConfirmacionesBancarias] load", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleDesvincular = async (conf) => {
    if (!window.confirm(`¿Seguro que deseas desvincular la transferencia de ${formatCOP(conf.monto)} de ${conf.nombre_emisor || "emisor desconocido"}? Esto volverá a dejar la transferencia pendiente.`)) return;
    try {
      const token = localStorage.getItem("equist_token") || "";
      const res = await fetch(`/api/confirmaciones/${conf.id}/desvincular`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      load();
    } catch (e) {
      alert("Error al desvincular: " + e.message);
    }
  };

  const handleViewSale = async (saleId) => {
    setLoadingDetail(true);
    try {
      const s = await Sale.get(saleId);
      if (s) {
        setSelectedSaleForDetail(s);
      } else {
        alert("No se encontró la venta vinculada.");
      }
    } catch (e) {
      alert("Error al abrir venta: " + e.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleViewCredit = async (creditId) => {
    setLoadingDetail(true);
    try {
      const c = await Credit.get(creditId);
      if (c) {
        setSelectedCreditForDetail(c);
      } else {
        alert("No se encontró el crédito vinculado.");
      }
    } catch (e) {
      alert("Error al abrir crédito: " + e.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const stats = {
    pendiente: { monto: 0, count: 0 },
    vinculada: { monto: 0, count: 0 },
    descartada: { monto: 0, count: 0 },
  };

  confirmaciones.forEach((c) => {
    if (stats[c.estado]) {
      stats[c.estado].monto += Number(c.monto || 0);
      stats[c.estado].count += 1;
    }
  });

  const filteredList = confirmaciones.filter((c) => {
    if (filtro !== "todas" && c.estado !== filtro) return false;
    if (bancoFilter !== "todos" && c.banco_origen?.toLowerCase() !== bancoFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchEmitter = c.nombre_emisor?.toLowerCase().includes(q);
      const matchRef = c.referencia?.toLowerCase().includes(q);
      const matchDest = c.cuenta_destino?.toLowerCase().includes(q);
      const matchMonto = String(c.monto || "").includes(q);
      const matchBank = BANCOS[c.banco_origen]?.toLowerCase().includes(q) || c.banco_origen?.toLowerCase().includes(q);

      if (!matchEmitter && !matchRef && !matchDest && !matchMonto && !matchBank) {
        return false;
      }
    }
    return true;
  });

  const total = filteredList.length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">Confirmaciones Bancarias</h1>
            {stats.pendiente.count > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {stats.pendiente.count}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {ultimaSync
              ? `Actualizado a las ${ultimaSync.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Auto-actualización activa`
              : "Cargando..."}
            {loadingDetail && " · Cargando detalle..."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="hover:bg-slate-100">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowSimular(true)} variant="outline"
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold shadow-sm">
            <Plus className="w-4 h-4 mr-1" />
            Simular
          </Button>
        </div>
      </div>

      {/* Panel de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-100 bg-amber-50/10 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Monto Pendiente</p>
              <h3 className="text-xl font-bold text-amber-900 mt-1">{formatCOP(stats.pendiente.monto)}</h3>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                {stats.pendiente.count} tr.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/10 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Monto Conciliado</p>
              <h3 className="text-xl font-bold text-emerald-900 mt-1">{formatCOP(stats.vinculada.monto)}</h3>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                {stats.vinculada.count} tr.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/10 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Monto Descartado</p>
              <h3 className="text-xl font-bold text-slate-800 mt-1">{formatCOP(stats.descartada.monto)}</h3>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600">
                {stats.descartada.count} tr.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de Filtrado y Búsqueda */}
      <div className="bg-slate-50/50 border rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por emisor, monto, referencia..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={bancoFilter} onValueChange={setBancoFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filtrar por banco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los bancos</SelectItem>
                {Object.entries(BANCOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filtros de Estado */}
        <div className="flex gap-2 flex-wrap border-t pt-3">
          {FILTROS.map(({ key, label }) => {
            const count = key === "todas" ? confirmaciones.length : stats[key]?.count;
            return (
              <button key={key} onClick={() => setFiltro(key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  filtro === key
                    ? "bg-indigo-600 text-white shadow-md border-indigo-600"
                    : "bg-white text-slate-600 border hover:bg-slate-50"
                }`}>
                <span>{label}</span>
                {count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                    filtro === key
                      ? "bg-indigo-700 text-indigo-100 font-bold"
                      : "bg-slate-100 text-slate-500 font-semibold"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-20 bg-slate-50/20 border border-dashed rounded-xl shadow-sm">
          <Building2 className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold text-lg">
            No se encontraron transferencias
          </p>
          <p className="text-sm text-slate-300 mt-1 max-w-sm mx-auto">
            Ajusta los filtros o realiza una nueva búsqueda. Las transferencias automáticas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((conf) => (
            <ConfirmacionCard
              key={conf.id}
              conf={conf}
              onFacturar={handleFacturar}
              onAbonar={handleAbonar}
              onVincular={(c) => setVincularConf(c)}
              onDesvincular={handleDesvincular}
              onViewSale={handleViewSale}
              onViewCredit={handleViewCredit}
              onDescartar={descartando === conf.id ? () => {} : handleDescartar}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {showSimular && (
        <SimularModal onClose={() => setShowSimular(false)} onCreated={load} />
      )}

      {vincularConf && (
        <VincularExistenteModal
          conf={vincularConf}
          onClose={() => setVincularConf(null)}
          onLinked={load}
        />
      )}

      {selectedSaleForDetail && (
        <SaleDetailModal
          sale={selectedSaleForDetail}
          onClose={() => setSelectedSaleForDetail(null)}
        />
      )}

      {selectedCreditForDetail && (
        <CreditDetailModal
          credit={selectedCreditForDetail}
          onClose={() => setSelectedCreditForDetail(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
