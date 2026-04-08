import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { SessionProvider, useSession } from "./components/providers/SessionProvider";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { ThemeToggle } from "./components/layout/ThemeToggle";
import BottomTabBar from "./components/layout/BottomTabBar";
import RolePreviewBanner from "./components/layout/RolePreviewBanner";
import { AnimatePresence, motion } from "framer-motion";

import {
  Menu, X, LogOut, LayoutDashboard, ShoppingCart, Package, MapPin, Users,
  FileText, Settings, Building2, UserCheck, CreditCard, Receipt, ShoppingBag,
  BookOpen, ArrowRightLeft, ArrowLeftRight, Sparkles, Wallet, BarChart3,
  ListChecks, Factory, Shirt, Palette, Wrench, Truck, Calculator,
  PackageCheck, TruckIcon, Clock, Warehouse, Eye
} from "lucide-react";

const comercialGroups = [
  {
    title: "Principal", items: [
      { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard, permissions: ["reports_basic"] },
      { title: "Punto de Venta", url: createPageUrl("POS"), icon: ShoppingCart, permissions: ["pos_sales"] },
    ]
  },
  {
    title: "Ventas", items: [
      { title: "Ventas", url: createPageUrl("Sales"), icon: FileText, permissions: ["sales_view"] },
      { title: "Cambios", url: createPageUrl("Exchanges"), icon: ArrowLeftRight, permissions: ["sales_view"] },
      { title: "Clientes", url: createPageUrl("Customers"), icon: UserCheck, permissions: ["customers_view"] },
      { title: "Créditos", url: createPageUrl("Credits"), icon: CreditCard, permissions: ["credits_view"] },
    ]
  },
  {
    title: "Inventario", items: [
      { title: "Productos", url: createPageUrl("Products"), icon: Package, permissions: ["products_view", "products_create"] },
      { title: "Inventario", url: createPageUrl("Inventory"), icon: MapPin, permissions: ["inventory_view"] },
      { title: "Auditorías", url: createPageUrl("InventoryAudits"), icon: MapPin, permissions: ["inventory_view"] },
      { title: "Traslados", url: createPageUrl("Transfers"), icon: ArrowRightLeft, permissions: ["inventory_transfer"] },
      { title: "Asignación Mercancía", url: createPageUrl("MerchandiseAssignment"), icon: PackageCheck, permissions: ["inventory_view"] },
    ]
  },
  {
    title: "Compras", items: [
      { title: "Compras", url: createPageUrl("Purchases"), icon: ShoppingBag, permissions: ["purchases_view"] },
    ]
  },
  {
    title: "Finanzas", items: [
      { title: "Gastos", url: createPageUrl("Expenses"), icon: Receipt, permissions: ["expenses_view"] },
      { title: "Cuentas por Pagar", url: createPageUrl("AccountsPayable"), icon: CreditCard, permissions: ["expenses_view"] },
      { title: "Control de Efectivo", url: createPageUrl("CashControl"), icon: Wallet, permissions: ["accounting_view_transactions"] },
      { title: "Cuentas Bancarias", url: createPageUrl("BankAccounts"), icon: Building2, permissions: ["accounting_view_transactions"] },
      { title: "Reportes", url: createPageUrl("Reports"), icon: BarChart3, permissions: ["reports_basic"] },
    ]
  },
  {
    title: "Configuración", items: [
      { title: "Usuarios", url: createPageUrl("Users"), icon: Users, permissions: ["users_view"] },
      { title: "Sucursales", url: createPageUrl("Locations"), icon: Building2, permissions: ["locations_view"] },
      { title: "Configuración", url: createPageUrl("Settings"), icon: Settings, permissions: ["settings_system"] },
    ]
  },
];

