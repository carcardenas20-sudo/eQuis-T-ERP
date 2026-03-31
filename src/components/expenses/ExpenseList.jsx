import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Receipt, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatColombiaDate } from "../utils/dateUtils";

const categoryLabels = {
  servicios_publicos: "Servicios Públicos",
  alquiler: "Alquiler",
  suministros: "Suministros", 
  marketing: "Marketing",
  transporte: "Transporte",
  alimentacion: "Alimentación",
  mantenimiento: "Mantenimiento",
  salarios: "Salarios",
  impuestos: "Impuestos",
  seguros: "Seguros",
  telecomunicaciones: "Telecomunicaciones",
  otros: "Otros"
};

const categoryColors = {
  servicios_publicos: "bg-yellow-100 text-yellow-800",
  alquiler: "bg-blue-100 text-blue-800",
  suministros: "bg-green-100 text-green-800",
  marketing: "bg-purple-100 text-purple-800",
  transporte: "bg-orange-100 text-orange-800",
  alimentacion: "bg-pink-100 text-pink-800",
  mantenimiento: "bg-gray-100 text-gray-800",
  salarios: "bg-indigo-100 text-indigo-800",
  impuestos: "bg-red-100 text-red-800",
  seguros: "bg-teal-100 text-teal-800",
  telecomunicaciones: "bg-cyan-100 text-cyan-800",
  otros: "bg-slate-100 text-slate-800"
};

const paymentMethodLabels = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  check: "Cheque",
  other: "Otro"
};

const LoadingSkeleton = () => (
  Array(8).fill(0).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-8 w-16 rounded" /></TableCell>
    </TableRow>
  ))
);

export default function ExpenseList({ expenses, locations, onEdit, onDelete, isLoading }) {
  const getLocationName = (locationId) => {
    return locations.find(l => l.id === locationId)?.name || "Sin sucursal";
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableBody><LoadingSkeleton /></TableBody>
        </Table>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 border rounded-lg">
        <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        No hay gastos que coincidan con los filtros aplicados
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {expenses.map(expense => (
          <div key={expense.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{expense.description}</p>
                {expense.supplier && <p className="text-xs text-slate-500">{expense.supplier}</p>}
              </div>
              <span className="font-bold text-red-600 shrink-0">${(expense.amount || 0).toLocaleString('es-CO')}</span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge className={`text-xs ${categoryColors[expense.category] || "bg-gray-100 text-gray-800"}`}>
                {categoryLabels[expense.category] || expense.category}
              </Badge>
              <span className="text-xs text-slate-500">{paymentMethodLabels[expense.payment_method] || expense.payment_method}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />{getLocationName(expense.location_id)}
              </span>
              <span>{formatColombiaDate(expense.expense_date + 'T00:00:00.000Z', "dd/MM/yyyy")}</span>
            </div>
            <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => onEdit(expense)} className="text-blue-600 hover:bg-blue-50">
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(expense)} className="text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Método de Pago</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map(expense => (
              <TableRow key={expense.id} className="hover:bg-slate-50">
                <TableCell>
                  <p className="font-medium text-slate-900">{formatColombiaDate(expense.expense_date + 'T00:00:00.000Z', "dd/MM/yyyy")}</p>
                  {expense.created_date && <p className="text-xs text-slate-500">{formatColombiaDate(expense.created_date, "HH:mm")}</p>}
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-900">{expense.description}</p>
                  {expense.supplier && <p className="text-xs text-slate-500">{expense.supplier}</p>}
                  {expense.receipt_number && <p className="text-xs text-slate-500">#{expense.receipt_number}</p>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span className="text-sm">{getLocationName(expense.location_id)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold text-red-600">${(expense.amount || 0).toLocaleString('es-CO')}</span>
                </TableCell>
                <TableCell>
                  <Badge className={categoryColors[expense.category] || "bg-gray-100 text-gray-800"}>
                    {categoryLabels[expense.category] || expense.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-slate-600">{paymentMethodLabels[expense.payment_method] || expense.payment_method}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => onEdit(expense)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(expense)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}