import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Package, AlertTriangle, AlertCircle } from "lucide-react";

export default function ProductSearch({ 
  products, 
  searchTerm, 
  onSearchChange, 
  onAddToCart, 
  inventory = [],
  selectedLocationId,
  isMobile = false 
}) {
  
  // DEBUG: Log cuando cambian los props
  React.useEffect(() => {
    console.log("🔍 ProductSearch - Props actualizados:", {
      totalProducts: products.length,
      totalInventory: inventory.length,
      selectedLocationId: selectedLocationId,
      inventoryLocationIds: [...new Set(inventory.map(i => i.location_id))],
      sampleInventory: inventory.slice(0, 3).map(i => ({
        product_id: i.product_id,
        location_id: i.location_id,
        stock: i.current_stock
      }))
    });
  }, [inventory, selectedLocationId, products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, isMobile ? 8 : 12);
    
    const term = searchTerm.toLowerCase();
    return products.filter(product =>
      product.name?.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term) ||
      (product.variant_attributes?.color?.toLowerCase().includes(term)) ||
      (product.variant_attributes?.size?.toLowerCase().includes(term))
    ).slice(0, isMobile ? 12 : 20);
  }, [products, searchTerm, isMobile]);

  const getCategoryBadgeColor = (category) => {
    const colors = {
      'chaquetas_hombre': 'bg-blue-100 text-blue-800 border-blue-200',
      'chaquetas_mujer': 'bg-pink-100 text-pink-800 border-pink-200',
      'chaquetas_niños': 'bg-green-100 text-green-800 border-green-200',
      'accesorios': 'bg-purple-100 text-purple-800 border-purple-200',
      'materia_prima': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStockInfo = (product) => {
    let totalStock = 0;
    
    // console.debug(`📦 Calculando stock para ${product.name} (SKU: ${product.sku})`);
    
    if (selectedLocationId) {
      // Get stock only for the selected location
      const locationInventory = inventory.filter(inv => 
        inv.product_id === product.sku && inv.location_id === selectedLocationId
      );
      
      // console.debug(`   - Inventario para location ${selectedLocationId}:`, locationInventory.length, "registros");
      
      totalStock = locationInventory.reduce((sum, inv) => {
        // console.debug(`   - Registro: product_id=${inv.product_id}, location_id=${inv.location_id}, stock=${inv.current_stock}`);
        return sum + (inv.current_stock || 0);
      }, 0);
      
      // console.debug(`   ✅ Stock total en sucursal seleccionada: ${totalStock}`);
    } else {
      // If no location selected, show total across all locations
      totalStock = inventory
        .filter(inv => inv.product_id === product.sku)
        .reduce((sum, inv) => sum + (inv.current_stock || 0), 0);
      
      // console.debug(`   ✅ Stock total (todas las sucursales): ${totalStock}`);
    }

    const minimumStock = product.minimum_stock || 5;

    if (totalStock === 0) {
      return {
        stock: totalStock,
        level: 'empty',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Sin Stock'
      };
    } else if (totalStock <= minimumStock) {
      return {
        stock: totalStock,
        level: 'low',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Stock Bajo'
      };
    } else {
      return {
        stock: totalStock,
        level: 'normal',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <Package className="w-3 h-3" />,
        label: 'Disponible'
      };
    }
  };

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Buscar por nombre, SKU, código de barras, talla o color..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`pl-10 border-2 focus:border-blue-500 transition-colors ${isMobile ? 'h-12 text-base' : 'h-12 text-lg'}`}
        />
      </div>

      {/* Location indicator for stock */}
      {selectedLocationId && (
        <div className={`text-sm text-slate-600 bg-blue-50 rounded-lg border border-blue-200 ${
          isMobile ? 'p-2' : 'p-2'
        }`} style={{contain: 'content'}} >
          <Package className="w-4 h-4 inline mr-2" />
          Mostrando stock para la sucursal seleccionada (ID: {selectedLocationId})
          <div className="text-xs mt-1 text-slate-500 hidden sm:block">
            Total registros inventario: {inventory.length} | 
            En esta sucursal: {inventory.filter(i => i.location_id === selectedLocationId).length}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className={`grid gap-2 sm:gap-3 overflow-y-auto touch-pan-y pr-1 ${
               isMobile 
                 ? 'grid-cols-2 sm:grid-cols-3' 
                 : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
             }`}>
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron productos</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const stockInfo = getStockInfo(product);
            const isOutOfStock = stockInfo.level === 'empty';

            return (
              <div
                key={product.id}
                className={`bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-200 hover:border-blue-300 cursor-pointer relative overflow-hidden ${isOutOfStock ? 'opacity-75' : ''} ${isMobile ? 'p-2' : 'p-4'}` }
                onClick={() => !isOutOfStock && onAddToCart(product)}
              >
                {/* Stock Badge - positioned absolutely */}
                <div className="absolute top-2 right-2">
                  <Badge className={['text-xs','flex','items-center','gap-1', stockInfo.color].join(' ')}>
                    {stockInfo.icon}
                    {stockInfo.stock}
                  </Badge>
                </div>

                {/* Product Image (hidden on mobile for responsiveness) */}
                {!isMobile && (
                  <div className="aspect-[4/3] sm:aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mb-3">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="text-gray-400 w-8 h-8" />
                    )}
                  </div>
                )}
                
                <div className="space-y-2">
                  <h3 className={`font-semibold text-gray-900 line-clamp-2 pr-6 ${
                    isMobile ? 'text-base' : 'text-sm'
                  }`}>
                    {product.name}
                  </h3>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-1">
                    <Badge 
                      variant="outline"
                      className={`text-xs ${getCategoryBadgeColor(product.category)}`}
                    >
                      {product.category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                    {product.variant_attributes?.size && (
                      <Badge variant="outline" className="text-xs">
                        {product.variant_attributes.size}
                      </Badge>
                    )}
                    {product.variant_attributes?.color && (
                      <Badge variant="outline" className="text-xs">
                        {product.variant_attributes.color}
                      </Badge>
                    )}
                  </div>

                  {/* Price and Stock Info */}
                  <div className="flex justify-between items-end gap-2 sm:gap-3 flex-wrap">
                    <div className="flex-1">
                      <p className={`font-bold text-blue-600 ${
                        isMobile ? 'text-xl' : ''
                      }`}>
                        ${product.sale_price?.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                      <p className={`text-xs font-medium mt-1 ${
                        stockInfo.level === 'empty' ? 'text-red-600' :
                        stockInfo.level === 'low' ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {stockInfo.label}: {stockInfo.stock} uds
                        {stockInfo.level === 'low' && (
                          <span className="text-gray-500"> (Min: {product.minimum_stock || 5})</span>
                        )}
                        {selectedLocationId && (
                          <span className="hidden sm:block text-xs text-slate-400">
                            En esta sucursal
                          </span>
                        )}
                      </p>
                    </div>
                    <Button 
                      size={isMobile ? "default" : "sm"}
                      className={`${
                        isOutOfStock 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } ${isMobile ? 'px-6 py-3' : ''}`}
                      disabled={isOutOfStock}
                    >
                      {isOutOfStock ? (
                        <AlertCircle className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                      ) : (
                        <ShoppingCart className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Out of stock overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black bg-opacity-20 rounded-xl flex items-center justify-center">
                    <Badge className="bg-red-600 text-white">
                      SIN STOCK
                    </Badge>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}