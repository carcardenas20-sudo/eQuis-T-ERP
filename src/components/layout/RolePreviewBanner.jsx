import React, { useState } from "react";
import { useSession } from "../providers/SessionProvider";
import { Eye, X, Shield, Users, Package, Wrench } from "lucide-react";

const COMERCIAL_PERMS = ["pos_sales","sales_view","customers_view","products_view","expenses_view","reports_basic","credits_view","inventory_view"];

function getModulesForRole(role) {
  if (!role) return [];
  const perms = role.permissions || [];
  const modules = [];
  if (COMERCIAL_PERMS.some(p => perms.includes(p))) modules.push("comercial");
  if (perms.includes("produccion_view") || perms.includes("produccion_pipeline_view")) modules.push("produccion");
  if (perms.includes("operarios_view") || perms.includes("operarios_admin")) modules.push("operarios");
  return modules;
}

const MODULE_META = {
  comercial:  { label: "Comercial",  color: "bg-blue-500",   text: "text-blue-100",  dot: "🔵" },
  produccion: { label: "Producción", color: "bg-green-500",  text: "text-green-100", dot: "🟢" },
  operarios:  { label: "Operarios",  color: "bg-violet-500", text: "text-violet-100",dot: "🟣" },
};

const MODULE_GROUPS = [
  { id: "comercial",  label: "Comercial",  icon: Package,  color: "text-blue-400",   bg: "bg-blue-500/10 hover:bg-blue-500/20",   active: "bg-blue-600" },
  { id: "produccion", label: "Producción", icon: Wrench,   color: "text-green-400",  bg: "bg-green-500/10 hover:bg-green-500/20", active: "bg-green-600" },
  { id: "operarios",  label: "Operarios",  icon: Users,    color: "text-violet-400", bg: "bg-violet-500/10 hover:bg-violet-500/20",active: "bg-violet-600" },
  { id: "none",       label: "Otros",      icon: Shield,   color: "text-slate-400",  bg: "bg-slate-500/10 hover:bg-slate-500/20", active: "bg-slate-600" },
];

