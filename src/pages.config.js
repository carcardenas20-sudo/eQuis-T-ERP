/**
 * pages.config.js - Sistema Unificado eQuis-T
 * Módulos: Comercial (equistpos) + Producción (chaquetas-pro) + Operarios (produccionequist)
 */

// ── MÓDULO COMERCIAL (equistpos) ──────────────────────────────
import AccountsPayable from './pages/AccountsPayable';
import BankAccounts from './pages/BankAccounts';
import CashControl from './pages/CashControl';
import Credits from './pages/Credits';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Debug from './pages/Debug';
import Exchanges from './pages/Exchanges';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import InventoryAudits from './pages/InventoryAudits';
import Locations from './pages/Locations';
import POS from './pages/POS';
import Products from './pages/Products';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Sales from './pages/Sales';
import Settings from './pages/Settings';
import TestPermisos from './pages/TestPermisos';
import Transfers from './pages/Transfers';
import Users from './pages/Users';
import MerchandiseAssignment from './pages/MerchandiseAssignment';

// ── MÓDULO PRODUCCIÓN / CHAQUETAS (chaquetas-pro) ─────────────
import Prod_Dashboard from './pages/Prod_Dashboard';
import Prod_Remisiones from './pages/Prod_Remisiones';
import Prod_PlanificacionRemisiones from './pages/Prod_PlanificacionRemisiones';
import Prod_AsignacionesIndividualesPage from './pages/Prod_AsignacionesIndividualesPage';
import Prod_Operaciones from './pages/Prod_Operaciones';
import Prod_MateriasPrimas from './pages/Prod_MateriasPrimas';
import Prod_Colores from './pages/Prod_Colores';
import Prod_Productos from './pages/Prod_Productos';
import Prod_Inventario from './pages/Prod_Inventario';
import Prod_Proveedores from './pages/Prod_Proveedores';
import Prod_Compras from './pages/Prod_Compras';
import Prod_Presupuestos from './pages/Prod_Presupuestos';
import Prod_EstadoCuentaPublico from './pages/Prod_EstadoCuentaPublico';

// ── MÓDULO OPERARIOS (produccionequist) ───────────────────────
import Op_Dashboard from './pages/Op_Dashboard';
import Op_DailyOperations from './pages/Op_DailyOperations';
import Op_Employees from './pages/Op_Employees';
import Op_Inventory from './pages/Op_Inventory';
import Op_Deliveries from './pages/Op_Deliveries';
import Op_Dispatches from './pages/Op_Dispatches';
import Op_Pending from './pages/Op_Pending';
import Op_MyDeliveries from './pages/Op_MyDeliveries';
import Op_Payments from './pages/Op_Payments';
import Op_BankTransfers from './pages/Op_BankTransfers';
import Op_SalaryQuote from './pages/Op_SalaryQuote';
import Op_EmployeePurchases from './pages/Op_EmployeePurchases';
import Op_PaymentRequest from './pages/Op_PaymentRequest';
import Op_AuditLog from './pages/Op_AuditLog';
import Op_EmployeePortal from './pages/Op_EmployeePortal';
import Op_EmployeeProfile from './pages/Op_EmployeeProfile';
import Op_DraftDeliveries from './pages/Op_DraftDeliveries';
import Op_PhotoCapture from './pages/Op_PhotoCapture';
import Op_Empleado from './pages/Op_Empleado';
import Op_MerchandiseEntry from './pages/Op_MerchandiseEntry';
import __Layout from './Layout.jsx';

export const PAGES = {
  // Comercial
  "AccountsPayable": AccountsPayable,
  "BankAccounts": BankAccounts,
  "CashControl": CashControl,
  "Credits": Credits,
  "Customers": Customers,
  "Dashboard": Dashboard,
  "Debug": Debug,
  "Exchanges": Exchanges,
  "Expenses": Expenses,
  "Inventory": Inventory,
  "InventoryAudits": InventoryAudits,
  "Locations": Locations,
  "POS": POS,
  "Products": Products,
  "Purchases": Purchases,
  "Reports": Reports,
  "Sales": Sales,
  "Settings": Settings,
  "TestPermisos": TestPermisos,
  "Transfers": Transfers,
  "Users": Users,
  "MerchandiseAssignment": MerchandiseAssignment,

  // Producción / Chaquetas

  "Prod_Dashboard": Prod_Dashboard,
  "Prod_Remisiones": Prod_Remisiones,
  "Prod_PlanificacionRemisiones": Prod_PlanificacionRemisiones,
  "Prod_AsignacionesIndividualesPage": Prod_AsignacionesIndividualesPage,
  "Prod_Operaciones": Prod_Operaciones,
  "Prod_MateriasPrimas": Prod_MateriasPrimas,
  "Prod_Colores": Prod_Colores,
  "Prod_Productos": Prod_Productos,
  "Prod_Inventario": Prod_Inventario,
  "Prod_Proveedores": Prod_Proveedores,
  "Prod_Compras": Prod_Compras,
  "Prod_Presupuestos": Prod_Presupuestos,
  "Prod_EstadoCuentaPublico": Prod_EstadoCuentaPublico,

  // Operarios
  "Op_Dashboard": Op_Dashboard,
  "Op_DailyOperations": Op_DailyOperations,
  "Op_Employees": Op_Employees,
  "Op_Inventory": Op_Inventory,
  "Op_Deliveries": Op_Deliveries,
  "Op_Dispatches": Op_Dispatches,
  "Op_Pending": Op_Pending,
  "Op_MyDeliveries": Op_MyDeliveries,
  "Op_Payments": Op_Payments,
  "Op_BankTransfers": Op_BankTransfers,
  "Op_SalaryQuote": Op_SalaryQuote,
  "Op_EmployeePurchases": Op_EmployeePurchases,
  "Op_PaymentRequest": Op_PaymentRequest,
  "Op_AuditLog": Op_AuditLog,
  "Op_EmployeePortal": Op_EmployeePortal,
  "Op_EmployeeProfile": Op_EmployeeProfile,
  "Op_DraftDeliveries": Op_DraftDeliveries,
  "Op_PhotoCapture": Op_PhotoCapture,
  "Op_Empleado": Op_Empleado,
  "Op_MerchandiseEntry": Op_MerchandiseEntry,
};

export const pagesConfig = {
  mainPage: "Dashboard",
  Pages: PAGES,
  Layout: __Layout,
};
