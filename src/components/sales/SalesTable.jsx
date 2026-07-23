import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Edit, Trash2, Send, ChevronRight, ChevronDown, Loader2, StickyNote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SaleItem } from "@/entities/SaleItem";
import { sendInvoiceWhatsApp } from "@/utils/whatsappInvoice";

const statusColors = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  credit: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-orange-100 text-orange-800"
};
const statusLabels = {
  completed: "Completada", credit: "Crédito", pending: "Pendiente",
  cancelled: "Cancelada", returned: "Devuelta"
};

// Config de métodos de pago (icono + color)
const PAY = {
  cash:     { label: "Efectivo",      icon: "💵", cls: "bg-emerald-100 text-emerald-700" },
  transfer: { label: "Transferencia", icon: "🏦", cls: "bg-purple-100 text-purple-700" },
  qr:       { label: "QR",            icon: "🏦", cls: "bg-purple-100 text-purple-700" },
  card:     { label: "Tarjeta",       icon: "💳", cls: "bg-blue-100 text-blue-700" },
  credit:   { label: "Crédito",       icon: "📝", cls: "bg-amber-100 text-amber-700" },
  courtesy: { label: "Cortesía",      icon: "🎁", cls: "bg-pink-100 text-pink-700" },
};

function PayBadges({ methods }) {
  const list = Array.isArray(methods) ? methods : [];
  if (list.length === 0) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((m, i) => {
        const cfg = PAY[m.method] || { label: m.method, icon: "•", cls: "bg-slate-100 text-slate-600" };
        return <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>;
      })}
    </div>
  );
}

const LoadingSkeleton = () => (
  Array(8).fill(0).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-16 rounded" /></TableCell>
    </TableRow>
  ))
);

const formatDate = (dateString) => {
  if (!dateString) return { date: '', time: '' };
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return { date: '', time: '' };
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` };
};

export default function SalesTable({ sales, onViewDetail, onEditSale, onDeleteSale, canDelete = true, isLoading, isProcessing }) {
  const [expandedId, setExpandedId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const toggleExpand = async (sale) => {
    if (expandedId === sale.id) { setExpandedId(null); return; }
    setExpandedId(sale.id);
    if (!itemsCache[sale.id]) {
      setLoadingId(sale.id);
      try {
        const items = await SaleItem.filter({ sale_id: sale.id });
        setItemsCache(prev => ({ ...prev, [sale.id]: items || [] }));
      } catch { setItemsCache(prev => ({ ...prev, [sale.id]: [] })); }
      setLoadingId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-900/40">
            <TableHead className="w-8"></TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead>Pago</TableHead>
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
              const f = formatDate(sale.sale_date || sale.created_date);
              const isOpen = expandedId === sale.id;
              const items = itemsCache[sale.id];
              return (
                <React.Fragment key={sale.id}>
                  <TableRow
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer ${isOpen ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
                    onClick={() => toggleExpand(sale)}
                  >
                    <TableCell className="text-slate-400">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{f.date}</p>
                      <p className="text-xs text-slate-500">{f.time}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{sale.customer_name || 'Cliente General'}</p>
                      {sale.customer_phone && <p className="text-xs text-slate-500">{sale.customer_phone}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                        {sale.invoice_number || `#${sale.id.slice(-8)}`}
                      </span>
                    </TableCell>
                    <TableCell><PayBadges methods={sale.payment_methods} /></TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        ${(sale.total_amount || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[sale.status] || "bg-gray-100 text-gray-800"}>
                        {statusLabels[sale.status] || sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="outline" size="icon" title="Enviar por WhatsApp"
                          onClick={() => sendInvoiceWhatsApp({ sale, items: itemsCache[sale.id] || sale.items || [], companyInfo: {}, printFormat: '80mm' })}
                          disabled={isProcessing} className="h-8 w-8 text-green-600">
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" title="Ver factura completa"
                          onClick={() => onViewDetail(sale)} disabled={isProcessing} className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" title="Editar"
                          onClick={() => onEditSale(sale)} disabled={isProcessing} className="h-8 w-8 text-blue-600">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {canDelete && (
                          <Button variant="outline" size="icon" title="Anular"
                            onClick={() => onDeleteSale(sale)} disabled={isProcessing} className="h-8 w-8 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow className="bg-slate-50/70 dark:bg-slate-900/40">
                      <TableCell colSpan={8} className="py-3 px-8">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Productos */}
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Productos</p>
                            {loadingId === sale.id && !items ? (
                              <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
                            ) : !items || items.length === 0 ? (
                              <p className="text-sm text-slate-400">Sin productos registrados.</p>
                            ) : (
                              <div className="space-y-1">
                                {items.map((it, i) => (
                                  <div key={i} className="flex justify-between items-baseline text-sm gap-2">
                                    <span className="text-slate-700 dark:text-slate-200">
                                      <span className="font-semibold">{it.quantity}×</span> {it.product_name || it.nombre || it.product_id}
                                    </span>
                                    <span className="tabular-nums text-slate-500 shrink-0">${(Number(it.line_total) || 0).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Pago + notas */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Desglose de pago</p>
                              {(sale.payment_methods || []).length === 0 ? (
                                <p className="text-sm text-slate-400">Sin detalle de pago.</p>
                              ) : (
                                <div className="space-y-1">
                                  {sale.payment_methods.map((m, i) => {
                                    const cfg = PAY[m.method] || { label: m.method, icon: "•" };
                                    return (
                                      <div key={i} className="flex justify-between text-sm gap-2">
                                        <span className="text-slate-700 dark:text-slate-200">{cfg.icon} {cfg.label}{m.reference ? ` · ${m.reference}` : ''}</span>
                                        <span className="tabular-nums text-slate-500 shrink-0">${(Number(m.amount) || 0).toLocaleString()}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {sale.notes && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notas</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{sale.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-slate-500">
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
