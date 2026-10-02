import React, { useEffect, useMemo, useState } from "react";
import { Sale, Expense, Credit, Payment } from "@/entities/all";
import { locationFilterAsync, isAmbulante } from "@/utils/locations";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, AreaChart, Area } from "recharts";
import { Wallet, Banknote, CreditCard, Smartphone, Landmark, Receipt, AlertTriangle, TrendingUp, TrendingDown, Loader2, ArrowRight } from "lucide-react";

// Dashboard comercial: lo del día (todos) + ventas por sucursal y por día (solo admin).
const n = (v) => Number(v) || 0;
const money = (v) => `$${Math.round(n(v)).toLocaleString("es-CO")}`;
const short = (v) => {
  const x = Math.abs(n(v));
  if (x >= 1e6) return `$${(n(v) / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace(".0", "")}M`;
  if (x >= 1e3) return `$${Math.round(n(v) / 1e3)}k`;
  return money(v);
};
const dayOf = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const today = () => dayOf(Date.now());
const addDays = (day, k) => { const x = new Date(`${day}T12:00:00`); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const fmtDay = (d) => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; };
const BLUE = "#2563eb";

// Lo recibido por método en una venta (solo dinero real; 'credit' = parte que queda debiendo)
function metodosDeVenta(s) {
  const out = { cash: 0, transfer: 0, card: 0, credit: 0, otro: 0 };
  const ms = Array.isArray(s.payment_methods) ? s.payment_methods : [];
  if (!ms.length) { out.cash += n(s.total_amount); return out; }
  for (const pm of ms) {
    const a = n(pm.amount);
    if (pm.method === "cash") out.cash += a;
    else if (pm.method === "transfer" || pm.method === "qr") out.transfer += a;
    else if (pm.method === "card") out.card += a;
    else if (pm.method === "credit") out.credit += a;
    else out.otro += a; // saldo a favor, cortesía…
  }
  return out;
}

function Tile({ label, value, icon: Icon, tone = "slate", sub }) {
  const tones = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    violet: "bg-violet-50 border-violet-200 text-violet-800",
    sky: "bg-sky-50 border-sky-200 text-sky-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    slate: "bg-slate-50 border-slate-200 text-slate-800",
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className="text-lg sm:text-xl font-extrabold tabular-nums mt-1 text-slate-900 dark:text-white">{money(value)}</div>
      {sub && <div className="text-[11px] mt-0.5 text-slate-500">{sub}</div>}
    </div>
  );
}

