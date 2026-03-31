import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Edit, Trash2, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-orange-100 text-orange-800"
};

const statusLabels = {
  completed: "Completada",
  pending: "Pendiente",
  cancelled: "Cancelada",
  returned: "Devuelta"
};

const LoadingSkeleton = () => (
  Array(8).fill(0).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-16 rounded" /></TableCell>
    </TableRow>
  ))
);

// ✅ FUNCIÓN SIMPLIFICADA para formatear fechas
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}`
  };
};

import { sendInvoiceWhatsApp } from "@/utils/whatsappInvoice";

export default function SalesTable({ sales, onViewDetail, onEditSale, onDeleteSale, isLoading, isProcessing }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>Fecha y Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <LoadingSkeleton />
          ) : sales.length > 0 ? (
            sales.map(sale => {
              const formatted = formatDate(sale.sale_date || sale.created_date);
              return (
                <TableRow key={sale.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{formatted.date}</p>
                      <p className="text-xs text-slate-500">{formatted.time}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">
                        {sale.customer_name || 'Cliente General'}
                      </p>
                      {sale.customer_phone && (
                        <p className="text-xs text-slate-500">{sale.customer_phone}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {sale.invoice_number || `#${sale.id.slice(-8)}`}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-slate-900">
                      ${(sale.total_amount || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[sale.status] || "bg-gray-100 text-gray-800"}>
                      {statusLabels[sale.status] || sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendInvoiceWhatsApp({ sale, items: sale.items || [], companyInfo: {}, printFormat: '80mm' })}
                        className="gap-2"
                        disabled={isProcessing}
                      >
                        <Send className="w-4 h-4" />
                        WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetail(sale)}
                        className="gap-2"
                        disabled={isProcessing}
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditSale(sale)}
                        className="gap-2 text-blue-600 hover:text-blue-700 hover:border-blue-300"
                        disabled={isProcessing}
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteSale(sale)}
                        className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300"
                        disabled={isProcessing}
                      >
                        <Trash2 className="w-4 h-4" />
                        Anular
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                No hay ventas que coincidan con los filtros aplicados
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}