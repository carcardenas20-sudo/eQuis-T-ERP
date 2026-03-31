import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Calendar, TruckIcon, PackageCheck, Plus, Trash2, Save } from "lucide-react";
import BulkDeliveryForm from "@/components/operations/BulkDeliveryForm";

const getColombiaTodayString = () => {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombiaTime.toISOString().split('T')[0];
};

export default function DailyOperations() {
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState(getColombiaTodayString());
  const [dispatches, setDispatches] = useState([{ product_reference: "", quantity: "" }]);
  const [deliveries, setDeliveries] = useState([{ product_reference: "", quantity: "" }]);
  const [loading, setLoading] = useState(true);
  const [allDispatches, setAllDispatches] = useState([]);
  const [allDeliveries, setAllDeliveries] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesData, productsData, inventoryData, dispatchesData, deliveriesData] = await Promise.all([
        base44.entities.Employee.list(),
        base44.entities.Producto.list(),
        base44.entities.Inventory.list(),
        base44.entities.Dispatch.list(),
        base44.entities.Delivery.list()
      ]);
      setEmployees(employeesData || []);
      setProducts((productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
      setInventory(inventoryData || []);
      setAllDispatches(dispatchesData || []);
      setAllDeliveries(deliveriesData || []);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const getAvailableStock = (productReference) => {
    const inventoryItem = inventory.find(inv => inv.product_reference === productReference);
    return inventoryItem ? inventoryItem.current_stock : 0;
  };

  const getDispatchedToEmployee = (productReference) => {
    if (!selectedEmployee) return 0;
    
    // Calcular total despachado
    const totalDispatched = allDispatches
      .filter(d => d.employee_id === selectedEmployee && d.product_reference === productReference)
      .reduce((sum, d) => sum + (d.quantity || 0), 0);
    
    // Calcular total entregado (usando el nuevo sistema de items y el legacy)
    const totalDelivered = allDeliveries
      .filter(d => d.employee_id === selectedEmployee)
      .reduce((sum, delivery) => {
        if (delivery.items && delivery.items.length > 0) {
          const item = delivery.items.find(i => i.product_reference === productReference);
          return sum + (item ? (item.quantity || 0) : 0);
        }
        // Legacy: solo si la entrega tiene el campo product_reference
        if (delivery.product_reference === productReference && delivery.quantity) {
          return sum + (delivery.quantity || 0);
        }
        return sum;
      }, 0);

    const available = totalDispatched - totalDelivered;
    return available > 0 ? available : 0;
  };

  const addDispatch = () => {
    setDispatches([...dispatches, { product_reference: "", quantity: "" }]);
  };

  const removeDispatch = (index) => {
    setDispatches(dispatches.filter((_, i) => i !== index));
  };

  const updateDispatch = (index, field, value) => {
    const newDispatches = [...dispatches];
    newDispatches[index][field] = value;
    setDispatches(newDispatches);
  };

  const addDelivery = () => {
    setDeliveries([...deliveries, { product_reference: "", quantity: "" }]);
  };

  const removeDelivery = (index) => {
    setDeliveries(deliveries.filter((_, i) => i !== index));
  };

  const updateDelivery = (index, field, value) => {
    const newDeliveries = [...deliveries];
    newDeliveries[index][field] = value;
    setDeliveries(newDeliveries);
  };



  const handleSubmitDispatches = async () => {
    if (!selectedEmployee) {
      alert("Selecciona un operario");
      return;
    }

    const validDispatches = dispatches.filter(d => d.product_reference && d.quantity && parseInt(d.quantity) > 0);
    
    if (validDispatches.length === 0) {
      alert("No hay despachos para registrar");
      return;
    }

    try {
      for (const dispatch of validDispatches) {
        const quantity = parseInt(dispatch.quantity);
        const availableStock = getAvailableStock(dispatch.product_reference);

        if (quantity > availableStock) {
          const product = products.find(p => p.reference === dispatch.product_reference);
          alert(`Stock insuficiente para ${product?.name}. Disponible: ${availableStock}`);
          return;
        }
      }

      const employee = employees.find(e => e.employee_id === selectedEmployee);
      
      for (const dispatch of validDispatches) {
        const quantity = parseInt(dispatch.quantity);
        const product = products.find(p => p.reference === dispatch.product_reference);
        const availableStock = getAvailableStock(dispatch.product_reference);

        const dispatchData = {
          employee_id: selectedEmployee,
          product_reference: dispatch.product_reference,
          quantity: quantity,
          dispatch_date: selectedDate,
          status: "despachado"
        };

        const newDispatch = await base44.entities.Dispatch.create(dispatchData);

        await base44.entities.ActivityLog.create({
          entity_type: 'Dispatch',
          entity_id: newDispatch.id,
          action: 'created',
          description: `Nuevo despacho - ${product?.name || dispatch.product_reference} - Cantidad: ${quantity}`,
          employee_id: selectedEmployee,
          employee_name: employee?.name || selectedEmployee,
          new_data: dispatchData
        });

        const inventoryItem = inventory.find(inv => inv.product_reference === dispatch.product_reference);
        const newStock = availableStock - quantity;

        await base44.entities.StockMovement.create({
          product_reference: dispatch.product_reference,
          movement_type: "salida",
          quantity: quantity,
          movement_date: selectedDate,
          reason: `Despacho a empleado ${employee?.name || selectedEmployee}`,
          previous_stock: availableStock,
          new_stock: newStock
        });

        if (inventoryItem) {
          await base44.entities.Inventory.update(inventoryItem.id, {
            current_stock: newStock
          });
        }
      }

      alert("Despachos registrados exitosamente");
      setDispatches([{ product_reference: "", quantity: "" }]);
      loadData();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al registrar despachos");
    }
  };

  const handleSubmitDeliveries = async () => {
    if (!selectedEmployee) {
      alert("Selecciona un operario");
      return;
    }

    const validDeliveries = deliveries.filter(d => d.product_reference && d.quantity && parseInt(d.quantity) > 0);
    
    if (validDeliveries.length === 0) {
      alert("No hay entregas para registrar");
      return;
    }

    try {
      for (const delivery of validDeliveries) {
        const quantity = parseInt(delivery.quantity);
        const available = getDispatchedToEmployee(delivery.product_reference);

        if (quantity > available) {
          const product = products.find(p => p.reference === delivery.product_reference);
          alert(`Cantidad excede lo despachado para ${product?.name}. Disponible: ${available}`);
          return;
        }
      }

      const employee = employees.find(e => e.employee_id === selectedEmployee);
      const items = validDeliveries.map(d => {
        const product = products.find(p => p.reference === d.product_reference);
        const unitPrice = product ? product.manufacturing_price : 0;
        const quantity = parseInt(d.quantity);
        return {
          product_reference: d.product_reference,
          quantity: quantity,
          unit_price: unitPrice,
          total_amount: quantity * unitPrice
        };
      });

      const totalAmount = items.reduce((sum, item) => sum + item.total_amount, 0);

      const deliveryData = {
        employee_id: selectedEmployee,
        delivery_date: selectedDate,
        items: items,
        total_amount: totalAmount,
        status: "pendiente"
      };

      const newDelivery = await base44.entities.Delivery.create(deliveryData);

      const itemsDesc = items.map(i => {
        const product = products.find(p => p.reference === i.product_reference);
        return `${product?.name || i.product_reference} (${i.quantity})`;
      }).join(', ');

      await base44.entities.ActivityLog.create({
        entity_type: 'Delivery',
        entity_id: newDelivery.id,
        action: 'created',
        description: `Nueva entrega registrada - ${itemsDesc} - Total: $${totalAmount.toLocaleString()}`,
        employee_id: selectedEmployee,
        employee_name: employee?.name || selectedEmployee,
        amount: totalAmount,
        new_data: deliveryData
      });

      alert("Entregas registradas exitosamente");
      setDeliveries([{ product_reference: "", quantity: "" }]);
      loadData();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al registrar entregas");
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const employeeName = employees.find(e => e.employee_id === selectedEmployee)?.name || "";

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Operaciones Diarias</h1>
          <p className="text-sm sm:text-base text-slate-600">Registra despachos y entregas por operario y fecha</p>
        </div>

        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="mb-4 sm:mb-6">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="masivo">Registro Masivo</TabsTrigger>
          </TabsList>

          <TabsContent value="masivo">
            <BulkDeliveryForm
              employees={employees}
              products={products.filter(p => p.is_active)}
              allDispatches={allDispatches}
              allDeliveries={allDeliveries}
              inventory={inventory}
              onSaved={loadData}
            />
          </TabsContent>

          <TabsContent value="individual">
            <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Selección de Operario y Fecha</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Operario *</Label>
                <select
                  id="employee"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecciona un operario</option>
                  {employees.filter(e => e.is_active).map(employee => (
                    <option key={employee.employee_id} value={employee.employee_id}>
                      {employee.name} ({employee.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
            {selectedEmployee && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <strong>Operario:</strong> {employeeName}
                </p>
                <p className="text-sm text-blue-900 flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4" />
                  <strong>Fecha:</strong> {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CO', {timeZone: 'America/Bogota'})}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <PackageCheck className="w-5 h-5" />
                Entregas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {deliveries.map((delivery, index) => (
               <div key={index} className="flex flex-col sm:flex-row gap-2 items-start bg-slate-50 p-3 rounded-lg">
                 <div className="flex-1 w-full space-y-2">
                   <select
                     value={delivery.product_reference}
                     onChange={(e) => updateDelivery(index, 'product_reference', e.target.value)}
                     disabled={!selectedEmployee}
                     className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm"
                   >
                     <option value="">Referencia</option>
                     {products.filter(p => p.is_active).map(product => (
                       <option key={product.reference} value={product.reference}>
                         {product.name}
                       </option>
                     ))}
                   </select>
                   <Input
                     type="number"
                     min="1"
                     placeholder="Cantidad"
                     value={delivery.quantity}
                     onChange={(e) => updateDelivery(index, 'quantity', e.target.value)}
                     disabled={!selectedEmployee}
                     className="h-9"
                   />
                   {delivery.product_reference && (
                     <p className="text-xs text-slate-600">
                       Despachado disponible: <strong>{getDispatchedToEmployee(delivery.product_reference)}</strong>
                     </p>
                   )}
                 </div>
                 <Button
                   type="button"
                   variant="ghost"
                   size="icon"
                   onClick={() => removeDelivery(index)}
                   className="text-red-600 hover:bg-red-50 sm:mt-0 w-full sm:w-auto"
                 >
                   <Trash2 className="w-4 h-4" />
                 </Button>
               </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2">
               <Button
                 onClick={addDelivery}
                 variant="outline"
                 className="flex-1 w-full text-sm"
                 disabled={!selectedEmployee}
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Agregar Entrega
               </Button>
               <Button
                 onClick={handleSubmitDeliveries}
                 className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none text-sm"
                 disabled={!selectedEmployee}
               >
                 <Save className="w-4 h-4 mr-2" />
                 Guardar Entregas
               </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <TruckIcon className="w-5 h-5" />
                Despachos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {dispatches.map((dispatch, index) => (
               <div key={index} className="flex flex-col sm:flex-row gap-2 items-start bg-slate-50 p-3 rounded-lg">
                 <div className="flex-1 w-full space-y-2">
                   <select
                     value={dispatch.product_reference}
                     onChange={(e) => updateDispatch(index, 'product_reference', e.target.value)}
                     disabled={!selectedEmployee}
                     className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm"
                   >
                     <option value="">Referencia</option>
                     {products.filter(p => p.is_active).map(product => {
                       const stock = getAvailableStock(product.reference);
                       return (
                         <option key={product.reference} value={product.reference}>
                           {product.name} - Stock: {stock}
                         </option>
                       );
                     })}
                   </select>
                   <Input
                     type="number"
                     min="1"
                     placeholder="Cantidad"
                     value={dispatch.quantity}
                     onChange={(e) => updateDispatch(index, 'quantity', e.target.value)}
                     disabled={!selectedEmployee}
                     className="h-9"
                   />
                   {dispatch.product_reference && (
                     <p className="text-xs text-slate-600">
                       Stock disponible: <strong>{getAvailableStock(dispatch.product_reference)}</strong>
                     </p>
                   )}
                 </div>
                 <Button
                   type="button"
                   variant="ghost"
                   size="icon"
                   onClick={() => removeDispatch(index)}
                   className="text-red-600 hover:bg-red-50 w-full sm:w-auto"
                 >
                   <Trash2 className="w-4 h-4" />
                 </Button>
               </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2">
               <Button
                 onClick={addDispatch}
                 variant="outline"
                 className="flex-1 w-full text-sm"
                 disabled={!selectedEmployee}
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Agregar Despacho
               </Button>
               <Button
                 onClick={handleSubmitDispatches}
                 className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none text-sm"
                 disabled={!selectedEmployee}
               >
                 <Save className="w-4 h-4 mr-2" />
                 Guardar Despachos
               </Button>
              </div>
            </CardContent>
          </Card>
          </div>
          </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}