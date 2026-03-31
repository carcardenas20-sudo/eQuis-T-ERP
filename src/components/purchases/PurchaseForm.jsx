import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package } from "lucide-react";
import { getCurrentDateString } from "../utils/dateUtils";
import { MobileSelect } from "@/components/ui/mobile-select";
import { PurchaseItem } from "@/entities/all";

export default function PurchaseForm({ purchase, suppliers, products, locations, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    purchase: {
      supplier_id: "",
      supplier_name: "",
      location_id: "",
      purchase_date: getCurrentDateString(),
      expected_date: "",
      status: "pending",
      payment_method: "credit",
      supplier_invoice: "",
      include_tax: true,
      tax_rate: 19,
      notes: ""
    },
    items: []
  });

  const [selectedProduct, setSelectedProduct] = useState("");
  const [productQuantity, setProductQuantity] = useState(1);
  const [productCost, setProductCost] = useState(0);

  useEffect(() => {
    if (purchase) {
      setFormData(prev => ({
        ...prev,
        purchase: { 
          ...purchase,
          include_tax: purchase.include_tax !== undefined ? purchase.include_tax : true,
          tax_rate: purchase.tax_rate || 19
        }
      }));
      
      // Load items when editing
      if (purchase.id) {
        PurchaseItem.filter({ purchase_id: purchase.id })
          .then(items => {
            setFormData(prev => ({
              ...prev,
              items: items
            }));
          });
      }
    }
  }, [purchase]);

  const handlePurchaseChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      purchase: { ...prev.purchase, [field]: value }
    }));

    // Auto-fill supplier name when supplier is selected
    if (field === 'supplier_id') {
      const supplier = suppliers.find(s => s.id === value);
      if (supplier) {
        setFormData(prev => ({
          ...prev,
          purchase: { ...prev.purchase, supplier_name: supplier.nombre }
        }));
      }
    }
  };

  // Auto-fill cost when product changes
  const handleProductSelect = (productId) => {
    setSelectedProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product && product.base_cost > 0) {
      setProductCost(product.base_cost);
    }
  };

  const handleAddProduct = () => {
    if (!selectedProduct || productQuantity <= 0 || productCost <= 0) {
      alert("Por favor completa todos los campos del producto.");
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingIndex = formData.items.findIndex(item => item.product_id === product.sku);
    
    if (existingIndex >= 0) {
      // Update existing item
      setFormData(prev => ({
        ...prev,
        items: prev.items.map((item, index) => 
          index === existingIndex 
            ? { ...item, quantity_ordered: item.quantity_ordered + productQuantity }
            : item
        )
      }));
    } else {
      // Add new item
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          product_id: product.sku,
          product_name: product.name,
          quantity_ordered: productQuantity,
          unit_cost: productCost,
          line_total: productQuantity * productCost
        }]
      }));
    }

    // Reset form
    setSelectedProduct("");
    setProductQuantity(1);
    setProductCost(0);
  };

  const handleUpdateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          // Recalculate line total when quantity or cost changes
          if (field === 'quantity_ordered' || field === 'unit_cost') {
            updatedItem.line_total = updatedItem.quantity_ordered * updatedItem.unit_cost;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.line_total || 0), 0);
    const taxAmount = formData.purchase.include_tax ? subtotal * (formData.purchase.tax_rate / 100) : 0;
    const total = subtotal + taxAmount;
    
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = () => {
    if (!formData.purchase.supplier_id || !formData.purchase.location_id || formData.items.length === 0) {
      alert("Por favor completa todos los campos requeridos y agrega al menos un producto.");
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();
    
    const purchaseToSave = {
      ...formData.purchase,
      subtotal,
      tax_amount: taxAmount,
      total_amount: total,
      items: formData.items
    };

    onSave(purchaseToSave);
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchase ? "Editar Compra" : "Nueva Orden de Compra"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Purchase Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Proveedor *</Label>
              <MobileSelect
                value={formData.purchase.supplier_id}
                onValueChange={(value) => handlePurchaseChange('supplier_id', value)}
                placeholder="Seleccionar proveedor..."
                options={suppliers.filter(s => s.activo).map(supplier => ({
                  value: supplier.id,
                  label: supplier.nombre
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="location">Sucursal de Destino *</Label>
              <MobileSelect
                value={formData.purchase.location_id}
                onValueChange={(value) => handlePurchaseChange('location_id', value)}
                placeholder="Seleccionar sucursal..."
                options={locations.map(location => ({
                  value: location.id,
                  label: location.name
                }))}
              />
            </div>

            <div>
              <Label htmlFor="purchase_date">Fecha de Compra *</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase.purchase_date}
                onChange={(e) => handlePurchaseChange('purchase_date', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="expected_date">Fecha Esperada</Label>
              <Input
                id="expected_date"
                type="date"
                value={formData.purchase.expected_date}
                onChange={(e) => handlePurchaseChange('expected_date', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="supplier_invoice">Factura Proveedor</Label>
              <Input
                id="supplier_invoice"
                value={formData.purchase.supplier_invoice}
                onChange={(e) => handlePurchaseChange('supplier_invoice', e.target.value)}
                placeholder="Número de factura..."
              />
            </div>

            <div>
              <Label htmlFor="payment_method">Método de Pago</Label>
              <MobileSelect
                value={formData.purchase.payment_method}
                onValueChange={(value) => handlePurchaseChange('payment_method', value)}
                placeholder="Método de pago"
                options={[
                  { value: "cash", label: "Efectivo" },
                  { value: "transfer", label: "Transferencia" },
                  { value: "check", label: "Cheque" },
                  { value: "credit", label: "Crédito" }
                ]}
              />
            </div>
          </div>

          {/* Tax Configuration */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label htmlFor="include_tax" className="text-base font-semibold">Configuración de Impuestos</Label>
                <p className="text-sm text-slate-600 mt-1">
                  Configura si esta compra incluye impuestos
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Switch
                  id="include_tax"
                  checked={formData.purchase.include_tax}
                  onCheckedChange={(value) => handlePurchaseChange('include_tax', value)}
                />
                <Label htmlFor="include_tax">Incluir Impuesto</Label>
              </div>
              
              {formData.purchase.include_tax && (
                <div>
                  <Label htmlFor="tax_rate">Tasa de Impuesto (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.purchase.tax_rate}
                    onChange={(e) => handlePurchaseChange('tax_rate', parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Add Products Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Agregar Productos</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="product">Producto</Label>
                <MobileSelect
                  value={selectedProduct}
                  onValueChange={handleProductSelect}
                  placeholder="Seleccionar producto..."
                  options={products.filter(p => p.is_active).map(product => ({
                    value: product.id,
                    label: `${product.name} (${product.sku})`
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <Label htmlFor="cost">Costo Unitario</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productCost}
                  onChange={(e) => setProductCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              <Button onClick={handleAddProduct} className="gap-2 select-none">
                <Plus className="w-4 h-4 select-none" />
                Agregar
              </Button>
            </div>
          </div>

          {/* Items Table */}
          {formData.items.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Productos a Comprar</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-gray-500">SKU: {item.product_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity_ordered}
                          onChange={(e) => handleUpdateItem(index, 'quantity_ordered', parseInt(e.target.value) || 1)}
                          className="w-20 mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => handleUpdateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="w-24 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(item.line_total || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700 select-none"
                        >
                          <Trash2 className="w-4 h-4 select-none" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex justify-end mt-4">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  {formData.purchase.include_tax ? (
                    <div className="flex justify-between">
                      <span>IVA ({formData.purchase.tax_rate}%):</span>
                      <span>${taxAmount.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-slate-500">
                      <span>Sin impuesto</span>
                      <span>$0</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.purchase.notes}
              onChange={(e) => handlePurchaseChange('notes', e.target.value)}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {purchase ? "Actualizar Compra" : "Crear Orden de Compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}