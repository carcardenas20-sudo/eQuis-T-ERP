import React, { useState, useEffect } from "react";
import { Inventory, Product, Location } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, AlertTriangle, Loader2, Package } from "lucide-react";

export default function AuditChecklist({ audit, onItemUpdate, isLoading }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  // auditItems: [{ sku, section, quantity }]
  const [auditItems, setAuditItems] = useState([]);
  const [location, setLocation] = useState(null);

  useEffect(() => { loadData(); }, [audit.id]);
  useEffect(() => { notifyParent(); }, [auditItems, products]);

  const loadData = async () => {
    try {
      const [prodData, locData, allInv] = await Promise.all([
        Product.list(),
        Location.get(audit.location_id),
        Inventory.list()
      ]);
      const locationInv = (allInv || []).filter(inv => inv.location_id === audit.location_id);
      setLocation(locData);

      const invMap = {};
      locationInv.forEach(inv => { invMap[inv.product_id] = inv.current_stock || 0; });

      const sorted = (prodData || [])
        .filter(p => p.is_active)
        .map(p => ({ ...p, system_qty: invMap[p.sku] || 0 }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setProducts(sorted);
    } catch (e) {
      console.error("Error loading:", e);
    }
  };

  const notifyParent = () => {
    // Agrupar por SKU para calcular la diferencia correctamente (sumar físico de todas las secciones vs sistema una sola vez)
    const grouped = {};
    auditItems.forEach(item => {
      if (!grouped[item.sku]) grouped[item.sku] = [];
      grouped[item.sku].push(item);
    });

    const flat = [];
    Object.entries(grouped).forEach(([sku, items]) => {
      const product = products.find(p => p.sku === sku);
      if (!product) return;
      const totalPhysical = items.reduce((s, i) => s + i.quantity, 0);
      const totalDiff = totalPhysical - product.system_qty;

      items.forEach((item, idx) => {
        flat.push({
          product_id: product.sku,
          product_name: product.name,
          section: item.section || "General",
          // Solo el primer item carga el system_qty y la diferencia, el resto = 0
          quantity_system: idx === 0 ? product.system_qty : 0,
          quantity_physical: item.quantity,
          difference: idx === 0 ? totalDiff : 0,
          difference_type: totalDiff > 0 ? 'sobrante' : totalDiff < 0 ? 'faltante' : 'sin_diferencia',
          unit_cost: product.base_cost || 0,
          difference_value: idx === 0 ? Math.abs(totalDiff) * (product.base_cost || 0) : 0
        });
      });
    });

    onItemUpdate(flat);
  };

  const handleAddProduct = (sku) => {
    setAuditItems(prev => [...prev, { sku, section: "", quantity: 0 }]);
  };

  const handleAddSection = (sku) => {
    setAuditItems(prev => [...prev, { sku, section: "", quantity: 0 }]);
  };

  const handleQuantityChange = (index, delta) => {
    setAuditItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: Math.max(0, (updated[index].quantity || 0) + delta) };
      return updated;
    });
  };

  const handleQuantityInput = (index, value) => {
    const qty = parseInt(value) || 0;
    setAuditItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: Math.max(0, qty) };
      return updated;
    });
  };

  const handleSectionChange = (index, section) => {
    setAuditItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], section };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setAuditItems(prev => prev.filter((_, i) => i !== index));
  };

  // Agrupar items por SKU para mostrarlos agrupados
  const auditedSkus = [...new Set(auditItems.map(i => i.sku))];

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = auditItems.reduce((acc, item) => {
    const product = products.find(p => p.sku === item.sku);
    if (product) {
      acc.totalCounted += item.quantity;
      acc.totalValue += Math.abs(item.quantity - product.system_qty) * (product.base_cost || 0);
    }
    return acc;
  }, { totalCounted: 0, totalValue: 0 });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar producto por nombre o SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Productos ya auditados (agrupados por SKU) */}
      {auditedSkus.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Productos auditados ({auditedSkus.length})
          </p>

          {auditedSkus.map(sku => {
            const product = products.find(p => p.sku === sku);
            if (!product) return null;

            const itemsForSku = auditItems
              .map((item, idx) => ({ ...item, _index: idx }))
              .filter(item => item.sku === sku);

            const totalPhysical = itemsForSku.reduce((s, i) => s + i.quantity, 0);
            const diff = totalPhysical - product.system_qty;
            const hasDiff = diff !== 0;

            return (
              <div
                key={sku}
                className={`rounded-xl border-2 bg-white overflow-hidden ${hasDiff ? (diff > 0 ? 'border-orange-300' : 'border-red-300') : 'border-green-300'}`}
              >
                {/* Header del producto */}
                <div className={`px-4 pt-4 pb-3 ${hasDiff ? (diff > 0 ? 'bg-orange-50' : 'bg-red-50') : 'bg-green-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-base text-slate-900 leading-tight">{product.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">SKU: {product.sku}</p>
                    </div>
                    {hasDiff && (
                      <Badge className={`shrink-0 flex items-center gap-1 text-xs ${diff > 0 ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        Diferencia: {diff > 0 ? '+' : ''}{diff}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Package className="w-3.5 h-3.5" />
                      Sistema: <strong className="text-slate-800">{product.system_qty}</strong>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">
                      Total Físico: <strong className="text-slate-800">{totalPhysical}</strong>
                    </span>
                  </div>
                </div>

                {/* Filas de secciones */}
                <div className="px-4 py-3 space-y-3">
                  {itemsForSku.map((item) => (
                    <div key={item._index} className="space-y-2">
                      {/* Sección input + eliminar */}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Ej: Piso 1, Estantería A"
                          value={item.section}
                          onChange={(e) => handleSectionChange(item._index, e.target.value)}
                          className="flex-1 h-9 text-sm"
                        />
                        <button
                          onClick={() => handleRemoveItem(item._index)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Cantidad con +/- */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 font-medium w-20">Cantidad:</span>
                        <div className="flex items-center border-2 border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleQuantityChange(item._index, -1)}
                            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg transition-colors"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => handleQuantityInput(item._index, e.target.value)}
                            className="w-16 h-10 text-center font-bold text-base border-none outline-none bg-white"
                          />
                          <button
                            onClick={() => handleQuantityChange(item._index, 1)}
                            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Agregar Sección */}
                  <button
                    onClick={() => handleAddSection(sku)}
                    className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Sección
                  </button>
                </div>

                {/* Footer diferencia */}
                {hasDiff && (
                  <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-1 ${diff < 0 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                    {diff < 0 ? '↘' : '↗'}
                    {diff < 0 ? `Faltante de ${Math.abs(diff)} unidades` : `Sobrante de ${diff} unidades`}
                    {product.base_cost > 0 && ` ($${(Math.abs(diff) * product.base_cost).toLocaleString()})`}
                  </div>
                )}
              </div>
            );
          })}

          {/* Resumen total */}
          <div className="bg-slate-100 rounded-lg p-3 text-sm text-slate-700">
            <span className="font-semibold">{totals.totalCounted}</span> unidades contadas en total
            {totals.totalValue > 0 && (
              <span className="text-slate-500"> • Impacto: ${totals.totalValue.toLocaleString()}</span>
            )}
          </div>
        </div>
      )}

      {/* Lista de productos para agregar */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">
          {auditedSkus.length > 0 ? "Agregar más productos" : "Seleccionar productos a auditar"}
        </p>
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
          {filteredProducts.map(product => {
            const alreadyAdded = auditedSkus.includes(product.sku);
            return (
              <button
                key={product.sku}
                onClick={() => handleAddProduct(product.sku)}
                className={`w-full px-3 py-2.5 border rounded-lg text-left transition-colors flex justify-between items-center group
                  ${alreadyAdded
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div>
                  <p className={`text-sm font-medium ${alreadyAdded ? 'text-blue-700' : 'text-slate-800'}`}>
                    {product.name}
                  </p>
                  <p className="text-xs text-slate-400">{product.sku} • Stock: {product.system_qty}</p>
                </div>
                <Plus className={`w-4 h-4 shrink-0 ${alreadyAdded ? 'text-blue-400' : 'text-slate-300 group-hover:text-slate-500'}`} />
              </button>
            );
          })}
          {filteredProducts.length === 0 && searchTerm && (
            <p className="text-center py-6 text-slate-400 text-sm">
              No se encontraron productos con "{searchTerm}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}