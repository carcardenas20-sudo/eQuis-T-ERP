import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus } from "lucide-react";

export default function CartPreview({ items, onChangeQty, onRemove }) {
  const totalItems = items.reduce((a, it) => a + it.qty, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="text-lg font-semibold">Carrito</div>
        <div className="text-sm text-slate-500">{totalItems} artículos</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 && (
          <div className="text-sm text-slate-500">Tu carrito está vacío.</div>
        )}
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 border rounded-lg p-2 bg-white">
            {it.image && (
              <img src={it.image} alt={it.name} className="w-14 h-14 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{it.name}</div>
              <div className="text-xs text-slate-500">{it.color} · {it.size}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => onChangeQty(it.id, Math.max(1, it.qty - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <div className="w-6 text-center text-sm">{it.qty}</div>
              <Button variant="outline" size="icon" onClick={() => onChangeQty(it.id, it.qty + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onRemove(it.id)}>
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <Button className="w-full">Checkout (Demo)</Button>
        <div className="text-[11px] text-slate-500 mt-2">Este flujo es demostrativo y no procesa pagos.</div>
      </div>
    </div>
  );
}