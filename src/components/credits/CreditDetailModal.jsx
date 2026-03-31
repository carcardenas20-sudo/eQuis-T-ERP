import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, User, Calendar, DollarSign, FileText, X, History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import MobilePageHeader from "../layout/MobilePageHeader";
import { Payment } from "@/entities/Payment";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800", 
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800"
};

const statusLabels = {
  pending: "Pendiente",
  partial: "Pago Parcial",
  paid: "Pagado",
  overdue: "Vencido"
};

export default function CreditDetailModal({ credit, onClose }) {
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const paymentProgress = ((credit.total_amount - credit.pending_amount) / credit.total_amount) * 100;

  useEffect(() => {
    loadPaymentHistory();
  }, [credit.id]);

  const loadPaymentHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const payments = await Payment.filter({ credit_id: credit.id });
      const sortedPayments = payments.sort((a, b) => 
        new Date(b.payment_date) - new Date(a.payment_date)
      );
      setPaymentHistory(sortedPayments);
    } catch (error) {
      console.error("Error loading payment history:", error);
      setPaymentHistory([]);
    }
    setIsLoadingHistory(false);
  };

  const getMethodLabel = (method) => {
    const methods = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      qr: "QR",
      other: "Otro"
    };
    return methods[method] || method;
  };

  const getMethodColor = (method) => {
    const colors = {
      cash: "bg-green-100 text-green-800",
      card: "bg-purple-100 text-purple-800",
      transfer: "bg-blue-100 text-blue-800",
      qr: "bg-orange-100 text-orange-800",
      other: "bg-gray-100 text-gray-800"
    };
    return colors[method] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl dark:bg-slate-900 dark:border-slate-700">
        <MobilePageHeader 
          title={`Crédito #${credit.sale_id?.slice(-8)}`}
          showBack={true}
          onBack={onClose}
        />
        <DialogHeader className="hidden lg:flex">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="w-6 h-6 text-blue-600 select-none" />
            Detalle de Crédito #{credit.sale_id?.slice(-8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Credit Status and Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>Cliente</span>
              </div>
              <div>
                <p className="font-semibold text-lg">{credit.customer_name}</p>
                <p className="text-sm text-slate-500">{credit.customer_phone}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Estado del Crédito</span>
              </div>
              <div>
                <Badge className={`${statusColors[credit.status]} text-base px-3 py-1`}>
                  {statusLabels[credit.status]}
                </Badge>
                <p className="text-sm text-slate-500 mt-1">
                  Vence: {format(new Date(credit.due_date), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Progreso de Pago</h3>
              <span className="text-sm text-slate-600">{Math.round(paymentProgress)}% pagado</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${paymentProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Total Crédito</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                ${(credit.total_amount || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Pagado</span>
              </div>
              <p className="text-2xl font-bold text-green-900">
                ${((credit.total_amount || 0) - (credit.pending_amount || 0)).toLocaleString()}
              </p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Pendiente</span>
              </div>
              <p className="text-2xl font-bold text-orange-900">
                ${(credit.pending_amount || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Sale Information */}
          {credit.sale && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Información de la Venta
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Fecha de Venta:</span>
                  <span className="font-medium">
                    {format(new Date(credit.sale.created_date), "dd/MM/yyyy HH:mm", { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Número de Factura:</span>
                  <span className="font-medium font-mono">
                    #{credit.sale.invoice_number || credit.sale_id?.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total de la Venta:</span>
                  <span className="font-semibold text-green-600">
                    ${(credit.sale.total_amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Historial de Pagos
            </h3>
            
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="bg-slate-50 p-8 rounded-lg text-center">
                <p className="text-slate-500">No hay pagos registrados aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment, idx) => (
                  <div key={payment.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl font-bold text-green-600">
                            ${payment.amount?.toLocaleString()}
                          </span>
                          <Badge className={getMethodColor(payment.method)}>
                            {getMethodLabel(payment.method)}
                          </Badge>
                          {payment.discount_amount > 0 && (
                            <Badge className="bg-red-100 text-red-800">Descuento -${payment.discount_amount?.toLocaleString()}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          📅 {format(new Date(payment.payment_date), "dd 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-200 px-2 py-1 rounded">
                        Pago #{paymentHistory.length - idx}
                      </span>
                    </div>
                    
                    {payment.discount_amount > 0 && (
                      <div className="mt-2">
                        <Badge className="bg-red-100 text-red-800">Descuento</Badge>
                        <span className="ml-2 text-sm text-red-700">-${payment.discount_amount?.toLocaleString()}</span>
                        {payment.discount_reason && (
                          <p className="text-xs text-slate-600 mt-1">
                            <span className="font-medium">Motivo:</span> {payment.discount_reason}
                          </p>
                        )}
                      </div>
                    )}

                    {payment.reference && (
                      <div className="mt-2 pt-2 border-t border-slate-300">
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Referencia:</span> {payment.reference}
                        </p>
                      </div>
                    )}
                    
                    {payment.bank_account_id && (
                      <div className="mt-1">
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Cuenta bancaria:</span> {payment.bank_account_id}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="mt-4 pt-4 border-t-2 border-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Total Pagado:</span>
                    <span className="text-2xl font-bold text-green-600">
                      ${(credit.paid_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-slate-600">Pendiente:</span>
                    <span className="text-lg font-semibold text-orange-600">
                      ${(credit.pending_amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {credit.notes && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-slate-900 mb-2">Notas</h3>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-slate-700">{credit.notes}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="select-none">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}