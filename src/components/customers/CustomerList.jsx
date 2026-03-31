import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Users, EyeOff, Eye, Trash2, Search, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const LoadingSkeleton = () => (
  Array(8).fill(0).map((_, i) => (
    <TableRow key={i}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
    </TableRow>
  ))
);

export default function CustomerList({ 
  customers, 
  searchTerm, 
  onSearchChange, 
  onEditCustomer, 
  onToggleActive, 
  onDeleteCustomer, 
  isLoading 
}) {
  return (
    <div>
      {/* Search Bar */}
      <div className="p-4 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar clientes por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <LoadingSkeleton />
            ) : customers.length > 0 ? (
              customers.map(customer => (
                <TableRow key={customer.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {customer.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{customer.name}</p>
                        <p className="text-xs text-slate-500">
                          Cliente desde {new Date(customer.created_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="font-mono">{customer.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.is_active ? "default" : "destructive"} className={customer.is_active ? "bg-emerald-500" : ""}>
                      {customer.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditCustomer(customer)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggleActive(customer)}>
                          {customer.is_active ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" /> Desactivar
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" /> Activar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDeleteCustomer(customer)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  {searchTerm ? "No se encontraron clientes con ese criterio" : "No hay clientes registrados aún"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}