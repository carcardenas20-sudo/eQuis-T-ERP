import React, { useState, useEffect } from 'react';
import { BankAccount } from "@/entities/BankAccount";
import { Customer } from "@/entities/Customer";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  DollarSign,
  Smartphone,
  QrCode,
  Plus,
  X,
  Check,
  Landmark,
  Gift,
  AlertTriangle,
  Edit,
  Calendar,
  Loader2,
  RefreshCw
} from "lucide-react";

const paymentMethods = [
  { id: 'cash', name: 'Efectivo', icon: DollarSign, color: 'bg-green-500' },
  { id: 'card', name: 'Tarjeta', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'transfer', name: 'Transferencia', icon: Smartphone, color: 'bg-purple-500' },
  { id: 'qr', name: 'QR', icon: QrCode, color: 'bg-orange-500' },
  { id: 'credit', name: 'Crédito', icon: Landmark, color: 'bg-sky-500' },
  { id: 'courtesy', name: 'Cortesía', icon: Gift, color: 'bg-pink-500' }
];

export default function EditSaleModal({ sale, onSave, onCancel, isProcessing }) {
  const [editedSale, setEditedSale] = useState({
    sale_date: '',
    payment_methods: [],
    customer_name: '',
    customer_phone: '',
    customer_document: '',
    notes: ''
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [errors, setErrors] = useState([]);
  const [currentPayment, setCurrentPayment] = useState({
    method: 'cash',
    amount: 0,
    reference: '',
    bank_account: ''
  });

  useEffect(() => {
    if (sale) {
      // ✅ SIMPLIFICADO: Formato de fecha básico
      const saleDate = sale.sale_date ? sale.sale_date.split('T')[0] : new Date().toISOString().split('T')[0];
      
      setEditedSale({
        sale_date: saleDate,
        payment_methods: sale.payment_methods || [],
        customer_name: sale.customer_name || '',
        customer_phone: sale.customer_phone || '',
        customer_document: sale.customer_document || '',
        notes: sale.notes || ''
      });
      
      loadSupportData();
    }
  }, [sale]);

  const loadSupportData = async () => {
    try {
      const [accounts, customersList] = await Promise.all([
        BankAccount.filter({ is_active: true }),
        Customer.list()
      ]);
      setBankAccounts(accounts);
      setCustomers(customersList);
    } catch (error) {
      console.error("Error loading support data:", error);
    }
  };

  const getTotalPaid = () => {
    return editedSale.payment_methods.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const addPayment = () => {
    if (currentPayment.amount > 0) {
      setEditedSale(prev => ({
        ...prev,
        payment_methods: [...prev.payment_methods, { 
          ...currentPayment, 
          id: Date.now() 
        }]
      }));
      setCurrentPayment({
        method: 'cash',
        amount: 0,
        reference: '',
        bank_account: ''
      });
    }
  };

  const removePayment = (id) => {
    setEditedSale(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.filter(p => p.id !== id)
    }));
  };

  const clearAllPayments = () => {
    if (window.confirm("¿Estás seguro de que quieres eliminar todos los métodos de pago?")) {
      setEditedSale(prev => ({
        ...prev,
        payment_methods: []
      }));
      setCurrentPayment({
        method: 'cash',
        amount: sale.total_amount,
        reference: '',
        bank_account: ''
      });
    }
  };

  const handleCustomerSelect = (e) => {
    const customerId = e.target.value;
    if (!customerId) return;
    
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setEditedSale(prev => ({
        ...prev,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_document: customer.document || ''
      }));
    }
  };

  const validateChanges = () => {
    const newErrors = [];
    
    const totalPaid = getTotalPaid();
    const difference = Math.abs(totalPaid - sale.total_amount);
    
    if (difference > 0.01) {
      newErrors.push(`El total de pagos ($${totalPaid.toLocaleString()}) debe igualar el total de la factura ($${sale.total_amount.toLocaleString()})`);
    }

    const hasCredit = editedSale.payment_methods.some(p => p.method === 'credit');
    if (hasCredit && (!editedSale.customer_name?.trim() || !editedSale.customer_phone?.trim())) {
      newErrors.push("Las ventas a crédito requieren nombre completo y teléfono del cliente");
    }

    const selectedDate = new Date(editedSale.sale_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
      newErrors.push("La fecha de venta no puede estar en el futuro");
    }

    const invalidAmounts = editedSale.payment_methods.filter(p => p.amount <= 0);
    if (invalidAmounts.length > 0) {
      newErrors.push("Todos los pagos deben tener un monto mayor a cero");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (validateChanges()) {
      onSave({
        ...editedSale,
        sale_date: new Date(editedSale.sale_date + 'T12:00:00').toISOString()
      });
    }
  };

  const getMethodInfo = (methodId) => {
    return paymentMethods.find(m => m.id === methodId);
  };

  const getRemainingAmount = () => {
    return sale.total_amount - getTotalPaid();
  };

  if (!sale) return null;

  const isSaleCancelled = sale.status === 'cancelled';
  const remainingAmount = getRemainingAmount();

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Edit className="w-6 h-6 text-blue-600" />
            Editar Venta #{sale.invoice_number || sale.id.slice(-8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Importante:</strong> Solo se pueden editar la fecha, métodos de pago e información del cliente.
            </AlertDescription>
          </Alert>

          {isSaleCancelled && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta venta ha sido anulada y no puede ser editada.
              </AlertDescription>
            </Alert>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Sale Summary */}
          <Card className="bg-slate-50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-slate-600">Total Factura</p>
                  <p className="text-lg font-bold text-slate-900">${sale.total_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Estado</p>
                  <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                    {sale.status === 'completed' ? 'Completada' : sale.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Asignado</p>
                  <p className={`text-lg font-bold ${remainingAmount === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    ${getTotalPaid().toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Restante</p>
                  <p className={`text-lg font-bold ${remainingAmount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${remainingAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información Básica</h3>
              
              <div className="space-y-2">
                <Label>Fecha de Venta</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="date"
                    value={editedSale.sale_date}
                    onChange={(e) => setEditedSale(prev => ({ ...prev, sale_date: e.target.value }))}
                    className="pl-10"
                    disabled={isSaleCancelled || isProcessing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cliente Existente (Opcional)</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-gray-300"
                  onChange={handleCustomerSelect}
                  disabled={isSaleCancelled || isProcessing}
                >
                  <option value="">Seleccionar cliente...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Nombre del Cliente *</Label>
                <Input
                  value={editedSale.customer_name}
                  onChange={(e) => setEditedSale(prev => ({ ...prev, customer_name: e.target.value }))}
                  placeholder="Nombre completo"
                  disabled={isSaleCancelled || isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label>Teléfono *</Label>
                <Input
                  value={editedSale.customer_phone}
                  onChange={(e) => setEditedSale(prev => ({ ...prev, customer_phone: e.target.value }))}
                  placeholder="Número de teléfono"
                  disabled={isSaleCancelled || isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label>Documento (Opcional)</Label>
                <Input
                  value={editedSale.customer_document}
                  onChange={(e) => setEditedSale(prev => ({ ...prev, customer_document: e.target.value }))}
                  placeholder="Cédula, NIT, etc."
                  disabled={isSaleCancelled || isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={editedSale.notes}
                  onChange={(e) => setEditedSale(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observaciones..."
                  disabled={isSaleCancelled || isProcessing}
                />
              </div>
            </div>

            {/* Right Column: Payment Methods */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Métodos de Pago</h3>
                {!isSaleCancelled && editedSale.payment_methods.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearAllPayments}
                    disabled={isProcessing}
                    className="text-orange-600 hover:text-orange-700 hover:border-orange-300"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Resetear
                  </Button>
                )}
              </div>

              {/* Existing Payments */}
              {editedSale.payment_methods.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Pagos Registrados:</Label>
                  {editedSale.payment_methods.map((payment) => {
                    const methodInfo = getMethodInfo(payment.method);
                    return (
                      <div key={payment.id || payment.method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`${methodInfo.color} p-2 rounded-lg text-white`}>
                            <methodInfo.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium">{methodInfo.name}</p>
                            {payment.reference && (
                              <p className="text-sm text-gray-500">Ref: {payment.reference}</p>
                            )}
                            {payment.bank_account && (
                              <p className="text-xs text-blue-600">{payment.bank_account}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-semibold">
                            ${payment.amount.toLocaleString()}
                          </Badge>
                          {!isSaleCancelled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePayment(payment.id || payment.method)}
                              className="text-red-500 hover:text-red-700"
                              disabled={isProcessing}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add New Payment */}
              {!isSaleCancelled && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-medium">
                        Agregar Método de Pago 
                        {remainingAmount > 0 && (
                          <span className="text-orange-600 ml-2">
                            (Restante: ${remainingAmount.toLocaleString()})
                          </span>
                        )}
                      </Label>

                      <div className="grid grid-cols-3 gap-2">
                        {paymentMethods.map((method) => (
                          <Button
                            key={method.id}
                            variant={currentPayment.method === method.id ? 'default' : 'outline'}
                            onClick={() => setCurrentPayment(prev => ({ ...prev, method: method.id, bank_account: '' }))}
                            className="flex flex-col items-center gap-1 h-auto py-2"
                            size="sm"
                            disabled={isProcessing}
                          >
                            <method.icon className="w-4 h-4" />
                            <span className="text-xs">{method.name}</span>
                          </Button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm">Monto *</Label>
                          <Input
                            type="number"
                            min="0"
                            max={remainingAmount > 0 ? remainingAmount : sale.total_amount}
                            value={currentPayment.amount}
                            onChange={(e) => setCurrentPayment(prev => ({
                              ...prev,
                              amount: parseFloat(e.target.value) || 0
                            }))}
                            placeholder="0"
                            disabled={isProcessing}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Referencia</Label>
                          <Input
                            value={currentPayment.reference}
                            onChange={(e) => setCurrentPayment(prev => ({ ...prev, reference: e.target.value }))}
                            placeholder="Opcional"
                            disabled={isProcessing}
                          />
                        </div>
                      </div>

                      {currentPayment.method === 'transfer' && (
                        <div className="space-y-2">
                          <Label className="text-sm">Cuenta Bancaria</Label>
                          <select
                            className="w-full h-10 px-3 rounded-md border border-gray-300"
                            value={currentPayment.bank_account}
                            onChange={(e) => setCurrentPayment(prev => ({ ...prev, bank_account: e.target.value }))}
                            disabled={isProcessing}
                          >
                            <option value="">Seleccionar cuenta...</option>
                            {bankAccounts.map(account => (
                              <option key={account.id} value={`${account.name} - ${account.account_number}`}>
                                {account.name} - {account.account_number}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <Button
                        onClick={addPayment}
                        className="w-full"
                        disabled={
                          currentPayment.amount <= 0 || 
                          isProcessing
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Pago
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isProcessing || errors.length > 0 || isSaleCancelled || remainingAmount !== 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}