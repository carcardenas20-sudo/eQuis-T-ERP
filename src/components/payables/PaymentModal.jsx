import React, { useState, useEffect } from "react";
import { BankAccount } from "@/entities/BankAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CreditCard, Building2, CheckCircle2, AlertCircle, PackageOpen } from "lucide-react";

export default function PaymentModal({ payable, locations, userLocation, onConfirm, onCancel }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [locationId, setLocationId] = useState(userLocation?.id || "");
  const [notes, setNotes] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    loadBankAccounts();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const accounts = await BankAccount.filter({ is_active: true });
      setBankAccounts(accounts || []);
    } catch (error) {
      console.error("Error loading bank accounts:", error);
    }
  };

  const isOutsideCash = method === "fuera_de_caja";

  const handleSubmit = () => {
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      alert("Ingresa un monto válido");
      return;
    }

    if (paymentAmount > payable.pending_amount) {
      alert("El monto excede el saldo pendiente");
      return;
    }

    if (!isOutsideCash && !locationId) {
      alert("Selecciona una sucursal");
      return;
    }

    if (method === "transfer" && !bankAccountId) {
      alert("Selecciona una cuenta bancaria para transferencias");
      return;
    }

    onConfirm({
      amount: paymentAmount,
      method,
      reference,
      bank_account_id: bankAccountId || null,
      location_id: isOutsideCash ? null : locationId,
      notes,
      skip_cash_control: isOutsideCash,
    });
  };

  const paymentMethods = [
    { value: "cash", label: "Efectivo", icon: DollarSign },
    { value: "transfer", label: "Transferencia", icon: Building2 },
    { value: "card", label: "Tarjeta", icon: CreditCard },
    { value: "check", label: "Cheque", icon: CheckCircle2 },
    { value: "fuera_de_caja", label: "Fuera de caja", icon: PackageOpen },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Registrar Pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info de la cuenta */}
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Proveedor:</span>
              <span className="font-semibold">{payable.supplier_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Descripción:</span>
              <span className="font-semibold">{payable.description}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total:</span>
              <span className="font-semibold">${payable.total_amount?.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Pagado:</span>
              <span className="font-semibold text-green-600">${payable.paid_amount?.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm text-slate-600">Saldo Pendiente:</span>
              <span className="font-bold text-red-600 text-lg">${payable.pending_amount?.toLocaleString()}</span>
            </div>
          </div>

          {/* Monto del pago */}
          <div className="space-y-2">
            <Label>Monto a Pagar *</Label>
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={payable.pending_amount}
            />
          </div>

          {/* Método de pago */}
          <div className="space-y-2">
            <Label>Método de Pago *</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(pm => {
                const Icon = pm.icon;
                return (
                  <Button
                    key={pm.value}
                    type="button"
                    variant={method === pm.value ? "default" : "outline"}
                    onClick={() => setMethod(pm.value)}
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {pm.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Info según método */}
          {method === "cash" && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Se crea un <strong>Gasto</strong> que descuenta del control de efectivo de la sucursal seleccionada.
              </p>
            </div>
          )}
          {isOutsideCash && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2">
              <PackageOpen className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                El pago se registra en CxP pero <strong>no afecta caja ni cuentas bancarias</strong>. Útil mientras el sistema se integra completamente.
              </p>
            </div>
          )}

          {/* Cuenta bancaria (si es transferencia) */}
          {method === "transfer" && (
            <div className="space-y-2">
              <Label>Cuenta Bancaria *</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {account.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Referencia */}
          <div className="space-y-2">
            <Label>Referencia / Número</Label>
            <Input
              placeholder="Ej: TRANS-12345"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* Sucursal — oculta en Fuera de caja */}
          {!isOutsideCash && (
            <div className="space-y-2">
              <Label>Sucursal *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas sobre el pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              Registrar Pago
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}