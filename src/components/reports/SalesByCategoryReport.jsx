
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import ReportCard from './ReportCard';
import { ShoppingBag, TrendingUp, Hash } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d', '#4BC0C0', '#F7464A'];

const categoryLabels = {
  chaquetas_hombre: "Chaquetas Hombre",
  chaquetas_mujer: "Chaquetas Mujer",
  chaquetas_niños: "Chaquetas Niños",
  accesorios: "Accesorios",
  materia_prima: "Materia Prima"
};

function useFilteredData(data, filters) {
  const { sales, saleItems, products } = data;
  const { startDate, endDate, location, employee } = filters;

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;

  const categorySales = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    }).map(s => s.id);

    const relevantSaleItems = saleItems.filter(item => relevantSales.includes(item.sale_id));
    
    const aggregated = relevantSaleItems.reduce((acc, item) => {
      const product = products.find(p => p.sku === item.product_id);
      const category = product?.category || 'sin_categoria';
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += item.line_total;
      return acc;
    }, {});

    const totalRevenue = Object.values(aggregated).reduce((sum, val) => sum + val, 0);

    const chartData = Object.entries(aggregated)
      .map(([name, value], index) => ({ 
        name: categoryLabels[name] || name, 
        value,
        percentage: totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(1) : 0,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a,b) => b.value - a.value);
    
    const bestCategory = chartData[0];
    const categoryCount = chartData.length;

    return { chartData, bestCategory, categoryCount };

  }, [sales, saleItems, products, start, end, location, employee]);
  
  return categorySales;
}

export default function SalesByCategoryReport({ data, filters }) {
  const { chartData, bestCategory, categoryCount } = useFilteredData(data, filters);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-6 text-slate-800">Ventas por Categoría</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ReportCard 
          title="Categoría Principal"
          value={bestCategory?.name || 'N/A'}
          subtitle={`$${(bestCategory?.value || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        <ReportCard 
          title="Categorías con Ventas"
          value={categoryCount}
          icon={ShoppingBag}
          color="blue"
        />
        <ReportCard 
          title="Participación"
          value={`${bestCategory?.percentage || 0}%`}
          subtitle={`Del total de ventas`}
          icon={Hash}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                paddingAngle={5}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">% del Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map(item => (
                <TableRow key={item.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                       <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">${item.value.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{item.percentage}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
