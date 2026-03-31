import React, { useState, useEffect, useCallback } from "react";
import { Sale } from "@/entities/Sale";
import { SaleItem } from "@/entities/SaleItem";
import { Product } from "@/entities/Product";
import { Customer } from "@/entities/Customer";
import { Location } from "@/entities/Location";
import { User } from "@/entities/User";
import { PriceList } from "@/entities/PriceList";
import { Credit } from "@/entities/Credit";
import { BarChart3, Users, MapPin, Package, Percent, TrendingUp, UserCheck, ShoppingBag, Building2, Menu, X, Activity } from "lucide-react";
import ReportFilters from "../components/reports/ReportFilters";
import SalesOverTimeReport from "../components/reports/SalesOverTimeReport";
import SalesByProductReport from "../components/reports/SalesByProductReport";
import SalesByCategoryReport from "../components/reports/SalesByCategoryReport";
import SalesByLocationReport from "../components/reports/SalesByLocationReport";
import SalesByPriceListReport from "../components/reports/SalesByPriceListReport";
import SalesByEmployeeReport from "../components/reports/SalesByEmployeeReport";
import CustomerSalesReport from "../components/reports/CustomerSalesReport";
import ProfitabilityReport from "../components/reports/ProfitabilityReport";
import SalesAnalysisReport from "../components/reports/SalesAnalysisReport";

import { getLastNDaysRangeInColombia } from "../components/utils/dateUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const reportComponents = {
  daily: SalesOverTimeReport,
  analysis: SalesAnalysisReport,
  profit: ProfitabilityReport,
  product: SalesByProductReport,
  category: SalesByCategoryReport,
  customer: CustomerSalesReport,
  employee: SalesByEmployeeReport,
  location: SalesByLocationReport,
  priceList: SalesByPriceListReport,
};

const reportMenuItems = [
  { id: 'daily', label: 'Ventas por Día', icon: BarChart3 },
  { id: 'analysis', label: 'Análisis de Ventas', icon: Activity },
  { id: 'profit', label: 'Utilidad', icon: TrendingUp },
  { id: 'product', label: 'Productos', icon: Package },
  { id: 'category', label: 'Categorías', icon: ShoppingBag },
  { id: 'customer', label: 'Clientes', icon: UserCheck },
  { id: 'employee', label: 'Vendedores', icon: Users },
  { id: 'location', label: 'Sucursales', icon: MapPin },
  { id: 'priceList', label: 'Listas Precio', icon: Percent },
];

export default function Reports() {
  const [activeReport, setActiveReport] = useState('daily');
  const [currentUser, setCurrentUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState(() => {
    const last30Days = getLastNDaysRangeInColombia(30);
    return {
      dateRange: 'last30',
      startDate: last30Days.start.split('T')[0],
      endDate: last30Days.end.split('T')[0],
      location: 'all',
      employee: 'all'
    };
  });
  
  const [reportData, setReportData] = useState({
    sales: [],
    saleItems: [],
    products: [],
    customers: [],
    locations: [],
    users: [],
    priceLists: [],
    credits: []
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        if (user.role !== 'admin' && user.location_id) {
          const locs = await Location.list();
          const loc = locs.find(l => l.id === user.location_id);
          setUserLocation(loc);
          
          setFilters(prev => ({
            ...prev,
            location: user.location_id
          }));
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    
    loadUserData();
  }, []);

  const loadDataForReports = useCallback(async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      let salesFilter = {};
      let creditsFilter = {};
      
      const isAdmin = currentUser.role === 'admin';
      if (!isAdmin && currentUser.location_id) {
        salesFilter.location_id = currentUser.location_id;
        creditsFilter.location_id = currentUser.location_id;
      }

      const [sales, saleItems, products, customers, locations, users, priceLists, credits] = await Promise.all([
        Sale.filter(salesFilter),
        SaleItem.list(),
        Product.list(),
        Customer.list(),
        Location.list(),
        User.list(),
        PriceList.list(),
        Credit.filter(creditsFilter),
      ]);
      setReportData({ sales, saleItems, products, customers, locations, users, priceLists, credits });
    } catch (error) {
      console.error("Error loading report data:", error);
    }
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadDataForReports();
    }
  }, [loadDataForReports, currentUser]);

  const ActiveReportComponent = reportComponents[activeReport];
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <h2 className="font-semibold text-slate-900">
          {reportMenuItems.find(item => item.id === activeReport)?.label}
        </h2>
        <div className="w-10" />
      </div>

      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar de Reportes */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col p-4
      `}>
        <h2 className="text-lg font-bold text-slate-800 mb-4 px-2 hidden lg:block">
          Reportes
        </h2>
        <nav className="space-y-1 overflow-y-auto flex-1">
          {reportMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveReport(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeReport === item.id 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-7xl mx-auto">
          <header className="hidden lg:block">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              {reportMenuItems.find(item => item.id === activeReport)?.label || "Reportes"}
            </h1>
            <p className="text-slate-600 mt-1 text-sm lg:text-base">
              Analiza los datos de tu operación
            </p>
            {!isAdmin && userLocation && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <Building2 className="w-4 h-4" />
                <span>Viendo: <strong>{userLocation.name}</strong></span>
              </div>
            )}
          </header>

          {!isAdmin && userLocation && (
            <Alert className="border-blue-200 bg-blue-50">
              <Building2 className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                Solo ves datos de tu sucursal: <strong>{userLocation.name}</strong>
              </AlertDescription>
            </Alert>
          )}
          
          <ReportFilters
            filters={filters}
            onFilterChange={setFilters}
            locations={reportData.locations}
            employees={reportData.users}
            currentUser={currentUser}
            userLocation={userLocation}
          />
          
          <div className="bg-white p-4 lg:p-6 rounded-xl shadow-lg border border-slate-200">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              ActiveReportComponent && (
                <ActiveReportComponent data={reportData} filters={filters} />
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}