import React, { useState, useEffect } from "react";
import { localClient } from "@/api/localClient";
import { Location } from "@/entities/Location";
import { Inventory } from "@/entities/Inventory";
import { Product } from "@/entities/Product";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackageCheck, CheckCircle2, AlertTriangle, Store } from "lucide-react";

const MerchandiseEntry = localClient.entities["MerchandiseEntry"];

// Mapa de reference de producción → product_id comercial
const REFERENCE_TO_PRODUCT = {
  "001": "68cf045f708944a44db15537", // Embone → Hombre
  "002": "68cf045f708944a44db15537", // Neo → Hombre
  "003": "68cf045f708944a44db15537", // Unicolor → Hombre
  "004": "68cf045f708944a44db15537", // Chulo → Hombre
  "090": "69aee24b1a68e61589ee7db4", // Colombia → Colombia
  "596": "68cf045f708944a44db15537", // Mujer/Ovejera → Hombre (ajustar si tiene familia propia)
};

export default function MerchandiseAssignment() {
  const [pendingEntries, setPendingEntries] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesData, locationsData, inventoryData] = await Promise.all([
        MerchandiseEntry.filter({ status: "pendiente" }),
        Location.list(),
        Inventory.list(),
      ]);
      setPendingEntries(entriesData || []);
      setLocations(locationsData || []);
      setInventory(inventoryData || []);

      // Inicializar asignaciones vacías
      const initAssignments = {};
      (entriesData || []).forEach((entry) => {
        initAssignments[entry.id] = {};
        (locationsData || []).forEach((loc) => {
          initAssignments[entry.id][loc.id] = "";
        });
      });
      setAssignments(initAssignments);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const updateAssignment = (entryId, locationId, value) => {
    setAssignments((prev) => ({
      ...prev,
      [entryId]: { ...prev[entryId], [locationId]: value },
    }));
  };

  const getTotalAssigned = (entryId) => {
    const entryAssignments = assignments[entryId] || {};
    return Object.values(entryAssignments).reduce((s, v) => s + (Number(v) || 0), 0);
  };

  const handleConfirm = async (entry) => {
    const entryAssignments = assignments[entry.id] || {};
    const totalAssigned = getTotalAssigned(entry.id);

    if (totalAssigned === 0) {
      alert("Debes asignar al menos una unidad a algún punto de venta.");
      return;
    }

    if (totalAssigned > entry.total_units) {
      alert(`Solo hay ${entry.total_units} unidades disponibles. Has asignado ${totalAssigned}.`);
      return;
    }

    setSaving(entry.id);
    try {
      const assignmentList = [];

      for (const [locationId, qty] of Object.entries(entryAssignments)) {
        const quantity = Number(qty);
        if (quantity <= 0) continue;

        const location = locations.find((l) => l.id === locationId);

        // Para cada item de la entrada, distribuir proporcionalmente
        for (const item of entry.items || []) {
          const productId = REFERENCE_TO_PRODUCT[item.product_reference];
          if (!productId) continue;

          // Proporción de este item en el total
          const proportion = item.quantity / entry.total_units;
          const qtyForLocation = Math.round(quantity * proportion);
          if (qtyForLocation <= 0) continue;

          // Buscar inventario existente para este producto y sucursal
          const existingInv = inventory.find(
            (inv) => inv.product_id === productId && inv.location_id === locationId
          );

          if (existingInv) {
            await Inventory.update(existingInv.id, {
              current_stock: (Number(existingInv.current_stock) || 0) + qtyForLocation,
              available_stock: (Number(existingInv.available_stock) || 0) + qtyForLocation,
            });
          } else {
            await Inventory.create({
              product_id: productId,
              location_id: locationId,
              current_stock: qtyForLocation,
              available_stock: qtyForLocation,
              reserved_stock: 0,
            });
          }
        }

        assignmentList.push({
          location_id: locationId,
          location_name: location?.name || locationId,
          quantity,
        });
      }

      // Marcar entrada como asignada
      await MerchandiseEntry.update(entry.id, {
        status: "asignado",
        assignments: assignmentList,
        assigned_date: new Date().toISOString().split("T")[0],
      });

      alert(`✅ Entrada asignada correctamente. ${totalAssigned} unidades distribuidas.`);
      loadData();
    } catch (err) {
      alert("Error al asignar: " + err.message);
    }
    setSaving(null);
  };

  if (loading) return <div className="p-6 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asignación de Mercancía</h1>
          <p className="text-slate-500 text-sm mt-1">
            Asigna las entradas de bodega a cada punto de venta. Las cantidades se sumarán automáticamente al inventario.
          </p>
        </div>

        {pendingEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No hay entradas pendientes de asignación.</p>
              <p className="text-slate-400 text-sm mt-1">Cuando Operarios registre una entrada aparecerá aquí.</p>
            </CardContent>
          </Card>
        ) : (
          pendingEntries.map((entry) => {
            const totalAssigned = getTotalAssigned(entry.id);
            const remaining = entry.total_units - totalAssigned;

            return (
              <Card key={entry.id} className="border-amber-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-amber-600" />
                      Entrada del {entry.entry_date}
                    </CardTitle>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                      {entry.total_units} unidades totales
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(entry.items || []).map((item, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {item.product_name || item.product_reference}: {item.quantity} und
                      </span>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm font-medium text-slate-700">Asignar por punto de venta:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {locations.map((loc) => (
                      <div key={loc.id} className="space-y-1">
                        <label className="text-sm text-slate-600 flex items-center gap-1">
                          <Store className="w-3 h-3" /> {loc.name}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={entry.total_units}
                          placeholder="0 unidades"
                          value={assignments[entry.id]?.[loc.id] || ""}
                          onChange={(e) => updateAssignment(entry.id, loc.id, e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-sm">
                      <span className="text-slate-500">Asignado: </span>
                      <strong className={totalAssigned > entry.total_units ? "text-red-600" : "text-slate-900"}>
                        {totalAssigned}
                      </strong>
                      <span className="text-slate-400"> / {entry.total_units}</span>
                      {remaining > 0 && totalAssigned > 0 && (
                        <span className="ml-2 text-xs text-amber-600">({remaining} sin asignar)</span>
                      )}
                    </div>
                    <Button
                      onClick={() => handleConfirm(entry)}
                      disabled={saving === entry.id || totalAssigned === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {saving === entry.id ? "Confirmando..." : "Confirmar asignación"}
                    </Button>
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
