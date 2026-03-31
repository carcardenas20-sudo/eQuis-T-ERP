import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign } from "lucide-react";

import PaymentForm from "../components/payments/PaymentForm";
import PaymentsHistory from "../components/payments/PaymentsHistory";
import ActivityHistory from "../components/history/ActivityHistory";

export default function Payments() {
  const [employees, setEmployees] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesData, deliveriesData, paymentsData, purchasesData] = await Promise.all([
        base44.entities.Employee.list(),
        base44.entities.Delivery.list(),
        base44.entities.Payment.list('-payment_date'),
        base44.entities.EmployeePurchase.list()
      ]);
      setEmployees(employeesData.filter(e => e.is_active));
      setDeliveries(deliveriesData);
      setPayments(paymentsData);
      setPurchases(purchasesData || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
    setLoading(false);
  };

  const getPendingPayments = () => {
    const pending = {};

    employees.forEach(emp => {
      pending[emp.employee_id] = { total: 0, count: 0, deliveries: [] };
    });

    // Calcular pagos por entrega (sistema nuevo)
    const deliveryPaidAmounts = {};
    payments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    // Marcar entregas pagadas completamente (sistema antiguo)
    const paidDeliveryIds = new Set();
    payments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) {
        p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
      }
    });

    // Calcular pendientes por entrega
    deliveries.forEach(delivery => {
      // Skip si está marcada como pagada (status en BD o sistema antiguo)
      if (delivery.status === 'pagado' || paidDeliveryIds.has(delivery.id)) return;
      // Skip entregas generadas automáticamente por compra interna
      if (delivery.notes && delivery.notes.includes('Compra empleado')) return;
      
      const paidAmount = deliveryPaidAmounts[delivery.id] || 0;
      const pendingAmount = (delivery.total_amount || 0) - paidAmount;
      
      // Solo considerar pendiente si el monto es mayor a $100 (evitar residuales)
      if (pendingAmount > 100) {
        if (!pending[delivery.employee_id]) {
          pending[delivery.employee_id] = { total: 0, count: 0, deliveries: [] };
        }
        pending[delivery.employee_id].total += pendingAmount;
        pending[delivery.employee_id].count++;
        pending[delivery.employee_id].deliveries.push({
          ...delivery,
          pending_amount: pendingAmount
        });
      }
    });

    // Aplicar pagos antiguos (sin delivery_payments) cronológicamente a las entregas pendientes
    // Ordenar pagos por fecha (más antiguos primero)
    const oldPayments = payments
      .filter(p => (!p.delivery_payments || p.delivery_payments.length === 0) && 
                   (!p.delivery_ids || p.delivery_ids.length === 0))
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    oldPayments.forEach(payment => {
      const employeePending = pending[payment.employee_id];
      if (!employeePending || !employeePending.deliveries || employeePending.deliveries.length === 0) return;
      
      // Ordenar entregas por fecha (más antiguas primero)
      employeePending.deliveries.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
      
      let remainingPayment = payment.amount;
      
      employeePending.deliveries.forEach(delivery => {
        if (remainingPayment <= 0) return;
        
        const currentPending = delivery.pending_amount || 0;
        const amountToApply = Math.min(remainingPayment, currentPending);
        
        if (amountToApply > 0) {
          delivery.pending_amount -= amountToApply;
          remainingPayment -= amountToApply;
        }
      });
      
      // Recalcular total y filtrar
      employeePending.total = employeePending.deliveries.reduce((sum, d) => sum + (d.pending_amount || 0), 0);
      employeePending.deliveries = employeePending.deliveries.filter(d => (d.pending_amount || 0) > 100);
      employeePending.count = employeePending.deliveries.length;
    });

    // Descontar compras por descuento_saldo del total pendiente de cada empleado
    // Permitir saldo negativo (empleado debe a la empresa)
    purchases
      .filter(p => p.payment_method === 'descuento_saldo')
      .forEach(purchase => {
        if (pending[purchase.employee_id]) {
          pending[purchase.employee_id].total -= purchase.total_amount;
          pending[purchase.employee_id].hasPurchaseDiscount = true;
        }
      });

    return pending;
  };

  const pendingPayments = getPendingPayments();

  const handleCreatePayment = async (paymentData) => {
    try {
      const newPayment = await base44.entities.Payment.create({
        ...paymentData,
        status: 'registrado'
      });
      const employee = employees.find(e => e.employee_id === paymentData.employee_id);

      await base44.entities.ActivityLog.create({
        entity_type: 'Payment',
        entity_id: newPayment.id,
        action: 'created',
        description: `Pago registrado - ${paymentData.payment_type === 'pago_completo' ? 'Pago completo' : 'Avance'} - $${paymentData.amount.toLocaleString()}`,
        employee_id: paymentData.employee_id,
        employee_name: employee?.name || paymentData.employee_id,
        amount: paymentData.amount,
        new_data: paymentData
      });
      
      const pendingRequests = await base44.entities.PaymentRequest.filter({
        employee_id: paymentData.employee_id,
        status: 'pending'
      });

      if (pendingRequests.length > 0) {
        const colombiaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
        const processedDate = colombiaTime.toISOString().split('T')[0];
        
        const requestUpdates = pendingRequests.map(req =>
          base44.entities.PaymentRequest.update(req.id, {
            status: 'approved',
            processed_date: processedDate,
            admin_response: `Pago de $${paymentData.amount.toLocaleString()} registrado.`
          })
        );
        await Promise.all(requestUpdates);
      }
      
      alert("Pago registrado exitosamente");
      setShowForm(false);
      setSelectedEmployee(null);
      setEditingPayment(null);
      loadData();
    } catch (error) {
      console.error("Error al guardar el pago:", error);
      alert("Hubo un error al guardar el pago.");
    }
  };



  const handleDeletePayment = async (payment) => {
    if (window.confirm(`¿Estás seguro de eliminar este pago de $${payment.amount.toLocaleString()}?`)) {
      try {
        const employee = employees.find(e => e.employee_id === payment.employee_id);
        
        await base44.entities.Payment.delete(payment.id);

        await base44.entities.ActivityLog.create({
          entity_type: 'Payment',
          entity_id: payment.id,
          action: 'deleted',
          description: `Pago eliminado - $${payment.amount.toLocaleString()}`,
          employee_id: payment.employee_id,
          employee_name: employee?.name || payment.employee_id,
          amount: payment.amount,
          previous_data: payment
        });
        
        alert("Pago eliminado correctamente");
        loadData();
      } catch (error) {
        console.error("Error al eliminar el pago:", error);
        alert("Error al eliminar el pago.");
      }
    }
  };

  const openPaymentForm = (employee) => {
    setSelectedEmployee(employee);
    setEditingPayment(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Pagos a Empleados</h1>
          <p className="text-slate-600 text-sm sm:text-base">Gestión de pagos por entregas de producción.</p>
        </div>

        {showForm ? (
          <PaymentForm
            employee={selectedEmployee}
            payment={editingPayment}
            pendingDeliveries={pendingPayments[selectedEmployee?.employee_id]?.deliveries || []}
            onSubmit={handleCreatePayment}
            onCancel={() => {
              setShowForm(false);
              setSelectedEmployee(null);
              setEditingPayment(null);
            }}
          />
        ) : (
          <>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="pending" className="text-xs sm:text-sm">Pendientes</TabsTrigger>
                <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs sm:text-sm">Cambios</TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-orange-600" />
                      Pagos Pendientes por Empleado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                {Object.keys(pendingPayments).some(id => pendingPayments[id].total !== 0) ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {employees
                      .filter(emp => pendingPayments[emp.employee_id] && pendingPayments[emp.employee_id].total !== 0)
                      .map(employee => {
                        const pending = pendingPayments[employee.employee_id];
                        return (
                          <Card key={employee.id} className="border-slate-200 flex flex-col">
                            <CardContent className="p-6 flex-1">
                              <h3 className="font-bold text-slate-900 text-lg mb-2">{employee.name}</h3>
                              <p className="text-sm text-slate-600 mb-4">ID: {employee.employee_id}</p>
                              
                              <div className={`text-center p-4 rounded-lg mb-4 ${pending.total < 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                                <p className={`text-sm ${pending.total < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                                  {pending.total < 0 ? 'Saldo a favor de la empresa' : 'Monto Pendiente'}
                                </p>
                                <p className={`text-2xl font-bold ${pending.total < 0 ? 'text-red-800' : 'text-orange-800'}`}>
                                  {pending.total < 0 ? `-$${Math.abs(pending.total).toLocaleString()}` : `$${pending.total.toLocaleString()}`}
                                </p>
                                <p className={`text-xs ${pending.total < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                  {pending.total < 0 ? 'Compra interna descuenta del saldo' : `Basado en ${pending.count} entregas pendientes`}
                                </p>
                              </div>
                            </CardContent>
                            {pending.total > 0 && (
                              <div className="p-4 bg-slate-50 border-t">
                                <Button 
                                  className="w-full bg-blue-600 hover:bg-blue-700"
                                  onClick={() => openPaymentForm(employee)}
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Registrar Pago
                                </Button>
                              </div>
                            )}
                          </Card>
                        );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>No hay pagos pendientes en este momento.</p>
                  </div>
                )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <PaymentsHistory 
                  payments={payments} 
                  employees={employees}
                  onDelete={handleDeletePayment}
                />
              </TabsContent>

              <TabsContent value="activity">
                <ActivityHistory entityType="Payment" />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}