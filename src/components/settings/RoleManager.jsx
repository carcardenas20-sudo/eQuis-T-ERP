import React, { useState, useEffect } from "react";
import { Role } from "@/entities/Role";
import { User } from "@/entities/User";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, MoreHorizontal, Shield, Loader2, AlertCircle, Users, Copy } from "lucide-react";

const ALL_PERMISSIONS = [
  // ── DASHBOARD ──────────────────────────────────────────────
  { id: "dashboard_view",       label: "Ver Dashboard",              category: "Dashboard", level: "Básico",    description: "Acceder al dashboard general del sistema" },
  { id: "dashboard_comercial",  label: "Dashboard Comercial",        category: "Dashboard", level: "Básico",    description: "Ver métricas de ventas, caja y créditos filtradas por sucursal asignada" },
  { id: "dashboard_produccion", label: "Dashboard Producción",       category: "Dashboard", level: "Básico",    description: "Ver pipeline de materias primas y presupuestos aprobados" },
  { id: "dashboard_operarios",  label: "Dashboard Operarios",        category: "Dashboard", level: "Básico",    description: "Ver resumen de entregas, despachos y pagos del módulo de operarios" },

  // ── PUNTO DE VENTA ─────────────────────────────────────────
  { id: "pos_sales",            label: "Realizar Ventas",          category: "Punto de Venta", level: "Básico",    description: "Procesar ventas en el punto de venta" },
  { id: "pos_apply_discounts",  label: "Aplicar Descuentos",       category: "Punto de Venta", level: "Avanzado",  description: "🚨 CRÍTICO: Modifica campos de descuento en el carrito. Sin este permiso los campos están BLOQUEADOS" },
  { id: "pos_cancel_sales",     label: "Cancelar Ventas",          category: "Punto de Venta", level: "Avanzado",  description: "Cancelar ventas ya procesadas" },
  { id: "pos_process_returns",  label: "Procesar Devoluciones",    category: "Punto de Venta", level: "Avanzado",  description: "Procesar devoluciones de productos" },
  { id: "pos_edit_sales",       label: "Editar Ventas",            category: "Punto de Venta", level: "Avanzado",  description: "Modificar ventas existentes" },
  { id: "pos_delete_sales",     label: "Eliminar Ventas",          category: "Punto de Venta", level: "Gerencial", description: "Eliminar ventas del historial" },

  // ── VENTAS ─────────────────────────────────────────────────
  { id: "sales_view",               label: "Ver Ventas",               category: "Ventas", level: "Básico",    description: "Consultar historial de ventas" },
  { id: "sales_edit",               label: "Editar Ventas",            category: "Ventas", level: "Avanzado",  description: "Modificar ventas registradas" },
  { id: "sales_cancel",             label: "Anular Ventas",            category: "Ventas", level: "Avanzado",  description: "Anular ventas del historial" },
  { id: "sales_print",              label: "Reimprimir Facturas",      category: "Ventas", level: "Básico",    description: "Reimprimir facturas existentes" },
  { id: "sales_view_all_locations", label: "Ver Ventas Todas las Sedes", category: "Ventas", level: "Gerencial", description: "Ver ventas de todas las sucursales, no solo la propia" },

  // ── PRODUCTOS ──────────────────────────────────────────────
  { id: "products_view",          label: "Ver Productos",         category: "Productos", level: "Básico",       description: "Consultar el catálogo de productos" },
  { id: "products_create",        label: "Crear Productos",       category: "Productos", level: "Intermedio",   description: "Crear nuevos productos en el sistema" },
  { id: "products_edit",          label: "Editar Productos",      category: "Productos", level: "Intermedio",   description: "Modificar información de productos existentes" },
  { id: "products_delete",        label: "Eliminar Productos",    category: "Productos", level: "Gerencial",    description: "Eliminar productos del catálogo" },
  { id: "products_manage_prices", label: "Gestionar Precios",     category: "Productos", level: "Gerencial",    description: "Modificar precios y listas de precios" },

  // ── INVENTARIO ─────────────────────────────────────────────
  { id: "inventory_view",     label: "Ver Inventario",       category: "Inventario", level: "Básico",      description: "Consultar niveles de stock" },
  { id: "inventory_adjust",   label: "Ajustar Stock",        category: "Inventario", level: "Intermedio",  description: "Corregir cantidades de inventario" },
  { id: "inventory_receive",  label: "Recibir Mercancía",    category: "Inventario", level: "Intermedio",  description: "Registrar entrada de mercancía" },
  { id: "inventory_transfer", label: "Trasladar Stock",      category: "Inventario", level: "Avanzado",    description: "Trasladar stock entre sucursales" },

  // ── CLIENTES ───────────────────────────────────────────────
  { id: "customers_view",   label: "Ver Clientes",     category: "Clientes", level: "Básico",      description: "Consultar información de clientes" },
  { id: "customers_create", label: "Crear Clientes",   category: "Clientes", level: "Básico",      description: "Registrar nuevos clientes" },
  { id: "customers_edit",   label: "Editar Clientes",  category: "Clientes", level: "Intermedio",  description: "Modificar información de clientes" },
  { id: "customers_delete", label: "Eliminar Clientes",category: "Clientes", level: "Gerencial",   description: "Eliminar clientes del sistema" },

  // ── CRÉDITOS ───────────────────────────────────────────────
  { id: "credits_view",    label: "Ver Créditos",      category: "Créditos", level: "Básico",     description: "Consultar créditos pendientes" },
  { id: "credits_create",  label: "Otorgar Créditos",  category: "Créditos", level: "Intermedio", description: "Crear ventas a crédito" },
  { id: "credits_collect", label: "Cobrar Créditos",   category: "Créditos", level: "Básico",     description: "Registrar pagos de créditos" },
  { id: "credits_modify",  label: "Modificar Créditos",category: "Créditos", level: "Gerencial",  description: "Modificar condiciones de créditos existentes" },

  // ── GASTOS ─────────────────────────────────────────────────
  { id: "expenses_view",              label: "Ver Gastos",               category: "Gastos", level: "Básico",      description: "Consultar gastos registrados" },
  { id: "expenses_create",            label: "Registrar Gastos",         category: "Gastos", level: "Intermedio",  description: "Crear nuevos gastos" },
  { id: "expenses_edit",              label: "Editar Gastos",            category: "Gastos", level: "Intermedio",  description: "Modificar gastos existentes" },
  { id: "expenses_delete",            label: "Eliminar Gastos",          category: "Gastos", level: "Gerencial",   description: "Eliminar gastos del sistema" },
  { id: "expenses_view_all_locations",label: "Gastos Todas las Sedes",   category: "Gastos", level: "Gerencial",   description: "Ver gastos de todas las sucursales" },

  // ── COMPRAS ────────────────────────────────────────────────
  { id: "purchases_view",   label: "Ver Compras",    category: "Compras", level: "Básico",     description: "Consultar órdenes de compra" },
  { id: "purchases_create", label: "Crear Compras",  category: "Compras", level: "Intermedio", description: "Crear nuevas órdenes de compra" },

  // ── CUENTAS POR PAGAR ──────────────────────────────────────
  { id: "accounts_payable_view",   label: "Ver Cuentas por Pagar",    category: "Cuentas por Pagar", level: "Gerencial",   description: "Consultar cuentas por pagar pendientes" },
  { id: "accounts_payable_manage", label: "Gestionar Cuentas x Pagar",category: "Cuentas por Pagar", level: "Gerencial",   description: "Crear, editar y marcar pagos en cuentas por pagar" },

  // ── REPORTES ───────────────────────────────────────────────
  { id: "reports_basic",     label: "Reportes Básicos",     category: "Reportes", level: "Básico",     description: "Ver reportes de ventas básicos y acceder al dashboard" },
  { id: "reports_advanced",  label: "Reportes Avanzados",   category: "Reportes", level: "Intermedio", description: "Ver reportes detallados y análisis" },
  { id: "reports_financial", label: "Reportes Financieros", category: "Reportes", level: "Gerencial",  description: "Ver reportes de rentabilidad y flujo de caja" },
  { id: "reports_export",    label: "Exportar Reportes",    category: "Reportes", level: "Gerencial",  description: "Exportar datos a Excel/CSV" },

  // ── CONTABILIDAD ───────────────────────────────────────────
  { id: "accounting_view_transactions",    label: "Ver Transacciones",     category: "Contabilidad", level: "Intermedio", description: "Ver movimientos bancarios y cuentas" },
  { id: "accounting_manage_bank_accounts", label: "Gestionar Cuentas",     category: "Contabilidad", level: "Gerencial",  description: "Crear y modificar cuentas bancarias" },
  { id: "accounting_reconcile",            label: "Conciliar Cuentas",     category: "Contabilidad", level: "Gerencial",  description: "Realizar conciliación bancaria" },

  // ── OPERARIOS ──────────────────────────────────────────────
  { id: "operarios_view",  label: "Ver Módulo Operarios",       category: "Operarios", level: "Básico",     description: "Accede a: Dashboard, Operaciones Diarias, Entregas, Despachos, Pendientes, Cotizador, Compras y Solicitudes de Pago" },
  { id: "operarios_admin", label: "Administrar Operarios",      category: "Operarios", level: "Avanzado",   description: "Accede además a: Empleados, Inventario Op., Pagos, Transferencias y Auditoría" },

  // ── PRODUCCIÓN ─────────────────────────────────────────────
  { id: "produccion_pipeline_view", label: "Ver Pipeline de Producción", category: "Producción", level: "Básico",     description: "Solo lectura del flujo productivo: Remisiones, Planificador y Presupuestos. Ideal para Planillador y Gerentes de Tienda" },
  { id: "produccion_view",          label: "Gestión Completa Producción", category: "Producción", level: "Avanzado",  description: "Acceso completo al módulo de Producción: materias primas, colores, operaciones, compras, inventario" },

  // ── SISTEMA ────────────────────────────────────────────────
  { id: "agent_access",          label: "Asistente IA",              category: "Sistema", level: "Gerencial",    description: "Usar el asistente de inteligencia artificial" },
  { id: "users_view",            label: "Ver Usuarios",              category: "Sistema", level: "Gerencial",    description: "Consultar lista de usuarios" },
  { id: "users_create",          label: "Crear Usuarios",            category: "Sistema", level: "Administrador",description: "Crear nuevas cuentas de usuario" },
  { id: "users_edit",            label: "Editar Usuarios",           category: "Sistema", level: "Administrador",description: "Modificar datos de usuarios" },
  { id: "users_delete",          label: "Eliminar Usuarios",         category: "Sistema", level: "Administrador",description: "Eliminar cuentas de usuario" },
  { id: "users_manage_permissions",label:"Gestionar Permisos",       category: "Sistema", level: "Administrador",description: "Asignar y modificar roles y permisos" },
  { id: "locations_view",        label: "Ver Sucursales",            category: "Sistema", level: "Básico",       description: "Consultar información de sucursales" },
  { id: "locations_create",      label: "Crear Sucursales",          category: "Sistema", level: "Administrador",description: "Registrar nuevas sucursales" },
  { id: "locations_edit",        label: "Editar Sucursales",         category: "Sistema", level: "Administrador",description: "Modificar datos de sucursales" },
  { id: "settings_system",       label: "Configuración General",     category: "Sistema", level: "Administrador",description: "Modificar configuraciones generales del sistema" },
  { id: "settings_price_lists",  label: "Listas de Precios",         category: "Sistema", level: "Gerencial",    description: "Gestionar listas de precios" },
  { id: "data_export",           label: "Exportar Datos",            category: "Sistema", level: "Gerencial",    description: "Exportar registros del sistema" },
  { id: "system_logs",           label: "Ver Logs del Sistema",      category: "Sistema", level: "Administrador",description: "Consultar registros de actividad del sistema" },
];

