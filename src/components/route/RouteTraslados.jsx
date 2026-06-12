import React, { useState, useMemo } from "react";
import { Delivery, Dispatch, Inventory, StockMovement } from "@/api/publicEntities";
import { ArrowRightLeft, CheckCircle2, RotateCcw, User } from "lucide-react";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteTraslados({ employees, products, dispatches, deliveries, inventory, onSaved }) {
  const [origenId, setOrigenId] = useState("");
  const [productRef, setProductRef] = useState("");
  const [qty, setQty] = useState("");
  // destino: "operario" | "inventario"
  const [tipoDestino, setTipoDestino] = useState("operario");
  const [destinoId, setDestinoId] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedType, setSavedType] = useState("");

  const pendingItems = useMemo(() => {
    if (!origenId) return [];
    return products.map(p => {
      const dispatched = dispatches
        .filter(d => d.employee_id === origenId && d.product_reference === p.reference)
        .reduce((s, d) => s + (d.quantity || 0), 0);
      const delivered = deliveries
        .filter(d => d.employee_id === origenId && d.status !== "borrador")
        .reduce((s, d) => {
          if (d.items?.length > 0) {
            const item = d.items.find(i => i.product_reference === p.reference);
            return s + (item ? item.quantity || 0 : 0);
          }
          if (d.product_reference === p.reference) return s + (d.quantity || 0);
          return s;
        }, 0);
      const pend = dispatched - delivered;
      return pend > 0 ? { product: p, pending: pend } : null;
    }).filter(Boolean);
  }, [origenId, products, dispatches, deliveries]);

  const selectedItem = pendingItems.find(i => i.product.reference === productRef);
  const maxQty = selectedItem?.pending ?? 0;
  const cantidad = parseInt(qty) || 0;

  const canSubmit = origenId && productRef && cantidad > 0 && cantidad <= maxQty &&
    (tipoDestino === "inventario" || (tipoDestino === "operario" && destinoId && destinoId !== origenId));

  const handleConfirmar = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const today = getColombiaToday();
    const origen = employees.find(e => e.employee_id === origenId);

    if (tipoDestino === "inventario") {
      // Devolver al inventario: delivery(devolucion_despacho) + restaurar stock
      await Delivery.create({
        employee_id: origenId,
        delivery_date: today,
        items: [{ product_reference: productRef, quantity: cantidad, unit_price: 0, total_amount: 0 }],
        total_amount: 0,
        status: "devolucion_despacho",
        notes: `[DEVOLUCIÓN DESPACHO] Sin fabricar${obs ? ' — ' + obs : ''}`,
      });
      const inv = inventory?.find(i => i.product_reference === productRef);
      if (inv) {
        const newStock = inv.current_stock + cantidad;
        await Inventory.update(inv.id, { current_stock: newStock });
        await StockMovement.create({
          product_reference: productRef,
          movement_type: "entrada",
          quantity: cantidad,
          movement_date: today,
          reason: `Devolución de despacho sin fabricar — ${origen?.name || origenId}${obs ? ' — ' + obs : ''}`,
          previous_stock: inv.current_stock,
          new_stock: newStock,
        });
      }
      setSavedType("inventario");
    } else {
      // Traslado entre operarios
      const destino = employees.find(e => e.employee_id === destinoId);
      await Delivery.create({
        employee_id: origenId,
        delivery_date: today,
        items: [{ product_reference: productRef, quantity: cantidad, unit_price: 0, total_amount: 0 }],
        total_amount: 0,
        status: "traslado",
        notes: `[TRASLADO] Transferido a ${destino?.name || destinoId}${obs ? ' — ' + obs : ''}`,
      });
      await Dispatch.create({
        employee_id: destinoId,
        product_reference: productRef,
        quantity: cantidad,
        dispatch_date: today,
        status: "despachado",
        observations: `[TRASLADO] Recibido de ${origen?.name || origenId}${obs ? ' — ' + obs : ''}`,
      });
      setSavedType("traslado");
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSavedType("");
      setOrigenId("");
      setProductRef("");
      setQty("");
      setTipoDestino("operario");
      setDestinoId("");
      setObs("");
      onSaved();
    }, 1800);
  };

  if (saved) return (
    <div className="flex flex-col items-center py-16 gap-3">
      <CheckCircle2 className={`w-14 h-14 ${savedType === "inventario" ? "text-blue-600" : "text-amber-600"}`} />
      <p className="text-xl font-bold text-slate-800">
        {savedType === "inventario" ? "¡Devuelto al inventario!" : "¡Trasladado!"}
      </p>
      <p className="text-sm text-slate-500">
        {savedType === "inventario"
          ? "Las unidades volvieron al stock disponible."
          : "Despacho transferido al operario destino."}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">

      {/* Paso 1: Origen */}
      <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <p className="font-bold text-amber-900 text-sm">① Operario origen</p>
          <p className="text-xs text-amber-600 mt-0.5">Quien tiene el despacho actualmente</p>
        </div>
        <div className="px-4 py-3">
          <select
            value={origenId}
            onChange={e => { setOrigenId(e.target.value); setProductRef(""); setQty(""); }}
            className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="">— Seleccionar operario —</option>
            {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {/* Paso 2: Producto */}
      {origenId && (
        <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
            <p className="font-bold text-amber-900 text-sm">② Producto a mover</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {pendingItems.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sin despachos pendientes.</p>
            ) : (
              <>
                <select
                  value={productRef}
                  onChange={e => { setProductRef(e.target.value); setQty(""); }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">— Seleccionar referencia —</option>
                  {pendingItems.map(({ product, pending }) => (
                    <option key={product.reference} value={product.reference}>
                      {product.name} ({pending} pendientes)
                    </option>
                  ))}
                </select>
                {productRef && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1.5">
                      Cantidad <span className="font-normal text-slate-400">(máx. {maxQty})</span>
                    </label>
                    <input
                      type="number" min="1" max={maxQty} placeholder="0"
                      value={qty}
                      onChange={e => setQty(String(Math.min(parseInt(e.target.value) || 0, maxQty)))}
                      className="w-full h-14 border-2 border-slate-300 rounded-xl px-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Paso 3: Destino */}
      {origenId && productRef && cantidad > 0 && (
        <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
            <p className="font-bold text-blue-900 text-sm">③ Destino</p>
          </div>
          <div className="px-4 py-3 space-y-3">

            {/* Toggle tipo destino */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTipoDestino("operario")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  tipoDestino === "operario"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <User className="w-4 h-4" /> Otro operario
              </button>
              <button
                onClick={() => setTipoDestino("inventario")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  tipoDestino === "inventario"
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <RotateCcw className="w-4 h-4" /> Inventario
              </button>
            </div>

            {tipoDestino === "inventario" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold text-blue-800">Devolver sin fabricar</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Las {cantidad} unidades vuelven al stock disponible con historial.
                </p>
              </div>
            )}

            {tipoDestino === "operario" && (
              <select
                value={destinoId}
                onChange={e => setDestinoId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-3.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">— Seleccionar operario destino —</option>
                {employees.filter(e => e.employee_id !== origenId).map(e => (
                  <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
                ))}
              </select>
            )}

            <textarea
              placeholder="Observaciones (opcional)"
              value={obs}
              onChange={e => setObs(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none h-16 bg-white placeholder-slate-400"
            />
          </div>
        </div>
      )}

      {canSubmit && (
        <button
          onClick={handleConfirmar}
          disabled={saving}
          className={`w-full h-14 text-white text-base font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${
            tipoDestino === "inventario"
              ? "bg-blue-600 active:bg-blue-700"
              : "bg-amber-600 active:bg-amber-700"
          }`}
        >
          {tipoDestino === "inventario"
            ? <><RotateCcw className="w-5 h-5" /> {saving ? "Devolviendo..." : "Devolver al inventario"}</>
            : <><ArrowRightLeft className="w-5 h-5" /> {saving ? "Trasladando..." : "Confirmar traslado"}</>
          }
        </button>
      )}
    </div>
  );
}
