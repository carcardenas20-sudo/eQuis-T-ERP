import React, { useState, useEffect } from "react";
import { AccountPayable, PayablePayment, Supplier, Location, Expense } from "@/entities/all";
import { useSession } from "../components/providers/SessionProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, AlertCircle, TrendingUp, Loader2, PlayCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import PayableForm from "../components/payables/PayableForm";
import PayableList from "../components/payables/PayableList";
import PaymentModal from "../components/payables/PaymentModal";
import InstallmentsManager from "../components/payables/InstallmentsManager";
import { simulateOperariosSalary } from "@/functions/simulateOperariosSalary";

export default function AccountsPayablePage() {
  const { currentUser, userLocation, userRole, isLoading: isSessionLoading } = useSession();
  
  const [payables, setPayables] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayable, setEditingPayable] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [installmentsFor, setInstallmentsFor] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!isSessionLoading) {
      loadData();
    }
  }, [isSessionLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPayables, allSuppliers, allLocations] = await Promise.all([
        AccountPayable.list("-created_date", 500),
        Supplier.list(),
        Location.list()
      ]);

      setPayables(allPayables || []);
      setSuppliers(allSuppliers || []);
      setLocations(allLocations || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

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

  const handleSimulatePayroll = async () => {
    const res = await simulateOperariosSalary({});
    if (res?.status === 200) {
      alert("Simulación creada: revisa el filtro 'Nómina/Operarios'.");
      await loadData();
      setTypeFilter("nomina");
    } else {
      alert("No se pudo simular. Revisa permisos y logs de la función.");
    }
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

      // Si el pago es en efectivo, crear automáticamente un Expense
      let expenseId = null;
      if (paymentData.method === "cash") {
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

        // Actualizar el pago con el expense_id
        await PayablePayment.update(payment.id, { expense_id: expenseId });
      }

      // Actualizar la cuenta por pagar
      await AccountPayable.update(payable.id, {
        paid_amount: newPaidAmount,
        pending_amount: newPendingAmount,
        status: newStatus
      });

      await loadData();
      setPaymentModalData(null);
      alert("Pago registrado correctamente");
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error al procesar el pago");
    }
  };

  const pendingPayables = payables
    .filter(p => (p.status === "pending" || p.status === "partial"))
    .filter(p => typeFilter === "all" ? true : (p.type === "manufacturing_salary" || p.category === "salarios_manufactura"));
  const paidPayables = payables
    .filter(p => p.status === "paid")
    .filter(p => typeFilter === "all" ? true : (p.type === "manufacturing_salary" || p.category === "salarios_manufactura"));
  const overduePayables = payables
    .filter(p => {
      if (p.status === "paid") return false;
      const dueDate = new Date(p.due_date);
      return dueDate < new Date();
    })
    .filter(p => typeFilter === "all" ? true : (p.type === "manufacturing_salary" || p.category === "salarios_manufactura"));

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
            <Button variant="outline" onClick={handleSimulatePayroll} className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 hidden sm:flex">
              <PlayCircle className="w-4 h-4" />
              <span>Probar integración</span>
            </Button>
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
              Todas ({payables.length})
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
              payables={payables}
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