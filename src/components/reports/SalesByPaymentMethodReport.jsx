import React from 'react';
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReportCard from './ReportCard';
import { DollarSign, CreditCard, Banknote } from 'lucide-react';

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

    const start = startDate ? parseISO(startDate) : null;
    const end = endDate ? parseISO(endDate) : null;

    const paymentData = useMemo(() => {
        const relevantSales = sales.filter(sale => {
            const saleDate = new Date(sale.created_date);
            const dateMatch = start && end ? saleDate >= start && saleDate <= end : true;
            const locationMatch = location === 'all' || sale.location_id === location;
            const employeeMatch = employee === 'all' || sale.created_by === employee;
            return dateMatch && locationMatch && employeeMatch;
        });

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

        return {
            chartData: Object.entries(aggregated)
                .map(([name, data]) => ({ 
                    name, 
                    Ingresos: data.amount,
                    fill: paymentMethodColors[name] || "#64748b"
                }))
                .sort((a,b) => b.Ingresos - a.Ingresos),
            totalAmount,
            totalTransactions,
            methodBreakdown: aggregated
        };

    }, [sales, start, end, location, employee]);

    return paymentData;
}

export default function SalesByPaymentMethodReport({ data, filters }) {
    const { chartData, totalAmount, totalTransactions, methodBreakdown } = useFilteredData(data, filters);

    return (
        <div>
            <h3 className="text-lg font-semibold mb-6 text-slate-800">Ingresos por Medio de Pago</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <ReportCard 
                  title="Total Recaudado"
                  value={`$${totalAmount.toLocaleString()}`}
                  icon={DollarSign}
                  color="green"
                />
                <ReportCard 
                  title="Transacciones Totales"
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Distribución de Ingresos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(value) => `$${(value / 1000)}k`} />
                                        <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']} />
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
                            <CardTitle>Desglose por Método</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(methodBreakdown)
                                    .sort(([,a], [,b]) => b.amount - a.amount)
                                    .map(([method, data]) => (
                                    <div key={method} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: paymentMethodColors[method] || "#64748b" }}></span>
                                            <span className="font-medium">{method}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">${data.amount.toLocaleString()}</p>
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
    );
}