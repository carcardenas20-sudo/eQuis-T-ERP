import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { CheckCircle2, Trash2, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DraftDeliveries() {
  const [drafts, setDrafts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { draftId, items }

  const loadData = async () => {
    setLoading(true);
    const [deliveries, emps, prods] = await Promise.all([
      base44.entities.Delivery.filter({ status: "borrador" }),
      base44.entities.Employee.list(),
      base44.entities.Producto.list(),
    ]);
    setDrafts(deliveries.sort((a, b) => b.created_date?.localeCompare(a.created_date)));
    setEmployees(emps);
    setProducts((prods || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getEmpName = (id) => employees.find(e => e.employee_id === id)?.name || id;
  const getProdName = (ref) => products.find(p => p.reference === ref)?.name || ref;
  const getUnitPrice = (ref) => products.find(p => p.reference === ref)?.manufacturing_price || 0;

  const handleApprove = async (draft) => {
    await base44.entities.Delivery.update(draft.id, { status: "pendiente" });
    loadData();
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este borrador?")) return;
    await base44.entities.Delivery.delete(id);
    loadData();
  };

  const startEdit = (draft) => {
    setEditing({
      draftId: draft.id,
      items: draft.items?.map(i => ({ ...i })) || [],
    });
  };

  const updateEditQty = (index, qty) => {
    setEditing(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], quantity: parseInt(qty) || 0, total_amount: (parseInt(qty) || 0) * items[index].unit_price };
      return { ...prev, items };
    });
  };

  const saveEdit = async () => {
    const items = editing.items.filter(i => i.quantity > 0).map(i => ({
      ...i,
      total_amount: i.quantity * (i.unit_price || getUnitPrice(i.product_reference)),
    }));
    const total_amount = items.reduce((s, i) => s + i.total_amount, 0);
    await base44.entities.Delivery.update(editing.draftId, { items, total_amount });
    setEditing(null);
    loadData();
  };

  const approveAll = async () => {
    if (!confirm(`¿Aprobar los ${drafts.length} borradores?`)) return;
    await Promise.all(drafts.map(d => base44.entities.Delivery.update(d.id, { status: "pendiente" })));
    loadData();
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Borradores de Entrega</h1>
            <p className="text-slate-500 text-sm mt-0.5">Entregas registradas en campo, pendientes de aprobación.</p>
          </div>
          {drafts.length > 0 && (
            <Button onClick={approveAll} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Aprobar todos ({drafts.length})
            </Button>
          )}
        </div>

        {drafts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 text-slate-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Sin borradores pendientes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map(draft => {
              const isEditing = editing?.draftId === draft.id;
              const items = isEditing ? editing.items : (draft.items || []);
              return (
                <div key={draft.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{getEmpName(draft.employee_id)}</p>
                      <p className="text-xs text-slate-500">{draft.delivery_date} · Registrado desde ruta</p>
                    </div>
                    <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">Borrador</span>
                  </div>

                  <div className="px-4 py-3 space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 flex-1">{getProdName(item.product_reference)}</span>
                        {isEditing ? (
                          <input
                            type="number" min="0" value={item.quantity}
                            onChange={e => updateEditQty(i, e.target.value)}
                            className="w-20 border border-blue-300 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 text-sm">{item.quantity} unid.</span>
                        )}
                        <span className="text-xs text-slate-400 w-24 text-right">
                          ${((isEditing ? item.quantity : item.quantity) * getUnitPrice(item.product_reference)).toLocaleString("es-CO")}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <span className="text-sm font-bold text-slate-900">
                        Total: ${items.reduce((s, i) => s + (i.quantity * getUnitPrice(i.product_reference)), 0).toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-3 flex gap-2">
                    {isEditing ? (
                      <>
                        <Button onClick={saveEdit} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                          <Save className="w-3.5 h-3.5 mr-1" /> Guardar cambios
                        </Button>
                        <Button onClick={() => setEditing(null)} variant="outline" size="sm">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => handleApprove(draft)} size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-1">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprobar
                        </Button>
                        <Button onClick={() => startEdit(draft)} variant="outline" size="sm">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button onClick={() => handleDelete(draft.id)} variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}