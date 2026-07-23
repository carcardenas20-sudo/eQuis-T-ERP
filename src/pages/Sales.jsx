import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sale } from "@/entities/Sale";
import { SaleItem } from "@/entities/SaleItem";
import { Payment } from "@/entities/Payment";
import { Credit } from "@/entities/Credit";
import { Inventory } from "@/entities/Inventory";
import { InventoryMovement } from "@/entities/InventoryMovement";
import { Location } from "@/entities/Location";

import { FileText, Calendar, DollarSign, Package, Filter, Search, Building2 } from "lucide-react"; // Added Building2
import { useSession } from "../components/providers/SessionProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Stagger, StaggerItem, FadeIn, scaleIn } from "@/components/motion";
import KpiCard from "@/components/ui/KpiCard";
import SalesTable from "../components/sales/SalesTable";
import SalesMobileList from "../components/sales/SalesMobileList";
import SaleDetailModal from "../components/sales/SaleDetailModal";
import EditSaleModal from "../components/sales/EditSaleModal";

const fmtMoney = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sesión centralizada
  const { currentUser, permissions, userRole, userLocation: sessionLocation, isLoading: isSessionLoading } = useSession();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    location: "all",
    paymentMethod: "all",
    sort: "date_desc",
    dateRange: "month", // por defecto solo el último mes → carga rápida (antes bajaba TODO)
    customStartDate: today,
    customEndDate: today
  });

  // Cuántas ventas traer. Empieza en 300; "Cargar más" lo sube.
  const [limit, setLimit] = useState(300);
  // Volver al límite base SOLO cuando cambia algo que se pide al servidor
  // (período/estado/sucursal). Búsqueda, medio de pago y orden NO tocan el servidor.
  useEffect(() => {
    setLimit(300);
  }, [filters.dateRange, filters.status, filters.location, filters.customStartDate, filters.customEndDate]);

  // Aplicar sucursal por defecto para usuarios sin permiso de ver todas
  useEffect(() => {
    if (!isSessionLoading) {
      const hasAllLocations = Boolean(permissions?.includes("sales_view_all_locations") || (currentUser?.role === "admin") || (userRole?.name?.toLowerCase().includes("admin")));
      if (!hasAllLocations && sessionLocation?.id) {
        setFilters(prev => ({ ...prev, location: sessionLocation.id }));
      }
    }
  }, [isSessionLoading, permissions, currentUser, userRole, sessionLocation]);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      let salesFilter = {};

      // ✅ CRÍTICO: Restringir por sucursal si no tiene permiso global
      const hasAllLocations = Boolean(permissions?.includes("sales_view_all_locations") || (currentUser?.role === "admin") || (userRole?.name?.toLowerCase().includes("admin")));
      if (!hasAllLocations && (sessionLocation?.id || currentUser?.location_id)) {
        salesFilter.location_id = sessionLocation?.id || currentUser?.location_id;
        console.log("🔒 Usuario restringido - Forzando filtro de sucursal:", salesFilter.location_id);
      } else if (filters.location !== "all") {
        salesFilter.location_id = filters.location;
      }

      // Rango de fechas EN EL SERVIDOR (antes se bajaba TODO y se filtraba en el
      // navegador → lento y gastaba mucho de Neon). Ahora la base manda solo el período.
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); };
      let desde = null, hasta = null;
      if (filters.dateRange === 'today') { desde = todayStr; hasta = todayStr; }
      else if (filters.dateRange === 'week') { desde = diasAtras(7); hasta = todayStr; }
      else if (filters.dateRange === 'month') { desde = diasAtras(30); hasta = todayStr; }
      else if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) { desde = filters.customStartDate; hasta = filters.customEndDate; }
      // Al BUSCAR, se ignora el período (para encontrar aunque no sea del último mes).
      if (desde && hasta && !filters.search) {
        salesFilter.sale_date = { $gte: `${desde}T00:00:00`, $lte: `${hasta}T23:59:59` };
      }

      if (filters.status !== "all") {
        salesFilter.status = filters.status;
      }

      // Traer SOLO hasta 'limit' registros, ya ordenados por fecha de venta en el servidor.
      // La búsqueda, el medio de pago y el orden se aplican DESPUÉS en memoria (ver
      // visibleSales) para no golpear el servidor en cada tecla/cambio.
      const salesData = await Sale.filter(salesFilter, "-sale_date", limit);
      setSales(salesData);
    } catch (error) {
      console.error("Error loading sales:", error);
    }
    setIsLoading(false);
  }, [filters.dateRange, filters.status, filters.location, filters.customStartDate, filters.customEndDate, currentUser, permissions, userRole, sessionLocation, limit]);

  useEffect(() => {
    // ✅ Cargar ventas cuando sesión esté lista (loadSales ya depende de período/estado/sucursal)
    if (!isSessionLoading) {
      loadSales();
    }
  }, [loadSales, isSessionLoading]);

  // Búsqueda + medio de pago + orden: TODO en memoria sobre lo ya cargado → instantáneo,
  // cero peticiones de red al filtrar. Aquí estaba la lentitud real (una petición por tecla).
  const visibleSales = useMemo(() => {
    let list = sales;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(v =>
        v.customer_name?.toLowerCase().includes(s) ||
        v.invoice_number?.toLowerCase().includes(s) ||
        v.customer_phone?.toLowerCase().includes(s)
      );
    }
    if (filters.paymentMethod !== "all") {
      list = list.filter(v =>
        Array.isArray(v.payment_methods) &&
        v.payment_methods.some(m => m.method === filters.paymentMethod)
      );
    }
    return [...list].sort((a, b) => {
      if (filters.sort === 'amount_desc') return (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0);
      if (filters.sort === 'amount_asc') return (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
      const da = new Date(a.sale_date || a.created_date).getTime() || 0;
      const db = new Date(b.sale_date || b.created_date).getTime() || 0;
      if (db !== da) return db - da;
      return (new Date(b.created_date).getTime() || 0) - (new Date(a.created_date).getTime() || 0);
    });
  }, [sales, filters.search, filters.paymentMethod, filters.sort]);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const locs = await Location.list();
        setLocations(locs);
      } catch (error) {
        console.error("Error loading locations:", error);
      }
    };
    loadLocations();
  }, []);

  const handleViewDetail = async (sale) => {
    try {
      // Load sale items for the selected sale
      const saleItems = await SaleItem.filter({ sale_id: sale.id });
      setSelectedSale({ ...sale, items: saleItems });
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading sale details:", error);
    }
  };

  const handleEditSale = (sale) => {
    setEditingSale(sale);
    setShowEditModal(true);
  };

  const handleSaveEditedSale = async (editedData) => {
    setIsProcessing(true);
    try {
      // Determine the sale status based on payment methods
      const newStatus = editedData.payment_methods.some(p => p.method === 'credit') ? 'credit' : 'completed';

      // Update the sale with new basic info
      const updatedSale = await Sale.update(editingSale.id, {
        sale_date: editedData.sale_date,
        customer_name: editedData.customer_name,
        customer_phone: editedData.customer_phone,
        customer_document: editedData.customer_document,
        notes: editedData.notes,
        payment_methods: editedData.payment_methods, // Store payment methods as part of the sale document
        status: newStatus
      });

      // Borrar SOLO los pagos propios de la venta. Los abonos al crédito
      // (type 'credit_payment') son pagos aparte del cliente y NO se deben borrar:
      // hacerlo perdía el efectivo abonado y descuadraba la caja.
      const existingPayments = await Payment.filter({ sale_id: editingSale.id });
      for (const payment of existingPayments) {
        if (payment.type === 'credit_payment') continue; // conservar abonos
        await Payment.delete(payment.id);
      }

      // Create new payment records (excluding credit and courtesy)
      for (const paymentMethod of editedData.payment_methods) {
        if (paymentMethod.method !== 'credit' && paymentMethod.method !== 'courtesy') {
          await Payment.create({
            sale_id: editingSale.id,
            payment_date: editedData.sale_date, // Use the edited sale_date for payments
            amount: paymentMethod.amount,
            method: paymentMethod.method,
            reference: paymentMethod.reference,
            bank_account_id: paymentMethod.bank_account,
            type: "new_sale",
            location_id: editingSale.location_id // Use original sale's location
          });
        }
      }

      // Manejo del crédito — CONSERVANDO lo ya abonado.
      // Antes se borraba el crédito y se creaba uno nuevo con el saldo COMPLETO,
      // ignorando los abonos → la deuda del cliente se inflaba. Ahora se actualiza
      // el crédito existente (conserva su id y sus abonos vinculados) preservando paid_amount.
      const existingCredits = await Credit.filter({ sale_id: editingSale.id });
      const hasNewCredit = editedData.payment_methods.some(p => p.method === 'credit');
      const creditPaymentMethod = editedData.payment_methods.find(p => p.method === 'credit');
      const creditAmount = creditPaymentMethod ? creditPaymentMethod.amount : 0;

      if (hasNewCredit) {
        const dueDate = new Date(editedData.sale_date);
        dueDate.setDate(dueDate.getDate() + 30); // 30 días desde la fecha editada
        const existing = existingCredits[0];
        const alreadyPaid = existing ? (Number(existing.paid_amount) || 0) : 0;
        const paid = Math.min(alreadyPaid, creditAmount);
        const pending = Math.max(0, creditAmount - paid);
        const creditFields = {
          customer_id: editedData.customer_id || editingSale.customer_id || null,
          customer_name: editedData.customer_name,
          customer_phone: editedData.customer_phone,
          total_amount: creditAmount,
          paid_amount: paid,
          pending_amount: pending,
          due_date: dueDate.toISOString().split('T')[0],
          status: pending <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending'),
          location_id: editingSale.location_id,
          notes: `Crédito editado - Factura #${editingSale.invoice_number || editingSale.id}`
        };
        if (existing) {
          // Actualizar el crédito existente (mantiene su id → los abonos siguen vinculados)
          await Credit.update(existing.id, creditFields);
          for (const c of existingCredits.slice(1)) await Credit.delete(c.id); // limpiar duplicados si los hubiera
        } else {
          await Credit.create({ sale_id: editingSale.id, ...creditFields });
        }
      } else {
        // La venta ya no es a crédito: eliminar los créditos previos
        for (const credit of existingCredits) {
          await Credit.delete(credit.id);
        }
      }

      // Reload sales data
      await loadSales();

      setShowEditModal(false);
      setEditingSale(null);

      alert("¡Venta actualizada exitosamente! Los cambios se reflejarán en todos los módulos.");

    } catch (error) {
      console.error("Error updating sale:", error);
      alert("Error al actualizar la venta. Por favor, intenta de nuevo.");
    }
    setIsProcessing(false);
  };

  const handleDeleteSale = async (saleToDelete) => {
    const confirmationMessage = `
      ¿Estás seguro de que quieres ANULAR esta factura?

      Factura: #${saleToDelete.invoice_number || saleToDelete.id}
      Cliente: ${saleToDelete.customer_name}
      Total: $${saleToDelete.total_amount.toLocaleString()}

      Esta acción es IRREVERSIBLE y hará lo siguiente:
      1. Restaurará el inventario de los productos vendidos.
      2. Eliminará todos los pagos y créditos asociados.
      3. Eliminará la factura permanentemente.
    `;

    if (window.confirm(confirmationMessage)) {
      setIsProcessing(true);
      try {
        // 1. Find all sale items for this sale
        const saleItems = await SaleItem.filter({ sale_id: saleToDelete.id });

        // 2. Restore inventory and create reversal movements for each item
        for (const item of saleItems) {
          const inventoryRecord = await Inventory.filter({
            product_id: item.product_id,
            location_id: saleToDelete.location_id
          });

          if (inventoryRecord.length > 0) {
            const currentInventory = inventoryRecord[0];
            await Inventory.update(currentInventory.id, {
              current_stock: currentInventory.current_stock + item.quantity
            });
          } else {
            // No existía fila de inventario: crearla para devolver el stock.
            // Antes se saltaba en silencio → el inventario quedaba descuadrado hacia abajo.
            await Inventory.create({
              product_id: item.product_id,
              location_id: saleToDelete.location_id,
              current_stock: item.quantity
            });
          }

          // Movimiento de reversión — SIEMPRE se registra (exista o no la fila).
          await InventoryMovement.create({
            product_id: item.product_id,
            location_id: saleToDelete.location_id,
            movement_type: "return", // stock que regresa
            quantity: item.quantity,
            reference_id: saleToDelete.id,
            reason: `Anulación de factura #${saleToDelete.invoice_number || saleToDelete.id}`,
            movement_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
          });
          // Delete the sale item record
          await SaleItem.delete(item.id);
        }

        // 3. Delete associated payments
        const payments = await Payment.filter({ sale_id: saleToDelete.id });
        for (const payment of payments) {
          await Payment.delete(payment.id);
        }

        // 4. Delete associated credits
        const credits = await Credit.filter({ sale_id: saleToDelete.id });
        for (const credit of credits) {
          await Credit.delete(credit.id);
        }

        // 5. Finally, delete the sale itself
        await Sale.delete(saleToDelete.id);

        await loadSales(); // Refresh the sales list
        alert("¡Factura anulada exitosamente! El inventario y los pagos han sido revertidos.");

      } catch (error) {
        console.error("Error deleting sale:", error);
        alert("Ocurrió un error al anular la factura. Por favor, intenta de nuevo.");
      }
      setIsProcessing(false);
    }
  };

  // Calculate summary stats (sobre lo que se está viendo)
  const totalSales = visibleSales.length;
  const totalRevenue = visibleSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const completedSales = visibleSales.filter(sale => sale.status === 'completed').length;

  // ✅ Determinar si el usuario puede ver todas las sucursales
  const isAdmin = Boolean(permissions?.includes("sales_view_all_locations") || (currentUser?.role === "admin") || (userRole?.name?.toLowerCase().includes("admin")));

  // ¿Puede ANULAR ventas? Mismo criterio que valida el servidor (RBAC). Si no, se oculta el botón.
  const canDeleteSales = Boolean(
    (currentUser?.role === "admin") ||
    permissions?.includes("sales_cancel") ||
    permissions?.includes("pos_delete_sales")
  );

  // ¿Puede EDITAR ventas? Igual, alineado con el gate del servidor.
  const canEditSales = Boolean(
    (currentUser?.role === "admin") ||
    permissions?.includes("sales_edit") ||
    permissions?.includes("pos_edit_sales")
  );

  return (
    <div className="p-4 lg:p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <FadeIn>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Historial de Ventas</h1>
            <p className="text-slate-600 mt-1">
              Consulta y analiza todas las transacciones (Hora local).
            </p>
            {/* ✅ Mostrar sucursal si es usuario sin permiso global */}
            {!isAdmin && sessionLocation && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <Building2 className="w-4 h-4" />
                <span>Viendo ventas de: <strong>{sessionLocation.name}</strong></span>
              </div>
            )}
          </FadeIn>
          <Button
            variant="outline"
            onClick={loadSales}
            className="gap-2 w-full lg:w-auto"
            disabled={isLoading || isProcessing}
          >
            <Filter className="w-4 h-4" />
            {isLoading || isProcessing ? "Cargando..." : "Refrescar"}
          </Button>
        </div>

        {/* Summary Stats */}
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6" stagger={0.08}>
          {[
            { label: "Total Ventas", value: totalSales, sub: `${completedSales} completadas`, Icon: FileText, tone: "blue" },
            { label: "Ingresos Totales", value: totalRevenue, format: fmtMoney, Icon: DollarSign, tone: "emerald" },
            { label: "Ticket Promedio", value: averageTicket, format: fmtMoney, Icon: Calendar, tone: "purple" },
            {
              label: "Ventas Hoy",
              value: visibleSales.filter(s => s.sale_date === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })).length,
              Icon: Package, tone: "amber"
            },
          ].map(({ label, value, sub, format, Icon, tone }) => (
            <StaggerItem key={label} variant={scaleIn}>
              <KpiCard label={label} value={value} sub={sub} format={format} icon={Icon} tone={tone} />
            </StaggerItem>
          ))}
        </Stagger>

        {/* Filters */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-4 lg:p-6 space-y-4">
            {/* Filtros rápidos de período (chips) — más práctico que el desplegable */}
            <div className="flex flex-wrap gap-2">
              {[
                { v: 'all', label: 'Todas' },
                { v: 'today', label: 'Hoy' },
                { v: 'week', label: 'Última semana' },
                { v: 'month', label: 'Último mes' },
                { v: 'custom', label: 'Personalizado' },
              ].map(chip => (
                <button
                  key={chip.v}
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: chip.v }))}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filters.dateRange === chip.v
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por cliente o factura..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>

              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="returned">Devueltas</SelectItem>
                </SelectContent>
              </Select>

              {/* ✅ MODIFICADO: Sucursal solo editable para admin */}
              {isAdmin ? (
                <Select value={filters.location} onValueChange={(value) => setFilters(prev => ({ ...prev, location: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={sessionLocation?.name || "Cargando..."}
                  disabled
                  className="bg-gray-100 text-gray-700"
                  title="Solo puedes ver las ventas de tu sucursal asignada"
                />
              )}

              {/* Medio de pago */}
              <Select value={filters.paymentMethod} onValueChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Medio de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los pagos</SelectItem>
                  <SelectItem value="cash">💵 Efectivo</SelectItem>
                  <SelectItem value="transfer">🏦 Transferencia</SelectItem>
                  <SelectItem value="card">💳 Tarjeta</SelectItem>
                  <SelectItem value="credit">📝 Crédito</SelectItem>
                  <SelectItem value="courtesy">🎁 Cortesía</SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenar */}
              <Select value={filters.sort} onValueChange={(value) => setFilters(prev => ({ ...prev, sort: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Más recientes primero</SelectItem>
                  <SelectItem value="amount_desc">Mayor monto</SelectItem>
                  <SelectItem value="amount_asc">Menor monto</SelectItem>
                </SelectContent>
              </Select>

              {filters.dateRange === 'custom' && (
                <div className="flex gap-2 sm:col-span-2 lg:col-span-1"> {/* Adjusted col-span */}
                  <Input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
                    className="flex-1"
                    title="Fecha de inicio"
                  />
                  <Input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
                    className="flex-1"
                    title="Fecha de fin"
                  />
                </div>
              )}
            </div>

            {/* Si busca y no está en "Todas", ofrecer ampliar a todo el historial */}
            {filters.search && filters.dateRange !== 'all' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Buscando solo en el período seleccionado.{' '}
                <button
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: 'all' }))}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  Buscar en todo el historial
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sales Table - Desktop */}
        <Card className="hidden lg:block shadow-lg border-0 dark:bg-slate-800 dark:border-slate-700">
          <CardContent className="p-0">
            <SalesTable
              sales={visibleSales}
              onViewDetail={handleViewDetail}
              onEditSale={handleEditSale}
              onDeleteSale={handleDeleteSale}
              canDelete={canDeleteSales}
              canEdit={canEditSales}
              isLoading={isLoading}
              isProcessing={isProcessing}
            />
          </CardContent>
        </Card>

        {/* Sales Mobile List */}
        <div className="lg:hidden">
          <SalesMobileList
            sales={visibleSales}
            onViewDetail={handleViewDetail}
            onEditSale={handleEditSale}
            onDeleteSale={handleDeleteSale}
            canDelete={canDeleteSales}
            canEdit={canEditSales}
            isLoading={isLoading}
            onRefresh={loadSales}
          />
        </div>

        {/* Cargar más — solo si llegamos al tope actual (puede haber más) */}
        {!isLoading && sales.length >= limit && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => setLimit(l => l + 300)} disabled={isLoading}>
              Cargar más ventas
            </Button>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {showDetailModal && selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSale(null);
          }}
        />
      )}

      {/* Edit Sale Modal */}
      {showEditModal && editingSale && (
        <EditSaleModal
          sale={editingSale}
          onSave={handleSaveEditedSale}
          onCancel={() => {
            setShowEditModal(false);
            setEditingSale(null);
          }}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}