// produccion_pipeline_view: acceso de solo lectura al flujo de producción
// (para Planillador y Gerentes de Tienda — sin acceso a gestión completa)
const produccionGroups = [
  {
    title: "Producción", items: [
      { title: "Remisiones", url: createPageUrl("Prod_Remisiones"), icon: Truck, permissions: ["produccion_view", "produccion_pipeline_view"] },
      { title: "Planificador", url: createPageUrl("Prod_PlanificacionRemisiones"), icon: ListChecks, permissions: ["produccion_view", "produccion_pipeline_view"] },
      { title: "Asignaciones", url: createPageUrl("Prod_AsignacionesIndividualesPage"), icon: UserCheck, permissions: ["produccion_view"] },
      { title: "Operaciones", url: createPageUrl("Prod_Operaciones"), icon: Wrench, permissions: ["produccion_view"] },
    ]
  },
  {
    title: "Materiales", items: [
      { title: "Materias Primas", url: createPageUrl("Prod_MateriasPrimas"), icon: Package, permissions: ["produccion_view"] },
      { title: "Colores", url: createPageUrl("Prod_Colores"), icon: Palette, permissions: ["produccion_view"] },
      { title: "Productos Prod.", url: createPageUrl("Prod_Productos"), icon: Shirt, permissions: ["produccion_view"] },
      { title: "Inventario Prod.", url: createPageUrl("Prod_Inventario"), icon: Warehouse, permissions: ["produccion_view"] },
    ]
  },
  {
    title: "Compras Prod.", items: [
      { title: "Proveedores", url: createPageUrl("Prod_Proveedores"), icon: Building2, permissions: ["produccion_view"] },
      { title: "Compras Prod.", url: createPageUrl("Prod_Compras"), icon: ShoppingBag, permissions: ["produccion_view"] },
      { title: "Presupuestos", url: createPageUrl("Prod_Presupuestos"), icon: Calculator, permissions: ["produccion_view", "produccion_pipeline_view"] },
    ]
  },
];

const operariosGroups = [
  {
    title: "Operarios", items: [
      { title: "Operaciones Diarias", url: createPageUrl("Op_DailyOperations"), icon: Factory, permissions: ["operarios_view"] },
      { title: "Empleados", url: createPageUrl("Op_Employees"), icon: Users, permissions: ["operarios_admin"] },
      { title: "Inventario Op.", url: createPageUrl("Op_Inventory"), icon: Warehouse, permissions: ["operarios_admin"] },
      { title: "Portal Planillador", url: "/portal-planillador", icon: Truck, permissions: ["operarios_admin"], isPortal: true },
    ]
  },
  {
    title: "Entregas", items: [
      { title: "Entregas", url: createPageUrl("Op_Deliveries"), icon: PackageCheck, permissions: ["operarios_view"] },
      { title: "Despachos", url: createPageUrl("Op_Dispatches"), icon: TruckIcon, permissions: ["operarios_view"] },
      { title: "Pendientes", url: createPageUrl("Op_Pending"), icon: Clock, permissions: ["operarios_view"] },
      { title: "Mis Entregas", url: createPageUrl("Op_MyDeliveries"), icon: PackageCheck, permissions: ["operarios_view"] },
    ]
  },
  {
    title: "Pagos Op.", items: [
      { title: "Pagos", url: createPageUrl("Op_Payments"), icon: CreditCard, permissions: ["operarios_admin"] },
      { title: "Transferencias", url: createPageUrl("Op_BankTransfers"), icon: ArrowRightLeft, permissions: ["operarios_admin"] },
      { title: "Cotizador Salario", url: createPageUrl("Op_SalaryQuote"), icon: Calculator, permissions: ["operarios_view"] },
      { title: "Compras Empleados", url: createPageUrl("Op_EmployeePurchases"), icon: ShoppingBag, permissions: ["operarios_view"] },
      { title: "Entrada de Mercancía", url: createPageUrl("Op_MerchandiseEntry"), icon: PackageCheck, permissions: ["operarios_view"] },
      { title: "Solicitud de Pago", url: createPageUrl("Op_PaymentRequest"), icon: Receipt, permissions: ["operarios_view"] },
      { title: "Auditoría Op.", url: createPageUrl("Op_AuditLog"), icon: Eye, permissions: ["operarios_admin"] },
    ]
  },
];