export default function RolePreviewBanner() {
  const { isRealAdmin, allRoles, previewRoleId, setPreviewRole, exitPreview, isLoading } = useSession();
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState("comercial");

  if (!isRealAdmin || isLoading) return null;

  const uniqueRoles = allRoles.filter((r, idx, arr) => arr.findIndex(x => x.name === r.name) === idx);
  const activeRole = previewRoleId ? allRoles.find(r => r.id === previewRoleId) : null;
  const activeModules = getModulesForRole(activeRole);

  const rolesByGroup = {};
  MODULE_GROUPS.forEach(g => { rolesByGroup[g.id] = []; });
  uniqueRoles.forEach(role => {
    const mods = getModulesForRole(role);
    if (mods.length === 0) rolesByGroup["none"].push(role);
    else mods.forEach(m => { if (rolesByGroup[m]) rolesByGroup[m].push(role); });
  });

  // Deduplicate roles that appear in multiple groups
  const shownRoles = new Set();
  MODULE_GROUPS.forEach(g => {
    rolesByGroup[g.id] = rolesByGroup[g.id].filter(r => {
      if (shownRoles.has(r.id)) return false;
      shownRoles.add(r.id);
      return true;
    });
  });

  if (!previewRoleId) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[300] bg-slate-900 text-white shadow-xl border-b border-slate-700">
        <div className="flex items-center gap-0 min-w-0 h-9">
          {/* Left label */}
          <div className="flex items-center gap-2 px-3 shrink-0 border-r border-slate-700 h-full">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 text-xs font-medium whitespace-nowrap">Vista previa como:</span>
          </div>

          {/* Module tabs */}
          <div className="flex items-center gap-0 border-r border-slate-700 h-full shrink-0">
            {MODULE_GROUPS.filter(g => g.id !== "none" || rolesByGroup["none"].length > 0).map(group => {
              const Icon = group.icon;
              const count = rolesByGroup[group.id].length;
              if (count === 0) return null;
              return (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-colors border-r border-slate-700 last:border-r-0 ${
                    activeGroup === group.id
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`w-3 h-3 ${group.color}`} />
                  <span className="hidden sm:inline">{group.label}</span>
                  <span className="text-xs text-slate-500">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Role chips for active group */}
          <div className="flex gap-1.5 px-3 overflow-x-auto scrollbar-none flex-1 min-w-0 items-center">
            {rolesByGroup[activeGroup]?.map(role => {
              const mods = getModulesForRole(role);
              return (
                <button
                  key={role.id}
                  onClick={() => setPreviewRole(role.id)}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-700 hover:bg-indigo-600 active:bg-indigo-700 rounded-full text-white transition-colors text-xs font-medium group"
                >
                  {mods.includes("comercial") && <span className="text-xs leading-none">🔵</span>}
                  {mods.includes("produccion") && <span className="text-xs leading-none">🟢</span>}
                  {mods.includes("operarios") && <span className="text-xs leading-none">🟣</span>}
                  <span>{role.name}</span>
                  <span className="text-slate-400 group-hover:text-indigo-200 text-xs">({role.permissions?.length || 0})</span>
                </button>
              );
            })}
            {(!rolesByGroup[activeGroup] || rolesByGroup[activeGroup].length === 0) && (
              <span className="text-xs text-slate-500 italic">Sin roles en este módulo</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active preview mode
  return (
    <div className="fixed top-0 left-0 right-0 z-[300] shadow-xl">
      <div className="bg-indigo-700 border-b border-indigo-500">
        <div className="flex items-center gap-0 min-w-0 h-9">
          {/* Active role indicator */}
          <div className="flex items-center gap-2 px-3 border-r border-indigo-500 h-full shrink-0">
            <Eye className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
            <span className="text-indigo-200 text-xs font-medium whitespace-nowrap hidden sm:inline">Simulando:</span>
            <span className="text-xs font-bold bg-white text-indigo-700 px-2.5 py-0.5 rounded-full shrink-0 max-w-[160px] truncate">
              {activeRole?.name}
            </span>
            {/* Module badges */}
            <div className="flex gap-1 shrink-0">
              {activeModules.includes("comercial") && (
                <span className="text-xs bg-blue-500/30 text-blue-100 border border-blue-400/40 px-1.5 py-0.5 rounded-full hidden md:inline">🔵</span>
              )}
              {activeModules.includes("produccion") && (
                <span className="text-xs bg-green-500/30 text-green-100 border border-green-400/40 px-1.5 py-0.5 rounded-full hidden md:inline">🟢</span>
              )}
              {activeModules.includes("operarios") && (
                <span className="text-xs bg-violet-500/30 text-violet-100 border border-violet-400/40 px-1.5 py-0.5 rounded-full hidden md:inline">🟣</span>
              )}
              <span className="text-xs text-indigo-300 hidden sm:inline">
                {activeRole?.permissions?.length || 0} permisos
              </span>
            </div>
          </div>

          {/* Other roles */}
          <div className="flex gap-1 px-2 overflow-x-auto scrollbar-none flex-1 min-w-0 items-center">
            {uniqueRoles.filter(r => r.id !== previewRoleId).map(role => (
              <button
                key={role.id}
                onClick={() => setPreviewRole(role.id)}
                className="shrink-0 px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 rounded-full text-white text-xs transition-colors border border-indigo-400/30 hover:border-indigo-300"
              >
                {role.name}
              </button>
            ))}
          </div>

          {/* Exit button */}
          <button
            onClick={exitPreview}
            className="shrink-0 flex items-center gap-1.5 px-3 h-full bg-indigo-600 hover:bg-red-600 border-l border-indigo-500 text-xs font-semibold transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir de vista previa</span>
            <span className="sm:hidden">Salir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
