import React, { useState, useEffect } from "react";
import { Producto } from "@/entities/Producto";
import { Product } from "@/entities/Product";
import { ProductPrice } from "@/entities/all";
import { MateriaPrima } from "@/entities/MateriaPrima";
import { Color } from "@/entities/Color";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Shirt } from "lucide-react";

import FormularioProducto from "../components/productos/FormularioProducto";
import TarjetaProducto from "../components/productos/TarjetaProducto";

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [colores, setColores] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      let filtered = productos;
      if (searchTerm) {
        filtered = filtered.filter(p =>
          p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setFilteredProductos(filtered);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, productos]);

  const loadData = async () => {
    setIsLoading(true);
    const [productosData, materiasData, coloresData, familiasData] = await Promise.all([
      Producto.list("-created_date"),
      MateriaPrima.list(),
      Color.list(),
      Product.list()
    ]);
    setProductos(productosData);
    setMateriasPrimas(materiasData);
    setColores(coloresData);
    setFamilias(familiasData || []);
    setIsLoading(false);
  };

  const syncPriceLists = async (familiaId, precioVenta, precioEmpleado) => {
    if (!familiaId) return;

    const existing = await ProductPrice.filter({ product_sku: familiaId });

    const existingRetail    = existing.find(r => r.price_list_code === 'RETAIL');
    const existingWholesale = existing.find(r => r.price_list_code === 'WHOLESALE');

    if (precioVenta > 0) {
      const ruleData = { product_sku: familiaId, price_list_code: 'RETAIL', min_quantity: 1, price: precioVenta };
      if (existingRetail) {
        await ProductPrice.update(existingRetail.id, ruleData);
      } else {
        await ProductPrice.create(ruleData);
      }
    } else if (existingRetail) {
      await ProductPrice.delete(existingRetail.id);
    }

    if (precioEmpleado > 0) {
      const ruleData = { product_sku: familiaId, price_list_code: 'WHOLESALE', min_quantity: 1, price: precioEmpleado };
      if (existingWholesale) {
        await ProductPrice.update(existingWholesale.id, ruleData);
      } else {
        await ProductPrice.create(ruleData);
      }
    } else if (existingWholesale) {
      await ProductPrice.delete(existingWholesale.id);
    }
  };

  const handleSubmit = async (data) => {
    if (editingProducto && editingProducto.id) {
      await Producto.update(editingProducto.id, data);
    } else {
      await Producto.create(data);
    }

    await syncPriceLists(data.familia_id, data.precio_venta || 0, data.precio_empleado || 0);

    setShowForm(false);
    setEditingProducto(null);
    loadData();
  };

  const handleEdit = (producto) => {
    setEditingProducto(producto);
    setShowForm(true);
  };

  const handleCopy = (productoOriginal) => {
    // Crear copia del producto con nuevo nombre y sin ID
    const productoCopia = {
      ...productoOriginal,
      nombre: `${productoOriginal.nombre} - Copia`,
      // Remover ID para que se cree como nuevo producto
      id: undefined,
      // Generar nuevos row_ids para los materiales para evitar conflictos
      // Esto es crucial para que el formulario los trate como nuevas entradas si el original ya tenía row_ids
      materiales_requeridos: (productoOriginal.materiales_requeridos || []).map(material => ({
        ...material,
        row_id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    };
    
    console.log('📋 Copiando producto:', productoOriginal.nombre);
    console.log('✨ Producto copia creado:', productoCopia);
    
    // Abrir formulario de edición con la copia
    setEditingProducto(productoCopia);
    setShowForm(true);
  };

  const handleDelete = async (productoId) => {
    try {
      await Producto.delete(productoId);
      loadData();
    } catch (error) {
      alert('Error al eliminar el producto');
    }
  };

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Catálogo de Productos</h1>
            <p className="text-slate-600 text-lg">Gestiona los diseños y especificaciones de tus chaquetas</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium px-6 py-3 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Producto
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar productos por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Modal */}
        {showForm && (
          <FormularioProducto
            producto={editingProducto}
            materiasPrimas={materiasPrimas}
            colores={colores}
            familias={familias}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingProducto(null);
            }}
          />
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredProductos.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shirt className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No se encontraron productos
              </h3>
              <p className="text-slate-500 mb-6">
                {searchTerm
                  ? "Intenta ajustar tu búsqueda"
                  : "Comienza agregando tu primer producto"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primer Producto
                </Button>
              )}
            </div>
          ) : (
            filteredProductos.map((producto) => (
              <TarjetaProducto
                key={producto.id}
                producto={producto}
                materiasPrimas={materiasPrimas}
                familias={familias}
                onEdit={() => handleEdit(producto)}
                onCopy={() => handleCopy(producto)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}