const levelColors = {
  "Básico": "bg-green-100 text-green-800",
  "Intermedio": "bg-yellow-100 text-yellow-800",
  "Avanzado": "bg-orange-100 text-orange-800",
  "Gerencial": "bg-blue-100 text-blue-800",
  "Administrador": "bg-red-100 text-red-800"
};

// Module sections for grouping permissions visually
const MODULE_SECTIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    color: "amber",
    headerClass: "bg-amber-600 text-white",
    borderClass: "border-amber-200",
    categories: ["Dashboard"]
  },
  {
    id: "comercial",
    label: "Módulo Comercial",
    color: "blue",
    headerClass: "bg-blue-600 text-white",
    borderClass: "border-blue-200",
    categories: ["Punto de Venta", "Ventas", "Productos", "Inventario", "Clientes", "Créditos", "Gastos", "Compras", "Cuentas por Pagar", "Reportes", "Contabilidad"]
  },
  {
    id: "produccion",
    label: "Módulo Producción",
    color: "green",
    headerClass: "bg-green-600 text-white",
    borderClass: "border-green-200",
    categories: ["Producción"]
  },
  {
    id: "operarios",
    label: "Módulo Operarios",
    color: "violet",
    headerClass: "bg-violet-600 text-white",
    borderClass: "border-violet-200",
    categories: ["Operarios"]
  },
  {
    id: "sistema",
    label: "Sistema",
    color: "slate",
    headerClass: "bg-slate-600 text-white",
    borderClass: "border-slate-200",
    categories: ["Sistema"]
  }
];

