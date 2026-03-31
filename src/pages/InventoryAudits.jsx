import React, { useState, useEffect } from "react";
import { InventoryAudit, InventoryAuditItem, Location } from "@/entities/all";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Plus, Eye, BarChart3, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatColombiaDate } from "../components/utils/dateUtils";
import AuditChecklist from "../components/audits/AuditChecklist";
import AuditSummary from "../components/audits/AuditSummary";

export default function InventoryAuditsPage() {
  const [audits, setAudits] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [activeTab, setActiveTab] = useState("list");
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [auditItems, setAuditItems] = useState([]);
  const [showNewAuditModal, setShowNewAuditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [user, auditData, locationData] = await Promise.all([
        User.me(),
        InventoryAudit.list(),
        Location.list()
      ]);
      
      setCurrentUser(user);
      setAudits(auditData || []);
      setLocations(locationData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAudit = async () => {
    if (!selectedLocation) {
      alert("Selecciona una sucursal");
      return;
    }

    setIsCreating(true);
    try {
      const auditNumber = `AUD-${Date.now().toString().slice(-8).toUpperCase()}`;
      const newAudit = await InventoryAudit.create({
        audit_number: auditNumber,
        location_id: selectedLocation,
        audit_date: new Date().toISOString().split('T')[0],
        status: "in_progress",
        notes: auditNotes
      });

      setShowNewAuditModal(false);
      setSelectedLocation("");
      setAuditNotes("");
      
      setSelectedAudit(newAudit);
      setAuditItems([]);
      setActiveTab("progress");
    } catch (error) {
      console.error("Error creating audit:", error);
      alert("Error al crear la auditoría");
    } finally {
      setIsCreating(false);
    }
  };

  const handleItemUpdate = (flatItems) => {
    // flatItems es un array de items con secciones ya incluidas
    const itemsWithAuditId = flatItems.map(item => ({
      ...item,
      audit_id: selectedAudit.id
    }));
    setAuditItems(itemsWithAuditId);
  };

  const handleCompleteAudit = async () => {
    if (auditItems.length === 0) {
      alert("Debes auditar al menos un producto");
      return;
    }

    try {
      // Agrupar items por producto para sumar diferencias
      const productDifferences = {};
      auditItems.forEach(item => {
        if (!productDifferences[item.product_id]) {
          productDifferences[item.product_id] = {
            total_difference: 0,
            total_value: 0,
            difference_type: 'sin_diferencia'
          };
        }
        productDifferences[item.product_id].total_difference += (item.difference || 0);
        productDifferences[item.product_id].total_value += (item.difference_value || 0);
      });

      const sobrantes = Object.values(productDifferences).filter(p => p.total_difference > 0);
      const faltantes = Object.values(productDifferences).filter(p => p.total_difference < 0);
      
      const totalSobranteQty = sobrantes.reduce((acc, p) => acc + p.total_difference, 0);
      const totalFaltanteQty = faltantes.reduce((acc, p) => acc + Math.abs(p.total_difference), 0);
      const totalSobranteValue = sobrantes.reduce((acc, p) => acc + p.total_value, 0);
      const totalFaltanteValue = faltantes.reduce((acc, p) => acc + p.total_value, 0);

      const uniqueProducts = new Set(auditItems.map(i => i.product_id)).size;
      const productsWithDifference = Object.values(productDifferences).filter(p => p.total_difference !== 0).length;

      await InventoryAudit.update(selectedAudit.id, {
        status: "completed",
        total_items_audited: uniqueProducts,
        total_differences: productsWithDifference,
        total_sobrante: totalSobranteQty,
        total_faltante: totalFaltanteQty,
        sobrante_value: totalSobranteValue,
        faltante_value: totalFaltanteValue,
        completed_date: new Date().toISOString(),
        completed_by: currentUser.email
      });

      // Save audit items
      for (const item of auditItems) {
        await InventoryAuditItem.create(item);
      }

      await loadData();
      setSelectedAudit(null);
      setAuditItems([]);
      setActiveTab("list");
      alert("Auditoría completada exitosamente");
    } catch (error) {
      console.error("Error completing audit:", error);
      alert("Error al completar la auditoría");
    }
  };

  const handleViewDetails = async (audit) => {
    try {
      const items = await InventoryAuditItem.filter({ audit_id: audit.id });
      setSelectedAudit(audit);
      setAuditItems(items || []);
      setShowDetailsModal(true);
    } catch (error) {
      console.error("Error loading details:", error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800">En Progreso</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completada</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Auditoría de Inventario</h1>
            <p className="text-slate-600 mt-1">Realiza conteos físicos y verifica diferencias</p>
          </div>
          <Button 
            onClick={() => setShowNewAuditModal(true)}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Auditoría
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="gap-2">
              <Eye className="w-4 h-4" />
              Historial
            </TabsTrigger>
            {selectedAudit && selectedAudit.status === "in_progress" && (
              <TabsTrigger value="progress" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                En Progreso
              </TabsTrigger>
            )}
          </TabsList>

          {/* Historial */}
          <TabsContent value="list" className="space-y-4">
            {audits.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No hay auditorías registradas</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Auditoría</TableHead>
                          <TableHead>Sucursal</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                          <TableHead className="text-center">Productos</TableHead>
                          <TableHead className="text-center">Diferencias</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audits.map((audit) => {
                          const location = locations.find(l => l.id === audit.location_id);
                          return (
                            <TableRow key={audit.id}>
                              <TableCell className="font-medium">{audit.audit_number}</TableCell>
                              <TableCell>{location?.name || "—"}</TableCell>
                              <TableCell>{formatColombiaDate(audit.audit_date, 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="text-center">
                                {getStatusBadge(audit.status)}
                              </TableCell>
                              <TableCell className="text-center">
                                {audit.total_items_audited || 0}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-semibold text-red-600">
                                  {audit.total_differences || 0}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(audit)}
                                  className="gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                  Ver
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* En Progreso */}
          {selectedAudit && selectedAudit.status === "in_progress" && (
            <TabsContent value="progress" className="space-y-4">
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-900">{selectedAudit.audit_number}</p>
                      <p className="text-sm text-blue-700">Auditoría en progreso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <AuditSummary audit={selectedAudit} items={auditItems} />

              <AuditChecklist 
                audit={selectedAudit} 
                onItemUpdate={handleItemUpdate}
                isLoading={false}
              />

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectedAudit(null);
                    setAuditItems([]);
                    setActiveTab("list");
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCompleteAudit}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Completar Auditoría
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Modal: Nueva Auditoría */}
      <Dialog open={showNewAuditModal} onOpenChange={setShowNewAuditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Auditoría de Inventario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sucursal *</label>
              <MobileSelect
                value={selectedLocation}
                onValueChange={setSelectedLocation}
                placeholder="Seleccionar sucursal..."
                options={locations.map(loc => ({
                  value: loc.id,
                  label: loc.name
                }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                placeholder="Observaciones sobre esta auditoría..."
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNewAuditModal(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAudit}
              disabled={isCreating || !selectedLocation}
              className="gap-2"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear Auditoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalles */}
      {showDetailsModal && selectedAudit && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedAudit.audit_number}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <AuditSummary audit={selectedAudit} items={auditItems} />

              <Card>
                <CardHeader>
                  <CardTitle>Detalles de Diferencias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-center">Sistema</TableHead>
                          <TableHead className="text-center">Físico</TableHead>
                          <TableHead className="text-center">Diferencia</TableHead>
                          <TableHead className="text-right">Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditItems
                          .filter(i => i.difference !== 0 && i.difference !== undefined)
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.product_name}</TableCell>
                              <TableCell className="text-center">{item.quantity_system}</TableCell>
                              <TableCell className="text-center">{item.quantity_physical}</TableCell>
                              <TableCell className="text-center font-semibold">
                                <span className={item.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {item.difference > 0 ? '+' : ''}{item.difference}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge className={item.difference_type === 'sobrante' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                  {item.difference_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">${(item.difference_value || 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}