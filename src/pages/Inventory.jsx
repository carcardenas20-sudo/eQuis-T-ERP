import React, { useState, useEffect, useCallback } from "react";
import { Inventory } from "@/entities/Inventory";
import { Product } from "@/entities/Product";
import { Location } from "@/entities/Location";
import { User } from "@/entities/User"; // Added User entity
import { Package, TrendingDown, TrendingUp, Loader2, RefreshCw, Building2 } from "lucide-react"; // Added Building2 icon
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { Alert, AlertDescription } from "@/components/ui/alert"; // Added Alert components

import InventoryTable from "../components/inventory/InventoryTable";
import InventoryMobileList from "../components/inventory/InventoryMobileList";
import StockAdjustmentModal from "../components/inventory/StockAdjustmentModal";
import InventoryMovements from "../components/inventory/InventoryMovements";

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // New state for current user
  const [userLocation, setUserLocation] = useState(null); // New state for user's assigned location
  const [isLoading, setIsLoading] = useState(true);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // Keeping selectedItem as per existing handlers
  const [activeTab, setActiveTab] = useState("inventory");
  const [filters, setFilters] = useState({
    search: "",
    location: "all",
    stock: "all" // Changed from stockLevel to stock as per outline
  });

  // Removed invoice related states (availableInvoices, showInvoiceRestoreModal, invoiceIdToRestore, isRestoring)

  const loadData = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const [inventoryData, productsData, locationsData] = await Promise.all([
        Inventory.list(), // Outline changed this from Inventory.list("-updated_date")
        Product.filter({ is_active: true }), // Outline changed from Product.list()
        Location.filter({ is_active: true }) // Outline changed from Location.list()
      ]);

      // Enrich inventory with product and location data first
      let enrichedAndFilteredInventory = inventoryData.map(item => {
        const product = productsData.find(p => p.sku === item.product_id);
        const location = locationsData.find(l => l.id === item.location_id);
        return { ...item, product, location };
      });

      // ✅ CRÍTICO: Filtrar inventario por sucursal para usuarios no-admin
      const isAdmin = currentUser.role === 'admin';
      
      // Apply location filter
      if (!isAdmin && currentUser.location_id) {
        // If not admin, force filter by user's assigned location
        enrichedAndFilteredInventory = enrichedAndFilteredInventory.filter(inv => inv.location_id === currentUser.location_id);
        console.log("🔒 Inventario - Usuario NO-admin, mostrando solo sucursal:", currentUser.location_id);
      } else if (filters.location !== "all") {
        // If admin, apply selected filter location
        enrichedAndFilteredInventory = enrichedAndFilteredInventory.filter(inv => inv.location_id === filters.location);
      }

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        enrichedAndFilteredInventory = enrichedAndFilteredInventory.filter(inv => {
          return inv.product?.name?.toLowerCase().includes(searchLower) ||
                 inv.product?.sku?.toLowerCase().includes(searchLower);
        });
      }

      // Apply stock level filter (using current_stock as per typical entity structure)
      if (filters.stock !== "all") {
        enrichedAndFilteredInventory = enrichedAndFilteredInventory.filter(inv => {
          if (filters.stock === "in_stock") return inv.current_stock > 0;
          if (filters.stock === "out_of_stock") return inv.current_stock === 0;
          if (filters.stock === "low_stock") {
            // Check if stock is low but not out of stock
            return inv.current_stock > 0 && inv.current_stock <= (inv.product?.minimum_stock || 5);
          }
          return true; // Should not happen with valid filters
        });
      }

      setInventory(enrichedAndFilteredInventory); // Inventory state now holds filtered & enriched data
      setProducts(productsData);
      setLocations(locationsData);
      // Removed setAvailableInvoices (related to sales/invoices)
    } catch (error) {
      console.error("Error loading inventory data:", error);
    }
    setIsLoading(false);
  }, [filters, currentUser]); // Added currentUser to dependencies

  // New useEffect to load user data and set initial filters
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await User.me(); // Fetch current user
        setCurrentUser(user);
        
        // ✅ FORZAR filtro de sucursal para usuarios no-admin
        if (user.role !== 'admin' && user.location_id) {
          const locs = await Location.filter({ is_active: true });
          const loc = locs.find(l => l.id === user.location_id);
          setUserLocation(loc);
          // Force location filter to user's assigned location
          setFilters(prev => ({ ...prev, location: user.location_id }));
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setCurrentUser(null); // Handle case where user cannot be loaded
      }
    };
    
    loadUserData();
  }, []); // Run only once on mount

  useEffect(() => {
    if (currentUser) { // Only load data once currentUser is available
      loadData();
    }
  }, [loadData, currentUser]); // Depends on loadData and currentUser

  const handleStockAdjustment = (item) => {
    setSelectedItem(item);
    setShowAdjustmentModal(true);
  };

  const handleSaveAdjustment = async (adjustmentData) => {
    try {
      await Inventory.update(selectedItem.id, {
        current_stock: adjustmentData.newStock,
        last_movement_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      });
      setShowAdjustmentModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error("Error updating inventory:", error);
    }
  };

  // Removed handleRestoreInventoryFromInvoice (related to sales/invoices)

  // Calculations for stats cards now use the 'inventory' state directly, which is already filtered and enriched.
  const totalProducts = inventory.length;
  const lowStockItems = inventory.filter(item => 
    item.current_stock <= (item.product?.minimum_stock || 5) && item.current_stock > 0
  ).length;
  const outOfStockItems = inventory.filter(item => item.current_stock === 0).length;
  const totalStockValue = inventory.reduce((sum, item) => 
    sum + (item.current_stock * (item.product?.base_cost || 0)), 0
  );

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Control de Inventario</h1> {/* Title changed */}
            <p className="text-slate-600 mt-1">
              Monitorea y ajusta el stock de productos en tus sucursales. {/* Description changed */}
            </p>
            {/* ✅ NUEVO: Mostrar sucursal si es usuario no-admin */}
            {!isAdmin && userLocation && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <Building2 className="w-4 h-4" />
                <span>Viendo inventario de: <strong>{userLocation.name}</strong></span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {/* Removed the "Restaurar Inventario por Factura" button and its logic */}
            <Button
              variant="outline"
              onClick={loadData}
              className="gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isLoading ? "Cargando..." : "Refrescar"}
            </Button>
          </div>
        </div>

        {/* ✅ NUEVO: Alerta para usuarios no-admin */}
        {!isAdmin && userLocation && (
          <Alert className="border-blue-200 bg-blue-50">
            <Building2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              Estás viendo únicamente el inventario de tu sucursal: <strong>{userLocation.name}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "inventory"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            Stock Actual
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "movements"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Movimientos
          </button>
        </div>

        {activeTab === "inventory" && (
          <>
            {/* Stats Cards - these use 'inventory' state directly now */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="shadow-lg border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Productos</CardTitle>
                    <Package className="w-4 h-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{totalProducts}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Stock Bajo</CardTitle>
                    <TrendingDown className="w-4 h-4 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{lowStockItems}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Sin Stock</CardTitle>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Valor Total</CardTitle>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="shadow-lg border-0">
              <CardContent className="p-3 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  <Input
                    placeholder="Buscar producto..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full"
                  />
                  
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
                      value={userLocation?.name || "Cargando..."} 
                      disabled 
                      className="bg-gray-100 text-gray-700"
                      title="Solo puedes ver el inventario de tu sucursal asignada"
                    />
                  )}

                  <Select value={filters.stock} onValueChange={(value) => setFilters(prev => ({ ...prev, stock: value }))}> {/* Changed from stockLevel to stock */}
                    <SelectTrigger>
                      <SelectValue placeholder="Nivel de stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Niveles</SelectItem>
                      <SelectItem value="in_stock">En Stock</SelectItem>
                      <SelectItem value="low_stock">Stock Bajo</SelectItem>
                      <SelectItem value="out_of_stock">Sin Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Table - Desktop */}
            <Card className="hidden lg:block shadow-lg border-0 dark:bg-slate-800 dark:border-slate-700">
              <CardContent className="p-0">
                <InventoryTable
                  inventory={inventory}
                  onStockAdjustment={handleStockAdjustment}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>

            {/* Inventory Mobile List */}
            <div className="lg:hidden">
              <InventoryMobileList
                inventory={inventory}
                onStockAdjustment={handleStockAdjustment}
                isLoading={isLoading}
                onRefresh={loadData}
              />
            </div>
          </>
        )}

        {activeTab === "movements" && (
          <InventoryMovements 
            products={products}
            locations={locations}
            onRefresh={loadData}
          />
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <StockAdjustmentModal
          item={selectedItem}
          onSave={handleSaveAdjustment}
          onCancel={() => {
            setShowAdjustmentModal(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Removed Invoice Restore Modal entirely */}
      {/* The original file had a dialog for this, which is now removed */}
    </div>
  );
}