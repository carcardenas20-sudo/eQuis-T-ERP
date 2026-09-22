import React, { useState } from "react";
import { Devolucion } from "@/api/publicEntities";
import { CheckCircle2, RotateCcw, Plus, X, ChevronDown, ChevronUp, AlertCircle, Clock, Package, Pencil } from "lucide-react";
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

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

const DEFECT_TYPES = [
  { value: "costura",   label: "🧵 Costura" },
  { value: "cremallera",label: "🔧 Cremallera" },
  { value: "tela",      label: "🪢 Tela / Material" },
  { value: "boton",     label: "🔘 Botón / Accesorio" },
  { value: "medida",    label: "📐 Medida / Talla" },
  { value: "otro",      label: "⚠️ Otro" },
];

// Eventos de retorno de una devolución. Usa el arreglo dev.retornos (nuevo);
// para registros viejos sin arreglo, sintetiza uno con lo retornado + la última
// fecha para no perder la información histórica.
function getRetornos(dev) {
  if (Array.isArray(dev.retornos) && dev.retornos.length) return dev.retornos;
  const ret = Number(dev.quantity_returned) || 0;
  if (ret > 0) return [{ cantidad: ret, fecha: dev.date_returned || null, aprox: true }];
  return [];
}

function RetornoTimeline({ dev }) {
  const retornos = getRetornos(dev);
  if (!retornos.length) return <p className="text-xs text-slate-400 italic">Aún no hay retornos registrados.</p>;
  return (
    <div className="space-y-1.5">
      {retornos.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <span className="font-semibold text-green-700 shrink-0">+{Number(r.cantidad) || 0}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500 truncate">{r.fecha ? fmtDateTime(r.fecha) : "fecha no registrada"}{r.aprox ? " (aprox.)" : ""}</span>
        </div>
      ))}
    </div>
  );
}

function DevolucionCard({ dev, employees, products, onRetornar, onEdit }) {
  const [open, setOpen] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const nRetornos = getRetornos(dev).length;

  const emp = employees.find(e => e.employee_id === dev.employee_id);
  const prod = products.find(p => p.reference === dev.product_reference);
  const enviadas = Number(dev.quantity_sent) || 0;
  const retornadas = Number(dev.quantity_returned) || 0;
  const pending = enviadas - retornadas;
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
        <button
          onClick={() => onEdit?.(dev)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 shrink-0"
          title="Editar devolución"
        >
          <Pencil className="w-4 h-4" />
        </button>
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

      {/* Historial de retornos (fechas) */}
      {nRetornos > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowHist(s => !s)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showHist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Historial de retornos ({nRetornos})
          </button>
          {showHist && (
            <div className="mt-2 pl-1 border-l-2 border-green-100 ml-1">
              <div className="pl-2"><RetornoTimeline dev={dev} /></div>
            </div>
          )}
        </div>
      )}

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

function DevolucionForm({ employees, products, devolucion, onSaved, onCancel }) {
  const isEdit = !!devolucion;
  const [emp, setEmp] = useState(devolucion?.employee_id || "");
  const [ref, setRef] = useState(devolucion?.product_reference || "");
  const [qty, setQty] = useState(devolucion ? String(Number(devolucion.quantity_sent) || "") : "");
  const [defectType, setDefectType] = useState(devolucion?.defect_type || "");
  const [notes, setNotes] = useState(devolucion?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!emp || !ref || !qty) { alert("Completa operario, referencia y cantidad."); return; }
    const nQty = parseInt(qty);
    if (!nQty || nQty < 1) { alert("Ingresa una cantidad válida."); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const yaRetornado = Number(devolucion.quantity_returned) || 0;
        if (nQty < yaRetornado) {
          alert(`No puedes dejar la cantidad (${nQty}) por debajo de lo ya retornado (${yaRetornado}).`);
          setSaving(false);
          return;
        }
        await Devolucion.update(devolucion.id, {
          employee_id: emp,
          product_reference: ref,
          quantity_sent: nQty,
          defect_type: defectType || null,
          notes: notes || "",
          status: yaRetornado >= nQty ? "cerrada" : "abierta",
        });
      } else {
        await Devolucion.create({
          employee_id: emp,
          product_reference: ref,
          quantity_sent: nQty,
          quantity_returned: 0,
          date_sent: getColombiaToday(),
          defect_type: defectType || null,
          notes: notes || "",
          status: "abierta",
        });
      }
      onSaved();
    } catch (e) {
      console.error("Error guardando devolución:", e);
      alert("No se pudo guardar la devolución. Intenta de nuevo.");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-orange-300 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-slate-800">{isEdit ? "Editar devolución" : "Nueva devolución"}</p>
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
        {saving ? "Guardando..." : (isEdit ? "Guardar cambios" : "Registrar devolución")}
      </Button>
    </div>
  );
}

