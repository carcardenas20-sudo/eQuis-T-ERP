import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Package, EyeOff, Eye, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

const getStockBadge = (stock, minStock = 5) => {
  if (stock > minStock) return "bg-green-100 text-green-800";
  if (stock > 0) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
};

export default function ProductList({ products, inventory, onEditProduct, onToggleActive, onDeleteProduct, isLoading }) {
  if (isLoading) {
    return (
      <>
        <div className="md:hidden space-y-3 p-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white border rounded-xl p-4 animate-pulse flex gap-3">
              <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableBody>
              {Array(8).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="flex gap-3"><Skeleton className="w-12 h-12 rounded-lg" /><div><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></div></div></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12 rounded-full mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-14 text-slate-500">
        <Package className="w-14 h-14 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">No se encontraron productos</p>
        <p className="text-sm mt-1 text-slate-400">Prueba ajustando los filtros</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile card view ── */}
      <div className="md:hidden divide-y divide-slate-100">
        {products.map(product => {
          const totalStock = inventory
            .filter(inv => inv.product_id === product.sku)
            .reduce((sum, inv) => sum + inv.current_stock, 0);

          return (
            <div key={product.id} className="flex items-center gap-3 p-3">
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-7 h-7 text-slate-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{product.name}</p>
                <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryBadgeColor(product.category)}`}>
                    {product.category?.replace(/_/g, ' ')}
                  </Badge>
                  <Badge className={`text-[10px] px-1.5 py-0 ${getStockBadge(totalStock, product.minimum_stock)}`}>
                    {totalStock} uds
                  </Badge>
                  <Badge
                    variant={product.is_active ? "default" : "destructive"}
                    className={`text-[10px] px-1.5 py-0 ${product.is_active ? "bg-emerald-500" : ""}`}
                  >
                    {product.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>

              {/* Price + menu */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="font-bold text-slate-900 text-sm">${product.sale_price?.toLocaleString()}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditProduct(product)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleActive(product)}>
                      {product.is_active
                        ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</>
                        : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDeleteProduct(product)} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(product => {
              const totalStock = inventory
                .filter(inv => inv.product_id === product.sku)
                .reduce((sum, inv) => sum + inv.current_stock, 0);

              return (
                <TableRow key={product.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getCategoryBadgeColor(product.category)}>
                      {product.category?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${product.sale_price?.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getStockBadge(totalStock, product.minimum_stock)}>
                      {totalStock}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "destructive"} className={product.is_active ? "bg-emerald-500" : ""}>
                      {product.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditProduct(product)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggleActive(product)}>
                          {product.is_active
                            ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</>
                            : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDeleteProduct(product)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
