import React, { useState } from "react";
import { base44 } from "@/api/base44Combined";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteDespachos({ employees, products, inventory, onSaved }) {
  const [employeeId, setEmployeeId] = useState("");
  const [items, setItems] = useState([{ product_reference: "", quantity: "" }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getStock = (ref) => {
    const inv = inventory.find(i => i.product_reference === ref);
    return inv ? inv.current_stock : 0;
  };

  const updateItem = (i, field, val) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: val };
    setItems(updated);
  };

  const handleSave = async () => {
    if (!employeeId) { alert("Selecciona un operario."); return; }
    const valid = items.filter(i => i.product_reference && parseInt(i.quantity) > 0);
    if (valid.length === 0) { alert("Ingresa al menos un producto con cantidad."); return; }

    for (const item of valid) {
      const stock = getStock(item.product_reference);
      if (parseInt(item.quantity) > stock) {
        const p = products.find(p => p.reference === item.product_reference);
        alert(`Stock insuficiente para ${p?.name}. Disponible: ${stock}`);
        return;
      }
    }

    setSaving(true);
    const today = getColombiaToday();
    const emp = employees.find(e => e.employee_id === employeeId);

    for (const item of valid) {
      const qty = parseInt(item.quantity);
      await base44.entities.Dispatch.create({
        employee_id: employeeId,
        product_reference: item.product_reference,
        quantity: qty,
        dispatch_date: today,
        status: "despachado",
      });
      const inv = inventory.find(i => i.product_reference === item.product_reference);
      if (inv) {
        await base44.entities.Inventory.update(inv.id, { current_stock: inv.current_stock - qty });
        await base44.entities.StockMovement.create({
          product_reference: item.product_reference,
          movement_type: "salida",
          quantity: qty,
          movement_date: today,
          reason: `Despacho en ruta a ${emp?.name || employeeId}`,
          previous_stock: inv.current_stock,
          new_stock: inv.current_stock - qty,
        });
      }
    }
    setSaving(false);
    setSaved(true);
    setItems([{ product_reference: "", quantity: "" }]);
    setEmployeeId("");
    setTimeout(() => { setSaved(false); onSaved(); }, 1500);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-green-700">
        <CheckCircle2 className="w-14 h-14" />
        <p className="text-xl font-bold">¡Despacho registrado!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Operario</label>
        <select
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">— Seleccionar —</option>
          {employees.map(e => (
            <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          const stock = item.product_reference ? getStock(item.product_reference) : null;
          const over = stock !== null && parseInt(item.quantity) > stock;
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Producto {i + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={item.product_reference}
                onChange={e => updateItem(i, "product_reference", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">— Referencia —</option>
                {products.map(p => (
                  <option key={p.reference} value={p.reference}>{p.name} (stock: {getStock(p.reference)})</option>
                ))}
              </select>
              <input
                type="number" min="1" placeholder="Cantidad"
                value={item.quantity}
                onChange={e => updateItem(i, "quantity", e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${over ? "border-orange-400 bg-orange-50 focus:ring-orange-400" : "border-slate-300 focus:ring-blue-400"}`}
              />
              {over && <p className="text-xs text-orange-600">⚠️ Stock disponible: {stock}</p>}
            </div>
          );
        })}
      </div>

      <button onClick={() => setItems(prev => [...prev, { product_reference: "", quantity: "" }])}
        className="w-full py-2.5 border border-dashed border-blue-300 rounded-xl text-blue-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-50">
        <Plus className="w-4 h-4" /> Agregar producto
      </button>

      <Button onClick={handleSave} disabled={saving || !employeeId} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base">
        {saving ? "Guardando..." : "Confirmar despacho"}
      </Button>
    </div>
  );
}