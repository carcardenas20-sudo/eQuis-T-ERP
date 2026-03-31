import React, { useState } from "react";
import { base44 } from "@/api/base44Combined";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Trash2 } from "lucide-react";

export default function NewPurchaseForm({ employees, products, dispatches, deliveries = [], purchases = [], onClose, onSaved }) {
  const [employeeId, setEmployeeId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("descuento_saldo");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty] = useState("");
  const [saving, setSaving] = useState(false);

  // Stock disponible = total despachado - total entregado - ya comprado con descuento_saldo
  const getAvailableStock = () => {
    if (!employeeId) return {};
    const stock = {};

    // Sumar todos los despachos del empleado
    dispatches
      .filter(d => d.employee_id === employeeId)
      .forEach(d => {
        stock[d.product_reference] = (stock[d.product_reference] || 0) + (d.quantity || 0);
      });

    // Restar lo que ya entregó (por delivery items o legacy)
    deliveries
      .filter(d => d.employee_id === employeeId)
      .forEach(d => {
        if (d.items && d.items.length > 0) {
          d.items.forEach(item => {
            stock[item.product_reference] = (stock[item.product_reference] || 0) - (item.quantity || 0);
          });
        } else if (d.product_reference) {
          stock[d.product_reference] = (stock[d.product_reference] || 0) - (d.quantity || 0);
        }
      });

    // Solo stock positivo
    Object.keys(stock).forEach(ref => { if (stock[ref] <= 0) delete stock[ref]; });
    return stock;
  };

  const availableStock = getAvailableStock();

  // Productos que el empleado tiene despachados (pendientes de entregar)
  const availableProducts = products.filter(p => availableStock[p.reference] > 0);

  // Cuánto ya fue agregado al carrito por referencia
  const cartQtyByRef = {};
  items.forEach(i => { cartQtyByRef[i.product_reference] = (cartQtyByRef[i.product_reference] || 0) + i.quantity; });

  const addItem = () => {
    if (!selProduct || !selQty || parseFloat(selQty) <= 0) return;
    const prod = products.find(p => p.reference === selProduct);
    if (!prod) return;
    const qty = parseFloat(selQty);
    const maxAvailable = (availableStock[selProduct] || 0) - (cartQtyByRef[selProduct] || 0);
    if (qty > maxAvailable) {
      alert(`Solo hay ${maxAvailable} unidades disponibles de "${prod.name}" en los despachos de este operario.`);
      return;
    }
    const unitPrice = prod.employee_price || prod.manufacturing_price;
    setItems(prev => [...prev, {
      product_reference: prod.reference,
      product_name: prod.name,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: unitPrice * qty
    }]);
    setSelProduct("");
    setSelQty("");
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const cartTotal = items.reduce((s, i) => s + i.total_amount, 0);

  const save = async () => {
    // Auto-agregar ítem pendiente si hay producto y cantidad seleccionados
    let finalItems = [...items];
    if (selProduct && selQty && parseFloat(selQty) > 0) {
      const prod = products.find(p => p.reference === selProduct);
      if (prod) {
        const qty = parseFloat(selQty);
        const maxAvailable = (availableStock[selProduct] || 0) - (cartQtyByRef[selProduct] || 0);
        if (qty <= maxAvailable) {
          const unitPrice = prod.employee_price || prod.manufacturing_price;
          finalItems = [...finalItems, {
            product_reference: prod.reference,
            product_name: prod.name,
            quantity: qty,
            unit_price: unitPrice,
            total_amount: unitPrice * qty
          }];
        }
      }
    }
    if (!employeeId || finalItems.length === 0) return alert("Selecciona un operario y agrega al menos un ítem.");
    // Usar finalItems en lugar de items para el resto del proceso
    const itemsToSave = finalItems;
    setSaving(true);

    const total = itemsToSave.reduce((s, i) => s + i.total_amount, 0);
    // 1. Guardar la compra
    await base44.entities.EmployeePurchase.create({
      employee_id: employeeId,
      purchase_date: purchaseDate,
      items: itemsToSave,
      total_amount: total,
      payment_method: paymentMethod,
      credit_paid_amount: 0,
      credit_status: paymentMethod === 'credito' ? 'pendiente' : 'pagado',
      notes
    });

    // 2. Crear un registro de Delivery con precio de manufactura (cuenta como entregado y genera ingreso al operario)
    // y descontar los despachos correspondientes
    const deliveryItems = itemsToSave.map(item => {
      const prod = products.find(p => p.reference === item.product_reference);
      const mfgPrice = prod?.manufacturing_price || 0;
      return {
        product_reference: item.product_reference,
        quantity: item.quantity,
        unit_price: mfgPrice,
        total_amount: mfgPrice * item.quantity
      };
    });

    const deliveryTotal = deliveryItems.reduce((s, i) => s + i.total_amount, 0);

    await base44.entities.Delivery.create({
      employee_id: employeeId,
      delivery_date: purchaseDate,
      items: deliveryItems,
      total_amount: deliveryTotal,
      status: 'pendiente',
      notes: `Compra empleado - ${paymentMethod}`
    });

    // 3. Descontar unidades del despacho (para todos los métodos de pago)
    for (const item of itemsToSave) {
      let qtyToDiscount = item.quantity;
      const empDispatches = dispatches
        .filter(d => d.employee_id === employeeId && d.product_reference === item.product_reference && d.status !== 'entregado')
        .sort((a, b) => new Date(a.dispatch_date) - new Date(b.dispatch_date));

      for (const dispatch of empDispatches) {
        if (qtyToDiscount <= 0) break;
        const reduce = Math.min(qtyToDiscount, dispatch.quantity);
        const newQty = dispatch.quantity - reduce;
        if (newQty <= 0) {
          await base44.entities.Dispatch.update(dispatch.id, { status: 'entregado', quantity: 0 });
        } else {
          await base44.entities.Dispatch.update(dispatch.id, { quantity: newQty });
        }
        qtyToDiscount -= reduce;
      }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nueva Compra de Empleado</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Empleado y fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Operario *</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar operario" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.employee_id} value={e.employee_id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha</label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          {/* Forma de pago */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Forma de Pago *</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="descuento_saldo">Descuento de saldo pendiente</SelectItem>
                <SelectItem value="contado">Contado (efectivo)</SelectItem>
                <SelectItem value="credito">A crédito</SelectItem>
              </SelectContent>
            </Select>
            {paymentMethod === 'descuento_saldo' && (
              <p className="text-xs text-blue-600 mt-1">💡 Se restará automáticamente del saldo que se le debe al operario.</p>
            )}
            {paymentMethod === 'credito' && (
              <p className="text-xs text-orange-600 mt-1">💳 Queda como deuda pendiente del operario.</p>
            )}
          </div>

          {/* Agregar productos */}
          <div className="border rounded-lg p-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Agregar prendas</p>
            <div className="flex gap-2">
              <Select value={selProduct} onValueChange={v => { setSelProduct(v); setSelQty(""); }} disabled={!employeeId}>
                <SelectTrigger className="flex-1 text-xs">
                  <SelectValue placeholder={employeeId ? "Producto disponible" : "Primero selecciona un operario"} />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.length === 0 && employeeId ? (
                    <div className="px-3 py-2 text-xs text-slate-500">Sin despachos pendientes</div>
                  ) : (
                    availableProducts.map(p => {
                      const inCart = cartQtyByRef[p.reference] || 0;
                      const remaining = availableStock[p.reference] - inCart;
                      return (
                        <SelectItem key={p.reference} value={p.reference} disabled={remaining <= 0}>
                          {p.name} — ${(p.employee_price || p.manufacturing_price).toLocaleString()} · {remaining} disp.
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <Input
                type="number" min="1"
                max={selProduct ? (availableStock[selProduct] || 0) - (cartQtyByRef[selProduct] || 0) : undefined}
                placeholder="Cant."
                value={selQty} onChange={e => setSelQty(e.target.value)}
                className="w-20 text-xs" onKeyDown={e => e.key === 'Enter' && addItem()}
              />
              <Button size="sm" onClick={addItem} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Tabla de ítems */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white border rounded-lg p-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{item.product_name}</p>
                    <p className="text-xs text-slate-500">{item.quantity} x ${item.unit_price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-blue-600">${item.total_amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t font-bold text-slate-800">
                <span>Total:</span>
                <span className="text-lg text-blue-600">${cartTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Observaciones (opcional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: prenda para regalo..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {saving ? "Guardando..." : "Registrar Compra"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}