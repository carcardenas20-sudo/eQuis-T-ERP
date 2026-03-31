import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function DeliveriesTable({ deliveries, employees, products, loading, onEdit, onDelete }) {
  if (loading) {
    return <div>Cargando entregas...</div>;
  }
  if (!deliveries || deliveries.length === 0) {
    return <div className="text-center py-8 text-slate-500">No hay entregas registradas.</div>;
  }

  const getEmployeeName = (id) => employees.find(e => e.employee_id === id)?.name || id;
  const getProductName = (ref) => products.find(p => p.reference === ref)?.name || ref;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Monto Total</TableHead>
            <TableHead>Estado Pago</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map(delivery => {
            const items = delivery.items || [{
              product_reference: delivery.product_reference,
              quantity: delivery.quantity,
              unit_price: delivery.unit_price,
              total_amount: delivery.total_amount
            }];
            
            return items.map((item, index) => (
              <TableRow key={`${delivery.id}-${index}`}>
                {index === 0 && (
                  <>
                    <TableCell rowSpan={items.length}>{getEmployeeName(delivery.employee_id)}</TableCell>
                  </>
                )}
                <TableCell>{getProductName(item.product_reference)}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                {index === 0 && (
                  <>
                    <TableCell rowSpan={items.length}>{format(new Date(delivery.delivery_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell rowSpan={items.length}>${delivery.total_amount?.toLocaleString()}</TableCell>
                    <TableCell rowSpan={items.length}>
                      <Badge variant={delivery.status === 'pagado' ? 'default' : 'secondary'} className={delivery.status === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                        {delivery.status}
                      </Badge>
                    </TableCell>
                    <TableCell rowSpan={items.length} className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(delivery)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(delivery.id)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}