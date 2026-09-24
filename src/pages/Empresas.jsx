import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Combined";
import { useSession } from "@/components/providers/SessionProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pencil, Check, X, Globe, Hash } from "lucide-react";

const EMPTY = {
  name: "", nit: "", domain: "", display_name: "",
  brand_color: "#4f46e5", invoice_prefix: "", invoice_next: 1, is_active: true,
};

export default function Empresas() {
  const { isRealAdmin, previewRoleId } = useSession();
  const isAdmin = isRealAdmin && !previewRoleId;

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // registro en edición
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Company.list("name");
      setCompanies(list || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing("new"); setForm(EMPTY); };
  const startEdit = (c) => {
    setEditing(c.id);
    setForm({
      name: c.name || "", nit: c.nit || "", domain: c.domain || "",
      display_name: c.display_name || "", brand_color: c.brand_color || "#4f46e5",
      invoice_prefix: c.invoice_prefix || "", invoice_next: Number(c.invoice_next) || 1,
      is_active: c.is_active !== false,
    });
  };
  const cancel = () => { setEditing(null); setForm(EMPTY); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert("El nombre de la empresa es obligatorio."); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nit: form.nit.trim(),
        domain: form.domain.trim().toLowerCase(),
        display_name: (form.display_name || form.name).trim(),
        brand_color: form.brand_color,
        invoice_prefix: form.invoice_prefix.trim(),
        invoice_next: Number(form.invoice_next) || 1,
        is_active: !!form.is_active,
      };
      if (editing === "new") {
        await base44.entities.Company.create(payload);
      } else {
        await base44.entities.Company.update(editing, payload);
      }
      cancel();
      await load();
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la empresa.");
    }
    setSaving(false);
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center text-slate-500">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p>Solo el administrador puede gestionar las empresas.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-indigo-600" /> Empresas
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Cada empresa opera separada (ventas, inventario, caja, facturas). Las que agregues aquí aparecen en el selector de arriba.
            </p>
          </div>
          {editing === null && (
            <Button onClick={startNew} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Nueva empresa
            </Button>
          )}
        </div>

        {/* Formulario */}
        {editing !== null && (
          <Card className="border-indigo-200">
            <CardHeader><CardTitle className="text-base">{editing === "new" ? "Nueva empresa" : "Editar empresa"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Chaquetas Pro" />
                </div>
                <div className="space-y-1.5">
                  <Label>NIT</Label>
                  <Input value={form.nit} onChange={e => set("nit", e.target.value)} placeholder="Ej: 900.123.456-7" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Dominio</Label>
                  <Input value={form.domain} onChange={e => set("domain", e.target.value)} placeholder="app.otraempresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre a mostrar (marca)</Label>
                  <Input value={form.display_name} onChange={e => set("display_name", e.target.value)} placeholder="Igual al nombre si lo dejas vacío" />
                </div>
                <div className="space-y-1.5">
                  <Label>Color de marca</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.brand_color} onChange={e => set("brand_color", e.target.value)} className="w-10 h-10 rounded border border-slate-200 cursor-pointer" />
                    <Input value={form.brand_color} onChange={e => set("brand_color", e.target.value)} className="w-32" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Prefijo factura</Label>
                    <Input value={form.invoice_prefix} onChange={e => set("invoice_prefix", e.target.value)} placeholder="Ej: B-" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Siguiente n.º</Label>
                    <Input type="number" min="1" value={form.invoice_next} onChange={e => set("invoice_next", e.target.value)} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" />
                Empresa activa
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={cancel}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                  <Check className="w-4 h-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid gap-3">
            {companies.map(c => (
              <Card key={c.id} className="border-slate-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                    style={{ background: c.brand_color || "#4f46e5" }}>
                    {(c.display_name || c.name || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 truncate">{c.name}</p>
                      {c.id === "equist" && <Badge variant="outline" className="text-xs">Principal</Badge>}
                      {c.is_active === false && <Badge className="bg-red-100 text-red-700 text-xs">Inactiva</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {c.nit ? `NIT ${c.nit} · ` : ""}{c.domain || "sin dominio"}{c.invoice_prefix ? ` · factura ${c.invoice_prefix}${c.invoice_next || 1}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startEdit(c)}>
                    <Pencil className="w-4 h-4" />
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
