import React, { useState, useEffect } from "react";
import { Employee } from "@/api/entitiesProduccion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Phone, Calendar, Link as LinkIcon, Check, Eye, AlertTriangle, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";

import EmployeeForm from "../components/employees/EmployeeForm";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);
  const [pinModal, setPinModal] = useState(null); // employee
  const [pinValue, setPinValue] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await Employee.list();
      setEmployees(data || []);
    } catch (err) {
      console.error("Error cargando empleados:", err);
      setEmployees([]);
    }
    setLoading(false);
  };

  const handleSubmit = async (employeeData) => {
    try {
      if (editingEmployee) {
        await Employee.update(editingEmployee.id, employeeData);
        alert('Empleado actualizado correctamente.');
      } else {
        await Employee.create(employeeData);
        alert('Empleado creado correctamente.');
      }
      setShowForm(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Error al guardar el empleado.");
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (employee) => {
    if (window.confirm(`¿Estás seguro de eliminar al empleado ${employee.name}?`)) {
      try {
        await Employee.delete(employee.id);
        loadEmployees();
      } catch (error) {
        console.error("Error deleting employee:", error);
        alert("Error al eliminar el empleado.");
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  const handleCopyLink = (employeeId) => {
    const portalUrl = `${window.location.origin}/Op_EmployeePortal?employee_id=${employeeId}`;
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(employeeId);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const openPinModal = (employee) => {
    setPinValue(employee.portal_pin || '');
    setPinModal(employee);
  };

  const handleSavePin = async () => {
    if (!pinModal) return;
    const pin = pinValue.trim();
    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      alert('El PIN debe ser numérico de 4 a 6 dígitos.');
      return;
    }
    setSavingPin(true);
    try {
      await Employee.update(pinModal.id, { portal_pin: pin || null });
      await loadEmployees();
      setPinModal(null);
    } catch (e) {
      alert('Error al guardar el PIN.');
    }
    setSavingPin(false);
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-slate-600">Cargando empleados...</p>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Empleados</h1>
            <p className="text-slate-600">Gestiona la información y el acceso de los empleados.</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Empleado
          </Button>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
          <p className="text-blue-800 font-medium mb-1">Portal de Empleados</p>
          <p className="text-blue-700 text-sm">
            Copia el enlace del portal para cada empleado y compártelo. Así podrán ver sus datos de producción.
          </p>
        </div>

        {employees.filter(e => e.is_active !== false && !e.phone).length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 font-semibold text-sm">
                  {employees.filter(e => e.is_active !== false && !e.phone).length} empleado{employees.filter(e => e.is_active !== false && !e.phone).length !== 1 ? 's' : ''} sin número de celular
                </p>
                <p className="text-amber-700 text-xs mt-0.5 mb-2">
                  El número es necesario para la lista de ruta del planillador. Edita cada uno para agregarlo.
                </p>
                <div className="flex flex-wrap gap-2">
                  {employees.filter(e => e.is_active !== false && !e.phone).map(e => (
                    <button
                      key={e.id}
                      onClick={() => { setEditingEmployee(e); setShowForm(true); }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-xs font-medium text-amber-800 transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <EmployeeForm
            employee={editingEmployee}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            existingEmployees={employees}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lista de Empleados ({employees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {employees.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {employees.map(employee => (
                  <Card key={employee.id} className="border-slate-200 hover:shadow-lg transition-shadow flex flex-col">
                    <CardContent className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg mb-1">{employee.name}</h3>
                          <p className="text-sm text-slate-600 font-medium">ID: {employee.employee_id}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="outline" onClick={() => handleEdit(employee)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => handleDelete(employee)} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {employee.position && <p className="text-sm text-slate-600"><strong>Cargo:</strong> {employee.position}</p>}
                        {employee.phone && <p className="text-sm text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {employee.phone}</p>}
                        {employee.hire_date && <p className="text-sm text-slate-600 flex items-center gap-1"><Calendar className="w-3 h-3" /> Contratado: {format(new Date(employee.hire_date), 'dd/MM/yyyy')}</p>}
                        {employee.salary_per_unit && <p className="text-sm text-green-600 font-medium">${employee.salary_per_unit.toLocaleString()} por unidad</p>}
                      </div>

                      <div className="flex gap-2 mt-4 flex-wrap">
                        <Badge className={employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {employee.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {!employee.phone && (
                          <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Sin celular
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <div className="p-4 bg-slate-50 border-t space-y-2">
                       <Button
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => window.location.href = createPageUrl(`EmployeeProfile?id=${employee.employee_id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2"/>
                        Ver Auditoría Contable
                      </Button>
                       <Button
                        size="sm"
                        className="w-full"
                        variant="ghost"
                        onClick={() => handleCopyLink(employee.employee_id)}
                      >
                        {copiedLink === employee.employee_id ? (
                          <><Check className="w-4 h-4 mr-2 text-green-500"/> Enlace Copiado</>
                        ) : (
                          <><LinkIcon className="w-4 h-4 mr-2"/> Copiar Enlace del Portal</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full"
                        variant="outline"
                        onClick={() => openPinModal(employee)}
                      >
                        <KeyRound className="w-4 h-4 mr-2"/>
                        {employee.portal_pin ? 'Cambiar PIN' : 'Asignar PIN'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p className="text-lg">No hay empleados registrados.</p>
                <p className="text-sm">Crea el primer empleado para comenzar.</p>
                <Button onClick={() => setShowForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Empleado
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Modal PIN */}

    {pinModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="font-bold text-slate-900">PIN del portal</h2>
              <p className="text-sm text-slate-500">{pinModal.name}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            El operario usará este PIN para acceder a su portal. Debe ser de 4 a 6 dígitos. Déjalo vacío para que no requiera PIN.
          </p>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej: 1234"
            value={pinValue}
            onChange={e => setPinValue(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPinModal(null)} disabled={savingPin}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSavePin} disabled={savingPin}>
              {savingPin ? 'Guardando...' : 'Guardar PIN'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}