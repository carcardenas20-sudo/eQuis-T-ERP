import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function HourlyAnalysisTable({ data, isLoading }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle>Análisis Detallado por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calcular el promedio para determinar rendimiento
  const avgRevenue = data.reduce((sum, d) => sum + d.revenue, 0) / data.length;
  
  const getPerformanceColor = (revenue) => {
    if (revenue === 0) return "bg-gray-100 text-gray-700";
    if (revenue > avgRevenue * 1.2) return "bg-green-100 text-green-800 border-green-200";
    if (revenue < avgRevenue * 0.5) return "bg-red-100 text-red-800 border-red-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  const getPerformanceIcon = (revenue) => {
    if (revenue === 0) return <Minus className="w-3 h-3" />;
    if (revenue > avgRevenue * 1.2) return <TrendingUp className="w-3 h-3 text-green-600" />;
    if (revenue < avgRevenue * 0.5) return <TrendingDown className="w-3 h-3 text-red-600" />;
    return null;
  };

  const getRecommendation = (hour, sales, revenue) => {
    const hourNum = parseInt(hour);
    
    if (revenue === 0) {
      if (hourNum >= 6 && hourNum <= 22) {
        return "🔴 Considerar abrir - horario comercial";
      }
      return "⚪ Sin actividad - normal";
    }
    
    if (revenue > avgRevenue * 1.5) {
      return "🟢 Hora estrella - reforzar personal";
    }
    
    if (revenue > avgRevenue) {
      return "🟡 Buen rendimiento - mantener";
    }
    
    if (sales > 0 && revenue < avgRevenue * 0.3) {
      return "🟠 Bajo rendimiento - revisar estrategia";
    }
    
    return "⚪ Rendimiento promedio";
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Análisis Detallado por Franja Horaria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Hora</TableHead>
                <TableHead className="text-center">Ventas</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Ticket Prom.</TableHead>
                <TableHead className="text-center">Rendimiento</TableHead>
                <TableHead>Recomendación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((hourData) => (
                <TableRow key={hourData.hour} className="hover:bg-slate-50">
                  <TableCell className="font-medium">
                    {hourData.hour}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-semibold">
                      {hourData.sales}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${hourData.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ${hourData.avgTicket.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={`${getPerformanceColor(hourData.revenue)} border flex items-center gap-1 justify-center`}
                    >
                      {getPerformanceIcon(hourData.revenue)}
                      {hourData.revenue > avgRevenue * 1.2 ? 'Alto' :
                       hourData.revenue < avgRevenue * 0.5 ? 'Bajo' :
                       hourData.revenue === 0 ? 'Sin datos' : 'Normal'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {getRecommendation(hourData.hour, hourData.sales, hourData.revenue)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Resumen de recomendaciones */}
        <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            💡 Recomendaciones Clave
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <strong className="text-green-700">Horas más rentables:</strong>
              <div>
                {data
                  .filter(d => d.revenue > avgRevenue * 1.2)
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 3)
                  .map(d => d.hour)
                  .join(", ") || "No hay datos suficientes"}
              </div>
            </div>
            <div>
              <strong className="text-red-700">Oportunidades de mejora:</strong>
              <div>
                {data
                  .filter(d => d.sales > 0 && d.revenue < avgRevenue * 0.5)
                  .map(d => d.hour)
                  .join(", ") || "Buen rendimiento general"}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}