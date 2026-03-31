import React, { useState, useEffect, useCallback } from "react";
import { Inventory, Product, Location, User } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRightLeft, Package, History, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import TransferForm from "../components/transfers/TransferForm";
import TransferHistory from "../components/transfers/TransferHistory";

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState("create");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [user, locationsData, productsData, inventoryData] = await Promise.all([
        User.me(),
        Location.filter({ is_active: true }),
        Product.filter({ is_active: true }),
        Inventory.list()
      ]);
      
      setCurrentUser(user);
      setLocations(locationsData);
      setProducts(productsData);
      setInventory(inventoryData);
    } catch (error) {
      console.error("Error loading transfer data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTransferComplete = () => {
    setActiveTab("history");
    loadData(); // Reload data after transfer
  };

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Traslados de Inventario</h1>
            <p className="text-slate-600 mt-1">
              Transfiere productos entre sucursales de manera segura.
            </p>
          </div>
        </div>

        {/* Alert for permissions */}
        {currentUser?.role !== 'admin' && !currentUser?.role_id && (
          <Alert className="border-amber-200 bg-amber-50">
            <Package className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              Los traslados de inventario requieren permisos especiales. Contacta al administrador si necesitas realizar traslados.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "create"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Nuevo Traslado
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
            Historial
          </button>
        </div>

        {/* Content */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            {activeTab === "create" && (
              <TransferForm
                locations={locations}
                products={products}
                inventory={inventory}
                currentUser={currentUser}
                onTransferComplete={handleTransferComplete}
              />
            )}
            
            {activeTab === "history" && (
              <TransferHistory
                locations={locations}
                products={products}
                onRefresh={loadData}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}