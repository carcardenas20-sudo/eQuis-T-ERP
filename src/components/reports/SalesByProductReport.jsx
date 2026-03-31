import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useMemo } from 'react';
import ReportCard from './ReportCard';
import { Package, TrendingUp, Hash, ChevronDown, ChevronUp } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales, saleItems, products } = data;
  const { startDate, endDate, location, employee } = filters;

  // Convertir strings a objetos Date
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  const productSales = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    }).map(s => s.id);

    const relevantSaleItems = saleItems.filter(item => relevantSales.includes(item.sale_id));

    const aggregated = relevantSaleItems.reduce((acc, item) => {
      if (!acc[item.product_id]) {
        acc[item.product_id] = { quantity: 0, revenue: 0, cost: 0 };
      }
      acc[item.product_id].quantity += item.quantity;
      acc[item.product_id].revenue += item.line_total;
      const product = products.find(p => p.sku === item.product_id);
      acc[item.product_id].cost += (product?.base_cost || 0) * item.quantity;
      return acc;
    }, {});
    
    const totalRevenue = Object.values(aggregated).reduce((sum, p) => sum + p.revenue, 0);

    const detailedData = Object.entries(aggregated)
      .map(([sku, data]) => {
        const product = products.find(p => p.sku === sku);
        const profit = data.revenue - data.cost;
        return {
          product,
          sku,
          ...data,
          profit,
          margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
          revenue_share: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
    
    const bestSeller = detailedData[0];
    const totalUnitsSold = detailedData.reduce((sum, p) => sum + p.quantity, 0);

    return {
        tableData: detailedData,
        bestSeller,
        totalUnitsSold,
        uniqueProductsSold: detailedData.length,
    }

  }, [sales, saleItems, products, start, end, location, employee]);
  
  return productSales;
}

export default function SalesByProductReport({ data, filters }) {
  const { tableData, bestSeller, totalUnitsSold, uniqueProductsSold } = useFilteredData(data, filters);
  const [showAll, setShowAll] = useState(false);
  
  const displayData = showAll ? tableData : tableData.slice(0, 10);

  return (
    <div className="space-y-4 lg:space-y-6">
      <h3 className="text-base lg:text-lg font-semibold text-slate-800">Productos</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        <ReportCard 
          title="Más Vendido"
          value={bestSeller?.product?.name?.substring(0, 20) || 'N/A'}
          subtitle={`$${(bestSeller?.revenue || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        <ReportCard 
          title="Unidades"
          value={totalUnitsSold.toLocaleString()}
          icon={Package}
          color="blue"
        />
        <ReportCard 
          title="Productos"
          value={uniqueProductsSold}
          icon={Hash}
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
        {/* Vista móvil - Cards */}
        <div className="lg:hidden divide-y divide-slate-100">
          {displayData.map(item => (
            <div key={item.sku} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <p className="font-medium text-sm text-slate-900 line-clamp-2">
                    {item.product?.name || 'Producto no encontrado'}
                  </p>
                  <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                </div>
                <Badge variant={item.margin > 20 ? 'default' : 'destructive'} 
                  className={`${item.margin > 20 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs`}>
                  {item.margin.toFixed(1)}%
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Ventas</span>
                  <span className="font-semibold">${item.revenue.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cantidad</span>
                  <span className="font-semibold">{item.quantity}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Utilidad</span>
                  <span className="font-semibold text-green-600">${item.profit.toLocaleString()}</span>
                </div>
              </div>
              <Progress value={item.revenue_share} className="h-1" />
            </div>
          ))}
        </div>

        {/* Vista desktop - Tabla */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Producto</TableHead>
                <TableHead className="text-xs">Ingresos</TableHead>
                <TableHead className="text-right text-xs">Cantidad</TableHead>
                <TableHead className="text-right text-xs">Utilidad</TableHead>
                <TableHead className="text-right text-xs">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map(item => (
                <TableRow key={item.sku}>
                  <TableCell className="max-w-xs">
                    <div className="font-medium text-sm truncate">{item.product?.name || 'Producto no encontrado'}</div>
                    <div className="text-xs text-slate-500">SKU: {item.sku}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm">${item.revenue.toLocaleString()}</div>
                    <Progress value={item.revenue_share} className="h-1 mt-1" />
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right font-bold text-green-600 text-sm">${item.profit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={item.margin > 20 ? 'default' : 'destructive'} 
                      className={`${item.margin > 20 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs`}>
                      {item.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {tableData.length > 10 && (
          <div className="p-3 border-t border-slate-100 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs gap-1"
            >
              {showAll ? (
                <>Mostrar menos <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Ver todos ({tableData.length}) <ChevronDown className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}