
import React from 'react';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import { MapPin, TrendingUp, DollarSign } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales, locations, saleItems, products } = data;
  const { startDate, endDate, location, employee } = filters;

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;

  const locationSales = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    });

    const aggregated = relevantSales.reduce((acc, sale) => {
      const locId = sale.location_id;
      if (!acc[locId]) {
        acc[locId] = { revenue: 0, transactions: 0, profit: 0 };
      }
      acc[locId].revenue += sale.total_amount;
      acc[locId].transactions += 1;
      
      const items = saleItems.filter(i => i.sale_id === sale.id);
      items.forEach(item => {
          const product = products.find(p => p.sku === item.product_id);
          acc[locId].profit += item.line_total - (product?.base_cost || 0) * item.quantity;
      });

      return acc;
    }, {});
    
    const tableData = Object.entries(aggregated)
      .map(([id, data]) => {
        const locationInfo = locations.find(l => l.id === id);
        return {
          location: locationInfo,
          id,
          ...data
        };
      })
      .sort((a,b) => b.revenue - a.revenue);
      
    const bestLocation = tableData[0];
    const totalRevenue = tableData.reduce((sum, loc) => sum + loc.revenue, 0);

    return { tableData, bestLocation, totalRevenue };

  }, [sales, saleItems, products, locations, start, end, location, employee]);
  
  return locationSales;
}

export default function SalesByLocationReport({ data, filters }) {
    const { tableData, bestLocation, totalRevenue } = useFilteredData(data, filters);
    
    const chartData = tableData.map(item => ({
        name: item.location?.name ? (item.location.name.length > 10 ? item.location.name.substring(0, 10) + '...' : item.location.name) : 'N/A',
        Ingresos: item.revenue
    }));

    return (
        <div>
            <h3 className="text-lg font-semibold mb-6 text-slate-800">Rendimiento por Sucursal</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <ReportCard 
                title="Sucursal Principal"
                value={bestLocation?.location?.name || 'N/A'}
                subtitle={`$${(bestLocation?.revenue || 0).toLocaleString()}`}
                icon={TrendingUp}
                color="green"
              />
              <ReportCard 
                title="Total entre Sucursales"
                value={`$${totalRevenue.toLocaleString()}`}
                icon={DollarSign}
                color="blue"
              />
              <ReportCard 
                title="Sucursales Activas"
                value={tableData.length}
                subtitle="Con ventas en el periodo"
                icon={MapPin}
                color="purple"
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `$${(value/1000)}k`} />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="Ingresos" fill="#8884d8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[350px] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sucursal</TableHead>
                            <TableHead className="text-right">Transacciones</TableHead>
                            <TableHead className="text-right">Utilidad</TableHead>
                            <TableHead className="text-right">Ingresos</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tableData.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium">{item.location?.name || 'Sucursal desconocida'}</div>
                                    <div className="text-xs text-slate-500">{item.location?.city}</div>
                                </TableCell>
                                <TableCell className="text-right font-medium">{item.transactions}</TableCell>
                                <TableCell className="text-right font-semibold text-green-600">${item.profit.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-bold text-blue-600">${item.revenue.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
            </div>
        </div>
    );
}
