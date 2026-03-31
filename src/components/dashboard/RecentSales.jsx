import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatColombiaDate } from "../utils/dateUtils";

const statusColors = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  credit: "bg-blue-100 text-blue-800"
};

const statusLabels = {
  completed: "Completada",
  pending: "Pendiente", 
  cancelled: "Cancelada",
  credit: "Crédito"
};

export default function RecentSales({ sales, isLoading }) {
  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Ventas Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : sales && sales.length > 0 ? (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div>
                  <p className="font-medium text-slate-900">
                    {sale.customer_name || 'Cliente General'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{formatColombiaDate(sale.sale_date || sale.created_date, "dd/MM/yyyy HH:mm")} COL</span>
                    <span>•</span>
                    <span>#{sale.invoice_number || sale.id.slice(-8)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">
                    ${(sale.total_amount || 0).toLocaleString()}
                  </p>
                  <Badge className={`${statusColors[sale.status]} text-xs`}>
                    {statusLabels[sale.status] || sale.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No hay ventas recientes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}