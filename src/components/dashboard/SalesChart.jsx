
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalesChart({ data, isLoading }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Tendencia de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Tendencia de Ventas - Últimos 7 Días
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                label={{ value: 'Ingresos', angle: -90, position: 'insideLeft', fill: '#64748b', offset: 0, textAnchor: 'middle' }}
              />
               <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={12}
                label={{ value: 'Ventas', angle: 90, position: 'insideRight', fill: '#10b981', offset: 0, textAnchor: 'middle' }}
              />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'Ingresos' ? `$${value.toLocaleString()}` : value.toLocaleString(), // Updated to use name from Line component
                  name
                ]}
                labelStyle={{ color: '#1e293b' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="revenue" 
                name="Ingresos"
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#1e40af' }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="sales" 
                name="Ventas"
                stroke="#10b981" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