const PREDEFINED_ROLES = [
  {
    name: "Vendedor",
    description: "Ventas básicas sin descuentos ni devoluciones",
    permissions: ["dashboard_view", "dashboard_comercial", "pos_sales", "customers_view", "customers_create", "customers_edit", "sales_view", "sales_print", "credits_view", "credits_collect", "products_view", "inventory_view", "reports_basic"]
  },
  {
    name: "Cajero",
    description: "POS con descuentos y devoluciones",
    permissions: ["dashboard_view", "dashboard_comercial", "pos_sales", "pos_apply_discounts", "pos_process_returns", "customers_view", "customers_create", "customers_edit", "sales_view", "sales_print", "credits_view", "credits_create", "credits_collect", "products_view"]
  },
  {
    name: "Líder de Punto",
    description: "Gestión completa del punto de venta con gastos y reportes",
    permissions: [
      "dashboard_view", "dashboard_comercial",
      "pos_sales", "pos_cancel_sales", "pos_edit_sales", "pos_delete_sales",
      "customers_view", "customers_create", "customers_edit",
      "sales_view", "sales_edit", "sales_cancel", "sales_print",
      "credits_view", "credits_create", "credits_collect",
      "inventory_view", "inventory_receive",
      "expenses_view", "expenses_create", "expenses_edit", "expenses_delete",
      "products_view", "reports_basic"
    ]
  },
  {
    name: "Gerente de Tienda",
    description: "POS completo + visibilidad del pipeline de producción para su tienda",
    permissions: [
      "dashboard_view", "dashboard_comercial", "dashboard_produccion",
      "pos_sales", "pos_cancel_sales", "pos_apply_discounts", "pos_process_returns", "pos_edit_sales",
      "products_view", "products_create", "products_edit", "products_manage_prices",
      "inventory_view", "inventory_adjust", "inventory_receive",
      "customers_view", "customers_create", "customers_edit", "customers_delete",
      "credits_view", "credits_create", "credits_collect", "credits_modify",
      "sales_view", "sales_edit", "sales_cancel", "sales_print",
      "expenses_view", "expenses_create", "expenses_edit", "expenses_delete",
      "reports_basic", "reports_advanced",
      "produccion_pipeline_view"
    ]
  },
  {
    name: "Encargado de Producción",
    description: "Acceso completo al módulo de producción",
    permissions: ["dashboard_view", "dashboard_produccion", "produccion_view", "produccion_pipeline_view", "reports_basic"]
  },
  {
    name: "Supervisor de Operarios",
    description: "Acceso administrativo completo al módulo de operarios",
    permissions: ["dashboard_view", "dashboard_operarios", "operarios_view", "operarios_admin", "produccion_pipeline_view", "reports_basic"]
  },
  {
    name: "Operario",
    description: "Acceso básico al módulo de operarios",
    permissions: ["dashboard_view", "dashboard_operarios", "operarios_view"]
  },
  {
    name: "Planillador",
    description: "Gestión completa de operarios + seguimiento del pipeline de producción",
    permissions: ["dashboard_view", "dashboard_operarios", "operarios_view", "operarios_admin", "produccion_pipeline_view", "reports_basic"]
  },
  {
    name: "Gerente",
    description: "Acceso gerencial completo: POS, finanzas, reportes y pipeline de producción",
    permissions: [
      "dashboard_view", "dashboard_comercial", "dashboard_produccion", "dashboard_operarios",
      "pos_sales", "pos_cancel_sales", "pos_apply_discounts", "pos_process_returns",
      "products_view", "products_create", "products_edit", "products_manage_prices",
      "inventory_view", "inventory_adjust", "inventory_transfer", "inventory_receive",
      "customers_view", "customers_create", "customers_edit", "customers_delete",
      "credits_view", "credits_create", "credits_collect", "credits_modify",
      "sales_view", "sales_edit", "sales_cancel", "sales_view_all_locations", "sales_print",
      "expenses_view", "expenses_create", "expenses_edit", "expenses_delete", "expenses_view_all_locations",
      "reports_basic", "reports_advanced", "reports_financial", "reports_export",
      "accounting_view_transactions", "accounting_manage_bank_accounts",
      "purchases_view", "purchases_create",
      "accounts_payable_view", "accounts_payable_manage",
      "users_view", "users_edit", "locations_view", "data_export",
      "produccion_pipeline_view"
    ]
  }
];

