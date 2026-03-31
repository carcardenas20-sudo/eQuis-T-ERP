import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

export default function AuditSummary({ audit, items }) {
  // Agrupar por producto (solo sumar difference y value del item con idx=0, que es donde se carga la diferencia real)
  const productDifferences = {};
  items.forEach(item => {
    if (!productDifferences[item.product_id]) {
      productDifferences[item.product_id] = {
        product_name: item.product_name,
        total_difference: item.difference || 0,
        total_value: item.difference_value || 0
      };
    }
  });

  const sobrantes = Object.values(productDifferences).filter(p => p.total_difference > 0);
  const faltantes = Object.values(productDifferences).filter(p => p.total_difference < 0);
  const sinDiferencia = Object.values(productDifferences).filter(p => p.total_difference === 0);

  const totalSobranteQty = sobrantes.reduce((acc, p) => acc + p.total_difference, 0);
  const totalFaltanteQty = faltantes.reduce((acc, p) => acc + Math.abs(p.total_difference), 0);
  const totalSobranteValue = sobrantes.reduce((acc, p) => acc + p.total_value, 0);
  const totalFaltanteValue = faltantes.reduce((acc, p) => acc + p.total_value, 0);
  const totalProducts = Object.keys(productDifferences).length;

  const stats = [
    {
      label: "Productos Auditados",
      value: totalProducts,
      icon: null,
      color: "blue"
    },
    {
      label: "Sin Diferencia",
      value: sinDiferencia.length,
      icon: null,
      color: "green"
    },
    {
      label: "Sobrantes",
      value: sobrantes.length,
      subValue: sobrantes.length > 0 ? `+${totalSobranteQty} unidades` : null,
      icon: TrendingUp,
      color: "orange"
    },
    {
      label: "Faltantes",
      value: faltantes.length,
      subValue: faltantes.length > 0 ? `-${totalFaltanteQty} unidades` : null,
      icon: TrendingDown,
      color: "red"
    }
  ];

  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700"
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className={`border ${colorMap[stat.color]}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium opacity-75">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  {stat.subValue && (
                    <p className="text-xs opacity-60 mt-1">{stat.subValue}</p>
                  )}
                </div>
                {Icon && <Icon className="w-5 h-5 opacity-50" />}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Resumen de valores */}
      <Card className="col-span-full border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Valor Sobrante</p>
              <p className="text-xl font-bold text-green-600">${totalSobranteValue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Valor Faltante</p>
              <p className="text-xl font-bold text-red-600">${totalFaltanteValue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Diferencia Neta</p>
              <p className={`text-xl font-bold ${totalSobranteValue > totalFaltanteValue ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(totalSobranteValue - totalFaltanteValue).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Precisión</p>
              <p className="text-xl font-bold text-slate-600">
                {totalProducts > 0 ? ((sinDiferencia.length / totalProducts) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}