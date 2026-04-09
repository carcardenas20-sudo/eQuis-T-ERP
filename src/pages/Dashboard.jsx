import React, { useState, useEffect } from "react";
import { useSession } from "../components/providers/SessionProvider";
import {
  Sale, Location, Expense, Credit, Dispatch, PaymentRequest, Remision, Presupuesto,
  Employee, Delivery, Inventory, Payment, EmployeePurchase, Producto
} from "@/entities/all";
import {
  DollarSign, Wallet, Package, TrendingUp, CreditCard, AlertTriangle, Building2,
  Truck, Clock, CheckCircle, Factory, BarChart3, ArrowRightLeft, ShoppingCart
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DeliveredUnits from "../components/dashboard/DeliveredUnits";
import PaymentRequestsWidget from "../components/dashboard/PaymentRequests";
import PendingDeliveriesByEmployee from "../components/dashboard/PendingDeliveriesByEmployee";
import AvailableForDispatch from "../components/dashboard/AvailableForDispatch";
import PendingPayments from "../components/dashboard/PendingPayments";
import EmployeeAuditSummary from "../components/dashboard/EmployeeAuditSummary";
import ProductionStats from "../components/dashboard/ProductionStats";
import OverdueDeliveries from "../components/dashboard/OverdueDeliveries";

function todayInColombia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function fmtCOP(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-CO");
}

function StatCard({ label, value, icon: Icon, bg, iconCls, sub }) {
  return (
    <div className="bg-white p-3 sm:p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-slate-600 mb-1 leading-tight">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 tabular-nums break-all">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`${bg} p-2 sm:p-3 rounded-xl shrink-0`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconCls}`} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, color }) {
  const cls = {
    blue: "border-blue-500 text-blue-900",
    violet: "border-violet-500 text-violet-900",
    emerald: "border-emerald-500 text-emerald-900",
  }[color] || "border-slate-400 text-slate-900";
  return (
    <div className={`border-l-4 pl-3 mb-4 ${cls}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { currentUser, userRole, userLocation, permissions, isLoading: isSessionLoading, isRealAdmin, previewRoleId } = useSession();

  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('all');

  const [comercialStats, setComercialStats] = useState(null);
  const [operariosStats, setOperariosStats] = useState(null);
  const [pipelineStats, setPipelineStats] = useState(null);

  const [loadingComercial, setLoadingComercial] = useState(false);
  const [loadingOperarios, setLoadingOperarios] = useState(false);
  const [loadingPipeline, setLoadingPipeline] = useState(false);

  // In preview mode, admin bypass is disabled so sections reflect the previewed role
  const isAdmin = isRealAdmin && !previewRoleId;
  const hasComercial = isAdmin || permissions?.includes("dashboard_comercial") || permissions?.some(p => ["pos_sales","sales_view"].includes(p));
  const hasOperarios = isAdmin || permissions?.includes("dashboard_operarios") || permissions?.includes("operarios_view");
  const hasPipeline = isAdmin || permissions?.includes("dashboard_produccion") || permissions?.some(p => ["produccion_pipeline_view","produccion_view"].includes(p));

  useEffect(() => {
    if (isSessionLoading || !currentUser) return;
    if (!hasComercial) return;
    Location.list().then(locs => {
      setLocations(locs);
      if (!isAdmin && userLocation) setSelectedLocation(userLocation.id);
    }).catch(() => {});
  }, [isSessionLoading, currentUser, previewRoleId]);

  useEffect(() => {
    if (isSessionLoading || !currentUser) return;
    setComercialStats(null);
    if (!hasComercial) return;
    loadComercial();
  }, [selectedLocation, isSessionLoading, currentUser, previewRoleId]);

  useEffect(() => {
    if (isSessionLoading || !currentUser) return;
    setOperariosStats(null);
    setPipelineStats(null);
    if (hasOperarios) loadOperarios();
    if (hasPipeline) loadPipeline();
  }, [isSessionLoading, currentUser, previewRoleId]);

  const loadComercial = async () => {
    setLoadingComercial(true);
    try {
      const todayStr = todayInColombia();
      const locationFilter = (!isAdmin && userLocation)
        ? { location_id: userLocation.id }
        : (isAdmin && selectedLocation !== 'all' ? { location_id: selectedLocation } : {});

      const [allSales, todayExpenses, allCredits] = await Promise.all([
        Sale.filter({ status: 'completed', ...locationFilter }),
        Expense.filter(locationFilter),
        Credit.filter(locationFilter)
      ]);

      const salesToday = allSales.filter(s => {
        if (!s.sale_date) return false;
        return new Date(s.sale_date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) === todayStr;
      });

      let cashIncome = 0, cardIncome = 0, transferIncome = 0;
      salesToday.forEach(sale => {
        const methods = Array.isArray(sale.payment_methods) ? sale.payment_methods : [];
        if (methods.length > 0) {
          methods.forEach(pm => {
            const amt = Number(pm.amount) || 0;
            if (pm.method === 'cash') cashIncome += amt;
            else if (pm.method === 'card') cardIncome += amt;
            else transferIncome += amt;
          });
        } else {
          cashIncome += Number(sale.total_amount) || 0;
        }
      });

      const expensesToday = todayExpenses.filter(e => String(e.expense_date || '').slice(0, 10) === todayStr);
      const cashExpenses = expensesToday.filter(e => e.payment_method === 'cash').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const totalExpenses = expensesToday.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const totalIncome = cashIncome + cardIncome + transferIncome;

      const pendingCredits = allCredits.filter(c => (c.pending_amount || 0) > 0).reduce((s, c) => s + (Number(c.pending_amount) || 0), 0);
      const overdueCredits = allCredits.filter(c => c.status === 'overdue').length;

      setComercialStats({ totalIncome, cashIncome, cardIncome, transferIncome, totalExpenses, cashExpenses, netCashInDrawer: cashIncome - cashExpenses, pendingCredits, overdueCredits });
    } catch (e) {
      console.error("Error cargando comercial:", e);
    } finally {
      setLoadingComercial(false);
    }
  };

  const loadOperarios = async () => {
    setLoadingOperarios(true);
    try {
      const results = await Promise.allSettled([
        Employee.list(),
        Producto.list(),
        Delivery.list(),
        Dispatch.list(),
        Inventory.list(),
        Payment.list(),
        PaymentRequest.list(),
        EmployeePurchase.list(),
      ]);
      const get = (i) => results[i].status === 'fulfilled' ? results[i].value : [];
      const rawProductos = get(1);
      const normProductos = rawProductos.map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra }));
      setOperariosStats({
        employees: get(0),
        products: normProductos,
        deliveries: get(2),
        dispatches: get(3),
        inventory: get(4),
        payments: get(5),
        paymentRequests: get(6),
        purchases: get(7),
      });
    } catch (e) {
      console.error("Error cargando operarios:", e);
    } finally {
      setLoadingOperarios(false);
    }
  };

  const loadPipeline = async () => {
    setLoadingPipeline(true);
    try {
      const presupuestos = await Presupuesto.list();
      const aprobados = presupuestos.filter(p => p.estado === 'aprobado');

      // Collect all pending materials (comprado: false) from approved presupuestos
      const pendingMap = {};
      aprobados.forEach(p => {
        const mats = Array.isArray(p.materiales_calculados) ? p.materiales_calculados : [];
        mats.forEach(m => {
          if (m.comprado) return;
          const key = `${m.materia_prima_id}_${m.color || ''}`;
          if (!pendingMap[key]) {
            pendingMap[key] = {
              nombre: m.nombre,
              color: m.color || '—',
              tipo_material: m.tipo_material || '—',
              unidad_medida: m.unidad_medida || '',
              precio_unitario: m.precio_unitario || 0,
              cantidad_total: 0,
              costo_total: 0,
              presupuestos_count: 0,
            };
          }
          pendingMap[key].cantidad_total += Number(m.cantidad_total) || 0;
          pendingMap[key].costo_total += Number(m.costo_total) || 0;
          pendingMap[key].presupuestos_count += 1;
        });
      });

      const pendingList = Object.values(pendingMap)
        .sort((a, b) => b.costo_total - a.costo_total);

      const totalCostoPendiente = pendingList.reduce((s, m) => s + m.costo_total, 0);

      setPipelineStats({
        pendingList,
        totalCostoPendiente,
        totalPresupuestosAprobados: aprobados.length,
        totalItems: pendingList.length,
      });
    } catch (e) {
      console.error("Error cargando producción:", e);
    } finally {
      setLoadingPipeline(false);
    }
  };

  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const TIPO_COLORS = {
    tela: 'bg-blue-100 text-blue-700',
    forro: 'bg-indigo-100 text-indigo-700',
    cremallera: 'bg-amber-100 text-amber-700',
    hilo: 'bg-purple-100 text-purple-700',
    accesorio: 'bg-slate-100 text-slate-600',
    otro: 'bg-stone-100 text-stone-600',
  };

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen pb-24 sm:pb-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">

        <div className="mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">{currentUser?.full_name || currentUser?.email} · {userRole?.name}</p>
        </div>

        {/* ── SECCIÓN COMERCIAL ──────────────────────────────── */}
        {hasComercial && (
          <section className="space-y-4">
            <SectionHeader title="Comercial" subtitle="Ventas, caja y créditos del día" color="blue" />

            {isAdmin && locations.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por sucursal:</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isAdmin && userLocation && (
              <Alert className="border-blue-200 bg-blue-50 py-2 px-3">
                <Building2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm ml-2">
                  Datos de <strong>{userLocation.name}</strong>
                </AlertDescription>
              </Alert>
            )}

            {loadingComercial ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : comercialStats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Efectivo en Caja" value={fmtCOP(comercialStats.netCashInDrawer)} icon={Wallet} bg="bg-emerald-100" iconCls="text-emerald-600" />
                  <StatCard label="Ingresos Hoy" value={fmtCOP(comercialStats.totalIncome)} icon={DollarSign} bg="bg-blue-100" iconCls="text-blue-600" />
                  <StatCard label="Gastos Hoy" value={fmtCOP(comercialStats.totalExpenses)} icon={Package} bg="bg-purple-100" iconCls="text-purple-600" />
                  <StatCard label="Balance" value={fmtCOP(comercialStats.totalIncome - comercialStats.totalExpenses)} icon={TrendingUp} bg="bg-amber-100" iconCls="text-amber-600" />
                  <StatCard label="Por Cobrar" value={fmtCOP(comercialStats.pendingCredits)} icon={CreditCard} bg="bg-orange-100" iconCls="text-orange-600" />
                  <StatCard label="Créditos Vencidos" value={comercialStats.overdueCredits} icon={AlertTriangle} bg="bg-red-100" iconCls="text-red-600" sub="créditos" />
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Cierre de Caja del Día</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 mb-1">Efectivo</p>
                      <p className="text-lg font-bold text-green-900 tabular-nums">{fmtCOP(comercialStats.cashIncome)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">Tarjeta</p>
                      <p className="text-lg font-bold text-blue-900 tabular-nums">{fmtCOP(comercialStats.cardIncome)}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-xs text-purple-700 mb-1">Transferencia</p>
                      <p className="text-lg font-bold text-purple-900 tabular-nums">{fmtCOP(comercialStats.transferIncome)}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 mb-1">Gastos</p>
                      <p className="text-lg font-bold text-red-900 tabular-nums">{fmtCOP(comercialStats.totalExpenses)}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        )}

        {/* ── SECCIÓN PRODUCCIÓN ────────────────────────────── */}
        {hasPipeline && (
          <section className="space-y-4">
            <SectionHeader title="Producción" subtitle="Materias primas pendientes de compra (presupuestos aprobados)" color="emerald" />

            {loadingPipeline ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : pipelineStats ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    label="Ítems por comprar"
                    value={pipelineStats.totalItems}
                    icon={ShoppingCart}
                    bg="bg-emerald-100"
                    iconCls="text-emerald-600"
                    sub="materiales distintos"
                  />
                  <StatCard
                    label="Costo total estimado"
                    value={fmtCOP(pipelineStats.totalCostoPendiente)}
                    icon={DollarSign}
                    bg="bg-amber-100"
                    iconCls="text-amber-600"
                    sub="suma de pendientes"
                  />
                  <StatCard
                    label="Presupuestos aprobados"
                    value={pipelineStats.totalPresupuestosAprobados}
                    icon={BarChart3}
                    bg="bg-blue-100"
                    iconCls="text-blue-600"
                    sub="con materiales sin comprar"
                  />
                </div>

                {/* Materials table */}
                {pipelineStats.pendingList.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                    <p className="font-medium text-emerald-700">Todo comprado</p>
                    <p className="text-sm mt-1">No hay materias primas pendientes en presupuestos aprobados.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-slate-700">
                          Lista de compras — {pipelineStats.totalItems} ítems
                        </span>
                      </div>
                      <Link to={createPageUrl("Prod_Presupuestos")} className="text-xs text-emerald-600 hover:underline">
                        Ver presupuestos →
                      </Link>
                    </div>

                    {/* Table header */}
                    <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-100">
                      <span>Material</span>
                      <span>Tipo</span>
                      <span>Color</span>
                      <span className="text-right">Cantidad</span>
                      <span className="text-right">Precio unit.</span>
                      <span className="text-right">Costo total</span>
                    </div>

                    {/* Table rows */}
                    <div className="divide-y divide-slate-100">
                      {pipelineStats.pendingList.map((mat, idx) => (
                        <div key={idx} className="hover:bg-slate-50 transition-colors">
                          {/* Mobile layout */}
                          <div className="sm:hidden px-4 py-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-900 text-sm truncate">{mat.nombre}</span>
                              <span className="text-sm font-bold text-emerald-700 tabular-nums shrink-0">{fmtCOP(mat.costo_total)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[mat.tipo_material] || 'bg-slate-100 text-slate-600'}`}>
                                {mat.tipo_material}
                              </span>
                              <span className="text-xs text-slate-500">{mat.color}</span>
                              <span className="text-xs text-slate-600 tabular-nums ml-auto">
                                {mat.cantidad_total % 1 === 0 ? mat.cantidad_total : mat.cantidad_total.toFixed(2)} {mat.unidad_medida}
                              </span>
                            </div>
                          </div>
                          {/* Desktop layout */}
                          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 items-center">
                            <span className="font-medium text-slate-900 text-sm">{mat.nombre}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full w-fit font-medium ${TIPO_COLORS[mat.tipo_material] || 'bg-slate-100 text-slate-600'}`}>
                              {mat.tipo_material}
                            </span>
                            <span className="text-sm text-slate-600">{mat.color}</span>
                            <span className="text-sm text-slate-800 text-right tabular-nums">
                              {mat.cantidad_total % 1 === 0 ? mat.cantidad_total : mat.cantidad_total.toFixed(2)} {mat.unidad_medida}
                            </span>
                            <span className="text-sm text-slate-600 text-right tabular-nums">{fmtCOP(mat.precio_unitario)}</span>
                            <span className="text-sm font-semibold text-emerald-700 text-right tabular-nums">{fmtCOP(mat.costo_total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer total */}
                    <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                      <span className="text-sm font-semibold text-emerald-800">Total estimado a comprar</span>
                      <span className="text-lg font-bold text-emerald-900 tabular-nums">{fmtCOP(pipelineStats.totalCostoPendiente)}</span>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </section>
        )}

        {/* ── SECCIÓN OPERARIOS ─────────────────────────────── */}
        {hasOperarios && (
          <section className="space-y-4">
            <SectionHeader title="Operarios" subtitle="Resumen operativo: entregas, despachos y pagos" color="violet" />

            {loadingOperarios ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : operariosStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <DeliveredUnits deliveries={operariosStats.deliveries} />
                  <PaymentRequestsWidget
                    paymentRequests={operariosStats.paymentRequests}
                    onRefresh={loadOperarios}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <PendingDeliveriesByEmployee
                    employees={operariosStats.employees}
                    products={operariosStats.products}
                    deliveries={operariosStats.deliveries}
                    dispatches={operariosStats.dispatches}
                  />
                  <AvailableForDispatch
                    inventory={operariosStats.inventory}
                    products={operariosStats.products}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <PendingPayments
                    employees={operariosStats.employees}
                    deliveries={operariosStats.deliveries}
                    payments={operariosStats.payments}
                    purchases={operariosStats.purchases}
                  />
                  <EmployeeAuditSummary
                    employees={operariosStats.employees}
                    deliveries={operariosStats.deliveries}
                    dispatches={operariosStats.dispatches}
                    payments={operariosStats.payments}
                    products={operariosStats.products}
                    purchases={operariosStats.purchases}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <OverdueDeliveries
                    employees={operariosStats.employees}
                    dispatches={operariosStats.dispatches}
                    deliveries={operariosStats.deliveries}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <ProductionStats
                    employees={operariosStats.employees}
                    deliveries={operariosStats.deliveries}
                    dispatches={operariosStats.dispatches}
                  />
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Sin módulos */}
        {!hasComercial && !hasOperarios && !hasPipeline && (
          <div className="text-center py-16 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Sin acceso al dashboard</p>
            <p className="text-sm mt-1">Tu rol no tiene permisos de dashboard asignados. Contacta al administrador.</p>
          </div>
        )}

      </div>
    </div>
  );
}
