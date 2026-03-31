import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Plus } from "lucide-react";
import NewPurchaseForm from "@/components/purchases/NewPurchaseForm";
import PurchasesList from "@/components/purchases/PurchasesList";

export default function EmployeePurchases() {
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [emps, prods, purch, disps, pays, delivs] = await Promise.all([
      base44.entities.Employee.list(),
      base44.entities.Producto.list(),
      base44.entities.EmployeePurchase.list('-purchase_date'),
      base44.entities.Dispatch.list(),
      base44.entities.Payment.list(),
      base44.entities.Delivery.list()
    ]);
    setEmployees(emps.filter(e => e.is_active));
    setProducts((prods || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
    setPurchases(purch);
    setDispatches(disps);
    setPayments(pays);
    setDeliveries(delivs);
    setLoading(false);
  };

  const getDeliveryAmount = (d) => {
    if (d.total_amount) return d.total_amount;
    if (d.items && d.items.length > 0) return d.items.reduce((s, i) => s + (i.total_amount || i.quantity * i.unit_price || 0), 0);
    if (d.quantity && d.unit_price) return d.quantity * d.unit_price;
    return 0;
  };

  const getEmployeeBalance = (employeeId) => {
    const empDeliveries = deliveries.filter(d => d.employee_id === employeeId);
    const empPayments = payments.filter(p => p.employee_id === employeeId);

    const deliveryPaidAmounts = {};
    empPayments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    const paidDeliveryIds = new Set();
    empPayments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
    });

    const pendingDeliveries = [];
    empDeliveries.forEach(d => {
      if (d.status === 'pagado' || paidDeliveryIds.has(d.id)) return;
      const earned = getDeliveryAmount(d);
      const paid = deliveryPaidAmounts[d.id] || 0;
      const pending = earned - paid;
      if (pending > 0) pendingDeliveries.push({ ...d, pending_amount: pending });
    });

    const genericPayments = empPayments
      .filter(p => (!p.delivery_payments || p.delivery_payments.length === 0) && (!p.delivery_ids || p.delivery_ids.length === 0))
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
    pendingDeliveries.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
    genericPayments.forEach(payment => {
      let remaining = payment.amount;
      pendingDeliveries.forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    // Descontar compras con descuento_saldo
    const purchaseDiscounts = purchases
      .filter(p => p.employee_id === employeeId && p.payment_method === 'descuento_saldo')
      .reduce((sum, p) => sum + p.total_amount, 0);

    const pending = pendingDeliveries.reduce((sum, d) => sum + Math.max(0, d.pending_amount), 0);
    return Math.max(0, pending - purchaseDiscounts);
  };

  const getEmployeeCreditBalance = (employeeId) => {
    return purchases
      .filter(p => p.employee_id === employeeId && p.payment_method === 'credito')
      .reduce((sum, p) => sum + (p.total_amount - (p.credit_paid_amount || 0)), 0);
  };

  const handleDeletePurchase = async (purchase) => {
    if (!window.confirm(`¿Revertir y eliminar esta compra de $${purchase.total_amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}? Se restaurarán los despachos y se eliminará la entrega vinculada.`)) return;

    try {
      // 1. Buscar y eliminar la Delivery generada automáticamente
      const empDeliveries = deliveries.filter(d =>
        d.employee_id === purchase.employee_id &&
        d.delivery_date === purchase.purchase_date &&
        d.notes && d.notes.includes('Compra empleado')
      );
      // Si hay varias (mismo día), buscar la que más se acerque por monto de manufactura
      for (const del of empDeliveries) {
        await base44.entities.Delivery.delete(del.id);
      }

      // 2. Restaurar despachos por cada ítem comprado
      const empDispatches = dispatches
        .filter(d => d.employee_id === purchase.employee_id)
        .sort((a, b) => new Date(a.dispatch_date) - new Date(b.dispatch_date));

      for (const item of (purchase.items || [])) {
        let qtyToRestore = item.quantity;

        // Buscar despachos del mismo producto (primero los que quedaron en 0/entregados, luego activos)
        const productDispatches = empDispatches.filter(d => d.product_reference === item.product_reference);
        const entregados = productDispatches.filter(d => d.status === 'entregado' || d.quantity === 0);
        const activos = productDispatches.filter(d => d.status !== 'entregado' && d.quantity > 0);

        // Restaurar primero los entregados (fueron consumidos completamente)
        for (const dispatch of entregados) {
          if (qtyToRestore <= 0) break;
          const restore = Math.min(qtyToRestore, item.quantity);
          await base44.entities.Dispatch.update(dispatch.id, {
            quantity: restore,
            status: 'despachado'
          });
          qtyToRestore -= restore;
        }

        // Si queda cantidad, añadir al primer despacho activo
        if (qtyToRestore > 0 && activos.length > 0) {
          await base44.entities.Dispatch.update(activos[0].id, {
            quantity: activos[0].quantity + qtyToRestore
          });
        }
      }

      // 3. Eliminar la compra
      await base44.entities.EmployeePurchase.delete(purchase.id);
      await loadData();
    } catch (error) {
      alert('Error al revertir la compra: ' + error.message);
    }
  };

  const filteredPurchases = selectedEmployee
    ? purchases.filter(p => p.employee_id === selectedEmployee)
    : purchases;

  const empName = (id) => employees.find(e => e.employee_id === id)?.name || id;

  const totalCreditPending = purchases
    .filter(p => p.payment_method === 'credito')
    .reduce((sum, p) => sum + (p.total_amount - (p.credit_paid_amount || 0)), 0);

  const totalDiscounted = purchases
    .filter(p => p.payment_method === 'descuento_saldo')
    .reduce((sum, p) => sum + p.total_amount, 0);

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-purple-600" />
              Compras de Empleados
            </h1>
            <p className="text-sm text-slate-500 mt-1">Control de prendas compradas por operarios con descuento especial</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" /> Nueva Compra
          </Button>
        </div>

        {/* Resumen general */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Total Compras Registradas</p>
              <p className="text-2xl font-bold text-slate-800">{purchases.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Crédito Pendiente Total</p>
              <p className="text-2xl font-bold text-orange-600">${totalCreditPending.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Descontado de Saldos</p>
              <p className="text-2xl font-bold text-blue-600">${totalDiscounted.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro por empleado */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600 block mb-1">Filtrar por operario</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los operarios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.employee_id} value={e.employee_id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEmployee && (
                <div className="flex gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-blue-600">Saldo pendiente</p>
                    <p className="font-bold text-blue-800">${getEmployeeBalance(selectedEmployee).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-orange-600">Crédito pendiente</p>
                    <p className="font-bold text-orange-800">${getEmployeeCreditBalance(selectedEmployee).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de compras */}
        <PurchasesList
          purchases={filteredPurchases}
          employees={employees}
          products={products}
          empName={empName}
          onRefresh={loadData}
          onDelete={handleDeletePurchase}
        />
      </div>

      {/* Modal nueva compra */}
      {showForm && (
        <NewPurchaseForm
          employees={employees}
          products={products}
          dispatches={dispatches}
          deliveries={deliveries}
          purchases={purchases}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}
    </div>
  );
}