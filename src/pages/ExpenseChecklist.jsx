import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { ListChecks, Plus, Copy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSession } from "../components/providers/SessionProvider";
import TemplateForm from "../components/checklist/TemplateForm";
import TaskRow from "../components/checklist/TaskRow";

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function toDateYYYYMMDD() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

export default function ExpenseChecklist() {
  const { toast } = useToast();
  const { currentUser, userRole } = useSession();
  const [month, setMonth] = useState(getCurrentMonth());
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [hasTemplates, setHasTemplates] = useState(true);
  const [creatingExpenseId, setCreatingExpenseId] = useState(null);

  useEffect(() => {
    async function loadInit() {
      const locs = await base44.entities.Location.filter({ is_active: true });
      setLocations(locs);
      const defaultLoc = currentUser?.location_id || locs[0]?.id || "";
      setLocationId(defaultLoc);
    }
    loadInit();
  }, [currentUser]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    return list.sort((a,b) => (a.due_day||0) - (b.due_day||0) || a.supplier.localeCompare(b.supplier));
  }, [tasks, statusFilter]);

  const loadTasks = async () => {
    if (!month || !locationId) return;
    setLoading(true);
    const query = { month, location_id: locationId };
    const data = await base44.entities.ExpenseTask.filter(query, '-updated_date');
    setTasks(data);
    // Verificar si hay plantillas activas para la sucursal seleccionada
    const tpls = await base44.entities.ExpenseTemplate.filter({ is_active: true, location_id: locationId }, '-created_date', 1);
    setHasTemplates(!!(tpls && tpls.length));
    setLoading(false);
  };

  useEffect(() => { loadTasks(); }, [month, locationId]);

  const openNewTemplate = () => setShowTemplateModal(true);
  const saveTemplate = async (payload) => {
    await base44.entities.ExpenseTemplate.create(payload);
    setShowTemplateModal(false);
  };

  const getLastAmountForSupplier = async (supplier) => {
    const res = await base44.entities.Expense.filter({ supplier, location_id: locationId }, '-expense_date', 1);
    return res?.[0]?.amount ?? undefined;
  };

  const generateFromTemplates = async () => {
    const templates = await base44.entities.ExpenseTemplate.filter({ is_active: true, location_id: locationId });
    if (!templates || templates.length === 0) {
      setShowTemplateModal(true);
      return;
    }
    for (const tpl of templates) {
      const exists = await base44.entities.ExpenseTask.filter({ month, location_id: locationId, template_id: tpl.id }, '-created_date', 1);
      if (exists && exists.length) continue;
      const lastAmount = await getLastAmountForSupplier(tpl.supplier);
      const suggested = lastAmount ?? tpl.default_amount;
      await base44.entities.ExpenseTask.create({
        month,
        due_day: tpl.day_suggested,
        supplier: tpl.supplier,
        category: tpl.category,
        suggested_amount: suggested,
        amount: suggested,
        payment_method: tpl.payment_method,
        status: 'pending',
        location_id: locationId,
        template_id: tpl.id,
        created_from: 'template',
        notes: tpl.notes || ''
      });
    }
    await loadTasks();
  };

  const cloneRestFromPrev = async () => {
    const [year, mm] = month.split('-').map(n => Number(n));
    const prev = mm === 1 ? `${year-1}-12` : `${year}-${String(mm-1).padStart(2,'0')}`;
    const prevTasks = await base44.entities.ExpenseTask.filter({ month: prev, location_id: locationId });
    for (const t of prevTasks) {
      const exists = await base44.entities.ExpenseTask.filter({ month, location_id: locationId, supplier: t.supplier, category: t.category, due_day: t.due_day }, '-created_date', 1);
      if (exists && exists.length) continue;
      await base44.entities.ExpenseTask.create({
        month,
        due_day: t.due_day,
        supplier: t.supplier,
        category: t.category,
        suggested_amount: t.amount ?? t.suggested_amount,
        amount: t.amount ?? t.suggested_amount,
        payment_method: t.payment_method,
        status: 'pending',
        location_id: locationId,
        template_id: t.template_id,
        created_from: 'cloned',
        notes: t.notes || ''
      });
    }
    await loadTasks();
  };

  const handleTogglePaid = async (task, nextPaid, amount) => {
    const updates = nextPaid
      ? { status: 'paid', paid_at: new Date().toISOString(), amount }
      : { status: 'pending', paid_at: null };
    await base44.entities.ExpenseTask.update(task.id, updates);
    await loadTasks();
  };

  const handleChangeAmount = async (task, nextAmount) => {
    await base44.entities.ExpenseTask.update(task.id, { amount: nextAmount });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, amount: nextAmount } : t));
  };

  const handleCreateExpense = async (task, amount) => {
    if (creatingExpenseId === task.id) return; // evitar doble click
    setCreatingExpenseId(task.id);

    const today = toDateYYYYMMDD();
    const amountNum = Number(amount || task.amount || task.suggested_amount || 0);

    // Evitar duplicados del mismo proveedor, monto, fecha y sucursal
    const existing = await base44.entities.Expense.filter({
      supplier: task.supplier,
      amount: amountNum,
      expense_date: today,
      location_id: task.location_id
    }, '-created_date', 1);

    if (existing && existing.length) {
      toast({ title: 'Gasto ya registrado', description: 'Ya existe un gasto igual hoy para este proveedor.' });
      setCreatingExpenseId(null);
      return;
    }

    const expensePayload = {
      description: `${task.supplier} (${task.month})`,
      amount: amountNum,
      category: task.category,
      expense_date: today,
      location_id: task.location_id,
      payment_method: task.payment_method || 'transfer',
      supplier: task.supplier,
      receipt_number: '',
      is_recurring: false,
      notes: task.notes || ''
    };

    await base44.entities.Expense.create(expensePayload);
    // Marcar tarea como pagada automáticamente
    await base44.entities.ExpenseTask.update(task.id, { status: 'paid', paid_at: new Date().toISOString(), amount: amountNum });
    await loadTasks();

    toast({ title: 'Gasto creado', description: 'El gasto se registró correctamente.' });
    setCreatingExpenseId(null);
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><ListChecks className="w-5 h-5" /> Checklist de Gastos</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={generateFromTemplates} className="gap-1"><Plus className="w-4 h-4" /> Generar desde plantillas</Button>
          <Button variant="outline" onClick={cloneRestFromPrev} className="gap-1"><Copy className="w-4 h-4" /> Clonar resto</Button>
          <Button onClick={openNewTemplate} className="gap-1"><Plus className="w-4 h-4" /> Nueva plantilla</Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Mes</div>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Sucursal</div>
            <MobileSelect value={locationId} onValueChange={setLocationId} options={locations.map(l => ({ value: l.id, label: l.name }))} placeholder="Sucursal" />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Estado</div>
            <MobileSelect value={statusFilter} onValueChange={setStatusFilter} options={[{value:'all',label:'Todos'},{value:'pending',label:'Pendientes'},{value:'paid',label:'Pagados'}]} placeholder="Estado" />
          </div>
        </CardContent>
      </Card>

      {!hasTemplates && (
        <div className="mb-4">
          <Alert>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              No hay plantillas activas para esta sucursal. Crea al menos una para generar tareas.
              <Button size="sm" onClick={openNewTemplate}>Nueva plantilla</Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Cargando…</div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <Card><CardHeader><CardTitle className="text-base">No hay tareas para este mes</CardTitle></CardHeader></Card>
          ) : (
            filteredTasks.map(t => (
              <TaskRow key={t.id} task={t} creatingExpenseId={creatingExpenseId} onTogglePaid={handleTogglePaid} onChangeAmount={handleChangeAmount} onCreateExpense={handleCreateExpense} />
            ))
          )}
        </div>
      )}

      <TemplateForm open={showTemplateModal} onClose={() => setShowTemplateModal(false)} onSave={saveTemplate} locations={locations} />
    </div>
  );
}