import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Package, Eye, Trash2, Send, Download } from "lucide-react";
import { formatColombiaDate } from "../utils/dateUtils";
import html2canvas from "html2canvas";
import { sendImageWhatsApp } from "@/utils/whatsappImage";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  ordered: "bg-blue-100 text-blue-800", 
  partial: "bg-orange-100 text-orange-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800"
};

const statusLabels = {
  pending: "Pendiente",
  ordered: "Ordenada",
  partial: "Parcial", 
  received: "Recibida",
  cancelled: "Cancelada"
};

export default function PurchaseList({ 
  purchases, 
  suppliers, 
  locations, 
  filters, 
  onEditPurchase,
  onViewPurchase,
  onDeletePurchase,
  isLoading 
}) {
  
  // Filter purchases based on search criteria
  const filteredPurchases = purchases.filter(purchase => {
    const supplier = suppliers.find(s => s.id === purchase.supplier_id);
    const location = locations.find(l => l.id === purchase.location_id);
    
    const searchMatch = !filters.search ||
      purchase.purchase_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
      supplier?.nombre?.toLowerCase().includes(filters.search.toLowerCase()) ||
      purchase.supplier_invoice?.toLowerCase().includes(filters.search.toLowerCase());
    
    const statusMatch = filters.status === "all" || purchase.status === filters.status;
    const supplierMatch = filters.supplier === "all" || purchase.supplier_id === filters.supplier;
    const locationMatch = filters.location === "all" || purchase.location_id === filters.location;
    
    return searchMatch && statusMatch && supplierMatch && locationMatch;
  });

  const getLocationName = (id) => {
    const location = locations.find(l => l.id === id);
    return location ? location.name : 'Ubicación';
  };

  const getSupplierName = (id) => {
    const supplier = suppliers.find(s => s.id === id);
    return supplier ? supplier.nombre : 'Proveedor';
  };

  const getTodayLocalYMD = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isSameLocalDay = (isoString) => {
    if (!isoString) return false;
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === getTodayLocalYMD();
  };

  const buildDailyPurchasesContainer = (locationId) => {
    const locationName = getLocationName(locationId);
    const todayList = purchases.filter(p => p.location_id === locationId && p.status === 'received' && isSameLocalDay(p.purchase_date || p.created_date));

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '900px';
    container.style.padding = '16px';
    container.style.background = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

    const headerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <div style="font-size:18px;font-weight:700;">Compras Recibidas (Hoy)</div>
          <div style="font-size:14px;color:#475569;">Sucursal: <strong>${locationName}</strong></div>
        </div>
        <div style="text-align:right;font-size:12px;color:#64748b;">${formatColombiaDate(new Date().toISOString(), 'dd/MM/yy HH:mm')}</div>
      </div>
    `;

    const rowsHTML = todayList.length ? todayList.map(p => {
      const hour = formatColombiaDate(p.purchase_date || p.created_date, 'HH:mm');
      const number = p.purchase_number || `#${String(p.id||'').slice(-8)}`;
      const supplier = getSupplierName(p.supplier_id);
      const invoice = p.supplier_invoice || '—';
      const total = `$${(p.total_amount || 0).toLocaleString()}`;
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${hour}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${number}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${supplier}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${invoice}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;">${total}</td>
        </tr>
      `;
    }).join('') : `
      <tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;font-size:13px;">No hay compras recibidas hoy en esta sucursal</td></tr>
    `;

    container.innerHTML = `
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#f8fafc;padding:16px 16px 0 16px;">${headerHTML}</div>
        <div style="padding:0 16px 16px 16px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9;text-transform:uppercase;font-size:11px;color:#475569;">
                <th style="padding:8px;text-align:left;">Hora</th>
                <th style="padding:8px;text-align:left;">N° Compra</th>
                <th style="padding:8px;text-align:left;">Proveedor</th>
                <th style="padding:8px;text-align:left;">Factura</th>
                <th style="padding:8px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>
    `;

    return { container, locationName, list: todayList };
  };

  const generateDailyPurchasesAndSend = async (locationId) => {
    const { container, locationName } = buildDailyPurchasesContainer(locationId);
    document.body.appendChild(container);
    try {
      await new Promise(r => setTimeout(r, 0));
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const todayLabel = formatColombiaDate(new Date().toISOString(), 'dd/MM/yy');
      await sendImageWhatsApp({ imageBlob: blob, message: `Compras recibidas (Hoy ${todayLabel}) - Sucursal: ${locationName}` });
    } finally {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const generateDailyPurchasesAndDownload = async (locationId) => {
    const { container, locationName } = buildDailyPurchasesContainer(locationId);
    document.body.appendChild(container);
    try {
      await new Promise(r => setTimeout(r, 0));
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const todayLabel = formatColombiaDate(new Date().toISOString(), 'dd-MM-yy');
      const safeLoc = String(locationName || '').replace(/[^a-zA-Z0-9-_]+/g, '_');
      downloadBlob(blob, `compras_${safeLoc}_${todayLabel}.jpg`);
    } finally {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const ActionMenu = ({ purchase }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => generateDailyPurchasesAndSend(purchase.location_id)}>
          <Send className="w-4 h-4 mr-2" /> Enviar JPG (hoy, sucursal)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => generateDailyPurchasesAndDownload(purchase.location_id)}>
          <Download className="w-4 h-4 mr-2" /> Descargar JPG (hoy, sucursal)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewPurchase(purchase)}>
          <Eye className="w-4 h-4 mr-2" /> Ver Detalles
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEditPurchase(purchase)}>
          <Edit className="w-4 h-4 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDeletePurchase(purchase)} className="text-red-600">
          <Trash2 className="w-4 h-4 mr-2" /> Eliminar y Revertir Inventario
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (filteredPurchases.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        {filters.search || filters.status !== "all" || filters.supplier !== "all"
          ? "No se encontraron compras que coincidan con los filtros aplicados"
          : "No hay órdenes de compra registradas"}
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3 p-1">
        {filteredPurchases.map((purchase) => {
          const supplier = suppliers.find(s => s.id === purchase.supplier_id);
          const location = locations.find(l => l.id === purchase.location_id);
          return (
            <div key={purchase.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">
                    {purchase.purchase_number || `#${purchase.id.slice(-8)}`}
                  </p>
                  {purchase.supplier_invoice && (
                    <p className="text-xs text-slate-500">Fact: {purchase.supplier_invoice}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[purchase.status] || 'bg-gray-100 text-gray-800'}>
                    {statusLabels[purchase.status] || purchase.status}
                  </Badge>
                  <ActionMenu purchase={purchase} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Proveedor</p>
                  <p className="font-medium text-slate-800 truncate">{supplier?.nombre || 'Eliminado'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Sucursal</p>
                  <p className="font-medium text-slate-800">{location?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Fecha</p>
                  <p className="font-medium text-slate-800">{formatColombiaDate(purchase.purchase_date, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="font-semibold text-slate-900">${(purchase.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>N° Compra</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPurchases.map((purchase) => {
              const supplier = suppliers.find(s => s.id === purchase.supplier_id);
              const location = locations.find(l => l.id === purchase.location_id);
              return (
                <TableRow key={purchase.id} className="hover:bg-slate-50">
                  <TableCell>
                    <p className="font-medium">{purchase.purchase_number || `#${purchase.id.slice(-8)}`}</p>
                    {purchase.supplier_invoice && <p className="text-xs text-slate-500">Fact: {purchase.supplier_invoice}</p>}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{supplier?.nombre || 'Proveedor eliminado'}</p>
                    {supplier?.contact_name && <p className="text-xs text-slate-500">{supplier.contact_name}</p>}
                  </TableCell>
                  <TableCell><span className="font-medium">{location?.name || 'Sin sucursal'}</span></TableCell>
                  <TableCell>
                    <p className="font-medium">{formatColombiaDate(purchase.purchase_date, 'dd/MM/yyyy')}</p>
                    {purchase.expected_date && <p className="text-xs text-slate-500">Esperada: {formatColombiaDate(purchase.expected_date, 'dd/MM/yyyy')}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[purchase.status] || 'bg-gray-100 text-gray-800'}>
                      {statusLabels[purchase.status] || purchase.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">${(purchase.total_amount || 0).toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionMenu purchase={purchase} />
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