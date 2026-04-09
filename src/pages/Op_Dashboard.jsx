import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Combined";
import { LayoutDashboard, BellRing, BellOff } from "lucide-react";

import DeliveredUnits from "../components/dashboard/DeliveredUnits";
import PendingPayments from "../components/dashboard/PendingPayments";
import PendingDeliveriesByEmployee from "../components/dashboard/PendingDeliveriesByEmployee";
import AvailableForDispatch from "../components/dashboard/AvailableForDispatch";
import PaymentRequests from "../components/dashboard/PaymentRequests";
import EmployeeAuditSummary from "../components/dashboard/EmployeeAuditSummary";
import ProductionStats from "../components/dashboard/ProductionStats";
import OverdueDeliveries from "../components/dashboard/OverdueDeliveries";

export default function Dashboard() {
  const [data, setData] = useState({
    employees: [],
    products: [],
    deliveries: [],
    dispatches: [],
    inventory: [],
    payments: [],
    paymentRequests: [],
    purchases: [],
  });
  const [loading, setLoading] = useState(true);
  const [paymentWindow, setPaymentWindow] = useState(null); // null | Date
  const [paymentWindowLoading, setPaymentWindowLoading] = useState(false);

  useEffect(() => {
    loadData();
    loadPaymentWindow();
  }, []);

  const loadPaymentWindow = async () => {
    const configs = await base44.entities.AppConfig.filter({ key: "payment_window_opened_at" });
    if (configs.length > 0 && configs[0].value) {
      const openedAt = new Date(configs[0].value);
      const diffHours = (new Date() - openedAt) / (1000 * 60 * 60);
      setPaymentWindow(diffHours < 5 ? openedAt : null);
    }
  };

  const handleOpenPaymentWindow = async () => {
    setPaymentWindowLoading(true);
    const now = new Date().toISOString();
    const configs = await base44.entities.AppConfig.filter({ key: "payment_window_opened_at" });
    if (configs.length > 0) {
      await base44.entities.AppConfig.update(configs[0].id, { value: now });
    } else {
      await base44.entities.AppConfig.create({ key: "payment_window_opened_at", value: now });
    }
    setPaymentWindow(new Date(now));
    setPaymentWindowLoading(false);
  };

  const handleClosePaymentWindow = async () => {
    setPaymentWindowLoading(true);
    const configs = await base44.entities.AppConfig.filter({ key: "payment_window_opened_at" });
    if (configs.length > 0) {
      await base44.entities.AppConfig.update(configs[0].id, { value: "" });
    }
    setPaymentWindow(null);
    setPaymentWindowLoading(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        base44.entities.Employee.list(),
        base44.entities.Producto.list(),
        base44.entities.Delivery.list(),
        base44.entities.Dispatch.list(),
        base44.entities.Inventory.list(),
        base44.entities.Payment.list(),
        base44.entities.PaymentRequest.list(),
        base44.entities.EmployeePurchase.list(),
      ]);
      
      const rawProductos = results[1].status === 'fulfilled' ? results[1].value : [];
      const normProductos = rawProductos.map(p => ({ ...p, name: p.nombre, is_active: true, manufacturing_price: p.costo_mano_obra }));

      setData({
        employees: results[0].status === 'fulfilled' ? results[0].value : [],
        products: normProductos,
        deliveries: results[2].status === 'fulfilled' ? results[2].value : [],
        dispatches: results[3].status === 'fulfilled' ? results[3].value : [],
        inventory: results[4].status === 'fulfilled' ? results[4].value : [],
        payments: results[5].status === 'fulfilled' ? results[5].value : [],
        paymentRequests: results[6].status === 'fulfilled' ? results[6].value : [],
        purchases: results[7].status === 'fulfilled' ? results[7].value : [],
      });
    } catch (err) {
      console.error("Error cargando datos del dashboard:", err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-slate-600">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7" />
            Dashboard Principal
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-slate-600">Resumen operativo de la producción.</p>
            {paymentWindow ? (
              <button
                onClick={handleClosePaymentWindow}
                disabled={paymentWindowLoading}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <BellOff className="w-4 h-4" />
                Cerrar ventana de pagos
              </button>
            ) : (
              <button
                onClick={handleOpenPaymentWindow}
                disabled={paymentWindowLoading}
                className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <BellRing className="w-4 h-4" />
                Abrir ventana de pagos (5h)
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <DeliveredUnits deliveries={data.deliveries} />
            <PaymentRequests paymentRequests={data.paymentRequests} onRefresh={loadData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PendingDeliveriesByEmployee 
            employees={data.employees}
            products={data.products}
            deliveries={data.deliveries}
            dispatches={data.dispatches}
          />
          <AvailableForDispatch
            dispatches={data.dispatches}
            products={data.products}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PendingPayments employees={data.employees} deliveries={data.deliveries} payments={data.payments} purchases={data.purchases} />
          <EmployeeAuditSummary 
            employees={data.employees}
            deliveries={data.deliveries}
            dispatches={data.dispatches}
            payments={data.payments}
            products={data.products}
            purchases={data.purchases}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <OverdueDeliveries
            employees={data.employees}
            dispatches={data.dispatches}
            deliveries={data.deliveries}
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <ProductionStats
            employees={data.employees}
            deliveries={data.deliveries}
            dispatches={data.dispatches}
          />
        </div>
      </div>
    </div>
  );
}