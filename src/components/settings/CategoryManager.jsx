import React, { useState, useEffect } from "react";
import { ProductCategory } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag, RefreshCw } from "lucide-react";

const COLOR_OPTIONS = [
  { value: "blue", label: "Azul", className: "bg-blue-100 text-blue-800" },
  { value: "pink", label: "Rosa", className: "bg-pink-100 text-pink-800" },
  { value: "green", label: "Verde", className: "bg-green-100 text-green-800" },
  { value: "purple", label: "Morado", className: "bg-purple-100 text-purple-800" },
  { value: "orange", label: "Naranja", className: "bg-orange-100 text-orange-800" },
  { value: "red", label: "Rojo", className: "bg-red-100 text-red-800" },
  { value: "gray", label: "Gris", className: "bg-gray-100 text-gray-800" },
  { value: "yellow", label: "Amarillo", className: "bg-yellow-100 text-yellow-800" },
];

export default function CategoryManager({ onRefresh, isLoading }) {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "", color: "blue", is_active: true });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const data = await ProductCategory.list();
    setCategories(data || []);
  };

  const openNew = () => {
    setEditingCategory(null);
    setFormData({ name: "", code: "", description: "", color: "blue", is_active: true });
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, code: cat.code, description: cat.description || "", color: cat.color || "blue", is_active: cat.is_active !== false });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      alert("El nombre y el código son requeridos.");
      return;
    }
    // Auto-format code: no spaces, lowercase
    const cleanCode = formData.code.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setIsSaving(true);
    if (editingCategory) {
      await ProductCategory.update(editingCategory.id, { ...formData, code: cleanCode });
    } else {
      await ProductCategory.create({ ...formData, code: cleanCode });
    }
    setIsSaving(false);
    setShowForm(false);
    loadCategories();
  };

  const handleDelete = async (cat) => {
    if (confirm(`¿Eliminar la categoría "${cat.name}"?`)) {
      await ProductCategory.delete(cat.id);
      loadCategories();
    }
  };

  const getBadgeClass = (color) => {
    return COLOR_OPTIONS.find(c => c.value === color)?.className || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Categorías de Productos
          </h3>
          <p className="text-sm text-slate-500 mt-1">Crea y gestiona las categorías para organizar tus productos.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva Categoría
        </Button>
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No hay categorías creadas todavía.</p>
          <p className="text-sm mt-1">Crea la primera categoría para organizar tus productos.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <Badge className={`text-sm ${getBadgeClass(cat.color)}`}>
                {cat.name}
              </Badge>
              {!cat.is_active && <Badge variant="outline" className="text-xs text-gray-400">Inactiva</Badge>}
            </div>
            <p className="text-xs text-slate-500 font-mono mb-1">Código: {cat.code}</p>
            {cat.description && <p className="text-xs text-slate-600">{cat.description}</p>}
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => openEdit(cat)} className="gap-1 flex-1 text-xs">
                <Pencil className="w-3 h-3" /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(cat)} className="text-red-500 hover:text-red-700 gap-1 text-xs">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Chaquetas Hombre" />
              </div>
              <div>
                <Label>Código * (se formatea automáticamente)</Label>
                <Input value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} placeholder="Ej: chaquetas_hombre" />
                <p className="text-xs text-slate-400 mt-1">Solo letras, números y guion bajo. Se usará en los productos.</p>
              </div>
              <div>
                <Label>Descripción</Label>
                <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Descripción opcional..." />
              </div>
              <div>
                <Label>Color de la categoría</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => setFormData(p => ({ ...p, color: c.value }))}
                      className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${c.className} ${formData.color === c.value ? 'border-slate-900 scale-105' : 'border-transparent'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {editingCategory ? "Actualizar" : "Crear Categoría"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}