function HistorialRow({ dev, employees, products, onEdit }) {
  const [open, setOpen] = useState(false);
  const emp = employees.find(e => e.employee_id === dev.employee_id);
  const prod = products.find(p => p.reference === dev.product_reference);
  const defect = DEFECT_TYPES.find(d => d.value === dev.defect_type);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        <button onClick={() => setOpen(s => !s)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-slate-700 truncate">{emp?.name || dev.employee_id}</p>
          <p className="text-xs text-slate-400 truncate">{prod?.name || dev.product_reference} · {Number(dev.quantity_sent) || 0} uds{defect ? ` · ${defect.label}` : ""}</p>
        </button>
        <button onClick={() => onEdit(dev)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 shrink-0" title="Editar devolución">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => setOpen(s => !s)} className="text-right shrink-0">
          <p className="text-xs text-green-700 font-semibold">Cerrada</p>
          <p className="text-xs text-slate-400 flex items-center gap-0.5 justify-end">{fmtDate(dev.date_sent)} {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</p>
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 shrink-0" /> Enviada: {fmtDate(dev.date_sent)}
            {dev.notes ? <span className="italic text-slate-400 truncate">· "{dev.notes}"</span> : null}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Retornos ({getRetornos(dev).length}):</p>
            <RetornoTimeline dev={dev} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RouteDevoluciones({ employees, products, devoluciones, onSaved }) {
  const [view, setView] = useState("abiertas"); // "abiertas" | "historial"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // devolución que se está editando
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

  // Resumen (respeta el filtro por operario)
  const num = (v) => Number(v) || 0;
  const scope = [...filteredOpen, ...filteredClosed];
  const totPendiente = filteredOpen.reduce((s, d) => s + (num(d.quantity_sent) - num(d.quantity_returned)), 0);
  const totRetornado = scope.reduce((s, d) => s + num(d.quantity_returned), 0);
  const totEnviado = scope.reduce((s, d) => s + num(d.quantity_sent), 0);

  const handleRetornar = async (dev, qty) => {
    const q = Number(qty);
    const newReturned = (Number(dev.quantity_returned) || 0) + q;
    const newStatus = newReturned >= (Number(dev.quantity_sent) || 0) ? "cerrada" : "abierta";
    const now = new Date().toISOString();
    // Registrar cada retorno como un evento (cantidad + fecha/hora) para tener el
    // historial completo, no solo el acumulado.
    const retornos = Array.isArray(dev.retornos) ? [...dev.retornos] : [];
    retornos.push({ cantidad: q, fecha: now });
    try {
      // Guardar fecha/hora de retorno — no afecta inventario
      await Devolucion.update(dev.id, {
        quantity_returned: newReturned,
        status: newStatus,
        date_returned: now,
        retornos,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved(); }, 1000);
    } catch (e) {
      console.error("Error guardando el retorno:", e);
      alert("No se pudo guardar el retorno. Intenta de nuevo.");
    }
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditing(null);
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1000);
  };

  const startEdit = (dev) => {
    setEditing(dev);
    setShowForm(false);
    setView(dev.status === "cerrada" ? "historial" : "abiertas");
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
          onClick={() => { setEditing(null); setShowForm(s => !s); }}
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

      {/* Resumen */}
      {scope.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-center">
            <p className="text-[11px] text-orange-600 font-medium">Pendiente</p>
            <p className="text-lg font-bold text-orange-700 tabular-nums">{totPendiente}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">
            <p className="text-[11px] text-green-600 font-medium">Retornado</p>
            <p className="text-lg font-bold text-green-700 tabular-nums">{totRetornado}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Enviado</p>
            <p className="text-lg font-bold text-slate-700 tabular-nums">{totEnviado}</p>
          </div>
        </div>
      )}

      {/* Formulario nueva / edición */}
      {(showForm || editing) && (
        <DevolucionForm
          employees={employees}
          products={products}
          devolucion={editing}
          onSaved={handleFormSaved}
          onCancel={() => { setShowForm(false); setEditing(null); }}
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
                onEdit={startEdit}
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
              .map(dev => (
                <HistorialRow key={dev.id} dev={dev} employees={employees} products={products} onEdit={startEdit} />
              ))
          )}
        </div>
      )}
    </div>
  );
}
