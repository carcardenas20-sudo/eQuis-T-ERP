import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X, PackageCheck, Plus, Trash2 } from "lucide-react";

// Función auxiliar para obtener fecha de Colombia
const getColombiaTodayString = () => {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombiaTime.toISOString().split('T')[0];
};

export default function DeliveryForm({ delivery, employees, products, dispatches, allDeliveries, onSubmit, onCancel }) {
  const [productReference, setProductReference] = useState(delivery?.items?.[0]?.product_reference || delivery?.product_reference || "");
  const [employeeId, setEmployeeId] = useState(delivery?.employee_id || "");
  const [deliveryDate, setDeliveryDate] = useState(delivery?.delivery_date || getColombiaTodayString());
  const [items, setItems] = useState(delivery?.items || []);
  const [status, setStatus] = useState(delivery?.status || "pendiente");

  const getMaxAllowed = (productRef, currentIndex = null) => {
    if (!employeeId || !productRef) return 0;
    
    // Total despachado al empleado
    const totalDispatched = dispatches
      .filter(d => d.employee_id === employeeId && d.product_reference === productRef)
      .reduce((sum, d) => sum + d.quantity, 0);
    
    // Total ya entregado previamente (sin contar esta entrega si es edición)
    const totalDelivered = allDeliveries
      .filter(d => d.employee_id === employeeId && d.id !== delivery?.id)
      .reduce((sum, d) => {
        if (d.items && d.items.length > 0) {
          const item = d.items.find(i => i.product_reference === productRef);
          return sum + (item ? item.quantity : 0);
        }
        return sum + (d.product_reference === productRef ? d.quantity : 0);
      }, 0);

    // Total ya usado en OTROS items del formulario actual (no contar el item actual)
    const usedInCurrentForm = items
      .filter((i, idx) => i.product_reference === productRef && idx !== currentIndex)
      .reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0);

    const available = totalDispatched - totalDelivered - usedInCurrentForm;
    return Math.max(0, available);
  };

  const getDispatchedProducts = () => {
    if (!productReference) return [];
    return dispatches
      .filter(d => d.product_reference === productReference)
      .reduce((acc, d) => {
        if (!acc.includes(d.employee_id)) {
          acc.push(d.employee_id);
        }
        return acc;
      }, []);
  };

  const getEmployeesForProduct = () => {
    if (!productReference) return [];
    const employeeIds = dispatches
      .filter(d => d.product_reference === productReference)
      .map(d => d.employee_id)
      .filter((v, i, a) => a.indexOf(v) === i);
    return employees.filter(e => employeeIds.includes(e.employee_id));
  };


  const addItem = () => {
    if (!productReference) {
      alert("Primero selecciona una referencia de producto");
      return;
    }
    const product = products.find(p => p.reference === productReference);
    const price = product ? product.manufacturing_price : 0;
    setItems([...items, { 
      product_reference: productReference, 
      quantity: "", 
      unit_price: price, 
      total_amount: 0 
    }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    
    if (field === 'quantity') {
      const maxAllowed = getMaxAllowed(newItems[index].product_reference, index);
      const requestedQty = parseInt(value) || 0;
      
      if (requestedQty > maxAllowed) {
        const product = products.find(p => p.reference === newItems[index].product_reference);
        alert(`No puedes entregar más de ${maxAllowed} unidades de "${product?.name || newItems[index].product_reference}".\n\nDisponible: ${maxAllowed} unidades\nIntentando: ${requestedQty} unidades`);
        return;
      }
    }
    
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].unit_price) || 0;
      newItems[index].total_amount = qty * price;
    }
    
    setItems(newItems);
  };



  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!productReference) {
      alert("Selecciona una referencia de producto");
      return;
    }

    if (!employeeId) {
      alert("Selecciona un operario");
      return;
    }

    if (items.length === 0) {
      alert("Agrega al menos un producto");
      return;
    }

    const dispatchedEmployees = getDispatchedProducts();
    
    if (!dispatchedEmployees.includes(employeeId)) {
      alert(`ERROR: Este producto no ha sido despachado al operario seleccionado.\n\nPrimero debes despachar este producto al operario.`);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_reference || !item.quantity || !item.unit_price) {
        alert(`Completa todos los campos del item ${i + 1}`);
        return;
      }

      const maxAllowed = getMaxAllowed(item.product_reference, i);
      if (maxAllowed === 0) {
        const product = products.find(p => p.reference === item.product_reference);
        alert(`ERROR: No hay stock despachado disponible.\n\nDespachado: 0 unidades`);
        return;
      }
      
      if (parseInt(item.quantity) > maxAllowed) {
        const product = products.find(p => p.reference === item.product_reference);
        alert(`Excede la cantidad disponible.\n\nDisponible: ${maxAllowed} unidades\nIntentando entregar: ${item.quantity} unidades`);
        return;
      }
    }

    const processedItems = items.map(item => ({
      product_reference: item.product_reference,
      quantity: parseInt(item.quantity),
      unit_price: parseFloat(item.unit_price),
      total_amount: parseFloat(item.total_amount)
    }));

    const totalAmount = processedItems.reduce((sum, item) => sum + item.total_amount, 0);

    onSubmit({
      employee_id: employeeId,
      delivery_date: deliveryDate,
      items: processedItems,
      total_amount: totalAmount,
      status: status
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="w-5 h-5" />
          {delivery ? 'Editar Entrega' : 'Nueva Entrega de Producto'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_reference">Referencia del Producto *</Label>
              <select
                id="product_reference"
                value={productReference}
                onChange={(e) => {
                  setProductReference(e.target.value);
                  setEmployeeId("");
                  setItems([]);
                }}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">Seleccione una referencia</option>
                {products.filter(p => p.is_active).map(product => (
                  <option key={product.reference} value={product.reference}>
                    {product.name} ({product.reference})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_id">Operario *</Label>
              <select
                id="employee_id"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                disabled={!productReference}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">
                  {productReference ? "Seleccione un operario" : "Primero seleccione producto"}
                </option>
                {productReference && getEmployeesForProduct().map(employee => (
                  <option key={employee.employee_id} value={employee.employee_id}>
                    {employee.name} ({employee.employee_id})
                  </option>
                ))}
              </select>
              {productReference && getEmployeesForProduct().length === 0 && (
                <p className="text-xs text-red-600">⚠️ No hay operarios con este producto despachado</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Fecha de Entrega *</Label>
              <Input
                id="delivery_date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estado del Pago</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <Label className="text-base font-semibold">Productos Entregados</Label>
              <Button type="button" onClick={addItem} size="sm" className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No hay productos agregados. Haz clic en "Agregar Producto".</p>
            )}

            <div className="space-y-3">
              {items.map((item, index) => {
                const maxAllowed = getMaxAllowed(item.product_reference, index);
                return (
                  <Card key={index} className="bg-slate-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 grid md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Cantidad *</Label>
                            <Input
                              type="number"
                              min="1"
                              max={maxAllowed}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              onBlur={(e) => {
                                const currentMax = getMaxAllowed(item.product_reference, index);
                                const val = parseInt(e.target.value) || 0;
                                if (val > currentMax) {
                                  updateItem(index, 'quantity', currentMax.toString());
                                }
                              }}
                              required
                              className="h-9"
                            />
                            {maxAllowed !== null && maxAllowed > 0 ? (
                              <p className="text-xs text-blue-600 font-medium">Máx disponible: {maxAllowed}</p>
                            ) : (
                              <p className="text-xs text-red-600 font-medium">Sin stock despachado</p>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Precio Unit.</Label>
                            <div className="h-9 flex items-center px-3 bg-slate-100 rounded-md border text-sm">
                              ${(parseFloat(item.unit_price) || 0).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Subtotal</Label>
                            <div className="h-9 flex items-center px-3 bg-white rounded-md border text-sm font-medium">
                              ${item.total_amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700 mb-1">Total de la Entrega:</p>
              <p className="text-2xl font-bold text-green-800">
                ${items.reduce((sum, item) => sum + (item.total_amount || 0), 0).toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {delivery ? 'Actualizar' : 'Registrar'} Entrega
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}