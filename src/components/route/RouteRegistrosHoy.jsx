import React, { useState } from "react";
import { Delivery, Dispatch, Inventory, StockMovement } from "@/api/publicEntities";
import { Edit2, Trash2, Save, X, ChevronDown, ChevronUp, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteRegistrosHoy({ employees, products, deliveries, dispatches, inventory, onSaved }) {
  const today = getColombiaToday();
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todayDeliveries = deliveries
    .filter(d => (d.delivery_date || '').slice(0, 10) >= cutoff)
    .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date));
  const todayDispatches = dispatches
    .filter(d => (d.dispatch_date || '').slice(0, 10) >= cutoff)
    .sort((a, b) => b.dispatch_date.localeCompare(a.dispatch_date));

  const [editingDelivery, setEditingDelivery] = useState(null);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

  const empName = (id) => employees.find(e => e.employee_id === id)?.name || id;
  const prodName = (ref) => products.find(p => p.reference === ref)?.name || ref;
  const getProduct = (ref) => products.find(p => p.reference === ref);
  const getInv = (ref) => inventory.find(i => i.product_reference === ref);

  const startEditDelivery = (d) => {
    setEditingDelivery({
      id: d.id,
      employee_id: d.employee_id,
      items: (d.items || []).map(i => ({ ...i, quantity: String(i.quantity) })),
    });
  };

  const saveDelivery = async () => {
    setSaving(true);
    const items = editingDelivery.items
      .filter(i => i.product_reference && parseInt(i.quantity) > 0)
      .map(i => {
        const p = getProduct(i.product_reference);
        const qty = parseInt(i.quantity);
        return { product_reference: i.product_reference, quantity: qty, unit_price: p?.manufacturing_price || 0, total_amount: (p?.manufacturing_price || 0) * qty };
      });
    const total_amount = items.reduce((s, i) => s + i.total_amount, 0);
    await Delivery.update(editingDelivery.id, { items, total_amount });
    setEditingDelivery(null);
    setSaving(false);
    onSaved();
  };

  const deleteDelivery = async (id) => {
    if (!confirm("¿Eliminar esta entrega?")) return;
    await Delivery.delete(id);
    onSaved();
  };

  const startEditDispatch = (d) => {
    setEditingDispatch({ id: d.id, product_reference: d.product_reference, quantity: String(d.quantity), employee_id: d.employee_id, original_qty: d.quantity });
  };

  const saveDispatch = async () => {
    const newQty = parseInt(editingDispatch.quantity) || 0;
    const diff = newQty - editingDispatch.original_qty;
    setSaving(true);
    await Dispatch.update(editingDispatch.id, { quantity: newQty });
    const inv = getInv(editingDispatch.product_reference);
    if (inv) {
      const newStock = inv.current_stock - diff;
      await Inventory.update(inv.id, { current_stock: newStock });
      await StockMovement.create({
        product_reference: editingDispatch.product_reference,
        movement_type: diff > 0 ? "salida" : "entrada",
        quantity: Math.abs(diff),
        movement_date: today,
        reason: `Ajuste de despacho del día (${diff > 0 ? "+" : ""}${diff})`,
        previous_stock: inv.current_stock,
        new_stock: newStock,
      });
    }
    setEditingDispatch(null);
    setSaving(false);
    onSaved();
  };

  const deleteDispatch = async (d) => {
    if (!confirm("¿Eliminar este despacho? Se restaurará el stock.")) return;
    await Dispatch.delete(d.id);
    const inv = getInv(d.product_reference);
    if (inv) {
      await Inventory.update(inv.id, { current_stock: inv.current_stock + d.quantity });
      await StockMovement.create({
        product_reference: d.product_reference,
        movement_type: "entrada",
        quantity: d.quantity,
        movement_date: today,
        reason: "Anulación de despacho del día",
        previous_stock: inv.current_stock,
        new_stock: inv.current_stock + d.quantity,
      });
    }
    onSaved();
  };

  if (todayDeliveries.length === 0 && todayDispatches.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-3">
      {/* Header colapsable */}
      <button
        className="w-full px-4 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between active:bg-slate-100"
        onClick={() => setOpen(o => !o)}
      >
        <div className="text-left">
          <p className="font-semibold text-slate-700">Registros recientes</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {todayDeliveries.length + todayDispatches.length} registros · últimos 5 días
          </p>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
          : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="divide-y divide-slate-100">

          {/* ── Entregas ── */}
          {todayDeliveries.map(d => (
            <div key={d.id} className="px-4 py-3">
              {/* Cabecera del registro */}
              <div className="flex items-start gap-2">
                {/* Info izquierda */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PackageCheck className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm font-semibold text-slate-800 truncate">{empName(d.employee_id)}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Entrega</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 ml-6">{(d.delivery_date || '').slice(0, 10)}</p>
                </div>
                {/* Botones editar/eliminar */}
                {editingDelivery?.id !== d.id && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEditDelivery(d)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-blue-500 hover:bg-blue-50 active:bg-blue-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDelivery(d.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 active:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Modo edición */}
              {editingDelivery?.id === d.id ? (
                <div className="space-y-2 mt-3">
                  {editingDelivery.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-slate-700 font-medium truncate">
                        {prodName(item.product_reference)}
                      </span>
                      <input
                        type="number" min="0"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...editingDelivery.items];
                          updated[i] = { ...updated[i], quantity: e.target.value };
                          setEditingDelivery(prev => ({ ...prev, items: updated }));
                        }}
                        className="w-24 h-11 border-2 border-blue-300 rounded-xl px-2 text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={saveDelivery}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex-1 h-11"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {saving ? "Guardando..." : "Guardar"}
                    </Button>
                    <button
                      onClick={() => setEditingDelivery(null)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Vista normal */
                <div className="mt-1.5 ml-6 space-y-0.5">
                  {(d.items || []).map((item, i) => (
                    <p key={i} className="text-sm text-slate-600">
                      {prodName(item.product_reference)}:
                      <span className="font-bold text-slate-800 ml-1">{item.quantity} uds</span>
                    </p>
                  ))}
                  {d.observations && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-1">
                      📝 {d.observations}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ── Despachos ── */}
          {todayDispatches.map(d => {
            const inv = getInv(d.product_reference);
            const isEditing = editingDispatch?.id === d.id;
            const newQty = isEditing ? parseInt(editingDispatch.quantity) || 0 : d.quantity;
            const diff = isEditing ? newQty - d.quantity : 0;
            const stockAfter = inv ? inv.current_stock - diff : null;

            return (
              <div key={d.id} className="px-4 py-3">
                {/* Cabecera del registro */}
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 truncate">{empName(d.employee_id)}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">Despacho</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 ml-6">{(d.dispatch_date || '').slice(0, 10)}</p>
                  </div>
                  {!isEditing && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEditDispatch(d)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl text-blue-500 hover:bg-blue-50 active:bg-blue-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteDispatch(d)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 active:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Modo edición */}
                {isEditing ? (
                  <div className="space-y-2 mt-3 ml-6">
                    <div className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-slate-700 font-medium truncate">
                        {prodName(d.product_reference)}
                      </span>
                      <input
                        type="number" min="0"
                        value={editingDispatch.quantity}
                        onChange={e => setEditingDispatch(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-24 h-11 border-2 border-blue-300 rounded-xl px-2 text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    {inv && diff !== 0 && (
                      <p className={`text-xs ${diff < 0 ? "text-green-600" : "text-orange-600"}`}>
                        {diff < 0
                          ? `✓ Libera ${Math.abs(diff)} uds al stock (quedará: ${stockAfter})`
                          : `⚠️ Consume ${diff} uds del stock (quedará: ${stockAfter})`}
                      </p>
                    )}
                    {inv && stockAfter !== null && stockAfter < 0 && (
                      <p className="text-xs text-red-600 font-semibold">❌ Stock insuficiente</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={saveDispatch}
                        disabled={saving || (stockAfter !== null && stockAfter < 0)}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1 h-11"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? "Guardando..." : "Guardar"}
                      </Button>
                      <button
                        onClick={() => setEditingDispatch(null)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Vista normal */
                  <div className="mt-1.5 ml-6">
                    <p className="text-sm text-slate-600">
                      {prodName(d.product_reference)}:
                      <span className="font-bold text-slate-800 ml-1">{d.quantity} uds</span>
                      {inv && <span className="text-xs text-slate-400 ml-2">(stock: {inv.current_stock})</span>}
                    </p>
                    {d.observations && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-1">
                        📝 {d.observations}
                      </p>
                    )}
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
