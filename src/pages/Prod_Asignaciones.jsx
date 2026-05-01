import React, { useState, useEffect } from "react";
import { Presupuesto, Producto, MateriaPrima, Color, Remision } from "@/api/entitiesChaquetas";
import { Dispatch } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle2, AlertCircle, PackageCheck, X, Scissors
} from "lucide-react";

// Calcula materiales proporcionales para un lote
function calcularMateriales(productoInfo, combinacion, tallasCorte, materiasPrimas, colores) {
  const totalUnidades = tallasCorte.reduce((s, t) => s + (Number(t.cantidad) || 0), 0);
  if (totalUnidades === 0 || !productoInfo) return [];
  const result = [];
  (productoInfo.materiales_requeridos || []).forEach(mat => {
    const mp = materiasPrimas.find(m => m.id === mat.materia_prima_id);
    if (!mp) return;
    let colorNombre = mp.color_por_defecto || "Sin definir";
    if (!mp.color_fijo) {
      const ce = (combinacion.colores_por_material || []).find(cm => cm.row_id === mat.row_id);
      if (ce?.color_nombre) colorNombre = ce.color_nombre;
      else if (ce?.color_id) colorNombre = colores.find(c => c.id === ce.color_id)?.nombre || "?";
    }
    const cantidad = Math.ceil((mat.cantidad_por_unidad || 0) * totalUnidades * (mat.piezas_por_unidad || 1) * 100) / 100;
    result.push({
      materia_prima_id: mp.id,
      nombre: mat.descripcion_remision || mat.nombre_seccion_display || mp.nombre,
      color: colorNombre,
      cantidad,
      etiqueta: mat.unidad_remision || mat.etiqueta_cantidad || mp.unidad_medida || "unidades",
      tipo: mp.tipo_material || "otro",
    });
  });
  return result;
}

function nombreCombo(combo) {
  if (combo.nombre) return combo.nombre;
  const coloresMat = combo.colores_por_material || [];
  const unicos = [...new Set(coloresMat.map(cm => cm.color_nombre).filter(Boolean))];
  if (unicos.length) return unicos.join(" / ");
  const cols = Object.values(combo.colores || {}).filter(Boolean);
  return cols.length ? cols.join(" / ") : `Combo ${combo.predefinida_id || ""}`;
}

// Clave única para identificar un item+combo dentro de un presupuesto
function comboKey(itemId, combo) {
  return `${itemId}_${combo.predefinida_id || combo._idx}`;
}

