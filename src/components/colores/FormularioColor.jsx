import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { motion } from "framer-motion";

export default function FormularioColor({ color, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(color || {
    nombre: "",
    codigo_hex: "#000000",
    descripcion: "",
    activo: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Enviar directamente sin validación de duplicados por ahora
    onSubmit(formData);
  };

  const handleColorChange = (e) => {
    setFormData({ ...formData, codigo_hex: e.target.value });
  };

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
        className="w-full max-w-lg"
      >
        <Card className="bg-white shadow-2xl border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {color ? 'Editar Color' : 'Nuevo Color'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-white/50">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vista previa del color */}
              <div className="text-center">
                <div
                  className="w-24 h-24 mx-auto rounded-full border-4 border-white shadow-lg transition-colors duration-200"
                  style={{ backgroundColor: formData.codigo_hex }}
                />
                <p className="mt-2 text-sm text-slate-500">Vista previa</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre" className="text-sm font-medium text-slate-700">
                    Nombre del Color *
                  </Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    placeholder="Ej: Azul Marino, Verde Esmeralda"
                    className="border-slate-200 focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigo_hex" className="text-sm font-medium text-slate-700">
                    Código de Color *
                  </Label>
                  <div className="flex gap-3 items-center">
                    <Input
                      id="codigo_hex"
                      type="color"
                      value={formData.codigo_hex}
                      onChange={handleColorChange}
                      className="w-16 h-12 border-slate-200 rounded-lg cursor-pointer"
                    />
                    <Input
                      value={formData.codigo_hex}
                      onChange={(e) => setFormData({...formData, codigo_hex: e.target.value})}
                      placeholder="#000000"
                      className="border-slate-200 focus:ring-2 focus:ring-purple-500 font-mono"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion" className="text-sm font-medium text-slate-700">
                    Descripción
                  </Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    placeholder="Descripción o notas sobre el color..."
                    rows={3}
                    className="border-slate-200 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="activo" className="text-sm font-medium text-slate-700">
                    Color Activo
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
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8"
                >
                  {color ? 'Actualizar' : 'Crear'} Color
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}