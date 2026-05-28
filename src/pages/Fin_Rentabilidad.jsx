import React, { useState, useEffect, useMemo } from "react";
import { Sale } from "@/entities/Sale";
import { Producto, MateriaPrima } from "@/api/entitiesChaquetas";
import { base44 } from "@/api/base44Combined";
// Delivery y Employee viven en el mismo backend (localClient)
const Delivery = base44.entities.Delivery;
const Employee = base44.entities.Employee;
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Percent, RefreshCw } from "lucide-react";

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
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesesAtras, setMesesAtras] = useState(6);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, prodData, mpData, deliveriesData, employeesData] = await Promise.all([
        Sale.list("-sale_date"),
        Producto.list(),
        MateriaPrima.list(),
        Delivery.list("-delivery_date"),
        Employee.list(),
      ]);
      setSales(salesData || []);
      setProductos(prodData || []);
      setMateriasPrimas(mpData || []);
      setDeliveries(deliveriesData || []);
      setEmployees(employeesData || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const mpMap = useMemo(() => Object.fromEntries(materiasPrimas.map(m => [m.id, m])), [materiasPrimas]);

  // Costo de materiales por unidad de cada producto de producción
  const costoMatPorUnidad = useMemo(() => {
    const res = {};
    productos.forEach(p => {
      res[p.id] = (p.materiales_requeridos || []).reduce((s, mat) => {
        const mp = mpMap[mat.materia_prima_id];
        return s + (mat.cantidad_por_unidad || 0) * (mp?.precio_por_unidad || 0);
      }, 0);
    });
    return res;
  }, [productos, mpMap]);

  // Datos por mes
  const datosPorMes = useMemo(() => {
    const meses = {};

    // Ingresos reales: ventas del día 1 al 30/31, todas las sucursales
    sales.forEach(sale => {
      const mes = getMesKey(sale.sale_date || sale.created_date);
      if (!mes) return;
      if (!meses[mes]) meses[mes] = { ingreso: 0, costoManoObra: 0 };
      meses[mes].ingreso += (sale.total_amount || 0);
    });

    // Mano de obra destajo: suma de entregas de prendas por operario
    deliveries.forEach(d => {
      const mes = getMesKey(d.delivery_date);
      if (!mes) return;
      if (!meses[mes]) meses[mes] = { ingreso: 0, costoManoObra: 0 };
      meses[mes].costoManoObra += (d.total_amount || 0);
    });

    // Mano de obra fija: salario mensual de operarios de planta activos
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

    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({
        key,
        label: getMesLabel(key),
        ingreso: Math.round(d.ingreso),
        costoManoObra: Math.round(d.costoManoObra),
        margen: Math.round(d.ingreso - d.costoManoObra),
        margenPct: d.ingreso > 0 ? ((d.ingreso - d.costoManoObra) / d.ingreso * 100) : 0,
      }));
  }, [sales, deliveries, employees]);

  const datosRecientes = useMemo(() => datosPorMes.slice(-mesesAtras), [datosPorMes, mesesAtras]);

  // Proyección: promedio últimos 3 meses → próximos 3 meses
  const proyeccion = useMemo(() => {
    const base = datosPorMes.slice(-3);
    if (base.length === 0) return [];
    const avg = (key) => base.reduce((s, d) => s + d[key], 0) / base.length;
    const avgIngreso = avg("ingreso");
    const avgMO = avg("costoManoObra");

    const lastKey = datosPorMes[datosPorMes.length - 1]?.key || getMesKey(new Date().toISOString());
    const [ly, lm] = lastKey.split("-").map(Number);

    return Array.from({ length: 3 }, (_, i) => {
      const date = new Date(ly, lm + i, 1);
      const key = getMesKey(date.toISOString());
      const ingreso = Math.round(avgIngreso);
      const costoManoObra = Math.round(avgMO);
      return {
        key, label: getMesLabel(key) + " *",
        ingreso, costoManoObra,
        margen: ingreso - costoManoObra,
        margenPct: ingreso > 0 ? ((ingreso - costoManoObra) / ingreso * 100) : 0,
        proyectado: true,
      };
    });
  }, [datosPorMes]);

  // KPIs: acumulado últimos 12 meses
  const kpi = useMemo(() => {
    const data = datosPorMes.slice(-12);
    const ingreso = data.reduce((s, d) => s + d.ingreso, 0);
    const costoMO = data.reduce((s, d) => s + d.costoManoObra, 0);
    const margen = ingreso - costoMO;
    const margenPct = ingreso > 0 ? margen / ingreso * 100 : 0;

    const rec = datosPorMes.slice(-3).reduce((s, d) => s + d.ingreso, 0);
    const ant = datosPorMes.slice(-6, -3).reduce((s, d) => s + d.ingreso, 0);
    const trend = ant > 0 ? (rec - ant) / ant * 100 : null;

    return { ingreso, costoMO, margen, margenPct, trend };
  }, [datosPorMes]);

  const chartData = [...datosRecientes, ...proyeccion.slice(0, 3)];

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
          <p className="text-sm text-slate-500 mt-0.5">Ventas reales (todas las sucursales) · entregas destajo + salarios fijos planta</p>
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
          value={fmtK(kpi.costoMO)}
          sub={`${kpi.ingreso > 0 ? (kpi.costoMO / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`}
          icon={Users}
          color="bg-violet-100 text-violet-700"
        />
        <KpiCard
          label="Margen (12m)"
          value={fmtK(kpi.margen)}
          sub={`${kpi.margenPct.toFixed(1)}% margen bruto`}
          icon={Percent}
          color={kpi.margen >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
        />
      </div>

      {/* Gráfica principal */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Ingresos vs Mano de obra por mes</h2>
          <span className="text-xs text-slate-400">* proyectado</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingreso" name="Ingresos" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="costoManoObra" name="Mano de obra" fill="#8b5cf6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Margen por mes */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4">Margen bruto por mes</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Line dataKey="margen" name="Margen" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
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
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Ingresos ventas</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Mano de obra</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">Margen</th>
                <th className="text-right px-3 py-2 text-slate-500 font-semibold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...datosRecientes].reverse().map(d => (
                <tr key={d.key} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{d.label}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{fmt(d.ingreso)}</td>
                  <td className="px-3 py-2 text-right text-violet-700">{fmt(d.costoManoObra)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${d.margen >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(d.margen)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${d.margenPct >= 0 ? "text-green-600" : "text-red-500"}`}>{d.margenPct.toFixed(1)}%</td>
                </tr>
              ))}
              {proyeccion.map(d => (
                <tr key={d.key} className="bg-amber-50/60">
                  <td className="px-3 py-2 font-medium text-amber-700">{d.label}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fmt(d.ingreso)}</td>
                  <td className="px-3 py-2 text-right text-violet-600">{fmt(d.costoManoObra)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${d.margen >= 0 ? "text-green-500" : "text-red-400"}`}>{fmt(d.margen)}</td>
                  <td className="px-3 py-2 text-right text-amber-600 font-semibold">{d.margenPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
