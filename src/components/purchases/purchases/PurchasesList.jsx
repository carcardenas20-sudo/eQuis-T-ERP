import React, { useState } from "react";
import { base44 } from "@/api/base44Combined";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, CreditCard, Trash2 } from "lucide-react";

const paymentLabels = {
  descuento_saldo: { label: "Descuento saldo", color: "bg-blue-100 text-blue-700" },
  contado: { label: "Contado", color: "bg-green-100 text-green-700" },
  credito: { label: "Crédito", color: "bg-orange-100 text-orange-700" }
};

export default function PurchasesList({ purchases, empName, onRefresh, onDelete }) {
  const [expanded, setExpanded] = useState(null);
  const [creditPayment, setCreditPayment] = useState({});

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  const handleCreditPayment = async (purchase) => {
    const amount = parseFloat(creditPayment[purchase.id] || 0);
    if (!amount || amount <= 0) return;
    const newPaid = (purchase.credit_paid_amount || 0) + amount;
    const newStatus = newPaid >= purchase.total_amount ? 'pagado' : 'pendiente';
    await base44.entities.EmployeePurchase.update(purchase.id, {
      credit_paid_amount: Math.min(newPaid, purchase.total_amount),
      credit_status: newStatus
    });
    setCreditPayment(prev => ({ ...prev, [purchase.id]: "" }));
    onRefresh();
  };

  if (purchases.length === 0) {
    return (
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="p-10 text-center text-slate-400 text-sm">No hay compras registradas.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {purchases.map(p => {
        const info = paymentLabels[p.payment_method] || {};
        const creditPending = p.payment_method === 'credito' ? (p.total_amount - (p.credit_paid_amount || 0)) : 0;
        const isOpen = expanded === p.id;

        return (
          <Card key={p.id} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
              onClick={() => toggle(p.id)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="font-semibold text-slate-800 text-sm">{empName(p.employee_id)}</span>
                <span className="text-xs text-slate-400">{p.purchase_date}</span>
                <Badge className={`text-xs w-fit ${info.color}`}>{info.label}</Badge>
                {p.payment_method === 'credito' && (
                  <Badge className={`text-xs w-fit ${creditPending > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {creditPending > 0 ? `Debe: $${creditPending.toLocaleString('es-CO', { maximumFractionDigits: 0 })}` : '✓ Pagado'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">${p.total_amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {isOpen && (
              <CardContent className="border-t pt-4 pb-4 bg-slate-50 space-y-3">
                {/* Items */}
                <div className="space-y-1">
                  {(p.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.product_name} <span className="text-slate-400">x{item.quantity}</span></span>
                      <span className="font-medium text-slate-800">${item.total_amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>

                {p.notes && (
                  <p className="text-xs text-slate-500 italic">📝 {p.notes}</p>
                )}

                {/* Abono a crédito */}
                {p.payment_method === 'credito' && creditPending > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-orange-700 mb-2">Registrar abono al crédito</p>
                    <p className="text-xs text-slate-500 mb-2">
                      Total: ${p.total_amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })} | 
                      Pagado: ${(p.credit_paid_amount || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })} | 
                      Pendiente: ${creditPending.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="number" min="0" max={creditPending}
                        placeholder="Monto abono"
                        value={creditPayment[p.id] || ""}
                        onChange={e => setCreditPayment(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="flex-1 text-sm"
                      />
                      <Button size="sm" onClick={() => handleCreditPayment(p)} className="bg-orange-500 hover:bg-orange-600">
                        <CreditCard className="w-3 h-3 mr-1" /> Abonar
                      </Button>
                    </div>
                  </div>
                )}

                {p.payment_method === 'credito' && creditPending <= 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium text-center">
                    ✓ Crédito totalmente pagado
                  </div>
                )}

                {/* Revertir compra */}
                {onDelete && (
                  <div className="pt-2 border-t border-slate-200">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 w-full"
                      onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Revertir y Eliminar Compra
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}