import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HandCoins, Save, X } from "lucide-react";
import { ADVANCE_TYPE, money } from "@/utils/advances";

const todayBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// Formulario para dar un anticipo / préstamo a un empleado. Se paga por transferencia:
// queda "pendiente de transferir" en Transferencias bancarias.
export default function AdvanceForm({ employees, employee: preselected, onSubmit, onCancel, saving }) {
  const [employeeId, setEmployeeId] = useState(preselected?.employee_id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayBogota());
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState("unico");
  const [installment, setInstallment] = useState("");

  const amt = Math.round(Number(amount) || 0);
  const inst = Math.round(Number(installment) || 0);
  const nPayments = mode === "cuotas" && inst > 0 ? Math.ceil(amt / inst) : 1;
  const employee = employees.find((e) => e.employee_id === employeeId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employee) { alert("Elige el empleado."); return; }
    if (amt <= 0) { alert("Escribe el valor del anticipo."); return; }
    if (mode === "cuotas" && (inst <= 0 || inst > amt)) {
      alert("La cuota debe ser mayor que 0 y no mayor que el anticipo.");
      return;
    }
    onSubmit({
      employee_id: employee.employee_id,
      employee_name: employee.name,
      amount: amt,
      payment_date: date,
      payment_type: ADVANCE_TYPE,
      status: "registrado", // pendiente de transferir
      advance_reason: reason.trim(),
      advance_mode: mode,
      advance_installment: mode === "cuotas" ? inst : null,
      description: `Anticipo${reason.trim() ? ` — ${reason.trim()}` : ""}`,
    });
  };

  return (
    <Card className="mb-6 border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-amber-600" />
          Nuevo anticipo / préstamo
        </CardTitle>
        <p className="text-sm text-slate-500">
          Se transfiere ahora y se descuenta de los próximos pagos del empleado.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Empleado *</Label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={!!preselected}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Selecciona…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.employee_id}>{e.name} ({e.employee_id})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor del anticipo *</Label>
              <Input type="number" min="1" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="200000" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: calamidad, arriendo…" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>¿Cómo se descuenta?</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className={`p-3 rounded-lg border-2 cursor-pointer ${mode === "unico" ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
                <input type="radio" name="mode" className="mr-2" checked={mode === "unico"} onChange={() => setMode("unico")} />
                <span className="font-medium text-sm">Todo en el próximo pago</span>
                <p className="text-xs text-slate-500 mt-1 ml-5">Si el pago no alcanza, lo que falte pasa al siguiente.</p>
              </label>
              <label className={`p-3 rounded-lg border-2 cursor-pointer ${mode === "cuotas" ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
                <input type="radio" name="mode" className="mr-2" checked={mode === "cuotas"} onChange={() => setMode("cuotas")} />
                <span className="font-medium text-sm">En cuotas</span>
                <p className="text-xs text-slate-500 mt-1 ml-5">Un valor fijo en cada pago hasta completar.</p>
              </label>
            </div>
            {mode === "cuotas" && (
              <div className="space-y-1.5 sm:w-1/2">
                <Label>Valor de cada cuota *</Label>
                <Input type="number" min="1" step="1000" value={installment} onChange={(e) => setInstallment(e.target.value)} placeholder="50000" />
              </div>
            )}
          </div>

          {amt > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <p>
                <b>{employee?.name || "El empleado"}</b> recibe <b>{money(amt)}</b> por transferencia.
              </p>
              <p className="mt-1">
                {mode === "cuotas" && inst > 0
                  ? <>Se descontarán <b>{money(inst)}</b> por pago, en <b>{nPayments} pago{nPayments > 1 ? "s" : ""}</b>.</>
                  : <>Se descontará <b>{money(amt)}</b> de su próximo pago.</>}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Guardando…" : "Registrar anticipo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
