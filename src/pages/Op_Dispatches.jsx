import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TruckIcon, Plus, Edit, Trash2, Calendar as CalendarIcon, Package, ListTree, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";

import DispatchForm from "../components/dispatches/DispatchForm";
import ActivityHistory from "../components/history/ActivityHistory";

export default function Dispatches() {
  const [dispatches, setDispatches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [date, setDate] = useState({
    from: subDays(new Date(), 29), // Por defecto los últimos 30 días
    to: new Date(),
  });
  const [filteredDispatches, setFilteredDispatches] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!date?.from) {
      setFilteredDispatches(dispatches);
      return;
    }

    const fromDate = new Date(date.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = date.to ? new Date(date.to) : new Date(date.from);
    toDate.setHours(23, 59, 59, 999);

    let filtered = dispatches.filter(d => {
      if (!d.dispatch_date) return false;
      const dispatchDate = new Date(d.dispatch_date + 'T00:00:00');
      return dispatchDate >= fromDate && dispatchDate <= toDate;
    });

    if (filterEmployee) {
      filtered = filtered.filter(d => d.employee_id === filterEmployee);
    }

    if (filterProduct) {
      filtered = filtered.filter(d => d.product_reference === filterProduct);
    }

    setFilteredDispatches(filtered);
  }, [date, dispatches, filterEmployee, filterProduct]);

  const getProductName = useCallback((reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : `Ref. ${reference}`;
  }, [products]);

  const summary = useMemo(() => {
    const totalQuantity = filteredDispatches.reduce((sum, d) => sum + d.quantity, 0);
    const totalDispatches = filteredDispatches.length;

    const byReference = filteredDispatches.reduce((acc, d) => {
      const productName = getProductName(d.product_reference);
      if (!acc[productName]) {
        acc[productName] = { quantity: 0, count: 0 };
      }
      acc[productName].quantity += d.quantity;
      acc[productName].count += 1;
      return acc;
    }, {});
    
    return { totalQuantity, totalDispatches, byReference };
  }, [filteredDispatches, getProductName]);


  const loadData = async () => {
    setLoading(true);
    try {
      const [dispatchesData, employeesData, productsData, inventoryData] = await Promise.all([
        base44.entities.Dispatch.list('-dispatch_date'),
        base44.entities.Employee.list(),
        base44.entities.Producto.list(),
        base44.entities.Inventory.list()
      ]);
      setDispatches(dispatchesData || []);
      setEmployees(employeesData || []);
      setProducts((productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
      setInventory((inventoryData || []).filter(inv => inv.product_reference));
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const handleSubmit = async (dispatchData) => {
    try {
      const employee = employees.find(e => e.employee_id === dispatchData.employee_id);
      const product = products.find(p => p.reference === dispatchData.product_reference);
      
      if (editingDispatch) {
        const originalDispatch = dispatches.find(d => d.id === editingDispatch.id);
        const quantityDiff = dispatchData.quantity - originalDispatch.quantity;

        if (quantityDiff !== 0) {
          const inventoryItem = inventory.find(inv => inv.product_reference === dispatchData.product_reference);
          const availableStock = inventoryItem ? inventoryItem.current_stock : 0;

          if (quantityDiff > 0 && quantityDiff > availableStock) {
            alert(`No hay suficiente stock para este ajuste. Disponible: ${availableStock}, Necesario adicional: ${quantityDiff}`);
            return;
          }
          
          await base44.entities.Dispatch.update(editingDispatch.id, dispatchData);

          await base44.entities.ActivityLog.create({
            entity_type: 'Dispatch',
            entity_id: editingDispatch.id,
            action: 'updated',
            description: `Despacho actualizado - ${product?.name || dispatchData.product_reference} - Cantidad: ${dispatchData.quantity} (${quantityDiff > 0 ? '+' : ''}${quantityDiff})`,
            employee_id: dispatchData.employee_id,
            employee_name: employee?.name || dispatchData.employee_id,
            new_data: dispatchData,
            previous_data: originalDispatch
          });

          const newStock = availableStock - quantityDiff;
          const movementReason = `Ajuste de despacho a empleado ${getEmployeeName(dispatchData.employee_id)}`;
          const movementType = quantityDiff > 0 ? "salida" : "entrada";
          
          const stockMovementData = {
            product_reference: dispatchData.product_reference,
            movement_type: movementType,
            quantity: Math.abs(quantityDiff),
            movement_date: getColombiaCurrentDateString(),
            reason: movementReason,
            previous_stock: availableStock,
            new_stock: newStock,
          };
          
          await base44.entities.StockMovement.create(stockMovementData);
          if (inventoryItem) {
            await base44.entities.Inventory.update(inventoryItem.id, { current_stock: newStock });
          }

        } else {
          await base44.entities.Dispatch.update(editingDispatch.id, dispatchData);
        }
      } else {
        const inventoryItem = inventory.find(inv => inv.product_reference === dispatchData.product_reference);
        const availableStock = inventoryItem ? inventoryItem.current_stock : 0;

        if (dispatchData.quantity > availableStock) {
          alert(`No hay suficiente stock. Disponible: ${availableStock}, Solicitado: ${dispatchData.quantity}`);
          return;
        }

        const newDispatch = await base44.entities.Dispatch.create(dispatchData);

        await base44.entities.ActivityLog.create({
          entity_type: 'Dispatch',
          entity_id: newDispatch.id,
          action: 'created',
          description: `Nuevo despacho - ${product?.name || dispatchData.product_reference} - Cantidad: ${dispatchData.quantity}`,
          employee_id: dispatchData.employee_id,
          employee_name: employee?.name || dispatchData.employee_id,
          new_data: dispatchData
        });

        const stockMovementData = {
          product_reference: dispatchData.product_reference,
          movement_type: "salida",
          quantity: dispatchData.quantity,
          movement_date: dispatchData.dispatch_date,
          reason: `Despacho a empleado ${getEmployeeName(dispatchData.employee_id)}`,
          previous_stock: availableStock,
          new_stock: availableStock - dispatchData.quantity
        };
        await base44.entities.StockMovement.create(stockMovementData);

        if (inventoryItem) {
          await base44.entities.Inventory.update(inventoryItem.id, {
            current_stock: availableStock - dispatchData.quantity
          });
        }
      }

      setShowForm(false);
      setEditingDispatch(null);
      loadData();
    } catch (error) {
      console.error("Error saving dispatch:", error);
      alert("Error al guardar el despacho.");
    }
  };

  const handleEdit = (dispatch) => {
    setEditingDispatch(dispatch);
    setShowForm(true);
  };

  const handleDelete = async (dispatch) => {
    if (window.confirm(`¿Estás seguro de eliminar este despacho? Esta acción devolverá la cantidad al inventario.`)) {
      try {
        const employee = employees.find(e => e.employee_id === dispatch.employee_id);
        const product = products.find(p => p.reference === dispatch.product_reference);
        
        const inventoryItem = inventory.find(inv => inv.product_reference === dispatch.product_reference);
        const currentStock = inventoryItem ? inventoryItem.current_stock : 0;
        const newStock = currentStock + dispatch.quantity;

        if (inventoryItem) {
          await base44.entities.Inventory.update(inventoryItem.id, { current_stock: newStock });
        }

        const stockMovementData = {
          product_reference: dispatch.product_reference,
          movement_type: "entrada",
          quantity: dispatch.quantity,
          movement_date: getColombiaCurrentDateString(),
          reason: `Cancelación de despacho a empleado ${getEmployeeName(dispatch.employee_id)}`,
          previous_stock: currentStock,
          new_stock: newStock,
        };
        await base44.entities.StockMovement.create(stockMovementData);
        
        await base44.entities.Dispatch.delete(dispatch.id);

        await base44.entities.ActivityLog.create({
          entity_type: 'Dispatch',
          entity_id: dispatch.id,
          action: 'deleted',
          description: `Despacho eliminado - ${product?.name || dispatch.product_reference} - Cantidad: ${dispatch.quantity} (devuelto al inventario)`,
          employee_id: dispatch.employee_id,
          employee_name: employee?.name || dispatch.employee_id,
          previous_data: dispatch
        });

        alert("Despacho eliminado y stock devuelto al inventario.");
        loadData();
      } catch (error) {
        console.error("Error deleting dispatch:", error);
        alert("Error al eliminar el despacho.");
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDispatch(null);
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.employee_id === employeeId);
    return employee ? employee.name : employeeId;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'despachado': return 'bg-blue-100 text-blue-800';
      case 'en_proceso': return 'bg-yellow-100 text-yellow-800';
      case 'entregado': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'despachado': return 'Despachado';
      case 'en_proceso': return 'En Proceso';
      case 'entregado': return 'Entregado';
      default: return status;
    }
  };

  const getColombiaCurrentDateString = () => {
    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    return colombiaTime.toISOString().split('T')[0];
  };

  const parseDateForDisplay = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString + 'T00:00:00');
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
        <div className="mb-4 sm:mb-8">
          <div className="flex justify-between items-start gap-4 mb-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Despachos</h1>
              <p className="text-slate-600 text-sm sm:text-base">Material entregado a empleados para manufactura</p>
            </div>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 shrink-0">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nuevo Despacho</span>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className="w-full sm:w-[280px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Selecciona un rango</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los operarios" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.employee_id} value={e.employee_id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las referencias" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.reference} value={p.reference}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterEmployee || filterProduct) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterEmployee(""); setFilterProduct(""); }} className="text-slate-500 hover:text-red-600">
                <X className="w-4 h-4 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <DispatchForm
            dispatch={editingDispatch}
            employees={employees}
            products={products}
            inventory={inventory}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
        
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2">Resumen del Periodo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-blue-50 p-3 sm:p-6 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-blue-700">Total Despachado</p>
              <p className="text-2xl sm:text-4xl font-bold text-blue-800">{summary.totalQuantity.toLocaleString()}</p>
              <p className="text-xs text-blue-600">unidades</p>
            </div>
            <div className="bg-indigo-50 p-3 sm:p-6 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-indigo-700">Despachos Realizados</p>
              <p className="text-2xl sm:text-4xl font-bold text-indigo-800">{summary.totalDispatches}</p>
              <p className="text-xs text-indigo-600">registros</p>
            </div>
            <div className="col-span-2 md:col-span-1 space-y-2">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2"><ListTree className="w-5 h-5" />Por Referencia</h4>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
              {Object.keys(summary.byReference).length > 0 ? Object.entries(summary.byReference).map(([name, data]) => (
                <div key={name} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                  <div>
                    <span className="flex items-center gap-2"><Package className="w-4 h-4 text-slate-500"/>{name}</span>
                    <span className="text-xs text-slate-500">{data.count} despachos</span>
                  </div>
                  <span className="font-bold text-blue-800">{data.quantity.toLocaleString()}</span>
                </div>
              )) : <p className="text-sm text-slate-500 text-center py-4">Sin despachos en este periodo.</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="dispatches" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="dispatches" className="text-xs sm:text-sm">Despachos ({filteredDispatches.length})</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="dispatches">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TruckIcon className="w-5 h-5" />
                  Despachos Realizados
                </CardTitle>
              </CardHeader>
              <CardContent>
            {filteredDispatches.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredDispatches.map(dispatch => (
                  <Card key={dispatch.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg mb-1">
                            {getProductName(dispatch.product_reference)}
                          </h3>
                          <p className="text-sm text-slate-600 font-medium">
                            Para: {getEmployeeName(dispatch.employee_id)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(dispatch)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(dispatch)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-blue-50 p-3 rounded-lg text-center">
                          <p className="text-sm text-blue-600">Cantidad Despachada</p>
                          <p className="text-2xl font-bold text-blue-800">{dispatch.quantity}</p>
                          <p className="text-xs text-blue-600">unidades</p>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CalendarIcon className="w-4 h-4" />
                          {format(parseDateForDisplay(dispatch.dispatch_date), 'dd/MM/yyyy')}
                        </div>

                        <div className="flex justify-center">
                          <Badge className={getStatusColor(dispatch.status)}>
                            {getStatusText(dispatch.status)}
                          </Badge>
                        </div>

                        {dispatch.observations && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs font-semibold text-amber-800 mb-1">📝 Observaciones</p>
                            <p className="text-sm text-amber-900">{dispatch.observations}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <TruckIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No hay despachos en el periodo seleccionado.</p>
                <p className="text-sm">Ajusta las fechas para ver otros registros.</p>
              </div>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <ActivityHistory entityType="Dispatch" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}