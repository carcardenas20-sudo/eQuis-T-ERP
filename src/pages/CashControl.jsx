import React, { useState, useEffect, useCallback, useRef } from "react";
import { CashControl, Expense, Location, Sale, Payment } from "@/entities/all";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]}, ${day} ${months[date.getMonth()]} ${year}`;
}

function formatShort(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const fmt = (value) => value.toFixed(value % 1 === 0 ? 0 : 1).replace(/\.0$/, '');
  if (abs >= 1_000_000_000) return sign + fmt(abs / 1_000_000_000) + 'B';
  if (abs >= 1_000_000) return sign + fmt(abs / 1_000_000) + 'M';
  if (abs >= 1_000) return sign + fmt(abs / 1_000) + 'k';
  return num.toLocaleString();
}

function toDateOnly(val) {
  if (!val) return null;
  return String(val).slice(0, 10);
}

export default function CashControlPage() {
  const [controls, setControls] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [filters, setFilters] = useState({ location: "all", dateRange: "week" });
  const [editingControl, setEditingControl] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const firstLoadRef = useRef(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [user, locs] = await Promise.all([
        User.me(),
        Location.filter({ is_active: true })
      ]);
      setCurrentUser(user);
      setLocations(locs);

      const today = new Date();
      let startDate = new Date(today);
      if (filters.dateRange === 'week') startDate.setDate(startDate.getDate() - 7);
      else if (filters.dateRange === 'month') startDate.setDate(startDate.getDate() - 30);

      const applyDateFilter = filters.dateRange !== 'all';
      const startStr = startDate.toISOString().slice(0, 10);

      let salesFilter = { status: 'completed' };
      let expensesFilter = {};
      if (filters.location !== "all") {
        salesFilter.location_id = filters.location;
        expensesFilter.location_id = filters.location;
      }
      if (applyDateFilter) {
        salesFilter.sale_date = { $gte: startStr };
        expensesFilter.expense_date = { $gte: startStr };
      }

      let paymentsFilter = { type: 'credit_payment' };
      if (filters.location !== "all") paymentsFilter.location_id = filters.location;
      if (applyDateFilter) paymentsFilter.payment_date = { $gte: startStr };

      const [sales, expenses, creditPayments] = await Promise.all([
        Sale.filter(salesFilter),
        Expense.filter(expensesFilter),
        Payment.filter(paymentsFilter),
      ]);

      const dataByKey = {};
      const ensureKey = (date, locationId) => {
        const key = `${date}_${locationId}`;
        if (!dataByKey[key]) {
          dataByKey[key] = { date, location_id: locationId, cash: 0, transfers: 0, card: 0, expenses: [] };
        }
        return key;
      };

      sales.forEach(sale => {
        const date = toDateOnly(sale.sale_date);
        if (!date) return;
        const locationId = sale.location_id || null;
        const key = ensureKey(date, locationId);
        const methods = Array.isArray(sale.payment_methods) ? sale.payment_methods : [];
        if (methods.length > 0) {
          methods.forEach(pm => {
            const amt = Number(pm.amount) || 0;
            if (pm.method === 'cash') dataByKey[key].cash += amt;
            else if (pm.method === 'transfer' || pm.method === 'qr') dataByKey[key].transfers += amt;
            else if (pm.method === 'card') dataByKey[key].card += amt;
          });
        } else {
          const amt = Number(sale.total_amount) || 0;
          if (amt > 0) dataByKey[key].cash += amt;
        }
      });

      // Abonos a créditos — se suman al control de efectivo por método de pago
      creditPayments.forEach(p => {
        const date = toDateOnly(p.payment_date);
        if (!date) return;
        const locationId = p.location_id || null;
        const key = ensureKey(date, locationId);
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;
        if (p.method === 'cash') dataByKey[key].cash += amt;
        else if (p.method === 'transfer' || p.method === 'qr') dataByKey[key].transfers += amt;
        else if (p.method === 'card') dataByKey[key].card += amt;
      });

      expenses.forEach(expense => {
        const date = toDateOnly(expense.expense_date);
        if (!date) return;
        const locationId = expense.location_id || null;
        const key = ensureKey(date, locationId);
        if (expense.payment_method === 'cash') {
          dataByKey[key].expenses.push(expense);
        }
      });

      const existingControls = await CashControl.list();
      const controlsArray = [];
      const updatePromises = [];

      for (const [, data] of Object.entries(dataByKey)) {
        const expensesTotal = data.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const hasActivity = data.cash > 0 || data.transfers > 0 || data.card > 0 || expensesTotal > 0;
        if (!hasActivity) continue;

        let control = existingControls.find(
          c => toDateOnly(c.control_date) === data.date && c.location_id === data.location_id
        );

        const newCash = data.cash;
        const newTransfer = data.transfers;
        const newCard = data.card;

        if (control) {
          if (control.cash_amount !== newCash || control.transfer_amount !== newTransfer || control.card_amount !== newCard) {
            updatePromises.push(
              CashControl.update(control.id, { cash_amount: newCash, transfer_amount: newTransfer, card_amount: newCard })
            );
          }
          control = { ...control, cash_amount: newCash, transfer_amount: newTransfer, card_amount: newCard };
        } else {
          control = await CashControl.create({
            location_id: data.location_id,
            control_date: data.date,
            cash_amount: newCash,
            transfer_amount: newTransfer,
            card_amount: newCard,
            cash_collected: false,
            transfers_verified: false
          });
        }
        controlsArray.push({ ...control, expenses: data.expenses });
      }

      if (updatePromises.length > 0) await Promise.all(updatePromises);

      // Siempre incluir controles no verificados aunque estén fuera del rango de fechas
      const controlsInArray = new Set(controlsArray.map(c => c.id));
      for (const control of existingControls) {
        if (controlsInArray.has(control.id)) continue;
        if (control.cash_collected && control.transfers_verified) continue;
        if (filters.location !== "all" && control.location_id !== filters.location) continue;
        controlsArray.push({ ...control, expenses: [] });
      }

      controlsArray.sort((a, b) => new Date(b.control_date) - new Date(a.control_date));
      setControls(controlsArray);

      // Auto-expand the most recent pending date on first load
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        const pending = controlsArray.filter(c => !c.cash_collected || !c.transfers_verified);
        if (pending.length > 0) {
          const mostRecent = pending.reduce((a, b) => a.control_date > b.control_date ? a : b);
          setExpandedDates({ [toDateOnly(mostRecent.control_date)]: true });
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setIsLoading(false);
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkCashCollected = async (control) => {
    await CashControl.update(control.id, {
      cash_collected: true,
      cash_collected_date: new Date().toISOString(),
      cash_collected_by: currentUser?.email
    });
    loadData();
  };

  const handleMarkTransfersVerified = async (control) => {
    await CashControl.update(control.id, {
      transfers_verified: true,
      transfers_verified_date: new Date().toISOString(),
      transfers_verified_by: currentUser?.email
    });
    loadData();
  };

  // Mark ALL pending controls for a specific date as collected+verified
  const handleMarkDayComplete = async (date) => {
    const dayControls = (byDate[date] || []).filter(c => !c.cash_collected || !c.transfers_verified);
    const now = new Date().toISOString();
    await Promise.all(dayControls.map(c =>
      CashControl.update(c.id, {
        cash_collected: true,
        cash_collected_date: now,
        cash_collected_by: currentUser?.email,
        transfers_verified: true,
        transfers_verified_date: now,
        transfers_verified_by: currentUser?.email
      })
    ));
    loadData();
  };

  // Bulk: mark all controls before current week as collected+verified
  const handleBulkMarkHistorical = async () => {
    setIsBulkLoading(true);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const cutoff = weekAgo.toISOString().slice(0, 10);
    const toMark = controls.filter(
      c => toDateOnly(c.control_date) < cutoff && (!c.cash_collected || !c.transfers_verified)
    );
    const now = new Date().toISOString();
    await Promise.all(toMark.map(c =>
      CashControl.update(c.id, {
        cash_collected: true,
        cash_collected_date: now,
        cash_collected_by: currentUser?.email,
        transfers_verified: true,
        transfers_verified_date: now,
        transfers_verified_by: currentUser?.email
      })
    ));
    setShowBulkConfirm(false);
    setIsBulkLoading(false);
    firstLoadRef.current = false;
    loadData();
  };

  const handleSaveNotes = async () => {
    if (!editingControl) return;
    await CashControl.update(editingControl.id, { notes: editingControl.notes });
    setShowNotesModal(false);
    setEditingControl(null);
    loadData();
  };

  const toggleDate = (key) => setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Group by date
  const byDate = {};
  controls.forEach(c => {
    const key = toDateOnly(c.control_date);
    if (!key) return;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(c);
  });

  const pending = Object.keys(byDate).filter(k =>
    byDate[k].some(c => !c.cash_collected || !c.transfers_verified)
  ).sort((a, b) => new Date(b) - new Date(a));

  const completed = Object.keys(byDate).filter(k =>
    byDate[k].every(c => c.cash_collected && c.transfers_verified)
  ).sort((a, b) => new Date(b) - new Date(a));

  const controlsForKPI = controls.filter(c => filters.location === 'all' || c.location_id === filters.location);
  const uncollectedTotal = controlsForKPI
    .filter(c => !c.cash_collected)
    .reduce((sum, c) => {
      const expensesTotal = (c.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const netCash = (Number(c.cash_amount) || 0) - expensesTotal;
      return sum + Math.max(netCash, 0);
    }, 0);

  const selectedLocationName = filters.location === 'all'
    ? 'Todas'
    : (locations.find(l => l.id === filters.location)?.name || 'Sucursal');

  // Count historical pending (older than 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const cutoff = weekAgo.toISOString().slice(0, 10);
  const historicalPendingCount = controls.filter(
    c => toDateOnly(c.control_date) < cutoff && (!c.cash_collected || !c.transfers_verified)
  ).length;

  const renderControl = (c) => {
    const loc = locations.find(l => l.id === c.location_id);
    const cashGross = Number(c.cash_amount) || 0;
    const cardAmt = Number(c.card_amount) || 0;
    const transferAmt = Number(c.transfer_amount) || 0;
    const expensesTotal = (c.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const netCash = cashGross - expensesTotal;
    const totalVentas = cashGross + cardAmt + transferAmt;
    const allDone = c.cash_collected && c.transfers_verified;

    return (
      <div key={c.id} className={`p-4 rounded-lg mb-3 border-2 ${allDone ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{loc?.name || '(sin sucursal)'}</h3>
          {allDone && <Badge className="bg-green-500 text-white">✓ Completado</Badge>}
        </div>

        {/* Summary */}
        <div className="mb-4 p-4 bg-white rounded-lg border border-slate-200">
          <h4 className="text-sm font-bold text-slate-700 mb-3">📊 Resumen del Día</h4>
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="text-slate-600 text-xs">💵 Efectivo (neto)</div>
              <div className={`font-extrabold tabular-nums text-right text-base ${netCash >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                ${formatShort(netCash)}
              </div>
            </div>
            <div className="p-2 rounded-lg border border-blue-200 bg-blue-50">
              <div className="text-slate-600 text-xs">💳 Tarjeta</div>
              <div className="font-extrabold text-blue-700 tabular-nums text-right text-base">${formatShort(cardAmt)}</div>
            </div>
            <div className="p-2 rounded-lg border border-purple-200 bg-purple-50">
              <div className="text-slate-600 text-xs">🏦 Transferencia</div>
              <div className="font-extrabold text-purple-700 tabular-nums text-right text-base">${formatShort(transferAmt)}</div>
            </div>
            <div className="p-2 rounded-lg border border-red-200 bg-red-50">
              <div className="text-slate-600 text-xs">💸 Gastos</div>
              <div className="font-extrabold text-red-600 tabular-nums text-right text-base">${formatShort(expensesTotal)}</div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="font-bold text-slate-700 text-sm">Total Ventas del Día:</span>
            <span className="text-lg font-extrabold text-slate-900 tabular-nums">${totalVentas.toLocaleString()}</span>
          </div>
        </div>

        {/* Expense detail */}
        {c.expenses && c.expenses.length > 0 && (
          <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <p className="font-semibold text-red-800 mb-2 text-sm">Detalle de Gastos:</p>
            {c.expenses.map((e, i) => (
              <div key={i} className="text-sm text-red-700">{e.description}: ${Number(e.amount)?.toLocaleString()}</div>
            ))}
          </div>
        )}

        {/* Action buttons — always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* CASH */}
          <div className={`p-3 rounded-lg border-2 ${c.cash_collected ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Efectivo</span>
              <span className={`font-bold text-sm ${netCash >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                ${netCash.toLocaleString()}
              </span>
            </div>
            {c.cash_collected ? (
              <div className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Recogido
                {c.cash_collected_by && <span className="text-green-600 ml-1">· {c.cash_collected_by.split('@')[0]}</span>}
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white text-xs"
                onClick={() => handleMarkCashCollected(c)}
              >
                ✓ Marcar Recogido
              </Button>
            )}
          </div>

          {/* TRANSFERS */}
          <div className={`p-3 rounded-lg border-2 ${c.transfers_verified ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Transferencias</span>
              <span className="font-bold text-blue-700 text-sm">${transferAmt.toLocaleString()}</span>
            </div>
            {c.transfers_verified ? (
              <div className="flex items-center gap-1 text-blue-700 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Verificado
                {c.transfers_verified_by && <span className="text-blue-600 ml-1">· {c.transfers_verified_by.split('@')[0]}</span>}
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={() => handleMarkTransfersVerified(c)}
              >
                ✓ Marcar Verificado
              </Button>
            )}
          </div>

          {/* CARD */}
          <div className="p-3 rounded-lg border-2 border-slate-200 bg-slate-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-600">Tarjeta</span>
              <span className="font-bold text-slate-700 text-sm">${cardAmt.toLocaleString()}</span>
            </div>
            <Badge variant="outline" className="text-xs text-slate-500">Informativo</Badge>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-slate-500"
          onClick={() => { setEditingControl(c); setShowNotesModal(true); }}
        >
          {c.notes ? '📝 Ver Notas' : '+ Agregar Notas'}
        </Button>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Control de Efectivo</h1>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <Select value={filters.location} onValueChange={(v) => setFilters(p => ({ ...p, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.dateRange} onValueChange={(v) => setFilters(p => ({ ...p, dateRange: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI */}
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm text-emerald-700 font-medium">Efectivo sin recoger</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 tabular-nums break-all">
                  ${uncollectedTotal.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-600 mt-1">Sucursal: {selectedLocationName}</div>
              </div>
              {historicalPendingCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs self-start sm:self-auto whitespace-nowrap"
                  onClick={() => setShowBulkConfirm(true)}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Saldar {historicalPendingCount} históricos
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Pendientes ({pending.length})
            </h2>
            {pending.map(date => {
              const isExpanded = expandedDates[date];
              const dayPending = (byDate[date] || []).filter(c => !c.cash_collected || !c.transfers_verified);
              return (
                <Card key={date} className="border-amber-200">
                  <CardHeader className="cursor-pointer p-3 sm:p-4" onClick={() => toggleDate(date)}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm sm:text-base">{formatDateDisplay(date)}</CardTitle>
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                          {dayPending.length} pendiente{dayPending.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 justify-between sm:justify-end">
                        {isExpanded && dayPending.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-green-400 text-green-700 hover:bg-green-50 h-7"
                            onClick={(e) => { e.stopPropagation(); handleMarkDayComplete(date); }}
                          >
                            ✓ Marcar todo el día
                          </Button>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="px-4 pb-4">
                      {byDate[date].map(c => renderControl(c))}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Completados ({completed.length})
            </h2>
            {completed.map(date => (
              <Card key={date} className="border-green-200 opacity-80">
                <CardHeader className="cursor-pointer p-4" onClick={() => toggleDate(date + '_done')}>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base text-slate-600">{formatDateDisplay(date)}</CardTitle>
                    {expandedDates[date + '_done'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </CardHeader>
                {expandedDates[date + '_done'] && (
                  <CardContent className="px-4 pb-4">
                    {byDate[date].map(c => renderControl(c))}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {pending.length === 0 && completed.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              No hay registros para el período seleccionado.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes modal */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notas</DialogTitle></DialogHeader>
          <Textarea
            value={editingControl?.notes || ''}
            onChange={(e) => setEditingControl(p => ({ ...p, notes: e.target.value }))}
            rows={6}
            placeholder="Agregar nota para este registro..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveNotes}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk mark historical modal */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saldar registros históricos</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              Esto marcará como <strong>recogido y verificado</strong> todos los {historicalPendingCount} registros
              de efectivo y transferencias anteriores a la última semana.
            </p>
            <p className="text-amber-700 bg-amber-50 p-3 rounded-lg">
              Úsalo solo si ya se recogió el efectivo de períodos anteriores y quieres limpiar el historial pendiente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>Cancelar</Button>
            <Button
              onClick={handleBulkMarkHistorical}
              disabled={isBulkLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isBulkLoading ? 'Procesando...' : `Saldar ${historicalPendingCount} registros`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
