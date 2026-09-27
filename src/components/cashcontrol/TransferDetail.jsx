import React, { useEffect, useMemo, useState } from "react";
import { BankAccount, SaleItem, User } from "@/entities/all";
import { AlertTriangle, Loader2 } from "lucide-react";

// Ventana para considerar dos transferencias del mismo valor como posible duplicado.
const DUP_WINDOW_MIN = 15;

// Nombres de cuentas y usuarios: cambian poco, se piden una vez por carga de página.
let lookupsPromise = null;
function loadLookups() {
  if (!lookupsPromise) {
    lookupsPromise = Promise.all([
      BankAccount.list().catch(() => []),
      User.list().catch(() => []),
    ]).then(([accounts, users]) => ({
      accounts: Object.fromEntries((accounts || []).map(a => [a.id, a])),
      users: Object.fromEntries((users || []).map(u => [u.id, u])),
    }));
  }
  return lookupsPromise;
}

function fmtTime(t) {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
}

const money = (n) => `$${(Number(n) || 0).toLocaleString("es-CO")}`;

// Detalle de las transferencias de un día/sucursal, con alertas para cuadrar contra el banco.
export default function TransferDetail({ items, total }) {
  const [lookups, setLookups] = useState({ accounts: {}, users: {} });
  const [itemCounts, setItemCounts] = useState(null); // sale_id -> nº de productos

  useEffect(() => { loadLookups().then(setLookups); }, []);

  const rows = useMemo(
    () => [...(items || [])].sort((a, b) => new Date(a.time) - new Date(b.time)),
    [items]
  );

  // Productos por venta: una "venta" sin productos suele ser un registro fantasma
  // (se guardó dos veces o quedó a medias) y infla el total.
  useEffect(() => {
    const ids = [...new Set(rows.filter(r => r.source === "sale").map(r => r.sale_id))];
    if (!ids.length) { setItemCounts({}); return; }
    let cancelled = false;
    SaleItem.filter({ sale_id: { $in: ids } })
      .then(list => {
        if (cancelled) return;
        const counts = Object.fromEntries(ids.map(id => [id, 0]));
        (list || []).forEach(it => { counts[it.sale_id] = (counts[it.sale_id] || 0) + 1; });
        setItemCounts(counts);
      })
      .catch(() => { if (!cancelled) setItemCounts({}); });
    return () => { cancelled = true; };
  }, [rows]);

  const alertsByKey = useMemo(() => {
    const alerts = {};
    const add = (k, a) => { (alerts[k] = alerts[k] || []).push(a); };
    rows.forEach((r, i) => {
      rows.forEach((o, j) => {
        if (j <= i || r.sale_id === o.sale_id) return;
        const mins = Math.abs(new Date(r.time) - new Date(o.time)) / 60000;
        if (Number(r.amount) === Number(o.amount) && mins <= DUP_WINDOW_MIN) {
          add(r.key, { level: "red", text: "¿Duplicada? mismo valor y hora cercana" });
          add(o.key, { level: "red", text: "¿Duplicada? mismo valor y hora cercana" });
        }
        const ref = (r.reference || "").trim();
        if (ref && ref === (o.reference || "").trim()) {
          add(r.key, { level: "red", text: "Referencia repetida" });
          add(o.key, { level: "red", text: "Referencia repetida" });
        }
      });
      if (r.source === "sale" && itemCounts && itemCounts[r.sale_id] === 0) {
        add(r.key, { level: "red", text: "Venta sin productos (posible registro fantasma)" });
      }
    });
    return alerts;
  }, [rows, itemCounts]);

  const sumOf = (src) => rows.filter(r => r.source === src).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const ventas = sumOf("sale");
  const abonos = sumOf("abono");
  const detailTotal = ventas + abonos;
  const nAlerts = rows.filter(r => alertsByKey[r.key]?.some(a => a.level === "red")).length;
  const mismatch = Math.round(detailTotal) !== Math.round(Number(total) || 0);

  if (!rows.length) {
    return <p className="text-xs text-slate-500 p-3">No hay transferencias registradas este día.</p>;
  }

  return (
    <div className="mt-3 rounded-lg border border-purple-200 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-purple-50 border-b border-purple-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-bold text-purple-800">🏦 Detalle de transferencias ({rows.length})</span>
        <span className="text-slate-600">Ventas: <b>{money(ventas)}</b></span>
        <span className="text-slate-600">Abonos: <b>{money(abonos)}</b></span>
        <span className="text-slate-600">Total: <b>{money(detailTotal)}</b></span>
        {nAlerts > 0 && (
          <span className="flex items-center gap-1 text-red-700 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" /> {nAlerts} por revisar
          </span>
        )}
        {itemCounts === null && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />}
      </div>
      {mismatch && (
        <p className="px-3 py-1.5 text-xs bg-amber-50 text-amber-800 border-b border-amber-200">
          El detalle ({money(detailTotal)}) no coincide con el total guardado ({money(total)}). Recarga la página para recalcular.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-medium px-3 py-1.5">Hora</th>
              <th className="text-left font-medium px-2 py-1.5">Factura</th>
              <th className="text-left font-medium px-2 py-1.5">Tipo</th>
              <th className="text-left font-medium px-2 py-1.5">Cliente</th>
              <th className="text-left font-medium px-2 py-1.5">Cuenta</th>
              <th className="text-left font-medium px-2 py-1.5">Referencia</th>
              <th className="text-left font-medium px-2 py-1.5">Registró</th>
              <th className="text-right font-medium px-3 py-1.5">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const alerts = alertsByKey[r.key] || [];
              const isRed = alerts.some(a => a.level === "red");
              const account = lookups.accounts[r.bank_account_id];
              const seller = lookups.users[r.seller_id];
              return (
                <React.Fragment key={r.key}>
                  <tr className={`border-t border-slate-100 ${isRed ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtTime(r.time)}</td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      {r.invoice ? `#${r.invoice}` : (r.sale_id ? `#${String(r.sale_id).slice(-8)}` : "—")}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {r.source === "abono" ? "Abono crédito" : r.mixed ? "Venta (pago mixto)" : "Venta"}
                      {r.method === "qr" && <span className="ml-1 text-slate-400">· QR</span>}
                    </td>
                    <td className="px-2 py-1.5 max-w-[140px] truncate" title={r.customer}>{r.customer || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {account ? account.name : <span className="text-slate-400">sin cuenta</span>}
                    </td>
                    <td className="px-2 py-1.5 max-w-[120px] truncate" title={r.reference}>
                      {r.reference || <span className="text-slate-400">sin referencia</span>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {seller?.full_name?.split(" ")[0] || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                      {money(r.amount)}
                      {r.mixed && r.sale_total > 0 && (
                        <div className="font-normal text-[10px] text-slate-400">de {money(r.sale_total)}</div>
                      )}
                    </td>
                  </tr>
                  {alerts.length > 0 && (
                    <tr className={isRed ? "bg-red-50" : ""}>
                      <td colSpan={8} className="px-3 pb-1.5 text-[11px] text-red-700">
                        {[...new Set(alerts.map(a => a.text))].map(t => (
                          <span key={t} className="inline-flex items-center gap-1 mr-3">
                            <AlertTriangle className="w-3 h-3" /> {t}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
