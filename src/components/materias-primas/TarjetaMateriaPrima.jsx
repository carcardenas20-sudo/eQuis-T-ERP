
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Building } from "lucide-react";
import { motion } from "framer-motion";

function TarjetaMateriaPrima({ materia, onEdit, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar "${materia.nombre}"?`)) {
      onDelete(materia.id);
    }
  };

  const getTipoColor = (tipo) => {
    const colors = {
      primario: 'bg-green-100 text-green-800 border-green-200',
      secundario: 'bg-blue-100 text-blue-800 border-blue-200',
      terciario: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const proveedores = materia.proveedores || [];
  const proveedorPrincipal = proveedores.find(p => p.tipo === 'primario') || 
                             (materia.proveedor ? { proveedor_nombre: materia.proveedor, tipo: 'primario' } : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-blue-300 transition-all duration-200 h-full group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">
                {materia.nombre}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mb-2">
                {materia.color && (
                  <Badge className="bg-slate-100 text-slate-800 border-slate-200 font-medium">
                    {materia.color}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="hover:bg-blue-50 hover:text-blue-600 transition-colors h-8 w-8"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="hover:bg-red-50 hover:text-red-600 transition-colors h-8 w-8"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500 font-medium">Precio</div>
              <div className="text-lg font-bold text-slate-900">
                ${materia.precio_por_unidad?.toFixed(2) || '0.00'}
              </div>
              <div className="text-xs text-slate-400">por {materia.unidad_medida}</div>
            </div>
            
            {materia.stock_minimo && (
              <div>
                <div className="text-sm text-slate-500 font-medium">Stock Mín.</div>
                <div className="text-lg font-bold text-slate-900">{materia.stock_minimo}</div>
                <div className="text-xs text-slate-400">{materia.unidad_medida}s</div>
              </div>
            )}
          </div>
          
          {/* Proveedores */}
          {(proveedores.length > 0 || proveedorPrincipal) && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Building className="w-4 h-4 text-slate-400" />
                <div className="text-sm font-medium text-slate-700">Proveedores</div>
              </div>
              
              <div className="space-y-2">
                {/* Proveedor principal (nuevo formato o compatibilidad) */}
                {proveedorPrincipal && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 truncate">{proveedorPrincipal.proveedor_nombre}</span>
                    <Badge className={`${getTipoColor('primario')} border text-xs`}>
                      Principal
                    </Badge>
                  </div>
                )}

                {/* Proveedores secundarios y terciarios */}
                {proveedores
                  .filter(p => p.tipo !== 'primario')
                  .map((proveedor, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate">{proveedor.proveedor_nombre}</span>
                      <Badge className={`${getTipoColor(proveedor.tipo)} border text-xs`}>
                        {proveedor.tipo}
                      </Badge>
                    </div>
                  ))
                }

                {proveedores.length > 1 && (
                  <div className="text-xs text-slate-400 mt-1">
                    {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} disponible{proveedores.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {materia.observaciones && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm text-slate-600 line-clamp-2">
                {materia.observaciones}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaMateriaPrima);
