import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Clock, DollarSign, Trash2, Copy, AlertTriangle, Tag, Users } from "lucide-react";
import { motion } from "framer-motion";

function TarjetaProducto({ producto, materiasPrimas, familias = [], onEdit, onDelete, onCopy }) {
  const costoProduccion = useMemo(() => {
    if (!producto) return 0;

    const costoMateriales = producto.materiales_requeridos?.reduce((acc, material) => {
      const materiaPrimaInfo = materiasPrimas.find(mp => mp.id === material.materia_prima_id);
      if (materiaPrimaInfo && material.cantidad_por_unidad > 0) {
        return acc + (material.cantidad_por_unidad * (materiaPrimaInfo.precio_por_unidad || 0));
      }
      return acc;
    }, 0) || 0;

    const costoManoDeObra = producto.costo_mano_obra || 0;

    return costoMateriales + costoManoDeObra;
  }, [producto, materiasPrimas]);

  const getMaterialInfo = (materialId) => {
    return materiasPrimas.find(m => m.id === materialId);
  };

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent triggering any parent click events (e.g., if the whole card is clickable for editing)
    if (window.confirm(`¿Estás seguro de eliminar "${producto.nombre}"?`)) {
      onDelete(producto.id);
    }
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    onCopy(producto);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-indigo-300 transition-all duration-200 h-full group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">
                {producto.nombre}
              </CardTitle>
              <div className="flex flex-wrap gap-1 mb-1">
                {producto.reference ? (
                  <Badge className="text-xs bg-indigo-100 text-indigo-700 font-mono">
                    Ref. {producto.reference}
                  </Badge>
                ) : (
                  <Badge
                    className="text-xs bg-amber-100 text-amber-700 flex items-center gap-1 cursor-pointer hover:bg-amber-200"
                    onClick={() => onEdit && onEdit(producto)}
                    title="Este producto no tiene código de despacho. Los despachos y entregas mostrarán el código en lugar del nombre."
                  >
                    <AlertTriangle className="w-3 h-3" /> Sin código de despacho
                  </Badge>
                )}
                {producto.familia_id && (() => {
                  const familia = familias.find(f => f.id === producto.familia_id);
                  return familia ? (
                    <Badge className="text-xs bg-green-100 text-green-700">
                      POS: {familia.name}
                    </Badge>
                  ) : null;
                })()}
              </div>
              {/* Badge for tipo_diseno */}
              {producto.tipo_diseno && (
                <Badge variant="outline" className="mb-2 text-xs">
                  {producto.tipo_diseno === "fondo_entero" ? "Fondo Entero" : "Por Secciones"}
                </Badge>
              )}
              {/* Existing tallas display */}
              {producto.tallas && producto.tallas.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {producto.tallas.map((talla) => (
                    <Badge key={talla} variant="outline" className="text-xs border-slate-300">
                      {talla}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {/* Action buttons (Edit, Copy and Delete) */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="hover:bg-blue-50 hover:text-blue-600 transition-colors h-8 w-8"
                title="Copiar producto"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="hover:bg-indigo-50 hover:text-indigo-600 transition-colors h-8 w-8"
                title="Editar producto"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="hover:bg-red-50 hover:text-red-600 transition-colors h-8 w-8"
                title="Eliminar producto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {producto.descripcion && (
            <p className="text-sm text-slate-600 line-clamp-2">
              {producto.descripcion}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {producto.tiempo_fabricacion_horas && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {producto.tiempo_fabricacion_horas}h
                  </div>
                  <div className="text-xs text-slate-500">Fabricación</div>
                </div>
              </div>
            )}
            
            {costoProduccion > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    ${costoProduccion.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">Costo Prod.</div>
                </div>
              </div>
            )}
          </div>

          {(producto.precio_venta > 0 || producto.precio_empleado > 0) && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              {producto.precio_venta > 0 && (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <Tag className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-green-800">
                      ${producto.precio_venta.toLocaleString("es-CO")}
                    </div>
                    <div className="text-xs text-green-600">Precio público</div>
                  </div>
                </div>
              )}
              {producto.precio_empleado > 0 && (
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                  <Users className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-blue-800">
                      ${producto.precio_empleado.toLocaleString("es-CO")}
                    </div>
                    <div className="text-xs text-blue-600">Precio empleado</div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {producto.materiales_requeridos && producto.materiales_requeridos.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Materiales ({producto.materiales_requeridos.length})
              </div>
              <div className="space-y-1">
                {producto.materiales_requeridos.slice(0, 3).map((material, index) => {
                  const materiaInfo = getMaterialInfo(material.materia_prima_id);
                  return (
                    <div key={index} className="text-xs text-slate-600 flex justify-between">
                      <span>{materiaInfo?.nombre || 'Material'}</span>
                      <span>{material.cantidad_por_unidad} {materiaInfo?.unidad_medida}</span>
                    </div>
                  );
                })}
                {producto.materiales_requeridos.length > 3 && (
                  <div className="text-xs text-slate-400">
                    +{producto.materiales_requeridos.length - 3} más...
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaProducto);