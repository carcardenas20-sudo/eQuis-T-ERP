import React, { useState, useEffect, useMemo } from "react";
import { Presupuesto, Producto, MateriaPrima } from "@/api/entitiesChaquetas";
import { base44 } from "@/api/base44Combined";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Percent, RefreshCw } from "lucide-react";

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n) => {
  if (!n) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
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
  const [presupuestos, setPresupuestos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesesAtras, setMesesAtras] = useState(6);

  const loadData = async () => {
    setLoading(true);
    try {
      const [presData, prodData, mpData, payData] = await Promise.all([
        Presupuesto.filter({ estado: "aprobado" }),
        Producto.list(),
        MateriaPrima.list(),
        base44.entities.Payment.list("-payment_date"),
      ]);
      setPresupuestos(presData || []);
      setProductos(prodData || []);
      setMateriasPrimas(mpData || []);
      setPayments(payData || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Mapas de lookup
  const prodMap = useMemo(() => Object.fromEntries(productos.map(p => [p.id, p])), [productos]);
  const mpMap = useMemo(() => Object.fromEntries(materiasPrimas.map(m => [m.id, m])), [materiasPrimas]);

  // Costo de materiales por unidad de un producto
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

    // Ingresos y costos de materiales desde presupuestos
    presupuestos.forEach(p => {
      const mes = getMesKey(p.fecha_entrega || p.created_date);
      if (!mes) return;
      if (!meses[mes]) meses[mes] = { ingreso: 0, costoMateriales: 0, costoManoObra: 0 };

      (p.productos || []).forEach(item => {
        const prod = prodMap[item.producto_id];
        const totalUnidades = (item.combinaciones || []).reduce((s, c) =>
          s + (c.tallas_cantidades || []).reduce((ss, t) => ss + (Number(t.cantidad) || 0), 0), 0);
        if (totalUnidades === 0) return;

        meses[mes].ingreso += (prod?.precio_venta || 0) * totalUnidades;
        meses[mes].costoMateriales += (costoMatPorUnidad[item.producto_id] || 0) * totalUnidades;
      });
    });

    // Mano de obra desde pagos
    payments.forEach(pay => {
      const mes = getMesKey(pay.payment_date);
      if (!mes) return;
      if (!meses[mes]) meses[mes] = { ingreso: 0, costoMateriales: 0, costoManoObra: 0 };
      meses[mes].costoManoObra += (pay.amount || 0);
    });

    // Ordenar y calcular margen
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({
        key,
        label: getMesLabel(key),
        ingreso: Math.round(d.ingreso),
        costoMateriales: Math.round(d.costoMateriales),
        costoManoObra: Math.round(d.costoManoObra),
        costoTotal: Math.round(d.costoMateriales + d.costoManoObra),
        margen: Math.round(d.ingreso - d.costoMateriales - d.costoManoObra),
        margenPct: d.ingreso > 0 ? ((d.ingreso - d.costoMateriales - d.costoManoObra) / d.ingreso * 100) : 0,
      }));
  }, [presupuestos, payments, prodMap, costoMatPorUnidad]);

  // Ultimos N meses para gráfica
  const datosRecientes = useMemo(() => datosPorMes.slice(-mesesAtras), [datosPorMes, mesesAtras]);

  // Proyección: promedio últimos 3 meses → próximos 3 meses
  const proyeccion = useMemo(() => {
    const base = datosPorMes.slice(-3);
    if (base.length === 0) return [];
    const avg = (key) => base.reduce((s, d) => s + d[key], 0) / base.length;
    const avgIngreso = avg("ingreso");
    const avgMat = avg("costoMateriales");
    const avgMO = avg("costoManoObra");

    const lastKey = datosPorMes[datosPorMes.length - 1]?.key || getMesKey(new Date().toISOString());
    const [ly, lm] = lastKey.split("-").map(Number);

    return Array.from({ length: 3 }, (_, i) => {
      const date = new Date(ly, lm + i, 1);
      const key = getMesKey(date.toISOString());
      const costoTotal = Math.round(avgMat + avgMO);
      const ingreso = Math.round(avgIngreso);
      return {
        key, label: getMesLabel(key) + " *",
        ingreso, costoMateriales: Math.round(avgMat),
        costoManoObra: Math.round(avgMO),
        costoTotal, margen: ingreso - costoTotal,
        margenPct: ingreso > 0 ? ((ingreso - costoTotal) / ingreso * 100) : 0,
        proyectado: true,
      };
    });
  }, [datosPorMes]);

  // Rentabilidad por producto (top 10)
  const porProducto = useMemo(() => {
    const res = {};
    presupuestos.forEach(p => {
      (p.productos || []).forEach(item => {
        const prod = prodMap[item.producto_id];
        if (!prod) return;
        const totalUnidades = (item.combinaciones || []).reduce((s, c) =>
          s + (c.tallas_cantidades || []).reduce((ss, t) => ss + (Number(t.cantidad) || 0), 0), 0);
        if (totalUnidades === 0) return;
        if (!res[item.producto_id]) res[item.producto_id] = { nombre: prod.nombre, unidades: 0, ingreso: 0, costo: 0 };
        res[item.producto_id].unidades += totalUnidades;
        res[item.producto_id].ingreso += (prod.precio_venta || 0) * totalUnidades;
        res[item.producto_id].costo += (costoMatPorUnidad[item.producto_id] || 0) * totalUnidades;
      });
    });
    return Object.values(res)
      .map(r => ({ ...r, margen: r.ingreso - r.costo, margenPct: r.ingreso > 0 ? (r.ingreso - r.costo) / r.ingreso * 100 : 0 }))
      .sort((a, b) => b.ingreso - a.ingreso)
      .slice(0, 10);
  }, [presupuestos, prodMap, costoMatPorUnidad]);

  // KPIs: acumulado últimos 12 meses
  const kpi = useMemo(() => {
    const data = datosPorMes.slice(-12);
    const ingreso = data.reduce((s, d) => s + d.ingreso, 0);
    const costoMat = data.reduce((s, d) => s + d.costoMateriales, 0);
    const costoMO = data.reduce((s, d) => s + d.costoManoObra, 0);
    const margen = ingreso - costoMat - costoMO;
    const margenPct = ingreso > 0 ? margen / ingreso * 100 : 0;

    // Tendencia: comparar últimos 3 vs 3 anteriores
    const rec = datosPorMes.slice(-3).reduce((s, d) => s + d.ingreso, 0);
    const ant = datosPorMes.slice(-6, -3).reduce((s, d) => s + d.ingreso, 0);
    const trend = ant > 0 ? (rec - ant) / ant * 100 : null;

    return { ingreso, costoMat, costoMO, margen, margenPct, trend };
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rentabilidad</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ingresos, costos y margen por mes · basado en presupuestos aprobados y pagos</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos (12m)" value={fmtK(kpi.ingreso)} sub="presupuestos aprobados" icon={DollarSign} color="bg-emerald-100 text-emerald-700" trend={kpi.trend} />
        <KpiCard label="Costo Materiales" value={fmtK(kpi.costoMat)} sub={`${kpi.ingreso > 0 ? (kpi.costoMat / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`} icon={Package} color="bg-blue-100 text-blue-700" />
        <KpiCard label="Mano de Obra" value={fmtK(kpi.costoMO)} sub={`${kpi.ingreso > 0 ? (kpi.costoMO / kpi.ingreso * 100).toFixed(1) : 0}% de ingresos`} icon={Users} color="bg-violet-100 text-violet-700" />
        <KpiCard label="Margen Bruto" value={fmtK(kpi.margen)} sub={`${kpi.margenPct.toFixed(1)}% margen`} icon={Percent} color={kpi.margen >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} />
      </div>

      {/* Gráfica principal */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Ingresos vs Costos por mes</h2>
          <span className="text-xs text-slate-400">* proyectado</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingreso" name="Ingresos" fill="#10b981" radius={[3,3,0,0]} opacity={(d) => d?.proyectado ? 0.45 : 1} />
            <Bar dataKey="costoMateriales" name="Materiales" fill="#3b82f6" radius={[3,3,0,0]} />
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
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Line dataKey="margen" name="Margen" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <th className="text-right px-3 py-2 text-slate-500 font-semibold">Costos</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-semibold">Margen</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...datosRecientes].reverse().map(d => (
                  <tr key={d.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{d.label}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{fmtK(d.ingreso)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtK(d.costoTotal)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${d.margen >= 0 ? "text-green-600" : "text-red-500"}`}>{fmtK(d.margen)}</td>
                    <td className={`px-3 py-2 text-right ${d.margenPct >= 0 ? "text-green-600" : "text-red-500"}`}>{d.margenPct.toFixed(1)}%</td>
                  </tr>
                ))}
                {proyeccion.map(d => (
                  <tr key={d.key} className="bg-amber-50/50">
                    <td className="px-3 py-2 font-medium text-amber-700">{d.label}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{fmtK(d.ingreso)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{fmtK(d.costoTotal)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${d.margen >= 0 ? "text-green-500" : "text-red-400"}`}>{fmtK(d.margen)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{d.margenPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rentabilidad por producto */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Por producto (acumulado)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2 text-slate-500 font-semibold">Producto</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-semibold">Uds</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-semibold">Ingresos</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-semibold">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {porProducto.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700 max-w-[140px] truncate">{p.nombre}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{p.unidades.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{fmtK(p.ingreso)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-bold ${p.margenPct >= 30 ? "text-green-600" : p.margenPct >= 15 ? "text-amber-600" : "text-red-500"}`}>
                        {p.margenPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {porProducto.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Sin datos de productos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
