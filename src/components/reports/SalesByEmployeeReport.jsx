
import React from 'react';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BarChart, Bar, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import { User, TrendingUp, DollarSign } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales, users } = data;
  const { startDate, endDate, location, employee } = filters;

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;

  const employeeSales = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    });

    const aggregated = relevantSales.reduce((acc, sale) => {
      const email = sale.created_by;
      if (!acc[email]) {
        acc[email] = { revenue: 0, transactions: 0 };
      }
      acc[email].revenue += sale.total_amount;
      acc[email].transactions += 1;
      return acc;
    }, {});

    const tableData = Object.entries(aggregated)
      .map(([email, data]) => {
        const userInfo = users.find(u => u.email === email);
        return {
          user: userInfo,
          email,
          ...data,
          ticketAvg: data.transactions > 0 ? data.revenue / data.transactions : 0
        };
      })
      .sort((a,b) => b.revenue - a.revenue);
      
    const topSeller = tableData[0];
    const totalSellers = tableData.length;
    const totalRevenue = tableData.reduce((sum, s) => sum + s.revenue, 0);

    return { tableData, topSeller, totalSellers, totalRevenue };

  }, [sales, users, start, end, location, employee]);

  return employeeSales;
}

export default function SalesByEmployeeReport({ data, filters }) {
    const { tableData, topSeller, totalSellers, totalRevenue } = useFilteredData(data, filters);
    
    const chartData = tableData.slice(0, 10).map(item => ({
        name: item.user?.full_name?.split(' ')[0] || 'N/A',
        Ingresos: item.revenue
    }));

    return (
        <div>
            <h3 className="text-lg font-semibold mb-6 text-slate-800">Ventas por Vendedor</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <ReportCard 
                title="Mejor Vendedor"
                value={topSeller?.user?.full_name || 'N/A'}
                subtitle={`$${(topSeller?.revenue || 0).toLocaleString()}`}
                icon={TrendingUp}
                color="green"
              />
              <ReportCard 
                title="Vendedores Activos"
                value={totalSellers}
                icon={User}
                color="blue"
              />
              <ReportCard 
                title="Total Vendido"
                value={`$${totalRevenue.toLocaleString()}`}
                icon={DollarSign}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Tooltip 
                      cursor={{fill: 'rgba(240, 240, 240, 0.5)'}}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Bar dataKey="Ingresos" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[350px] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-right">Ticket Promedio</TableHead>
                            <TableHead className="text-right">Ingresos</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tableData.map(item => (
                            <TableRow key={item.email}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{item.user?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium">{item.user?.full_name || 'Usuario desconocido'}</div>
                                            <div className="text-xs text-slate-500">{item.email}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">${item.ticketAvg.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                                <TableCell className="text-right font-bold">${item.revenue.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
            </div>
        </div>
    );
}
