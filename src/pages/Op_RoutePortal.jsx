import React, { useState, useEffect } from "react";
import { Employee, Producto, Dispatch, Delivery, Inventory, Devolucion, AppConfig } from "@/api/publicEntities";
import { Truck, RotateCcw, PackageCheck } from "lucide-react";
import RouteOperario from "@/components/route/RouteOperario";
import RouteRegistrosHoy from "@/components/route/RouteRegistrosHoy";
import RouteDevoluciones from "@/components/route/RouteDevoluciones";
import RouteChecklist from "@/components/route/RouteChecklist";
import RouteConteoFisico from "@/components/route/RouteConteoFisico";

const TABS = [
  { id: "operaciones", label: "Operaciones", icon: Truck },
  { id: "devoluciones", label: "Devoluciones", icon: RotateCcw },
  { id: "conteo", label: "Conteo Físico", icon: PackageCheck },
];

export default function RoutePortal() {
  const [tab, setTab] = useState("operaciones");
  const [data, setData] = useState({ employees: [], products: [], dispatches: [], deliveries: [], inventory: [], devoluciones: [] });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [employees, products, dispatches, deliveries, inventory, devoluciones, configs] = await Promise.all([
      Employee.list(),
      Producto.list(),
      Dispatch.list(),
      Delivery.list(),
      Inventory.list(),
      Devolucion.list(),
      AppConfig.filter({ key: "pending_row_order" }),
    ]);

    // Aplicar orden guardado de la planilla de pendientes
    const activeEmps = employees.filter(e => e.is_active);
    let routeOrder = [];
    if (configs.length > 0) {
      try { routeOrder = JSON.parse(configs[0].value); } catch {}
    }
    const orderedEmployees = [
      ...routeOrder.map(id => activeEmps.find(e => e.employee_id === id)).filter(Boolean),
      ...activeEmps.filter(e => !routeOrder.includes(e.employee_id)),
    ];

    setData({
      employees: orderedEmployees,
      products: (products || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })),
      dispatches,
      deliveries,
      inventory,
      devoluciones,
    });
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">Portal de Ruta</h1>
            <p className="text-xs text-slate-500">Planillador · eQuis-T</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Resumen del día */}
            {(() => {
              const todayCol = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })).toISOString().split("T")[0];
              const todayDeliveries = data.deliveries.filter(d => (d.delivery_date || "").slice(0, 10) === todayCol && d.status !== "borrador");

              // Unidades entregadas por referencia
              const unitsByRef = {};
              todayDeliveries.forEach(d => {
                if (d.items?.length > 0) {
                  d.items.forEach(i => {
                    unitsByRef[i.product_reference] = (unitsByRef[i.product_reference] || 0) + (i.quantity || 0);
                  });
                } else if (d.product_reference) {
                  unitsByRef[d.product_reference] = (unitsByRef[d.product_reference] || 0) + (d.quantity || 0);
                }
              });

              // Despachos del día por referencia
              const dispatchesByRef = {};
              data.dispatches.filter(d => (d.dispatch_date || "").slice(0, 10) === todayCol).forEach(d => {
                dispatchesByRef[d.product_reference] = (dispatchesByRef[d.product_reference] || 0) + (d.quantity || 0);
              });
              const totalDispatched = Object.values(dispatchesByRef).reduce((s, q) => s + q, 0);

              if (todayDeliveries.length === 0 && totalDispatched === 0) return null;

              const totalOperariosHoy = new Set(todayDeliveries.map(d => d.employee_id)).size;
              const totalActivos = data.employees.filter(e => e.is_active !== false).length;

              return (
                <div className="bg-green-700 text-white rounded-xl p-4 mb-4 shadow">
                  {todayDeliveries.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-green-200 mb-3 uppercase tracking-wide">📦 Entregas recibidas hoy</p>
                      <div className="flex gap-4 flex-wrap mb-3">
                        <div>
                          <p className="text-2xl font-bold">{totalOperariosHoy} <span className="text-base font-normal text-green-200">de {totalActivos}</span></p>
                          <p className="text-xs text-green-200">operarios activos entregaron</p>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-wrap items-start mb-3">
                        <div className="bg-green-800 rounded-lg px-3 py-1.5 border border-green-500">
                          <p className="text-xs text-green-200 leading-tight">Total entregas</p>
                          <p className="text-lg font-bold">{Object.values(unitsByRef).reduce((s, q) => s + q, 0).toLocaleString("es-CO")} uds</p>
                        </div>
                        {Object.entries(unitsByRef).map(([ref, qty]) => {
                          const prod = data.products.find(p => p.reference === ref);
                          return (
                            <div key={ref} className="bg-green-600 rounded-lg px-3 py-1.5">
                              <p className="text-xs text-green-200 leading-tight">{prod?.name || `Ref. ${ref}`}</p>
                              <p className="text-lg font-bold">{qty.toLocaleString("es-CO")} uds</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Despachos del día */}
                  {totalDispatched > 0 && (
                    <>
                      <p className="text-xs font-semibold text-green-200 mt-3 mb-2 uppercase tracking-wide">🚧 Despachos de hoy</p>
                      <div className="flex gap-3 flex-wrap items-start">
                        <div className="bg-blue-800 rounded-lg px-3 py-1.5 border border-blue-500">
                          <p className="text-xs text-blue-200 leading-tight">Total despachado</p>
                          <p className="text-lg font-bold">{totalDispatched.toLocaleString("es-CO")} uds</p>
                        </div>
                        {Object.entries(dispatchesByRef).map(([ref, qty]) => {
                          const prod = data.products.find(p => p.reference === ref);
                          return (
                            <div key={ref} className="bg-blue-700 rounded-lg px-3 py-1.5">
                              <p className="text-xs text-blue-200 leading-tight">{prod?.name || `Ref. ${ref}`}</p>
                              <p className="text-lg font-bold">{qty.toLocaleString("es-CO")} uds</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {tab === "operaciones" && (
              <>
                <RouteChecklist
                  employees={data.employees}
                  dispatches={data.dispatches}
                  deliveries={data.deliveries}
                />
                <RouteOperario {...data} onSaved={loadData} />
                <RouteRegistrosHoy {...data} onSaved={loadData} />
              </>
            )}
            {tab === "devoluciones" && <RouteDevoluciones {...data} onSaved={loadData} />}
            {tab === "conteo" && <RouteConteoFisico employees={data.employees} products={data.products} deliveries={data.deliveries} dispatches={data.dispatches} devoluciones={data.devoluciones} onSaved={loadData} />}
          </>
        )}
      </div>
    </div>
  );
}