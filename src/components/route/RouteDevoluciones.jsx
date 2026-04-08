import React, { useState } from "react";
import { Devolucion } from "@/api/publicEntities";
import { CheckCircle2, RotateCcw, Plus, X, ChevronDown, ChevronUp, AlertCircle, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

const DEFECT_TYPES = [
  { value: "costura",   label: "🧵 Costura" },
  { value: "cremallera",label: "🔧 Cremallera" },
  { value: "tela",      label: "🪢 Tela / Material" },
  { value: "boton",     label: "🔘 Botón / Accesorio" },
  { value: "medida",    label: "📐 Medida / Talla" },
  { value: "otro",      label: "⚠️ Otro" },
];

function DevolucionCard({ dev, employees, products, onRetornar }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  const emp = employees.find(e => e.employee_id === dev.employee_id);
  const prod = products.find(p => p.reference === dev.product_reference);
  const pending = dev.quantity_sent - (dev.quantity_returned || 0);
  const defect = DEFECT_TYPES.find(d => d.value === dev.defect_type);

  const handleRetornar = async () => {
    const n = parseInt(qty);
    if (!n || n < 1) { alert("Ingresa una cantidad válida."); return; }
    if (n > pending) { alert(`Solo quedan ${pending} pendientes.`); return; }
    setSaving(true);
    await onRetornar(dev, n);
    setSaving(false);
    setQty("");
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{emp?.name || dev.employee_id}</p>
          <p className="text-xs text-slate-500 truncate">{prod?.name || dev.product_reference}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-orange-700">{pending}</span>
          <p className="text-xs text-slate-400">pendientes</p>
        </div>
      </div>

      {/* Meta */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3 inline mr-0.5" />
          Enviado: {fmtDate(dev.date_sent)}
        </span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
          Enviadas: {dev.quantity_sent} · Retornadas: {dev.quantity_returned || 0}
        </span>
        {defect && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
            {defect.label}
          </span>
        )}
        {dev.notes && (
          <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full italic truncate max-w-[140px] sm:max-w-[200px]">
            "{dev.notes}"
          </span>
        )}
      </div>

      {/* Progreso */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all"
            style={{ width: `${Math.round(((dev.quantity_returned || 0) / dev.quantity_sent) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-0.5 text-right">
          {Math.round(((dev.quantity_returned || 0) / dev.quantity_sent) * 100)}% retornado
        </p>
      </div>

      {/* Retorno inline */}
      {!open ? (
        <div className="px-4 pb-3">
          <button
            onClick={() => setOpen(true)}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Registrar retorno
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-green-50 space-y-2">
          <p className="text-xs font-semibold text-green-800">¿Cuántas retornó? (máx: {pending})</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max={pending}
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder={`1 – ${pending}`}
              className="flex-1 border border-green-300 rounded-lg px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-center"
              autoFocus
            />
            <button
              onClick={handleRetornar}
              disabled={saving}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors min-w-[44px]"
            >
              {saving ? "..." : "✓"}
            </button>
            <button
              onClick={() => { setOpen(false); setQty(""); }}
              className="p-3 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 min-w-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Atajos rápidos */}
          <div className="flex gap-1.5 flex-wrap">
            {[...new Set([1, Math.ceil(pending / 2), pending].filter(n => n > 0 && n <= pending))].map(n => (
              <button
                key={n}
                onClick={() => setQty(String(n))}
                className="text-xs px-3 py-2 bg-white border border-green-300 text-green-700 rounded-full hover:bg-green-100 transition-colors"
              >
                {n === pending ? `Todos (${n})` : n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NuevaDevolucionForm({ employees, products, onCreated, onCancel }) {
  const [emp, setEmp] = useState("");
  const [ref, setRef] = useState("");
  const [qty, setQty] = useState("");
  const [defectType, setDefectType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!emp || !ref || !qty) { alert("Completa operario, referencia y cantidad."); return; }
    setSaving(true);
    await Devolucion.create({
      employee_id: emp,
      product_reference: ref,
      quantity_sent: parseInt(qty),
      quantity_returned: 0,
      date_sent: getColombiaToday(),
      defect_type: defectType || null,
      notes: notes || "",
      status: "abierta",
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="bg-white rounded-xl border-2 border-orange-300 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-slate-800">Nueva devolución</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Operario *</label>
        <select value={emp} onChange={e => setEmp(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">— Seleccionar —</option>
          {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Referencia *</label>
        <select value={ref} onChange={e => setRef(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">— Producto —</option>
          {products.map(p => <option key={p.reference} value={p.reference}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Cantidad *</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
            placeholder="Ej: 5"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Tipo de defecto</label>
          <select value={defectType} onChange={e => setDefectType(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">— Sin especificar —</option>
            {DEFECT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Observaciones (opcional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Detalles adicionales..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      <Button onClick={handleSubmit} disabled={saving}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white h-11 font-semibold">
        {saving ? "Guardando..." : "Registrar devolución"}
      </Button>
    </div>
  );
}

export default function RouteDevoluciones({ employees, products, devoluciones, onSaved }) {
  const [view, setView] = useState("abiertas"); // "abiertas" | "historial"
  const [showForm, setShowForm] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");
  const [saved, setSaved] = useState(false);

  const openDevoluciones = devoluciones.filter(d => d.status === "abierta");
  const closedDevoluciones = devoluciones.filter(d => d.status === "cerrada");

  const filteredOpen = filterEmp
    ? openDevoluciones.filter(d => d.employee_id === filterEmp)
    : openDevoluciones;

  const filteredClosed = filterEmp
    ? closedDevoluciones.filter(d => d.employee_id === filterEmp)
    : closedDevoluciones;

  // Empleados que tienen devoluciones (abiertas o cerradas)
  const empIdsWithDev = [...new Set(devoluciones.map(d => d.employee_id))];
  const employeesWithDev = employees.filter(e => empIdsWithDev.includes(e.employee_id));

  const handleRetornar = async (dev, qty) => {
    const newReturned = (dev.quantity_returned || 0) + qty;
    const newStatus = newReturned >= dev.quantity_sent ? "cerrada" : "abierta";
    const now = new Date().toISOString();
    // Guardar fecha/hora de retorno — no afecta inventario
    await Devolucion.update(dev.id, {
      quantity_returned: newReturned,
      status: newStatus,
      date_returned: now,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1000);
  };

  const handleCreated = () => {
    setShowForm(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Tabs + Nueva */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView("abiertas")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              view === "abiertas" ? "bg-orange-600 text-white shadow" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Abiertas</span>
            {openDevoluciones.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${view === "abiertas" ? "bg-white/20" : "bg-orange-100 text-orange-700"}`}>
                {openDevoluciones.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView("historial")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              view === "historial" ? "bg-slate-700 text-white shadow" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Historial</span>
            {closedDevoluciones.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${view === "historial" ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
                {closedDevoluciones.length}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all font-bold text-lg ${
            showForm ? "bg-slate-200 text-slate-600" : "bg-orange-600 text-white shadow hover:bg-orange-700"
          }`}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {/* Feedback guardado */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-800">¡Guardado correctamente!</p>
        </div>
      )}

      {/* Formulario nueva */}
      {showForm && (
        <NuevaDevolucionForm
          employees={employees}
          products={products}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filtro por operario (solo si hay más de 1 con devoluciones) */}
      {employeesWithDev.length > 1 && devoluciones.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterEmp("")}
            className={`text-xs px-3 py-2 rounded-full border transition-colors ${
              !filterEmp ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            Todos
          </button>
          {employeesWithDev.map(e => (
            <button
              key={e.employee_id}
              onClick={() => setFilterEmp(e.employee_id === filterEmp ? "" : e.employee_id)}
              className={`text-xs px-3 py-2 rounded-full border transition-colors ${
                filterEmp === e.employee_id
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}

      {/* Vista abiertas */}
      {view === "abiertas" && (
        <div className="space-y-3">
          {filteredOpen.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Sin devoluciones abiertas</p>
              <p className="text-xs text-slate-400 mt-1">
                {filterEmp ? "Prueba con otro filtro." : "Toca + para registrar una nueva."}
              </p>
            </div>
          ) : (
            filteredOpen.map(dev => (
              <DevolucionCard
                key={dev.id}
                dev={dev}
                employees={employees}
                products={products}
                onRetornar={handleRetornar}
              />
            ))
          )}
        </div>
      )}

      {/* Vista historial */}
      {view === "historial" && (
        <div className="space-y-2">
          {filteredClosed.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <RotateCcw className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">Sin historial de devoluciones</p>
            </div>
          ) : (
            filteredClosed
              .slice()
              .sort((a, b) => (b.date_sent || "").localeCompare(a.date_sent || ""))
              .map(dev => {
                const emp = employees.find(e => e.employee_id === dev.employee_id);
                const prod = products.find(p => p.reference === dev.product_reference);
                const defect = DEFECT_TYPES.find(d => d.value === dev.defect_type);
                return (
                  <div key={dev.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{emp?.name || dev.employee_id}</p>
                      <p className="text-xs text-slate-400 truncate">{prod?.name || dev.product_reference} · {dev.quantity_sent} uds{defect ? ` · ${defect.label}` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-green-700 font-semibold">Cerrada</p>
                      <p className="text-xs text-slate-400">{fmtDate(dev.date_sent)}</p>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
