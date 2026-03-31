import React, { useState } from "react";
import { PriceList } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, MoreHorizontal, DollarSign, Loader2, AlertCircle, Crown } from "lucide-react";

const PriceListForm = ({ priceList, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState(priceList || {
    name: "", code: "", description: "", is_default: false
  });
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      setError("Nombre y código son obligatorios.");
      return;
    }

    // Basic code validation (no spaces, alphanumeric + underscore)
    if (!/^[A-Z0-9_]+$/.test(formData.code)) {
      setError("El código debe ser mayúsculas, números o guiones bajos solamente.");
      return;
    }

    setError("");
    await onSave(formData);
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            {priceList ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
          </DialogTitle>
          <DialogDescription>
            Define una lista de precios para aplicar a diferentes tipos de clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input 
                id="name"
                placeholder="Ej: Mayorista"
                value={formData.name} 
                onChange={(e) => handleChange('name', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input 
                id="code"
                placeholder="Ej: WHOLESALE"
                value={formData.code} 
                onChange={(e) => handleChange('code', e.target.value.toUpperCase())} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea 
              id="description"
              placeholder="Descripción opcional..."
              value={formData.description} 
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600" />
              <Label htmlFor="is_default" className="font-medium">Lista por defecto</Label>
            </div>
            <Switch 
              id="is_default" 
              checked={formData.is_default} 
              onCheckedChange={(value) => handleChange('is_default', value)} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar Lista'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function PriceListManager({ priceLists, onRefresh, isLoading }) {
  const [showForm, setShowForm] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data) => {
    setIsSaving(true);
    try {
      // If setting as default, remove default from others first
      if (data.is_default) {
        const currentDefault = priceLists.find(list => list.is_default);
        if (currentDefault && currentDefault.id !== editingList?.id) {
          await PriceList.update(currentDefault.id, { is_default: false });
        }
      }

      if (editingList) {
        await PriceList.update(editingList.id, data);
      } else {
        await PriceList.create(data);
      }
      
      setShowForm(false);
      setEditingList(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving price list:", error);
    }
    setIsSaving(false);
  };

  const handleDelete = async (list) => {
    if (list.is_default) {
      alert("No puedes eliminar la lista de precios por defecto.");
      return;
    }

    if (window.confirm(`¿Estás seguro de eliminar la lista "${list.name}"? Esta acción es irreversible.`)) {
      try {
        await PriceList.delete(list.id);
        onRefresh();
      } catch (error) {
        console.error("Error deleting price list:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Listas de Precios</h2>
          <p className="text-slate-600 text-sm mt-1">
            Gestiona diferentes esquemas de precios para tus productos.
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditingList(null);
            setShowForm(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva Lista
        </Button>
      </div>

      {/* Price Lists Table */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : priceLists.length > 0 ? (
                priceLists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{list.name}</span>
                        {list.is_default && (
                          <Crown className="w-4 h-4 text-amber-500" title="Lista por defecto" />
                        )}
                      </div>
                      {list.description && (
                        <p className="text-sm text-slate-500 mt-1">{list.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {list.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={list.is_default ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"}>
                        {list.is_default ? "Por Defecto" : "Activa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditingList(list);
                            setShowForm(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(list)} 
                            className="text-red-600"
                            disabled={list.is_default}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    No hay listas de precios configuradas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Modal */}
      {showForm && (
        <PriceListForm
          priceList={editingList}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingList(null);
          }}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}