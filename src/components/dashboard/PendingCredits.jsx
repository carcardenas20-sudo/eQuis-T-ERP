import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, User, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PendingCredits({ credits, isLoading }) {
  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Créditos Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-24 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Créditos Pendientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {credits.length === 0 ? (
          <Alert className="border-green-200 bg-green-50">
            <User className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              ¡Excelente! No hay créditos pendientes por el momento.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {credits.map((credit) => {
              const isOverdue = isPast(parseISO(credit.due_date));
              const borderColor = isOverdue ? "border-red-200" : "border-orange-200";
              const bgColor = isOverdue ? "bg-red-50" : "bg-orange-50";
              
              return (
                <div key={credit.id} className={`flex items-center justify-between p-3 ${bgColor} rounded-lg border ${borderColor}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${isOverdue ? 'bg-red-100' : 'bg-orange-100'} rounded-full flex items-center justify-center`}>
                      <User className={`w-5 h-5 ${isOverdue ? 'text-red-600' : 'text-orange-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{credit.customer_name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Vence: {format(parseISO(credit.due_date), "dd MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${isOverdue ? 'text-red-700' : 'text-orange-700'}`}>
                      ${(credit.pending_amount || 0).toLocaleString()}
                    </p>
                    <Badge 
                      variant={isOverdue ? "destructive" : "secondary"} 
                      className={`text-xs mt-1 ${isOverdue ? '' : 'bg-orange-100 text-orange-800'}`}
                    >
                      {isOverdue ? "Vencido" : "Pendiente"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}