import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Producto.list();
      setProducts((data || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
    } catch (err) {
      console.error("Error:", err);
      setProducts([]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Productos</h1>
          <p className="text-slate-600">Catálogo de productos (administrado en Producción)</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catálogo de Productos ({products.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {products.map(product => (
                  <Card key={product.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="mb-4">
                        <h3 className="font-bold text-slate-900 text-lg mb-1">{product.name}</h3>
                        <p className="text-sm text-slate-600 font-medium">Ref: {product.reference}</p>
                      </div>

                      <div className="space-y-3">
                        {product.manufacturing_price ? (
                          <div className="text-center bg-green-50 py-3 rounded-lg">
                            <p className="text-2xl font-bold text-green-700">
                              ${product.manufacturing_price?.toLocaleString()}
                            </p>
                            <p className="text-xs text-green-600">Costo mano de obra</p>
                          </div>
                        ) : null}

                        <div className="flex justify-center">
                          <Badge className="bg-green-100 text-green-800">Activo</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-lg">No hay productos en el catálogo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
