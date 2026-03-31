import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, ShoppingCart, ShoppingBag, ArrowRightLeft, Wallet, CreditCard } from "lucide-react";

export default function BottomTabBar() {
  const location = useLocation();

  const handleTabClick = (e, tab) => {
    if (location.pathname === tab.path) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabs = [
    { name: "Inicio", path: createPageUrl("Dashboard"), icon: LayoutDashboard },
    { name: "Traslados", path: createPageUrl("Transfers"), icon: ArrowRightLeft },
    { name: "Compras", path: createPageUrl("Purchases"), icon: ShoppingBag },
    { name: "POS", path: createPageUrl("POS"), icon: ShoppingCart },
    { name: "Efectivo", path: createPageUrl("CashControl"), icon: Wallet },
    { name: "Por Pagar", path: createPageUrl("AccountsPayable"), icon: CreditCard },
  ];

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
