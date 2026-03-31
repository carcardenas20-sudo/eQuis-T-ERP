import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Eye, EyeOff, Trash2, Building, Phone, Mail } from "lucide-react";

const paymentTermsLabels = {
  cash: "Contado",
  "15_days": "15 días",
  "30_days": "30 días", 
  "45_days": "45 días",
  "60_days": "60 días"
};

export default function SupplierList({ 
  suppliers, 
  onEditSupplier, 
  onToggleActive, 
  onDeleteSupplier,
  isLoading 
}) {

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const getContacto = (supplier) => {
    const contactos = supplier.data?.contactos || [];
    return contactos.find(c => c.es_principal) || contactos[0] || null;
  };

  const ActionMenu = ({ supplier }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditSupplier(supplier)}>
          <Edit className="w-4 h-4 mr-2" /> Editar Proveedor
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onToggleActive(supplier)} className={supplier.activo ? "text-orange-600" : "text-green-600"}>
          {supplier.activo ? <><EyeOff className="w-4 h-4 mr-2" />Desactivar</> : <><Eye className="w-4 h-4 mr-2" />Activar</>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDeleteSupplier(supplier)} className="text-red-600">
          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Building className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        No hay proveedores registrados
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3 p-1">
        {suppliers.map((supplier) => {
          const contacto = getContacto(supplier);
          return (
            <div key={supplier.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{supplier.nombre}</p>
                    {supplier.ciudad && <p className="text-xs text-slate-500">{supplier.ciudad}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={supplier.activo ? "default" : "destructive"} className={supplier.activo ? "bg-emerald-500 text-xs" : "text-xs"}>
                    {supplier.activo ? "Activo" : "Inactivo"}
                  </Badge>
                  <ActionMenu supplier={supplier} />
                </div>
              </div>
              {contacto && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {contacto.nombre && (
                    <div>
                      <p className="text-xs text-slate-400">Contacto</p>
                      <p className="font-medium text-slate-800">{contacto.nombre}</p>
                    </div>
                  )}
                  {contacto.telefono && (
                    <div>
                      <p className="text-xs text-slate-400">Teléfono</p>
                      <p className="flex items-center gap-1 text-slate-700"><Phone className="w-3 h-3" />{contacto.telefono}</p>
                    </div>
                  )}
                  {contacto.email && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400">Email</p>
                      <p className="text-xs text-slate-600 truncate">{contacto.email}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Proveedor</TableHead>
              <TableHead>Contacto Principal</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => {
              const contacto = getContacto(supplier);
              return (
                <TableRow key={supplier.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Building className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{supplier.nombre}</p>
                        {supplier.data?.observaciones && <p className="text-xs text-slate-500">{supplier.data.observaciones}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contacto ? (
                      <div className="space-y-0.5">
                        {contacto.nombre && <p className="font-medium text-slate-800 text-sm">{contacto.nombre}</p>}
                        {contacto.telefono && <div className="flex items-center gap-1 text-xs text-slate-600"><Phone className="w-3 h-3" />{contacto.telefono}</div>}
                        {contacto.email && <div className="flex items-center gap-1 text-xs text-slate-600"><Mail className="w-3 h-3" />{contacto.email}</div>}
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{supplier.ciudad || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={supplier.activo ? "default" : "destructive"} className={supplier.activo ? "bg-emerald-500" : ""}>
                      {supplier.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionMenu supplier={supplier} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}