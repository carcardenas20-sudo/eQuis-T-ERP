import React, { useState, useEffect, useCallback, useRef } from "react";
import { Hoja } from "@/entities/all";
import { useSession } from "@/components/providers/SessionProvider";
import Spreadsheet from "react-spreadsheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowLeft, FileSpreadsheet, Loader2, Check, Columns3, Rows3 } from "lucide-react";

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
  const omitirGuardado = useRef(true);

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

  // Autoguardado: 1,2 s después de dejar de escribir.
  useEffect(() => {
    if (!abierta) return;
    if (omitirGuardado.current) { omitirGuardado.current = false; return; }
    setGuardado(false);
    const t = setTimeout(async () => {
      setGuardando(true);
      try {
        await Hoja.update(abierta.id, { nombre: nombre.trim() || "Hoja sin título", celdas });
        setGuardado(true);
      } catch (e) {
        console.error("Error guardando la hoja:", e);
      }
      setGuardando(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [celdas, nombre, abierta]);

  const abrir = (h) => {
    omitirGuardado.current = true;
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
    setAbierta(null);
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
            <div className="text-xs text-slate-500 flex items-center gap-1 min-w-24">
              {guardando ? (<><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</>)
                : guardado ? (<><Check className="w-3 h-3 text-green-600" /> Guardado</>)
                : null}
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={agregarFila} className="gap-1 text-xs">
                <Rows3 className="w-3.5 h-3.5" /> Fila
              </Button>
              <Button variant="outline" size="sm" onClick={agregarColumna} className="gap-1 text-xs">
                <Columns3 className="w-3.5 h-3.5" /> Columna
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
              <Spreadsheet data={celdas} onChange={setCeldas} />
            </CardContent>
          </Card>
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
