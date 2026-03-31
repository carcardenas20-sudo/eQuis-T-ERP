import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Check } from "lucide-react";

export default function VariantSelector({ product, onAdd }) {
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);

  const colorHex = useMemo(() => ({
    Negro: "#111827",
    Azul: "#1e3a8a",
    Rojo: "#b91c1c",
    Verde: "#166534",
    Beige: "#d6b68c"
  }), []);

  const totalForColor = (c) => {
    const grid = product.stock?.[c] || {};
    return Object.values(grid).reduce((a, b) => a + (b || 0), 0);
  };

  const availableFor = (c, s) => (product.stock?.[c]?.[s] || 0);

  const handleAdd = () => {
    if (!color || !size) return;
    const max = availableFor(color, size);
    if (!max) return;
    const finalQty = Math.min(qty, max);
    onAdd({ productId: product.id, sku: product.sku, name: product.name, color, size, qty: finalQty, image: product.images?.[0] });
    setQty(1);
  };

  const sizes = product.sizes || [];
  const colors = product.colors || [];

  const maxQty = size && color ? availableFor(color, size) : 1;

  return (
    <div className="space-y-3">
      {/* Colores */}
      <div className="space-y-2">
        <div className="text-xs text-slate-500">Color</div>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => {
            const disabled = totalForColor(c) === 0;
            const selected = c === color;
            return (
              <button
                key={c}
                onClick={() => !disabled && setColor(c)}
                aria-label={c}
                className={`relative h-8 w-8 rounded-full border ${selected ? 'ring-2 ring-slate-800' : ''} ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-90'}`}
                style={{ backgroundColor: colorHex[c] || '#e5e7eb' }}
                disabled={disabled}
              >
                {selected && <Check className="w-4 h-4 text-white m-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tallas */}
      <div className="space-y-2">
        <div className="text-xs text-slate-500">Talla</div>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => {
            const avail = color ? availableFor(color, s) : 0;
            const disabled = !color || avail === 0;
            const selected = s === size;
            return (
              <button
                key={s}
                onClick={() => !disabled && setSize(s)}
                className={`px-3 py-1.5 rounded-md text-sm border transition ${selected ? 'bg-slate-900 text-white' : 'bg-white'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                disabled={disabled}
              >
                <span className="font-medium mr-1">{s}</span>
                {!disabled && <Badge variant="outline" className="text-[10px]">{avail}</Badge>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cantidad + Agregar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            <Minus className="w-4 h-4" />
          </Button>
          <div className="min-w-[2rem] text-center font-medium">{qty}</div>
          <Button type="button" variant="outline" size="icon" onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))} disabled={!maxQty}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <Button onClick={handleAdd} disabled={!color || !size || !maxQty} className="flex-1">
          Agregar
        </Button>
      </div>

      {/* Nota de demo */}
      <div className="text-[11px] text-slate-500">Demo: validamos stock en tiempo real, sin tocar tu base.</div>
    </div>
  );
}