const MODULE_ACCESS_PERMS = {
  comercial: ["pos_sales","sales_view","products_view","products_create","inventory_view","purchases_view","expenses_view","reports_basic","customers_view","credits_view","inventory_transfer","accounting_view_transactions","users_view","locations_view","settings_system","agent_access"],
  produccion: ["produccion_view", "produccion_pipeline_view"],
  operarios: ["operarios_view","operarios_admin"],
};

const MODULE_META = {
  comercial: { label: "Comercial", icon: ShoppingCart, badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", activeCls: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300", groupCls: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  produccion: { label: "Producción", icon: Factory, badgeCls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", activeCls: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300", groupCls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
  operarios: { label: "Operarios", icon: Users, badgeCls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", activeCls: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300", groupCls: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" },
};


function LayoutContent({ children }) {
  const location = useLocation();
  const { currentUser, permissions, userRole, isLoading, isRealAdmin, previewRoleId } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // In preview mode, disable admin bypass so permission filtering works realistically
  const isAdmin = isRealAdmin && !previewRoleId;

  const hasModuleAccess = (mk) => {
    if (isAdmin) return true;
    return MODULE_ACCESS_PERMS[mk].some(p => permissions?.includes(p));
  };

  const filterItems = (items) => {
    if (isAdmin) return items;
    return items.filter(item => {
      if (!item.permissions || item.permissions.length === 0) return true;
      if (!permissions || permissions.length === 0) return false;
      return item.permissions.some(p => permissions.includes(p));
    });
  };

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = async () => {
    try {
      const { User } = await import("@/entities/User");
      await User.logout();
      window.location.reload();
    } catch (e) { console.error(e); }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{background:'#0f0f23'}}><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  }

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center" style={{background:'#0f0f23'}}><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  }

  const allGroups = [
    ...comercialGroups.map(g => ({ ...g, mk: "comercial" })),
    ...produccionGroups.map(g => ({ ...g, mk: "produccion" })),
    ...operariosGroups.map(g => ({ ...g, mk: "operarios" })),
  ];

  // Aplanar todos los items de cada módulo sin subgrupos
  const flatEntries = [];
  let lastMk = null;
  for (const g of allGroups) {
    if (!hasModuleAccess(g.mk)) continue;
    const items = filterItems(g.items);
    if (items.length === 0) continue;
    if (g.mk !== lastMk) { flatEntries.push({ type: "header", mk: g.mk }); lastMk = g.mk; }
    for (const item of items) flatEntries.push({ type: "item", mk: g.mk, item });
  }

  const hideTabBar = location.pathname === createPageUrl("Settings");

  const sidebarBg = "hsl(229, 84%, 5%)";
  const sidebarBorder = "rgba(255,255,255,0.06)";

  const mkActiveItem = {
    comercial:  { bg: "rgba(99,102,241,0.18)", text: "#a5b4fc", icon: "#818cf8" },
    produccion: { bg: "rgba(16,185,129,0.15)", text: "#6ee7b7", icon: "#34d399" },
    operarios:  { bg: "rgba(167,139,250,0.15)", text: "#c4b5fd", icon: "#a78bfa" },
  };
  const mkGroupActive = {
    comercial:  "text-indigo-300",
    produccion: "text-emerald-300",
    operarios:  "text-violet-300",
  };
  const mkHeader = {
    comercial:  { dot: "#6366f1", text: "#6366f1" },
    produccion: { dot: "#10b981", text: "#10b981" },
    operarios:  { dot: "#a78bfa", text: "#a78bfa" },
  };

  const bannerOffset = isRealAdmin ? "pt-7" : "";

  return (
    <div className={`min-h-[100dvh] bg-slate-50 overflow-x-hidden ${bannerOffset}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      <RolePreviewBanner />

      {/* Mobile Header */}
      <div className={`lg:hidden flex items-center justify-between px-4 py-3 sticky z-[150] border-b ${isRealAdmin ? 'top-7' : 'top-0'}`}
        style={{ background: sidebarBg, borderColor: sidebarBorder }}>
        <button onClick={() => setSidebarOpen(p => !p)} className="p-2 rounded-lg transition-colors"
          style={{ color: '#a5b4fc' }}>
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">eQ</span>
          </div>
          <h1 className="text-sm font-semibold text-white">eQuis-T</h1>
        </div>
        <ThemeToggle />
      </div>

      {sidebarOpen && <div onClick={closeSidebar} className="fixed inset-0 bg-black/60 z-[100] lg:hidden backdrop-blur-sm" />}

      {/* Sidebar */}
      <aside className={`fixed left-0 bottom-0 w-64 transform transition-transform duration-300 z-[200] flex flex-col overflow-y-auto overscroll-none scrollbar-none ${isRealAdmin ? 'top-7' : 'top-0'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ background: sidebarBg, borderRight: `1px solid ${sidebarBorder}` }}>

        {/* Logo */}
        <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${sidebarBorder}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
              <span className="text-white font-bold text-sm">eQ</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none tracking-tight">eQuis-T</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#6366f1' }}>Sistema Unificado</p>
            </div>
          </div>
          <div className="hidden lg:block"><ThemeToggle /></div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overscroll-none scrollbar-none">
          {flatEntries.map((entry, idx) => {
            if (entry.type === "header") {
              const hStyle = mkHeader[entry.mk];
              return (
                <div key={`h-${entry.mk}`} className={`flex items-center gap-2 px-2 pb-1.5 ${idx > 0 ? 'pt-5' : 'pt-1'}`}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hStyle.dot }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: hStyle.text }}>
                    {MODULE_META[entry.mk].label}
                  </span>
                </div>
              );
            }
            const { mk, item } = entry;
            const isActive = location.pathname === item.url;
            const activeStyle = mkActiveItem[mk];
            const Icon = item.icon;

            if (item.isPortal) {
              const portalUrl = `${window.location.origin}${item.url}`;
              return (
                <div key={item.title} className="flex items-center gap-1 rounded-lg overflow-hidden"
                  style={isActive ? { background: activeStyle.bg } : {}}>
                  <Link to={item.url} onClick={closeSidebar}
                    className="flex items-center gap-2.5 px-3 py-1.5 flex-1 text-sm transition-all duration-150"
                    style={isActive ? { color: activeStyle.text, fontWeight: 500 } : { color: 'rgba(255,255,255,0.40)' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; }}
                  >
                    <Icon size={14} style={isActive ? { color: activeStyle.icon } : {}} />
                    <span>{item.title}</span>
                  </Link>
                  <button
                    onClick={() => navigator.clipboard.writeText(portalUrl)}
                    title="Copiar enlace del portal"
                    className="px-2 py-1.5 text-xs rounded transition-colors shrink-0"
                    style={{ color: 'rgba(255,255,255,0.30)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.30)'; e.currentTarget.style.background = ''; }}
                  >🔗</button>
                </div>
              );
            }

            return (
              <Link key={item.title} to={item.url} onClick={closeSidebar}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150"
                style={isActive
                  ? { background: activeStyle.bg, color: activeStyle.text, fontWeight: 500 }
                  : { color: 'rgba(255,255,255,0.40)' }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; } }}
              >
                <Icon size={14} style={isActive ? { color: activeStyle.icon } : {}} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: `1px solid ${sidebarBorder}` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              {(currentUser.full_name || currentUser.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {currentUser.full_name || currentUser.email}
              </p>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {Object.keys(MODULE_META).filter(hasModuleAccess).map(mk => {
                  const colors = { comercial: '#6366f1', produccion: '#10b981', operarios: '#a78bfa' };
                  return <span key={mk} className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: colors[mk] }}>{MODULE_META[mk].label}</span>;
                }).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-[9px]" style={{color:'rgba(255,255,255,0.2)'}}>·</span>, el], [])}
              </div>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            <LogOut size={13} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-64 min-h-[100dvh] pb-24 lg:pb-0 overflow-x-hidden overflow-y-auto touch-pan-y">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18, ease: "easeOut" }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {!hideTabBar && <BottomTabBar />}
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <LayoutContent>{children}</LayoutContent>
      </SessionProvider>
    </ThemeProvider>
  );
}
