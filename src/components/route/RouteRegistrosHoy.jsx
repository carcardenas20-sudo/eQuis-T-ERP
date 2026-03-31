import React, { useState } from "react";
import { Delivery, Dispatch, Inventory, StockMovement } from "@/entities/all";
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

  // --- Delivery edit/delete ---
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
    const delivery = deliveries.find(d => d.id === id);
    await Delivery.delete(id);

    onSaved();
  };

  // --- Dispatch edit/delete ---
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-2">
      <button
        className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="text-left">
          <p className="font-semibold text-slate-700 text-sm">Registros recientes ({todayDeliveries.length + todayDispatches.length})</p>
          <p className="text-xs text-slate-400">Últimos 5 días · editar o eliminar</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="divide-y divide-slate-100">

          {/* Entregas del día */}
          {todayDeliveries.map(d => (
            <div key={d.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                   <PackageCheck className="w-4 h-4 text-green-600" />
                   <span className="text-sm font-semibold text-slate-800">{empName(d.employee_id)}</span>
                   <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Entrega</span>
                   <span className="text-xs text-slate-400">{(d.delivery_date || '').slice(0, 10)}</span>
                </div>
                {editingDelivery?.id !== d.id && (
                  <div className="flex gap-1">
                    <button onClick={() => startEditDelivery(d)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteDelivery(d.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {editingDelivery?.id === d.id ? (
                <div className="space-y-2 mt-2">
                  {editingDelivery.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-slate-600">{prodName(item.product_reference)}</span>
                      <input
                        type="number" min="0"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...editingDelivery.items];
                          updated[i] = { ...updated[i], quantity: e.target.value };
                          setEditingDelivery(prev => ({ ...prev, items: updated }));
                        }}
                        className="w-20 border border-blue-300 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={saveDelivery} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                      <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingDelivery(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 ml-6">
                  {(d.items || []).map((item, i) => (
                    <p key={i} className="text-xs text-slate-500">
                      {prodName(item.product_reference)}: <span className="font-semibold text-slate-700">{item.quantity}</span>
                    </p>
                  ))}
                </div>
              )}
              {d.observations && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 mt-1.5 ml-6">
                  📝 <strong>Obs:</strong> {d.observations}
                </p>
              )}
            </div>
          ))}

          {/* Despachos del día */}
          {todayDispatches.map(d => {
            const inv = getInv(d.product_reference);
            const isEditing = editingDispatch?.id === d.id;
            const newQty = isEditing ? parseInt(editingDispatch.quantity) || 0 : d.quantity;
            const diff = isEditing ? newQty - d.quantity : 0;
            const stockAfter = inv ? inv.current_stock - diff : null;
            return (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-800">{empName(d.employee_id)}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Despacho</span>
                    <span className="text-xs text-slate-400">{(d.dispatch_date || '').slice(0, 10)}</span>
                  </div>
                  {!isEditing && (
                    <div className="flex gap-1">
                      <button onClick={() => startEditDispatch(d)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteDispatch(d)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2 mt-1 ml-6">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-slate-600">{prodName(d.product_reference)}</span>
                      <input
                        type="number" min="0"
                        value={editingDispatch.quantity}
                        onChange={e => setEditingDispatch(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-20 border border-blue-300 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    {inv && diff !== 0 && (
                      <p className={`text-xs ${diff < 0 ? "text-green-600" : "text-orange-600"}`}>
                        {diff < 0 ? `✓ Se liberan ${Math.abs(diff)} uds al stock (quedará: ${stockAfter})` : `⚠️ Se consumen ${diff} uds del stock (quedará: ${stockAfter})`}
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
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDispatch(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                <div className="ml-6">
                  <p className="text-xs text-slate-500">
                    {prodName(d.product_reference)}: <span className="font-semibold text-slate-700">{d.quantity}</span> uds
                    {inv && <span className="text-slate-400 ml-1">(stock actual: {inv.current_stock})</span>}
                  </p>
                  {d.observations && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                      📝 <strong>Obs:</strong> {d.observations}
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