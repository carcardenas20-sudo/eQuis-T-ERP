import React, { useState, useEffect, useMemo } from "react";
import { AccountPayable, PayablePayment, Supplier, Location, Expense } from "@/entities/all";
import { localClient } from "@/api/localClient";
import { useSession } from "../components/providers/SessionProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, AlertCircle, TrendingUp, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import PayableForm from "../components/payables/PayableForm";
import PayableList from "../components/payables/PayableList";
import PaymentModal from "../components/payables/PaymentModal";
import InstallmentsManager from "../components/payables/InstallmentsManager";

export default function AccountsPayablePage() {
  const { currentUser, userLocation, userRole, isLoading: isSessionLoading } = useSession();
  
  const [payables, setPayables] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [opPayments, setOpPayments] = useState([]);
  const [opEmployees, setOpEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayable, setEditingPayable] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [installmentsFor, setInstallmentsFor] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!isSessionLoading) loadData();
  }, [isSessionLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPayables, allSuppliers, allLocations, allOpPayments, allEmployees] = await Promise.all([
        AccountPayable.list("-created_date", 500),
        Supplier.list(),
        Location.list(),
        localClient.entities.Payment.list('-payment_date'),
        localClient.entities.Employee.list(),
      ]);
      setPayables(allPayables || []);
      setSuppliers(allSuppliers || []);
      setLocations(allLocations || []);
      // Solo pagos registrados (pendientes de transferencia)
      setOpPayments((allOpPayments || []).filter(p => p.status === 'registrado'));
      setOpEmployees(allEmployees || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  // Convierte pagos de operarios registrados en filas de CxP
  const operarioPayables = useMemo(() => opPayments.map(op => {
    const emp = opEmployees.find(e => e.employee_id === op.employee_id);
    return {
      id: `op_${op.id}`,
      _opPaymentId: op.id,
      _isOperario: true,
      supplier_name: emp?.name || op.employee_id,
      description: `Pago operario — ${emp?.name || op.employee_id}`,
      type: 'manufacturing_salary',
      category: 'salarios_manufactura',
      status: 'pending',
      total_amount: op.amount,
      pending_amount: op.amount,
      paid_amount: 0,
      due_date: op.payment_date,
      created_date: op.payment_date,
    };
  }), [opPayments, opEmployees]);

  const handleSave = async (data) => {
    try {
      if (editingPayable) {
        await AccountPayable.update(editingPayable.id, data);
      } else {
        await AccountPayable.create(data);
      }
      await loadData();
      setShowForm(false);
      setEditingPayable(null);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error al guardar la cuenta por pagar");
    }
  };

  const handleEdit = (payable) => {
    setEditingPayable(payable);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta cuenta por pagar?")) return;
    try {
      await AccountPayable.delete(id);
      await loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Error al eliminar");
    }
  };

  const handlePayment = (payable) => {
    setPaymentModalData(payable);
  };

  const handlePaymentConfirm = async (paymentData) => {
    try {
      const payable = paymentModalData;
      const newPaidAmount = payable.paid_amount + paymentData.amount;
      const newPendingAmount = payable.total_amount - newPaidAmount;
      const newStatus = newPendingAmount <= 0 ? "paid" : "partial";

      // Crear el pago
      const payment = await PayablePayment.create({
        payable_id: payable.id,
        payment_date: new Date().toISOString(),
        amount: paymentData.amount,
        method: paymentData.method,
        reference: paymentData.reference || "",
        bank_account_id: paymentData.bank_account_id || null,
        location_id: paymentData.location_id,
        notes: paymentData.notes || ""
      });

      // Si es efectivo (y no está marcado como fuera de caja), crear Expense
      // que descuenta automáticamente del control de caja de la sucursal
      let expenseId = null;
      if (paymentData.method === "cash" && !paymentData.skip_cash_control) {
        const expense = await Expense.create({
          description: `Pago a ${payable.supplier_name} - ${payable.description}`,
          amount: paymentData.amount,
          category: payable.category || "otros",
          expense_date: new Date().toISOString().split('T')[0],
          location_id: paymentData.location_id,
          payment_method: "cash",
          receipt_number: paymentData.reference || "",
          supplier: payable.supplier_name,
          notes: `Abono a cuenta por pagar #${payable.id}`
        });
        expenseId = expense.id;
        await PayablePayment.update(payment.id, { expense_id: expenseId });
      }

      if (payable._isOperario) {
        // Pago de operario: marcar el Payment como ejecutado en Transferencias
        await localClient.entities.Payment.update(payable._opPaymentId, { status: 'ejecutado' });
      } else {
        // Cuenta por pagar normal: actualizar AccountPayable
        await AccountPayable.update(payable.id, {
          paid_amount: newPaidAmount,
          pending_amount: newPendingAmount,
          status: newStatus
        });
      }

      await loadData();
      setPaymentModalData(null);
      alert("Pago registrado correctamente");
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error al procesar el pago");
    }
  };

  const isNomina = p => p._isOperario || p.type === "manufacturing_salary" || p.category === "salarios_manufactura";

  const allPending = [
    ...payables.filter(p => p.status === "pending" || p.status === "partial"),
    ...operarioPayables,
  ];
  const pendingPayables = allPending.filter(p => typeFilter === "all" ? true : isNomina(p));
  const paidPayables = payables
    .filter(p => p.status === "paid")
    .filter(p => typeFilter === "all" ? true : isNomina(p));
  const overduePayables = allPending
    .filter(p => new Date(p.due_date) < new Date())
    .filter(p => typeFilter === "all" ? true : isNomina(p));

  const totalPending = pendingPayables.reduce((sum, p) => sum + (p.pending_amount || 0), 0);
  const totalOverdue = overduePayables.reduce((sum, p) => sum + (p.pending_amount || 0), 0);

  if (isSessionLoading || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin' || userRole?.name === 'Administrador';

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cuentas por Pagar</h1>
            <p className="text-slate-600 mt-1 text-sm sm:text-base">Gestiona deudas con proveedores y gastos a plazos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 sm:w-44 text-xs sm:text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="nomina">Nómina/Operarios</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingPayable(null); setShowForm(true); }} className="gap-1.5 text-xs sm:text-sm px-2 sm:px-4">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Cuenta</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:px-6 sm:pb-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-slate-600">Total Pendiente</p>
                  <p className="text-base sm:text-2xl font-bold text-slate-900 truncate">${totalPending.toLocaleString()}</p>
                </div>
                <DollarSign className="w-5 h-5 sm:w-8 sm:h-8 text-blue-600 shrink-0 ml-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:pt-6 sm:px-6 sm:pb-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-slate-600">Pendientes</p>
                  <p className="text-base sm:text-2xl font-bold text-slate-900">{pendingPayables.length}</p>
                </div>
                <TrendingUp className="w-5 h-5 sm:w-8 sm:h-8 text-amber-600 shrink-0 ml-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:pt-6 sm:px-6 sm:pb-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-slate-600">Vencidas</p>
                  <p className="text-base sm:text-2xl font-bold text-red-600 truncate">${totalOverdue.toLocaleString()}</p>
                </div>
                <AlertCircle className="w-5 h-5 sm:w-8 sm:h-8 text-red-600 shrink-0 ml-1" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {overduePayables.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Tienes {overduePayables.length} cuenta(s) vencida(s) por ${totalOverdue.toLocaleString()}
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        {showForm && (
          <PayableForm
            payable={editingPayable}
            suppliers={suppliers}
            locations={locations}
            userLocation={userLocation}
            isAdmin={isAdmin}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingPayable(null); }}
          />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              Pendientes ({pendingPayables.length})
            </TabsTrigger>
            <TabsTrigger value="paid">
              Pagadas ({paidPayables.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              Todas ({payables.length + operarioPayables.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-3 sm:mt-6">
            <PayableList
              payables={pendingPayables}
              locations={locations}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPayment={handlePayment}
              onManageInstallments={setInstallmentsFor}
            />
          </TabsContent>

          <TabsContent value="paid" className="mt-3 sm:mt-6">
            <PayableList
              payables={paidPayables}
              locations={locations}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPayment={handlePayment}
              onManageInstallments={setInstallmentsFor}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-3 sm:mt-6">
            <PayableList
              payables={[...payables, ...operarioPayables]}
              locations={locations}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPayment={handlePayment}
              onManageInstallments={setInstallmentsFor}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Modal */}
      {paymentModalData && (
        <PaymentModal
          payable={paymentModalData}
          locations={locations}
          userLocation={userLocation}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setPaymentModalData(null)}
        />
      )}

      {installmentsFor && (
        <InstallmentsManager
          payable={installmentsFor}
          onClose={()=>setInstallmentsFor(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}