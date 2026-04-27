import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TruckIcon, PackageCheck, DollarSign, ShoppingBag, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeTimeline({ dispatches, deliveries, payments, purchases = [], getProductName, pendingAmount }) {
  // Construir mapa de pagos por entrega
  const deliveryPaymentsMap = {};
  payments.forEach(payment => {
    if (payment.delivery_payments) {
      payment.delivery_payments.forEach(dp => {
        if (!deliveryPaymentsMap[dp.delivery_id]) {
          deliveryPaymentsMap[dp.delivery_id] = [];
        }
        deliveryPaymentsMap[dp.delivery_id].push({
          amount: dp.amount,
          date: payment.payment_date,
          total: payment.amount
        });
      });
    }
  });

  // Reconstruir cantidades de despachos consumidos por compras internas
  const purchasedQtyByProduct = {};
  purchases.forEach(p => {
    p.items?.forEach(item => {
      purchasedQtyByProduct[item.product_reference] = (purchasedQtyByProduct[item.product_reference] || 0) + item.quantity;
    });
  });

  const timelineEvents = [];

  // Agregar despachos
  dispatches.forEach(dispatch => {
    const wasDiscounted = dispatch.status === 'entregado' && dispatch.quantity === 0;
    const isTraslado = !!(dispatch.observations && dispatch.observations.includes('[TRASLADO]'));
    const displayQty = wasDiscounted ? (purchasedQtyByProduct[dispatch.product_reference] || 0) : dispatch.quantity;
    const origenMatch = isTraslado ? dispatch.observations.match(/Recibido de ([^—\n]+)/) : null;
    const origen = origenMatch ? origenMatch[1].trim() : '';

    timelineEvents.push({
      type: 'dispatch',
      date: dispatch.dispatch_date,
      data: dispatch,
      title: isTraslado
        ? `Despacho recibido por traslado: ${getProductName(dispatch.product_reference)}`
        : `Material Asignado: ${getProductName(dispatch.product_reference)}`,
      subtitle: `${displayQty} unidades${origen ? ` · de ${origen}` : ''}`,
      wasDiscounted,
      isTraslado,
      icon: isTraslado ? ArrowRightLeft : TruckIcon,
      color: wasDiscounted ? 'orange' : isTraslado ? 'indigo' : 'blue'
    });
  });

  // Agregar entregas
  deliveries.forEach(delivery => {
    // Traslados
    if (delivery.status === 'traslado' || delivery.notes?.includes('[TRASLADO]')) {
      const notes = delivery.notes || '';
      const destinoMatch = notes.match(/Transferido a ([^—\n]+)/);
      const destino = destinoMatch ? destinoMatch[1].trim() : '';
      const detalle = notes.replace(/\[TRASLADO\][^—\n]*/, '').replace(/^[\s—]+/, '').trim();
      const itemsInfo = delivery.items?.length > 0
        ? delivery.items.map(i => `${getProductName(i.product_reference)} (${i.quantity} uds)`).join(', ')
        : '';

      timelineEvents.push({
        type: 'traslado',
        date: delivery.delivery_date,
        data: delivery,
        title: 'Despacho trasladado',
        subtitle: itemsInfo,
        destino,
        detalle,
        icon: ArrowRightLeft,
        color: 'indigo',
      });
      return;
    }

    // Bajas de prenda
    if (delivery.status === 'baja' || delivery.notes?.includes('[BAJA]')) {
      const notes = delivery.notes || '';
      const motivoMatch = notes.match(/Motivo: ([^—\n]+)/);
      const motivo = motivoMatch ? motivoMatch[1].trim() : '';
      const detalle = notes.replace(/\[BAJA\]\s*Motivo:[^—\n]*/, '').replace(/^[\s—]+/, '').trim();
      const itemsInfo = delivery.items?.length > 0
        ? delivery.items.map(i => `${getProductName(i.product_reference)} (${i.quantity} uds)`).join(', ')
        : delivery.product_reference ? `${getProductName(delivery.product_reference)} (${delivery.quantity} uds)` : '';

      timelineEvents.push({
        type: 'baja',
        date: delivery.delivery_date,
        data: delivery,
        title: 'Prenda dada de baja',
        subtitle: itemsInfo,
        motivo,
        detalle,
        icon: AlertTriangle,
        color: 'red',
      });
      return;
    }

    const isFromPurchase = !!(delivery.notes && delivery.notes.includes('Compra empleado'));
    const paymentsForDelivery = deliveryPaymentsMap[delivery.id] || [];
    const totalPaid = paymentsForDelivery.reduce((sum, p) => sum + p.amount, 0);
    const isPaid = isFromPurchase || totalPaid >= delivery.total_amount || delivery.status === 'pagado';

    let title, subtitle;
    if (delivery.items && delivery.items.length > 0) {
      if (delivery.items.length === 1) {
        title = isFromPurchase
          ? `Entrega por Compra Interna: ${getProductName(delivery.items[0].product_reference)}`
          : `Producto Entregado: ${getProductName(delivery.items[0].product_reference)}`;
        subtitle = `${delivery.items[0].quantity} unidades · $${delivery.total_amount.toLocaleString()}`;
      } else {
        title = isFromPurchase ? `Entrega por Compra Interna` : `${delivery.items.length} Productos Entregados`;
        subtitle = delivery.items.map(i => `${getProductName(i.product_reference)} (${i.quantity})`).join(', ') + ` · Total: $${delivery.total_amount.toLocaleString()}`;
      }
    } else {
      title = isFromPurchase
        ? `Entrega por Compra Interna: ${getProductName(delivery.product_reference)}`
        : `Producto Entregado: ${getProductName(delivery.product_reference)}`;
      subtitle = `${delivery.quantity} unidades · $${delivery.total_amount.toLocaleString()}`;
    }

    timelineEvents.push({
      type: 'delivery',
      date: delivery.delivery_date,
      data: delivery,
      title,
      subtitle,
      isFromPurchase,
      icon: PackageCheck,
      color: isFromPurchase ? 'orange' : (isPaid ? 'green' : 'orange'),
      paymentsForDelivery,
      totalPaid
    });
  });

  // Agregar pagos
  payments.forEach(payment => {
    timelineEvents.push({
      type: 'payment',
      date: payment.payment_date,
      data: payment,
      title: `Pago Recibido`,
      subtitle: `$${payment.amount.toLocaleString()} - ${payment.payment_type === 'pago_completo' ? 'Pago Completo' : 'Avance'}`,
      icon: DollarSign,
      color: 'green'
    });
  });

  // Agregar compras de empleado
  purchases.forEach(purchase => {
    const payMethodLabel = purchase.payment_method === 'descuento_saldo' ? 'Descuento de saldo' : purchase.payment_method === 'contado' ? 'Contado' : 'A crédito';
    const itemsSummary = purchase.items?.map(i => `${i.product_name || getProductName(i.product_reference)} (${i.quantity})`).join(', ') || '';
    timelineEvents.push({
      type: 'purchase',
      date: purchase.purchase_date,
      data: purchase,
      title: `Compra de Prenda — ${payMethodLabel}`,
      subtitle: `${itemsSummary} · Total: $${purchase.total_amount?.toLocaleString()}`,
      icon: ShoppingBag,
      color: 'purple'
    });
  });

  // Ordenar por fecha (más reciente primero)
  timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

  const getColorClasses2 = (color) => {
    if (color === 'purple') return 'bg-pink-100 text-pink-600 border-pink-200';
    return getColorClasses(color);
  };

  const getColorClasses = (color) => {
    switch (color) {
      case 'blue': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'green': return 'bg-green-100 text-green-600 border-green-200';
      case 'orange': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'red': return 'bg-red-100 text-red-600 border-red-200';
      case 'indigo': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Línea de Tiempo de Actividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timelineEvents.length > 0 ? (
          <div className="space-y-4">
            {timelineEvents.map((event, index) => (
              <div key={index} className="flex items-start gap-4">
              <div className={`p-2 rounded-lg border ${event.color === 'purple' ? getColorClasses2(event.color) : getColorClasses(event.color)}`}>
                  <event.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">{event.title}</h4>
                    <span className="text-xs text-slate-500">
                      {format(new Date(event.date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{event.subtitle}</p>
                  {event.type === 'traslado' && (
                    <div className="mt-1 space-y-1">
                      <Badge className="bg-indigo-100 text-indigo-800">
                        ↗ Trasladado{event.destino ? ` a ${event.destino}` : ''}
                      </Badge>
                      {event.detalle && (
                        <p className="text-xs text-slate-500">{event.detalle}</p>
                      )}
                    </div>
                  )}
                  {event.type === 'baja' && (
                    <div className="mt-1 space-y-1">
                      <Badge className="bg-red-100 text-red-800">
                        ⚠️ Baja — {event.motivo || 'Sin motivo registrado'}
                      </Badge>
                      {event.detalle && (
                        <p className="text-xs text-slate-500">{event.detalle}</p>
                      )}
                    </div>
                  )}
                  {event.type === 'delivery' && (
                    <>
                      <Badge 
                        className={`mt-1 ${event.isFromPurchase ? 'bg-pink-100 text-pink-800' : event.color === 'green' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}
                      >
                        {event.isFromPurchase ? '🛍️ Compra interna — manufactura acreditada' : event.color === 'green' ? 'Pagado' : 'Pendiente de Pago'}
                      </Badge>
                      {event.paymentsForDelivery && event.paymentsForDelivery.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {event.paymentsForDelivery.map((p, idx) => (
                            <p key={idx} className="text-xs text-green-700">
                              Pagado ${p.amount.toLocaleString()} el {format(new Date(p.date), 'dd/MM/yyyy')} (pago total: ${p.total.toLocaleString()})
                            </p>
                          ))}
                          {event.totalPaid < event.data.total_amount && (
                            <p className="text-xs text-orange-600 font-medium">
                              Pendiente: ${(event.data.total_amount - event.totalPaid).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {event.type === 'dispatch' && event.wasDiscounted && (
                    <Badge className="mt-1 bg-orange-100 text-orange-800">🛍️ Descontado por compra interna</Badge>
                  )}
                  {event.type === 'dispatch' && event.isTraslado && (
                    <Badge className="mt-1 bg-indigo-100 text-indigo-800">↙ Recibido por traslado</Badge>
                  )}
                  {event.type === 'payment' && event.data.description && (
                    <p className="text-xs text-slate-500 mt-1">{event.data.description}</p>
                  )}
                  {event.type === 'purchase' && (
                    <Badge className={`mt-1 ${event.data.payment_method === 'descuento_saldo' ? 'bg-red-100 text-red-800' : event.data.payment_method === 'credito' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'}`}>
                      {event.data.payment_method === 'descuento_saldo' ? '−Descuento de saldo' : event.data.payment_method === 'credito' ? 'A crédito' : 'Contado'}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No hay actividades registradas para este empleado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}