import React, { useState, useEffect, useMemo } from "react";
import { Sale } from "@/entities/Sale";
import { Presupuesto } from "@/api/entitiesChaquetas";
import { base44 } from "@/api/base44Combined";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Percent, RefreshCw, Package, Repeat, ArrowUpRight } from "lucide-react";

const Delivery = base44.entities.Delivery;
const Employee = base44.entities.Employee;
const AccountPayable = base44.entities.AccountPayable;

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n) => {
  if (!n && n !== 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs}`;
};

function getMesKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMesLabel(key) {
  const [y, m] = key.split("-");
  return `${MESES_LABEL[parseInt(m) - 1]} ${y.slice(2)}`;
}

function KpiCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {trend != null && (
        <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold">{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Rentabilidad() {
  const [sales, setSales] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesesAtras, setMesesAtras] = useState(6);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, deliveriesData, employeesData, presupuestosData, gastosData] = await Promise.all([
        Sale.list("-sale_date"),
        Delivery.list("-delivery_date"),
        Employee.list(),
        Presupuesto.list("-created_date"),
        AccountPayable.list("-created_date", 1000),
      ]);
      setSales(salesData || []);
      setDeliveries(deliveriesData || []);
      setEmployees(employeesData || []);
      setPresupuestos((presupuestosData || []).filter(p => p.estado !== "rechazado"));
      setGastos(gastosData || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const datosPorMes = useMemo(() => {
    const meses = {};
    const init = (key) => {
      if (!meses[key]) meses[key] = { ingreso: 0, costoManoObra: 0, costoMateriales: 0, gastosFijos: 0, gastosVariables: 0 };
    };

    // Ingresos: ventas reales
    sales.forEach(sale => {
      const mes = getMesKey(sale.sale_date || sale.created_date);
      if (!mes) return;
      init(mes);
      meses[mes].ingreso += (sale.total_amount || 0);
    });

    // Mano de obra destajo: entregas de prendas
    deliveries.forEach(d => {
      const mes = getMesKey(d.delivery_date);
      if (!mes) return;
      init(mes);
      meses[mes].costoManoObra += (d.total_amount || 0);
    });

    // Mano de obra fija: salario mensual operarios de planta
    const plantaEmpleados = employees.filter(
      e => e.tipo_operario === "planta" && e.is_active && e.salario_mensual > 0
    );
    Object.keys(meses).forEach(mesKey => {
      const [y, m] = mesKey.split("-").map(Number);
      const mesDate = new Date(y, m - 1, 1);
      plantaEmpleados.forEach(emp => {
        const hireDate = emp.hire_date ? new Date(emp.hire_date + "T00:00:00") : null;
        const retiroDate = emp.fecha_retiro ? new Date(emp.fecha_retiro + "T00:00:00") : null;
        if (hireDate && mesDate < new Date(hireDate.getFullYear(), hireDate.getMonth(), 1)) return;
        if (retiroDate && mesDate > new Date(retiroDate.getFullYear(), retiroDate.getMonth(), 1)) return;
        meses[mesKey].costoManoObra += (emp.salario_mensual || 0);
      });
    });

    // Materias primas: costo de materiales de presupuestos aprobados
    presupuestos.forEach(p => {
      const mes = getMesKey(p.created_date);
      if (!mes) return;
      init(mes);
      meses[mes].costoMateriales += (p.total_materiales || 0);
    });

    // Gastos fijos y variables: AccountPayable por fecha de vencimiento
    gastos.forEach(g => {
      const mes = getMesKey(g.due_date || g.created_date);
      if (!mes) return;
      init(mes);
      if (g.category === "gasto_fijo") {
        meses[mes].gastosFijos += (g.total_amount || 0);
      } else if (g.category === "gasto_variable") {
        meses[mes].gastosVariables += (g.total_amount || 0);
      }
    });

    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => {
        const costoTotal = d.costoManoObra + d.costoMateriales + d.gastosFijos + d.gastosVariables;
        const utilidad = d.ingreso - costoTotal;
        return {
          key,
          label: getMesLabel(key),
          ingreso: Math.round(d.ingreso),
          costoManoObra: Math.round(d.costoManoObra),
          costoMateriales: Math.round(d.costoMateriales),
          gastosFijos: Math.round(d.gastosFijos),
          gastosVariables: Math.round(d.gastosVariables),
          costoTotal: Math.round(costoTotal),
          utilidad: Math.round(utilidad),
          utilidadPct: d.ingreso > 0 ? (utilidad / d.ingreso * 100) : 0,
        };
      });
  }, [sales, deliveries, employees, presupuestos, gastos]);

  const datosRecientes = useMemo(() => datosPorMes.slice(-mesesAtras), [datosPorMes, mesesAtras]);

  // Proyección: promedio últimos 3 meses → próximos 3 meses
  const proyeccion = useMemo(() => {
    const base = datosPorMes.slice(-3);
    if (base.length === 0) return [];
    const avg = (key) => base.reduce((s, d) => s + d[key], 0) / base.length;

    const lastKey = datosPorMes[datosPorMes.length - 1]?.key || getMesKey(new Date().toISOString());
    const [ly, lm] = lastKey.split("-").map(Number);

    return Array.from({ length: 3 }, (_, i) => {
      const date = new Date(ly, lm + i, 1);
      const key = getMesKey(date.toISOString());
      const ingreso = Math.round(avg("ingreso"));
      const costoManoObra = Math.round(avg("costoManoObra"));
      const costoMateriales = Math.round(avg("costoMateriales"));
      const gastosFijos = Math.round(avg("gastosFijos"));
      const gastosVariables = Math.round(avg("gastosVariables"));
      const costoTotal = costoManoObra + costoMateriales + gastosFijos + gastosVariables;
      const utilidad = ingreso - costoTotal;
      return {
        key, label: getMesLabel(key) + " *",
        ingreso, costoManoObra, costoMateriales, gastosFijos, gastosVariables,
        costoTotal, utilidad,
        utilidadPct: ingreso > 0 ? (utilidad / ingreso * 100) : 0,
        proyectado: true,
      };
    });
  }, [datosPorMes]);

  // KPIs: acumulado últimos 12 meses
  const kpi = useMemo(() => {
    const data = datosPorMes.slice(-12);
    const sum = (key) => data.reduce((s, d) => s + d[key], 0);
    const ingreso = sum("ingreso");
    const costoManoObra = sum("costoManoObra");
    const costoMateriales = sum("costoMateriales");
    const gastosFijos = sum("gastosFijos");
    const gastosVariables = sum("gastosVariables");
    const costoTotal = costoManoObra + costoMateriales + gastosFijos + gastosVariables;
    const utilidad = ingreso - costoTotal;
    const utilidadPct = ingreso > 0 ? utilidad / ingreso * 100 : 0;

    const rec = datosPorMes.slice(-3).reduce((s, d) => s + d.ingreso, 0);
    const ant = datosPorMes.slice(-6, -3).reduce((s, d) => s + d.ingreso, 0);
    const trend = ant > 0 ? (rec - ant) / ant * 100 : null;

    return { ingreso, costoManoObra, costoMateriales, gastosFijos, gastosVariables, costoTotal, utilidad, utilidadPct, trend };
  }, [datosPorMes]);

  const chartData = [...datosRecientes, ...proyeccion];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rentabilidad</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ingresos vs costos reales · base causación</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mesesAtras}
            onChange={e => setMesesAtras(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
          <button onClick={loadData} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          label="Ingresos (12m)"
          value={fmtK(kpi.ingreso)}
          sub="ventas · todas las sucursales"
          icon={DollarSign}
          color="bg-emerald-100 text-emerald-700"
          trend={kpi.trend}
        />
        <KpiCard
          label="Mano de Obra (12m)"
          value={fmtK(kpi.costoManoObra)}
          sub={`${kpi.ingreso > 0 ? (kpi.costoManoObra / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`}
          icon={Users}
          color="bg-violet-100 text-violet-700"
        />
        <KpiCard
          label="Materias Primas (12m)"
          value={fmtK(kpi.costoMateriales)}
          sub={`${kpi.ingreso > 0 ? (kpi.costoMateriales / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`}
          icon={Package}
          color="bg-orange-100 text-orange-700"
        />
        <KpiCard
          label="Gastos Fijos (12m)"
          value={fmtK(kpi.gastosFijos)}
          sub={`${kpi.ingreso > 0 ? (kpi.gastosFijos / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`}
          icon={Repeat}
          color="bg-blue-100 text-blue-700"
        />
        <KpiCard
          label="Gastos Variables (12m)"
          value={fmtK(kpi.gastosVariables)}
          sub={`${kpi.ingreso > 0 ? (kpi.gastosVariables / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`}
          icon={ArrowUpRight}
          color="bg-amber-100 text-amber-700"
        />
        <KpiCard
          label="Utilidad Neta (12m)"
          value={fmtK(kpi.utilidad)}
          sub={`${kpi.utilidadPct.toFixed(1)}% margen neto`}
          icon={Percent}
          color={kpi.utilidad >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
        />
      </div>

      {/* Gráfica principal: costos apilados vs ingresos */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Ingresos vs Costos por mes</h2>
          <span className="text-xs text-slate-400">* proyectado</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingreso" name="Ingresos" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="costoManoObra" name="Mano de obra" stackId="costos" fill="#8b5cf6" />
            <Bar dataKey="costoMateriales" name="Materias primas" stackId="costos" fill="#f97316" />
            <Bar dataKey="gastosFijos" name="Gastos fijos" stackId="costos" fill="#3b82f6" />
            <Bar dataKey="gastosVariables" name="Gastos variables" stackId="costos" fill="#f59e0b" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Utilidad neta por mes */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4">Utilidad neta por mes</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Line dataKey="utilidad" name="Utilidad neta" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla mensual */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Detalle mensual</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2 text-slate-500 font-semibold">Mes</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Ingresos</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Mano obra</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Materiales</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">G. Fijos</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">G. Variables</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Utilidad</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...datosRecientes].reverse().map(d => (
                <tr key={d.key} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{d.label}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{fmt(d.ingreso)}</td>
                  <td className="px-3 py-2 text-right text-violet-700">{fmt(d.costoManoObra)}</td>
                  <td className="px-3 py-2 text-right text-orange-700">{fmt(d.costoMateriales)}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{fmt(d.gastosFijos)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{fmt(d.gastosVariables)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${d.utilidad >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(d.utilidad)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${d.utilidadPct >= 0 ? "text-green-600" : "text-red-500"}`}>{d.utilidadPct.toFixed(1)}%</td>
                </tr>
              ))}
              {proyeccion.map(d => (
                <tr key={d.key} className="bg-amber-50/60">
                  <td className="px-3 py-2 font-medium text-amber-700">{d.label}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fmt(d.ingreso)}</td>
                  <td className="px-3 py-2 text-right text-violet-600">{fmt(d.costoManoObra)}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{fmt(d.costoMateriales)}</td>
                  <td className="px-3 py-2 text-right text-blue-600">{fmt(d.gastosFijos)}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{fmt(d.gastosVariables)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${d.utilidad >= 0 ? "text-green-500" : "text-red-400"}`}>{fmt(d.utilidad)}</td>
                  <td className="px-3 py-2 text-right text-amber-600 font-semibold">{d.utilidadPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
