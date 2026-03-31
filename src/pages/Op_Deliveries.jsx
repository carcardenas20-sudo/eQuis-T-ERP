import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageCheck, Plus, Edit, Trash2, Calendar as CalendarIcon, DollarSign, Package, ListTree, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";

import DeliveryForm from "../components/deliveries/DeliveryForm";
import ActivityHistory from "../components/history/ActivityHistory";

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [dispatches, setDispatches] = useState([]); // New state for dispatches
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [date, setDate] = useState({
    from: subDays(new Date(), 29), // Por defecto los últimos 30 días
    to: new Date(),
  });
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!date?.from) {
      setFilteredDeliveries(deliveries);
      return;
    }

    const fromDate = new Date(date.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = date.to ? new Date(date.to) : new Date(date.from);
    toDate.setHours(23, 59, 59, 999);

    let filtered = deliveries.filter(d => {
      if (!d.delivery_date) return false;
      const deliveryDate = new Date(d.delivery_date + 'T00:00:00');
      return deliveryDate >= fromDate && deliveryDate <= toDate;
    });

    if (filterEmployee) {
      filtered = filtered.filter(d => d.employee_id === filterEmployee);
    }

    if (filterProduct) {
      filtered = filtered.filter(d => {
        if (d.items && d.items.length > 0) {
          return d.items.some(i => i.product_reference === filterProduct);
        }
        return d.product_reference === filterProduct;
      });
    }

    setFilteredDeliveries(filtered);
  }, [date, deliveries, filterEmployee, filterProduct]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deliveriesData, employeesData, productsData, dispatchesData] = await Promise.all([
        base44.entities.Delivery.list('-delivery_date'),
        base44.entities.Employee.list(),
        base44.entities.Producto.list(),
        base44.entities.Dispatch.list()
      ]);
      setDeliveries(deliveriesData || []);
      setEmployees(employeesData || []);
      setProducts((productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
      setDispatches(dispatchesData || []);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const handleSubmit = async (deliveryData) => {
    try {
      let deliveryId;
      const employee = employees.find(e => e.employee_id === deliveryData.employee_id);
      
      if (editingDelivery) {
        await base44.entities.Delivery.update(editingDelivery.id, deliveryData);
        deliveryId = editingDelivery.id;
        
        const itemsDesc = deliveryData.items?.map(i => `${getProductName(i.product_reference)} (${i.quantity})`).join(', ') || 
                          `${getProductName(deliveryData.product_reference)} (${deliveryData.quantity})`;
        await base44.entities.ActivityLog.create({
          entity_type: 'Delivery',
          entity_id: deliveryId,
          action: 'updated',
          description: `Entrega actualizada - ${itemsDesc} - Total: $${deliveryData.total_amount.toLocaleString()}`,
          employee_id: deliveryData.employee_id,
          employee_name: employee?.name || deliveryData.employee_id,
          amount: deliveryData.total_amount,
          new_data: deliveryData,
          previous_data: editingDelivery
        });
      } else {
        const newDelivery = await base44.entities.Delivery.create(deliveryData);
        deliveryId = newDelivery.id;
        
        const itemsDesc = deliveryData.items?.map(i => `${getProductName(i.product_reference)} (${i.quantity})`).join(', ') || 
                          `${getProductName(deliveryData.product_reference)} (${deliveryData.quantity})`;
        await base44.entities.ActivityLog.create({
          entity_type: 'Delivery',
          entity_id: deliveryId,
          action: 'created',
          description: `Nueva entrega registrada - ${itemsDesc} - Total: $${deliveryData.total_amount.toLocaleString()}`,
          employee_id: deliveryData.employee_id,
          employee_name: employee?.name || deliveryData.employee_id,
          amount: deliveryData.total_amount,
          new_data: deliveryData
        });
      }
      setShowForm(false);
      setEditingDelivery(null);
      loadData();
    } catch (error) {
      console.error("Error saving delivery:", error);
      alert("Error al guardar la entrega.");
    }
  };

  const handleEdit = (delivery) => {
    setEditingDelivery(delivery);
    setShowForm(true);
  };

  const handleDelete = async (delivery) => {
    if (window.confirm(`¿Estás seguro de eliminar esta entrega?`)) {
      try {
        const employee = employees.find(e => e.employee_id === delivery.employee_id);
        
        await base44.entities.Delivery.delete(delivery.id);
        
        const itemsDesc = delivery.items?.map(i => `${getProductName(i.product_reference)} (${i.quantity})`).join(', ') || 
                          `${getProductName(delivery.product_reference)} (${delivery.quantity})`;
        await base44.entities.ActivityLog.create({
          entity_type: 'Delivery',
          entity_id: delivery.id,
          action: 'deleted',
          description: `Entrega eliminada - ${itemsDesc} - Total: $${delivery.total_amount.toLocaleString()}`,
          employee_id: delivery.employee_id,
          employee_name: employee?.name || delivery.employee_id,
          amount: delivery.total_amount,
          previous_data: delivery
        });
        
        loadData();
      } catch (error) {
        console.error("Error deleting delivery:", error);
        alert("Error al eliminar la entrega.");
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDelivery(null);
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.employee_id === employeeId);
    return employee ? employee.name : employeeId;
  };

  const getProductName = (reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : `Ref. ${reference}`;
  };

  // Calcular resumen
  const summary = React.useMemo(() => {
    const totalAmount = filteredDeliveries.reduce((sum, d) => sum + (d.total_amount || 0), 0);
    const totalUnits = filteredDeliveries.reduce((sum, d) => {
      if (d.items && d.items.length > 0) {
        return sum + d.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }
      return sum + (d.quantity || 0);
    }, 0);

    const byReference = {};
    filteredDeliveries.forEach(d => {
      if (d.items && d.items.length > 0) {
        d.items.forEach(item => {
          const productName = getProductName(item.product_reference);
          if (!byReference[productName]) {
            byReference[productName] = { quantity: 0, amount: 0 };
          }
          byReference[productName].quantity += item.quantity || 0;
          byReference[productName].amount += item.total_amount || 0;
        });
      } else if (d.product_reference) {
        const productName = getProductName(d.product_reference);
        if (!byReference[productName]) {
          byReference[productName] = { quantity: 0, amount: 0 };
        }
        byReference[productName].quantity += d.quantity || 0;
        byReference[productName].amount += d.total_amount || 0;
      }
    });
    
    return { totalAmount, totalUnits, byReference };
  }, [filteredDeliveries, products]);

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
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Entregas</h1>
              <p className="text-slate-600 text-sm sm:text-base">Registro de productos entregados por empleados</p>
            </div>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 shrink-0">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nueva Entrega</span>
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
          <DeliveryForm
            delivery={editingDelivery}
            employees={employees}
            products={products}
            dispatches={dispatches}
            allDeliveries={deliveries}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}

        <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2">Resumen del Periodo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-green-50 p-3 sm:p-6 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-green-700">Total Entregado</p>
              <p className="text-2xl sm:text-4xl font-bold text-green-800">{summary.totalUnits.toLocaleString()}</p>
              <p className="text-xs text-green-600">unidades</p>
            </div>
            <div className="bg-blue-50 p-3 sm:p-6 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-blue-700">Valor Total</p>
              <p className="text-lg sm:text-4xl font-bold text-blue-800 break-all">${summary.totalAmount.toLocaleString()}</p>
              <p className="text-xs text-blue-600">pesos</p>
            </div>
            <div className="col-span-2 md:col-span-1 space-y-2">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2"><ListTree className="w-5 h-5" />Por Referencia</h4>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
              {Object.keys(summary.byReference).length > 0 ? Object.entries(summary.byReference).map(([name, data]) => (
                <div key={name} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                  <div>
                    <span className="flex items-center gap-2"><Package className="w-4 h-4 text-slate-500"/>{name}</span>
                    <span className="text-xs text-slate-500">{data.quantity} unidades</span>
                  </div>
                  <span className="font-bold text-green-800">${data.amount.toLocaleString()}</span>
                </div>
              )) : <p className="text-sm text-slate-500 text-center py-4">Sin entregas en este periodo.</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="deliveries" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="deliveries" className="text-xs sm:text-sm">Entregas ({filteredDeliveries.length})</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="deliveries">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageCheck className="w-5 h-5" />
                  Entregas Registradas
                </CardTitle>
              </CardHeader>
              <CardContent>
            {filteredDeliveries.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredDeliveries.map(delivery => (
                  <Card key={delivery.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 text-lg mb-1">
                            {delivery.items && delivery.items.length > 0 ? (
                              delivery.items.length === 1 ? (
                                getProductName(delivery.items[0].product_reference)
                              ) : (
                                `${delivery.items.length} Productos`
                              )
                            ) : (
                              getProductName(delivery.product_reference)
                            )}
                          </h3>
                          <p className="text-sm text-slate-600 font-medium">
                            {getEmployeeName(delivery.employee_id)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(delivery)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(delivery)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {delivery.items && delivery.items.length > 0 ? (
                          <div className="space-y-2">
                            {delivery.items.map((item, idx) => (
                              <div key={idx} className="bg-blue-50 p-3 rounded-lg">
                                <div className="flex justify-between items-center mb-1">
                                  <p className="text-sm font-medium text-blue-900">{getProductName(item.product_reference)}</p>
                                  <p className="text-sm font-bold text-blue-800">${item.total_amount?.toLocaleString()}</p>
                                </div>
                                <div className="flex justify-between text-xs text-blue-700">
                                  <span>{item.quantity} unidades</span>
                                  <span>${item.unit_price?.toLocaleString()} c/u</span>
                                </div>
                              </div>
                            ))}
                            <div className="bg-green-50 p-3 rounded-lg border-2 border-green-200">
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-semibold text-green-900">Total General</p>
                                <p className="text-lg font-bold text-green-800">${delivery.total_amount?.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                              <div>
                                <p className="text-sm text-blue-600">Cantidad</p>
                                <p className="font-bold text-blue-800">{delivery.quantity} unidades</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-blue-600">Total</p>
                                <p className="font-bold text-blue-800">${delivery.total_amount?.toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <DollarSign className="w-4 h-4" />
                              ${delivery.unit_price?.toLocaleString()} por unidad
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CalendarIcon className="w-4 h-4" />
                          {new Date(delivery.delivery_date + 'T00:00:00').toLocaleDateString('es-CO', {timeZone: 'America/Bogota'})}
                        </div>

                        <div className="flex justify-center">
                          <Badge className={delivery.status === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {delivery.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <PackageCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No hay entregas en el periodo seleccionado.</p>
                <p className="text-sm">Ajusta las fechas para ver otros registros.</p>
              </div>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <ActivityHistory entityType="Delivery" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}