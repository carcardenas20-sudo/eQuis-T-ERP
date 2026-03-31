import React, { useState, useEffect } from "react";
import { Exchange } from "@/entities/all";
import { useSession } from "../components/providers/SessionProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Search, TrendingDown, TrendingUp, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import moment from "moment";

function ExchangeRow({ exchange }) {
  const [open, setOpen] = useState(false);
  const diff = exchange.difference || 0;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <ArrowLeftRight className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">{exchange.exchange_ref}</p>
            <p className="text-xs text-slate-500">{moment(exchange.created_date).format("DD/MM/YYYY HH:mm")}</p>
          </div>
          {diff > 0 && (
            <Badge className="bg-orange-100 text-orange-700 text-xs">Pagó excedente: ${diff.toLocaleString()}</Badge>
          )}
          {diff === 0 && (
            <Badge className="bg-slate-100 text-slate-600 text-xs">Cambio exacto</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500">Devolvió / Se llevó</p>
            <p className="text-sm font-semibold">
              <span className="text-green-600">${(exchange.return_total || 0).toLocaleString()}</span>
              {" → "}
              <span className="text-blue-600">${(exchange.take_total || 0).toLocaleString()}</span>
            </p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t bg-slate-50 px-4 py-4 grid sm:grid-cols-2 gap-4">
          {/* Productos devueltos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-green-600" />
              <p className="text-sm font-semibold text-green-700">Devolvió</p>
            </div>
            {(exchange.return_items || []).length === 0 && <p className="text-xs text-slate-400">Sin productos devueltos</p>}
            {(exchange.return_items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-200 last:border-0">
                <span className="text-slate-700">{item.product_name} x{item.quantity}</span>
                <span className="font-medium text-green-700">${(item.line_total || 0).toLocaleString()}</span>
              </div>
            ))}
            <p className="text-sm font-bold text-green-700 pt-2">Total: ${(exchange.return_total || 0).toLocaleString()}</p>
          </div>

          {/* Productos llevados */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-blue-700">Se llevó</p>
            </div>
            {(exchange.take_items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-200 last:border-0">
                <span className="text-slate-700">{item.product_name} x{item.quantity}</span>
                <span className="font-medium text-blue-700">${(item.line_total || 0).toLocaleString()}</span>
              </div>
            ))}
            <p className="text-sm font-bold text-blue-700 pt-2">Total: ${(exchange.take_total || 0).toLocaleString()}</p>
          </div>

          {/* Pago del excedente */}
          {diff > 0 && (exchange.payment_methods || []).length > 0 && (
            <div className="sm:col-span-2 border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold text-orange-700">Pago del excedente (${diff.toLocaleString()})</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {exchange.payment_methods.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {p.method}: ${p.amount?.toLocaleString()}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {exchange.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500"><span className="font-medium">Nota:</span> {exchange.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Exchanges() {
  const { userLocation, currentUser } = useSession();
  const [exchanges, setExchanges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Exchange.list("-created_date", 100).then(data => {
      setExchanges(data || []);
      setIsLoading(false);
    });
  }, []);

  const filtered = exchanges.filter(e =>
    !search ||
    e.exchange_ref?.toLowerCase().includes(search.toLowerCase()) ||
    e.notes?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDifference = filtered.reduce((s, e) => s + (e.difference || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ArrowLeftRight className="w-7 h-7 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Historial de Cambios</h1>
          <p className="text-slate-500 text-sm">Registro de todos los cambios de productos</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500">Total cambios</p>
            <p className="text-2xl font-bold text-slate-800">{exchanges.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500">Con excedente cobrado</p>
            <p className="text-2xl font-bold text-orange-600">{exchanges.filter(e => e.difference > 0).length}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-500">Total excedentes cobrados</p>
            <p className="text-2xl font-bold text-green-600">${totalDifference.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por referencia o nota..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Cargando historial...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay cambios registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => <ExchangeRow key={e.id} exchange={e} />)}
        </div>
      )}
    </div>
  );
}