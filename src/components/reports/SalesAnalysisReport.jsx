import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReportCard from './ReportCard';
import { Clock, TrendingUp, BarChart3, CreditCard, DollarSign, Banknote } from 'lucide-react';

const paymentMethodLabels = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
  credit: "Crédito",
  courtesy: "Cortesía"
};

const paymentMethodColors = {
  "Efectivo": "#10b981",
  "Tarjeta": "#3b82f6", 
  "Transferencia": "#8b5cf6",
  "QR": "#f59e0b",
  "Crédito": "#ef4444",
  "Cortesía": "#6b7280"
};

function useFilteredData(data, filters) {
  const { sales } = data;
  const { startDate, endDate, location, employee } = filters;

  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  const analysisData = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    });

    // ===== ANÁLISIS HORARIO =====
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

    // ===== ANÁLISIS POR MÉTODO DE PAGO =====
    const aggregated = relevantSales.reduce((acc, sale) => {
      if (sale.payment_methods && Array.isArray(sale.payment_methods)) {
        sale.payment_methods.forEach(p => {
          const method = paymentMethodLabels[p.method] || p.method;
          if (!acc[method]) {
            acc[method] = { amount: 0, transactions: 0 };
          }
          acc[method].amount += p.amount;
          acc[method].transactions += 1;
        });
      }
      return acc;
    }, {});

    const totalAmount = Object.values(aggregated).reduce((sum, data) => sum + data.amount, 0);
    const totalTransactions = Object.values(aggregated).reduce((sum, data) => sum + data.transactions, 0);

    const paymentData = Object.entries(aggregated)
      .map(([name, data]) => ({ 
        name, 
        Ingresos: data.amount,
        transactions: data.transactions,
        fill: paymentMethodColors[name] || "#64748b"
      }))
      .sort((a,b) => b.Ingresos - a.Ingresos);

    return { 
      hourlyData, 
      peakHour, 
      totalSales, 
      activeHours,
      paymentData,
      totalAmount,
      totalTransactions,
      methodBreakdown: aggregated
    };

  }, [sales, start, end, location, employee]);
  
  return analysisData;
}

export default function SalesAnalysisReport({ data, filters }) {
  const { 
    hourlyData, 
    peakHour, 
    totalSales, 
    activeHours,
    paymentData,
    totalAmount,
    totalTransactions,
    methodBreakdown
  } = useFilteredData(data, filters);

  const getHourLabel = (hour) => {
    if (hour >= 6 && hour < 12) return "Mañana";
    if (hour >= 12 && hour < 18) return "Tarde";
    if (hour >= 18 && hour < 22) return "Noche";
    return "Madrugada";
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* ========== SECCIÓN: ANÁLISIS HORARIO ========== */}
      <div className="space-y-4">
        <h3 className="text-lg lg:text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Análisis Horario
        </h3>
        
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
                <div className="h-64 lg:h-72">
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
                        <p className="text-sm lg:text-base font-semibold text-slate-800">
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

      {/* ========== SEPARADOR ========== */}
      <div className="border-t-2 border-slate-200"></div>

      {/* ========== SECCIÓN: MÉTODOS DE PAGO ========== */}
      <div className="space-y-4">
        <h3 className="text-lg lg:text-xl font-semibold text-slate-800 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-green-600" />
          Métodos de Pago
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
          <ReportCard 
            title="Total Recaudado"
            value={`$${totalAmount.toLocaleString()}`}
            icon={DollarSign}
            color="green"
          />
          <ReportCard 
            title="Transacciones"
            value={totalTransactions.toLocaleString()}
            icon={CreditCard}
            color="blue"
          />
          <ReportCard 
            title="Ticket Promedio"
            value={`$${totalTransactions > 0 ? (totalAmount / totalTransactions).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}`}
            icon={Banknote}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm lg:text-base">Distribución por Método</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="Ingresos" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm lg:text-base">Desglose</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 lg:space-y-3">
                  {Object.entries(methodBreakdown)
                    .sort(([,a], [,b]) => b.amount - a.amount)
                    .map(([method, data]) => (
                    <div key={method} className="p-2 lg:p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: paymentMethodColors[method] || "#64748b" }}
                        />
                        <span className="font-medium text-xs lg:text-sm">{method}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm lg:text-base font-semibold text-slate-800">
                          ${data.amount.toLocaleString()}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {data.transactions} txn
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}