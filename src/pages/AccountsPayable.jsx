import React, { useState, useEffect, useMemo } from "react";
import { AccountPayable, PayablePayment, Supplier, Location, Expense, Presupuesto, Inventario, FixedExpense } from "@/entities/all";
import { localClient } from "@/api/localClient";
import { useSession } from "../components/providers/SessionProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, DollarSign, AlertCircle, TrendingUp, Loader2, Package, ShoppingCart,
  ChevronDown, ChevronUp, CheckCircle2, Users, Wrench, BarChart3, Building2,
  Calendar, Clock, CreditCard, Edit2, Trash2, Repeat, CircleDollarSign,
  PackageOpen, ArrowUpRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PayableForm from "../components/payables/PayableForm";
import PayableList from "../components/payables/PayableList";
import PaymentModal from "../components/payables/PaymentModal";
import InstallmentsManager from "../components/payables/InstallmentsManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const URGENCY = (dueDate) => {
  if (!dueDate) return 'sin_fecha';
  const diff = (new Date(dueDate) - new Date()) / 86400000;
  if (diff < 0) return 'vencida';
  if (diff <= 7) return 'urgente';
  if (diff <= 30) return 'proximo';
  return 'futuro';
};

const URGENCY_STYLES = {
  vencida:   { label: 'Vencida',       bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  urgente:   { label: 'Esta semana',   bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700',dot: 'bg-amber-500' },
  proximo:   { label: 'Este mes',      bg: 'bg-blue-50',   border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500' },
  futuro:    { label: 'Próximas',      bg: 'bg-slate-50',  border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600',dot: 'bg-slate-400' },
  sin_fecha: { label: 'Sin fecha',     bg: 'bg-slate-50',  border: 'border-slate-200', badge: 'bg-slate-100 text-slate-500',dot: 'bg-slate-300' },
};

const CATEGORY_META = {
  manufacturing_salary:  { label: 'Operarios',       icon: Users,             color: 'text-violet-600', bg: 'bg-violet-100' },
  materia_prima_credito: { label: 'Mat. Prima',       icon: Package,           color: 'text-emerald-600',bg: 'bg-emerald-100' },
  gasto_fijo:            { label: 'Gasto Fijo',       icon: Repeat,            color: 'text-blue-600',   bg: 'bg-blue-100' },
  gasto_variable:        { label: 'Gasto Variable',   icon: ArrowUpRight,      color: 'text-orange-600', bg: 'bg-orange-100' },
  otros:                 { label: 'Otros',             icon: CircleDollarSign,  color: 'text-slate-600',  bg: 'bg-slate-100' },
};

const getCategoryMeta = (item) => {
  if (item._isOperario || item.type === 'manufacturing_salary' || item.category === 'salarios_manufactura')
    return CATEGORY_META.manufacturing_salary;
  const cat = item.category || item.type || 'otros';
  return CATEGORY_META[cat] || CATEGORY_META.otros;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

const PERIODICIDAD_LABELS = {
  mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral',
  semestral: 'Semestral', anual: 'Anual',
};

// Decide si un gasto fijo debe generar una CxP este mes
function deberiGenerarEsteMes(gasto) {
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  if (gasto.ultima_generacion === mesActual) return false;
  if (!gasto.ultima_generacion) return true;
  const [y, m] = gasto.ultima_generacion.split('-').map(Number);
  const lastDate = new Date(y, m - 1, 1);
  const { periodicidad } = gasto;
  const mesesMap = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
  const meses = mesesMap[periodicidad] || 1;
  lastDate.setMonth(lastDate.getMonth() + meses);
  return lastDate <= hoy;
}

// ─── Modal: Comprar Material (con opción de crédito) ─────────────────────────
function ComprarMaterialModal({ item, onConfirm, onCancel }) {
  const [cantidad, setCantidad] = useState(String(item.cantidad_pendiente));
  const [precio, setPrecio] = useState(String(item.precio_unitario || ""));
  const [proveedor, setProveedor] = useState("");
  const [esCredito, setEsCredito] = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [loading, setLoading] = useState(false);

  const cantNum = parseFloat(cantidad) || 0;
  const precioNum = parseFloat(precio) || 0;
  const exceso = Math.max(0, cantNum - item.cantidad_pendiente);
  const totalCompra = cantNum * precioNum;

  const estadoBadge = {
    borrador: "bg-slate-100 text-slate-700", enviado: "bg-blue-100 text-blue-700",
    aprobado: "bg-emerald-100 text-emerald-700", rechazado: "bg-red-100 text-red-700",
  };

  const handleConfirm = async () => {
    if (cantNum <= 0) return;
    if (esCredito && !fechaVencimiento) { alert("Indica la fecha de pago del crédito"); return; }
    setLoading(true);
    await onConfirm({ cantidad: cantNum, precioUnitario: precioNum, proveedor, esCredito, fechaVencimiento });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">Registrar Compra</h2>
          <p className="text-sm text-slate-500 mt-0.5">{item.nombre}{item.color && item.color !== "sin definir" ? ` · ${item.color}` : ""}</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Info presupuesto */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Presupuesto</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item._presupuesto.numero_presupuesto}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[item._presupuesto.estado] || "bg-slate-100 text-slate-700"}`}>
                  {item._presupuesto.estado}
                </span>
              </div>
            </div>
            {item._presupuesto.cliente && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cliente</span>
                <span className="font-medium">{item._presupuesto.cliente}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-1 mt-1">
              <span className="text-slate-700 font-medium">Pendiente</span>
              <span className="font-bold text-amber-700">{item.cantidad_pendiente.toFixed(2)} {item.unidad_medida}</span>
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Cantidad a comprar *</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="number" min="0.01" step="0.01" value={cantidad}
                onChange={e => setCantidad(e.target.value)} className="flex-1" />
              <span className="text-sm text-slate-500 shrink-0">{item.unidad_medida}</span>
            </div>
            {exceso > 0 && (
              <p className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">
                Excedente de <strong>{exceso.toFixed(2)} {item.unidad_medida}</strong> → irá al inventario
              </p>
            )}
          </div>

          {/* Precio */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Precio unitario</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500">$</span>
              <Input type="number" min="0" step="0.01" value={precio}
                onChange={e => setPrecio(e.target.value)} className="flex-1" />
            </div>
            {cantNum > 0 && precioNum > 0 && (
              <p className="text-xs text-slate-500 mt-1">Total: <strong>{fmtMoney(totalCompra)}</strong></p>
            )}
          </div>

          {/* Proveedor */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Proveedor</Label>
            <Input className="mt-1" value={proveedor} onChange={e => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor" />
          </div>

          {/* ¿Compra a crédito? */}
          <div className="border rounded-lg p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={esCredito} onChange={e => setEsCredito(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm font-medium text-slate-700">Compra a crédito</span>
              <span className="text-xs text-slate-400">(el material entra al inventario ahora, se paga después)</span>
            </label>
            {esCredito && (
              <div>
                <Label className="text-sm font-medium text-slate-700">Fecha límite de pago *</Label>
                <Input type="date" className="mt-1" value={fechaVencimiento}
                  onChange={e => setFechaVencimiento(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || cantNum <= 0}
            className={esCredito ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {esCredito ? <><CreditCard className="w-3.5 h-3.5 mr-1.5" />Comprar a Crédito</> : "Confirmar Compra"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Gasto Variable rápido ─────────────────────────────────────────────
function GastoVariableModal({ locations, userLocation, onConfirm, onCancel }) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!nombre || !monto) return;
    setLoading(true);
    await onConfirm({ nombre, monto: parseFloat(monto), proveedor, fechaVenc, notas });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">Nuevo Gasto Variable</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gasto no recurrente que se pagará después</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <Label>Descripción *</Label>
            <Input className="mt-1" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Flete, reparación, imprevistos…" />
          </div>
          <div>
            <Label>Monto *</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500">$</span>
              <Input type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Proveedor / Beneficiario</Label>
            <Input className="mt-1" value={proveedor} onChange={e => setProveedor(e.target.value)} />
          </div>
          <div>
            <Label>Fecha límite de pago</Label>
            <Input type="date" className="mt-1" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea className="mt-1" value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || !nombre || !monto} className="bg-orange-600 hover:bg-orange-700">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar Gasto
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Gasto Fijo (template) ─────────────────────────────────────────────
function GastoFijoModal({ gasto, onConfirm, onCancel }) {
  const [nombre, setNombre] = useState(gasto?.nombre || '');
  const [monto, setMonto] = useState(String(gasto?.monto || ''));
  const [dia, setDia] = useState(String(gasto?.dia_vencimiento || ''));
  const [periodicidad, setPeriodicidad] = useState(gasto?.periodicidad || 'mensual');
  const [categoria, setCategoria] = useState(gasto?.categoria || 'servicios');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!nombre || !monto) return;
    setLoading(true);
    await onConfirm({ nombre, monto: parseFloat(monto), dia_vencimiento: parseInt(dia) || null, periodicidad, categoria });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">{gasto ? 'Editar' : 'Nuevo'} Gasto Fijo</h2>
          <p className="text-sm text-slate-500 mt-0.5">Compromiso recurrente predecible</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <Label>Nombre *</Label>
            <Input className="mt-1" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Arriendo, Internet, Servicios…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto *</Label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-slate-500 text-sm">$</span>
                <Input type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Día de vencimiento</Label>
              <Input type="number" min="1" max="31" className="mt-1" value={dia}
                onChange={e => setDia(e.target.value)} placeholder="1-31" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodicidad</Label>
              <select value={periodicidad} onChange={e => setPeriodicidad(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(PERIODICIDAD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Categoría</Label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="servicios">Servicios</option>
                <option value="arriendo">Arriendo</option>
                <option value="nomina_adm">Nómina Administrativa</option>
                <option value="seguros">Seguros</option>
                <option value="otros_fijos">Otros fijos</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || !nombre || !monto} className="bg-blue-600 hover:bg-blue-700">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {gasto ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila material pendiente ───────────────────────────────────────────────────
function MaterialPendienteRow({ item, onComprar }) {
  const [expanded, setExpanded] = useState(false);
  const porcentaje = item.cantidad_total > 0 ? (item.cantidad_comprada / item.cantidad_total) * 100 : 0;

  const estadoBadge = {
    borrador: "bg-slate-100 text-slate-600", enviado: "bg-blue-100 text-blue-700",
    aprobado: "bg-emerald-100 text-emerald-700", rechazado: "bg-red-100 text-red-700",
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm">{item.nombre}</span>
            {item.color && item.color !== "sin definir" && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.color}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[item._presupuesto.estado] || "bg-slate-100 text-slate-600"}`}>
              {item._presupuesto.estado}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {item._presupuesto.numero_presupuesto}
            {item._presupuesto.cliente ? ` · ${item._presupuesto.cliente}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, porcentaje)}%` }} />
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              {item.cantidad_comprada}/{item.cantidad_total} {item.unidad_medida}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900">{fmtMoney(item.costo_pendiente)}</p>
          <p className="text-xs text-slate-500">pendiente</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={() => onComprar(item)} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-2">
            <ShoppingCart className="w-3 h-3 mr-1" /> Comprar
          </Button>
          {item.compras_historico.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {expanded && item.compras_historico.length > 0 && (
        <div className="border-t bg-slate-50 px-4 py-2 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Historial de compras</p>
          {item.compras_historico.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>{h.fecha}</span>
                {h.proveedor && <span className="text-slate-400">· {h.proveedor}</span>}
                {h.esCredito && <span className="text-blue-500 font-medium">· Crédito</span>}
              </div>
              <span className="font-medium">{h.cantidad} {item.unidad_medida} {h.precio_unitario ? `· $${h.precio_unitario}/u` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de item en vista unificada (con historial de abonos) ────────────
function PendienteCard({ item, onPayment, onDelete, abonos = [] }) {
  const [expanded, setExpanded] = useState(false);
  const urgency = URGENCY(item.due_date);
  const uStyle = URGENCY_STYLES[urgency];
  const catMeta = getCategoryMeta(item);
  const CatIcon = catMeta.icon;

  const totalAbonado = abonos.reduce((s, a) => s + (a.amount || 0), 0);
  const saldoActual = (item.total_amount || 0) - totalAbonado;
  const hasAbonos = abonos.length > 0;
  const hasPartial = item.paid_amount > 0 || hasAbonos;

  const METHOD_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', fuera_de_caja: 'Fuera de caja', check: 'Cheque', other: 'Otro' };

  return (
    <div className={`border rounded-lg overflow-hidden ${uStyle.border}`}>
      <div className={`p-3 sm:p-4 flex items-center gap-3 ${uStyle.bg}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${catMeta.bg}`}>
          <CatIcon className={`w-4 h-4 ${catMeta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm truncate">{item.description || item.supplier_name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catMeta.bg} ${catMeta.color}`}>
              {catMeta.label}
            </span>
          </div>
          {item.supplier_name && item.description && item.supplier_name !== item.description && (
            <p className="text-xs text-slate-500 truncate">{item.supplier_name}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{fmtDate(item.due_date)}</span>
            </div>
            {urgency === 'vencida' && <span className="text-xs font-semibold text-red-600">Vencida</span>}
            {hasPartial && (
              <span className="text-xs text-emerald-600 font-medium">
                {fmtMoney(totalAbonado || item.paid_amount)} abonado
              </span>
            )}
          </div>
          {/* Barra de progreso si hay abonos */}
          {item.total_amount > 0 && hasPartial && (
            <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden w-full max-w-[200px]">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, ((totalAbonado || item.paid_amount) / item.total_amount) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900">{fmtMoney(item.pending_amount ?? saldoActual)}</p>
          {item.total_amount && hasPartial && (
            <p className="text-xs text-slate-400">de {fmtMoney(item.total_amount)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={() => onPayment(item)}
            className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-2">
            Pagar
          </Button>
          {item._isOperario && onDelete && (
            <button onClick={() => onDelete(item)}
              className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          )}
          {hasAbonos && (
            <button onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-white/60 text-slate-400">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Historial de abonos */}
      {expanded && hasAbonos && (
        <div className="border-t bg-white px-4 py-2 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Historial de abonos</p>
          {abonos.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-slate-600 py-0.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                <span>{fmtDate(a.payment_date)}</span>
                <span className="text-slate-400">{METHOD_LABELS[a.method] || a.method || ''}</span>
                {a.reference && <span className="text-slate-300">· {a.reference}</span>}
              </div>
              <span className="font-semibold text-slate-800">{fmtMoney(a.amount)}</span>
            </div>
          ))}
          <div className="border-t mt-1 pt-1 flex justify-between text-xs font-semibold">
            <span className="text-slate-500">Saldo actual</span>
            <span className="text-slate-900">{fmtMoney(item.pending_amount ?? saldoActual)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function AccountsPayablePage() {
  const { currentUser, userLocation, userRole, isLoading: isSessionLoading } = useSession();

  const [payables, setPayables] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [opPayments, setOpPayments] = useState([]);
  const [opEmployees, setOpEmployees] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [gastosFixed, setGastosFixed] = useState([]);
  const [allAbonos, setAllAbonos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [editingPayable, setEditingPayable] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [installmentsFor, setInstallmentsFor] = useState(null);
  const [activeTab, setActiveTab] = useState("pendientes");
  const [comprandoMaterial, setComprandoMaterial] = useState(null);
  const [filtroEstadoPres, setFiltroEstadoPres] = useState("all");
  const [showGastoVariable, setShowGastoVariable] = useState(false);
  const [showGastoFijo, setShowGastoFijo] = useState(false);
  const [editandoGastoFijo, setEditandoGastoFijo] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('all');

  useEffect(() => { if (!isSessionLoading) loadData(); }, [isSessionLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPayables, allSuppliers, allLocations, allOpPayments, allEmployees,
        allPresupuestos, allInventario, allGastosFijos, allPayablePayments] = await Promise.all([
        AccountPayable.list("-created_date", 500),
        Supplier.list(),
        Location.list(),
        localClient.entities.Payment.list('-payment_date'),
        localClient.entities.Employee.list(),
        Presupuesto.list("-created_date", 200),
        Inventario.list("-updated_date", 300),
        FixedExpense.list(),
        PayablePayment.list('-payment_date', 1000),
      ]);
      setPayables(allPayables || []);
      setSuppliers(allSuppliers || []);
      setLocations(allLocations || []);
      setOpPayments((allOpPayments || []).filter(p => p.status === 'registrado'));
      setOpEmployees(allEmployees || []);
      setPresupuestos((allPresupuestos || []).filter(p => p.estado !== 'rechazado'));
      setInventario(allInventario || []);
      setGastosFixed(allGastosFijos || []);
      setAllAbonos(allPayablePayments || []);
    } catch (err) {
      console.error("Error loading data:", err);
    }
    setIsLoading(false);
  };

  // ── Materiales pendientes de presupuestos ──────────────────────────────────
  const materialesPendientes = useMemo(() => {
    const result = [];
    for (const pres of presupuestos) {
      for (const mat of (pres.materiales_calculados || [])) {
        const pendiente = (mat.cantidad_total || 0) - (mat.cantidad_comprada || 0);
        if (pendiente > 0.001) {
          result.push({
            _presupuesto: { id: pres.id, numero_presupuesto: pres.numero_presupuesto, cliente: pres.cliente, estado: pres.estado },
            materia_prima_id: mat.materia_prima_id,
            nombre: mat.nombre, color: mat.color,
            unidad_medida: mat.unidad_medida,
            precio_unitario: mat.precio_unitario || 0,
            cantidad_total: mat.cantidad_total || 0,
            cantidad_comprada: mat.cantidad_comprada || 0,
            cantidad_pendiente: pendiente,
            costo_pendiente: pendiente * (mat.precio_unitario || 0),
            compras_historico: mat.compras_historico || [],
          });
        }
      }
    }
    return result;
  }, [presupuestos]);

  const materialesFiltrados = useMemo(() =>
    filtroEstadoPres === "all" ? materialesPendientes
      : materialesPendientes.filter(m => m._presupuesto.estado === filtroEstadoPres),
    [materialesPendientes, filtroEstadoPres]);

  // ── Operarios → filas CxP ──────────────────────────────────────────────────
  const operarioPayables = useMemo(() => opPayments.map(op => {
    const emp = opEmployees.find(e => e.employee_id === op.employee_id);
    return {
      id: `op_${op.id}`, _opPaymentId: op.id, _isOperario: true,
      supplier_name: emp?.name || op.employee_id,
      description: `Pago operario — ${emp?.name || op.employee_id}`,
      type: 'manufacturing_salary', category: 'salarios_manufactura',
      status: 'pending', total_amount: op.amount, pending_amount: op.amount,
      paid_amount: 0, due_date: op.payment_date, created_date: op.payment_date,
    };
  }), [opPayments, opEmployees]);

  // ── Lista unificada pendiente ──────────────────────────────────────────────
  const allPending = useMemo(() => {
    const fromDb = payables.filter(p => p.status === 'pending' || p.status === 'partial');
    return [...fromDb, ...operarioPayables].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [payables, operarioPayables]);

  // ── Resumen por urgencia ──────────────────────────────────────────────────
  const byUrgency = useMemo(() => {
    const groups = { vencida: [], urgente: [], proximo: [], futuro: [], sin_fecha: [] };
    for (const item of allPending) groups[URGENCY(item.due_date)].push(item);
    return groups;
  }, [allPending]);

  // ── Balance por proveedor (solo CxP reales, sin operarios) ───────────────
  const supplierBalances = useMemo(() => {
    const map = {};
    for (const p of allPending) {
      if (p._isOperario) continue; // los operarios tienen su propio módulo
      const name = p.supplier_name || '(Sin proveedor)';
      if (!map[name]) map[name] = { name, total: 0, count: 0, items: [] };
      map[name].total += p.pending_amount || 0;
      map[name].count += 1;
      map[name].items.push(p);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [allPending]);

  // ── Gastos fijos que necesitan generar CxP este mes ─────────────────────
  const gastosFijosPendientesGenerar = useMemo(
    () => gastosFixed.filter(g => g.is_active && deberiGenerarEsteMes(g)),
    [gastosFixed]
  );

  // ── Totales ──────────────────────────────────────────────────────────────
  const totalPending = allPending.reduce((s, p) => s + (p.pending_amount || 0), 0);
  const totalVencido = byUrgency.vencida.reduce((s, p) => s + (p.pending_amount || 0), 0);
  const totalMateriales = materialesFiltrados.reduce((s, m) => s + m.costo_pendiente, 0);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSave = async (data) => {
    try {
      if (editingPayable) {
        await AccountPayable.update(editingPayable.id, data);
      } else {
        await AccountPayable.create(data);
      }
      await loadData();
      setShowForm(false);
      setEditingPayable(null);
    } catch (err) {
      console.error("Error saving:", err);
      alert("Error al guardar la cuenta por pagar");
    }
  };

  const handlePaymentConfirm = async (paymentData) => {
    try {
      const payable = paymentModalData;
      const newPaidAmount = (payable.paid_amount || 0) + paymentData.amount;
      const newPendingAmount = payable.total_amount - newPaidAmount;
      const newStatus = newPendingAmount <= 0 ? "paid" : "partial";

      const payment = await PayablePayment.create({
        payable_id: payable.id,
        payment_date: new Date().toISOString(),
        amount: paymentData.amount,
        method: paymentData.method,
        reference: paymentData.reference || "",
        bank_account_id: paymentData.bank_account_id || null,
        location_id: paymentData.location_id,
        notes: paymentData.notes || "",
      });

      if (paymentData.method === "cash" && !paymentData.skip_cash_control) {
        const expense = await Expense.create({
          description: `Pago a ${payable.supplier_name} - ${payable.description}`,
          amount: paymentData.amount,
          category: payable.category || "otros",
          expense_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
          location_id: paymentData.location_id,
          payment_method: "cash",
          receipt_number: paymentData.reference || "",
          supplier: payable.supplier_name,
          notes: `Abono a cuenta por pagar #${payable.id}`,
        });
        await PayablePayment.update(payment.id, { expense_id: expense.id });
      }

      if (payable._isOperario) {
        await localClient.entities.Payment.update(payable._opPaymentId, { status: 'ejecutado' });
      } else {
        await AccountPayable.update(payable.id, {
          paid_amount: newPaidAmount, pending_amount: newPendingAmount, status: newStatus,
        });
      }

      await loadData();
      setPaymentModalData(null);
    } catch (err) {
      console.error("Error processing payment:", err);
      alert("Error al procesar el pago");
    }
  };

  // Comprar material (al contado o a crédito)
  const handleComprarMaterial = async ({ cantidad, precioUnitario, proveedor, esCredito, fechaVencimiento }) => {
    const item = comprandoMaterial;
    try {
      const pres = presupuestos.find(p => p.id === item._presupuesto.id);
      if (!pres) throw new Error("Presupuesto no encontrado");

      const exceso = Math.max(0, cantidad - item.cantidad_pendiente);
      // Cantidad que va al inventario: si es crédito → TODO; si no → solo excedente
      const cantInventario = esCredito ? cantidad : exceso;

      // 1. Actualizar presupuesto
      const materialesActualizados = (pres.materiales_calculados || []).map(mat => {
        if (mat.materia_prima_id === item.materia_prima_id && mat.color === item.color) {
          return {
            ...mat,
            cantidad_comprada: (mat.cantidad_comprada || 0) + cantidad,
            comprado: (mat.cantidad_comprada || 0) + cantidad >= (mat.cantidad_total || 0),
            compras_historico: [
              ...(mat.compras_historico || []),
              {
                fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
                cantidad, proveedor: proveedor || "",
                precio_unitario: precioUnitario,
                esCredito: esCredito || false,
              },
            ],
          };
        }
        return mat;
      });
      await Presupuesto.update(pres.id, { materiales_calculados: materialesActualizados });

      // 2. Inventario
      if (cantInventario > 0.001) {
        const movimiento = {
          id: `mov_${Date.now()}`,
          fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
          tipo: 'entrada',
          cantidad: cantInventario,
          referencia: item._presupuesto.numero_presupuesto,
          nota: esCredito ? `Compra a crédito — ${item._presupuesto.numero_presupuesto}` : `Excedente — ${item._presupuesto.numero_presupuesto}`,
        };
        const existing = inventario.find(i => i.materia_prima_id === item.materia_prima_id && (i.color || '') === (item.color || ''));
        if (existing) {
          await Inventario.update(existing.id, {
            cantidad_disponible: (existing.cantidad_disponible || 0) + cantInventario,
            movimientos: [...(existing.movimientos || []), movimiento],
          });
        } else {
          await Inventario.create({
            materia_prima_id: item.materia_prima_id, materia_prima_nombre: item.nombre,
            color: item.color || '', unidad_medida: item.unidad_medida || 'unidad',
            cantidad_disponible: cantInventario, movimientos: [movimiento],
          });
        }
      }

      // 3. Si es crédito → crear CxP
      if (esCredito && precioUnitario > 0) {
        const totalDeuda = cantidad * precioUnitario;
        await AccountPayable.create({
          supplier_name: proveedor || 'Proveedor sin nombre',
          description: `Materia prima a crédito: ${item.nombre}${item.color && item.color !== 'sin definir' ? ` (${item.color})` : ''} — ${item._presupuesto.numero_presupuesto}`,
          category: 'materia_prima_credito',
          type: 'materia_prima_credito',
          total_amount: totalDeuda,
          pending_amount: totalDeuda,
          paid_amount: 0,
          status: 'pending',
          due_date: fechaVencimiento ? new Date(fechaVencimiento).toISOString() : null,
          notes: `${cantidad} ${item.unidad_medida} × $${precioUnitario}`,
        });
      }

      await loadData();
      setComprandoMaterial(null);
    } catch (err) {
      console.error("Error registrando compra:", err);
      alert("Error al registrar la compra");
    }
  };

  // Gasto variable rápido
  const handleGastoVariable = async ({ nombre, monto, proveedor, fechaVenc, notas }) => {
    try {
      await AccountPayable.create({
        supplier_name: proveedor || '',
        description: nombre,
        category: 'gasto_variable',
        type: 'gasto_variable',
        total_amount: monto, pending_amount: monto, paid_amount: 0,
        status: 'pending',
        due_date: fechaVenc ? new Date(fechaVenc).toISOString() : null,
        notes: notas || '',
      });
      await loadData();
      setShowGastoVariable(false);
    } catch (err) {
      console.error(err);
      alert("Error al registrar el gasto");
    }
  };

  // Crear / editar gasto fijo (plantilla)
  const handleGastoFijo = async (data) => {
    try {
      if (editandoGastoFijo) {
        await FixedExpense.update(editandoGastoFijo.id, data);
      } else {
        await FixedExpense.create({ ...data, is_active: true, ultima_generacion: null });
      }
      await loadData();
      setShowGastoFijo(false);
      setEditandoGastoFijo(null);
    } catch (err) {
      console.error(err);
      alert("Error al guardar el gasto fijo");
    }
  };

  // Generar CxP de un gasto fijo para el mes actual
  const handleGenerarGastoFijo = async (gasto) => {
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = gasto.dia_vencimiento
      ? new Date(hoy.getFullYear(), hoy.getMonth(), gasto.dia_vencimiento).toISOString()
      : null;

    try {
      await AccountPayable.create({
        supplier_name: gasto.nombre,
        description: `${gasto.nombre} — ${mesActual}`,
        category: 'gasto_fijo',
        type: 'gasto_fijo',
        total_amount: gasto.monto, pending_amount: gasto.monto, paid_amount: 0,
        status: 'pending',
        due_date: dueDate,
        notes: `Generado automáticamente de gasto fijo · ${PERIODICIDAD_LABELS[gasto.periodicidad] || gasto.periodicidad}`,
      });
      await FixedExpense.update(gasto.id, { ultima_generacion: mesActual });
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Error al generar la CxP");
    }
  };

  const handleDeleteOperarioPayment = async (item) => {
    if (!confirm(`¿Eliminar el pago de ${item.supplier_name} por ${fmtMoney(item.total_amount)}? Esta acción no se puede deshacer.`)) return;
    try {
      await localClient.entities.Payment.delete(item._opPaymentId);
      await loadData();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleToggleGastoFijo = async (gasto) => {
    await FixedExpense.update(gasto.id, { is_active: !gasto.is_active });
    await loadData();
  };

  const handleDeleteGastoFijo = async (id) => {
    if (!confirm("¿Eliminar esta plantilla de gasto fijo?")) return;
    await FixedExpense.delete(id);
    await loadData();
  };

  if (isSessionLoading || isLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const isAdmin = currentUser?.role === 'admin' || userRole?.name === 'Administrador';
  const paidPayables = payables.filter(p => p.status === 'paid');

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cuentas por Pagar</h1>
            <p className="text-slate-600 mt-1 text-sm">Obligaciones pendientes ordenadas por vencimiento</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowGastoVariable(true)} className="gap-1.5 text-xs sm:text-sm">
              <ArrowUpRight className="w-4 h-4" /> Gasto Variable
            </Button>
            <Button onClick={() => { setEditingPayable(null); setShowForm(true); }} className="gap-1.5 text-xs sm:text-sm">
              <Plus className="w-4 h-4" /> Nueva CxP
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-5">
              <p className="text-xs text-slate-500">Total pendiente</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{fmtMoney(totalPending)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-3 sm:p-5">
              <p className="text-xs text-red-500">Vencidas</p>
              <p className="text-xl font-bold text-red-600 mt-0.5">{fmtMoney(totalVencido)}</p>
              {byUrgency.vencida.length > 0 && <p className="text-xs text-red-400 mt-0.5">{byUrgency.vencida.length} ítem(s)</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-5">
              <p className="text-xs text-slate-500">Operarios (Transferencias)</p>
              <p className="text-xl font-bold text-violet-700 mt-0.5">{fmtMoney(operarioPayables.reduce((s, p) => s + p.pending_amount, 0))}</p>
              <p className="text-xs text-slate-400 mt-0.5">{operarioPayables.length} pendiente(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-5">
              <p className="text-xs text-slate-500">Mat. Primas por comprar</p>
              <p className="text-xl font-bold text-emerald-700 mt-0.5">{fmtMoney(totalMateriales)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{materialesPendientes.length} ítem(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerta vencidas */}
        {byUrgency.vencida.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {byUrgency.vencida.length} cuenta(s) vencida(s) por {fmtMoney(totalVencido)} — requieren atención inmediata
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta gastos fijos pendientes de generar */}
        {gastosFijosPendientesGenerar.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <Repeat className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              {gastosFijosPendientesGenerar.length} gasto(s) fijo(s) sin generar para este período.
              <button onClick={() => setActiveTab('gastos_fijos')} className="ml-1 underline font-medium">Ver Gastos Fijos</button>
            </AlertDescription>
          </Alert>
        )}

        {/* Formulario CxP manual */}
        {showForm && (
          <PayableForm
            payable={editingPayable} suppliers={suppliers} locations={locations}
            userLocation={userLocation} isAdmin={isAdmin}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingPayable(null); }}
          />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="pendientes">
              Pendientes
              {allPending.length > 0 && (
                <span className="ml-1.5 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {allPending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="materiales" className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> Materias Primas
              {materialesPendientes.length > 0 && (
                <span className="ml-0.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {materialesPendientes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="gastos_fijos" className="flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5" /> Gastos Fijos
              {gastosFijosPendientesGenerar.length > 0 && (
                <span className="ml-0.5 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {gastosFijosPendientesGenerar.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="proveedores">
              <Building2 className="w-3.5 h-3.5 mr-1" /> Proveedores
            </TabsTrigger>
            <TabsTrigger value="pagadas">Pagadas ({paidPayables.length})</TabsTrigger>
          </TabsList>

          {/* ─── Pendientes unificados ──────────────────────────────────── */}
          <TabsContent value="pendientes" className="mt-4 space-y-4">
            {/* Filtros por categoría */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all',                   label: 'Todos',          count: allPending.length },
                { key: 'manufacturing_salary',   label: 'Operarios',      count: allPending.filter(p => p._isOperario || p.category === 'salarios_manufactura').length },
                { key: 'materia_prima_credito',  label: 'Mat. Prima',     count: allPending.filter(p => p.category === 'materia_prima_credito').length },
                { key: 'gasto_fijo',             label: 'Gastos Fijos',   count: allPending.filter(p => p.category === 'gasto_fijo').length },
                { key: 'gasto_variable',         label: 'Gastos Variables',count: allPending.filter(p => p.category === 'gasto_variable').length },
                { key: 'otros',                  label: 'Otros',          count: allPending.filter(p => !['salarios_manufactura','materia_prima_credito','gasto_fijo','gasto_variable'].includes(p.category) && !p._isOperario).length },
              ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroCategoria(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    filtroCategoria === f.key
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {f.label}
                  <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${filtroCategoria === f.key ? 'bg-white/20' : 'bg-slate-100'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {(() => {
              const filtered = allPending.filter(p => {
                if (filtroCategoria === 'all') return true;
                if (filtroCategoria === 'manufacturing_salary') return p._isOperario || p.category === 'salarios_manufactura';
                if (filtroCategoria === 'otros') return !['salarios_manufactura','materia_prima_credito','gasto_fijo','gasto_variable'].includes(p.category) && !p._isOperario;
                return p.category === filtroCategoria;
              });

              // Totales del filtro activo
              const now = new Date();
              const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
              const finMes    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

              const totalFiltro     = filtered.reduce((s, p) => s + (p.pending_amount || 0), 0);
              const vencidoFiltro   = filtered.filter(p => p.due_date && new Date(p.due_date) < now).reduce((s, p) => s + (p.pending_amount || 0), 0);
              const esteMesFiltro   = filtered.filter(p => p.due_date && new Date(p.due_date) >= inicioMes && new Date(p.due_date) <= finMes).reduce((s, p) => s + (p.pending_amount || 0), 0);
              const proximoFiltro   = filtered.filter(p => p.due_date && new Date(p.due_date) > finMes).reduce((s, p) => s + (p.pending_amount || 0), 0);
              const sinFechaFiltro  = filtered.filter(p => !p.due_date).reduce((s, p) => s + (p.pending_amount || 0), 0);

              // Cuando el filtro es "Todos", mostrar desglose por categoría
              const categorySums = filtroCategoria === 'all' ? [
                { key: 'manufacturing_salary', label: 'Operarios',        items: filtered.filter(p => p._isOperario || p.category === 'salarios_manufactura') },
                { key: 'materia_prima_credito',label: 'Mat. Prima',        items: filtered.filter(p => p.category === 'materia_prima_credito') },
                { key: 'gasto_fijo',           label: 'Gastos Fijos',      items: filtered.filter(p => p.category === 'gasto_fijo') },
                { key: 'gasto_variable',       label: 'Gastos Variables',  items: filtered.filter(p => p.category === 'gasto_variable') },
                { key: 'otros',                label: 'Otros',             items: filtered.filter(p => !['salarios_manufactura','materia_prima_credito','gasto_fijo','gasto_variable'].includes(p.category) && !p._isOperario) },
              ].filter(c => c.items.length > 0) : [];

              if (filtered.length === 0) return (
                <div className="text-center py-16 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Sin cuentas en esta categoría</p>
                </div>
              );

              const groups = { vencida: [], urgente: [], proximo: [], futuro: [], sin_fecha: [] };
              for (const item of filtered) groups[URGENCY(item.due_date)].push(item);

              return (
                <div className="space-y-4">
                  {/* ── Resumen de totales del filtro activo ── */}
                  <div className="bg-white border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        {filtroCategoria === 'all' ? 'Total pendiente' : CATEGORY_META[filtroCategoria]?.label || 'Total'}
                      </span>
                      <span className="text-xl font-bold text-slate-900">{fmtMoney(totalFiltro)}</span>
                    </div>

                    {/* Desglose por urgencia */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {vencidoFiltro > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Vencido</p>
                          <p className="text-sm font-bold text-red-700 mt-0.5">{fmtMoney(vencidoFiltro)}</p>
                        </div>
                      )}
                      {esteMesFiltro > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Este mes</p>
                          <p className="text-sm font-bold text-amber-700 mt-0.5">{fmtMoney(esteMesFiltro)}</p>
                        </div>
                      )}
                      {proximoFiltro > 0 && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">Próximo mes+</p>
                          <p className="text-sm font-bold text-blue-700 mt-0.5">{fmtMoney(proximoFiltro)}</p>
                        </div>
                      )}
                      {sinFechaFiltro > 0 && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Sin fecha</p>
                          <p className="text-sm font-bold text-slate-600 mt-0.5">{fmtMoney(sinFechaFiltro)}</p>
                        </div>
                      )}
                    </div>

                    {/* Desglose por categoría (solo en vista "Todos") */}
                    {categorySums.length > 0 && (
                      <div className="border-t pt-3 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Por categoría</p>
                        {categorySums.map(c => {
                          const catTotal = c.items.reduce((s, p) => s + (p.pending_amount || 0), 0);
                          const catMeta = CATEGORY_META[c.key] || CATEGORY_META.otros;
                          const CatIcon = catMeta.icon;
                          const pct = totalFiltro > 0 ? (catTotal / totalFiltro) * 100 : 0;
                          return (
                            <div key={c.key} className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${catMeta.bg}`}>
                                <CatIcon className={`w-3 h-3 ${catMeta.color}`} />
                              </div>
                              <span className="text-xs text-slate-600 w-28 shrink-0">{c.label}</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${catMeta.bg.replace('bg-','bg-').replace('-100','-400')}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 w-24 text-right shrink-0">{fmtMoney(catTotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Lista agrupada por urgencia ── */}
                  <div className="space-y-6">
                    {['vencida', 'urgente', 'proximo', 'futuro', 'sin_fecha'].map(u => {
                      const items = groups[u];
                      if (items.length === 0) return null;
                      const uStyle = URGENCY_STYLES[u];
                      const groupTotal = items.reduce((s, p) => s + (p.pending_amount || 0), 0);
                      return (
                        <div key={u}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${uStyle.dot}`} />
                            <h3 className="font-semibold text-slate-700 text-sm">{uStyle.label}</h3>
                            <span className="text-xs text-slate-400">({items.length})</span>
                            <span className="ml-auto text-sm font-bold text-slate-700">{fmtMoney(groupTotal)}</span>
                          </div>
                          <div className="space-y-2">
                            {items.map(item => (
                              <PendienteCard
                                key={item.id} item={item} onPayment={setPaymentModalData}
                                onDelete={handleDeleteOperarioPayment}
                                abonos={allAbonos.filter(a => a.payable_id === item.id)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* ─── Materias Primas ────────────────────────────────────────── */}
          <TabsContent value="materiales" className="mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-slate-600">
                {materialesFiltrados.length} material(es) pendiente(s)
                {totalMateriales > 0 && <> · <strong>{fmtMoney(totalMateriales)}</strong> estimado</>}
              </p>
              <Select value={filtroEstadoPres} onValueChange={setFiltroEstadoPres}>
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder="Estado presupuesto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {materialesFiltrados.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin materias primas pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {materialesFiltrados.map((item, idx) => (
                  <MaterialPendienteRow
                    key={`${item._presupuesto.id}_${item.materia_prima_id}_${item.color}_${idx}`}
                    item={item} onComprar={setComprandoMaterial}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Gastos Fijos ───────────────────────────────────────────── */}
          <TabsContent value="gastos_fijos" className="mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-slate-600">Plantillas de gastos recurrentes. Genera la obligación mensual desde aquí.</p>
              </div>
              <Button onClick={() => { setEditandoGastoFijo(null); setShowGastoFijo(true); }} className="gap-1.5 text-sm">
                <Plus className="w-4 h-4" /> Nuevo Gasto Fijo
              </Button>
            </div>

            {gastosFixed.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Repeat className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin gastos fijos configurados</p>
                <p className="text-sm mt-1">Agrega arriendo, internet, servicios y otros compromisos recurrentes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gastosFixed.map(g => {
                  const pendiente = deberiGenerarEsteMes(g);
                  return (
                    <div key={g.id} className={`border rounded-lg bg-white p-4 flex items-center gap-4 ${!g.is_active ? 'opacity-50' : ''}`}>
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Repeat className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900 text-sm">{g.nombre}</span>
                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                            {PERIODICIDAD_LABELS[g.periodicidad] || g.periodicidad}
                          </span>
                          {!g.is_active && <span className="text-xs text-slate-400">Inactivo</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fmtMoney(g.monto)}
                          {g.dia_vencimiento ? ` · vence día ${g.dia_vencimiento}` : ''}
                          {g.ultima_generacion ? ` · última generación: ${g.ultima_generacion}` : ' · nunca generado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pendiente && g.is_active && (
                          <Button size="sm" onClick={() => handleGenerarGastoFijo(g)}
                            className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
                            Generar CxP
                          </Button>
                        )}
                        <button onClick={() => { setEditandoGastoFijo(g); setShowGastoFijo(true); }}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleGastoFijo(g)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
                          title={g.is_active ? 'Desactivar' : 'Activar'}>
                          <Clock size={14} />
                        </button>
                        <button onClick={() => handleDeleteGastoFijo(g.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CxP de gastos fijos ya generados */}
            {payables.filter(p => p.category === 'gasto_fijo' && (p.status === 'pending' || p.status === 'partial')).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Obligaciones generadas pendientes de pago</h3>
                <div className="space-y-2">
                  {payables
                    .filter(p => p.category === 'gasto_fijo' && (p.status === 'pending' || p.status === 'partial'))
                    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                    .map(p => (
                      <PendienteCard key={p.id} item={p} onPayment={setPaymentModalData}
                        abonos={allAbonos.filter(a => a.payable_id === p.id)} />
                    ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Balance por Proveedor ──────────────────────────────────── */}
          <TabsContent value="proveedores" className="mt-4 space-y-3">
            {supplierBalances.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin saldos pendientes por proveedor</p>
              </div>
            ) : supplierBalances.map(sup => (
              <SupplierBalanceCard key={sup.name} supplier={sup} onPayment={setPaymentModalData}
                allAbonos={allAbonos} />
            ))}
          </TabsContent>

          {/* ─── Pagadas ────────────────────────────────────────────────── */}
          <TabsContent value="pagadas" className="mt-4">
            <PayableList
              payables={paidPayables} locations={locations}
              onEdit={p => { setEditingPayable(p); setShowForm(true); }}
              onDelete={async id => {
                if (!confirm("¿Eliminar?")) return;
                await AccountPayable.delete(id);
                await loadData();
              }}
              onPayment={setPaymentModalData}
              onManageInstallments={setInstallmentsFor}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modales */}
      {paymentModalData && (
        <PaymentModal
          payable={paymentModalData} locations={locations} userLocation={userLocation}
          onConfirm={handlePaymentConfirm} onCancel={() => setPaymentModalData(null)}
        />
      )}
      {installmentsFor && (
        <InstallmentsManager payable={installmentsFor} onClose={() => setInstallmentsFor(null)} onSaved={loadData} />
      )}
      {comprandoMaterial && (
        <ComprarMaterialModal item={comprandoMaterial} onConfirm={handleComprarMaterial}
          onCancel={() => setComprandoMaterial(null)} />
      )}
      {showGastoVariable && (
        <GastoVariableModal locations={locations} userLocation={userLocation}
          onConfirm={handleGastoVariable} onCancel={() => setShowGastoVariable(false)} />
      )}
      {showGastoFijo && (
        <GastoFijoModal gasto={editandoGastoFijo}
          onConfirm={handleGastoFijo}
          onCancel={() => { setShowGastoFijo(false); setEditandoGastoFijo(null); }} />
      )}
    </div>
  );
}

// ─── Tarjeta balance por proveedor ────────────────────────────────────────────
function SupplierBalanceCard({ supplier, onPayment, allAbonos = [] }) {
  const [expanded, setExpanded] = useState(false);
  const totalAbonado = supplier.items.reduce((s, item) => {
    return s + allAbonos.filter(a => a.payable_id === item.id).reduce((ss, a) => ss + (a.amount || 0), 0);
  }, 0);

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm">{supplier.name}</p>
          <p className="text-xs text-slate-500">{supplier.count} obligación(es)</p>
          {totalAbonado > 0 && (
            <p className="text-xs text-emerald-600">{fmtMoney(totalAbonado)} abonado</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-slate-900">{fmtMoney(supplier.total)}</p>
          <p className="text-xs text-slate-400">pendiente</p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="border-t bg-slate-50 px-4 py-2 space-y-2">
          {supplier.items.map(item => {
            const itemAbonos = allAbonos.filter(a => a.payable_id === item.id);
            const itemAbonado = itemAbonos.reduce((s, a) => s + (a.amount || 0), 0);
            return (
              <div key={item.id} className="border rounded bg-white p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate font-medium">{item.description || item.supplier_name}</p>
                    <p className="text-xs text-slate-400">{fmtDate(item.due_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{fmtMoney(item.pending_amount)}</p>
                    {itemAbonado > 0 && <p className="text-xs text-emerald-600">{fmtMoney(itemAbonado)} abonado</p>}
                  </div>
                  <Button size="sm" onClick={() => onPayment(item)} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7 px-2 shrink-0">
                    Abonar
                  </Button>
                </div>
                {itemAbonos.length > 0 && (
                  <div className="border-t pt-1 space-y-0.5">
                    {itemAbonos.map((a, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-500">
                        <span>{fmtDate(a.payment_date)} · {a.method || ''}</span>
                        <span className="font-medium">{fmtMoney(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
