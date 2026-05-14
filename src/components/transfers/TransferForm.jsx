import React, { useState, useMemo } from 'react';
import { Inventory, InventoryMovement } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowRightLeft, 
  Package, 
  Building2, 
  AlertTriangle, 
  CheckCircle,
  Loader2 
} from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";

 export default function TransferForm({ locations, products, inventory, currentUser, onTransferComplete }) {
  const [formData, setFormData] = useState({
    product_id: "",
    from_location: "",
    to_location: "",
    quantity: "",
    reason: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { currentUser: sessionUser, permissions, userRole } = useSession();

   // Get available stock for selected product and origin location
  const availableStock = useMemo(() => {
    if (!formData.product_id || !formData.from_location) return 0;
    
    const inventoryRecord = inventory.find(inv => 
      inv.product_id === formData.product_id && 
      inv.location_id === formData.from_location
    );
    
    return inventoryRecord ? inventoryRecord.current_stock : 0;
  }, [formData.product_id, formData.from_location, inventory]);

  const selectedProduct = products.find(p => p.sku === formData.product_id);
  const fromLocation = locations.find(l => l.id === formData.from_location);
  const toLocation = locations.find(l => l.id === formData.to_location);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.product_id || !formData.from_location || !formData.to_location || !formData.quantity) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    if (formData.from_location === formData.to_location) {
      setError("La ubicación de origen debe ser diferente a la de destino.");
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    if (quantity <= 0) {
      setError("La cantidad debe ser mayor a cero.");
      return;
    }

    if (quantity > availableStock) {
      setError(`Stock insuficiente. Disponible: ${availableStock} unidades.`);
      return;
    }

    setIsProcessing(true);
    try {
      // ✅ FECHA SIMPLIFICADA: Usar fecha actual directamente
      const transferDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
      
      // Create transfer out movement (from origin)
      const transferOutMovement = await InventoryMovement.create({
        product_id: formData.product_id,
        location_id: formData.from_location,
        movement_type: "transfer_out",
        quantity: -quantity, // Negative for outbound
        reason: `Traslado a ${toLocation?.name || 'Destino'}: ${formData.reason}`,
        movement_date: transferDate
      });

      // Create transfer in movement (to destination)
      const transferInMovement = await InventoryMovement.create({
        product_id: formData.product_id,
        location_id: formData.to_location,
        movement_type: "transfer_in",
        quantity: quantity, // Positive for inbound
        reference_id: transferOutMovement.id, // Link movements
        reason: `Traslado desde ${fromLocation?.name || 'Origen'}: ${formData.reason}`,
        movement_date: transferDate
      });

      // Update inventory in origin location
      const originInventory = inventory.find(inv => 
        inv.product_id === formData.product_id && 
        inv.location_id === formData.from_location
      );
      
      if (originInventory) {
        await Inventory.update(originInventory.id, {
          current_stock: originInventory.current_stock - quantity,
          last_movement_date: transferDate
        });
      }

      // Update or create inventory in destination location
      const destInventory = inventory.find(inv => 
        inv.product_id === formData.product_id && 
        inv.location_id === formData.to_location
      );
      
      if (destInventory) {
        await Inventory.update(destInventory.id, {
          current_stock: destInventory.current_stock + quantity,
          last_movement_date: transferDate
        });
      } else {
        // Create new inventory record for destination
        await Inventory.create({
          product_id: formData.product_id,
          location_id: formData.to_location,
          current_stock: quantity,
          last_movement_date: transferDate
        });
      }

      setSuccess(`¡Traslado completado! ${quantity} unidades de ${selectedProduct?.name} transferidas de ${fromLocation?.name} a ${toLocation?.name}.`);
      
      // Reset form
      setFormData({
        product_id: "",
        from_location: "",
        to_location: "",
        quantity: "",
        reason: ""
      });

      // Notify parent component
      setTimeout(() => {
        onTransferComplete();
      }, 2000);

    } catch (error) {
      console.error("Error processing transfer:", error);
      setError("Error procesando el traslado. Inténtalo de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const effectiveUser = sessionUser || currentUser;
  const isAdmin = (effectiveUser?.role === 'admin') || (userRole?.name?.toLowerCase?.() === 'administrador');
  const canUserTransfer = isAdmin 
    || permissions?.includes?.('inventory_transfer') 
    || (!!effectiveUser?.location_id && effectiveUser.location_id === formData.from_location);

   return (
    <div className="max-w-4xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Transfer Form */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Crear Traslado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}

              {/* Product Selection */}
              <div className="space-y-2">
                <Label htmlFor="product">Producto *</Label>
                <Select value={formData.product_id} onValueChange={(value) => handleChange('product_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.sku}>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          {product.name} ({product.sku})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origin Location */}
              <div className="space-y-2">
                <Label htmlFor="from_location">Desde (Origen) *</Label>
                <Select value={formData.from_location} onValueChange={(value) => handleChange('from_location', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal de origen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {location.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Destination Location */}
              <div className="space-y-2">
                <Label htmlFor="to_location">Hacia (Destino) *</Label>
                <Select value={formData.to_location} onValueChange={(value) => handleChange('to_location', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal de destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.filter(l => l.id !== formData.from_location).map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {location.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Cantidad *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={availableStock}
                  placeholder="Cantidad a transferir"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', e.target.value)}
                />
                {availableStock > 0 && (
                  <p className="text-sm text-slate-500">
                    Stock disponible: <span className="font-semibold">{availableStock}</span> unidades
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo del traslado</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe el motivo del traslado..."
                  value={formData.reason}
                  onChange={(e) => handleChange('reason', e.target.value)}
                  rows={3}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                disabled={isProcessing || !canUserTransfer}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Procesando Traslado...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Realizar Traslado
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Transfer Preview */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Resumen del Traslado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.product_id && selectedProduct && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-slate-900 mb-2">Producto</h4>
                  <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-slate-400" />
                    <div>
                      <p className="font-semibold">{selectedProduct.name}</p>
                      <p className="text-sm text-slate-500">SKU: {selectedProduct.sku}</p>
                    </div>
                  </div>
                </div>
              )}

              {formData.from_location && fromLocation && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900 mb-2">Origen</h4>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-800">{fromLocation.name}</p>
                      <p className="text-sm text-red-600">Stock: {availableStock} unidades</p>
                    </div>
                  </div>
                </div>
              )}

              {formData.to_location && toLocation && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Destino</h4>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">{toLocation.name}</p>
                    </div>
                  </div>
                </div>
              )}

              {formData.quantity && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Cantidad</h4>
                  <p className="text-2xl font-bold text-blue-700">{formData.quantity} unidades</p>
                </div>
              )}

              {!canUserTransfer && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    No tienes permisos suficientes para realizar traslados desde esta ubicación.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}