import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Percent,
  DollarSign,
  Lock
} from "lucide-react";

export default function Cart({ 
  cart = [], 
  onUpdateItem, 
  onRemoveItem, 
  globalDiscount = 0, 
  onGlobalDiscountChange, 
  totals = {}, 
  onCheckout, 
  onClearCart,
  priceLists = [], 
  selectedPriceListCode,
  onPriceListChange,
  userPermissions = []
}) {
  
  const canApplyDiscounts = userPermissions?.includes('pos_apply_discounts');
  
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      onRemoveItem(productId);
    } else {
      onUpdateItem(productId, { quantity });
    }
  };

  const updateDiscount = (productId, discount) => {
    onUpdateItem(productId, { discount: Math.max(0, Math.min(100, discount)) });
  };

  return (
    <Card className="shadow-lg border-0 h-full flex flex-col">
      <CardHeader className="pb-4 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Carrito ({cart.length})
          </div>
          {cart.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (window.confirm('¿Vaciar el carrito?')) {
                  onClearCart();
                }
              }}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              Limpiar
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        
        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Carrito vacío</p>
              <p className="text-sm">Agrega productos para comenzar</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {priceLists.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Lista de Precios
                  </label>
                  <Select onValueChange={onPriceListChange} value={selectedPriceListCode || ''}>
                    <SelectTrigger className="w-full h-11 text-base">
                      <SelectValue placeholder="Seleccionar lista..." />
                    </SelectTrigger>
                    <SelectContent>
                      {priceLists.map((list) => (
                        <SelectItem key={list.code} value={list.code}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {cart.map((item) => {
                const itemUnitPrice = item.sale_price || item.product.sale_price || 0;
                const itemSubtotal = item.quantity * itemUnitPrice;
                const itemDiscountAmount = (itemSubtotal * (item.discount || 0)) / 100;
                const itemTotal = itemSubtotal - itemDiscountAmount;
                
                return (
                  <div key={item.product.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {item.product.name}
                        </h4>
                        <div className="flex gap-1 mt-1">
                          {item.product.variant_attributes?.size && (
                            <Badge variant="outline" className="text-xs">
                              {item.product.variant_attributes.size}
                            </Badge>
                          )}
                          {item.product.variant_attributes?.color && (
                            <Badge variant="outline" className="text-xs">
                              {item.product.variant_attributes.color}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(item.product.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            if (newQty >= 1) {
                              updateQuantity(item.product.id, newQty);
                            }
                          }}
                          className="w-12 h-8 text-center font-semibold p-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="relative">
                         {canApplyDiscounts ? (
                           <div className="flex items-center gap-1">
                             <Input
                              type="number"
                              placeholder="0"
                              min="0"
                              max="100"
                              value={item.discount || ''}
                              onChange={(e) => updateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-16 h-8 text-xs text-center p-1 pr-4"
                            />
                            <Percent className="absolute right-1 w-3 h-3 text-gray-400" />
                           </div>
                         ) : (
                           <div className="relative flex items-center">
                             <Input
                              type="number"
                              value="0"
                              disabled
                              className="w-16 h-8 text-xs text-center p-1 pr-4 bg-gray-100 cursor-not-allowed opacity-60"
                            />
                            <Lock className="absolute right-1 w-3 h-3 text-red-500" />
                           </div>
                         )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t">
                      <div className="text-xs text-gray-600">
                        ${itemUnitPrice.toLocaleString()} × {item.quantity}
                        {item.discount > 0 && (
                          <span className="text-red-600"> (-{item.discount}%)</span>
                        )}
                      </div>
                      <div className="font-semibold text-blue-600">
                        ${itemTotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t bg-white mt-auto">
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-blue-900">
                    Descuento Global
                  </label>
                  <div className="relative">
                     {canApplyDiscounts ? (
                       <div className="flex items-center gap-2">
                         <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="100"
                          value={globalDiscount || ''}
                          onChange={(e) => onGlobalDiscountChange(parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-center text-sm pr-5"
                        />
                         <Percent className="absolute right-2 w-4 h-4 text-blue-600" />
                       </div>
                     ) : (
                       <div className="relative flex items-center">
                         <Input
                          type="number"
                          value="0"
                          disabled
                          className="w-20 h-8 text-center text-sm pr-5 bg-gray-100 cursor-not-allowed opacity-60"
                        />
                         <Lock className="absolute right-2 w-4 h-4 text-red-500" />
                       </div>
                     )}
                  </div>
                </div>
                {!canApplyDiscounts && (
                  <Alert variant="destructive" className="mt-2 text-xs">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Sin permisos para aplicar descuentos
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2 mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${totals.subtotal?.toLocaleString() || '0'}</span>
                </div>
                {totals.globalDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Descuento Global:</span>
                    <span>-${totals.globalDiscountAmount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Impuestos:</span>
                  <span>${totals.taxAmount?.toLocaleString() || '0'}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-blue-600">${totals.total?.toLocaleString() || '0'}</span>
                </div>
              </div>

              <Button
                onClick={onCheckout}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold"
                disabled={cart.length === 0}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Procesar Pago
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}