import React, { useState, useEffect } from 'react';
import { Credit, Payment, BankAccount } from "@/entities/all";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, CreditCard, Smartphone, Landmark, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentSaleDateTime } from "../utils/dateUtils";

const paymentMethods = [
  { id: 'cash', name: 'Efectivo', icon: DollarSign },
  { id: 'card', name: 'Tarjeta', icon: CreditCard },
  { id: 'transfer', name: 'Transferencia', icon: Smartphone },
  { id: 'qr', name: 'QR', icon: Landmark }
];

export default function PaymentModal({ credit, onSave, onCancel }) {
  const [paymentAmount, setPaymentAmount] = useState(credit.pending_amount);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  useEffect(() => {
    const loadBankAccounts = async () => {
      const accounts = await BankAccount.filter({ is_active: true });
      setBankAccounts(accounts);
      if (accounts.length > 0) {
        setBankAccountId(accounts[0].id);
      }
    };
    loadBankAccounts();
  }, []);

  const handleSave = async () => {
    const p = Number(paymentAmount) || 0;
    const d = Number(discountAmount) || 0;

    if (p < 0 || d < 0) {
      alert("Montos inválidos: no pueden ser negativos.");
      return;
    }
    if (p === 0 && d === 0) {
      alert("Debes registrar un pago o un descuento.");
      return;
    }
    if (p + d > credit.pending_amount) {
      alert("La suma de pago + descuento no puede exceder el saldo pendiente.");
      return;
    }
    if (paymentMethod === 'transfer' && p > 0 && !bankAccountId) {
      alert("Por favor, selecciona una cuenta bancaria para la transferencia.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Crear el registro de pago (ESTE ES EL PAGO QUE SE REFLEJARÁ EN CAJA)
      await Payment.create({
        credit_id: credit.id,
        sale_id: credit.sale_id,
        payment_date: getCurrentSaleDateTime(),
        amount: Number(paymentAmount) || 0,
        method: (Number(paymentAmount) || 0) > 0 ? paymentMethod : 'other', // Si solo hay descuento, no cuenta como ingreso
        reference: reference,
        bank_account_id: (paymentMethod === 'transfer' && (Number(paymentAmount) || 0) > 0) ? bankAccountId : null,
        type: "credit_payment",
        location_id: credit.location_id || "main",
        discount_amount: Number(discountAmount) || 0,
        discount_reason: discountReason || undefined
      });

      // 2. Actualizar el crédito
      const p = Number(paymentAmount) || 0;
      const d = Number(discountAmount) || 0;
      const newPendingAmount = credit.pending_amount - p - d;
      const newPaidAmount = (credit.paid_amount || 0) + p;
      
      let newStatus = credit.status;
      if (newPendingAmount <= 0) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      await Credit.update(credit.id, {
        paid_amount: newPaidAmount,
        pending_amount: newPendingAmount,
        status: newStatus,
        notes: (notes || d > 0)
          ? `${credit.notes || ""}\n--- ABONO ${new Date().toLocaleDateString()} ---\n${[notes, d > 0 ? `Descuento aplicado: $${d}${discountReason ? ' - ' + discountReason : ''}` : ""].filter(Boolean).join("\n")}`
          : credit.notes
      });

      onSave();
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Error al registrar el pago. Inténtalo de nuevo.");
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Registrar Abono - {credit.customer_name}
          </DialogTitle>
          <p className="text-sm text-slate-600">
            Este pago se reflejará en el efectivo/caja según el método seleccionado
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto a Pagar *</Label>
              <Input
                type="number"
                min="0"
                max={credit.pending_amount}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="text-lg font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(method => (
                    <SelectItem key={method.id} value={method.id}>
                      <div className="flex items-center gap-2">
                        <method.icon className="w-4 h-4" />
                        {method.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Descuento en este abono (opcional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-slate-500">El descuento reduce el saldo; no entra a caja.</p>
              </div>
              <div className="space-y-1">
                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Motivo del descuento"
                />
              </div>
            </div>
          </div>

          {paymentMethod === 'transfer' && (
            <div className="space-y-2">
              <Label>Cuenta de Destino</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
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

          <div className="space-y-2">
            <Label>Referencia (Opcional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: # de confirmación, # de cheque"
            />
          </div>

          <div className="space-y-2">
            <Label>Notas del Pago (Opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales del abono..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (!(Number(paymentAmount) || 0) && !(Number(discountAmount) || 0))}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
            {isSaving ? "Guardando..." : `Registrar Abono`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}