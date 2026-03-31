import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Palette, Settings } from "lucide-react";

export default function ConfiguradorColoresFijos({ 
  materiasPrimas, 
  coloresFijosConfigurados, 
  onColoresFijosChange 
}) {
  const [coloresConfig, setColoresConfig] = useState(coloresFijosConfigurados || {});

  // Filtrar materiales que tienen color fijo
  const materialesColorFijo = materiasPrimas.filter(m => m.color_fijo);

  useEffect(() => {
    // Inicializar con colores por defecto si no están configurados
    const configInicial = { ...coloresConfig };
    let hasChanges = false;

    materialesColorFijo.forEach(material => {
      if (!configInicial[material.id] && material.color_por_defecto) {
        configInicial[material.id] = material.color_por_defecto;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setColoresConfig(configInicial);
      onColoresFijosChange(configInicial);
    }
  }, [materialesColorFijo, coloresConfig, onColoresFijosChange]);

  const handleColorChange = (materialId, color) => {
    const nuevosColores = {
      ...coloresConfig,
      [materialId]: color
    };
    setColoresConfig(nuevosColores);
    onColoresFijosChange(nuevosColores);
  };

  if (materialesColorFijo.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-600" />
          <CardTitle className="text-lg font-bold text-slate-900">
            Configuración de Colores Fijos
          </CardTitle>
        </div>
        <p className="text-sm text-slate-600">
          Define los colores para materiales como cremalleras, botones, hilos, etc.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materialesColorFijo.map((material) => (
            <div key={material.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-slate-700">
                  {material.nombre}
                </Label>
                <Badge variant="outline" className="text-xs">
                  {material.tipo_material}
                </Badge>
              </div>
              <Input
                value={coloresConfig[material.id] || material.color_por_defecto || ''}
                onChange={(e) => handleColorChange(material.id, e.target.value)}
                placeholder={material.color_por_defecto || 'Color...'}
                className="h-9 text-sm border-slate-200 focus:ring-2 focus:ring-purple-500"
              />
              {material.color_por_defecto && (
                <p className="text-xs text-slate-500">
                  Por defecto: {material.color_por_defecto}
                </p>
              )}
            </div>
          ))}
        </div>

        {materialesColorFijo.length > 0 && (
          <div className="text-sm text-slate-600 bg-white/50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4" />
              <span className="font-medium">Configuración Aplicada</span>
            </div>
            <p>
              Estos colores se aplicarán automáticamente a todos los productos del presupuesto.
              Los materiales de tela seguirán usando los colores específicos de cada combinación.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}