export default function Asignaciones() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [lotes, setLotes] = useState([]);       // Remisiones tipo asignacion_despacho del presupuesto
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [colores, setColores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formItem, setFormItem] = useState(null);   // item del presupuesto
  const [formCombo, setFormCombo] = useState(null); // combinacion
  const [formTallas, setFormTallas] = useState({}); // { talla: string }

  useEffect(() => { loadBase(); }, []);

  const selectedPresupuesto = presupuestos.find(p => p.id === selectedId) || null;

  const loadBase = async () => {
    setLoading(true);
    try {
      const [presData, prodData, mpData, colData] = await Promise.all([
        Presupuesto.list("-created_date"),
        Producto.list(),
        MateriaPrima.list(),
        Color.list(),
      ]);
      const aprobados = (presData || []).filter(p => p.estado === "aprobado");
      setPresupuestos(aprobados);
      setProductos(prodData || []);
      setMateriasPrimas(mpData || []);
      setColores(colData || []);
      if (aprobados.length > 0) setSelectedId(prev => prev || aprobados[0].id);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedId) { setLotes([]); return; }
    Remision.filter({ presupuesto_id: selectedId, tipo_remision: "asignacion_despacho" })
      .then(data => setLotes(data || []))
      .catch(() => setLotes([]));
  }, [selectedId]);

  const refreshLotes = () =>
    Remision.filter({ presupuesto_id: selectedId, tipo_remision: "asignacion_despacho" })
      .then(data => setLotes(data || []))
      .catch(() => setLotes([]));

  // Unidades ya asignadas en lotes para un combo
  const getAsignadoPorTalla = (key, talla) =>
    lotes
      .filter(l => l.combo_key === key)
      .reduce((s, l) => {
        const t = (l.tallas_cantidades || []).find(tc => tc.talla === talla);
        return s + (Number(t?.cantidad) || 0);
      }, 0);

  const getLotesDeCombo = (key) => lotes.filter(l => l.combo_key === key);

  const openForm = (item, combo, comboIdx) => {
    const comboConIdx = { ...combo, _idx: comboIdx };
    const tallasInit = {};
    (combo.tallas_cantidades || []).forEach(tc => { tallasInit[tc.talla] = ""; });
    setFormItem(item);
    setFormCombo(comboConIdx);
    setFormTallas(tallasInit);
    setShowForm(true);
  };

  const totalForm = Object.values(formTallas).reduce((s, v) => s + (Number(v) || 0), 0);

  const handleSave = async () => {
    if (totalForm === 0) { alert("Ingresa al menos una unidad."); return; }

    const key = comboKey(formItem.id, formCombo);
    const tallasCorte = Object.entries(formTallas)
      .filter(([, v]) => Number(v) > 0)
      .map(([talla, cantidad]) => ({ talla, cantidad: Number(cantidad) }));

    // Validar no exceder pendientes por talla
    for (const tc of tallasCorte) {
      const objetivo = (formCombo.tallas_cantidades || []).find(t => t.talla === tc.talla)?.cantidad || 0;
      const asignado = getAsignadoPorTalla(key, tc.talla);
      const pendiente = objetivo - asignado;
      if (tc.cantidad > pendiente) {
        alert(`Talla ${tc.talla}: solo quedan ${pendiente} unidades disponibles.`);
        return;
      }
    }

    setSaving(true);
    try {
      const productoInfo = productos.find(p => p.id === formItem.producto_id);
      const materiales = calcularMateriales(productoInfo, formCombo, tallasCorte, materiasPrimas, colores);
      const ts = Date.now();
      const numRem = `REM-${(selectedPresupuesto.numero_presupuesto || "").replace(/[^a-zA-Z0-9]/g, "")}-${ts}`.substring(0, 32);
      const tallaResumen = tallasCorte.map(t => `${t.talla}×${t.cantidad}`).join(", ");

      // 1. Crear Remisión individual de asignación
      await Remision.create({
        numero_remision: numRem,
        tipo_remision: "asignacion_despacho",
        presupuesto_id: selectedId,
        combo_key: key,
        combinacion_nombre: nombreCombo(formCombo),
        tallas_cantidades: tallasCorte,
        materiales_calculados: materiales,
        estado: "pendiente",
        producto_nombre: productoInfo?.nombre || formItem.producto_id,
        producto_reference: productoInfo?.reference || "",
      });

      // 2. Crear Despacho sin operario → planillador lo asigna
      await Dispatch.create({
        product_reference: productoInfo?.reference || formItem.producto_id,
        quantity: totalForm,
        employee_id: "",                // sin asignar — planillador completa
        dispatch_date: new Date().toISOString().split("T")[0],
        observations: `LOTE · ${selectedPresupuesto.numero_presupuesto} · ${productoInfo?.nombre || ""} · ${nombreCombo(formCombo)} · ${tallaResumen}`,
        lote_remision: numRem,
        estado_lote: "pendiente",
      });

      setShowForm(false);
      await refreshLotes();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Asignaciones de Despacho</h1>
            <p className="text-slate-500 text-sm mt-1">
              Divide el presupuesto en lotes por combinación. El planillador asigna el operario.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadBase} className="gap-2 shrink-0">
            <RefreshCw className="w-4 h-4" /> Recargar
          </Button>
        </div>

        {presupuestos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No hay presupuestos aprobados.</p>
              <p className="text-slate-400 text-sm mt-1">Aprueba un presupuesto en la sección Presupuestos.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Selector presupuesto */}
            <div className="flex items-center gap-3">
              <Label className="shrink-0 text-slate-600 text-sm">Presupuesto:</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presupuestos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_presupuesto}{p.cliente ? ` · ${p.cliente}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items del presupuesto */}
            {selectedPresupuesto && (selectedPresupuesto.productos || []).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-slate-400 text-sm">
                  Este presupuesto no tiene productos.
                </CardContent>
              </Card>
            )}

            {selectedPresupuesto && (selectedPresupuesto.productos || []).map((item, itemIdx) => {
              const productoInfo = productos.find(p => p.id === item.producto_id);
              const isOpen = !!expanded[item.id || itemIdx];
              const expandKey = item.id || itemIdx;

              // Total de combinaciones y lotes
              const totalLotes = (item.combinaciones || []).reduce((s, combo, ci) => {
                const k = comboKey(item.id || itemIdx, { ...combo, _idx: ci });
                return s + getLotesDeCombo(k).length;
              }, 0);

              return (
                <Card key={item.id || itemIdx} className="border-slate-200">
                  <CardHeader
                    className="pb-2 cursor-pointer select-none"
                    onClick={() => setExpanded(prev => ({ ...prev, [expandKey]: !prev[expandKey] }))}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-emerald-600" />
                        {productoInfo?.nombre || item.producto_id}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {totalLotes > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">{totalLotes} lotes</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {(item.combinaciones || []).filter(c => c.predefinida_id).length} combinaciones
                        </Badge>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  </CardHeader>

                  {isOpen && (
                    <CardContent className="space-y-4 pt-0">
                      {(item.combinaciones || []).filter(c => c.predefinida_id).map((combo, comboIdx) => {
                        const key = comboKey(item.id || itemIdx, { ...combo, _idx: comboIdx });
                        const lotesCombo = getLotesDeCombo(key);
                        const totalCombo = (combo.tallas_cantidades || []).reduce((s, tc) => s + (Number(tc.cantidad) || 0), 0);
                        const totalAsignado = lotesCombo.reduce((s, l) =>
                          s + (l.tallas_cantidades || []).reduce((ss, tc) => ss + (Number(tc.cantidad) || 0), 0), 0);
                        const pct = totalCombo > 0 ? Math.round(totalAsignado / totalCombo * 100) : 0;
                        const completo = totalAsignado >= totalCombo && totalCombo > 0;

                        return (
                          <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
                            {/* Cabecera combinación */}
                            <div className={`flex items-center justify-between px-3 py-2 ${completo ? "bg-green-50" : "bg-slate-50"} border-b border-slate-200`}>
                              <div className="flex items-center gap-2">
                                {completo
                                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  : <Scissors className="w-4 h-4 text-slate-400" />}
                                <span className="text-sm font-semibold text-slate-800">{nombreCombo(combo)}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span>{totalAsignado}/{totalCombo} uds · {pct}%</span>
                                {!completo && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => openForm(
                                      { ...item, id: item.id || itemIdx },
                                      combo,
                                      comboIdx
                                    )}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Nuevo lote
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Barra progreso */}
                            <div className="h-1.5 bg-slate-100">
                              <div
                                className={`h-full transition-all ${completo ? "bg-green-500" : "bg-emerald-400"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>

                            {/* Tallas con pendientes */}
                            <div className="px-3 py-2 flex flex-wrap gap-2">
                              {(combo.tallas_cantidades || []).map(tc => {
                                const asig = getAsignadoPorTalla(key, tc.talla);
                                const pend = (Number(tc.cantidad) || 0) - asig;
                                return (
                                  <span
                                    key={tc.talla}
                                    className={`text-xs px-2 py-0.5 rounded-full border ${
                                      pend <= 0
                                        ? "bg-green-100 text-green-700 border-green-200"
                                        : "bg-white text-slate-600 border-slate-200"
                                    }`}
                                  >
                                    {tc.talla}: {asig}/{tc.cantidad}
                                    {pend > 0 && <span className="text-amber-600 ml-1">({pend})</span>}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Lotes existentes */}
                            {lotesCombo.length > 0 && (
                              <div className="border-t border-slate-100 divide-y divide-slate-100">
                                {lotesCombo.map((lote, li) => (
                                  <div key={lote.id || li} className="px-3 py-2 flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs text-slate-400">{lote.numero_remision}</span>
                                      <span className="text-slate-600">
                                        {(lote.tallas_cantidades || []).map(t => `${t.talla}×${t.cantidad}`).join(", ")}
                                      </span>
                                    </div>
                                    <Badge className={`text-xs shrink-0 ${
                                      lote.estado === "despachado" ? "bg-blue-100 text-blue-700" :
                                      lote.estado === "entregado" ? "bg-green-100 text-green-700" :
                                      "bg-amber-100 text-amber-700"
                                    }`}>
                                      {lote.estado === "despachado" ? "Despachado" :
                                       lote.estado === "entregado" ? "Entregado" : "Pendiente planillador"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </div>

      {/* Modal nuevo lote */}
      {showForm && formItem && formCombo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-bold text-slate-900">Nuevo lote de despacho</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {productos.find(p => p.id === formItem.producto_id)?.nombre} · {nombreCombo(formCombo)}
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <Label className="text-sm text-slate-700 mb-2 block">Cantidades por talla</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(formTallas).map(([talla, val]) => {
                    const key = comboKey(formItem.id, formCombo);
                    const objetivo = (formCombo.tallas_cantidades || []).find(t => t.talla === talla)?.cantidad || 0;
                    const asignado = getAsignadoPorTalla(key, talla);
                    const pendiente = objetivo - asignado;
                    return (
                      <div key={talla}>
                        <label className="text-xs text-slate-500 block mb-0.5">
                          {talla}
                          <span className="text-amber-600 ml-1">({pendiente} disp.)</span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={pendiente}
                          value={val}
                          onChange={e => setFormTallas(prev => ({ ...prev, [talla]: e.target.value }))}
                          className="h-9 text-center font-bold"
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-700 text-sm">Total del lote</span>
                <span className="font-bold text-xl text-emerald-800">{totalForm} uds</span>
              </div>

              <p className="text-xs text-slate-400">
                Al guardar se genera la remisión individual con materiales y queda pendiente para que el planillador asigne operario.
              </p>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSave}
                disabled={saving || totalForm === 0}
              >
                {saving ? "Guardando..." : "Crear lote"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
