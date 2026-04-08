import React, { useState, useEffect, useMemo } from "react";
import { AccountPayable, PayablePayment, Supplier, Location, Expense, Presupuesto, Inventario } from "@/entities/all";
import { localClient } from "@/api/localClient";
import { useSession } from "../components/providers/SessionProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, DollarSign, AlertCircle, TrendingUp, Loader2, Package, ShoppingCart, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import PayableForm from "../components/payables/PayableForm";
import PayableList from "../components/payables/PayableList";
import PaymentModal from "../components/payables/PaymentModal";
import InstallmentsManager from "../components/payables/InstallmentsManager";

// ─── Modal Comprar Material ───────────────────────────────────────────────────
function ComprarMaterialModal({ item, onConfirm, onCancel }) {
  const [cantidad, setCantidad] = useState(String(item.cantidad_pendiente));
  const [precio, setPrecio] = useState(String(item.precio_unitario || ""));
  const [proveedor, setProveedor] = useState("");
  const [loading, setLoading] = useState(false);

  const cantNum = parseFloat(cantidad) || 0;
  const precioNum = parseFloat(precio) || 0;
  const exceso = Math.max(0, cantNum - item.cantidad_pendiente);
  const totalCompra = cantNum * precioNum;

  const estadoBadge = {
    borrador: "bg-slate-100 text-slate-700",
    enviado:  "bg-blue-100 text-blue-700",
    aprobado: "bg-emerald-100 text-emerald-700",
    rechazado:"bg-red-100 text-red-700",
  };

  const handleConfirm = async () => {
    if (cantNum <= 0) return;
    setLoading(true);
    await onConfirm({ cantidad: cantNum, precioUnitario: precioNum, proveedor });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">Registrar Compra</h2>
          <p className="text-sm text-slate-500 mt-0.5">{item.nombre}{item.color && item.color !== "sin definir" ? ` · ${item.color}` : ""}</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Info presupuesto */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Presupuesto</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item._presupuesto.numero_presupuesto}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[item._presupuesto.estado] || "bg-slate-100 text-slate-700"}`}>
                  {item._presupuesto.estado}
                </span>
              </div>
            </div>
            {item._presupuesto.cliente && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cliente</span>
                <span className="font-medium">{item._presupuesto.cliente}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Necesario</span>
              <span className="font-medium">{item.cantidad_total} {item.unidad_medida}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ya comprado</span>
              <span className="font-medium">{item.cantidad_comprada} {item.unidad_medida}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1 mt-1">
              <span className="text-slate-700 font-medium">Pendiente</span>
              <span className="font-bold text-amber-700">{item.cantidad_pendiente.toFixed(2)} {item.unidad_medida}</span>
            </div>
          </div>

          {/* Cantidad a comprar */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Cantidad a comprar *</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="flex-1"
                placeholder={item.cantidad_pendiente}
              />
              <span className="text-sm text-slate-500 shrink-0">{item.unidad_medida}</span>
            </div>
            {exceso > 0 && (
              <p className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">
                Excedente de <strong>{exceso.toFixed(2)} {item.unidad_medida}</strong> → se añadirá al inventario de materias primas
              </p>
            )}
          </div>

          {/* Precio unitario */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Precio unitario</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                className="flex-1"
              />
            </div>
            {cantNum > 0 && precioNum > 0 && (
              <p className="text-xs text-slate-500 mt-1">Total: <strong>${totalCompra.toLocaleString()}</strong></p>
            )}
          </div>

          {/* Proveedor */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Proveedor (opcional)</Label>
            <Input
              className="mt-1"
              value={proveedor}
              onChange={e => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || cantNum <= 0} className="bg-emerald-600 hover:bg-emerald-700">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Compra
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de material pendiente ───────────────────────────────────────────────
function MaterialPendienteRow({ item, onComprar }) {
  const [expanded, setExpanded] = useState(false);
  const porcentaje = item.cantidad_total > 0 ? (item.cantidad_comprada / item.cantidad_total) * 100 : 0;

  const estadoBadge = {
    borrador: "bg-slate-100 text-slate-600",
    enviado:  "bg-blue-100 text-blue-700",
    aprobado: "bg-emerald-100 text-emerald-700",
    rechazado:"bg-red-100 text-red-700",
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm">{item.nombre}</span>
            {item.color && item.color !== "sin definir" && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.color}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[item._presupuesto.estado] || "bg-slate-100 text-slate-600"}`}>
              {item._presupuesto.estado}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {item._presupuesto.numero_presupuesto}
            {item._presupuesto.cliente ? ` · ${item._presupuesto.cliente}` : ""}
          </p>
          {/* Barra de progreso */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, porcentaje)}%` }} />
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              {item.cantidad_comprada}/{item.cantidad_total} {item.unidad_medida}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900">${(item.costo_pendiente).toLocaleString()}</p>
          <p className="text-xs text-slate-500">pendiente</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={() => onComprar(item)} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-2">
            <ShoppingCart className="w-3 h-3 mr-1" /> Comprar
          </Button>
          {item.compras_historico.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Historial de compras */}
      {expanded && item.compras_historico.length > 0 && (
        <div className="border-t bg-slate-50 px-4 py-2 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Historial de compras</p>
          {item.compras_historico.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>{h.fecha}</span>
                {h.proveedor && <span className="text-slate-400">· {h.proveedor}</span>}
              </div>
              <span className="font-medium">{h.cantidad} {item.unidad_medida} {h.precio_unitario ? `· $${h.precio_unitario}/u` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AccountsPayablePage() {
  const { currentUser, userLocation, userRole, isLoading: isSessionLoading } = useSession();

  const [payables, setPayables] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [opPayments, setOpPayments] = useState([]);
  const [opEmployees, setOpEmployees] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayable, setEditingPayable] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [installmentsFor, setInstallmentsFor] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [comprandoMaterial, setComprandoMaterial] = useState(null);
  const [filtroEstadoPres, setFiltroEstadoPres] = useState("all");

  useEffect(() => {
    if (!isSessionLoading) loadData();
  }, [isSessionLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPayables, allSuppliers, allLocations, allOpPayments, allEmployees, allPresupuestos, allInventario] = await Promise.all([
        AccountPayable.list("-created_date", 500),
        Supplier.list(),
        Location.list(),
        localClient.entities.Payment.list('-payment_date'),
        localClient.entities.Employee.list(),
        Presupuesto.list("-created_date", 200),
        Inventario.list("-updated_date", 300),
      ]);
      setPayables(allPayables || []);
      setSuppliers(allSuppliers || []);
      setLocations(allLocations || []);
      setOpPayments((allOpPayments || []).filter(p => p.status === 'registrado'));
      setOpEmployees(allEmployees || []);
      setPresupuestos((allPresupuestos || []).filter(p => p.estado !== 'rechazado'));
      setInventario(allInventario || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  // Materiales pendientes de comprar extraídos de presupuestos
  const materialesPendientes = useMemo(() => {
    const result = [];
    for (const pres of presupuestos) {
      for (const mat of (pres.materiales_calculados || [])) {
        const pendiente = (mat.cantidad_total || 0) - (mat.cantidad_comprada || 0);
        if (pendiente > 0.001) {
          result.push({
            _presupuesto: { id: pres.id, numero_presupuesto: pres.numero_presupuesto, cliente: pres.cliente, estado: pres.estado },
            materia_prima_id: mat.materia_prima_id,
            nombre: mat.nombre,
            color: mat.color,
            unidad_medida: mat.unidad_medida,
            precio_unitario: mat.precio_unitario || 0,
            cantidad_total: mat.cantidad_total || 0,
            cantidad_comprada: mat.cantidad_comprada || 0,
            cantidad_pendiente: pendiente,
            costo_pendiente: pendiente * (mat.precio_unitario || 0),
            compras_historico: mat.compras_historico || [],
          });
        }
      }
    }
    return result;
  }, [presupuestos]);

  const materialesFiltrados = useMemo(() => {
    if (filtroEstadoPres === "all") return materialesPendientes;
    return materialesPendientes.filter(m => m._presupuesto.estado === filtroEstadoPres);
  }, [materialesPendientes, filtroEstadoPres]);

  const totalPendienteMateriales = materialesFiltrados.reduce((s, m) => s + m.costo_pendiente, 0);

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

  const handleEdit = (payable) => { setEditingPayable(payable); setShowForm(true); };

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

  const handlePayment = (payable) => setPaymentModalData(payable);

  const handlePaymentConfirm = async (paymentData) => {
    try {
      const payable = paymentModalData;
      const newPaidAmount = payable.paid_amount + paymentData.amount;
      const newPendingAmount = payable.total_amount - newPaidAmount;
      const newStatus = newPendingAmount <= 0 ? "paid" : "partial";

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
        await PayablePayment.update(payment.id, { expense_id: expense.id });
      }

      if (payable._isOperario) {
        await localClient.entities.Payment.update(payable._opPaymentId, { status: 'ejecutado' });
      } else {
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

  // Registrar compra de materia prima desde presupuesto
  const handleComprarMaterial = async ({ cantidad, precioUnitario, proveedor }) => {
    const item = comprandoMaterial;
    try {
      const pres = presupuestos.find(p => p.id === item._presupuesto.id);
      if (!pres) throw new Error("Presupuesto no encontrado");

      const exceso = Math.max(0, cantidad - item.cantidad_pendiente);

      // 1. Actualizar materiales_calculados del presupuesto
      const materialesActualizados = (pres.materiales_calculados || []).map(mat => {
        if (mat.materia_prima_id === item.materia_prima_id && mat.color === item.color) {
          const nuevaCantComprada = (mat.cantidad_comprada || 0) + cantidad;
          return {
            ...mat,
            cantidad_comprada: nuevaCantComprada,
            comprado: nuevaCantComprada >= (mat.cantidad_total || 0),
            compras_historico: [
              ...(mat.compras_historico || []),
              {
                fecha: new Date().toISOString().split('T')[0],
                cantidad,
                proveedor: proveedor || "",
                precio_unitario: precioUnitario,
              }
            ]
          };
        }
        return mat;
      });

      await Presupuesto.update(pres.id, { materiales_calculados: materialesActualizados });

      // 2. Si hay exceso, añadir al inventario de materias primas
      if (exceso > 0.001) {
        const movimiento = {
          id: `mov_${Date.now()}`,
          fecha: new Date().toISOString().split('T')[0],
          tipo: 'entrada',
          cantidad: exceso,
          referencia: item._presupuesto.numero_presupuesto,
          nota: `Excedente de compra — ${item._presupuesto.numero_presupuesto}`,
        };

        const existing = inventario.find(i =>
          i.materia_prima_id === item.materia_prima_id &&
          (i.color || '') === (item.color || '')
        );

        if (existing) {
          await Inventario.update(existing.id, {
            cantidad_disponible: (existing.cantidad_disponible || 0) + exceso,
            movimientos: [...(existing.movimientos || []), movimiento],
          });
        } else {
          await Inventario.create({
            materia_prima_id: item.materia_prima_id,
            materia_prima_nombre: item.nombre,
            color: item.color || '',
            unidad_medida: item.unidad_medida || 'unidad',
            cantidad_disponible: exceso,
            movimientos: [movimiento],
          });
        }
      }

      await loadData();
      setComprandoMaterial(null);
    } catch (error) {
      console.error("Error registrando compra:", error);
      alert("Error al registrar la compra");
    }
  };

  const isNomina = p => p._isOperario || p.type === "manufacturing_salary" || p.category === "salarios_manufactura";

  const allPending = [
    ...payables.filter(p => p.status === "pending" || p.status === "partial"),
    ...operarioPayables,
  ];
  const pendingPayables = allPending.filter(p => typeFilter === "all" ? true : isNomina(p));
  const paidPayables = payables.filter(p => p.status === "paid").filter(p => typeFilter === "all" ? true : isNomina(p));
  const overduePayables = allPending.filter(p => new Date(p.due_date) < new Date()).filter(p => typeFilter === "all" ? true : isNomina(p));

  const totalPending = pendingPayables.reduce((sum, p) => sum + (p.pending_amount || 0), 0);
  const totalOverdue = overduePayables.reduce((sum, p) => sum + (p.pending_amount || 0), 0);

  if (isSessionLoading || isLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
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

        {/* Alerta vencidas */}
        {overduePayables.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Tienes {overduePayables.length} cuenta(s) vencida(s) por ${totalOverdue.toLocaleString()}
            </AlertDescription>
          </Alert>
        )}

        {/* Formulario */}
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
            <TabsTrigger value="pending">Pendientes ({pendingPayables.length})</TabsTrigger>
            <TabsTrigger value="materiales" className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              Materias Primas
              {materialesPendientes.length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {materialesPendientes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="paid">Pagadas ({paidPayables.length})</TabsTrigger>
            <TabsTrigger value="all">Todas ({payables.length + operarioPayables.length})</TabsTrigger>
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

          {/* ─── Tab Materias Primas ─────────────────────────────────────── */}
          <TabsContent value="materiales" className="mt-3 sm:mt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-slate-600">
                  {materialesFiltrados.length} material(es) pendiente(s) de comprar
                  {totalPendienteMateriales > 0 && <> · <strong>${totalPendienteMateriales.toLocaleString()}</strong> estimado</>}
                </p>
              </div>
              <Select value={filtroEstadoPres} onValueChange={setFiltroEstadoPres}>
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder="Estado presupuesto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {materialesFiltrados.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin materias primas pendientes</p>
                <p className="text-sm mt-1">Todos los materiales de los presupuestos están comprados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {materialesFiltrados.map((item, idx) => (
                  <MaterialPendienteRow
                    key={`${item._presupuesto.id}_${item.materia_prima_id}_${item.color}_${idx}`}
                    item={item}
                    onComprar={setComprandoMaterial}
                  />
                ))}
              </div>
            )}
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

      {/* Modal de pago normal */}
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
          onClose={() => setInstallmentsFor(null)}
          onSaved={loadData}
        />
      )}

      {/* Modal comprar material */}
      {comprandoMaterial && (
        <ComprarMaterialModal
          item={comprandoMaterial}
          onConfirm={handleComprarMaterial}
          onCancel={() => setComprandoMaterial(null)}
        />
      )}
    </div>
  );
}
