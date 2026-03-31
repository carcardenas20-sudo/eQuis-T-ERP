import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, DollarSign, Calendar, AlertCircle, ChevronDown, ChevronUp, History } from "lucide-react";
import { format } from "date-fns";
import { PayablePayment } from "@/entities/PayablePayment";

export default function PayableList({ payables, locations, onEdit, onDelete, onPayment, onManageInstallments }) {
  const [expandedPayable, setExpandedPayable] = useState(null);
  const [paymentHistories, setPaymentHistories] = useState({});
  const [loadingHistories, setLoadingHistories] = useState({});

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || "N/A";
  };

  const loadPaymentHistory = async (payableId) => {
    if (paymentHistories[payableId]) {
      return; // Ya cargado
    }
    
    setLoadingHistories(prev => ({ ...prev, [payableId]: true }));
    try {
      const payments = await PayablePayment.filter({ payable_id: payableId });
      const sortedPayments = payments.sort((a, b) => 
        new Date(b.payment_date) - new Date(a.payment_date)
      );
      setPaymentHistories(prev => ({ ...prev, [payableId]: sortedPayments }));
    } catch (error) {
      console.error("Error loading payment history:", error);
      setPaymentHistories(prev => ({ ...prev, [payableId]: [] }));
    }
    setLoadingHistories(prev => ({ ...prev, [payableId]: false }));
  };

  const toggleExpand = async (payableId) => {
    if (expandedPayable === payableId) {
      setExpandedPayable(null);
    } else {
      setExpandedPayable(payableId);
      await loadPaymentHistory(payableId);
    }
  };

  const getMethodLabel = (method) => {
    const methods = {
      cash: "Efectivo",
      transfer: "Transferencia",
      check: "Cheque",
      card: "Tarjeta"
    };
    return methods[method] || method;
  };

  const getMethodColor = (method) => {
    const colors = {
      cash: "bg-green-100 text-green-800",
      transfer: "bg-blue-100 text-blue-800",
      check: "bg-purple-100 text-purple-800",
      card: "bg-orange-100 text-orange-800"
    };
    return colors[method] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status, dueDate) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== "paid";
    
    if (isOverdue) {
      return <Badge variant="destructive">Vencida</Badge>;
    }
    
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500">Pendiente</Badge>;
      case "partial":
        return <Badge className="bg-blue-500">Parcial</Badge>;
      case "paid":
        return <Badge className="bg-green-500">Pagada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    const types = {
      purchase: { label: "Compra", color: "bg-purple-100 text-purple-800" },
      recurring_expense: { label: "Gasto Recurrente", color: "bg-orange-100 text-orange-800" },
      other: { label: "Otro", color: "bg-gray-100 text-gray-800" }
    };
    
    const typeConfig = types[type] || types.other;
    
    return <Badge className={typeConfig.color}>{typeConfig.label}</Badge>;
  };

  if (payables.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          No hay cuentas por pagar en esta categoría
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {payables.map(payable => {
        const isOverdue = new Date(payable.due_date) < new Date() && payable.status !== "paid";
        const isExpanded = expandedPayable === payable.id;
        const payments = paymentHistories[payable.id] || [];
        const isLoadingHistory = loadingHistories[payable.id];
        const hasPayments = payable.paid_amount > 0;

        return (
          <Card key={payable.id} className={isOverdue ? "border-red-300" : ""}>
            <CardContent className="p-4 md:p-6">
              {/* Header: nombre + badges + acciones */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base md:text-lg leading-tight">{payable.supplier_name}</h3>
                    {getStatusBadge(payable.status, payable.due_date)}
                    {getTypeBadge(payable.type)}
                  </div>
                  <p className="text-slate-600 text-sm">{payable.description}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {payable.status !== "paid" && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => onPayment(payable)} className="gap-1 text-xs px-2">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Abonar</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { if (onManageInstallments) onManageInstallments(payable); }} className="gap-1 text-xs px-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cuotas</span>
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => onEdit(payable)} className="flex-1">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(payable.id)} className="flex-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Amounts grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-slate-500 text-xs">Total</p>
                  <p className="font-semibold">${payable.total_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Pagado</p>
                  <p className="font-semibold text-green-600">${payable.paid_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Pendiente</p>
                  <p className="font-semibold text-red-600">${payable.pending_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Fecha Límite</p>
                  <p className={`font-semibold text-sm ${isOverdue ? 'text-red-600' : ''}`}>
                    {format(new Date(payable.due_date), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>📍 {getLocationName(payable.location_id)}</span>
                {payable.invoice_number && <span>📄 {payable.invoice_number}</span>}
                <span>🏷️ {payable.category}</span>
              </div>

              {/* Historial de Pagos */}
              {hasPayments && (
                <div className="mt-4 border-t pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(payable.id)}
                    className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <History className="w-4 h-4" />
                    {isExpanded ? "Ocultar" : "Ver"} Historial de Pagos ({payments.length})
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {isLoadingHistory ? (
                        <p className="text-sm text-slate-500 py-4 text-center">Cargando historial...</p>
                      ) : payments.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4 text-center">No hay pagos registrados</p>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                          <h4 className="font-semibold text-sm text-slate-700 mb-2">Abonos Realizados</h4>
                          {payments.map((payment, idx) => (
                            <div key={payment.id} className="bg-white rounded-lg p-3 border border-slate-200">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-green-600">
                                      ${payment.amount?.toLocaleString()}
                                    </span>
                                    <Badge className={getMethodColor(payment.method)}>
                                      {getMethodLabel(payment.method)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    📅 {format(new Date(payment.payment_date), 'dd/MM/yyyy HH:mm')}
                                  </p>
                                </div>
                                <span className="text-xs text-slate-400">#{idx + 1}</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                {payment.reference && (
                                  <p className="text-slate-600"><span className="font-medium">Ref:</span> {payment.reference}</p>
                                )}
                                {payment.bank_account_id && (
                                  <p className="text-slate-600"><span className="font-medium">Cuenta:</span> {payment.bank_account_id}</p>
                                )}
                                <p className="text-slate-600"><span className="font-medium">Sucursal:</span> {getLocationName(payment.location_id)}</p>
                                {payment.notes && (
                                  <p className="text-slate-600 mt-1 pt-1 border-t"><span className="font-medium">Notas:</span> {payment.notes}</p>
                                )}
                                {payment.expense_id && (
                                  <p className="text-amber-600 text-xs mt-1">💰 Registrado como gasto en efectivo</p>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-slate-300 mt-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-slate-700">Total Abonado:</span>
                              <span className="font-bold text-green-600">${payable.paid_amount?.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}