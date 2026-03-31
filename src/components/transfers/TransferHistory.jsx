import React, { useState, useEffect } from 'react';
import { InventoryMovement } from "@/entities/InventoryMovement";
import { Inventory } from "@/entities/Inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  History, 
  ArrowRight, 
  Package,
  Building2,
  RefreshCw,
  Undo2,
  Loader2,
  Send,
  Download
} from "lucide-react";
import { formatColombiaDate } from "../utils/dateUtils";
import html2canvas from "html2canvas";
import { sendImageWhatsApp } from "@/utils/whatsappImage";

const LoadingSkeleton = () => (
  Array(8).fill(0).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    </TableRow>
  ))
);

export default function TransferHistory({ locations, products, onRefresh }) {
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reverting, setReverting] = useState(null); // transfer id being reverted
  const [confirmTransfer, setConfirmTransfer] = useState(null); // transfer to confirm revert
  const [filters, setFilters] = useState({
    search: "",
    location: "all",
    dateRange: "week"
  });

  const loadTransfers = async () => {
    setIsLoading(true);
    try {
      // Get transfer movements (both in and out)
      const transferMovements = await InventoryMovement.filter({
        movement_type: { $in: ["transfer_out", "transfer_in"] }
      }, "-created_date");

      // Group transfer out and in movements together robustly
      const groupedTransfers = {};
      
      // First pass: create entries for all 'transfer_out' movements
      transferMovements
        .filter(m => m.movement_type === 'transfer_out')
        .forEach(movement => {
          groupedTransfers[movement.id] = {
            ...movement,
            out_movement: movement,
            in_movement: null // Initialize as null
          };
        });
      
      // Second pass: link 'transfer_in' movements to their 'transfer_out' record
      transferMovements
        .filter(m => m.movement_type === 'transfer_in' && m.reference_id)
        .forEach(movement => {
          if (groupedTransfers[movement.reference_id]) {
            groupedTransfers[movement.reference_id].in_movement = movement;
          }
        });

      setTransfers(Object.values(groupedTransfers));
    } catch (error) {
      console.error("Error loading transfer history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  // Filter transfers
  const filteredTransfers = transfers.filter(transfer => {
    if (!transfer.out_movement) return false;
    
    const searchLower = filters.search.toLowerCase();
    const searchMatch = !filters.search ||
      transfer.product_id?.toLowerCase().includes(searchLower) ||
      transfer.reason?.toLowerCase().includes(searchLower);
    
    const locationMatch = filters.location === "all" || 
      transfer.out_movement.location_id === filters.location ||
      transfer.in_movement?.location_id === filters.location;
    
    // Simple date filtering - could be enhanced
    return searchMatch && locationMatch;
  });

  const getProductName = (sku) => {
    const product = products.find(p => p.sku === sku);
    return product ? product.name : 'Producto desconocido';
  };

  const getLocationName = (id) => {
    const location = locations.find(l => l.id === id);
    return location ? location.name : 'Ubicación desconocida';
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

  const generateDailyImageAndSend = async (locationId) => {
    const locationName = getLocationName(locationId);
    // Pick transfers for TODAY and involving this location (origin or destination)
    const todayTransfers = transfers.filter(t => {
      const ts = t?.out_movement?.created_date || t?.created_date;
      const involves = t?.out_movement?.location_id === locationId || t?.in_movement?.location_id === locationId;
      return involves && isSameLocalDay(ts);
    });

    // Build offscreen container
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
          <div style="font-size:18px;font-weight:700;">Historial de Traslados (Hoy)</div>
          <div style="font-size:14px;color:#475569;">Sucursal: <strong>${locationName}</strong></div>
        </div>
        <div style="text-align:right;font-size:12px;color:#64748b;">${formatColombiaDate(new Date().toISOString(), 'dd/MM/yy HH:mm')}</div>
      </div>
    `;

    const rowsHTML = todayTransfers.length ? todayTransfers.map(t => {
      const prod = getProductName(t.product_id);
      const qty = Math.abs(t.quantity || 0);
      const origin = getLocationName(t.out_movement?.location_id);
      const dest = t.in_movement ? getLocationName(t.in_movement?.location_id) : 'Pendiente';
      const motive = t.reason || '—';
      const time = formatColombiaDate(t.out_movement?.created_date, 'HH:mm');
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${time}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${prod}<br/><span style="color:#64748b">SKU: ${t.product_id}</span></td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#b91c1c;">${origin}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#15803d;">${dest}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;">${qty} uds</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${motive}</td>
        </tr>
      `;
    }).join('') : `
      <tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;font-size:13px;">No hay traslados para hoy en esta sucursal</td></tr>
    `;

    container.innerHTML = `
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#f8fafc;padding:16px 16px 0 16px;">${headerHTML}</div>
        <div style="padding:0 16px 16px 16px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9;text-transform:uppercase;font-size:11px;color:#475569;">
                <th style="padding:8px;text-align:left;">Hora</th>
                <th style="padding:8px;text-align:left;">Producto</th>
                <th style="padding:8px;text-align:left;">Origen</th>
                <th style="padding:8px;text-align:left;">Destino</th>
                <th style="padding:8px;text-align:center;">Cantidad</th>
                <th style="padding:8px;text-align:left;">Motivo</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      await new Promise(r => setTimeout(r, 0));
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('No se pudo generar la imagen');

      const todayLabel = formatColombiaDate(new Date().toISOString(), 'dd/MM/yy');
      await sendImageWhatsApp({
        imageBlob: blob,
        message: `Historial de Traslados (Hoy ${todayLabel}) - Sucursal: ${locationName}`
      });
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

  const generateDailyImageAndDownload = async (locationId) => {
    const locationName = getLocationName(locationId);
    const todayTransfers = transfers.filter(t => {
      const ts = t?.out_movement?.created_date || t?.created_date;
      const involves = t?.out_movement?.location_id === locationId || t?.in_movement?.location_id === locationId;
      return involves && isSameLocalDay(ts);
    });

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
          <div style="font-size:18px;font-weight:700;">Historial de Traslados (Hoy)</div>
          <div style="font-size:14px;color:#475569;">Sucursal: <strong>${locationName}</strong></div>
        </div>
        <div style="text-align:right;font-size:12px;color:#64748b;">${formatColombiaDate(new Date().toISOString(), 'dd/MM/yy HH:mm')}</div>
      </div>
    `;

    const rowsHTML = todayTransfers.length ? todayTransfers.map(t => {
      const prod = getProductName(t.product_id);
      const qty = Math.abs(t.quantity || 0);
      const origin = getLocationName(t.out_movement?.location_id);
      const dest = t.in_movement ? getLocationName(t.in_movement?.location_id) : 'Pendiente';
      const motive = t.reason || '—';
      const time = formatColombiaDate(t.out_movement?.created_date, 'HH:mm');
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${time}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${prod}<br/><span style="color:#64748b">SKU: ${t.product_id}</span></td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#b91c1c;">${origin}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#15803d;">${dest}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;">${qty} uds</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${motive}</td>
        </tr>
      `;
    }).join('') : `
      <tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;font-size:13px;">No hay traslados para hoy en esta sucursal</td></tr>
    `;

    container.innerHTML = `
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#f8fafc;padding:16px 16px 0 16px;">${headerHTML}</div>
        <div style="padding:0 16px 16px 16px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9;text-transform:uppercase;font-size:11px;color:#475569;">
                <th style="padding:8px;text-align:left;">Hora</th>
                <th style="padding:8px;text-align:left;">Producto</th>
                <th style="padding:8px;text-align:left;">Origen</th>
                <th style="padding:8px;text-align:left;">Destino</th>
                <th style="padding:8px;text-align:center;">Cantidad</th>
                <th style="padding:8px;text-align:left;">Motivo</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    try {
      await new Promise(r => setTimeout(r, 0));
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const todayLabel = formatColombiaDate(new Date().toISOString(), 'dd-MM-yy');
      const safeLoc = String(locationName || '').replace(/[^a-zA-Z0-9-_]+/g, '_');
      downloadBlob(blob, `traslados_${safeLoc}_${todayLabel}.jpg`);
    } finally {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }
  };

  const handleRevert = async (transfer) => {
    const outMovement = transfer.out_movement;
    const inMovement = transfer.in_movement;
    if (!outMovement) return;

    const quantity = Math.abs(outMovement.quantity || 0);
    const fromLocationId = outMovement.location_id;
    const toLocationId = inMovement?.location_id;
    const productId = outMovement.product_id;

    setReverting(transfer.out_movement.id);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch current inventory records for both locations
      const allInv = await Inventory.list();
      const originInv = allInv.find(i => i.product_id === productId && i.location_id === fromLocationId);
      const destInv = toLocationId ? allInv.find(i => i.product_id === productId && i.location_id === toLocationId) : null;

      // Restore stock to origin
      if (originInv) {
        await Inventory.update(originInv.id, {
          current_stock: originInv.current_stock + quantity,
          last_movement_date: today
        });
      }

      // Deduct stock from destination
      if (destInv) {
        await Inventory.update(destInv.id, {
          current_stock: Math.max(0, destInv.current_stock - quantity),
          last_movement_date: today
        });
      }

      // Delete the movement records
      await InventoryMovement.delete(outMovement.id);
      if (inMovement) await InventoryMovement.delete(inMovement.id);

      // Reload
      await loadTransfers();
      onRefresh();
    } catch (err) {
      console.error("Error revirtiendo traslado:", err);
    } finally {
      setReverting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirm Revert Dialog */}
      <AlertDialog open={!!confirmTransfer} onOpenChange={() => setConfirmTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revertir traslado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto devolverá <strong>{Math.abs(confirmTransfer?.out_movement?.quantity || 0)} unidades</strong> de{' '}
              <strong>{getProductName(confirmTransfer?.product_id)}</strong> a{' '}
              <strong>{getLocationName(confirmTransfer?.out_movement?.location_id)}</strong>{' '}
              y descontará del destino. Los registros de movimiento serán eliminados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { handleRevert(confirmTransfer); setConfirmTransfer(null); }}
            >
              Sí, revertir traslado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <Input
                placeholder="Buscar por producto o motivo..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Sucursal</label>
              <Select value={filters.location} onValueChange={(value) => setFilters(prev => ({ ...prev, location: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Sucursales</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => { loadTransfers(); onRefresh(); }}
                variant="outline"
                className="gap-2"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refrescar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfer History */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historial de Traslados ({filteredTransfers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Producto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <LoadingSkeleton />
                ) : filteredTransfers.length > 0 ? (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.out_movement?.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-slate-400 shrink-0" />
                          <div>
                            <p className="font-medium text-slate-900">{getProductName(transfer.product_id)}</p>
                            <p className="text-xs text-slate-500">SKU: {transfer.product_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="font-medium text-red-700">{getLocationName(transfer.out_movement?.location_id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                          {transfer.in_movement ? (
                            <>
                              <Building2 className="w-4 h-4 text-green-500 shrink-0" />
                              <span className="font-medium text-green-700">{getLocationName(transfer.in_movement?.location_id)}</span>
                            </>
                          ) : (
                            <span className="text-sm text-yellow-600">Pendiente</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-100 text-blue-800">{Math.abs(transfer.quantity || 0)} uds</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{transfer.reason || 'Sin motivo'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-500">{formatColombiaDate(transfer.out_movement?.created_date, 'dd/MM/yy HH:mm')}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              const locId = transfer.in_movement?.location_id || transfer.out_movement?.location_id;
                              if (locId) generateDailyImageAndSend(locId);
                            }}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              const locId = transfer.in_movement?.location_id || transfer.out_movement?.location_id;
                              if (locId) generateDailyImageAndDownload(locId);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={reverting === transfer.out_movement?.id}
                            onClick={() => setConfirmTransfer(transfer)}
                          >
                            {reverting === transfer.out_movement?.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Undo2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      No hay traslados registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array(4).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredTransfers.length > 0 ? (
              filteredTransfers.map((transfer) => (
                <div key={transfer.out_movement?.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{getProductName(transfer.product_id)}</p>
                        <p className="text-xs text-slate-400">SKU: {transfer.product_id}</p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">{Math.abs(transfer.quantity || 0)} uds</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="font-medium text-red-700 truncate">{getLocationName(transfer.out_movement?.location_id)}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {transfer.in_movement ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="font-medium text-green-700 truncate">{getLocationName(transfer.in_movement?.location_id)}</span>
                      </div>
                    ) : (
                      <span className="text-yellow-600 text-xs">Pendiente</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate">{transfer.reason || 'Sin motivo'}</span>
                    <span className="shrink-0 ml-2">{formatColombiaDate(transfer.out_movement?.created_date, 'dd/MM/yy HH:mm')}</span>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 text-xs gap-1"
                      onClick={() => {
                        const locId = transfer.in_movement?.location_id || transfer.out_movement?.location_id;
                        if (locId) generateDailyImageAndSend(locId);
                      }}
                    >
                      <Send className="w-3 h-3" /> Enviar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 text-xs gap-1"
                      onClick={() => {
                        const locId = transfer.in_movement?.location_id || transfer.out_movement?.location_id;
                        if (locId) generateDailyImageAndDownload(locId);
                      }}
                    >
                      <Download className="w-3 h-3" /> Descargar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs gap-1"
                      disabled={reverting === transfer.out_movement?.id}
                      onClick={() => setConfirmTransfer(transfer)}
                    >
                      {reverting === transfer.out_movement?.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Undo2 className="w-3 h-3" />}
                      Revertir
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                No hay traslados registrados
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}