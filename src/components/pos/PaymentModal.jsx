import React, { useState, useEffect } from 'react';
import { BankAccount } from "@/entities/BankAccount";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard,
  DollarSign,
  Smartphone,
  QrCode,
  Plus,
  X,
  Check,
  Landmark,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";


const paymentMethods = [
  { id: 'cash', name: 'Efectivo', icon: DollarSign, color: 'bg-green-500' },
  { id: 'card', name: 'Tarjeta', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'transfer', name: 'Transferencia', icon: Smartphone, color: 'bg-purple-500' },
  { id: 'qr', name: 'QR', icon: QrCode, color: 'bg-orange-500' },
  { id: 'credit', name: 'Crédito', icon: Landmark, color: 'bg-sky-500' },
];

export default function PaymentModal({ total, onConfirm, onCancel, isProcessing, customer }) {
  const [payments, setPayments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditError, setCreditError] = useState("");
  const [currentPayment, setCurrentPayment] = useState({
    method: 'cash',
    amount: total,
    reference: '',
    bank_account: ''
  });

  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        const accounts = await BankAccount.filter({ is_active: true });
        setBankAccounts(accounts || []);
      } catch (error) {
        console.error("Error loading bank accounts:", error);
        setBankAccounts([]);
      }
    };
    loadBankAccounts();
  }, []);

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getRemainingAmount = () => {
    return total - getTotalPaid();
  };

  useEffect(() => {
    setCurrentPayment(prev => ({
      ...prev,
      amount: total > 0 ? Math.max(0, total - getTotalPaid()) : 0
    }));
  }, [total, payments]);

  const addPayment = () => {
    const remaining = getRemainingAmount();
    if (remaining <= 0) return;
    const amt = Math.max(0, Number(currentPayment.amount) || 0);
    if (amt > 0) {
      const payAmount = Math.min(amt, remaining);
      setPayments(prev => [...prev, { ...currentPayment, amount: payAmount, id: Date.now() }]);
      setCurrentPayment({
        method: 'cash',
        amount: Math.max(0, remaining - payAmount),
        reference: '',
        bank_account: ''
      });
      setCreditError("");
    }
  };

  const removePayment = (id) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    setCreditError("");
  };

  const handleConfirm = () => {
    setCreditError("");
    const totalPaid = getTotalPaid();
    if (totalPaid >= total) {
      const hasCredit = payments.some(p => p.method === 'credit');
      if (hasCredit && (!customer || !customer.name || !customer.phone)) {
        setCreditError("Para confirmar la venta a crédito debe tener información completa del cliente (nombre y teléfono).");
        return;
      }
      
      onConfirm(payments);
    }
  };

  const getMethodInfo = (methodId) => {
    return paymentMethods.find(m => m.id === methodId);
  };

  const handleSpecialPayment = (method) => {
    setCreditError("");
    
    if (method === 'credit') {
      if (!customer || !customer.name || !customer.phone) {
        setCreditError("Para facturar a crédito debe ingresar la información completa del cliente (nombre y teléfono).");
        return;
      }
    }
    
    const remaining = getRemainingAmount();
    if (remaining > 0) {
      setPayments(prev => [
        ...prev,
        { 
          id: Date.now(), 
          method, 
          amount: remaining, 
          reference: `Crédito - ${customer?.name || 'Cliente sin nombre'}`,
          bank_account: ''
        }
      ]);
      setCurrentPayment(prev => ({ 
        ...prev, 
        amount: 0, 
        method: 'cash', 
        reference: '', 
        bank_account: '' 
      }));
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Procesar Pago - ${total?.toLocaleString()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pb-24">
          {creditError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{creditError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
            <div className="p-2 sm:p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-600 font-medium">Total</p>
              <p className="text-base sm:text-lg font-bold text-blue-900">${total?.toLocaleString()}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-50 rounded-md">
              <p className="text-xs text-green-600 font-medium">Pagado</p>
              <p className="text-base sm:text-lg font-bold text-green-900">${getTotalPaid()?.toLocaleString()}</p>
            </div>
            <div className="p-2 sm:p-3 bg-orange-50 rounded-md">
              <p className="text-xs text-orange-600 font-medium">Pendiente</p>
              <p className="text-base sm:text-lg font-bold text-orange-900">${getRemainingAmount()?.toLocaleString()}</p>
            </div>
            {currentPayment.method === 'cash' && (() => {
              const amt = Number(currentPayment.amount) || 0;
              const remaining = getRemainingAmount();
              const diff = amt - remaining;
              const isChange = diff >= 0;
              const label = isChange ? 'Cambio' : 'Falta';
              const value = Math.abs(diff);
              return (
                <div className="p-2 sm:p-3 bg-emerald-50 rounded-md">
                  <p className="text-xs text-emerald-600 font-medium">{label}</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-900">
                    ${value.toLocaleString()}
                  </p>
                </div>
              );
            })()}
          </div>

          {payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Pagos Registrados:</h3>
              {payments.map((payment) => {
                const methodInfo = getMethodInfo(payment.method);
                if (!methodInfo) return null;
                return (
                  <div key={payment.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className={`${methodInfo.color} p-2 rounded-lg text-white`}>
                        <methodInfo.icon className="w-4 h-4 select-none" />
                      </div>
                      <div>
                        <p className="font-medium">{methodInfo.name}</p>
                        {payment.reference && (
                          <p className="text-sm text-gray-500">Ref: {payment.reference}</p>
                        )}
                        {payment.bank_account && payment.method === 'transfer' && (
                          <p className="text-sm text-gray-500">Cuenta: {payment.bank_account}</p>
                        )}
                        {payment.method === 'credit' && customer?.name && (
                          <p className="text-sm text-blue-600">Cliente: {customer.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-semibold">
                        ${payment.amount.toLocaleString()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePayment(payment.id)}
                        className="text-red-500 hover:text-red-700 select-none"
                      >
                        <X className="w-4 h-4 select-none" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {getRemainingAmount() > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Agregar Pago:</h3>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {paymentMethods.map((method) => (
                      <Button
                        key={method.id}
                        variant={currentPayment.method === method.id ? 'default' : 'outline'}
                        onClick={() => {
                          if (method.id === 'credit') {
                            handleSpecialPayment(method.id);
                          } else {
                            setCurrentPayment(prev => ({ ...prev, method: method.id, bank_account: '' }));
                            setCreditError("");
                          }
                        }}
                        className="flex flex-col items-center gap-2 h-auto py-3"
                      >
                        <method.icon className="w-5 h-5 select-none" />
                        <span className="text-xs select-none">{method.name}</span>
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        min="0"
                        value={currentPayment.amount === '' ? '' : currentPayment.amount}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setCurrentPayment(prev => ({
                            ...prev,
                            amount: raw === '' ? '' : Math.max(0, parseFloat(raw) || 0)
                          }));
                        }}
                        placeholder="0.00"
                        disabled={currentPayment.method === 'credit'}
                      />
                      {currentPayment.method === 'cash' && (() => {
                        const amt = Number(currentPayment.amount) || 0;
                        const remaining = getRemainingAmount();
                        const diff = amt - remaining;
                        const label = diff >= 0 ? 'Cambio' : 'Falta';
                        const value = Math.abs(diff);
                        return (
                          <p className="text-xs text-emerald-700">
                            {label}: ${value.toLocaleString()}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label>Referencia (Opcional)</Label>
                      <Input
                        value={currentPayment.reference}
                        onChange={(e) => setCurrentPayment(prev => ({ ...prev, reference: e.target.value }))}
                        placeholder="Número de transacción"
                      />
                    </div>
                  </div>

                  {currentPayment.method === 'transfer' && (
                    <div className="space-y-2">
                      <Label>Cuenta Bancaria (Opcional)</Label>
                      <Select
                        value={currentPayment.bank_account}
                        onValueChange={(value) => setCurrentPayment(prev => ({ ...prev, bank_account: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="-- Sin especificar --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>-- Sin especificar --</SelectItem>
                          {bankAccounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} - {account.account_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={addPayment}
                    className="w-full select-none"
                    disabled={currentPayment.amount === '' || Number(currentPayment.amount) <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2 select-none" />
                    Agregar Pago
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="p-0">
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="w-1/3 sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={getRemainingAmount() > 0 || isProcessing || !!creditError}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  "Procesando..."
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2 select-none" />
                    Confirmar Venta
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}