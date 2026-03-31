import React, { useState } from "react";
import { Devolucion } from "@/entities/all";
import { CheckCircle2, RotateCcw, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteDevoluciones({ employees, products, devoluciones, onSaved }) {
  const [mode, setMode] = useState("nueva"); // "nueva" | "retorno"
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nueva devolución
  const [newEmp, setNewEmp] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Retorno
  const [selectedDev, setSelectedDev] = useState("");
  const [returnQty, setReturnQty] = useState("");

  const openDevoluciones = devoluciones.filter(d => d.status === "abierta");

  const handleNueva = async () => {
    if (!newEmp || !newRef || !newQty) { alert("Completa todos los campos."); return; }
    setSaving(true);
    await Devolucion.create({
      employee_id: newEmp,
      product_reference: newRef,
      quantity_sent: parseInt(newQty),
      quantity_returned: 0,
      date_sent: getColombiaToday(),
      notes: newNotes,
      status: "abierta",
    });
    setSaving(false);
    setSaved(true);
    setNewEmp(""); setNewRef(""); setNewQty(""); setNewNotes("");
    setTimeout(() => { setSaved(false); onSaved(); }, 1500);
  };

  const handleRetorno = async () => {
    if (!selectedDev || !returnQty) { alert("Selecciona la devolución y la cantidad."); return; }
    const dev = devoluciones.find(d => d.id === selectedDev);
    if (!dev) return;
    const pending = dev.quantity_sent - (dev.quantity_returned || 0);
    const qty = parseInt(returnQty);
    if (qty > pending) { alert(`Solo quedan ${pending} pendientes.`); return; }
    setSaving(true);
    const newReturned = (dev.quantity_returned || 0) + qty;
    const newStatus = newReturned >= dev.quantity_sent ? "cerrada" : "abierta";
    await Devolucion.update(dev.id, { quantity_returned: newReturned, status: newStatus });
    setSaving(false);
    setSaved(true);
    setSelectedDev(""); setReturnQty("");
    setTimeout(() => { setSaved(false); onSaved(); }, 1500);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-green-700">
        <CheckCircle2 className="w-14 h-14" />
        <p className="text-xl font-bold">¡Guardado!</p>
      </div>
    );
  }

  const getEmpName = (id) => employees.find(e => e.employee_id === id)?.name || id;
  const getProdName = (ref) => products.find(p => p.reference === ref)?.name || ref;

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("nueva")}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${mode === "nueva" ? "bg-orange-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600"}`}
        >
          <ArrowDownCircle className="w-4 h-4" /> Entregar devolución
        </button>
        <button
          onClick={() => setMode("retorno")}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${mode === "retorno" ? "bg-green-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600"}`}
        >
          <RotateCcw className="w-4 h-4" /> Registrar retorno
        </button>
      </div>

      {mode === "nueva" && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <p className="text-xs text-slate-500">Registra prendas defectuosas que llevas al operario para arreglar.</p>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Operario</label>
            <select value={newEmp} onChange={e => setNewEmp(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">— Seleccionar —</option>
              {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Referencia</label>
            <select value={newRef} onChange={e => setNewRef(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">— Producto —</option>
              {products.map(p => <option key={p.reference} value={p.reference}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Cantidad</label>
            <input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)}
              placeholder="Ej: 5"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Observaciones (opcional)</label>
            <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
              placeholder="Tipo de defecto, estado..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <Button onClick={handleNueva} disabled={saving} className="w-full bg-orange-600 hover:bg-orange-700 text-white h-11">
            {saving ? "Guardando..." : "Registrar devolución"}
          </Button>
        </div>
      )}

      {mode === "retorno" && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <p className="text-xs text-slate-500">Registra las prendas que el operario te devuelve ya arregladas.</p>
          {openDevoluciones.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No hay devoluciones abiertas.</p>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Devolución pendiente</label>
                <select value={selectedDev} onChange={e => setSelectedDev(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="">— Seleccionar —</option>
                  {openDevoluciones.map(d => {
                    const pend = d.quantity_sent - (d.quantity_returned || 0);
                    return (
                      <option key={d.id} value={d.id}>
                        {getEmpName(d.employee_id)} — {getProdName(d.product_reference)} (pendiente: {pend})
                      </option>
                    );
                  })}
                </select>
              </div>
              {selectedDev && (() => {
                const dev = devoluciones.find(d => d.id === selectedDev);
                const pend = dev ? dev.quantity_sent - (dev.quantity_returned || 0) : 0;
                return (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Cantidad retornada (máx: {pend})</label>
                    <input type="number" min="1" max={pend} value={returnQty} onChange={e => setReturnQty(e.target.value)}
                      placeholder={`Máx ${pend}`}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                );
              })()}
              <Button onClick={handleRetorno} disabled={saving || !selectedDev} className="w-full bg-green-600 hover:bg-green-700 text-white h-11">
                {saving ? "Guardando..." : "Confirmar retorno"}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Lista resumen de devoluciones abiertas */}
      {openDevoluciones.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-500 mb-2 px-1">Devoluciones abiertas</p>
          <div className="space-y-2">
            {openDevoluciones.map(d => {
              const pend = d.quantity_sent - (d.quantity_returned || 0);
              return (
                <div key={d.id} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{getEmpName(d.employee_id)}</p>
                    <p className="text-xs text-slate-500">{getProdName(d.product_reference)} · {d.date_sent}</p>
                  </div>
                  <span className="font-bold text-orange-700 text-sm">{pend} pend.</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}