import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Warehouse, TrendingUp, TrendingDown, Search, ChevronDown, ChevronUp } from "lucide-react";

export default function Inventario() {
  const [inventario, setInventario] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [movimientoForm, setMovimientoForm] = useState({ id: null, tipo: 'entrada', cantidad: '', referencia: '', nota: '' });

  // Formulario nuevo item
  const [nuevoItem, setNuevoItem] = useState({ materia_prima_id: '', color: '', cantidad: '', nota: '' });

  useEffect(() => {
    Promise.all([
      base44.entities.Inventario.list('-updated_date', 200),
      base44.entities.MateriaPrima.list('nombre', 200)
    ]).then(([inv, mps]) => {
      setInventario(inv);
      setMateriasPrimas(mps);
      setLoading(false);
    });
  }, []);

  const inventarioFiltrado = useMemo(() => {
    if (!busqueda) return inventario;
    const q = busqueda.toLowerCase();
    return inventario.filter(i =>
      (i.materia_prima_nombre || '').toLowerCase().includes(q) ||
      (i.color || '').toLowerCase().includes(q)
    );
  }, [inventario, busqueda]);

  const agregarItem = async () => {
    if (!nuevoItem.materia_prima_id || !nuevoItem.cantidad) return;
    const mp = materiasPrimas.find(m => m.id === nuevoItem.materia_prima_id);
    const cantidad = parseFloat(nuevoItem.cantidad) || 0;
    const entrada = {
      id: `mov_${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'entrada',
      cantidad,
      referencia: '',
      nota: nuevoItem.nota || 'Inventario inicial'
    };
    // Buscar si ya existe un item para esta materia prima + color
    const existente = inventario.find(i => i.materia_prima_id === nuevoItem.materia_prima_id && (i.color || '') === (nuevoItem.color || ''));
    if (existente) {
      const updated = await base44.entities.Inventario.update(existente.id, {
        cantidad_disponible: (existente.cantidad_disponible || 0) + cantidad,
        movimientos: [...(existente.movimientos || []), entrada]
      });
      setInventario(prev => prev.map(i => i.id === existente.id ? updated : i));
    } else {
      const created = await base44.entities.Inventario.create({
        materia_prima_id: nuevoItem.materia_prima_id,
        materia_prima_nombre: mp?.nombre || '',
        color: nuevoItem.color || '',
        unidad_medida: mp?.unidad_medida || 'unidad',
        cantidad_disponible: cantidad,
        movimientos: [entrada]
      });
      setInventario(prev => [...prev, created]);
    }
    setNuevoItem({ materia_prima_id: '', color: '', cantidad: '', nota: '' });
    setShowForm(false);
  };

  const registrarMovimiento = async () => {
    const item = inventario.find(i => i.id === movimientoForm.id);
    if (!item || !movimientoForm.cantidad) return;
    const cant = parseFloat(movimientoForm.cantidad) || 0;
    const nuevaCant = movimientoForm.tipo === 'entrada'
      ? (item.cantidad_disponible || 0) + cant
      : Math.max(0, (item.cantidad_disponible || 0) - cant);
    const entrada = {
      id: `mov_${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      tipo: movimientoForm.tipo,
      cantidad: cant,
      referencia: movimientoForm.referencia || '',
      nota: movimientoForm.nota || ''
    };
    const updated = await base44.entities.Inventario.update(item.id, {
      cantidad_disponible: nuevaCant,
      movimientos: [...(item.movimientos || []), entrada]
    });
    setInventario(prev => prev.map(i => i.id === item.id ? updated : i));
    setMovimientoForm({ id: null, tipo: 'entrada', cantidad: '', referencia: '', nota: '' });
  };

  const totalItems = inventario.length;
  const itemsSinStock = inventario.filter(i => (i.cantidad_disponible || 0) <= 0).length;

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-blue-600" /> Inventario
          </h1>
          <p className="text-sm text-slate-500 mt-1">Stock de materias primas disponible antes de presupuestar</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Agregar stock
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{totalItems}</div>
            <div className="text-xs text-slate-500">Items en inventario</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{totalItems - itemsSinStock}</div>
            <div className="text-xs text-slate-500">Con stock</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{itemsSinStock}</div>
            <div className="text-xs text-slate-500">Sin stock</div>
          </CardContent>
        </Card>
      </div>

      {/* Formulario nuevo item */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-900">Agregar stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Materia Prima *</Label>
                <select
                  value={nuevoItem.materia_prima_id}
                  onChange={e => setNuevoItem(p => ({ ...p, materia_prima_id: e.target.value }))}
                  className="w-full h-9 px-2 border border-slate-200 rounded text-sm mt-1"
                >
                  <option value="">Seleccionar...</option>
                  {materiasPrimas.map(mp => (
                    <option key={mp.id} value={mp.id}>{mp.nombre} ({mp.unidad_medida})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Color (opcional)</Label>
                <Input
                  placeholder="Ej: Negro, Blanco..."
                  value={nuevoItem.color}
                  onChange={e => setNuevoItem(p => ({ ...p, color: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Cantidad *</Label>
                <Input
                  type="number" min="0" step="any"
                  placeholder="0"
                  value={nuevoItem.cantidad}
                  onChange={e => setNuevoItem(p => ({ ...p, cantidad: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Nota</Label>
                <Input
                  placeholder="Ej: Inventario inicial"
                  value={nuevoItem.nota}
                  onChange={e => setNuevoItem(p => ({ ...p, nota: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={agregarItem} className="bg-blue-600 hover:bg-blue-700 text-sm">Guardar</Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="text-sm">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por material o color..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {inventarioFiltrado.length === 0 && (
          <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-xl">
            <Warehouse className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{busqueda ? 'Sin resultados.' : 'No hay items en inventario. Agrega el stock existente antes de presupuestar.'}</p>
          </div>
        )}
        {inventarioFiltrado.map(item => {
          const isExpanded = expandedId === item.id;
          const sinStock = (item.cantidad_disponible || 0) <= 0;
          const movimientoActivo = movimientoForm.id === item.id;
          return (
            <Card key={item.id} className={`border ${sinStock ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{item.materia_prima_nombre}</span>
                      {item.color && <Badge variant="outline" className="text-xs">{item.color}</Badge>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sinStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {item.cantidad_disponible || 0} {item.unidad_medida}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {(item.movimientos || []).length} movimiento{(item.movimientos || []).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setMovimientoForm(movimientoActivo ? { id: null, tipo: 'entrada', cantidad: '', referencia: '', nota: '' } : { id: item.id, tipo: 'entrada', cantidad: '', referencia: '', nota: '' })}
                      className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50"
                    >
                      <TrendingUp className="w-3 h-3 mr-1" /> Entrada
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setMovimientoForm(movimientoActivo && movimientoForm.tipo === 'salida' ? { id: null, tipo: 'entrada', cantidad: '', referencia: '', nota: '' } : { id: item.id, tipo: 'salida', cantidad: '', referencia: '', nota: '' })}
                      className="text-xs h-7 text-orange-700 border-orange-200 hover:bg-orange-50"
                    >
                      <TrendingDown className="w-3 h-3 mr-1" /> Salida
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Formulario movimiento inline */}
                {movimientoActivo && (
                  <div className={`mt-2 p-2 rounded border ${movimientoForm.tipo === 'entrada' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="flex gap-2 items-center flex-wrap">
                      <select
                        value={movimientoForm.tipo}
                        onChange={e => setMovimientoForm(p => ({ ...p, tipo: e.target.value }))}
                        className="h-7 text-xs px-2 border border-slate-200 rounded"
                      >
                        <option value="entrada">Entrada</option>
                        <option value="salida">Salida</option>
                      </select>
                      <Input
                        type="number" min="0" step="any"
                        placeholder="Cantidad"
                        value={movimientoForm.cantidad}
                        onChange={e => setMovimientoForm(p => ({ ...p, cantidad: e.target.value }))}
                        className="h-7 text-xs w-24"
                      />
                      <Input
                        placeholder="Referencia (Ej: PRES-001)"
                        value={movimientoForm.referencia}
                        onChange={e => setMovimientoForm(p => ({ ...p, referencia: e.target.value }))}
                        className="h-7 text-xs flex-1 min-w-28"
                      />
                      <Input
                        placeholder="Nota"
                        value={movimientoForm.nota}
                        onChange={e => setMovimientoForm(p => ({ ...p, nota: e.target.value }))}
                        className="h-7 text-xs flex-1 min-w-28"
                      />
                      <button type="button" onClick={registrarMovimiento} className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">✓ Guardar</button>
                      <button type="button" onClick={() => setMovimientoForm({ id: null, tipo: 'entrada', cantidad: '', referencia: '', nota: '' })} className="h-7 px-2 text-xs text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                  </div>
                )}

                {/* Historial de movimientos */}
                {isExpanded && (item.movimientos || []).length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                    <p className="text-xs text-slate-400 font-medium mb-1">Historial</p>
                    {[...( item.movimientos || [])].reverse().map((mov, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className={`font-bold ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-orange-600'}`}>
                          {mov.tipo === 'entrada' ? '+' : '−'}{mov.cantidad} {item.unidad_medida}
                        </span>
                        <span className="text-slate-400">{mov.fecha}</span>
                        {mov.referencia && <Badge variant="outline" className="text-xs py-0">{mov.referencia}</Badge>}
                        {mov.nota && <span className="text-slate-400 italic">— {mov.nota}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}