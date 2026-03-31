import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  ShoppingCart, 
  Clock, 
  TrendingUp,
  Target,
  Award
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalesSummary({ summary, isLoading, detailed = false }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle>Resumen de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      label: "Ingresos Totales",
      value: `$${(summary.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      label: "Total Transacciones",
      value: summary.totalTransactions || 0,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      label: "Ticket Promedio",
      value: `$${(summary.avgTicket || 0).toLocaleString()}`,
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      label: "Hora Pico",
      value: summary.peakHour || "No data",
      icon: Award,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Resumen Ejecutivo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-4 rounded-lg ${stat.bgColor} border border-opacity-20`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            </div>
          ))}

          {summary.peakRevenue > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-orange-800">Insights de Horarios</span>
              </div>
              <div className="text-sm text-orange-700">
                <p>• Tu hora más productiva es <strong>{summary.peakHour}</strong></p>
                <p>• Generaste <strong>${(summary.peakRevenue || 0).toLocaleString()}</strong> en esa hora</p>
                <p>• Considera reforzar personal en horarios pico</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}