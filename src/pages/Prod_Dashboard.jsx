import React, { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Shirt, Calculator, Truck, AlertTriangle, DollarSign, CheckCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const ESTADO_COLORS = {
  borrador: '#94a3b8',
  enviado: '#3b82f6',
  aprobado: '#22c55e',
  rechazado: '#ef4444',
};

const ESTADO_LABELS = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [presupuestos, productos, materiasPrimas, inventario, remisiones] = await Promise.all([
      base44.entities.Presupuesto.list('-created_date', 100),
      base44.entities.Producto.list(),
      base44.entities.MateriaPrima.list(),
      base44.entities.Inventario.list('-updated_date', 200),
      base44.entities.Remision.list('-created_date', 50),
    ]);

    // Presupuestos por estado (para pie chart)
    const estadoCount = {};
    let costoTotal = 0;
    let costoAprobados = 0;
    presupuestos.forEach(p => {
      estadoCount[p.estado] = (estadoCount[p.estado] || 0) + 1;
      costoTotal += p.total_general || 0;
      if (p.estado === 'aprobado') costoAprobados += p.total_general || 0;
    });
    const pieData = Object.entries(estadoCount).map(([estado, count]) => ({
      name: ESTADO_LABELS[estado] || estado,
      value: count,
      color: ESTADO_COLORS[estado] || '#94a3b8',
    }));

    // Costos por presupuesto (últimos 8, para bar chart)
    const barData = presupuestos.slice(0, 8).reverse().map(p => ({
      name: p.numero_presupuesto?.replace('PRES-', '#') || 'Sin #',
      costo: parseFloat((p.total_general || 0).toFixed(0)),
      estado: p.estado,
    }));

    // Alertas de inventario bajo: items con stock <= 0 o con nombre en materias primas que tengan stock_minimo
    const alertasInventario = [];
    materiasPrimas.forEach(mp => {
      if (!mp.stock_minimo) return;
      // Buscar en inventario
      const items = inventario.filter(i => i.materia_prima_id === mp.id);
      const totalStock = items.reduce((s, i) => s + (i.cantidad_disponible || 0), 0);
      if (totalStock <= mp.stock_minimo) {
        alertasInventario.push({
          nombre: mp.nombre,
          stock: totalStock,
          minimo: mp.stock_minimo,
          unidad: mp.unidad_medida,
        });
      }
    });

    // Items de inventario sin stock
    const sinStock = inventario.filter(i => (i.cantidad_disponible || 0) <= 0);

    setData({
      presupuestos,
      totalPresupuestos: presupuestos.length,
      aprobados: estadoCount['aprobado'] || 0,
      borradores: estadoCount['borrador'] || 0,
      costoTotal,
      costoAprobados,
      productos: productos.length,
      materiasPrimas: materiasPrimas.length,
      remisionesPendientes: remisiones.filter(r => r.estado === 'pendiente').length,
      pieData,
      barData,
      alertasInventario,
      sinStock: sinStock.length,
    });
    setIsLoading(false);
  };

  const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  if (isLoading) return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general de producción y presupuestos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Presupuestos</span>
              <Calculator className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-900">{data.totalPresupuestos}</div>
            <div className="text-xs text-blue-600 mt-1">{data.aprobados} aprobados · {data.borradores} borradores</div>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Costo Total</span>
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-900 break-all leading-tight">{fmt(data.costoTotal)}</div>
            <div className="text-xs text-green-600 mt-1 break-all">Aprobados: {fmt(data.costoAprobados)}</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-100 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Remisiones</span>
              <Clock className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-yellow-900">{data.remisionesPendientes}</div>
            <div className="text-xs text-yellow-600 mt-1">Pendientes de producción</div>
          </CardContent>
        </Card>

        <Card className={`border-red-100 ${data.alertasInventario.length > 0 || data.sinStock > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${data.alertasInventario.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>Alertas Stock</span>
              <AlertTriangle className={`w-4 h-4 ${data.alertasInventario.length > 0 ? 'text-red-400' : 'text-slate-300'}`} />
            </div>
            <div className={`text-3xl font-bold ${data.alertasInventario.length > 0 ? 'text-red-900' : 'text-slate-400'}`}>
              {data.alertasInventario.length}
            </div>
            <div className={`text-xs mt-1 ${data.alertasInventario.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {data.sinStock > 0 ? `${data.sinStock} ítems sin stock` : 'Stock bajo mínimo'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart: costos por presupuesto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">Costo por Presupuesto (últimos)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.barData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Presupuesto ${l}`} />
                  <Bar dataKey="costo" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart: presupuestos por estado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">Presupuestos por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {data.pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} presupuestos`, name]} />
                  <Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Alertas + Presupuestos recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas de inventario */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.alertasInventario.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 text-sm py-4">
                <CheckCircle className="w-4 h-4" /> Todo el stock está sobre el mínimo
              </div>
            ) : (
              <div className="space-y-2">
                {data.alertasInventario.slice(0, 6).map((alerta, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-red-50 border border-red-100 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-red-800">{alerta.nombre}</span>
                      <div className="text-xs text-red-500">Mínimo: {alerta.minimo} {alerta.unidad}</div>
                    </div>
                    <Badge className="bg-red-100 text-red-700 border-red-200 border">
                      {alerta.stock} {alerta.unidad}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Presupuestos recientes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">Presupuestos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.presupuestos.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{p.numero_presupuesto}</div>
                    <div className="text-xs text-slate-500">{p.cliente}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-700">{fmt(p.total_general || 0)}</div>
                    <Badge className={`text-xs border-0 ${
                      p.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                      p.estado === 'enviado' ? 'bg-blue-100 text-blue-700' :
                      p.estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{ESTADO_LABELS[p.estado] || p.estado}</Badge>
                  </div>
                </div>
              ))}
              {data.presupuestos.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">No hay presupuestos aún</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}