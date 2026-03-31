import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Product, Inventory, ProductPrice, Location } from "@/entities/all";
import { Plus, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import ProductList from "../components/products/ProductList";
import ProductForm from "../components/products/ProductForm";
import ProductFilters from "../components/products/ProductFilters";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    status: "all",
    stock: "all",
    location: "all"
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productsData, inventoryData, locationsData] = await Promise.all([
        Product.list("-created_date"),
        Inventory.list(),
        Location.list()
      ]);
      setProducts(productsData);
      setInventory(inventoryData);
      setLocations(locationsData);
    } catch (error) {
      console.error("Error loading product data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Inventory scoped to selected location (or all locations)
  const scopedInventory = useMemo(() => {
    if (filters.location === "all") return inventory;
    return inventory.filter(inv => inv.location_id === filters.location);
  }, [inventory, filters.location]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const searchLower = filters.search.toLowerCase();
      
      const searchMatch = filters.search === "" ||
        product.name?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.barcode?.toLowerCase().includes(searchLower);

      const categoryMatch = filters.category === "all" || product.category === filters.category;
      
      const statusMatch = filters.status === "all" ||
        (filters.status === "active" && product.is_active) ||
        (filters.status === "inactive" && !product.is_active);

      const totalStock = scopedInventory
        .filter(inv => inv.product_id === product.sku)
        .reduce((sum, inv) => sum + inv.current_stock, 0);
      
      const stockMatch = filters.stock === "all" ||
        (filters.stock === "in_stock" && totalStock > 0) ||
        (filters.stock === "out_of_stock" && totalStock === 0);

      return searchMatch && categoryMatch && statusMatch && stockMatch;
    });
  }, [products, scopedInventory, filters]);

  const handleOpenForm = (product = null) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingProduct(null);
    setIsFormOpen(false);
  };

  const handleSaveProduct = async (saveData) => {
    const { productData, priceRules } = saveData;
    setIsLoading(true);
    try {
      let savedProduct;
      if (editingProduct) {
        savedProduct = await Product.update(editingProduct.id, productData);
      } else {
        savedProduct = await Product.create(productData);
      }

      const existingRules = await ProductPrice.filter({ product_sku: savedProduct.sku });
      
      for (const oldRule of existingRules) {
        if (!priceRules.find(r => r.id === oldRule.id)) {
          await ProductPrice.delete(oldRule.id);
        }
      }

      for (const rule of priceRules) {
        const ruleData = {
          product_sku: savedProduct.sku,
          price_list_code: rule.price_list_code,
          min_quantity: parseInt(rule.min_quantity, 10),
          price: parseFloat(rule.price)
        };

        if (rule.id && (typeof rule.id !== 'string' || !rule.id.startsWith('new-'))) {
          await ProductPrice.update(rule.id, ruleData);
        } else {
          await ProductPrice.create(ruleData);
        }
      }

      handleCloseForm();
    } catch (error) {
      console.error("Error saving product with prices:", error);
    } finally {
        loadData();
    }
  };

  const handleToggleActive = async (product) => {
    setIsLoading(true);
    try {
      await Product.update(product.id, { is_active: !product.is_active });
      loadData();
    } catch (error) {
      console.error("Error toggling product status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${product.name}"? Esta acción es irreversible.`)) {
      setIsLoading(true);
      try {
        const priceRules = await ProductPrice.filter({ product_sku: product.sku });
        for (const rule of priceRules) {
          await ProductPrice.delete(rule.id);
        }
        await Product.delete(product.id);
        loadData();
      } catch (error) {
        console.error("Error deleting product:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Gestión de Productos</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Administra tu catálogo de productos y materias primas.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={loadData}
              className="gap-2 flex-1 sm:flex-initial"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Filter className="w-4 h-4" />
              )}
              {isLoading ? "Cargando..." : "Refrescar"}
            </Button>
            <Button
              onClick={() => handleOpenForm()}
              className="bg-blue-600 hover:bg-blue-700 gap-2 flex-1 sm:flex-initial"
              disabled={isLoading}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nuevo Producto</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <ProductFilters filters={filters} onFilterChange={setFilters} locations={locations} />

        {/* Product List */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-0">
            <ProductList
              products={filteredProducts}
              inventory={scopedInventory}
              onEditProduct={handleOpenForm}
              onToggleActive={handleToggleActive}
              onDeleteProduct={handleDeleteProduct}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}