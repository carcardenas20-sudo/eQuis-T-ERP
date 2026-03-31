import React from 'react';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ReportCard from './ReportCard';
import { Percent, Hash, DollarSign } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales, priceLists } = data;
  const { startDate, endDate, location, employee } = filters;

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;

  const priceListSales = useMemo(() => {
    // Filtrar ventas por fecha, ubicación y empleado
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    });

    // Agrupar por lista de precios
    const aggregated = relevantSales.reduce((acc, sale) => {
      // ✅ ARREGLADO: Usar 'default' si no hay price_list_code
      const code = sale.price_list_code || 'default';
      if (!acc[code]) {
        acc[code] = { revenue: 0, transactions: 0 };
      }
      acc[code].revenue += sale.total_amount || 0;
      acc[code].transactions += 1;
      return acc;
    }, {});

    // Convertir a array y agregar información de las listas
    const tableData = Object.entries(aggregated)
      .map(([code, data]) => {
        const listInfo = priceLists.find(l => l.code === code);
        return {
          list: listInfo,
          code,
          name: listInfo?.name || (code === 'default' ? 'Precio por Defecto' : code),
          revenue: data.revenue,
          transactions: data.transactions
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
      
    const topList = tableData.length > 0 ? tableData[0] : null;
    const totalRevenue = tableData.reduce((sum, l) => sum + l.revenue, 0);

    return { tableData, topList, totalRevenue };

  }, [sales, priceLists, start, end, location, employee]);

  return priceListSales;
}

export default function SalesByPriceListReport({ data, filters }) {
    const { tableData, topList, totalRevenue } = useFilteredData(data, filters);
    
    const chartData = tableData.map(item => ({
        name: item.name,
        Ingresos: item.revenue
    }));

    return (
        <div>
            <h3 className="text-lg font-semibold mb-6 text-slate-800">Ventas por Lista de Precios</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <ReportCard 
                title="Lista Más Usada"
                value={topList?.name || 'N/A'}
                subtitle={topList ? `$${topList.revenue.toLocaleString()}` : '$0'}
                icon={Percent}
                color="green"
              />
              <ReportCard 
                title="Ingresos Totales"
                value={`$${totalRevenue.toLocaleString()}`}
                icon={DollarSign}
                color="blue"
              />
              <ReportCard 
                title="Listas con Ventas"
                value={tableData.length}
                icon={Hash}
                color="purple"
              />
            </div>

            {tableData.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Percent className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium">No hay datos de listas de precios</p>
                <p className="text-sm">Las ventas en el periodo seleccionado no tienen lista de precios asignada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div style={{ height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${(value/1000)}k`} />
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="Ingresos" fill="#4ade80" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="max-h-[350px] overflow-y-auto">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Lista de Precios</TableHead>
                              <TableHead className="text-right">Transacciones</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {tableData.map(item => (
                              <TableRow key={item.code}>
                                  <TableCell>
                                      <div className="font-medium">{item.name}</div>
                                      <div className="text-xs text-slate-500">Código: {item.code}</div>
                                  </TableCell>
                                  <TableCell className="text-right">{item.transactions}</TableCell>
                                  <TableCell className="text-right font-bold">${item.revenue.toLocaleString()}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                </div>
              </div>
            )}
        </div>
    );
}