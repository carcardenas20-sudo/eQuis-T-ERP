import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import ReportCard from './ReportCard';
import { DollarSign, CalendarDays, TrendingUp } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales } = data;
  const { startDate, endDate, location, employee } = filters;

  // Convertir strings a objetos Date
  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.created_date);
    const dateMatch = saleDate >= start && saleDate <= end;
    const locationMatch = location === 'all' || sale.location_id === location;
    const employeeMatch = employee === 'all' || sale.created_by === employee;
    return dateMatch && locationMatch && employeeMatch;
  });

  const dailyData = eachDayOfInterval({ start, end }).map(day => {
    const formattedDate = format(day, 'MMM dd', { locale: es });
    const dayStr = format(day, 'yyyy-MM-dd');
    const daySales = filteredSales.filter(s => {
      const sDate = new Date(s.created_date);
      return format(sDate, 'yyyy-MM-dd') === dayStr;
    });
    return {
      date: formattedDate,
      Ventas: daySales.reduce((sum, s) => sum + s.total_amount, 0),
    };
  });
  
  const totalSales = dailyData.reduce((sum, day) => sum + day.Ventas, 0);
  const averageSales = dailyData.length > 0 ? totalSales / dailyData.length : 0;
  const bestDay = dailyData.reduce((max, day) => (day.Ventas > max.Ventas ? day : max), { Ventas: -1, date: '' });

  return { dailyData, totalSales, averageSales, bestDay };
}

export default function SalesOverTimeReport({ data, filters }) {
  const { dailyData, totalSales, averageSales, bestDay } = useFilteredData(data, filters);

  return (
    <div className="space-y-4 lg:space-y-6">
      <h3 className="text-base lg:text-lg font-semibold text-slate-800">Evolución de Ventas</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        <ReportCard 
          title="Total Período"
          value={`$${totalSales.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          icon={DollarSign}
          color="blue"
        />
        <ReportCard 
          title="Promedio Diario"
          value={`$${averageSales.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          icon={CalendarDays}
          color="purple"
        />
        <ReportCard 
          title="Mejor Día"
          value={`$${bestDay.Ventas.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
          subtitle={bestDay.date}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div className="h-64 lg:h-96 bg-white p-4 rounded-xl shadow-md">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10 }}
            />
            <Tooltip 
              formatter={(value) => [`$${value.toLocaleString()}`, 'Ventas']}
              contentStyle={{ fontSize: 12 }}
            />
            <Area 
              type="monotone" 
              dataKey="Ventas" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorVentas)" 
              strokeWidth={2} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}