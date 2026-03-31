
import React, { useState, useEffect, useCallback } from "react";
import { Employee, Delivery } from "@/api/entitiesProduccion";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Package, Calendar, Search, Factory } from "lucide-react";
import { format } from "date-fns";

export default function Empleado() {
  const [employeeId, setEmployeeId] = useState("");
  const [employee, setEmployee] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Wrap searchEmployee in useCallback to stabilize its reference for useEffect dependency
  const searchEmployee = useCallback(async (id = employeeId) => {
    if (!id.trim()) {
      alert("Por favor ingresa tu ID de empleado");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Buscar empleado por ID
      const allEmployees = await Employee.list();
      const foundEmployee = allEmployees.find(emp => emp.employee_id === id.trim());

      if (foundEmployee) {
        setEmployee(foundEmployee);
        
        // Cargar entregas del empleado
        const allDeliveries = await Delivery.list();
        const employeeDeliveries = allDeliveries.filter(del => del.employee_id === id.trim());
        setDeliveries(employeeDeliveries);

        // Cargar productos para referencias
        const allProducts = await base44.entities.Producto.list();
        setProducts((allProducts || []).filter(p => p.reference).map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra })));
      } else {
        setEmployee(null);
        setDeliveries([]);
        alert("No se encontró un empleado con ese ID");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al buscar los datos del empleado");
    }

    setLoading(false);
  }, [employeeId]); // Added employeeId as a dependency for useCallback

  useEffect(() => {
    // Verificar si hay un ID en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmployeeId = urlParams.get('employee_id');
    if (urlEmployeeId) {
      setEmployeeId(urlEmployeeId);
      searchEmployee(urlEmployeeId);
    }
  }, [searchEmployee]); // Added searchEmployee to the dependency array

  const getProductName = (reference) => {
    const product = products.find(p => p.reference === reference);
    return product ? product.name : reference;
  };

  const getTotalEarnings = () => {
    return deliveries
      .filter(d => d.status === 'pagado')
      .reduce((sum, d) => sum + (d.total_amount || 0), 0);
  };

  const getPendingEarnings = () => {
    return deliveries
      .filter(d => d.status === 'pendiente')
      .reduce((sum, d) => sum + (d.total_amount || 0), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <style>{`
        :root {
          --color-primary: #2563eb;
          --color-primary-hover: #1d4ed8;
          --color-secondary: #f8fafc;
          --color-accent: #f97316;
          --color-text: #0f172a;
          --color-text-muted: #64748b;
          --color-border: #e2e8f0;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Portal del Empleado</h1>
              <p className="text-sm text-slate-600">Producción eQuis-T</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {!employee && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Consultar Mis Datos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="Ingresa tu ID de empleado (ej: EMP001)"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchEmployee()}
                  className="flex-1"
                />
                <Button 
                  onClick={() => searchEmployee()}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
              {searched && !employee && (
                <p className="text-red-600 text-sm mt-3">
                  No se encontró información para este ID de empleado.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {employee && (
          <>
            {/* Información del empleado */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Mi Información
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{employee.name}</h3>
                    <p className="text-slate-600 mb-2">ID: {employee.employee_id}</p>
                    {employee.position && (
                      <p className="text-slate-600 mb-2">Cargo: {employee.position}</p>
                    )}
                    {employee.hire_date && (
                      <p className="text-slate-600 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Contratado desde: {format(new Date(employee.hire_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-green-600 mb-1">Total Ganado</p>
                      <p className="text-2xl font-bold text-green-700">
                        ${getTotalEarnings().toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-orange-600 mb-1">Pendiente por Pagar</p>
                      <p className="text-2xl font-bold text-orange-700">
                        ${getPendingEarnings().toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEmployee(null);
                      setDeliveries([]);
                      setEmployeeId("");
                      setSearched(false);
                    }}
                  >
                    Buscar Otro Empleado
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Historial de entregas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Mis Entregas ({deliveries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveries.length > 0 ? (
                  <div className="space-y-4">
                    {deliveries
                      .sort((a, b) => new Date(b.delivery_date) - new Date(a.delivery_date))
                      .map(delivery => (
                      <div key={delivery.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {getProductName(delivery.product_reference)}
                            </h3>
                            <p className="text-sm text-slate-600">
                              Ref: {delivery.product_reference}
                            </p>
                          </div>
                          <Badge className={delivery.status === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {delivery.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">Cantidad</p>
                            <p className="font-medium">{delivery.quantity} unidades</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Precio Unitario</p>
                            <p className="font-medium">${delivery.unit_price?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Total</p>
                            <p className="font-bold text-green-600">${delivery.total_amount?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Fecha</p>
                            <p className="font-medium">{format(new Date(delivery.delivery_date), 'dd/MM/yyyy')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No tienes entregas registradas aún.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
