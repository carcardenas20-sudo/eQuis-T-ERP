import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, Receipt, Calendar } from "lucide-react";

export default function ExpenseStats({ expenses }) {
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const averageExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;

  // Calculate category breakdown
  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const topCategory = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)[0];

  const categoryLabels = {
    servicios_publicos: "Servicios Públicos",
    alquiler: "Alquiler",
    suministros: "Suministros", 
    marketing: "Marketing",
    transporte: "Transporte",
    alimentacion: "Alimentación",
    mantenimiento: "Mantenimiento",
    salarios: "Salarios",
    impuestos: "Impuestos",
    seguros: "Seguros",
    telecomunicaciones: "Telecomunicaciones",
    otros: "Otros"
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      <Card className="shadow-sm border-0 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 leading-tight">
            Total Gastos
          </CardTitle>
          <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-red-600 tabular-nums break-all">
            ${totalExpenses.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {expenses.length} transacciones
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-0 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 leading-tight">
            Promedio
          </CardTitle>
          <DollarSign className="w-4 h-4 text-orange-500 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums break-all">
            ${averageExpense.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Promedio del período
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-0 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 leading-tight">
            N.º Gastos
          </CardTitle>
          <Receipt className="w-4 h-4 text-blue-500 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {expenses.length}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gastos registrados
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-0 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3 sm:px-6 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 leading-tight">
            Categoría Principal
          </CardTitle>
          <Calendar className="w-4 h-4 text-purple-500 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-sm sm:text-lg font-bold text-slate-900 truncate">
            {topCategory ? categoryLabels[topCategory[0]] || topCategory[0] : 'N/A'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {topCategory ? `$${topCategory[1].toLocaleString()}` : 'Sin gastos'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}