import React, { useState, useEffect } from "react";
import { localClient } from "@/api/localClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PackageCheck, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const OpInventory = localClient.entities["OpInventory"];
const MerchandiseEntry = localClient.entities["MerchandiseEntry"];

const getColombiaTodayString = () => {
  const now = new Date();
  const col = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  return col.toISOString().split("T")[0];
};

export default function Op_MerchandiseEntry() {
  const [productos, setProductos] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(getColombiaTodayString());
  const [items, setItems] = useState([{ product_reference: "", quantity: "" }]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productosData, entriesData] = await Promise.all([
        localClient.entities["Producto"].list(),
        MerchandiseEntry.list("-entry_date"),
      ]);
      setProductos(
        (productosData || [])
          .filter((p) => p.reference)
          .map((p) => ({ ...p, name: p.nombre }))
      );
      setEntries(entriesData || []);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const addItem = () => setItems([...items, { product_reference: "", quantity: "" }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const newItems = [...items];
    newItems[i][field] = value;
    setItems(newItems);
  };

  const getProductName = (ref) => {
    const p = productos.find((p) => p.reference === ref);
    return p ? p.nombre : ref;
  };

  const handleSubmit = async () => {
    const validItems = items.filter((i) => i.product_reference && i.quantity > 0);
    if (validItems.length === 0) {
      alert("Agrega al menos un producto con cantidad.");
      return;
    }
    setSaving(true);
    try {
      await MerchandiseEntry.create({
        entry_date: date,
        items: validItems.map((i) => ({
          product_reference: i.product_reference,
          quantity: Number(i.quantity),
          product_name: getProductName(i.product_reference),
        })),
        status: "pendiente",
        total_units: validItems.reduce((s, i) => s + Number(i.quantity), 0),
      });
      setItems([{ product_reference: "", quantity: "" }]);
      setDate(getColombiaTodayString());
      loadData();
      alert("Entrada registrada. Pendiente de asignación por el admin comercial.");
    } catch (err) {
      alert("Error al registrar: " + err.message);
    }
    setSaving(false);
  };

  const statusColor = (s) => {
    if (s === "pendiente") return "bg-amber-100 text-amber-800";
    if (s === "asignado") return "bg-green-100 text-green-800";
    return "bg-slate-100 text-slate-600";
  };

  if (loading) return <div className="p-6 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Entradas de Mercancía</h1>
          <p className="text-slate-500 text-sm mt-1">Registra las prendas que ingresan a bodega. El admin comercial asignará a cada punto de venta.</p>
        </div>

        {/* Formulario nueva entrada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva entrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Fecha de entrada</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Productos</label>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.product_reference}
                    onChange={(e) => updateItem(idx, "product_reference", e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.reference}>
                        {p.reference} — {p.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Cant."
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                    className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1">
                <Plus className="w-3 h-3" /> Agregar otro producto
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-slate-500">
                Total: <strong>{items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</strong> unidades
              </span>
              <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? "Guardando..." : "Registrar entrada"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Historial de entradas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" /> Entradas registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">No hay entradas registradas aún.</p>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div key={entry.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-900">{entry.entry_date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{entry.total_units} unidades</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(entry.status)}`}>
                          {entry.status === "pendiente" ? "Pendiente asignación" : "Asignado ✓"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(entry.items || []).map((item, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {item.product_name || item.product_reference}: {item.quantity} und
                        </span>
                      ))}
                    </div>
                    {entry.status === "asignado" && entry.assignments && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Asignado a:</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.assignments.map((a, i) => (
                            <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                              {a.location_name}: {a.quantity} und
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
