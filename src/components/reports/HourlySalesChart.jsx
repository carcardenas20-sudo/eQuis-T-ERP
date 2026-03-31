import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReportCard from './ReportCard';
import { Clock, TrendingUp, BarChart3 } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales } = data;
  const { startDate, endDate, location, employee } = filters;

  // Convertir strings a objetos Date
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  const hourlySales = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    });

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        hourNum: hour,
        Ventas: 0,
        transactions: 0
    }));
    
    relevantSales.forEach(sale => {
        const saleHour = new Date(sale.created_date).getHours();
        hourlyData[saleHour].Ventas += sale.total_amount;
        hourlyData[saleHour].transactions += 1;
    });

    const peakHour = hourlyData.reduce((max, current) => 
        current.Ventas > max.Ventas ? current : max
    );

    const totalSales = hourlyData.reduce((sum, hour) => sum + hour.Ventas, 0);
    const activeHours = hourlyData.filter(hour => hour.Ventas > 0).length;

    return { hourlyData, peakHour, totalSales, activeHours };

  }, [sales, start, end, location, employee]);
  
  return hourlySales;
}

export default function HourlySalesChart({ data, filters }) {
  const { hourlyData, peakHour, totalSales, activeHours } = useFilteredData(data, filters);

  const getHourLabel = (hour) => {
    if (hour >= 6 && hour < 12) return "Mañana";
    if (hour >= 12 && hour < 18) return "Tarde";
    if (hour >= 18 && hour < 22) return "Noche";
    return "Madrugada";
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <h3 className="text-base lg:text-lg font-semibold text-slate-800">Análisis Horario</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        <ReportCard 
          title="Hora Pico"
          value={peakHour.hour}
          subtitle={`$${peakHour.Ventas.toLocaleString()} - ${getHourLabel(peakHour.hourNum)}`}
          icon={TrendingUp}
          color="green"
        />
        <ReportCard 
          title="Horas Activas"
          value={`${activeHours}/24`}
          subtitle="Horas con ventas"
          icon={Clock}
          color="blue"
        />
        <ReportCard 
          title="Promedio/Hora"
          value={`$${activeHours > 0 ? (totalSales / activeHours).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}`}
          icon={BarChart3}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm lg:text-base">Distribución Horaria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip 
                      formatter={(value) => [`$${value.toLocaleString()}`, 'Ventas']}
                      labelFormatter={(label) => `Hora: ${label}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="Ventas" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm lg:text-base">Por Franja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 lg:space-y-3">
                {["Mañana", "Tarde", "Noche", "Madrugada"].map(period => {
                  let hours;
                  if (period === "Mañana") hours = hourlyData.slice(6, 12);
                  else if (period === "Tarde") hours = hourlyData.slice(12, 18);
                  else if (period === "Noche") hours = hourlyData.slice(18, 22);
                  else hours = [...hourlyData.slice(22), ...hourlyData.slice(0, 6)];

                  const periodSales = hours.reduce((sum, h) => sum + h.Ventas, 0);
                  const periodTransactions = hours.reduce((sum, h) => sum + h.transactions, 0);

                  return (
                    <div key={period} className="p-2 lg:p-3 bg-slate-50 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-xs lg:text-sm">{period}</span>
                        <Badge variant="outline" className="text-xs">{periodTransactions}</Badge>
                      </div>
                      <p className="text-sm lg:text-lg font-semibold text-slate-800">
                        ${periodSales.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}