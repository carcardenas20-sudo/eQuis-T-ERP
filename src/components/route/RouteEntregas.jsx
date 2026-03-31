import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Combined";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const getColombiaToday = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
};

export default function RouteEntregas({ employees, products, dispatches, deliveries, onSaved }) {
  const [quantities, setQuantities] = useState({});
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pendientes por empleado
  const pending = useMemo(() => {
    return employees.map(emp => {
      const items = [];
      products.forEach(p => {
        const dispatched = dispatches
          .filter(d => d.employee_id === emp.employee_id && d.product_reference === p.reference)
          .reduce((s, d) => s + (d.quantity || 0), 0);
        const delivered = deliveries
          .filter(d => d.employee_id === emp.employee_id && d.status !== "borrador")
          .reduce((s, d) => {
            if (d.items?.length > 0) {
              const item = d.items.find(i => i.product_reference === p.reference);
              return s + (item ? item.quantity || 0 : 0);
            }
            if (d.product_reference === p.reference) return s + (d.quantity || 0);
            return s;
          }, 0);
        const pend = dispatched - delivered;
        if (pend > 0) items.push({ product: p, pending: pend });
      });
      return { employee: emp, items };
    }).filter(e => e.items.length > 0);
  }, [employees, products, dispatches, deliveries]);

  const key = (empId, ref) => `${empId}_${ref}`;

  const handleSave = async () => {
    const today = getColombiaToday();
    const toSave = pending.filter(({ employee }) =>
      employee.items?.length > 0 || pending.find(p => p.employee.employee_id === employee.employee_id)
    );

    const entries = [];
    pending.forEach(({ employee, items }) => {
      const validItems = items
        .map(({ product, pending: pend }) => {
          const qty = parseInt(quantities[key(employee.employee_id, product.reference)] || "0");
          if (qty <= 0) return null;
          return { product_reference: product.reference, quantity: qty, unit_price: product.manufacturing_price || 0, total_amount: (product.manufacturing_price || 0) * qty };
        })
        .filter(Boolean);
      if (validItems.length > 0) entries.push({ employee, items: validItems });
    });

    if (entries.length === 0) { alert("No hay cantidades ingresadas."); return; }

    setSaving(true);
    for (const { employee, items } of entries) {
      const total_amount = items.reduce((s, i) => s + i.total_amount, 0);
      await base44.entities.Delivery.create({
        employee_id: employee.employee_id,
        delivery_date: today,
        items,
        total_amount,
        status: "borrador",
      });
    }
    setSaving(false);
    setSaved(true);
    setQuantities({});
    setTimeout(() => { setSaved(false); onSaved(); }, 1500);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-green-700">
        <CheckCircle2 className="w-14 h-14" />
        <p className="text-xl font-bold">¡Entregas registradas!</p>
        <p className="text-sm text-slate-500">Quedan pendientes de aprobación.</p>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Sin pendientes de entrega.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 px-1">Ingresa las cantidades entregadas hoy. Quedarán como borrador hasta que el administrador apruebe.</p>
      {pending.map(({ employee, items }) => {
        const isOpen = expanded[employee.employee_id] !== false;
        return (
          <div key={employee.employee_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setExpanded(prev => ({ ...prev, [employee.employee_id]: !isOpen }))}
            >
              <div className="text-left">
                <p className="font-semibold text-slate-900 text-sm">{employee.name}</p>
                <p className="text-xs text-slate-400">{items.length} referencia(s) pendiente(s)</p>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                {items.map(({ product, pending: pend }) => {
                  const k = key(employee.employee_id, product.reference);
                  return (
                    <div key={product.reference} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-slate-800 font-medium">{product.name}</p>
                        <p className="text-xs text-slate-400">Pendiente: {pend} unidades</p>
                      </div>
                      <input
                        type="number" min="0" max={pend} placeholder="0"
                        value={quantities[k] || ""}
                        onChange={e => setQuantities(prev => ({ ...prev, [k]: e.target.value }))}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base mt-4">
        {saving ? "Guardando..." : "Enviar entregas del día"}
      </Button>
    </div>
  );
}