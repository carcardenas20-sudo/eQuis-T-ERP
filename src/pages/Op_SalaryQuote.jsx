import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, DollarSign, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SalaryQuote() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchasesData, setPurchasesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, employeesData, deliveriesData, paymentsData, purchData] = await Promise.all([
        base44.entities.Producto.list(),
        base44.entities.Employee.list(),
        base44.entities.Delivery.list(),
        base44.entities.Payment.list(),
        base44.entities.EmployeePurchase.list()
      ]);
      setProducts((productsData || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
      setEmployees(employeesData.filter(e => e.is_active));
      setDeliveries(deliveriesData);
      setPayments(paymentsData);
      setPurchasesData(purchData);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
    setLoading(false);
  };

  const getDeliveryAmount = (d) => {
    if (d.total_amount) return d.total_amount;
    if (d.items && d.items.length > 0) {
      return d.items.reduce((s, item) => s + (item.total_amount || (item.quantity * item.unit_price) || 0), 0);
    }
    if (d.quantity && d.unit_price) return d.quantity * d.unit_price;
    return 0;
  };

  const getEmployeeSystemData = () => {
    if (!selectedEmployee) return null;

    const empDeliveries = deliveries.filter(d => d.employee_id === selectedEmployee);
    const empPayments = payments.filter(p => p.employee_id === selectedEmployee);

    // Pagos vinculados a entregas (sistema nuevo)
    const deliveryPaidAmounts = {};
    empPayments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    // Entregas pagadas completamente (sistema antiguo)
    const paidDeliveryIds = new Set();
    empPayments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) {
        p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
      }
    });

    // Pendiente por entrega
    const pendingDeliveries = [];
    empDeliveries.forEach(delivery => {
      if (delivery.status === 'pagado' || paidDeliveryIds.has(delivery.id)) return;
      const earned = getDeliveryAmount(delivery);
      const paid = deliveryPaidAmounts[delivery.id] || 0;
      const pending = earned - paid;
      if (pending > 0) pendingDeliveries.push({ ...delivery, pending_amount: pending });
    });

    // Avances con delivery_ids (datos históricos): aplicar monto a esas entregas específicas
    const linkedAvances = empPayments
      .filter(p => p.payment_type !== 'pago_completo' && (!p.delivery_payments || p.delivery_payments.length === 0) && p.delivery_ids && p.delivery_ids.length > 0)
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    linkedAvances.forEach(payment => {
      let remaining = payment.amount;
      const linkedDeliveries = pendingDeliveries.filter(d => payment.delivery_ids.includes(d.id));
      linkedDeliveries.forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    // Aplicar pagos genéricos cronológicamente
    const genericPayments = empPayments
      .filter(p => (!p.delivery_payments || p.delivery_payments.length === 0) && (!p.delivery_ids || p.delivery_ids.length === 0))
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    pendingDeliveries.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
    genericPayments.forEach(payment => {
      let remaining = payment.amount;
      pendingDeliveries.forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    const rawPending = pendingDeliveries.reduce((sum, d) => sum + Math.max(0, d.pending_amount), 0);
    const totalEarned = empDeliveries.reduce((sum, d) => sum + getDeliveryAmount(d), 0);
    const totalPaid = empPayments.reduce((sum, p) => sum + p.amount, 0);

    // Descontar compras por descuento_saldo
    const purchaseDiscounts = purchasesData
      .filter(p => p.employee_id === selectedEmployee && p.payment_method === 'descuento_saldo')
      .reduce((sum, p) => sum + p.total_amount, 0);

    const pending = Math.max(0, rawPending - purchaseDiscounts);

    return { totalEarned, totalPaid, pending, creditBalance: 0 };
  };

  const getEmployeeName = () => {
    const emp = employees.find(e => e.employee_id === selectedEmployee);
    return emp ? emp.name : "";
  };

  const getPendingDeliveries = (employeeId) => {
    const empDeliveries = deliveries.filter(d => d.employee_id === employeeId);
    const empPayments = payments.filter(p => p.employee_id === employeeId);

    const deliveryPaidAmounts = {};
    empPayments.forEach(p => {
      if (p.delivery_payments && p.delivery_payments.length > 0) {
        p.delivery_payments.forEach(dp => {
          deliveryPaidAmounts[dp.delivery_id] = (deliveryPaidAmounts[dp.delivery_id] || 0) + dp.amount;
        });
      }
    });

    const paidDeliveryIds = new Set();
    empPayments.forEach(p => {
      if (p.payment_type === 'pago_completo' && p.delivery_ids) {
        p.delivery_ids.forEach(id => paidDeliveryIds.add(id));
      }
    });

    const pendingDeliveries = [];
    empDeliveries.forEach(delivery => {
      if (delivery.status === 'pagado' || paidDeliveryIds.has(delivery.id)) return;
      const earned = getDeliveryAmount(delivery);
      const paid = deliveryPaidAmounts[delivery.id] || 0;
      const pending = earned - paid;
      if (pending > 0) pendingDeliveries.push({ ...delivery, pending_amount: pending });
    });

    // Avances con delivery_ids históricos
    const linkedAvances = empPayments
      .filter(p => p.payment_type !== 'pago_completo' && (!p.delivery_payments || p.delivery_payments.length === 0) && p.delivery_ids && p.delivery_ids.length > 0)
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
    linkedAvances.forEach(payment => {
      let remaining = payment.amount;
      pendingDeliveries.filter(d => payment.delivery_ids.includes(d.id)).forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    // Avances genéricos
    const genericPayments = empPayments
      .filter(p => (!p.delivery_payments || p.delivery_payments.length === 0) && (!p.delivery_ids || p.delivery_ids.length === 0))
      .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
    pendingDeliveries.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
    genericPayments.forEach(payment => {
      let remaining = payment.amount;
      pendingDeliveries.forEach(d => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, d.pending_amount);
        d.pending_amount -= apply;
        remaining -= apply;
      });
    });

    return pendingDeliveries.filter(d => d.pending_amount > 0);
  };

  const loadPendingAsItems = (employeeId) => {
    const pending = getPendingDeliveries(employeeId);
    if (pending.length === 0) { setItems([]); return; }

    // Agrupar por referencia + precio unitario
    const grouped = {};
    pending.forEach(d => {
      if (d.items && d.items.length > 0) {
        d.items.forEach(item => {
          const key = `${item.product_reference}_${item.unit_price}`;
          if (!grouped[key]) {
            const prod = products.find(p => p.reference === item.product_reference);
            grouped[key] = { id: key, reference: item.product_reference, name: prod?.name || item.product_reference, manufacturingPrice: item.unit_price, quantity: 0, subtotal: 0 };
          }
          grouped[key].quantity += item.quantity;
          grouped[key].subtotal += item.total_amount || (item.quantity * item.unit_price);
        });
      } else if (d.product_reference) {
        const unitPrice = d.unit_price || 0;
        const key = `${d.product_reference}_${unitPrice}`;
        if (!grouped[key]) {
          const prod = products.find(p => p.reference === d.product_reference);
          grouped[key] = { id: key, reference: d.product_reference, name: prod?.name || d.product_reference, manufacturingPrice: unitPrice, quantity: 0, subtotal: 0 };
        }
        // usar pending_amount proporcional si es parcial
        const totalDelivery = getDeliveryAmount(d);
        const ratio = totalDelivery > 0 ? d.pending_amount / totalDelivery : 1;
        grouped[key].quantity += d.quantity * ratio;
        grouped[key].subtotal += d.pending_amount;
      }
    });

    setItems(Object.values(grouped).map(item => ({ ...item, quantity: Math.round(item.quantity * 10) / 10 })));
  };



  const addItem = () => {
    if (!selectedProduct || !quantity || isNaN(quantity) || quantity <= 0) {
      alert("Selecciona un producto e ingresa una cantidad válida");
      return;
    }

    const product = products.find(p => p.reference === selectedProduct);
    if (!product) return;

    const newItem = {
      id: Date.now(),
      reference: product.reference,
      name: product.name,
      manufacturingPrice: product.manufacturing_price,
      quantity: parseFloat(quantity),
      subtotal: product.manufacturing_price * parseFloat(quantity)
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity("");
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateQuantity = (id, newQuantity) => {
    if (isNaN(newQuantity) || newQuantity < 0) return;

    setItems(items.map(item => {
      if (item.id === id) {
        const qty = parseFloat(newQuantity) || 0;
        return { ...item, quantity: qty, subtotal: item.manufacturingPrice * qty };
      }
      return item;
    }));
  };

  const clearAll = () => {
    setItems([]);
  };

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            <span>Cotizador de Salarios</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">Verifica cobros de operarios calculando el total según cantidades y precios de manufactura</p>
        </div>

        {/* Selector de operario */}
        <Card className="mb-4 sm:mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-3 sm:p-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block mb-2">Selecciona Operario para Verificar</label>
            <Select value={selectedEmployee} onValueChange={(val) => { setSelectedEmployee(val); loadPendingAsItems(val); }}>
              <SelectTrigger>
                <SelectValue placeholder="Elige un operario" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.employee_id} value={emp.employee_id}>
                    {emp.name} ({emp.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmployee && (
              <p className="text-xs text-blue-600 mt-2">
                ✓ Se cargaron automáticamente las entregas pendientes. Verifica o ajusta las cantidades.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Panel de entrada */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Agregar Producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div>
                <label className="text-xs sm:text-sm font-medium text-slate-700 block mb-2">Producto</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.reference} value={product.reference}>
                        {product.name} - ${product.manufacturing_price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-slate-700 block mb-2">Cantidad</label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && addItem()}
                />
              </div>

              <Button onClick={addItem} className="w-full bg-blue-600 hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>

              {items.length > 0 && (
                <Button onClick={clearAll} variant="outline" className="w-full text-xs sm:text-sm text-red-600 border-red-200 hover:bg-red-50">
                  Limpiar Todo
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Panel de resumen */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {items.length > 0 ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <span>Detalles ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6">
                    <div className="hidden sm:block overflow-x-auto">
                      <Table className="text-xs sm:text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Producto</TableHead>
                            <TableHead className="text-right text-xs">P. Unit.</TableHead>
                            <TableHead className="text-right text-xs">Cant.</TableHead>
                            <TableHead className="text-right text-xs">Subtotal</TableHead>
                            <TableHead className="text-center w-8 sm:w-12">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50">
                              <TableCell className="font-medium text-slate-900 text-xs sm:text-sm">{item.name}</TableCell>
                              <TableCell className="text-right text-slate-600 text-xs sm:text-sm">${item.manufacturingPrice.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.id, e.target.value)}
                                  className="w-16 sm:w-20 text-right text-xs sm:text-sm"
                                  min="0"
                                  step="0.1"
                                />
                              </TableCell>
                              <TableCell className="text-right font-bold text-blue-600 text-xs sm:text-sm">
                                ${item.subtotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(item.id)}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="sm:hidden space-y-3">
                      {items.map(item => (
                        <div key={item.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-slate-900 text-sm flex-1">{item.name}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 p-0 ml-2 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Precio unitario:</span>
                              <span className="font-medium text-slate-900">${item.manufacturingPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Cantidad:</span>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.id, e.target.value)}
                                className="w-16 text-right text-xs h-8"
                                min="0"
                                step="0.1"
                              />
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-300">
                              <span className="font-medium text-slate-700">Subtotal:</span>
                              <span className="font-bold text-blue-600">${item.subtotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Total */}
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-0">
                      <div>
                        <p className="text-xs sm:text-sm text-slate-600 font-medium mb-1">Total que Ingresa el Operario</p>
                        <p className="text-3xl sm:text-4xl font-bold text-blue-600">
                          ${total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <Badge className="bg-blue-600 text-xs sm:text-lg px-2 sm:px-3 py-1 sm:py-2 w-fit">
                        {items.length} ref{items.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Comparación con sistema */}
                {selectedEmployee && getEmployeeSystemData() && (
                  <Card className={`border-2 ${
                    Math.abs(total - getEmployeeSystemData().pending) < 1
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
                  }`}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="text-center space-y-3 sm:space-y-4">
                        <div>
                          <p className="text-xs sm:text-sm text-slate-600 mb-2">Saldo Pendiente a la Fecha</p>
                          <p className="text-2xl sm:text-4xl font-bold text-slate-900">
                            ${getEmployeeSystemData().pending.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </p>
                          {getEmployeeSystemData().creditBalance > 0 && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              💳 Crédito a favor: ${getEmployeeSystemData().creditBalance.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:justify-center sm:items-center gap-3 sm:gap-6 py-3 sm:py-4 border-y border-current opacity-50">
                          <div>
                            <p className="text-xs sm:text-sm font-medium">Ingresa</p>
                            <p className="text-lg sm:text-2xl font-bold">${total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <p className={`text-2xl sm:text-4xl font-bold ${
                            Math.abs(total - getEmployeeSystemData().pending) < 1
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {Math.abs(total - getEmployeeSystemData().pending) < 1 ? '=' : '≠'}
                          </p>
                          <div>
                            <p className="text-xs sm:text-sm font-medium">Sistema</p>
                            <p className="text-lg sm:text-2xl font-bold">${getEmployeeSystemData().pending.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>

                        {Math.abs(total - getEmployeeSystemData().pending) < 1 ? (
                          <>
                            <p className="text-base sm:text-lg font-bold text-green-700">✓ COINCIDE - Listo para pagar</p>
                            <Button 
                              onClick={() => navigate(createPageUrl("Payments"))}
                              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 sm:py-6 text-sm sm:text-lg font-bold"
                            >
                              Ir a Pagos
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm sm:text-lg font-bold text-red-700">⚠ Diferencia: ${Math.abs(total - getEmployeeSystemData().pending).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs sm:text-sm text-slate-600">Revisa los montos antes de proceder al pago</p>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-slate-50 border-dashed">
                <CardContent className="p-8 sm:p-12 text-center">
                  <Package className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-xs sm:text-sm text-slate-500">Agrega productos para ver el total</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}