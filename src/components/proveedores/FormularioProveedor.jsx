import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2, User } from "lucide-react";
import { motion } from "framer-motion";

export default function FormularioProveedor({ proveedor, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(proveedor || {
    nombre: "",
    contactos: [],
    direccion: "",
    ciudad: "",
    observaciones: "",
    activo: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      alert("El nombre del proveedor es obligatorio.");
      return;
    }

    // Enviar directamente sin validación por ahora
    onSubmit(formData);
  };

  const agregarContacto = () => {
    setFormData({
      ...formData,
      contactos: [
        ...(formData.contactos || []),
        {
          nombre: "",
          cargo: "",
          telefono: "",
          email: "",
          es_principal: (formData.contactos || []).length === 0
        }
      ]
    });
  };

  const actualizarContacto = (index, campo, valor) => {
    const nuevosContactos = [...(formData.contactos || [])];
    
    // Si se marca como principal, desmarcar otros
    if (campo === 'es_principal' && valor) {
      nuevosContactos.forEach((contacto, i) => {
        if (i !== index) contacto.es_principal = false;
      });
    }
    
    nuevosContactos[index] = {
      ...nuevosContactos[index],
      [campo]: valor
    };
    
    setFormData({
      ...formData,
      contactos: nuevosContactos
    });
  };

  const removerContacto = (index) => {
    const contactosActuales = formData.contactos || [];
    const nuevosContactos = contactosActuales.filter((_, i) => i !== index);
    
    // Si se removió el contacto principal y hay otros contactos, marcar el primero como principal
    const teniaPrincipal = contactosActuales[index]?.es_principal;
    if (teniaPrincipal && nuevosContactos.length > 0) {
      nuevosContactos[0].es_principal = true;
    }
    
    setFormData({
      ...formData,
      contactos: nuevosContactos
    });
  };

  const contactos = formData.contactos || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-orange-50 to-red-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-white/50">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Información Básica de la Empresa */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  Información de la Empresa
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nombre" className="text-sm font-medium text-slate-700">
                      Nombre de la Empresa *
                    </Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      placeholder="Ej: Textiles San Martín S.A."
                      className="border-slate-200 focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ciudad" className="text-sm font-medium text-slate-700">
                      Ciudad
                    </Label>
                    <Input
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) => setFormData({...formData, ciudad: e.target.value})}
                      placeholder="Bogotá"
                      className="border-slate-200 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direccion" className="text-sm font-medium text-slate-700">
                      Dirección
                    </Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                      placeholder="Calle 123 #45-67"
                      className="border-slate-200 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contactos */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Personas de Contacto
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={agregarContacto}
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Contacto
                  </Button>
                </div>

                <div className="space-y-4">
                  {contactos.map((contacto, index) => (
                    <Card key={index} className="border-slate-200 bg-slate-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-700">
                              Contacto {index + 1}
                            </span>
                            {contacto.es_principal && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                Principal
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerContacto(index)}
                            className="text-red-500 hover:bg-red-50 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Nombre Completo</Label>
                            <Input
                              value={contacto.nombre}
                              onChange={(e) => actualizarContacto(index, 'nombre', e.target.value)}
                              placeholder="Juan Pérez"
                              className="h-9 border-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Cargo</Label>
                            <Input
                              value={contacto.cargo}
                              onChange={(e) => actualizarContacto(index, 'cargo', e.target.value)}
                              placeholder="Gerente de Ventas"
                              className="h-9 border-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Teléfono</Label>
                            <Input
                              value={contacto.telefono}
                              onChange={(e) => actualizarContacto(index, 'telefono', e.target.value)}
                              placeholder="+57 300 1234567"
                              className="h-9 border-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-slate-600">Email</Label>
                            <Input
                              type="email"
                              value={contacto.email}
                              onChange={(e) => actualizarContacto(index, 'email', e.target.value)}
                              placeholder="juan@empresa.com"
                              className="h-9 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
                          <Label className="text-xs text-slate-600">Contacto Principal</Label>
                          <Switch
                            checked={contacto.es_principal}
                            onCheckedChange={(checked) => actualizarContacto(index, 'es_principal', checked)}
                            size="sm"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {contactos.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                      <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-500 mb-4">No hay contactos agregados</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={agregarContacto}
                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Primer Contacto
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones y Estado */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="observaciones" className="text-sm font-medium text-slate-700">
                    Observaciones
                  </Label>
                  <Textarea
                    id="observaciones"
                    value={formData.observaciones}
                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                    placeholder="Notas adicionales sobre el proveedor..."
                    rows={3}
                    className="border-slate-200 focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="activo" className="text-sm font-medium text-slate-700">
                    Proveedor Activo
                  </Label>
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={(checked) => setFormData({...formData, activo: checked})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-8"
                >
                  {proveedor ? 'Actualizar' : 'Crear'} Proveedor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}