const RoleForm = ({ role, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState(role || { name: "", description: "", permissions: [] });
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionChange = (permissionId, checked) => {
    const currentPermissions = formData.permissions || [];
    const newPermissions = checked
      ? [...currentPermissions, permissionId]
      : currentPermissions.filter(p => p !== permissionId);
    handleChange('permissions', newPermissions);
  };

  const handleSelectAllInSection = (categories, checked) => {
    const sectionPerms = ALL_PERMISSIONS
      .filter(p => categories.includes(p.category))
      .map(p => p.id);
    const current = formData.permissions || [];
    let updated;
    if (checked) {
      updated = [...new Set([...current, ...sectionPerms])];
    } else {
      updated = current.filter(p => !sectionPerms.includes(p));
    }
    handleChange('permissions', updated);
  };

  const applyPredefinedRole = (predefinedRole) => {
    setFormData(prev => ({
      ...prev,
      name: predefinedRole.name,
      description: predefinedRole.description,
      permissions: [...predefinedRole.permissions]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      setError("El nombre del rol es obligatorio.");
      return;
    }
    setError("");
    await onSave(formData);
  };

  const groupedPermissions = ALL_PERMISSIONS.reduce((groups, permission) => {
    const category = permission.category;
    if (!groups[category]) groups[category] = [];
    groups[category].push(permission);
    return groups;
  }, {});

  const isSectionAllChecked = (categories) => {
    const sectionPerms = ALL_PERMISSIONS.filter(p => categories.includes(p.category)).map(p => p.id);
    return sectionPerms.every(id => formData.permissions?.includes(id));
  };

  const isSectionPartiallyChecked = (categories) => {
    const sectionPerms = ALL_PERMISSIONS.filter(p => categories.includes(p.category)).map(p => p.id);
    const checked = sectionPerms.filter(id => formData.permissions?.includes(id));
    return checked.length > 0 && checked.length < sectionPerms.length;
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {role ? 'Editar Rol' : 'Nuevo Rol'}
          </DialogTitle>
          <DialogDescription>
            Define permisos específicos. Especial atención al permiso de "Aplicar Descuentos".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Predefined Role Templates */}
          {!role && (
            <div className="border-b pb-4">
              <Label className="text-base font-semibold mb-3 block">Plantillas de Roles Recomendadas</Label>
              <p className="text-sm text-slate-600 mb-4">
                Selecciona una plantilla como punto de partida. Nota: "Líder de Punto" NO tiene permisos de descuento.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {PREDEFINED_ROLES.map((predefined, index) => (
                  <Card
                    key={index}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                      predefined.name === "Líder de Punto" ? "border-2 border-orange-300 bg-orange-50" : ""
                    }`}
                    onClick={() => applyPredefinedRole(predefined)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3 h-3 text-blue-600" />
                        <h4 className="font-medium text-xs">{predefined.name}</h4>
                        {predefined.name === "Líder de Punto" && (
                          <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded">SIN DESC.</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-tight">{predefined.description}</p>
                      <div className="text-xs text-blue-600 mt-1">{predefined.permissions.length} permisos</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Rol *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Ej: Vendedor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Describe las responsabilidades de este rol..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-lg font-semibold">Permisos del Sistema</Label>
                <p className="text-sm text-slate-600">Organizado por módulo. Revisa especialmente "Aplicar Descuentos".</p>
              </div>
              <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                {formData.permissions?.length || 0} seleccionados
              </span>
            </div>

            <div className="space-y-6">
              {MODULE_SECTIONS.map((section) => {
                const sectionAllPerms = ALL_PERMISSIONS.filter(p => section.categories.includes(p.category));
                if (sectionAllPerms.length === 0) return null;
                const allChecked = isSectionAllChecked(section.categories);
                const partial = isSectionPartiallyChecked(section.categories);
                const checkedCount = sectionAllPerms.filter(p => formData.permissions?.includes(p.id)).length;

                return (
                  <div key={section.id} className={`border-2 ${section.borderClass} rounded-xl overflow-hidden`}>
                    <div className={`${section.headerClass} px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`section-${section.id}`}
                          checked={allChecked}
                          data-state={partial ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                          onCheckedChange={checked => handleSelectAllInSection(section.categories, checked)}
                          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                        />
                        <label htmlFor={`section-${section.id}`} className="font-semibold text-base cursor-pointer">
                          {section.label}
                        </label>
                      </div>
                      <span className="text-xs opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
                        {checkedCount}/{sectionAllPerms.length} permisos
                      </span>
                    </div>

                    <div className="p-3 space-y-3 bg-white">
                      {section.categories.map(category => {
                        const perms = groupedPermissions[category];
                        if (!perms) return null;
                        return (
                          <div key={category} className="bg-slate-50 rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                              {category} — {perms.length} permisos
                            </h5>
                            <div className="space-y-2">
                              {perms.map(permission => (
                                <div
                                  key={permission.id}
                                  className={`flex items-start space-x-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow ${
                                    permission.id === 'pos_apply_discounts' ? 'border-2 border-red-300 bg-red-50' : 'border-slate-100'
                                  }`}
                                >
                                  <Checkbox
                                    id={permission.id}
                                    checked={formData.permissions?.includes(permission.id)}
                                    onCheckedChange={checked => handlePermissionChange(permission.id, checked)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <label
                                      htmlFor={permission.id}
                                      className="text-sm font-medium text-slate-900 cursor-pointer block"
                                    >
                                      {permission.label}
                                      {permission.id === 'pos_apply_discounts' && (
                                        <span className="ml-2 text-red-600 font-bold">⚠️ DESCUENTOS</span>
                                      )}
                                    </label>
                                    <p className="text-xs text-slate-500 mt-0.5">{permission.description}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${levelColors[permission.level]}`}>
                                      {permission.level}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Guardar Rol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function RoleManager({ roles = [], onRefresh, isLoading }) {
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    User.list().then(setUsers).catch(() => setUsers([]));
  }, [roles]);

  const getUserCountForRole = (roleId) => {
    return users.filter(u => u.role_id === roleId).length;
  };

  const handleSave = async (data) => {
    setIsSaving(true);
    try {
      if (editingRole) {
        await Role.update(editingRole.id, data);
      } else {
        await Role.create(data);
      }
      setShowForm(false);
      setEditingRole(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving role:", error);
    }
    setIsSaving(false);
  };

  const handleDuplicate = async (role) => {
    const newName = `${role.name} (copia)`;
    try {
      await Role.create({
        name: newName,
        description: role.description,
        permissions: [...(role.permissions || [])]
      });
      onRefresh();
    } catch (error) {
      console.error("Error duplicating role:", error);
      alert("Error al duplicar el rol.");
    }
  };

  const handleDelete = async (role) => {
    const count = getUserCountForRole(role.id);
    const msg = count > 0
      ? `⚠️ El rol "${role.name}" está asignado a ${count} usuario(s).\n\nSi lo eliminas, esos usuarios quedarán sin rol. ¿Deseas continuar?`
      : `¿Estás seguro de eliminar el rol "${role.name}"?`;
    if (window.confirm(msg)) {
      try {
        await Role.delete(role.id);
        onRefresh();
      } catch (error) {
        console.error("Error deleting role:", error);
        alert("Error: No se puede eliminar el rol.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roles de Usuario</h2>
          <p className="text-slate-600 text-sm mt-1">
            Control granular de permisos por módulo: Comercial, Operarios y Producción.
          </p>
        </div>
        <Button
          onClick={() => { setEditingRole(null); setShowForm(true); }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Rol
        </Button>
      </div>

      <Card className="shadow-lg border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Rol</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Usuarios</TableHead>
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
              ) : roles && roles.length > 0 ? (
                roles.map((role) => {
                  const userCount = getUserCountForRole(role.id);
                  const perms = role.permissions || [];
                  const hasComercial = ["pos_sales","sales_view","customers_view","products_view","expenses_view","reports_basic","credits_view","inventory_view"].some(p => perms.includes(p));
                  const hasProduccion = perms.includes("produccion_view") || perms.includes("produccion_pipeline_view");
                  const hasOperarios = perms.includes("operarios_view") || perms.includes("operarios_admin");

                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-slate-900">{role.name}</div>
                          <div className="text-sm text-slate-500">{role.description}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{perms.length} permisos</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {hasComercial && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200 font-medium">🔵 Comercial</span>
                            )}
                            {hasProduccion && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-200 font-medium">🟢 Producción</span>
                            )}
                            {hasOperarios && (
                              <span className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200 font-medium">🟣 Operarios</span>
                            )}
                            {!hasComercial && !hasProduccion && !hasOperarios && (
                              <span className="text-xs text-slate-400 italic">Sin módulo</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {perms.includes('pos_apply_discounts') && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full border border-red-300 font-semibold">⚠️ Descuentos</span>
                            )}
                            {perms.includes('users_manage_permissions') && (
                              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full border border-orange-200">Admin Sistema</span>
                            )}
                            {perms.some(p => ['cancel_sales','apply_discounts','manage_inventory','view_reports','manage_products'].includes(p)) && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-400 font-semibold">⚠️ Permisos obsoletos</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className={`text-sm font-medium ${userCount > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                            {userCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingRole(role); setShowForm(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(role)}>
                              <Copy className="w-4 h-4 mr-2" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(role)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    No hay roles configurados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <RoleForm
          role={editingRole}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingRole(null); }}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
