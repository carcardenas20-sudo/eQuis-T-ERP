import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Shield, AlertCircle } from "lucide-react";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [logsData, empData] = await Promise.all([
      base44.entities.ActivityLog.list('-created_date', 500),
      base44.entities.Employee.list()
    ]);
    setLogs(logsData || []);
    setEmployees(empData || []);
    setLoading(false);
  };

  const getActionColor = (action) => {
    if (action === 'created') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
    if (action === 'updated') return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    if (action === 'deleted') return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  };

  const getEntityIcon = (type) => {
    if (type === 'Delivery') return '📦';
    if (type === 'Dispatch') return '🚚';
    if (type === 'Payment') return '💰';
    if (type === 'PaymentRequest') return '📋';
    return '📄';
  };

  const filteredLogs = logs.filter(log => {
    if (filterType && log.entity_type !== filterType) return false;
    if (filterAction && log.action !== filterAction) return false;
    if (filterEmployee && log.employee_id !== filterEmployee) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-1">
            <Shield className="w-7 h-7 text-blue-600" />
            Registro de Auditoría
          </h1>
          <p className="text-sm text-slate-600">Historial completo de cambios · Quién hizo qué y cuándo</p>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de Entidad</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Todos</option>
                  <option value="Delivery">Entregas</option>
                  <option value="Dispatch">Despachos</option>
                  <option value="Payment">Pagos</option>
                  <option value="PaymentRequest">Solicitudes de Pago</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Acción</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Todas</option>
                  <option value="created">Creadas</option>
                  <option value="updated">Editadas</option>
                  <option value="deleted">Eliminadas</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">Operario Afectado</label>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Todos</option>
                  {employees.map((e, idx) => (
                    <option key={`${e.employee_id}-${idx}`} value={e.employee_id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Sin registros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const color = getActionColor(log.action);
              const date = new Date(log.created_date);
              const timeStr = date.toLocaleString('es-CO', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={log.id}
                  className={`rounded-lg border ${color.border} ${color.bg} p-4 space-y-2`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-2xl mt-1">{getEntityIcon(log.entity_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{log.description}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          <strong>👤 Ejecutado por: {log.created_by}</strong>
                          {log.employee_name && <> · Operario afectado: <span className="text-slate-700 font-medium">{log.employee_name}</span></>}
                          {log.amount && <> · ${log.amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</>}
                          <br />
                          <span className="text-slate-500">⏰ {timeStr}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <Badge variant={log.action === 'created' ? 'default' : log.action === 'updated' ? 'secondary' : 'destructive'}>
                        {log.action === 'created' ? 'Creado' : log.action === 'updated' ? 'Editado' : 'Eliminado'}
                      </Badge>
                      <Badge variant="outline">{log.entity_type}</Badge>
                    </div>
                  </div>

                  {/* Mostrar detalles de cambios */}
                  {log.action === 'updated' && log.new_data && (
                    <details className="mt-2 text-xs text-slate-600 cursor-pointer">
                      <summary className="font-medium hover:text-slate-900">📋 Ver detalles del cambio</summary>
                      <pre className="bg-slate-100 p-2 rounded mt-1 text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">
                        {JSON.stringify(log.new_data, null, 2)}
                      </pre>
                    </details>
                  )}

                  {(log.action === 'deleted' || log.action === 'created') && log.previous_data && (
                    <details className="mt-2 text-xs text-slate-600 cursor-pointer">
                      <summary className="font-medium hover:text-slate-900">📋 Ver detalles</summary>
                      <pre className="bg-slate-100 p-2 rounded mt-1 text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">
                        {JSON.stringify(log.previous_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-6 text-center">
          Mostrando {filteredLogs.length} de {logs.length} registros
        </p>
      </div>
    </div>
  );
}