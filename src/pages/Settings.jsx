import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { SystemSettings } from "@/entities/SystemSettings";
import { Sale } from "@/entities/Sale";
import { SaleItem } from "@/entities/SaleItem";
import { Payment } from "@/entities/Payment";
import { Credit } from "@/entities/Credit";
import { Expense } from "@/entities/Expense";
import { Purchase } from "@/entities/Purchase";
import { PurchaseItem } from "@/entities/PurchaseItem";
import { Inventory } from "@/entities/Inventory";
import { InventoryMovement } from "@/entities/InventoryMovement";
import { AlertTriangle, RefreshCw, Database, Trash2, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import SystemConfiguration from "../components/settings/SystemConfiguration";

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState("");
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [systemSettings, setSystemSettings] = useState(null);
  const [isLoading, setIsLoading] = useState({ system: false });

  const loadUserData = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadTabData = async () => {
    setIsLoading({ system: true });
    try {
      const settings = await SystemSettings.list();
      setSystemSettings(settings.length > 0 ? settings[0] : null);
    } catch (error) {
      console.error("Error loading settings:", error);
      setSystemSettings(null);
    } finally {
      setIsLoading({ system: false });
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    loadTabData();
  }, []);

  const refreshTabData = () => loadTabData();

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await User.deleteMe();
      alert("Tu cuenta ha sido eliminada exitosamente.");
      await User.logout();
      window.location.reload();
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Error al eliminar la cuenta: " + (error.message || "Inténtalo de nuevo."));
      setIsDeletingAccount(false);
    }
  };

  const handleSystemReset = async () => {
    setIsResetting(true);
    setResetProgress("Iniciando reinicio del sistema...");

    try {
      // 1. Eliminar todas las ventas y elementos relacionados
      setResetProgress("Eliminando ventas...");
      const allSales = await Sale.list();
      for (const sale of allSales) {
        await Sale.delete(sale.id);
      }

      // 2. Eliminar items de venta
      setResetProgress("Eliminando items de venta...");
      const allSaleItems = await SaleItem.list();
      for (const item of allSaleItems) {
        await SaleItem.delete(item.id);
      }

      // 3. Eliminar pagos
      setResetProgress("Eliminando pagos...");
      const allPayments = await Payment.list();
      for (const payment of allPayments) {
        await Payment.delete(payment.id);
      }

      // 4. Eliminar créditos
      setResetProgress("Eliminando créditos...");
      const allCredits = await Credit.list();
      for (const credit of allCredits) {
        await Credit.delete(credit.id);
      }

      // 5. Eliminar gastos
      setResetProgress("Eliminando gastos...");
      const allExpenses = await Expense.list();
      for (const expense of allExpenses) {
        await Expense.delete(expense.id);
      }

      // 6. Eliminar compras
      setResetProgress("Eliminando compras...");
      const allPurchases = await Purchase.list();
      for (const purchase of allPurchases) {
        await Purchase.delete(purchase.id);
      }

      // 7. Eliminar items de compra
      setResetProgress("Eliminando items de compra...");
      const allPurchaseItems = await PurchaseItem.list();
      for (const item of allPurchaseItems) {
        await PurchaseItem.delete(item.id);
      }

      // 8. Resetear inventario a cero
      setResetProgress("Reseteando inventario...");
      const allInventory = await Inventory.list();
      for (const inv of allInventory) {
        await Inventory.update(inv.id, {
          current_stock: 0,
          reserved_stock: 0,
          available_stock: 0,
          last_movement_date: new Date().toISOString().split('T')[0]
        });
      }

      // 9. Eliminar movimientos de inventario
      setResetProgress("Eliminando movimientos de inventario...");
      const allMovements = await InventoryMovement.list();
      for (const movement of allMovements) {
        await InventoryMovement.delete(movement.id);
      }

      setResetProgress("¡Reinicio completado exitosamente!");

      setTimeout(() => {
        setShowResetModal(false);
        setIsResetting(false);
        setResetProgress("");
        alert("Sistema reiniciado exitosamente. Todas las transacciones han sido eliminadas pero la configuración se mantiene.");
      }, 2000);

    } catch (error) {
      console.error("Error during system reset:", error);
      setResetProgress("Error durante el reinicio. Algunos datos pueden no haberse eliminado correctamente.");
      setIsResetting(false);
    }
  };


  if (!currentUser) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Configuración del Sistema</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Personaliza tu sistema JacketMaster POS
            </p>
          </div>

          <div className="flex gap-2 w-full lg:w-auto flex-wrap *:flex-1 sm:*:flex-none">
            {/* Delete Account Button - Para todos los usuarios */}
            <Button
              onClick={() => setShowDeleteAccountModal(true)}
              variant="outline"
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 select-none flex-1 lg:flex-none"
              disabled={isDeletingAccount}
            >
              <UserX className="w-4 h-4" />
              Eliminar Cuenta
            </Button>

            {/* Sistema Reset Button - Solo para admin */}
            {(currentUser.role === 'admin' || currentUser.role_id) && (
              <Button
                onClick={() => setShowResetModal(true)}
                variant="destructive"
                className="gap-2 select-none flex-1 lg:flex-none"
                disabled={isResetting}
              >
                <Database className="w-4 h-4" />
                Reiniciar Sistema
              </Button>
            )}
          </div>
        </div>

        {/* Warning para admin */}
        {(currentUser.role === 'admin' || currentUser.role_id) && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Zona de Administración:</strong> Los cambios aquí afectan todo el sistema.
              La función "Reiniciar Sistema" eliminará todas las transacciones pero mantendrá productos, usuarios y configuraciones.
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-none border-0 bg-transparent dark:bg-transparent">
          <CardContent className="p-0">
            <SystemConfiguration settings={systemSettings} onRefresh={refreshTabData} isLoading={isLoading.system} />
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Modal */}
      <Dialog open={showDeleteAccountModal} onOpenChange={setShowDeleteAccountModal}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <UserX className="w-5 h-5" />
              Eliminar Mi Cuenta
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Esta acción es permanente e irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-red-800 dark:text-red-300">⚠️ Advertencia:</h4>
              <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                <li>• Tu cuenta será eliminada permanentemente</li>
                <li>• Perderás acceso a todos los datos</li>
                <li>• Esta acción NO se puede deshacer</li>
                <li>• Se cerrará tu sesión inmediatamente</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteAccountModal(false)}
              disabled={isDeletingAccount}
              className="select-none"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="gap-2 select-none"
            >
              {isDeletingAccount ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UserX className="w-4 h-4" />
              )}
              {isDeletingAccount ? "Eliminando..." : "Confirmar Eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Reiniciar Sistema
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Esta acción eliminará TODAS las transacciones del sistema, incluyendo:
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-red-800 dark:text-red-300">Se eliminarán:</h4>
              <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                <li>• Todas las ventas y facturas</li>
                <li>• Todos los pagos registrados</li>
                <li>• Todos los créditos</li>
                <li>• Todos los gastos</li>
                <li>• Todas las compras</li>
                <li>• Todo el historial de inventario</li>
                <li>• El stock actual (se pondrá en cero)</li>
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2 mt-4">
              <h4 className="font-semibold text-green-800 dark:text-green-300">Se mantendrán:</h4>
              <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                <li>• Productos</li>
                <li>• Usuarios y roles</li>
                <li>• Clientes</li>
                <li>• Proveedores</li>
                <li>• Sucursales</li>
                <li>• Configuración del sistema</li>
                <li>• Cuentas bancarias</li>
              </ul>
            </div>

            {isResetting && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="font-medium text-blue-800">Procesando reinicio...</span>
                </div>
                <p className="text-sm text-blue-700">{resetProgress}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetModal(false)}
              disabled={isResetting}
              className="select-none"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSystemReset}
              disabled={isResetting}
              className="gap-2 select-none"
            >
              {isResetting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isResetting ? "Reseteando..." : "Confirmar Reinicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}