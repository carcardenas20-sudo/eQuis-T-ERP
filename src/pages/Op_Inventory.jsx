import React, { useState, useEffect } from "react";
import { Inventory } from "@/entities/Inventory";
import { StockMovement } from "@/entities/StockMovement";
import { Producto } from "@/entities/Producto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Warehouse, Plus, Package, History, AlertTriangle, Settings } from "lucide-react";

import AddStockForm from "../components/inventory/AddStockForm";
import StockMovementForm from "../components/inventory/StockMovementForm";
import StockHistoryTable from "../components/inventory/StockHistoryTable";
import AdjustStockForm from "../components/inventory/AdjustStockForm";

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inventoryData, movementsData, productsData] = await Promise.all([
        Inventory.list(),
        StockMovement.list('-movement_date'),
        Producto.list()
      ]);
      setInventoryItems((inventoryData || []).filter(inv => inv.product_reference));
      setMovements(movementsData || []);
      setProducts((productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const handleAddStock = async (stockData) => {
    try {
      // Buscar inventario existente
      const existingInventory = inventoryItems.find(inv => inv.product_reference === stockData.product_reference);
      
      const previousStock = existingInventory ? (Number(existingInventory.current_stock) || 0) : 0;
      const newStock = previousStock + stockData.quantity;

      // Crear movimiento de stock
      const movementData = {
        product_reference: stockData.product_reference,
        movement_type: "entrada",
        quantity: stockData.quantity,
        movement_date: stockData.movement_date,
        previous_stock: previousStock,
        new_stock: newStock
      };

      if (stockData.reason) movementData.reason = stockData.reason;
      if (stockData.notes) movementData.notes = stockData.notes;

      await StockMovement.create(movementData);

      // Actualizar o crear inventario
      if (existingInventory) {
        await Inventory.update(existingInventory.id, {
          current_stock: newStock
        });
      } else {
        const inventoryData = {
          product_reference: stockData.product_reference,
          current_stock: newStock
        };
        
        if (stockData.min_stock > 0) inventoryData.min_stock = stockData.min_stock;
        if (stockData.location) inventoryData.location = stockData.location;
        
        await Inventory.create(inventoryData);
      }

      alert("Stock agregado correctamente");
      setShowAddForm(false);
      loadData();
    } catch (error) {
      console.error("Error completo:", error);
      alert(`Error al agregar stock: ${error.response?.data?.detail || error.message || 'Error desconocido'}`);
    }
  };

  const handleAdjustStock = async (adjustData) => {
    try {
      const existingInventory = inventoryItems.find(inv => inv.product_reference === adjustData.product_reference);
      
      if (!existingInventory) {
        alert("No existe inventario para este producto. Primero agrega stock inicial.");
        return;
      }

      const previousStock = Number(existingInventory.current_stock) || 0;
      let newStock;
      let movementType;
      let quantity;

      if (adjustData.adjustment_type === 'set_to') {
        // Ajustar a una cantidad específica
        newStock = adjustData.new_quantity;
        quantity = Math.abs(newStock - previousStock);
        movementType = newStock > previousStock ? "entrada" : "salida";
        
        if (newStock === previousStock) {
          alert("La cantidad nueva es igual a la actual. No se requiere ajuste.");
          return;
        }
      } else {
        // Sumar o restar cantidad
        quantity = adjustData.quantity;
        if (adjustData.adjustment_type === 'subtract') {
          newStock = previousStock - quantity;
          movementType = "salida";
        } else {
          newStock = previousStock + quantity;
          movementType = "entrada";
        }
      }

      if (newStock < 0) {
        alert("El stock no puede ser negativo.");
        return;
      }

      // Crear movimiento de stock
      const movementData = {
        product_reference: adjustData.product_reference,
        movement_type: movementType,
        quantity: quantity,
        movement_date: adjustData.movement_date,
        reason: adjustData.reason || `Ajuste de inventario`,
        previous_stock: previousStock,
        new_stock: newStock
      };

      if (adjustData.notes) movementData.notes = adjustData.notes;

      await StockMovement.create(movementData);

      // Actualizar inventario
      if (newStock === 0) {
        await Inventory.delete(existingInventory.id);
      } else {
        await Inventory.update(existingInventory.id, {
          current_stock: newStock
        });
      }

      alert("Ajuste de stock realizado correctamente");
      setShowAdjustForm(false);
      loadData();
    } catch (error) {
      console.error("Error en ajuste:", error);
      alert(`Error al ajustar stock: ${error.response?.data?.detail || error.message || 'Error desconocido'}`);
    }
  };

  const handleEditMovement = async (movementData) => {
    try {
      await StockMovement.update(editingMovement.id, movementData);
      setShowMovementForm(false);
      setEditingMovement(null);
      loadData();
    } catch (error) {
      console.error("Error updating movement:", error);
      alert("Error al actualizar el movimiento.");
    }
  };

  const handleDeleteMovement = async (movement) => {
    if (!window.confirm(`¿Estás seguro de eliminar este movimiento de stock? Esta acción ajustará el inventario actual.`)) {
      return;
    }

    try {
      const inventoryItem = inventoryItems.find(inv => inv.product_reference === movement.product_reference);
      
      if (movement.movement_type === 'ajuste') {
        await StockMovement.delete(movement.id);
        alert("Movimiento de ajuste eliminado. El stock no fue modificado automáticamente.");
        loadData();
        return;
      }

      if (!inventoryItem) {
        await StockMovement.delete(movement.id);
        alert("Movimiento eliminado. No se encontró un ítem de inventario asociado para ajustar el stock.");
        loadData();
        return;
      }

      let calculatedNewStock;
      if (movement.movement_type === 'entrada') {
        calculatedNewStock = inventoryItem.current_stock - movement.quantity;
      } else if (movement.movement_type === 'salida') {
        calculatedNewStock = inventoryItem.current_stock + movement.quantity;
      } else {
        alert("Tipo de movimiento desconocido. No se puede ajustar el stock.");
        return;
      }
      
      if (calculatedNewStock < 0) {
        alert("No se puede eliminar este movimiento porque resultaría en stock negativo.");
        return;
      }
      
      await StockMovement.delete(movement.id);

      const allCurrentMovements = await StockMovement.list('-movement_date');
      const remainingMovementsForProduct = allCurrentMovements.filter(
          m => m.product_reference === movement.product_reference
      );

      if (calculatedNewStock === 0) {
        if (remainingMovementsForProduct.length === 0) {
          await Inventory.delete(inventoryItem.id);
          alert("Movimiento eliminado, inventario actualizado a 0 y registro de inventario eliminado.");
        } else {
          await Inventory.update(inventoryItem.id, { current_stock: 0 });
          alert("Movimiento eliminado e inventario ajustado a 0.");
        }
      } else {
        await Inventory.update(inventoryItem.id, { current_stock: calculatedNewStock });
        alert("Movimiento eliminado y stock ajustado.");
      }
      
      loadData();
    } catch (error) {
      console.error("Error deleting movement:", error);
      alert(`Error al eliminar el movimiento: ${error.response?.data?.detail || error.message || 'Error desconocido'}. Intente de nuevo.`);
    }
  };

  const getProductName = (reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : reference;
  };

  const getStockStatus = (current, min) => {
    if (current === 0) return { color: 'bg-red-100 text-red-800', text: 'Sin Stock' };
    if (current <= min) return { color: 'bg-orange-100 text-orange-800', text: 'Stock Bajo' };
    return { color: 'bg-green-100 text-green-800', text: 'Stock OK' };
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
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Inventario</h1>
            <p className="text-slate-600 text-sm sm:text-base">Control de stock y movimientos de materiales</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button onClick={() => setShowAdjustForm(true)} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50 text-sm flex-1 sm:flex-none">
              <Settings className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="sm:inline">Ajustar Stock</span>
            </Button>
            <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 text-sm flex-1 sm:flex-none">
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="sm:inline">Agregar Stock</span>
            </Button>
          </div>
        </div>

        {showAddForm && (
          <AddStockForm
            products={products}
            onSubmit={handleAddStock}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {showAdjustForm && (
          <AdjustStockForm
            products={products}
            inventoryItems={inventoryItems}
            onSubmit={handleAdjustStock}
            onCancel={() => setShowAdjustForm(false)}
          />
        )}

        {showMovementForm && (
          <StockMovementForm
            movement={editingMovement}
            products={products}
            onSubmit={handleEditMovement}
            onCancel={() => {
              setShowMovementForm(false);
              setEditingMovement(null);
            }}
          />
        )}

        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inventory" className="text-xs sm:text-sm">Stock Actual</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="w-5 h-5" />
                  Stock Disponible ({inventoryItems.length} productos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inventoryItems.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {inventoryItems.map(item => {
                      const status = getStockStatus(item.current_stock, item.min_stock);
                      return (
                        <Card key={item.id} className="border-slate-200">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="font-bold text-slate-900 text-lg mb-1">
                                  {getProductName(item.product_reference)}
                                </h3>
                                <p className="text-sm text-slate-600 font-medium">
                                  Ref: {item.product_reference}
                                </p>
                              </div>
                              {item.current_stock <= item.min_stock && (
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                              )}
                            </div>

                            <div className="text-center bg-blue-50 py-4 rounded-lg">
                              <p className="text-3xl font-bold text-blue-800">
                                {item.current_stock}
                              </p>
                              <p className="text-sm text-blue-600">unidades disponibles</p>
                            </div>

                            <div className="space-y-3 mt-4">
                              <div className="flex justify-between text-sm text-slate-600">
                                <span>Stock mínimo:</span>
                                <span className="font-medium">{item.min_stock}</span>
                              </div>

                              {item.location && (
                                <div className="flex justify-between text-sm text-slate-600">
                                  <span>Ubicación:</span>
                                  <span className="font-medium">{item.location}</span>
                                </div>
                              )}

                              <div className="flex justify-center pt-2">
                                <Badge className={status.color}>
                                  {status.text}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No hay productos en inventario.</p>
                    <p className="text-sm">Agrega el primer stock para comenzar.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Movimientos ({movements.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StockHistoryTable
                  movements={movements}
                  products={products}
                  onEdit={(movement) => {
                    setEditingMovement(movement);
                    setShowMovementForm(true);
                  }}
                  onDelete={handleDeleteMovement}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}