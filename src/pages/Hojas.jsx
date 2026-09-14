import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Hoja } from "@/entities/all";
import { useSession } from "@/components/providers/SessionProvider";
import Spreadsheet from "react-spreadsheet";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowLeft, FileSpreadsheet, Loader2, Check, Columns3, Rows3, Sigma, Download } from "lucide-react";

const FILAS = 15;
const COLUMNAS = 6;

const gridVacia = (f = FILAS, c = COLUMNAS) =>
  Array.from({ length: f }, () => Array.from({ length: c }, () => ({ value: "" })));

function fmtFecha(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function HojasPage() {
  const { currentUser } = useSession();
  const [hojas, setHojas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [abierta, setAbierta] = useState(null);
  const [celdas, setCeldas] = useState(gridVacia());
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(false);
  const [rango, setRango] = useState(null);
  const omitirGuardado = useRef(true);
  const dirtyRef = useRef(false); // hay cambios sin guardar

  const cargar = useCallback(async () => {
    setIsLoading(true);
    try {
      const lista = await Hoja.list("-updated_date");
      setHojas(lista || []);
    } catch (e) {
      console.error("Error cargando hojas:", e);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Autoguardado: 0,8 s después de dejar de escribir. Marca "sucio" al cambiar y
  // muestra error VISIBLE si falla (antes fallaba en silencio → se perdía el trabajo).
  useEffect(() => {
    if (!abierta) return;
    if (omitirGuardado.current) { omitirGuardado.current = false; return; }
    dirtyRef.current = true;
    setGuardado(false);
    const t = setTimeout(async () => {
      setGuardando(true);
      try {
        await Hoja.update(abierta.id, { nombre: nombre.trim() || "Hoja sin título", celdas });
        dirtyRef.current = false;
        setErrorGuardar(false);
        setGuardado(true);
      } catch (e) {
        setErrorGuardar(true); // dirtyRef sigue en true → reintenta al próximo cambio / al cerrar
        console.error("Error guardando la hoja:", e);
      }
      setGuardando(false);
    }, 800);
    return () => clearTimeout(t);
  }, [celdas, nombre, abierta]);

  // Aviso del navegador si intentas cerrar/recargar con cambios sin guardar.
  useEffect(() => {
    const aviso = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  const abrir = (h) => {
    omitirGuardado.current = true;
    dirtyRef.current = false;
    setErrorGuardar(false);
    setRango(null);
    setAbierta(h);
    setNombre(h.nombre || "");
    setCeldas(Array.isArray(h.celdas) && h.celdas.length ? h.celdas : gridVacia());
    setGuardado(false);
  };

  const nuevaHoja = async () => {
    try {
      const h = await Hoja.create({
        nombre: "Hoja sin título",
        celdas: gridVacia(),
        creado_por: currentUser?.email || "",
      });
      await cargar();
      abrir(h);
    } catch (e) {
      alert("Error al crear la hoja: " + (e?.message || e));
    }
  };

  const cerrar = async () => {
    // Guardar lo pendiente ANTES de salir — nunca perder el último cambio.
    if (abierta && dirtyRef.current) {
      setGuardando(true);
      try {
        await Hoja.update(abierta.id, { nombre: nombre.trim() || "Hoja sin título", celdas });
        dirtyRef.current = false;
        setErrorGuardar(false);
      } catch (e) {
        console.error("Error guardando al salir:", e);
        setGuardando(false);
        const salirIgual = confirm("⚠️ No se pudo guardar (revisa tu conexión). Si sales ahora PERDERÁS los últimos cambios.\n\n¿Salir de todos modos?");
        if (!salirIgual) return; // se queda para reintentar
      }
      setGuardando(false);
    }
    setAbierta(null);
    setRango(null);
    await cargar();
  };

  const borrar = async (h, e) => {
    e?.stopPropagation();
    if (!confirm(`¿Eliminar la hoja "${h.nombre || "Sin título"}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await Hoja.delete(h.id);
      if (abierta?.id === h.id) setAbierta(null);
      await cargar();
    } catch (err) {
      alert("Error al eliminar: " + (err?.message || err));
    }
  };

  const agregarFila = () =>
    setCeldas(prev => [...prev, Array.from({ length: prev[0]?.length || COLUMNAS }, () => ({ value: "" }))]);

  const agregarColumna = () =>
    setCeldas(prev => prev.map(fila => [...fila, { value: "" }]));

  // Selección de rango → resumen (Suma / Promedio / Cuenta), tipo Excel.
  const onSelect = (selection) => {
    try {
      const rg = selection?.toRange?.(celdas);
      if (!rg?.start || !rg?.end) { setRango(null); return; }
      setRango({ r1: rg.start.row, r2: rg.end.row, c1: rg.start.column, c2: rg.end.column });
    } catch { setRango(null); }
  };
  const resumen = useMemo(() => {
    if (!rango) return null;
    let suma = 0, cuenta = 0, total = 0;
    for (let r = rango.r1; r <= rango.r2; r++)
      for (let c = rango.c1; c <= rango.c2; c++) {
        total++;
        const v = celdas[r]?.[c]?.value;
        if (v == null || v === "") continue;
        const s = String(v);
        if (s.startsWith("=")) continue; // fórmula: no tenemos el resultado ya calculado
        const n = parseFloat(s.replace(/[$\s]/g, ""));
        if (Number.isFinite(n)) { suma += n; cuenta++; }
      }
    return total > 1 ? { suma, cuenta, promedio: cuenta ? suma / cuenta : 0 } : null;
  }, [rango, celdas]);

  // Exportar a Excel (.xlsx): números como número; texto y fórmulas como texto.
  const exportarExcel = () => {
    try {
      const aoa = celdas.map(fila => fila.map(cel => {
        const v = cel?.value;
        if (v == null || v === "") return "";
        const s = String(v);
        const n = Number(s.replace(/[$\s]/g, ""));
        return (!s.startsWith("=") && s.trim() !== "" && Number.isFinite(n)) ? n : s;
      }));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hoja");
      XLSX.writeFile(wb, `${nombre.trim() || "hoja"}.xlsx`);
    } catch (e) {
      alert("Error al exportar: " + (e?.message || e));
    }
  };

  // ── Editor ────────────────────────────────────────────────────────────────
  if (abierta) {
    return (
      <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={cerrar} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Volver
            </Button>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la hoja"
              className="max-w-xs font-semibold"
            />
            <div className="text-xs flex items-center gap-1 min-w-28">
              {guardando ? (<span className="text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</span>)
                : errorGuardar ? (<span className="text-red-600 font-semibold flex items-center gap-1">⚠️ No se guardó</span>)
                : guardado ? (<span className="text-slate-500 flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> Guardado</span>)
                : null}
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={agregarFila} className="gap-1 text-xs">
                <Rows3 className="w-3.5 h-3.5" /> Fila
              </Button>
              <Button variant="outline" size="sm" onClick={agregarColumna} className="gap-1 text-xs">
                <Columns3 className="w-3.5 h-3.5" /> Columna
              </Button>
              <Button variant="outline" size="sm" onClick={exportarExcel} className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            💡 Puedes usar fórmulas escribiendo <b>=</b> al inicio. Ejemplos: <code className="bg-white px-1 rounded">=A1+B1</code>,{" "}
            <code className="bg-white px-1 rounded">=A1*2</code>, <code className="bg-white px-1 rounded">=SUM(A1:A5)</code>,{" "}
            <code className="bg-white px-1 rounded">=A1*0.19</code>. Se guarda solo.
          </div>

          <Card className="border-slate-200">
            <CardContent className="p-3 overflow-x-auto">
              <Spreadsheet data={celdas} onChange={setCeldas} onSelect={onSelect} />
            </CardContent>
          </Card>

          {/* Barra tipo Excel: al seleccionar un rango, muestra Suma / Promedio / Cuenta */}
          {resumen && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-slate-800 text-white rounded-lg px-4 py-2 text-sm sticky bottom-2 shadow-lg">
              <span className="flex items-center gap-1.5"><Sigma className="w-4 h-4 text-indigo-300" /> Suma: <b className="tabular-nums">{resumen.suma.toLocaleString("es-CO")}</b></span>
              <span className="text-slate-200">Promedio: <b className="tabular-nums">{resumen.promedio.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</b></span>
              <span className="text-slate-200">Celdas con número: <b>{resumen.cuenta}</b></span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Apuntes y Cuentas</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Hojas de cálculo rápidas — se guardan aquí y las ves al instante en cualquier equipo.
            </p>
          </div>
          <Button onClick={nuevaHoja} className="gap-1 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Nueva hoja
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : hojas.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200">
            <CardContent className="p-12 text-center text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-500">Aún no tienes hojas</p>
              <p className="text-sm mt-1">Crea una para hacer tus cuentas antes de armar un presupuesto.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {hojas.map(h => (
              <Card
                key={h.id}
                onClick={() => abrir(h)}
                className="border-slate-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{h.nombre || "Hoja sin título"}</p>
                    <p className="text-xs text-slate-400">Editada: {fmtFecha(h.updated_date)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => borrar(h, e)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
