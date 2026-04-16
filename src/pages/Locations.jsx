import React, { useState, useEffect, useCallback } from "react";
import { Location } from "@/entities/Location";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, EyeOff, Eye, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const LocationForm = ({ location, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState(location || {
    name: "", code: "", address: "", city: "", phone: "", is_active: true
  });

  const handleChange = (field, value) => setFormData(p => ({...p, [field]: value}));

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location ? 'Editar Sucursal' : 'Nueva Sucursal'}</DialogTitle>
          <DialogDescription>Rellena los datos de la sucursal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Nombre</Label><Input value={formData.name} onChange={e => handleChange('name', e.target.value)} /></div>
            <div className="space-y-1"><Label>Código</Label><Input value={formData.code} onChange={e => handleChange('code', e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Dirección</Label><Input value={formData.address} onChange={e => handleChange('address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Ciudad</Label><Input value={formData.city} onChange={e => handleChange('city', e.target.value)} /></div>
            <div className="space-y-1"><Label>Teléfono</Label><Input value={formData.phone} onChange={e => handleChange('phone', e.target.value)} /></div>
          </div>
           <div className="flex items-center space-x-2 pt-2">
            <Switch id="is_active" checked={formData.is_active} onCheckedChange={v => handleChange('is_active', v)} />
            <Label htmlFor="is_active">Activa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(formData)} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      setLocations(await Location.list("-created_date"));
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadLocations() }, [loadLocations]);

  const handleSave = async (data) => {
    setIsSaving(true);
    try {
      if (editingLocation) {
        await Location.update(editingLocation.id, data);
      } else {
        await Location.create(data);
      }
      setIsFormOpen(false);
      setEditingLocation(null);
      loadLocations();
    } catch(e) { console.error(e) }
    setIsSaving(false);
  }

  const handleToggleActive = async (loc) => {
    try {
      await Location.update(loc.id, { is_active: !loc.is_active });
      loadLocations();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (loc) => {
    if (window.confirm(`¿Seguro que quieres eliminar la sucursal "${loc.name}"?`)) {
      try {
        await Location.delete(loc.id);
        loadLocations();
      } catch (e) { console.error(e); }
    }
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Gestión de Sucursales</h1>
            <p className="text-slate-600 mt-1">Administra tus puntos de venta y bodegas.</p>
          </div>
          <Button onClick={() => { setEditingLocation(null); setIsFormOpen(true); }} className="gap-2">
            <Plus className="w-5 h-5" /> Nueva Sucursal
          </Button>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-slate-50"><TableHead>Nombre</TableHead><TableHead>Ciudad</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></TableCell></TableRow> :
                  locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell><div className="font-medium">{loc.name}</div><div className="text-sm text-slate-500">{loc.code}</div></TableCell>
                      <TableCell>{loc.city}</TableCell>
                      <TableCell><Badge variant={loc.is_active ? "default" : "destructive"} className={loc.is_active ? "bg-emerald-500" : ""}>{loc.is_active ? "Activa" : "Inactiva"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingLocation(loc); setIsFormOpen(true); }}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(loc)}>
                              {loc.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</> : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(loc)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {isFormOpen && <LocationForm location={editingLocation} onSave={handleSave} onCancel={() => setIsFormOpen(false)} isSaving={isSaving} />}
      </div>
    </div>
  );
}