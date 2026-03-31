import React, { useState, useEffect, useCallback } from "react";
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

import SalesTable from "../components/sales/SalesTable";
import SalesMobileList from "../components/sales/SalesMobileList";
import SaleDetailModal from "../components/sales/SaleDetailModal";
import EditSaleModal from "../components/sales/EditSaleModal";

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

  const today = new Date().toISOString().split('T')[0];

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    location: "all",
    dateRange: "all",
    customStartDate: today,
    customEndDate: today
  });

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

      // ✅ SIMPLIFICADO: Filtro de fecha más directo
      if (filters.dateRange === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        salesFilter.sale_date = { $gte: `${todayStr}T00:00:00`, $lte: `${todayStr}T23:59:59` };
      }

      if (filters.status !== "all") {
        salesFilter.status = filters.status;
      }

      let salesData = await Sale.filter(salesFilter, "-created_date");

      // ✅ Filtrado en cliente para rangos complejos
      if (filters.dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        salesData = salesData.filter(sale => {
          const saleDate = new Date(sale.sale_date || sale.created_date);
          return saleDate >= weekAgo;
        });
      } else if (filters.dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        salesData = salesData.filter(sale => {
          const saleDate = new Date(sale.sale_date || sale.created_date);
          return saleDate >= monthAgo;
        });
      } else if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
        const startDate = new Date(filters.customStartDate + 'T00:00:00');
        const endDate = new Date(filters.customEndDate + 'T23:59:59');

        salesData = salesData.filter(sale => {
          const saleDate = new Date(sale.sale_date || sale.created_date);
          return saleDate >= startDate && saleDate <= endDate;
        });
      }

      // Apply search filter (client-side for now)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        salesData = salesData.filter(sale =>
          sale.customer_name?.toLowerCase().includes(searchLower) ||
          sale.invoice_number?.toLowerCase().includes(searchLower) ||
          sale.customer_phone?.toLowerCase().includes(searchLower)
        );
      }

      setSales(salesData);
    } catch (error) {
      console.error("Error loading sales:", error);
    }
    setIsLoading(false);
  }, [filters, currentUser, permissions, userRole, sessionLocation]);

  useEffect(() => {
    // ✅ Cargar ventas cuando sesión esté lista
    if (!isSessionLoading) {
      loadSales();
    }
  }, [loadSales, isSessionLoading, sessionLocation, filters.location]);

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

      // Delete existing payments for this sale
      const existingPayments = await Payment.filter({ sale_id: editingSale.id });
      for (const payment of existingPayments) {
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

      // Handle credit changes
      const existingCredits = await Credit.filter({ sale_id: editingSale.id });
      const hasNewCredit = editedData.payment_methods.some(p => p.method === 'credit');

      // Delete existing credits
      for (const credit of existingCredits) {
        await Credit.delete(credit.id);
      }

      // Create new credit if needed
      if (hasNewCredit) {
        const creditPaymentMethod = editedData.payment_methods.find(p => p.method === 'credit');
        const creditAmount = creditPaymentMethod ? creditPaymentMethod.amount : 0;
        const dueDate = new Date(editedData.sale_date);
        dueDate.setDate(dueDate.getDate() + 30); // 30 days from the edited sale date

        await Credit.create({
          sale_id: editingSale.id,
          customer_id: editedData.customer_id || editingSale.customer_id || null, // Prioritize edited customer ID, then original, then null
          customer_name: editedData.customer_name, // Use edited customer name
          customer_phone: editedData.customer_phone, // Use edited customer phone
          total_amount: creditAmount,
          pending_amount: creditAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status: "pending",
          location_id: editingSale.location_id, // Use original sale's location
          notes: `Crédito editado - Factura #${editingSale.invoice_number || editingSale.id}`
        });
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

            // Create a reversal inventory movement
            await InventoryMovement.create({
              product_id: item.product_id,
              location_id: saleToDelete.location_id,
              movement_type: "return", // Using 'return' to signify stock coming back in
              quantity: item.quantity, // Positive quantity
              reference_id: saleToDelete.id,
              reason: `Anulación de factura #${saleToDelete.invoice_number || saleToDelete.id}`,
              movement_date: new Date().toISOString().split('T')[0]
            });
          }
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

  // Calculate summary stats
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const completedSales = sales.filter(sale => sale.status === 'completed').length;

  // ✅ Determinar si el usuario puede ver todas las sucursales
  const isAdmin = Boolean(permissions?.includes("sales_view_all_locations") || (currentUser?.role === "admin") || (userRole?.name?.toLowerCase().includes("admin")));

  return (
    <div className="p-4 lg:p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Historial de Ventas</h1>
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
          </div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          {[
            { label: "Total Ventas", value: totalSales, sub: `${completedSales} completadas`, Icon: FileText, cls: "text-slate-900", iconCls: "text-blue-500" },
            { label: "Ingresos Totales", value: `$${totalRevenue.toLocaleString()}`, Icon: DollarSign, cls: "text-green-600", iconCls: "text-green-500" },
            { label: "Ticket Promedio", value: `$${averageTicket.toLocaleString()}`, Icon: Calendar, cls: "text-purple-600", iconCls: "text-purple-500" },
            {
              label: "Ventas Hoy",
              value: sales.filter(s => s.sale_date === new Date().toISOString().split('T')[0]).length,
              Icon: Package, cls: "text-orange-600", iconCls: "text-orange-500"
            },
          ].map(({ label, value, sub, Icon, cls, iconCls }) => (
            <Card key={label} className="shadow-sm border-0">
              <CardHeader className="pb-2 pt-3 px-3 sm:px-6 sm:pb-3 sm:pt-6">
                <div className="flex items-center justify-between gap-1">
                  <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 leading-tight">{label}</CardTitle>
                  <Icon className={`w-4 h-4 shrink-0 ${iconCls}`} />
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                <div className={`text-xl sm:text-2xl font-bold tabular-nums break-all ${cls}`}>{value}</div>
                {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-4 lg:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

              <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="month">Último Mes</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
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
          </CardContent>
        </Card>

        {/* Sales Table - Desktop */}
        <Card className="hidden lg:block shadow-lg border-0 dark:bg-slate-800 dark:border-slate-700">
          <CardContent className="p-0">
            <SalesTable
              sales={sales}
              onViewDetail={handleViewDetail}
              onEditSale={handleEditSale}
              onDeleteSale={handleDeleteSale}
              isLoading={isLoading}
              isProcessing={isProcessing}
            />
          </CardContent>
        </Card>

        {/* Sales Mobile List */}
        <div className="lg:hidden">
          <SalesMobileList
            sales={sales}
            onViewDetail={handleViewDetail}
            onEditSale={handleEditSale}
            onDeleteSale={handleDeleteSale}
            isLoading={isLoading}
            onRefresh={loadSales}
          />
        </div>
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