export default function ComercialDashboard({ isAdmin, locations, userLocation }) {
  const [loc, setLoc] = useState("all");
  const [periodo, setPeriodo] = useState(7); // días para gráficos (admin)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const locationId = isAdmin ? loc : userLocation?.id;

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const hoy = today();
        const desde = isAdmin ? addDays(hoy, -(Math.max(periodo, 1) - 1)) : addDays(hoy, -1); // líder: hoy y ayer (comparar)
        const desdeConsulta = addDays(desde < addDays(hoy, -1) ? desde : addDays(hoy, -1), -1); // colchón por zona horaria
        const locFilter = locationId && locationId !== "all" ? { location_id: await locationFilterAsync(locationId) } : {};
        const [ventas, gastos, abonos, creditos] = await Promise.all([
          Sale.filter({ status: { $in: ["completed", "credit"] }, sale_date: { $gte: desdeConsulta }, ...locFilter }),
          Expense.filter({ expense_date: { $gte: desdeConsulta }, ...locFilter }),
          Payment.filter({ type: "credit_payment", payment_date: { $gte: desdeConsulta }, ...locFilter }),
          Credit.filter(locFilter),
        ]);
        if (!cancel) setData({ ventas: ventas || [], gastos: gastos || [], abonos: abonos || [], creditos: creditos || [], desde, hoy });
      } catch (e) {
        console.error("dashboard comercial", e);
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [locationId, periodo, isAdmin]);

  const calc = useMemo(() => {
    if (!data) return null;
    const { ventas, gastos, abonos, creditos, desde, hoy } = data;
    const ayer = addDays(hoy, -1);
    const vHoy = ventas.filter((s) => s.sale_date && dayOf(s.sale_date) === hoy);
    const vAyer = ventas.filter((s) => s.sale_date && dayOf(s.sale_date) === ayer);
    const totalHoy = vHoy.reduce((s, x) => s + n(x.total_amount), 0);
    const totalAyer = vAyer.reduce((s, x) => s + n(x.total_amount), 0);

    const met = { cash: 0, transfer: 0, card: 0, credit: 0, otro: 0 };
    for (const s of vHoy) { const m = metodosDeVenta(s); for (const k in met) met[k] += m[k]; }
    const abHoy = abonos.filter((p) => p.payment_date && dayOf(p.payment_date) === hoy && n(p.amount) > 0);
    const ab = { cash: 0, transfer: 0, card: 0 };
    for (const p of abHoy) {
      if (p.method === "cash") ab.cash += n(p.amount);
      else if (p.method === "transfer" || p.method === "qr") ab.transfer += n(p.amount);
      else if (p.method === "card") ab.card += n(p.amount);
    }
    const gHoy = gastos.filter((e) => String(e.expense_date || "").slice(0, 10) === hoy);
    const gastosEfectivo = gHoy.filter((e) => e.payment_method === "cash").reduce((s, e) => s + n(e.amount), 0);
    const gastosTotal = gHoy.reduce((s, e) => s + n(e.amount), 0);
    const efectivoRecibido = met.cash + ab.cash;

    const porCobrar = creditos.reduce((s, c) => s + Math.max(0, n(c.pending_amount)), 0);
    const vencidos = creditos.filter((c) => c.status === "overdue" || (n(c.pending_amount) > 0 && c.due_date && String(c.due_date).slice(0, 10) < hoy));

    // Ventas por sucursal (puestos ambulantes suman a su sucursal) en el periodo
    const padreDe = (id) => { const l = locations.find((x) => x.id === id); return isAmbulante(l) ? l.parent_location_id : id; };
    const enPeriodo = ventas.filter((s) => s.sale_date && dayOf(s.sale_date) >= desde && dayOf(s.sale_date) <= hoy);
    const porSuc = {};
    for (const s of enPeriodo) { const k = padreDe(s.location_id) || "—"; porSuc[k] = (porSuc[k] || 0) + n(s.total_amount); }
    const sucursales = Object.entries(porSuc)
      .map(([id, total]) => ({ nombre: locations.find((l) => l.id === id)?.name || "Sin sucursal", total }))
      .sort((a, b) => b.total - a.total);

    const porDia = [];
    for (let d = desde; d <= hoy; d = addDays(d, 1)) porDia.push({ dia: d, label: fmtDay(d), total: 0, facturas: 0 });
    const idx = Object.fromEntries(porDia.map((x, i) => [x.dia, i]));
    for (const s of enPeriodo) { const i = idx[dayOf(s.sale_date)]; if (i !== undefined) { porDia[i].total += n(s.total_amount); porDia[i].facturas += 1; } }
    const totalPeriodo = enPeriodo.reduce((s, x) => s + n(x.total_amount), 0);

    return {
      totalHoy, totalAyer, facturasHoy: vHoy.length, met, ab, abonosHoy: ab.cash + ab.transfer + ab.card,
      gastosEfectivo, gastosTotal, gastosOtros: gastosTotal - gastosEfectivo, efectivoRecibido,
      efectivoQueda: efectivoRecibido - gastosEfectivo, porCobrar, vencidos, sucursales, porDia, totalPeriodo,
    };
  }, [data, locations]);

  const variacion = calc && calc.totalAyer > 0 ? ((calc.totalHoy - calc.totalAyer) / calc.totalAyer) * 100 : null;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="all">Todas las sucursales</option>
            {locations.filter((l) => !isAmbulante(l)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {loading || !calc ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
      ) : (
        <>
          {/* 1. Ventas de hoy */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-800">Ventas de hoy</p>
              <p className="text-3xl sm:text-4xl font-extrabold tabular-nums text-slate-900">{money(calc.totalHoy)}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {calc.facturasHoy} factura{calc.facturasHoy !== 1 ? "s" : ""}
                {calc.facturasHoy > 0 && ` · ticket promedio ${money(calc.totalHoy / calc.facturasHoy)}`}
              </p>
            </div>
            {variacion !== null && (
              <div className={`flex items-center gap-1 text-sm font-semibold ${variacion >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {variacion >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {variacion >= 0 ? "+" : ""}{variacion.toFixed(0)}% vs ayer ({short(calc.totalAyer)})
              </div>
            )}
          </div>

          {/* 2. Cómo se vendió hoy */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ventas de hoy por medio de pago</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Efectivo" value={calc.met.cash} icon={Banknote} tone="emerald" />
              <Tile label="Transferencia / QR" value={calc.met.transfer} icon={Smartphone} tone="violet" />
              <Tile label="Tarjeta" value={calc.met.card} icon={CreditCard} tone="blue" />
              <Tile label="A crédito (por cobrar)" value={calc.met.credit} icon={Landmark} tone="sky" sub={calc.met.otro > 0 ? `Otros (saldo a favor, cortesía): ${money(calc.met.otro)}` : undefined} />
            </div>
            {calc.abonosHoy > 0 && (
              <p className="text-xs text-slate-600 mt-2">
                + Abonos a créditos hoy: <b>{money(calc.abonosHoy)}</b>
                {" "}(efectivo {money(calc.ab.cash)} · transferencia {money(calc.ab.transfer)}{calc.ab.card > 0 ? ` · tarjeta ${money(calc.ab.card)}` : ""})
              </p>
            )}
          </div>

          {/* 3. Caja de hoy */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Efectivo de hoy</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Tile label="Efectivo recibido" value={calc.efectivoRecibido} icon={Banknote} tone="slate" sub="Ventas + abonos en efectivo" />
              <Tile label="Gastos en efectivo" value={calc.gastosEfectivo} icon={Receipt} tone="red" sub={calc.gastosOtros > 0 ? `Otros gastos (no efectivo): ${money(calc.gastosOtros)}` : "Salen de la caja"} />
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><Wallet className="w-3.5 h-3.5" />Efectivo que debe haber</div>
                <div className={`text-xl sm:text-2xl font-extrabold tabular-nums mt-1 ${calc.efectivoQueda >= 0 ? "text-emerald-900" : "text-red-700"}`}>{money(calc.efectivoQueda)}</div>
                <Link to={createPageUrl("CashControl")} className="text-[11px] text-emerald-700 underline inline-flex items-center gap-0.5">Control de Efectivo <ArrowRight className="w-3 h-3" /></Link>
              </div>
            </div>
          </div>

          {/* 4. Cartera */}
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Créditos por cobrar" value={calc.porCobrar} icon={Landmark} tone="amber" sub="Saldo total pendiente" />
            <div className={`rounded-xl border p-3 ${calc.vencidos.length ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-800"><AlertTriangle className="w-3.5 h-3.5" />Créditos vencidos</div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{calc.vencidos.length}</div>
              <div className="text-[11px] text-slate-500">{money(calc.vencidos.reduce((s, c) => s + n(c.pending_amount), 0))} · <Link to={createPageUrl("Credits")} className="underline">ver créditos</Link></div>
            </div>
          </div>

          {/* 5. Solo admin: ventas por sucursal y por día */}
          {isAdmin && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">Ventas · {periodo === 1 ? "hoy" : `últimos ${periodo} días`} · <span className="tabular-nums">{money(calc.totalPeriodo)}</span></p>
                <div className="flex gap-1">
                  {[1, 7, 30].map((p) => (
                    <button key={p} onClick={() => setPeriodo(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${periodo === p ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {p === 1 ? "Hoy" : `${p} días`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Por sucursal</p>
                {calc.sucursales.length === 0 ? <p className="text-sm text-slate-400">Sin ventas en el periodo.</p> : (
                  <ResponsiveContainer width="100%" height={Math.max(60, calc.sucursales.length * 40)}>
                    <BarChart data={calc.sucursales} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} formatter={(v) => [money(v), "Ventas"]} />
                      <Bar dataKey="total" fill={BLUE} radius={[0, 4, 4, 0]} barSize={18}>
                        <LabelList dataKey="total" position="right" formatter={short} style={{ fontSize: 12, fill: "#334155" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {periodo > 1 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Por día</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={calc.porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip formatter={(v, k, item) => [`${money(v)} · ${item.payload.facturas} facturas`, "Ventas"]} labelFormatter={(l) => `Día ${l}`} />
                      <Area type="monotone" dataKey="total" stroke={BLUE} strokeWidth={2} fill={BLUE} fillOpacity={0.12} dot={periodo <= 7 ? { r: 4, fill: BLUE } : false} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
