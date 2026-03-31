
import React from 'react';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ReportCard from './ReportCard';
import { UserCheck, TrendingUp, CreditCard } from 'lucide-react';

function useFilteredData(data, filters) {
  const { sales, customers, credits } = data;
  const { startDate, endDate, location, employee } = filters;

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;

  const customerSales = useMemo(() => {
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
      const locationMatch = location === 'all' || sale.location_id === location;
      const employeeMatch = employee === 'all' || sale.created_by === employee;
      return dateMatch && locationMatch && employeeMatch && sale.customer_id;
    });

    const aggregated = relevantSales.reduce((acc, sale) => {
      const id = sale.customer_id;
      if (!acc[id]) {
        acc[id] = { revenue: 0, transactions: 0 };
      }
      acc[id].revenue += sale.total_amount;
      acc[id].transactions += 1;
      return acc;
    }, {});

    const tableData = Object.entries(aggregated)
      .map(([id, data]) => {
        const customerInfo = customers.find(c => c.id === id);
        const creditInfo = credits.filter(c => c.customer_id === id).reduce((sum, c) => sum + c.pending_amount, 0);
        return {
          customer: customerInfo,
          id,
          credit: creditInfo,
          ...data
        };
      })
      .sort((a,b) => b.revenue - a.revenue);
      
    const topCustomer = tableData[0];
    const totalPendingCredit = tableData.reduce((sum, c) => sum + c.credit, 0);

    return { tableData, topCustomer, totalPendingCredit };

  }, [sales, customers, credits, start, end, location, employee]);

  return customerSales;
}

export default function CustomerSalesReport({ data, filters }) {
    const { tableData, topCustomer, totalPendingCredit } = useFilteredData(data, filters);

    return (
        <div>
            <h3 className="text-lg font-semibold mb-6 text-slate-800">Ventas por Cliente</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <ReportCard 
                title="Mejor Cliente"
                value={topCustomer?.customer?.name || 'N/A'}
                subtitle={`$${(topCustomer?.revenue || 0).toLocaleString()}`}
                icon={TrendingUp}
                color="green"
              />
              <ReportCard 
                title="Clientes con Compras"
                value={tableData.length}
                icon={UserCheck}
                color="blue"
              />
              <ReportCard 
                title="Saldo Pendiente Total"
                value={`$${totalPendingCredit.toLocaleString()}`}
                subtitle="De este grupo de clientes"
                icon={CreditCard}
                color="orange"
              />
            </div>

            <div className="max-h-[600px] overflow-y-auto bg-white p-4 rounded-xl shadow-md border border-slate-100">
            <Table>
                <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Compras</TableHead>
                        <TableHead className="text-right">Gasto Total</TableHead>
                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tableData.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <div className="font-medium">{item.customer?.name || 'Cliente desconocido'}</div>
                                <div className="text-xs text-slate-500">{item.customer?.phone}</div>
                            </TableCell>
                            <TableCell className="text-right">{item.transactions}</TableCell>
                            <TableCell className="text-right font-bold">${item.revenue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant={item.credit > 0 ? "destructive" : "default"} className={item.credit > 0 ? "" : "bg-green-100 text-green-800"}>
                                    ${item.credit.toLocaleString()}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
        </div>
    );
}
