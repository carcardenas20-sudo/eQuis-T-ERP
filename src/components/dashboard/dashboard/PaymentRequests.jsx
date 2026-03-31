import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BellRing, User, Calendar, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Payment, PaymentRequest } from '@/entities/all';

export default function PaymentRequests({ paymentRequests, onRefresh }) {
  const [processing, setProcessing] = useState(null); // id o 'all'

  const { totalRequested, pendingRequests } = useMemo(() => {
    const pending = paymentRequests
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(b.request_date) - new Date(a.request_date));
    const total = pending.reduce((sum, r) => sum + r.requested_amount, 0);
    return { totalRequested: total, pendingRequests: pending };
  }, [paymentRequests]);

  const colombiaToday = () =>
    new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).toISOString().split('T')[0];

  const approveRequest = async (req) => {
    await Payment.create({
      employee_id: req.employee_id,
      amount: req.requested_amount,
      payment_date: colombiaToday(),
      payment_type: 'avance',
      description: `Solicitud aprobada (${req.request_date})`,
      status: 'registrado',
    });
    await PaymentRequest.update(req.id, { status: 'approved', processed_date: colombiaToday() });
  };

  const handleApproveOne = async (req) => {
    setProcessing(req.id);
    await approveRequest(req);
    setProcessing(null);
    onRefresh();
  };

  const handleRejectOne = async (req) => {
    if (!confirm(`¿Rechazar solicitud de ${req.employee_name}?`)) return;
    setProcessing(req.id + '_reject');
    await PaymentRequest.update(req.id, { status: 'rejected', processed_date: colombiaToday() });
    setProcessing(null);
    onRefresh();
  };

  const handleApproveAll = async () => {
    if (!confirm(`¿Aprobar todas las ${pendingRequests.length} solicitudes y crear los pagos?`)) return;
    setProcessing('all');
    for (const req of pendingRequests) {
      await approveRequest(req);
    }
    setProcessing(null);
    onRefresh();
  };

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-indigo-600" />
            Solicitudes de Pago Pendientes
          </CardTitle>
          {pendingRequests.length > 1 && (
            <Button
              size="sm"
              onClick={handleApproveAll}
              disabled={processing === 'all'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
            >
              {processing === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Aprobar todas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold text-indigo-700">${totalRequested.toLocaleString()}</p>
        <p className="text-sm text-slate-500 mb-4">
          Total solicitado · {pendingRequests.length} solicitud{pendingRequests.length !== 1 ? 'es' : ''} pendiente{pendingRequests.length !== 1 ? 's' : ''}
        </p>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {pendingRequests.length > 0 ? (
            pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-md gap-2">
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 font-medium"><User className="w-4 h-4 text-slate-500 shrink-0"/>{req.employee_name}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 pl-6">
                    <Calendar className="w-3 h-3"/> {format(new Date(req.request_date), 'dd/MM/yy')} <Clock className="w-3 h-3 ml-1"/> {req.request_time}
                  </span>
                </div>
                <span className="font-bold text-indigo-800 shrink-0">${req.requested_amount.toLocaleString()}</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleApproveOne(req)}
                    disabled={!!processing}
                    title="Aprobar"
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40"
                  >
                    {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRejectOne(req)}
                    disabled={!!processing}
                    title="Rechazar"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40"
                  >
                    {processing === req.id + '_reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No hay solicitudes de pago pendientes.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}