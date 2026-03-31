import React from 'react';
import { useMemo } from 'react';
import { DollarSign, Package, TrendingUp, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReportCard from './ReportCard';

function useFilteredData(data, filters) {
  const { sales, saleItems, products } = data;
  const { startDate, endDate, location, employee } = filters;

  // Convertir strings a objetos Date
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  const stats = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch;
    }).map(s => s.id);

    const relevantSaleItems = saleItems.filter(item => relevantSales.includes(item.sale_id));
    
    let totalRevenue = 0;
    let totalCost = 0;
    const categoryProfits = {};
    
    relevantSaleItems.forEach(item => {
      totalRevenue += item.line_total;
      const product = products.find(p => p.sku === item.product_id);
      const itemCost = (product?.base_cost || 0) * item.quantity;
      totalCost += itemCost;
      
      const category = product?.category || 'sin_categoria';
      if (!categoryProfits[category]) {
        categoryProfits[category] = { revenue: 0, cost: 0, profit: 0 };
      }
      categoryProfits[category].revenue += item.line_total;
      categoryProfits[category].cost += itemCost;
      categoryProfits[category].profit = categoryProfits[category].revenue - categoryProfits[category].cost;
    });

    const totalProfit = totalRevenue - totalCost;
    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      averageMargin,
      categoryProfits
    };
  }, [sales, saleItems, products, start, end, location, employee]);
  
  return stats;
}

const categoryLabels = {
  chaquetas_hombre: "Chaquetas Hombre",
  chaquetas_mujer: "Chaquetas Mujer", 
  chaquetas_niños: "Chaquetas Niños",
  accesorios: "Accesorios",
  materia_prima: "Materia Prima"
};

export default function ProfitabilityReport({ data, filters }) {
  const { totalRevenue, totalCost, totalProfit, averageMargin, categoryProfits } = useFilteredData(data, filters);

  return (
    <div className="space-y-4 lg:space-y-6">
      <h3 className="text-base lg:text-lg font-semibold text-slate-800">Rentabilidad</h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <ReportCard 
          title="Ingresos"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="blue"
        />
        <ReportCard 
          title="Costos"
          value={`$${totalCost.toLocaleString()}`}
          icon={Package}
          color="orange"
        />
        <ReportCard 
          title="Utilidad"
          value={`$${totalProfit.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        <ReportCard 
          title="Margen"
          value={`${averageMargin.toFixed(1)}%`}
          icon={Percent}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm lg:text-base">Desglose Financiero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs lg:text-sm mb-2">
                <span className="text-slate-600">Margen</span>
                <span className="text-slate-500">
                  {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="relative h-6 bg-red-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Costo: ${totalCost.toLocaleString()}</span>
                <span>Utilidad: ${totalProfit.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-3 border-t">
              <h4 className="font-medium text-xs lg:text-sm mb-2">Indicadores</h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xl lg:text-2xl font-bold text-blue-600">
                    {totalCost > 0 ? (totalRevenue / totalCost).toFixed(1) : 0}x
                  </p>
                  <p className="text-xs text-slate-600">ROI</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-lg lg:text-xl font-bold text-green-600">
                    ${totalRevenue > 0 ? (totalProfit / (totalRevenue / totalCost || 1)).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}
                  </p>
                  <p className="text-xs text-slate-600">Utilidad/Venta</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm lg:text-base">Por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categoryProfits)
                .sort(([,a], [,b]) => b.profit - a.profit)
                .map(([category, catData]) => {
                  const margin = catData.revenue > 0 ? (catData.profit / catData.revenue) * 100 : 0;
                  return (
                    <div key={category} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-xs lg:text-sm truncate pr-2">
                          {categoryLabels[category] || category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          margin > 20 ? 'bg-green-100 text-green-800' : 
                          margin > 10 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {margin.toFixed(1)}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs lg:text-sm">
                          <span className="text-slate-600">Ingresos:</span>
                          <span className="font-medium">${catData.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs lg:text-sm">
                          <span className="text-slate-600">Utilidad:</span>
                          <span className="font-medium text-green-600">${catData.profit.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs lg:text-sm text-slate-500 bg-amber-50 p-3 lg:p-4 rounded-lg border border-amber-200">
        <p className="font-medium text-amber-800 mb-1">📊 Nota:</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Utilidad = Ingresos - Costo de Mercancía</li>
          <li>No incluye gastos operativos</li>
          <li>ROI = Ingresos ÷ Costos</li>
        </ul>
      </div>
    </div>
  );
}