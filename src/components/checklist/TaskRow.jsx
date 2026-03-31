import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Receipt, Loader2 } from "lucide-react";

const categoryLabels = {
  servicios_publicos: "Servicios Públicos",
  alquiler: "Alquiler",
  suministros: "Suministros",
  marketing: "Marketing",
  transporte: "Transporte",
  alimentacion: "Alimentación",
  mantenimiento: "Mantenimiento",
  salarios: "Salarios",
  impuestos: "Impuestos",
  seguros: "Seguros",
  telecomunicaciones: "Telecomunicaciones",
  otros: "Otros"
};

export default function TaskRow({ task, onTogglePaid, onChangeAmount, onCreateExpense, creatingExpenseId }) {
  const isPaid = task.status === 'paid';
  const amount = task.amount ?? task.suggested_amount ?? 0;
  const isCreating = creatingExpenseId === task.id;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 border rounded-lg bg-white">
      <div className="flex items-center gap-2 w-10 justify-center">
        <Checkbox checked={isPaid} onCheckedChange={() => onTogglePaid(task, !isPaid, amount)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{task.supplier}</span>
          <Badge variant="secondary">{categoryLabels[task.category] || task.category}</Badge>
          <div className="flex items-center text-xs text-slate-500 gap-1">
            <Calendar className="w-3 h-3" />
            <span>{task.month}-{String(task.due_day).padStart(2,'0')}</span>
          </div>
          {isPaid && task.paid_at && (
            <div className="flex items-center text-xs text-green-600 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Pagado: {new Date(task.paid_at).toLocaleString()}</span>
            </div>
          )}
        </div>
        {task.notes && (
          <div className="text-xs text-slate-500 truncate">{task.notes}</div>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-48">
        <Input type="number" value={amount ?? ''} onChange={e => onChangeAmount(task, Number(e.target.value || 0))} />
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
        <Button size="sm" variant="outline" disabled={isCreating} onClick={() => onCreateExpense(task, amount)} className="gap-1">
          {isCreating ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>) : (<><Receipt className="w-4 h-4" /> Crear Gasto</>)}
        </Button>
      </div>
    </div>
  );
}