import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, CreditCard } from "lucide-react";
import { format } from 'date-fns';

const getColombiaTodayString = () => {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombiaTime.toISOString().split('T')[0];
};

const formatDateColombia = (dateString) => {
  const date = new Date(dateString + 'T00:00:00');
  return format(date, 'yyyy-MM-dd');
};

export default function PaymentForm({ employee, payment, pendingDeliveries, onSubmit, onCancel }) {
  // Filtrar solo entregas con saldo pendiente real > $100
  const validPendingDeliveries = pendingDeliveries.filter(d => {
    const pending = d.pending_amount || 0;
    return pending > 100; // Evitar valores residuales o ya pagados
  });

  const [deliveryAmounts, setDeliveryAmounts] = useState({});
  const [description, setDescription] = useState(payment ? payment.description : "");
  const [paymentDate, setPaymentDate] = useState(
    payment ? formatDateColombia(payment.payment_date) : getColombiaTodayString()
  );

  const handleAmountChange = (deliveryId, value) => {
    const numValue = parseFloat(value) || 0;
    setDeliveryAmounts(prev => ({
      ...prev,
      [deliveryId]: numValue
    }));
  };

  const getTotalAmount = () => {
    return Object.values(deliveryAmounts).reduce((sum, amt) => sum + amt, 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalAmount = getTotalAmount();
    
    if (totalAmount <= 0) {
      alert("Debes asignar al menos un monto a una entrega.");
      return;
    }

    const deliveryPayments = Object.entries(deliveryAmounts)
      .filter(([_, amount]) => amount > 0)
      .map(([delivery_id, amount]) => ({ delivery_id, amount }));

    const finalPaymentData = {
      employee_id: employee.employee_id,
      amount: totalAmount,
      payment_date: paymentDate,
      payment_type: 'avance',
      description: description || `Pago de $${totalAmount.toLocaleString()}`,
      delivery_payments: deliveryPayments
    };

    onSubmit(finalPaymentData);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Registrar Pago para {employee.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asignar Montos a Entregas</CardTitle>
              <p className="text-sm text-slate-500">Indica cuánto pagas de cada entrega (puede ser parcial o total).</p>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {validPendingDeliveries.length > 0 ? validPendingDeliveries.map(delivery => {
                const pendingAmt = delivery.pending_amount || delivery.total_amount;
                return (
                  <div key={delivery.id} className="p-3 bg-slate-50 rounded-lg border">
                    <div className="mb-2">
                      <p className="font-medium text-sm">{format(new Date(delivery.delivery_date), 'dd/MM/yyyy')} - {delivery.quantity} unidades</p>
                      <p className="text-xs text-orange-600 font-medium">Pendiente: ${pendingAmt.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`amount-${delivery.id}`} className="text-sm min-w-[60px]">Pagar:</Label>
                      <Input
                        id={`amount-${delivery.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max={pendingAmt}
                        value={deliveryAmounts[delivery.id] || ''}
                        onChange={(e) => handleAmountChange(delivery.id, e.target.value)}
                        placeholder="0"
                        className="flex-1"
                      />
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-center text-slate-500 py-4">No hay entregas pendientes.</p>}
            </CardContent>
          </Card>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-900">Total del Pago:</span>
              <span className="text-2xl font-bold text-blue-900">${getTotalAmount().toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_date">Fecha de Pago *</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del pago..."
              className="h-20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Registrar Pago
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}