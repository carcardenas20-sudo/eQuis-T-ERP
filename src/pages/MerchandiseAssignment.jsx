import React, { useState, useEffect, useMemo } from "react";
import { localClient } from "@/api/localClient";
import { Location } from "@/entities/Location";
import { Inventory } from "@/entities/Inventory";
import { Product } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageCheck, CheckCircle2, Store, RefreshCw, Undo2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const Delivery = localClient.entities["Delivery"];
const Producto = localClient.entities["Producto"];

export default function MerchandiseAssignment() {
  const [deliveries, setDeliveries] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  // assignments[dateKey][ref][locationId] = qty
  const [assignments, setAssignments] = useState({});
  const [showRevert, setShowRevert] = useState(false);
  const [assignedDeliveries, setAssignedDeliveries] = useState([]);
  const [reverting, setReverting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deliveriesData, locationsData, inventoryData, productosData, posProducts] = await Promise.all([
        Delivery.list("-delivery_date"),
        Location.list(),
        Inventory.list(),
        Producto.list(),
        Product.list(),
      ]);
      const allDeliveries = deliveriesData || [];
      setDeliveries(allDeliveries.filter(d => !d.inventory_assigned));
      // Entregas ya asignadas desde 2026-04-09 para revertir
      setAssignedDeliveries(allDeliveries.filter(d => d.inventory_assigned && (d.delivery_date || '') >= '2026-04-09'));
      setLocations(locationsData || []);
      setInventory(inventoryData || []);
      // Enriquecer productos de producción con el sku del POS
      // familia_id del Producto = id del Product en POS; POS inventory usa Product.sku
      const posMap = new Map((posProducts || []).map(pp => [pp.id, pp]));
      const enriched = (productosData || []).filter(p => p.reference).map(p => {
        const posProduct = p.familia_id ? posMap.get(p.familia_id) : null;
        return { ...p, _posSku: posProduct?.sku || p.reference };
      });
      setProductos(enriched);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const groupByDate = (delivs) => {
    const map = {};
    delivs.forEach(d => {
      const dateKey = (d.delivery_date || "").slice(0, 10);
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = { dateKey, deliveryIds: [], items: {} };
      map[dateKey].deliveryIds.push(d.id);
      (d.items || []).forEach(item => {
        const ref = item.product_reference;
        if (!ref) return;
        if (!map[dateKey].items[ref]) {
          const prod = productos.find(p => p.reference === ref);
          map[dateKey].items[ref] = {
            product_reference: ref,
            product_name: item.product_name || prod?.nombre || ref,
            quantity: 0,
          };
        }
        map[dateKey].items[ref].quantity += Number(item.quantity) || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  };

  const groups = useMemo(() => groupByDate(deliveries), [deliveries, productos]);

  // Inicializar asignaciones cuando cambian los grupos
  useEffect(() => {
    if (groups.length === 0 || locations.length === 0) return;
    setAssignments(prev => {
      const next = { ...prev };
      groups.forEach(({ dateKey, items }) => {
        if (!next[dateKey]) next[dateKey] = {};
        Object.keys(items).forEach(ref => {
          if (!next[dateKey][ref]) next[dateKey][ref] = {};
          locations.forEach(loc => {
            if (next[dateKey][ref][loc.id] === undefined) {
              next[dateKey][ref][loc.id] = "";
            }
          });
        });
      });
      return next;
    });
  }, [groups.length, locations.length]);

  const getAssignedForRef = (dateKey, ref) => {
    const a = assignments[dateKey]?.[ref] || {};
    return Object.values(a).reduce((s, v) => s + (Number(v) || 0), 0);
  };

  const getTotalAssignedAll = (dateKey) => {
    const group = groups.find(g => g.dateKey === dateKey);
    if (!group) return 0;
    return Object.keys(group.items).reduce((s, ref) => s + getAssignedForRef(dateKey, ref), 0);
  };

  const getTotalUnits = (dateKey) => {
    const g = groups.find(g => g.dateKey === dateKey);
    if (!g) return 0;
    return Object.values(g.items).reduce((s, i) => s + i.quantity, 0);
  };

  const updateAssignment = (dateKey, ref, locationId, value) => {
    setAssignments(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [ref]: { ...(prev[dateKey]?.[ref] || {}), [locationId]: value },
      },
    }));
  };

  const handleSkip = async (group) => {
    if (!window.confirm(`¿Marcar las entregas del ${group.dateKey} como ya ingresadas al inventario? No se modificará el inventario.`)) return;
    setSaving(group.dateKey);
    try {
      await Promise.all(group.deliveryIds.map(id => Delivery.update(id, { inventory_assigned: true })));
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSaving(null);
  };

  const handleConfirm = async (group) => {
    const { dateKey, deliveryIds, items } = group;
    const itemsList = Object.values(items);

    // Validar que no se asigne más de lo disponible por referencia
    for (const item of itemsList) {
      const assigned = getAssignedForRef(dateKey, item.product_reference);
      if (assigned > item.quantity) {
        alert(`"${item.product_name}": solo hay ${item.quantity} unidades pero asignaste ${assigned}.`);
        return;
      }
    }

    const totalAssigned = getTotalAssignedAll(dateKey);
    if (totalAssigned === 0) {
      alert("Debes asignar al menos una unidad.");
      return;
    }

    setSaving(dateKey);
    try {
      // Por cada referencia × sucursal, actualizar inventario
      const debugLines = [];
      for (const item of itemsList) {
        const refAssignments = assignments[dateKey]?.[item.product_reference] || {};
        const prod = productos.find(p => p.reference === item.product_reference);
        const productId = prod?._posSku || item.product_reference;
        debugLines.push(`${item.product_name}: ref=${item.product_reference}, familia_id=${prod?.familia_id || 'N/A'}, _posSku=${prod?._posSku || 'N/A'}, productId usado=${productId}`);

        for (const [locationId, qty] of Object.entries(refAssignments)) {
          const quantity = Number(qty);
          if (quantity <= 0) continue;

          const existingInv = inventory.find(
            inv => inv.product_id === productId && inv.location_id === locationId
          );
          if (existingInv) {
            await Inventory.update(existingInv.id, {
              current_stock: (Number(existingInv.current_stock) || 0) + quantity,
              available_stock: (Number(existingInv.available_stock) || 0) + quantity,
            });
          } else {
            await Inventory.create({
              product_id: productId,
              location_id: locationId,
              current_stock: quantity,
              available_stock: quantity,
              reserved_stock: 0,
            });
          }
        }
      }

      await Promise.all(deliveryIds.map(id => Delivery.update(id, { inventory_assigned: true })));
      alert(`✅ ${totalAssigned} unidades asignadas.\n\nDebug mapeo:\n${debugLines.join('\n')}`);
      loadData();
    } catch (err) {
      alert("Error al asignar: " + err.message);
    }
    setSaving(null);
  };

  // Agrupar entregas asignadas por fecha
  const assignedGroups = useMemo(() => {
    const map = {};
    assignedDeliveries.forEach(d => {
      const dateKey = (d.delivery_date || "").slice(0, 10);
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = { dateKey, ids: [], totalUnits: 0 };
      map[dateKey].ids.push(d.id);
      map[dateKey].totalUnits += (d.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    });
    return Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [assignedDeliveries]);

  // Descontar del inventario las cantidades de las entregas que se están revirtiendo
  const revertInventoryForDeliveries = async (deliveryIds) => {
    const delivsToRevert = assignedDeliveries.filter(d => deliveryIds.includes(d.id));
    const [allInv, allProducts] = await Promise.all([Inventory.list(), Product.list()]);
    const posMap = new Map((allProducts || []).map(pp => [pp.id, pp]));

    // Sumar unidades por referencia
    const unitsByRef = {};
    delivsToRevert.forEach(d => {
      (d.items || []).forEach(item => {
        if (item.product_reference) {
          unitsByRef[item.product_reference] = (unitsByRef[item.product_reference] || 0) + (Number(item.quantity) || 0);
        }
      });
    });

    let reverted = 0;
    for (const [ref, qty] of Object.entries(unitsByRef)) {
      const prod = productos.find(p => p.reference === ref);
      const productId = prod?._posSku || ref;

      // Buscar en todas las sucursales que tengan este producto
      const invItems = (allInv || []).filter(inv => inv.product_id === productId);
      let remaining = qty;
      for (const inv of invItems) {
        if (remaining <= 0) break;
        const currentStock = Number(inv.current_stock) || 0;
        const toDeduct = Math.min(remaining, currentStock);
        if (toDeduct > 0) {
          await Inventory.update(inv.id, {
            current_stock: currentStock - toDeduct,
            available_stock: Math.max(0, (Number(inv.available_stock) || 0) - toDeduct),
          });
          remaining -= toDeduct;
          reverted += toDeduct;
        }
      }
    }
    return reverted;
  };

  const handleRevertGroup = async (group) => {
    if (!window.confirm(`¿Revertir las ${group.ids.length} entregas del ${group.dateKey}? Se descontará del inventario y volverán como pendientes.`)) return;
    setReverting(true);
    try {
      const reverted = await revertInventoryForDeliveries(group.ids);
      await Promise.all(group.ids.map(id => Delivery.update(id, { inventory_assigned: false })));
      alert(`Revertido: ${reverted} unidades descontadas del inventario.`);
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setReverting(false);
  };

  const handleRevertAll = async () => {
    const total = assignedDeliveries.length;
    if (!window.confirm(`¿Revertir TODAS las ${total} entregas? Se descontará del inventario, se limpiarán huérfanos y volverán como pendientes.`)) return;
    setReverting(true);
    try {
      // 1. Descontar inventario
      const allIds = assignedDeliveries.map(d => d.id);
      const reverted = await revertInventoryForDeliveries(allIds);

      // 2. Revertir flag
      await Promise.all(assignedDeliveries.map(d => Delivery.update(d.id, { inventory_assigned: false })));

      // 3. Limpiar huérfanos
      const [allInv, allProducts] = await Promise.all([Inventory.list(), Product.list()]);
      const validSkus = new Set((allProducts || []).map(p => p.sku).filter(Boolean));
      const orphans = (allInv || []).filter(inv => inv.product_id && !validSkus.has(inv.product_id));
      if (orphans.length > 0) {
        await Promise.all(orphans.map(inv => Inventory.delete(inv.id)));
      }

      alert(`${total} entregas revertidas. ${reverted} unidades descontadas. ${orphans.length} huérfanos eliminados.`);
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setReverting(false);
  };

  // Contar huérfanos en tiempo real
  const orphanCount = useMemo(() => {
    const posProducts = productos; // ya enriquecidos con _posSku
    const allInv = inventory;
    // Un registro de inventario es huérfano si su product_id no coincide con ningún _posSku
    const validIds = new Set(posProducts.map(p => p._posSku).filter(Boolean));
    // También necesitamos los skus reales de Product — pero no los tenemos aquí directamente
    // Así que simplemente contamos los que aparecen como "Producto desconocido" (product_id no matchea ningún sku conocido)
    return allInv.filter(inv => inv.product_id && !validIds.has(inv.product_id)).length;
  }, [inventory, productos]);

  const handleCleanOrphans = async () => {
    if (!window.confirm(`¿Eliminar ${orphanCount} registros de inventario con producto desconocido?`)) return;
    setReverting(true);
    try {
      const [allInv, allProducts] = await Promise.all([Inventory.list(), Product.list()]);
      const validSkus = new Set((allProducts || []).map(p => p.sku).filter(Boolean));
      const orphans = (allInv || []).filter(inv => inv.product_id && !validSkus.has(inv.product_id));
      await Promise.all(orphans.map(inv => Inventory.delete(inv.id)));
      alert(`${orphans.length} registros huérfanos eliminados.`);
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setReverting(false);
  };

  if (loading) return (
    <div className="p-6 flex justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Asignación de Mercancía</h1>
            <p className="text-slate-500 text-sm mt-1">
              Asigna cada referencia a los puntos de venta que correspondan.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {orphanCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleCleanOrphans} disabled={reverting} className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
                Limpiar huérfanos ({orphanCount})
              </Button>
            )}
            {assignedGroups.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowRevert(v => !v)} className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50">
                <Undo2 className="w-4 h-4" />
                Revertir ({assignedDeliveries.length})
                {showRevert ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </Button>
          </div>
        </div>

        {/* Panel de revertir */}
        {showRevert && assignedGroups.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-800">
                  Entregas ya asignadas (desde 9 abril)
                </p>
                <Button size="sm" variant="outline" onClick={handleRevertAll} disabled={reverting}
                  className="text-red-600 border-red-300 hover:bg-red-50 text-xs">
                  {reverting ? "Revirtiendo..." : "Revertir todas"}
                </Button>
              </div>
              <div className="space-y-1.5">
                {assignedGroups.map(g => (
                  <div key={g.dateKey} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                    <div className="text-sm">
                      <span className="font-medium text-slate-800">{g.dateKey}</span>
                      <span className="text-slate-500 ml-2">{g.ids.length} entrega(s) · {g.totalUnits} unidades</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleRevertGroup(g)} disabled={reverting}
                      className="text-amber-700 hover:bg-amber-100 text-xs h-7 px-2">
                      <Undo2 className="w-3 h-3 mr-1" /> Revertir
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No hay entregas pendientes de asignación.</p>
              <p className="text-slate-400 text-sm mt-1">Las entregas de operarios aparecerán aquí agrupadas por día.</p>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => {
            const totalUnits = getTotalUnits(group.dateKey);
            const totalAssigned = getTotalAssignedAll(group.dateKey);
            const itemsList = Object.values(group.items);

            return (
              <Card key={group.dateKey} className="border-amber-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-amber-600" />
                      Entregas del {group.dateKey}
                    </CardTitle>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                      {totalUnits} unidades totales
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Una tabla por referencia */}
                  {itemsList.map(item => {
                    const assignedForRef = getAssignedForRef(group.dateKey, item.product_reference);
                    const remaining = item.quantity - assignedForRef;
                    const over = assignedForRef > item.quantity;

                    return (
                      <div key={item.product_reference} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Header referencia */}
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                          <span className="text-sm font-semibold text-slate-800">{item.product_name}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">Disponible: <strong>{item.quantity}</strong></span>
                            {assignedForRef > 0 && (
                              <span className={over ? "text-red-600 font-semibold" : remaining === 0 ? "text-green-600 font-semibold" : "text-amber-600"}>
                                {over ? `⚠️ excede en ${assignedForRef - item.quantity}` : remaining === 0 ? "✓ completo" : `faltan ${remaining}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inputs por sucursal */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                          {locations.map(loc => (
                            <div key={loc.id} className="px-3 py-2">
                              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                                <Store className="w-3 h-3" /> {loc.name}
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                placeholder="0"
                                value={assignments[group.dateKey]?.[item.product_reference]?.[loc.id] || ""}
                                onChange={e => updateAssignment(group.dateKey, item.product_reference, loc.id, e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${over ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Footer con totales y botones */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-sm">
                      <span className="text-slate-500">Total asignado: </span>
                      <strong className={totalAssigned > totalUnits ? "text-red-600" : "text-slate-900"}>
                        {totalAssigned}
                      </strong>
                      <span className="text-slate-400"> / {totalUnits}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSkip(group)}
                        disabled={saving === group.dateKey}
                        className="text-slate-500 border-slate-300 text-xs"
                      >
                        Ya ingresado
                      </Button>
                      <Button
                        onClick={() => handleConfirm(group)}
                        disabled={saving === group.dateKey || totalAssigned === 0}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {saving === group.dateKey ? "Confirmando..." : "Confirmar asignación"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
