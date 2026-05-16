import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, ShoppingCart, ShoppingBag, ArrowRightLeft, Wallet, CreditCard } from "lucide-react";
import { useSession } from "../providers/SessionProvider";

const ALL_TABS = [
  { name: "Inicio",    path: createPageUrl("Dashboard"),       icon: LayoutDashboard, permissions: ["reports_basic", "dashboard_view", "dashboard_comercial", "dashboard_produccion", "dashboard_operarios"] },
  { name: "POS",       path: createPageUrl("POS"),             icon: ShoppingCart,    permissions: ["pos_sales"] },
  { name: "Traslados", path: createPageUrl("Transfers"),       icon: ArrowRightLeft,  permissions: ["inventory_transfer"] },
  { name: "Compras",   path: createPageUrl("Purchases"),       icon: ShoppingBag,     permissions: ["purchases_view"] },
  { name: "Efectivo",  path: createPageUrl("CashControl"),     icon: Wallet,          permissions: ["accounting_view_transactions"] },
  { name: "Por Pagar", path: createPageUrl("AccountsPayable"), icon: CreditCard,      permissions: ["accounts_payable_view"] },
];

export default function BottomTabBar() {
  const location = useLocation();
  const { permissions, isRealAdmin, previewRoleId } = useSession();
  const isAdmin = isRealAdmin && !previewRoleId;

  const tabs = isAdmin
    ? ALL_TABS
    : ALL_TABS.filter(tab =>
        !tab.permissions?.length ||
        tab.permissions.some(p => permissions?.includes(p))
      );

  const handleTabClick = (e, tab) => {
    if (location.pathname === tab.path) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-50 pb-safe">
      <div className="flex h-16 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.name}
              to={tab.path}
              onClick={(e) => handleTabClick(e, tab)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors select-none flex-1 min-w-[56px] px-1 ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "scale-110" : ""}`} />
              <span className="text-[10px] font-medium leading-tight text-center truncate w-full text-center">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
