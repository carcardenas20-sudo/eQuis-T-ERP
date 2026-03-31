import React, { useState, useEffect, useCallback } from "react";
import { Purchase, PurchaseItem, Product, Supplier, Location, Inventory } from "@/entities/all";
import { InventoryMovement } from "@/entities/InventoryMovement";
import { Plus, ShoppingBag, Package, TrendingUp, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import PurchaseList from "../components/purchases/PurchaseList";
import PurchaseForm from "../components/purchases/PurchaseForm";
import PurchaseDetailModal from "../components/purchases/PurchaseDetailModal";
import SupplierList from "../components/purchases/SupplierList";
import FormularioProveedor from "../components/proveedores/FormularioProveedor";
import {
  getCurrentDateString
} from "../components/utils/dateUtils";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("purchases");
  
  // Purchase modal states
  const [isPurchaseFormOpen, setIsPurchaseFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  
  // Supplier modal states  
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  
  // Filters
  const [purchaseFilters, setPurchaseFilters] = useState({
    search: "",
    status: "all",
    supplier: "all",
    location: "all",
    dateRange: "month"
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [purchasesData, suppliersData, productsData, locationsData] = await Promise.all([
        Purchase.list("-purchase_date"),
        Supplier.list(),
        Product.list(),
        Location.list(),
      ]);
      setPurchases(purchasesData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setLocations(locationsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await Supplier.list();
      setSuppliers(data);
    } catch (e) {
      console.error("Error recargando proveedores:", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "suppliers") {
      loadSuppliers();
    }
  }, [activeTab, loadSuppliers]);

  // Purchase handlers
  const handleOpenPurchaseForm = (purchase = null) => {
    setEditingPurchase(purchase);
    setIsPurchaseFormOpen(true);
  };

  const handleSavePurchase = async (purchaseData) => {
    try {
      if (editingPurchase) {
        // Check if location changed
        const locationChanged = editingPurchase.location_id !== purchaseData.location_id;

        if (locationChanged && editingPurchase.status === 'received') {
          // Get all items for this purchase
          const purchaseItems = await PurchaseItem.filter({ purchase_id: editingPurchase.id });

          // Revert inventory from old location
          for (const item of purchaseItems) {
            const oldInventory = await Inventory.filter({
              product_id: item.product_id,
              location_id: editingPurchase.location_id
            });

            if (oldInventory.length > 0) {
              const inv = oldInventory[0];
              await Inventory.update(inv.id, {
                current_stock: Math.max(0, inv.current_stock - item.quantity_received),
                last_movement_date: getCurrentDateString()
              });
            }

            // Add inventory to new location
            const newInventory = await Inventory.filter({
              product_id: item.product_id,
              location_id: purchaseData.location_id
            });

            if (newInventory.length > 0) {
              const inv = newInventory[0];
              await Inventory.update(inv.id, {
                current_stock: inv.current_stock + item.quantity_received,
                last_movement_date: getCurrentDateString()
              });
            } else {
              await Inventory.create({
                product_id: item.product_id,
                location_id: purchaseData.location_id,
                current_stock: item.quantity_received,
                last_movement_date: getCurrentDateString()
              });
            }

            // Create movement records
            await InventoryMovement.create({
              product_id: item.product_id,
              location_id: editingPurchase.location_id,
              movement_type: 'exit',
              quantity: -item.quantity_received,
              reference_id: editingPurchase.id,
              reason: `Compra reubicada de ${editingPurchase.location_id} a ${purchaseData.location_id}`,
              cost_per_unit: item.unit_cost,
              movement_date: getCurrentDateString()
            });

            await InventoryMovement.create({
              product_id: item.product_id,
              location_id: purchaseData.location_id,
              movement_type: 'entry',
              quantity: item.quantity_received,
              reference_id: editingPurchase.id,
              reason: `Compra reubicada de ${editingPurchase.location_id} a ${purchaseData.location_id}`,
              cost_per_unit: item.unit_cost,
              movement_date: getCurrentDateString()
            });
          }
        }

        await Purchase.update(editingPurchase.id, purchaseData);

        // --- Sincronizar inventario e ítems al editar una compra ---
        // 1) Cargar ítems antiguos y mapearlos por SKU
        const oldItems = await PurchaseItem.filter({ purchase_id: editingPurchase.id });
        const oldMap = Object.fromEntries(oldItems.map(i => [i.product_id, i]));
        const newItems = purchaseData.items || [];
        const newMap = Object.fromEntries(newItems.map(i => [i.product_id, i]));
        const isReceived = (editingPurchase.status === 'received') || (isReceived);

        // 2) Crear/actualizar ítems existentes según el formulario
        for (const newItem of newItems) {
          const oldItem = oldMap[newItem.product_id];

          if (oldItem) {
            // Actualizar registro del ítem
            await PurchaseItem.update(oldItem.id, {
              product_id: oldItem.product_id,
              product_name: newItem.product_name || oldItem.product_name,
              quantity_ordered: newItem.quantity_ordered,
              unit_cost: newItem.unit_cost,
              line_total: newItem.line_total,
              ...(isReceived ? { quantity_received: newItem.quantity_ordered } : {})
            });

            // Si la compra está recibida, ajustar inventario por diferencia
            if (isReceived) {
              const prevQty = Number((oldItem.quantity_received ?? oldItem.quantity_ordered) ?? 0);
              const delta = Number(newItem.quantity_ordered) - prevQty;

              if (delta !== 0) {
                const invList = await Inventory.filter({
                  product_id: newItem.product_id,
                  location_id: purchaseData.location_id
                });
                if (invList.length > 0) {
                  const inv = invList[0];
                  await Inventory.update(inv.id, {
                    current_stock: Math.max(0, inv.current_stock + delta),
                    last_movement_date: getCurrentDateString()
                  });
                } else if (delta > 0) {
                  await Inventory.create({
                    product_id: newItem.product_id,
                    location_id: purchaseData.location_id,
                    current_stock: delta,
                    last_movement_date: getCurrentDateString()
                  });
                }

                await InventoryMovement.create({
                  product_id: newItem.product_id,
                  location_id: purchaseData.location_id,
                  movement_type: delta > 0 ? 'purchase' : 'adjustment',
                  quantity: delta,
                  reference_id: editingPurchase.id,
                  reason: 'Ajuste por edición de compra',
                  cost_per_unit: newItem.unit_cost,
                  movement_date: getCurrentDateString()
                });
              }
            }
          } else {
            // Ítem nuevo agregado en la edición
            await PurchaseItem.create({
              ...newItem,
              purchase_id: editingPurchase.id,
              ...(isReceived ? { quantity_received: newItem.quantity_ordered } : {})
            });

            if (isReceived) {
              const invList = await Inventory.filter({
                product_id: newItem.product_id,
                location_id: purchaseData.location_id
              });
              if (invList.length > 0) {
                const inv = invList[0];
                await Inventory.update(inv.id, {
                  current_stock: inv.current_stock + newItem.quantity_ordered,
                  last_movement_date: getCurrentDateString()
                });
              } else {
                await Inventory.create({
                  product_id: newItem.product_id,
                  location_id: purchaseData.location_id,
                  current_stock: newItem.quantity_ordered,
                  last_movement_date: getCurrentDateString()
                });
              }

              await InventoryMovement.create({
                product_id: newItem.product_id,
                location_id: purchaseData.location_id,
                movement_type: 'purchase',
                quantity: newItem.quantity_ordered,
                reference_id: editingPurchase.id,
                reason: 'Producto agregado en edición de compra',
                cost_per_unit: newItem.unit_cost,
                movement_date: getCurrentDateString()
              });
            }
          }
        }

        // 3) Eliminar ítems que ya no existen en el formulario y revertir inventario si estaba recibida
        for (const oldItem of oldItems) {
          if (!newMap[oldItem.product_id]) {
            await PurchaseItem.delete(oldItem.id);

            if (isReceived) {
              const qty = Number((oldItem.quantity_received ?? oldItem.quantity_ordered) ?? 0);
              if (qty > 0) {
                const invList = await Inventory.filter({
                  product_id: oldItem.product_id,
                  location_id: purchaseData.location_id
                });
                if (invList.length > 0) {
                  const inv = invList[0];
                  await Inventory.update(inv.id, {
                    current_stock: Math.max(0, inv.current_stock - qty),
                    last_movement_date: getCurrentDateString()
                  });
                }

                await InventoryMovement.create({
                  product_id: oldItem.product_id,
                  location_id: purchaseData.location_id,
                  movement_type: 'adjustment',
                  quantity: -qty,
                  reference_id: editingPurchase.id,
                  reason: 'Producto eliminado en edición de compra',
                  cost_per_unit: oldItem.unit_cost,
                  movement_date: getCurrentDateString()
                });
              }
            }
          }
        }
      } else {
        // Auto-receive: create as "received" directly
        const newPurchase = await Purchase.create({
          ...purchaseData,
          status: "received"
        });
        
        // Create purchase items and immediately update inventory
        if (purchaseData.items && purchaseData.items.length > 0) {
          for (const item of purchaseData.items) {
            await PurchaseItem.create({
              ...item,
              purchase_id: newPurchase.id,
              quantity_received: item.quantity_ordered
            });

            // Update inventory immediately
            const existingInventory = await Inventory.filter({
              product_id: item.product_id,
              location_id: purchaseData.location_id
            });

            if (existingInventory.length > 0) {
              const inv = existingInventory[0];
              await Inventory.update(inv.id, {
                current_stock: inv.current_stock + item.quantity_ordered,
                last_movement_date: getCurrentDateString()
              });
            } else {
              await Inventory.create({
                product_id: item.product_id,
                location_id: purchaseData.location_id,
                current_stock: item.quantity_ordered,
                last_movement_date: getCurrentDateString()
              });
            }

            // Register movement
            await InventoryMovement.create({
              product_id: item.product_id,
              location_id: purchaseData.location_id,
              movement_type: "purchase",
              quantity: item.quantity_ordered,
              reference_id: newPurchase.id,
              reason: `Compra automática: ${newPurchase.purchase_number || newPurchase.id}`,
              cost_per_unit: item.unit_cost,
              movement_date: getCurrentDateString()
            });

            // Update product base_cost with the new purchase cost
            const productList = await Product.filter({});
            const product = productList.find(p => p.sku === item.product_id);
            if (product) {
              await Product.update(product.id, { base_cost: item.unit_cost });
            }
          }
        }
      }
      
      setIsPurchaseFormOpen(false);
      setEditingPurchase(null);
      loadData();
    } catch (error) {
      console.error("Error saving purchase:", error);
      alert("Error al guardar la compra: " + error.message);
    }
  };

  const handleDeletePurchase = async (purchase) => {
    if (!confirm(`¿Eliminar esta compra y revertir el inventario? Esta acción no se puede deshacer.`)) return;
    try {
      const purchaseItems = await PurchaseItem.filter({ purchase_id: purchase.id });

      for (const item of purchaseItems) {
        const existingInventory = await Inventory.filter({
          product_id: item.product_id,
          location_id: purchase.location_id
        });
        if (existingInventory.length > 0) {
          const inv = existingInventory[0];
          await Inventory.update(inv.id, {
            current_stock: Math.max(0, inv.current_stock - item.quantity_ordered),
            last_movement_date: getCurrentDateString()
          });
        }
        await PurchaseItem.delete(item.id);
      }

      await Purchase.delete(purchase.id);
      loadData();
    } catch (error) {
      console.error("Error deleting purchase:", error);
      alert("Error al eliminar la compra: " + error.message);
    }
  };

  const handleReceivePurchase = async (purchase) => {
    try {
      // Get purchase items
      const purchaseItems = await PurchaseItem.filter({ purchase_id: purchase.id });
      
      // Update inventory for each item
      for (const item of purchaseItems) {
        const existingInventory = await Inventory.filter({
          product_id: item.product_id,
          location_id: purchase.location_id
        });

        if (existingInventory.length > 0) {
          // Update existing inventory
          const inventory = existingInventory[0];
          await Inventory.update(inventory.id, {
            current_stock: inventory.current_stock + item.quantity_ordered,
            last_cost: item.unit_cost,
            last_movement_date: getCurrentDateString()
          });
        } else {
          // Create new inventory record
          await Inventory.create({
            product_id: item.product_id,
            location_id: purchase.location_id,
            current_stock: item.quantity_ordered,
            last_cost: item.unit_cost,
            last_movement_date: getCurrentDateString()
          });
        }

        // Create inventory movement - FIXED: Added movement_date
        await InventoryMovement.create({
          product_id: item.product_id,
          location_id: purchase.location_id,
          movement_type: "entry",
          quantity: item.quantity_ordered,
          reference_id: purchase.id,
          reason: `Compra recibida: ${purchase.purchase_number || purchase.id}`,
          cost_per_unit: item.unit_cost,
          movement_date: getCurrentDateString()
        });

        // Update purchase item as received
        await PurchaseItem.update(item.id, {
          quantity_received: item.quantity_ordered
        });
      }

      // Update purchase status
      await Purchase.update(purchase.id, { status: "received" });
      
      loadData();
    } catch (error) {
      console.error("Error receiving purchase:", error);
      alert("Error al recibir la compra. Inténtalo de nuevo.");
    }
  };

  // Supplier handlers
  const handleOpenSupplierForm = (supplier = null) => {
    setEditingSupplier(supplier);
    setIsSupplierFormOpen(true);
  };

  const handleSaveSupplier = async (supplierData) => {
    try {
      if (editingSupplier) {
        await Supplier.update(editingSupplier.id, supplierData);
      } else {
        await Supplier.create(supplierData);
      }
      
      setIsSupplierFormOpen(false);
      setEditingSupplier(null);
      loadData();
    } catch (error) {
      console.error("Error saving supplier:", error);
    }
  };

  const handleToggleSupplierActive = async (supplier) => {
    try {
      await Supplier.update(supplier.id, { activo: !supplier.activo });
      loadData();
    } catch (error) {
      console.error("Error toggling supplier status:", error);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (confirm(`¿Estás seguro de eliminar el proveedor "${supplier.nombre}"?`)) {
      try {
        await Supplier.delete(supplier.id);
        loadData();
      } catch (error) {
        console.error("Error deleting supplier:", error);
      }
    }
  };

  // Statistics
  const totalPurchases = purchases.length;
  const pendingPurchases = purchases.filter(p => p.status === "pending").length;
  const receivedThisMonth = purchases.filter(p => 
    p.status === "received" && 
    new Date(p.purchase_date).getMonth() === new Date().getMonth()
  ).length;
  const totalSpent = purchases
    .filter(p => p.status === "received")
    .reduce((sum, p) => sum + (p.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-purple-600" />
              Gestión de Compras
            </h1>
            <p className="text-slate-600 mt-1">Administra proveedores y órdenes de compra</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Compras</p>
                  <p className="text-2xl font-bold text-slate-900">{totalPurchases}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pendientes</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingPurchases}</p>
                </div>
                <Filter className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Recibidas (Mes)</p>
                  <p className="text-2xl font-bold text-green-600">{receivedThisMonth}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Invertido</p>
                  <p className="text-xl font-bold text-purple-600">${totalSpent.toLocaleString()}</p>
                </div>
                <ShoppingBag className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <TabsList className="grid w-full md:w-auto grid-cols-2">
              <TabsTrigger value="purchases" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Órdenes de Compra
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Proveedores
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              {activeTab === "purchases" && (
                <Button 
                  onClick={() => handleOpenPurchaseForm()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Compra
                </Button>
              )}
              
              {activeTab === "suppliers" && (
                <>
                  <Button
                    variant="outline"
                    onClick={loadSuppliers}
                    title="Recargar proveedores"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={() => handleOpenSupplierForm()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Proveedor
                  </Button>
                </>
              )}
            </div>
          </div>

          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row gap-4">
                  <Input
                    placeholder="Buscar por número de compra, proveedor o factura..."
                    value={purchaseFilters.search}
                    onChange={(e) => setPurchaseFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="md:max-w-md"
                  />
                  
                  <Select
                    value={purchaseFilters.status}
                    onValueChange={(value) => setPurchaseFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="ordered">Ordenada</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="received">Recibida</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={purchaseFilters.supplier}
                    onValueChange={(value) => setPurchaseFilters(prev => ({ ...prev, supplier: value }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.nombre}
                        </SelectItem>
                      ))}
                      <SelectItem value="all">Todos los Proveedores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <PurchaseList
                 purchases={purchases}
                 suppliers={suppliers}
                 locations={locations}
                 filters={purchaseFilters}
                 onEditPurchase={handleOpenPurchaseForm}
                 onViewPurchase={(p) => setViewingPurchase(p)}
                 onDeletePurchase={handleDeletePurchase}
                 isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers">
            <Card>
              <CardContent className="p-6">
                <SupplierList
                  suppliers={suppliers}
                  onEditSupplier={handleOpenSupplierForm}
                  onToggleActive={handleToggleSupplierActive}
                  onDeleteSupplier={handleDeleteSupplier}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Purchase Form Modal */}
        {isPurchaseFormOpen && (
          <PurchaseForm
            purchase={editingPurchase}
            suppliers={suppliers}
            products={products}
            locations={locations}
            onSave={handleSavePurchase}
            onCancel={() => {
              setIsPurchaseFormOpen(false);
              setEditingPurchase(null);
            }}
          />
        )}

        {/* Purchase Detail Modal */}
        {viewingPurchase && (
          <PurchaseDetailModal
            purchase={viewingPurchase}
            suppliers={suppliers}
            locations={locations}
            onClose={() => setViewingPurchase(null)}
          />
        )}

        {/* Supplier Form Modal */}
        {isSupplierFormOpen && (
          <FormularioProveedor
            proveedor={editingSupplier}
            onSubmit={handleSaveSupplier}
            onCancel={() => {
              setIsSupplierFormOpen(false);
              setEditingSupplier(null);
            }}
          />
        )}
      </div>
    </div>
  );
}