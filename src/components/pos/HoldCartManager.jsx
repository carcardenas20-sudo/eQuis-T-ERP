import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoldCart } from "@/entities/all";
import { Clock, ShoppingBag, Trash2, RotateCcw, Plus } from "lucide-react";

export default function HoldCartManager({ 
  locationId, 
  currentCart, 
  currentTotal,
  currentPriceList,
  currentDiscount,
  currentCustomer,
  onRestoreCart,
  onClose 
}) {
  const [holdCarts, setHoldCarts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadHoldCarts();
  }, [locationId]);

  const loadHoldCarts = async () => {
    const carts = await HoldCart.filter({ location_id: locationId });
    setHoldCarts(carts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  };

  const handleSaveCurrent = async () => {
    if (currentCart.length === 0) {
      alert("El carrito actual está vacío.");
      return;
    }
    setIsSaving(true);
    const nextNumber = holdCarts.length + 1;
    await HoldCart.create({
      name: `Carrito #${nextNumber}`,
      location_id: locationId,
      customer_name: currentCustomer?.name || "",
      items: currentCart.map(item => ({
        product_id: item.product.id,
        product_sku: item.product.sku,
        product_name: item.product.name,
        product_price: item.product.sale_price,
        product_cost: item.product.base_cost,
        quantity: item.quantity,
        sale_price: item.sale_price,
        discount: item.discount || 0,
        variant_attributes: item.product.variant_attributes
      })),
      total_amount: currentTotal,
      price_list_code: currentPriceList,
      global_discount: currentDiscount || 0
    });
    setIsSaving(false);
    loadHoldCarts();
  };

  const handleRestore = async (holdCart) => {
    onRestoreCart(holdCart);
    await HoldCart.delete(holdCart.id);
    onClose();
  };

  const handleDelete = async (id) => {
    if (confirm("¿Eliminar este carrito en espera?")) {
      await HoldCart.delete(id);
      loadHoldCarts();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Carritos en Espera
          </DialogTitle>
        </DialogHeader>

        {/* Guardar carrito actual */}
        {currentCart.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-800">Guardar carrito actual ({currentCart.length} productos)</p>
            <Button onClick={handleSaveCurrent} disabled={isSaving} className="w-full bg-amber-600 hover:bg-amber-700 gap-1">
              <Plus className="w-4 h-4" />
              Guardar en espera
            </Button>
          </div>
        )}

        {/* Lista de carritos en espera */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-600">Carritos guardados ({holdCarts.length})</p>
          {holdCarts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay carritos en espera</p>
            </div>
          )}
          {holdCarts.map(hc => (
            <div key={hc.id} className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{hc.name}</p>
                  {hc.customer_name && <p className="text-xs text-slate-500">Cliente: {hc.customer_name}</p>}
                  <p className="text-xs text-slate-400">
                    {new Date(hc.created_date).toLocaleString('es-CO', { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">${hc.total_amount?.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{hc.items?.length} producto(s)</p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => handleRestore(hc)} className="flex-1 bg-blue-600 hover:bg-blue-700 gap-1 text-xs">
                  <RotateCcw className="w-3 h-3" /> Recuperar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(hc.id)} className="text-red-500 hover:text-red-700 gap-1 text-xs">
                  <Trash2 className="w-3 h-3" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}