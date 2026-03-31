import React, { useState, useEffect } from "react";
import { Compra, Factura, Pago, Proveedor, MateriaPrima } from "@/api/entitiesChaquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ShoppingCart, FileText, CreditCard, AlertCircle, DollarSign, Building } from "lucide-react";

import FormularioCompra from "../components/compras/FormularioCompra";
import FormularioFactura from "../components/compras/FormularioFactura";
import FormularioPago from "../components/compras/FormularioPago";
import TarjetaCompra from "../components/compras/TarjetaCompra";
import TarjetaFactura from "../components/compras/TarjetaFactura";
import TarjetaPago from "../components/compras/TarjetaPago";
import EstadoCuentaProveedor from "../components/compras/EstadoCuentaProveedor";

export default function Compras() {
  const [compras, setCompras] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("compras");
  
  // Modal states
  const [showFormCompra, setShowFormCompra] = useState(false);
  const [showFormFactura, setShowFormFactura] = useState(false);
  const [showFormPago, setShowFormPago] = useState(false);
  const [showEstadoCuenta, setShowEstadoCuenta] = useState(false);
  
  // Edit states
  const [editingCompra, setEditingCompra] = useState(null);
  const [editingFactura, setEditingFactura] = useState(null);
  const [editingPago, setEditingPago] = useState(null);
  const [proveedorEstadoCuenta, setProveedorEstadoCuenta] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [comprasData, facturasData, pagosData, proveedoresData, materiasData] = await Promise.all([
        Compra.list("-created_date"),
        Factura.list("-created_date"),
        Pago.list("-created_date"),
        Proveedor.list(),
        MateriaPrima.list()
      ]);
      
      setCompras(comprasData);
      setFacturas(facturasData);
      setPagos(pagosData);
      setProveedores(proveedoresData);
      setMateriasPrimas(materiasData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar los datos');
    }
    setIsLoading(false);
  };

  const handleSubmitCompra = async (data) => {
    try {
      if (editingCompra) {
        await Compra.update(editingCompra.id, data);
      } else {
        await Compra.create(data);
      }
      setShowFormCompra(false);
      setEditingCompra(null);
      loadData();
      alert(editingCompra ? 'Compra actualizada' : 'Compra creada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la compra');
    }
  };

  const handleSubmitFactura = async (data) => {
    try {
      if (editingFactura) {
        await Factura.update(editingFactura.id, data);
      } else {
        await Factura.create(data);
      }
      setShowFormFactura(false);
      setEditingFactura(null);
      loadData();
      alert(editingFactura ? 'Factura actualizada' : 'Factura registrada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la factura');
    }
  };

  const handleSubmitPago = async (data) => {
    try {
      if (editingPago) {
        await Pago.update(editingPago.id, data);
      } else {
        // Crear el pago
        await Pago.create(data);
        
        // Actualizar el saldo de la factura
        const factura = facturas.find(f => f.id === data.factura_id);
        if (factura) {
          const nuevoSaldo = factura.saldo_pendiente - data.monto;
          const nuevoEstado = nuevoSaldo <= 0 ? 'pagada_total' : 
                            nuevoSaldo < factura.total ? 'pagada_parcial' : 'pendiente';
          
          await Factura.update(factura.id, {
            ...factura,
            saldo_pendiente: Math.max(0, nuevoSaldo),
            estado: nuevoEstado
          });
        }
      }
      setShowFormPago(false);
      setEditingPago(null);
      loadData();
      alert(editingPago ? 'Pago actualizado' : 'Pago registrado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar el pago');
    }
  };

  const handleDelete = async (tipo, id) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    
    try {
      if (tipo === 'compra') {
        await Compra.delete(id);
      } else if (tipo === 'factura') {
        await Factura.delete(id);
      } else if (tipo === 'pago') {
        await Pago.delete(id);
      }
      loadData();
      alert('Registro eliminado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar el registro');
    }
  };

  const filteredCompras = compras.filter(c => 
    c.numero_orden.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFacturas = facturas.filter(f => 
    f.numero_factura.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPagos = pagos.filter(p => 
    p.numero_comprobante.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Estadísticas
  const totalPorPagar = facturas.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0);
  const facturasVencidas = facturas.filter(f => 
    f.estado !== 'pagada_total' && 
    new Date(f.fecha_vencimiento) < new Date()
  ).length;
  const comprasPendientes = compras.filter(c => ['enviada', 'confirmada'].includes(c.estado)).length;

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-slate-900">Gestión de Compras</h1>
          <p className="text-xs sm:text-sm text-slate-600">Administra compras, facturas y pagos</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Por Pagar</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${totalPorPagar.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Facturas Vencidas</p>
                  <p className="text-2xl font-bold text-orange-600">{facturasVencidas}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Compras Pendientes</p>
                  <p className="text-2xl font-bold text-blue-600">{comprasPendientes}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Proveedores</p>
                  <p className="text-2xl font-bold text-slate-900">{proveedores.length}</p>
                </div>
                <Building className="w-8 h-8 text-slate-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-white border-slate-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por número de orden, factura o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8 gap-1 bg-slate-100 p-1 h-auto">
            <TabsTrigger value="compras" className="flex items-center justify-center gap-1 text-xs sm:text-sm py-2">
              <ShoppingCart className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Compras</span>
              <span className="sm:hidden">Órdenes</span>
            </TabsTrigger>
            <TabsTrigger value="facturas" className="flex items-center justify-center gap-1 text-xs sm:text-sm py-2">
              <FileText className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Facturas</span>
              <span className="sm:hidden">Fact.</span>
            </TabsTrigger>
            <TabsTrigger value="pagos" className="flex items-center justify-center gap-1 text-xs sm:text-sm py-2">
              <CreditCard className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Pagos</span>
              <span className="sm:hidden">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="estados" className="flex items-center justify-center gap-1 text-xs sm:text-sm py-2">
              <Building className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Estados</span>
              <span className="sm:hidden">Est.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compras">
            <div className="flex flex-col gap-3 sm:gap-4 mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Órdenes de Compra</h2>
              <Button 
                onClick={() => setShowFormCompra(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-sm sm:text-base"
              >
                <Plus className="w-3 sm:w-4 h-3 sm:h-4 mr-2" />
                Nueva Compra
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded"></div>
                        <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredCompras.length === 0 ? (
                <div className="col-span-full text-center py-16">
                  <ShoppingCart className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">
                    No hay órdenes de compra
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchTerm ? "Intenta ajustar tu búsqueda" : "Crea tu primera orden de compra"}
                  </p>
                </div>
              ) : (
                filteredCompras.map((compra) => (
                  <TarjetaCompra
                    key={compra.id}
                    compra={compra}
                    onEdit={(compra) => {
                      setEditingCompra(compra);
                      setShowFormCompra(true);
                    }}
                    onDelete={(id) => handleDelete('compra', id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="facturas">
            <div className="flex flex-col gap-3 sm:gap-4 mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Facturas por Pagar</h2>
              <Button 
                onClick={() => setShowFormFactura(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-sm sm:text-base"
              >
                <Plus className="w-3 sm:w-4 h-3 sm:h-4 mr-2" />
                Registrar Factura
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded"></div>
                        <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredFacturas.length === 0 ? (
                <div className="col-span-full text-center py-16">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">
                    No hay facturas registradas
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchTerm ? "Intenta ajustar tu búsqueda" : "Registra tu primera factura"}
                  </p>
                </div>
              ) : (
                filteredFacturas.map((factura) => (
                  <TarjetaFactura
                    key={factura.id}
                    factura={factura}
                    onEdit={(factura) => {
                      setEditingFactura(factura);
                      setShowFormFactura(true);
                    }}
                    onDelete={(id) => handleDelete('factura', id)}
                    onPagar={(factura) => {
                      setEditingFactura(factura);
                      setShowFormPago(true);
                    }}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="pagos">
            <div className="flex flex-col gap-3 sm:gap-4 mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Registro de Pagos</h2>
              <Button 
                onClick={() => setShowFormPago(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-sm sm:text-base"
              >
                <Plus className="w-3 sm:w-4 h-3 sm:h-4 mr-2" />
                Registrar Pago
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded"></div>
                        <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredPagos.length === 0 ? (
                <div className="col-span-full text-center py-16">
                  <CreditCard className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">
                    No hay pagos registrados
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchTerm ? "Intenta ajustar tu búsqueda" : "Registra tu primer pago"}
                  </p>
                </div>
              ) : (
                filteredPagos.map((pago) => (
                  <TarjetaPago
                    key={pago.id}
                    pago={pago}
                    onEdit={(pago) => {
                      setEditingPago(pago);
                      setShowFormPago(true);
                    }}
                    onDelete={(id) => handleDelete('pago', id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="estados">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold">Estados de Cuenta por Proveedor</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proveedores.map((proveedor) => {
                const facturasProveedor = facturas.filter(f => f.proveedor_id === proveedor.id);
                const totalDeuda = facturasProveedor.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0);
                
                if (totalDeuda === 0 && facturasProveedor.length === 0) return null;

                return (
                  <Card key={proveedor.id} className="bg-white border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
                    onClick={() => {
                      setProveedorEstadoCuenta(proveedor);
                      setShowEstadoCuenta(true);
                    }}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{proveedor.nombre}</span>
                        <Badge className={totalDeuda > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                          ${totalDeuda.toFixed(2)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Facturas:</span>
                          <div className="font-semibold">{facturasProveedor.length}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Pendientes:</span>
                          <div className="font-semibold">
                            {facturasProveedor.filter(f => f.estado !== 'pagada_total').length}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        {showFormCompra && (
          <FormularioCompra
            compra={editingCompra}
            proveedores={proveedores}
            materiasPrimas={materiasPrimas}
            onSubmit={handleSubmitCompra}
            onCancel={() => {
              setShowFormCompra(false);
              setEditingCompra(null);
            }}
          />
        )}

        {showFormFactura && (
          <FormularioFactura
            factura={editingFactura}
            compras={compras}
            proveedores={proveedores}
            onSubmit={handleSubmitFactura}
            onCancel={() => {
              setShowFormFactura(false);
              setEditingFactura(null);
            }}
          />
        )}

        {showFormPago && (
          <FormularioPago
            pago={editingPago}
            factura={editingFactura} // Si viene desde una factura específica
            facturas={facturas}
            onSubmit={handleSubmitPago}
            onCancel={() => {
              setShowFormPago(false);
              setEditingPago(null);
              setEditingFactura(null);
            }}
          />
        )}

        {showEstadoCuenta && proveedorEstadoCuenta && (
          <EstadoCuentaProveedor
            proveedor={proveedorEstadoCuenta}
            facturas={facturas.filter(f => f.proveedor_id === proveedorEstadoCuenta.id)}
            pagos={pagos.filter(p => p.proveedor_id === proveedorEstadoCuenta.id)}
            onClose={() => {
              setShowEstadoCuenta(false);
              setProveedorEstadoCuenta(null);
            }}
          />
        )}
      </div>
    </div>
  );
}