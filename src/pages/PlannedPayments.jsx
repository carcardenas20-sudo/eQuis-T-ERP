import React, { useEffect, useMemo, useState } from "react";
import { ExpenseTask } from "@/entities/ExpenseTask";
import { PayableInstallment } from "@/entities/PayableInstallment";
import { AccountPayable, Location } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CalendarDays, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function withinRange(dateStr, mode) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00'); d.setHours(0,0,0,0);
  const diff = Math.floor((d - today) / 86400000);
  if (mode === 'hoy') return diff === 0;
  if (mode === 'manana') return diff === 1;
  if (mode === 'semana') return diff >= 0 && diff <= 7;
  if (mode === 'mes') return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  if (mode === 'vencidos') return d < today;
  return true;
}

export default function PlannedPayments() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [payablesMap, setPayablesMap] = useState({});
  const [active, setActive] = useState('hoy');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [t, inst, payables] = await Promise.all([
        ExpenseTask.filter({ status: 'pending' }),
        PayableInstallment.filter({ status: 'pending' }),
        AccountPayable.list('-created_date', 500)
      ]);
      setTasks(t||[]);
      setInstallments(inst||[]);
      setPayablesMap(Object.fromEntries((payables||[]).map(p=>[p.id,p])));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const backfillInstallments = async () => {
    try {
      setSyncing(true);
      const payables = await AccountPayable.list('-created_date', 1000);
      const targets = (payables || []).filter(p => (p.status !== 'paid') && (((p.pending_amount ?? ((p.total_amount || 0) - (p.paid_amount || 0))) > 0)));

      for (const p of targets) {
        const existing = await PayableInstallment.filter({ payable_id: p.id });
        if (existing && existing.length > 0) continue;

        const total = (p.pending_amount ?? ((p.total_amount || 0) - (p.paid_amount || 0))) || 0;
        const n = 12;
        const windowDays = 45;

        const today = new Date(); today.setHours(0,0,0,0);
        const baseFromDue = p.due_date ? new Date(p.due_date + 'T00:00:00') : today;
        const start = baseFromDue < today ? today : baseFromDue;
        const step = n > 1 ? Math.floor(windowDays / (n - 1)) : 0;

        let allocated = 0;
        const baseAmount = Math.round((total / n) * 100) / 100;

        for (let i = 1; i <= n; i++) {
          let due = new Date(start);
          if (n === 1) {
            // keep start
          } else if (i === n) {
            due.setDate(start.getDate() + windowDays);
          } else {
            due.setDate(start.getDate() + step * (i - 1));
          }

          const amount = i === n ? Math.round((total - allocated) * 100) / 100 : baseAmount;
          allocated = Math.round((allocated + amount) * 100) / 100;

          await PayableInstallment.create({
            payable_id: p.id,
            sequence_number: i,
            due_date: due.toISOString().split('T')[0],
            amount,
            paid_amount: 0,
            status: 'pending',
            location_id: p.location_id,
            notes: 'Auto generado (12 cuotas / 45 días)'
          });
        }
      }

      await load();
      alert('Cuotas generadas para CxP pendientes (12/45).');
    } catch (e) {
      console.error(e);
      alert('Error generando cuotas');
    } finally {
      setSyncing(false);
    }
  };

  const items = useMemo(() => {
    const fixeds = tasks.map(t => {
      const [y,m] = String(t.month||'').split('-').map(Number);
      const day = t.due_day || 1;
      const date = new Date(y||new Date().getFullYear(), (m?m-1:new Date().getMonth()), day);
      const due = date.toISOString().split('T')[0];
      const amount = (t.amount ?? t.suggested_amount) || 0;
      return { kind: 'fijo', title: t.supplier || t.category, due_date: due, amount, status: t.status, id: t.id };
    });

    const quotas = installments.map(i => {
      const p = payablesMap[i.payable_id];
      const pending = Math.max(0,(i.amount||0)-(i.paid_amount||0));
      return { kind: 'cuota', title: p?.supplier_name || 'Proveedor', subtitle: p?.description, due_date: i.due_date, amount: pending, status: i.status, id: i.id };
    });

    return [...fixeds, ...quotas].sort((a,b)=> a.due_date.localeCompare(b.due_date));
  }, [tasks, installments, payablesMap]);

  const filtered = items.filter(it => withinRange(it.due_date, active));
  const total = filtered.reduce((s,i)=> s + (i.amount||0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Pagos Planificados</h1>
          <Button onClick={backfillInstallments} disabled={syncing} className="gap-2 text-xs sm:text-sm px-2 sm:px-4">
            {syncing && <Loader2 className="w-4 h-4 animate-spin" />}
            <span className="hidden sm:inline">Generar cuotas</span>
            <span className="sm:hidden">Generar</span>
          </Button>
        </div>

        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="manana">Mañana</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
            <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarDays className="w-5 h-5"/>
                  <span>Total {active}:</span>
                </div>
                <div className="text-2xl font-bold">${total.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <TabsContent value={active} className="mt-4">
            {loading ? (
              <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600"/></div>
            ) : filtered.length === 0 ? (
              <Alert>
                <AlertDescription>No hay pagos en este rango.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {filtered.map(it => (
                  <Card key={`${it.kind}-${it.id}`} className={active==='vencidos'? 'border-red-300': ''}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={it.kind==='fijo'? 'bg-indigo-500' : 'bg-amber-500'}>{it.kind==='fijo'? 'Fijo' : 'Cuota'}</Badge>
                          <span className="font-semibold truncate">{it.title}</span>
                        </div>
                        {it.subtitle && <p className="text-sm text-slate-600 mt-1 truncate">{it.subtitle}</p>}
                        <p className="text-xs text-slate-500 mt-1">Vence: {it.due_date}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">${(it.amount||0).toLocaleString()}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}