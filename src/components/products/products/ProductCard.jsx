import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Package, 
  PackageX, 
  DollarSign, 
  Tag,
  FileText
} from "lucide-react";

export default function ProductCard({ product, onEdit, onToggleStatus }) {
  return (
    <Card className={`hover:shadow-lg transition-all duration-200 ${
      !product.is_active ? 'opacity-60' : ''
    }`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 text-lg mb-1">
              {product.name}
            </h3>
            <p className="text-sm font-medium text-blue-600 mb-2">
              Ref: {product.reference}
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <DollarSign className="w-4 h-4" />
                <span className="font-semibold text-green-600">
                  ${product.manufacturing_price?.toFixed(2)} por unidad
                </span>
              </div>
              
              {product.category && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Tag className="w-4 h-4" />
                  {product.category}
                </div>
              )}
              
              {product.description && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <FileText className="w-4 h-4 mt-0.5" />
                  <p className="line-clamp-2">{product.description}</p>
                </div>
              )}
            </div>
          </div>
          
          <Badge 
            variant={product.is_active ? "default" : "secondary"}
            className={product.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
          >
            {product.is_active ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(product)}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          
          <Button
            variant={product.is_active ? "destructive" : "default"}
            size="sm"
            onClick={() => onToggleStatus(product)}
            className={product.is_active ? "" : "bg-green-600 hover:bg-green-700"}
          >
            {product.is_active ? (
              <>
                <PackageX className="w-4 h-4 mr-2" />
                Inactivar
              </>
            ) : (
              <>
                <Package className="w-4 h-4 mr-2" />
                Activar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}