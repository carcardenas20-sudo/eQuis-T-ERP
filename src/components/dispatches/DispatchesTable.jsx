import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function DispatchesTable({ dispatches, employees, products, loading }) {
    const getEmployeeName = (id) => employees.find(e => e.employee_id === id)?.name || id;
    const getProductName = (ref) => products.find(p => p.reference === ref)?.name || ref;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3">Cargando despachos...</p>
            </div>
        );
    }

    if (dispatches.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500">
                No hay despachos registrados
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {dispatches.map(dispatch => (
                        <TableRow key={dispatch.id}>
                            <TableCell className="font-medium">
                                {getEmployeeName(dispatch.employee_id)}
                            </TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{getProductName(dispatch.product_reference)}</p>
                                    <p className="text-sm text-slate-500">{dispatch.product_reference}</p>
                                </div>
                            </TableCell>
                            <TableCell>{dispatch.quantity}</TableCell>
                            <TableCell>
                                {dispatch.dispatch_date ? format(new Date(dispatch.dispatch_date), "dd/MM/yyyy") : "N/A"}
                            </TableCell>
                            <TableCell>
                                <Badge 
                                    className={
                                        dispatch.status === 'entregado' ? 'bg-green-100 text-green-800' :
                                        dispatch.status === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-blue-100 text-blue-800'
                                    }
                                >
                                    {dispatch.status === 'despachado' ? 'Despachado' :
                                     dispatch.status === 'en_proceso' ? 'En Proceso' : 'Entregado'}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}