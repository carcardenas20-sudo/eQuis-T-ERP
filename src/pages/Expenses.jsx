import React, { useState, useEffect, useCallback } from "react";
import { Expense, Location, User } from "@/entities/all";
import { Plus, Receipt, Filter, Building2 } from "lucide-react"; // Added Building2
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert"; // Added Alert, AlertDescription
import { useSession } from "../components/providers/SessionProvider";

import ExpenseList from "../components/expenses/ExpenseList";
import ExpenseForm from "../components/expenses/ExpenseForm";
import ExpenseStats from "../components/expenses/ExpenseStats";
import {
  getNowInColombia,
  getLastNDaysRangeInColombia,
  formatColombiaDate,
  getCurrentDateString,
  getColombiaDateString
} from "../components/utils/dateUtils";

export default function ExpensesPage() {
  const { userRole } = useSession();
  const [expenses, setExpenses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null); // New state for non-admin user's location
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    location: "all",
    dateRange: "month",
    customStartDate: getCurrentDateString(),
    customEndDate: getCurrentDateString()
  });

  const loadExpenses = useCallback(async () => {
    if (!currentUser) return; // CRITICAL: Do not proceed if currentUser is not yet loaded
    
    try {
      let expenseFilter = {};
      const todayInColombia = getNowInColombia();
      const isAdmin = (currentUser.role === 'admin') || (userRole?.name === 'Administrador'); // Determine if the current user is an admin

      // ✅ CRÍTICO: Forzar sucursal para usuarios no-admin, o aplicar filtro de UI para admin
      if (!isAdmin && currentUser.location_id) {
        expenseFilter.location_id = currentUser.location_id;
        console.log("🔒 Gastos - Usuario NO-admin, forzando sucursal:", currentUser.location_id);
      } else if (filters.location !== "all") { // Only apply the UI filter if admin or no forced location
        expenseFilter.location_id = filters.location;
      }

      // Apply date filter
      switch (filters.dateRange) {
        case 'today':
          // Campo tipo 'date': filtrar por igualdad YYYY-MM-DD en zona Colombia
          expenseFilter.expense_date = getColombiaDateString();
          break;
        case 'week':
          const weekRange = getLastNDaysRangeInColombia(7);
          expenseFilter.expense_date = { $gte: weekRange.start, $lte: weekRange.end };
          break;
        case 'month':
          const monthRange = getLastNDaysRangeInColombia(30);
          expenseFilter.expense_date = { $gte: monthRange.start, $lte: monthRange.end };
          break;
        case 'custom':
          if (filters.customStartDate && filters.customEndDate) {
            expenseFilter.expense_date = {
              $gte: filters.customStartDate,
              $lte: filters.customEndDate
            };
          }
          break;
        default:
          break;
      }

      // Apply other filters
      if (filters.category !== "all") {
        expenseFilter.category = filters.category;
      }

      const expensesData = await Expense.filter(expenseFilter, "-expense_date");

      // Apply search filter (client-side)
      let filteredExpenses = expensesData;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredExpenses = expensesData.filter(expense =>
          expense.description?.toLowerCase().includes(searchLower) ||
          expense.supplier?.toLowerCase().includes(searchLower) ||
          expense.receipt_number?.toLowerCase().includes(searchLower)
        );
      }

      setExpenses(filteredExpenses);
    } catch (error) {
      console.error("Error loading expenses:", error);
    }
  }, [filters, currentUser, userRole]); // Added currentUser and userRole to dependencies

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [user, locationsData] = await Promise.all([
        User.me(),
        Location.filter({ is_active: true })
      ]);
      
      setCurrentUser(user);
      setLocations(locationsData);
      
      // ✅ FORZAR filtro de sucursal para usuarios no-admin
      const isAdminNew = (user.role === 'admin') || (userRole?.name === 'Administrador');
      if (!isAdminNew && user.location_id) {
        const loc = locationsData.find(l => l.id === user.location_id);
        setUserLocation(loc); // Set the full location object
        setFilters(prev => ({ ...prev, location: user.location_id }));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  }, [userRole]);

  // Load initial data on component mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load expenses when filters change or when initial loading is complete
  useEffect(() => {
    if (!isLoading) {
      loadExpenses();
    }
  }, [filters, isLoading, loadExpenses]);

  const handleOpenForm = (expense = null) => {
    console.log("📝 Abriendo formulario con gasto:", expense);
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const handleSaveExpense = async (expenseData) => {
    try {
      console.log("💾 Guardando gasto:", expenseData);
      
      if (editingExpense) {
        console.log("✏️ Actualizando gasto ID:", editingExpense.id);
        await Expense.update(editingExpense.id, expenseData);
      } else {
        console.log("➕ Creando nuevo gasto");
        await Expense.create(expenseData);
      }
      
      setIsFormOpen(false);
      setEditingExpense(null);
      await loadExpenses();
      
      console.log("✅ Gasto guardado exitosamente");
    } catch (error) {
      console.error("❌ Error saving expense:", error);
      alert("Error al guardar el gasto: " + error.message);
    }
  };

  const handleDeleteExpense = async (expense) => {
    console.log("🗑️ Intentando eliminar gasto:", expense);
    
    if (window.confirm(`¿Estás seguro de eliminar el gasto "${expense.description}"?`)) {
      try {
        console.log("🗑️ Eliminando gasto ID:", expense.id);
        await Expense.delete(expense.id);
        await loadExpenses();
        console.log("✅ Gasto eliminado exitosamente");
      } catch (error) {
        console.error("❌ Error deleting expense:", error);
        alert("Error al eliminar el gasto: " + error.message);
      }
    } else {
      console.log("❌ Eliminación cancelada por el usuario");
    }
  };

  const isAdmin = currentUser?.role === 'admin' || userRole?.name === 'Administrador'; // Helper to check admin status

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Receipt className="w-8 h-8 text-red-600" />
              Gestión de Gastos
            </h1>
            <p className="text-slate-600 mt-1">
              Control y seguimiento de gastos operativos del negocio.
            </p>
            {/* ✅ NUEVO: Mostrar sucursal si es usuario no-admin */}
            {!isAdmin && userLocation && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <Building2 className="w-4 h-4" />
                <span>Viendo gastos de: <strong>{userLocation.name}</strong></span>
              </div>
            )}
          </div>
          <Button 
            onClick={() => handleOpenForm()}
            className="bg-red-600 hover:bg-red-700 gap-2"
          >
            <Plus className="w-5 h-5" />
            Registrar Gasto
          </Button>
        </div>

        {/* ✅ NUEVO: Alerta para usuarios no-admin */}
        {!isAdmin && userLocation && (
          <Alert className="border-blue-200 bg-blue-50">
            <Building2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              Estás viendo únicamente los gastos de tu sucursal: <strong>{userLocation.name}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <Input
                  placeholder="Descripción, proveedor, recibo..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select 
                  value={filters.category} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    <SelectItem value="servicios_publicos">Servicios Públicos</SelectItem>
                    <SelectItem value="alquiler">Alquiler</SelectItem>
                    <SelectItem value="suministros">Suministros</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="transporte">Transporte</SelectItem>
                    <SelectItem value="alimentacion">Alimentación</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                    <SelectItem value="salarios">Salarios</SelectItem>
                    <SelectItem value="impuestos">Impuestos</SelectItem>
                    <SelectItem value="seguros">Seguros</SelectItem>
                    <SelectItem value="telecomunicaciones">Telecomunicaciones</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ✅ MODIFICADO: Sucursal solo editable para admin */}
              {isAdmin ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sucursal</label>
                  <Select 
                    value={filters.location} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, location: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las sucursales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sucursales</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sucursal</label>
                  <Input 
                    value={userLocation?.name || "Cargando..."} 
                    disabled 
                    className="bg-gray-100 text-gray-700"
                    title="Solo puedes ver los gastos de tu sucursal asignada"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select 
                  value={filters.dateRange} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="month">Último mes</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.dateRange === 'custom' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fechas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={filters.customStartDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={filters.customEndDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <ExpenseStats expenses={expenses} />

        {/* Expense List */}
        <ExpenseList
          expenses={expenses}
          locations={locations}
          onEdit={handleOpenForm}
          onDelete={handleDeleteExpense}
          isLoading={isLoading}
        />

        {/* Form Modal */}
        {isFormOpen && (
          <ExpenseForm
            expense={editingExpense}
            locations={locations}
            currentUser={currentUser}
            isAdmin={isAdmin}
            onSave={handleSaveExpense}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingExpense(null);
            }}
          />
        )}
      </div>
    </div>
  );
}