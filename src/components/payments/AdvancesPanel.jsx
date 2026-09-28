import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react";
import { money, fmtDay } from "@/utils/advances";

function AdvanceCard({ item, onDelete }) {
  const a = item.advance;
  const pct = Number(a.amount) > 0 ? Math.min(100, Math.round((item.deducted / Number(a.amount)) * 100)) : 0;
  const modeText = a.advance_mode === "cuotas" && Number(a.advance_installment) > 0
    ? `En cuotas de ${money(a.advance_installment)}`
    : "Todo en el próximo pago";

  return (
    <div className={`p-4 rounded-xl border ${item.settled ? "bg-slate-50 border-slate-200" : "bg-white border-amber-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{a.employee_name || a.employee_id}</p>
          <p className="text-xs text-slate-500">
            {fmtDay(a.payment_date)} · {modeText}{a.advance_reason ? ` · ${a.advance_reason}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.settled ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Saldado</Badge>
          ) : item.transferred ? (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">Transferido</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="w-3 h-3 mr-1" />Por transferir</Badge>
          )}
          {item.deductions.length === 0 && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" title="Anular anticipo" onClick={() => onDelete(item)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[11px] text-slate-500">Prestado</p>
          <p className="font-bold text-slate-800 tabular-nums">{money(a.amount)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <p className="text-[11px] text-emerald-700">Descontado</p>
          <p className="font-bold text-emerald-700 tabular-nums">{money(item.deducted)}</p>
        </div>
        <div className={`rounded-lg p-2 ${item.settled ? "bg-slate-50" : "bg-amber-50"}`}>
          <p className={`text-[11px] ${item.settled ? "text-slate-500" : "text-amber-700"}`}>Falta</p>
          <p className={`font-bold tabular-nums ${item.settled ? "text-slate-500" : "text-amber-800"}`}>{money(item.balance)}</p>
        </div>
      </div>

      <div className="h-2 bg-slate-200 rounded mt-3 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>

      {item.deductions.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {item.deductions.map((d) => (
            <p key={d.id} className="text-xs text-slate-600">
              • {fmtDay(d.payment_date)} — descontado {money(d.deducted_amount)} del pago
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdvancesPanel({ advances, onNew, onDelete }) {
  const [showSettled, setShowSettled] = useState(false);
  const active = advances.filter((x) => !x.settled);
  const settled = advances.filter((x) => x.settled);

  const outstanding = active.reduce((s, x) => s + x.balance, 0);
  const toTransfer = active.filter((x) => !x.transferred).reduce((s, x) => s + (Number(x.advance.amount) || 0), 0);
  const people = new Set(active.map((x) => x.advance.employee_id)).size;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-amber-600" />
          Anticipos y préstamos
        </CardTitle>
        <Button onClick={onNew} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="w-4 h-4 mr-1" /> Nuevo anticipo
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">Por descontar (plata afuera)</p>
            <p className="text-2xl font-bold text-amber-800 tabular-nums">{money(outstanding)}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-600">Personas con anticipo</p>
            <p className="text-2xl font-bold text-slate-800">{people}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700">Pendiente de transferir</p>
            <p className="text-2xl font-bold text-blue-800 tabular-nums">{money(toTransfer)}</p>
          </div>
        </div>

        {active.length === 0 ? (
          <p className="text-center text-slate-500 py-6">No hay anticipos activos.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((item) => <AdvanceCard key={item.advance.id} item={item} onDelete={onDelete} />)}
          </div>
        )}

        {settled.length > 0 && (
          <div>
            <button onClick={() => setShowSettled((v) => !v)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              {showSettled ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Saldados ({settled.length})
            </button>
            {showSettled && (
              <div className="grid gap-3 md:grid-cols-2 mt-3">
                {settled.map((item) => <AdvanceCard key={item.advance.id} item={item} onDelete={onDelete} />)}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400">
          El anticipo aparece en Transferencias bancarias para transferirlo. Al registrar el próximo pago del empleado,
          el sistema propone el descuento y deja las entregas pagadas completas.
        </p>
      </CardContent>
    </Card>
  );
}
