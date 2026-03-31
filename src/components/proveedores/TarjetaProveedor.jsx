
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Building, Phone, Mail, MapPin, Trash2, User, Star } from "lucide-react";
import { motion } from "framer-motion";

function TarjetaProveedor({ proveedor, onEdit, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar el proveedor "${proveedor.nombre}"?`)) {
      onDelete(proveedor.id);
    }
  };

  const contactoPrincipal = proveedor.contactos?.find(c => c.es_principal) || proveedor.contactos?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white border-slate-200 hover:border-orange-300 transition-all duration-200 h-full group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">
                {proveedor.nombre}
              </CardTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  className={`${proveedor.activo 
                    ? 'bg-green-100 text-green-700 border-green-200' 
                    : 'bg-red-100 text-red-700 border-red-200'
                  } border font-medium`}
                >
                  {proveedor.activo ? 'Activo' : 'Inactivo'}
                </Badge>
                {proveedor.contactos && proveedor.contactos.length > 0 && (
                  <Badge variant="outline" className="text-xs border-slate-300">
                    {proveedor.contactos.length} contacto{proveedor.contactos.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="hover:bg-orange-50 hover:text-orange-600 transition-colors h-8 w-8"
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
        
        <CardContent className="space-y-3">
          {/* Contacto Principal */}
          {contactoPrincipal && (
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3 h-3 text-orange-600" />
                <span className="text-xs font-medium text-orange-800">Contacto Principal</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-3 h-3 text-orange-600" />
                  <span className="font-medium text-slate-900">{contactoPrincipal.nombre}</span>
                </div>
                {contactoPrincipal.cargo && (
                  <div className="text-xs text-slate-600 ml-5">{contactoPrincipal.cargo}</div>
                )}
                {contactoPrincipal.telefono && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 ml-5">
                    <Phone className="w-3 h-3" />
                    {contactoPrincipal.telefono}
                  </div>
                )}
                {contactoPrincipal.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 ml-5">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{contactoPrincipal.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información de la Empresa */}
          {proveedor.ciudad && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">{proveedor.ciudad}</span>
            </div>
          )}

          {proveedor.direccion && (
            <div className="flex items-center gap-2 text-sm">
              <Building className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600 truncate">{proveedor.direccion}</span>
            </div>
          )}

          {/* Contactos Adicionales */}
          {proveedor.contactos && proveedor.contactos.length > 1 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Otros Contactos ({proveedor.contactos.length - 1})
              </div>
              <div className="space-y-1">
                {proveedor.contactos
                  .filter(c => !c.es_principal)
                  .slice(0, 2)
                  .map((contacto, index) => (
                    <div key={index} className="text-xs text-slate-600 flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>{contacto.nombre}</span>
                      {contacto.cargo && <span className="text-slate-400">- {contacto.cargo}</span>}
                    </div>
                  ))}
                {proveedor.contactos.filter(c => !c.es_principal).length > 2 && (
                  <div className="text-xs text-slate-400">
                    +{proveedor.contactos.filter(c => !c.es_principal).length - 2} contactos más...
                  </div>
                )}
              </div>
            </div>
          )}

          {proveedor.observaciones && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-sm text-slate-600 line-clamp-2">
                {proveedor.observaciones}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(TarjetaProveedor);
