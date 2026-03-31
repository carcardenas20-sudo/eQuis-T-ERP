import React, { useState, useEffect, useCallback } from "react";
import { Credit, Sale, User, Location } from "@/entities/all";
import { CreditCard, Calendar, Phone, User as UserIcon, DollarSign, Filter, Search, Eye, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import CreditDetailModal from "../components/credits/CreditDetailModal";
import PaymentModal from "../components/credits/PaymentModal";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800"
};

const statusLabels = {
  pending: "Pendiente",
  partial: "Pago Parcial",
  paid: "Pagado",
  overdue: "Vencido"
};

export default function CreditsPage() {
  const [credits, setCredits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    dateRange: "all"
  });

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        if (user.role !== 'admin' && user.location_id) {
          const loc = await Location.filter({ id: user.location_id });
          if (loc && loc.length > 0) {
            setUserLocation(loc[0]);
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    
    loadUserData();
  }, []);

  const loadCredits = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(true);
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("🔍 Cargando créditos...");
      
      let creditFilter = {};
      if (currentUser.role !== 'admin' && currentUser.location_id) {
        creditFilter.location_id = currentUser.location_id;
        console.log("🔒 Usuario NO-admin - Forzando filtro de sucursal:", currentUser.location_id);
      }
      
      const creditsData = await Credit.filter(creditFilter, "-created_date");
      
      console.log("📊 Total de créditos encontrados:", creditsData.length);
      console.log("📋 Créditos:", creditsData);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updatedCredits = [];

      for (const credit of creditsData) {
        const dueDate = new Date(credit.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const currentStatus = credit.status;

        if ((currentStatus === 'pending' || currentStatus === 'partial') && dueDate < today) {
          console.log(`⚠️ Crédito ${credit.id} está vencido`);
          await Credit.update(credit.id, { status: 'overdue' });
          updatedCredits.push({ ...credit, status: 'overdue' });
        } else {
          updatedCredits.push(credit);
        }
      }

      let filteredCredits = updatedCredits;

      if (filters.status !== "all") {
        filteredCredits = filteredCredits.filter(c => c.status === filters.status);
        console.log(`🔎 Filtrados por estado '${filters.status}':`, filteredCredits.length);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredCredits = filteredCredits.filter(credit =>
          credit.customer_name?.toLowerCase().includes(searchLower) ||
          credit.customer_phone?.toLowerCase().includes(searchLower) ||
          credit.sale_id?.toLowerCase().includes(searchLower)
        );
        console.log(`🔎 Filtrados por búsqueda '${filters.search}':`, filteredCredits.length);
      }

      console.log("✅ Créditos finales a mostrar:", filteredCredits.length);
      setCredits(filteredCredits);
    } catch (error) {
      console.error("❌ Error loading credits:", error);
    }
    setIsLoading(false);
  }, [filters, currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadCredits();
    }
  }, [loadCredits, currentUser]);

  const handleViewDetail = async (credit) => {
    try {
      const sale = await Sale.filter({ id: credit.sale_id });
      setSelectedCredit({ ...credit, sale: sale[0] });
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading sale details:", error);
    }
  };

  const handleAddPayment = (credit) => {
    setSelectedCredit(credit);
    setShowPaymentModal(true);
  };

  const handlePaymentSaved = () => {
    setShowPaymentModal(false);
    setSelectedCredit(null);
    loadCredits();
  };

  const totalCredits = credits.length;
  const totalAmount = credits.reduce((sum, credit) => sum + (credit.total_amount || 0), 0);
  const pendingAmount = credits.reduce((sum, credit) => sum + (credit.pending_amount || 0), 0);
  const overdueCredits = credits.filter(credit => credit.status === 'overdue').length;

  const isAdmin = currentUser?.role === 'admin';

  const LoadingSkeleton = () => (
    Array(8).fill(0).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
        <TableCell><Skeleton className="h-8 w-16 rounded" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Gestión de Créditos</h1>
            <p className="text-slate-600 mt-1">
              Administra las cuentas por cobrar y pagos pendientes.
            </p>
            {!isAdmin && userLocation && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <Building2 className="w-4 h-4" />
                <span>Viendo créditos de: <strong>{userLocation.name}</strong></span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={loadCredits}
            className="gap-2"
            disabled={isLoading || !currentUser}
          >
            <Filter className="w-4 h-4" />
            {isLoading ? "Cargando..." : "Refrescar"}
          </Button>
        </div>

        {!isAdmin && userLocation && (
          <Alert className="border-blue-200 bg-blue-50">
            <Building2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              Estás viendo únicamente los créditos de tu sucursal: <strong>{userLocation.name}</strong>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-6 sm:pb-3 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Total Créditos</CardTitle>
                <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalCredits}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-6 sm:pb-3 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Total Prestado</CardTitle>
                <DollarSign className="w-4 h-4 text-purple-500 shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-purple-600 tabular-nums break-all">
                ${totalAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-6 sm:pb-3 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Por Cobrar</CardTitle>
                <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-orange-600 tabular-nums break-all">
                ${pendingAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-6 sm:pb-3 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">Vencidos</CardTitle>
                <UserIcon className="w-4 h-4 text-red-500 shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-red-600">{overdueCredits}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por cliente, teléfono o venta..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>

              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="partial">Pago Parcial</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Vencimiento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="this_week">Esta Semana</SelectItem>
                  <SelectItem value="this_month">Este Mes</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Mobile cards */}
        {!isLoading && credits.length > 0 && (
          <div className="md:hidden space-y-3">
            {credits.map(credit => (
              <div key={credit.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{credit.customer_name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3" />{credit.customer_phone}
                    </div>
                  </div>
                  <Badge className={statusColors[credit.status] || "bg-gray-100 text-gray-800"}>
                    {statusLabels[credit.status] || credit.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <p className="text-xs text-slate-500">Pendiente</p>
                    <p className="font-bold text-slate-900">${(credit.pending_amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-400">de ${(credit.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Vencimiento</p>
                    <p className="font-medium text-slate-900">
                      {credit.due_date ? format(new Date(credit.due_date), "dd/MM/yyyy", { locale: es }) : '-'}
                    </p>
                    <p className="text-xs text-slate-400">
                      #{credit.sale_id?.slice(-6)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(credit)} className="flex-1">
                    <Eye className="w-4 h-4 mr-1" /> Ver
                  </Button>
                  {credit.status !== 'paid' && (
                    <Button size="sm" onClick={() => handleAddPayment(credit)} className="flex-1 bg-green-600 hover:bg-green-700">
                      <DollarSign className="w-4 h-4 mr-1" /> Pagar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop table */}
        <Card className="hidden md:block shadow-lg border-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Venta</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <LoadingSkeleton />
                  ) : credits.length > 0 ? (
                    credits.map(credit => (
                      <TableRow key={credit.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{credit.customer_name}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="w-3 h-3" />{credit.customer_phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">#{credit.sale_id?.slice(-8)}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{credit.due_date ? format(new Date(credit.due_date), "dd/MM/yyyy", { locale: es }) : '-'}</p>
                            <p className="text-xs text-slate-500">{credit.due_date ? format(new Date(credit.due_date), "EEEE", { locale: es }) : ''}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-slate-900">${(credit.pending_amount || 0).toLocaleString()}</span>
                          <p className="text-xs text-slate-500">de ${(credit.total_amount || 0).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[credit.status] || "bg-gray-100 text-gray-800"}>
                            {statusLabels[credit.status] || credit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleViewDetail(credit)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {credit.status !== 'paid' && (
                              <Button size="sm" onClick={() => handleAddPayment(credit)} className="bg-green-600 hover:bg-green-700">
                                <DollarSign className="w-4 h-4 mr-1" /> Pagar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        {filters.search ? "No se encontraron créditos con ese criterio" : "No hay créditos registrados aún"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="md:hidden space-y-3">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && credits.length === 0 && (
          <div className="text-center py-12 text-slate-500 border rounded-xl bg-white">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            {filters.search ? "No se encontraron créditos con ese criterio" : "No hay créditos registrados aún"}
          </div>
        )}
      </div>

      {showDetailModal && selectedCredit && (
        <CreditDetailModal
          credit={selectedCredit}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCredit(null);
          }}
        />
      )}

      {showPaymentModal && selectedCredit && (
        <PaymentModal
          credit={selectedCredit}
          onSave={handlePaymentSaved}
          onCancel={() => {
            setShowPaymentModal(false);
            setSelectedCredit(null);
          }}
        />
      )}
    </div>
  );
}