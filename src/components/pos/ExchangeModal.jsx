import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Inventory, InventoryMovement, Product, Sale, SaleItem,
  Payment, Credit, Exchange, BankAccount
} from "@/entities/all";
import {
  RefreshCw, Package, Search, X, ArrowLeftRight,
  RotateCcw, Plus, Minus, Trash2, CreditCard, DollarSign,
  Smartphone, QrCode, Landmark, Check, Tag, AlertCircle
} from "lucide-react";
import { getCurrentDateString } from "../utils/dateUtils";
import ExchangeReceipt from "./ExchangeReceipt";

const PAYMENT_METHODS = [
  { id: "cash",     name: "Efectivo",       icon: DollarSign,  color: "bg-green-600" },
  { id: "card",     name: "Tarjeta",        icon: CreditCard,  color: "bg-blue-600" },
  { id: "transfer", name: "Transferencia",  icon: Smartphone,  color: "bg-purple-600" },
  { id: "qr",       name: "QR",             icon: QrCode,      color: "bg-orange-500" },
  { id: "credit",   name: "Crédito",        icon: Landmark,    color: "bg-sky-600" },
];

// ── Mini modal de pago (igual al del POS) ───────────────────────────────────
function ExchangePaymentModal({ total, onConfirm, onCancel, isProcessing }) {
  const [payments, setPayments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [currentPayment, setCurrentPayment] = useState({ method: "cash", amount: total, reference: "", bank_account: "" });
  const [customerName, setCustomerName] = useState("");
  const [creditError, setCreditError] = useState("");

  useEffect(() => {
    BankAccount.filter({ is_active: true }).then(setBankAccounts).catch(() => {});
  }, []);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - totalPaid;

  useEffect(() => {
    setCurrentPayment(prev => ({ ...prev, amount: Math.max(0, remaining) }));
  }, [payments]);

  const addPayment = () => {
    if (currentPayment.method === "credit") {
      if (!customerName.trim()) { setCreditError("Ingrese el nombre del cliente para pago a crédito."); return; }
      setPayments(prev => [...prev, { ...currentPayment, id: Date.now(), amount: remaining, reference: `Crédito - ${customerName}` }]);
      setCurrentPayment({ method: "cash", amount: 0, reference: "", bank_account: "" });
      setCreditError("");
      return;
    }
    if (currentPayment.amount <= 0) return;
    setPayments(prev => [...prev, { ...currentPayment, id: Date.now() }]);
    setCurrentPayment({ method: "cash", amount: Math.max(0, remaining - currentPayment.amount), reference: "", bank_account: "" });
    setCreditError("");
  };

  const removePayment = (id) => { setPayments(prev => prev.filter(p => p.id !== id)); setCreditError(""); };

  const canConfirm = totalPaid >= total && !isProcessing;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md w-[95vw] z-[60]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Procesar Pago — ${total?.toLocaleString()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Totales */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Total</p>
              <p className="text-base font-bold text-blue-900">${total?.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600 font-medium">Pagado</p>
              <p className="text-base font-bold text-green-900">${totalPaid.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-orange-600 font-medium">Pendiente</p>
              <p className="text-base font-bold text-orange-900">${Math.max(0, remaining).toLocaleString()}</p>
            </div>
          </div>

          {/* Pagos registrados */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Pagos registrados:</p>
              {payments.map(p => {
                const m = PAYMENT_METHODS.find(x => x.id === p.method);
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`${m?.color} p-1.5 rounded text-white`}><m.icon className="w-3.5 h-3.5" /></div>
                      <div>
                        <p className="text-sm font-medium">{m?.name}</p>
                        {p.reference && <p className="text-xs text-slate-500">{p.reference}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">${p.amount.toLocaleString()}</Badge>
                      <button onClick={() => removePayment(p.id)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Agregar pago */}
          {remaining > 0 && (
            <div className="border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Agregar Pago:</p>

              {/* Métodos */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id}
                    onClick={() => { setCurrentPayment(prev => ({ ...prev, method: m.id })); setCreditError(""); }}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all
                      ${currentPayment.method === m.id ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                    <m.icon className="w-4 h-4" />
                    {m.name}
                  </button>
                ))}
              </div>

              {/* Nombre cliente si es crédito */}
              {currentPayment.method === "credit" && (
                <div>
                  <Label className="text-xs">Nombre del cliente *</Label>
                  <Input
                    value={customerName}
                    onChange={e => { setCustomerName(e.target.value); setCreditError(""); }}
                    placeholder="Nombre del cliente..."
                    className="mt-1"
                  />
                </div>
              )}

              {creditError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{creditError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Monto</Label>
                  <Input type="number" value={currentPayment.amount}
                    onChange={e => setCurrentPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    disabled={currentPayment.method === "credit"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Referencia (Opcional)</Label>
                  <Input value={currentPayment.reference}
                    onChange={e => setCurrentPayment(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Nº transacción"
                    className="mt-1"
                  />
                </div>
              </div>

              {currentPayment.method === "transfer" && bankAccounts.length > 0 && (
                <div>
                  <Label className="text-xs">Cuenta bancaria</Label>
                  <Select value={currentPayment.bank_account} onValueChange={v => setCurrentPayment(prev => ({ ...prev, bank_account: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="-- Sin especificar --" /></SelectTrigger>
                    <SelectContent className="z-[80]" position="popper">
                      {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} - {a.account_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={addPayment} className="w-full gap-2" disabled={currentPayment.method !== "credit" && currentPayment.amount <= 0}>
                <Plus className="w-4 h-4" /> Agregar Pago
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="flex-1">Cancelar</Button>
          <Button onClick={() => onConfirm(payments, customerName)} disabled={!canConfirm} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirmar Venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ExchangeModal({ locationId, inventory, priceLists = [], priceRules = [], onClose, onComplete }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [takeItems, setTakeItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [selectedPriceList, setSelectedPriceList] = useState(() => priceLists.find(l => l.is_default)?.code || priceLists[0]?.code || null);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    Product.filter({ is_active: true }).then(setProducts).catch(() => {});
  }, []);

  const getPrice = (product) => {
    if (!selectedPriceList || !product) return product?.sale_price || 0;
    const sku = product.sku || product.id;
    const rules = priceRules.filter(r => r.product_sku === sku && r.price_list_code === selectedPriceList);
    if (rules.length > 0) return rules.sort((a, b) => b.min_quantity - a.min_quantity)[0].price;
    return product.sale_price || 0;
  };

  const getStock = (product) => {
    const inv = inventory.find(i => i.product_id === product.sku && i.location_id === locationId);
    return inv?.current_stock || 0;
  };

  const returnTotal = returnItems.reduce((s, i) => s + getPrice(i.product) * i.quantity, 0);
  const takeTotal = takeItems.reduce((s, i) => s + getPrice(i.product) * i.quantity, 0);
  const difference = takeTotal - returnTotal;

  const addReturn = (p) => setReturnItems(prev => {
    const ex = prev.find(i => i.product.id === p.id);
    if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
    return [...prev, { product: p, quantity: 1 }];
  });

  const addTake = (p) => {
    const stock = getStock(p);
    const already = takeItems.find(i => i.product.id === p.id)?.quantity || 0;
    if (already >= stock) return;
    setTakeItems(prev => {
      const ex = prev.find(i => i.product.id === p.id);
      if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1 }];
    });
  };

  const updateQty = (list, setList, productId, delta) => {
    setList(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const n = i.quantity + delta;
      return n <= 0 ? null : { ...i, quantity: n };
    }).filter(Boolean));
  };

  const filtered = products.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const canProcess = (returnItems.length > 0 || takeItems.length > 0) && difference >= 0;

  const handleProcess = async (paymentMethods, customerName) => {
    setIsProcessing(true);
    try {
      const today = getCurrentDateString();
      const exchangeRef = `CAMBIO-${Date.now()}`;
      const nowISO = new Date().toISOString();

      // Inventario: devoluciones
      for (const item of returnItems) {
        const inv = inventory.find(i => i.product_id === item.product.sku && i.location_id === locationId);
        if (inv) await Inventory.update(inv.id, { current_stock: inv.current_stock + item.quantity, last_movement_date: today });
        else await Inventory.create({ product_id: item.product.sku, location_id: locationId, current_stock: item.quantity, last_movement_date: today });
        await InventoryMovement.create({ product_id: item.product.sku, location_id: locationId, movement_type: "return", quantity: item.quantity, reference_id: exchangeRef, reason: `Cambio - Devolución${notes ? ` - ${notes}` : ''}`, cost_per_unit: item.product.base_cost || 0, movement_date: today });
      }

      // Inventario: salidas
      for (const item of takeItems) {
        const inv = inventory.find(i => i.product_id === item.product.sku && i.location_id === locationId);
        if (inv) await Inventory.update(inv.id, { current_stock: inv.current_stock - item.quantity, last_movement_date: today });
        await InventoryMovement.create({ product_id: item.product.sku, location_id: locationId, movement_type: "sale", quantity: -item.quantity, reference_id: exchangeRef, reason: `Cambio - Se lleva${notes ? ` - ${notes}` : ''}`, cost_per_unit: item.product.base_cost || 0, movement_date: today });
      }

      // Venta si hay excedente
      let saleId = null;
      if (difference > 0 && paymentMethods.length > 0) {
        const isCreditSale = paymentMethods.some(p => p.method === "credit");
        const sale = await Sale.create({
          location_id: locationId,
          customer_name: customerName || "Cliente General",
          sale_date: today,
          subtotal: difference,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: difference,
          status: isCreditSale ? "credit" : "completed",
          price_list_code: selectedPriceList,
          notes: `Excedente de cambio — Ref: ${exchangeRef}`,
          payment_methods: paymentMethods.map(p => ({ method: p.method, amount: p.amount }))
        });
        saleId = sale.id;

        for (const item of takeItems) {
          await SaleItem.create({ sale_id: sale.id, product_id: item.product.sku, quantity: item.quantity, unit_price: getPrice(item.product), unit_cost: item.product.base_cost || 0, discount_percentage: 0, discount_amount: 0, tax_rate: 0, line_total: getPrice(item.product) * item.quantity });
        }

        for (const p of paymentMethods) {
          if (p.method !== "credit") {
            await Payment.create({ sale_id: sale.id, payment_date: nowISO, amount: p.amount, method: p.method, type: "new_sale", location_id: locationId });
          }
        }

        const creditPay = paymentMethods.find(p => p.method === "credit");
        if (creditPay) {
          const due = new Date(); due.setDate(due.getDate() + 30);
          await Credit.create({ sale_id: sale.id, customer_name: customerName || "Cliente General", customer_phone: "", total_amount: creditPay.amount, pending_amount: creditPay.amount, due_date: due.toISOString().split("T")[0], status: "pending", location_id: locationId, notes: `Crédito de cambio — Ref: ${exchangeRef}` });
        }
      }

      // Registro del cambio
      await Exchange.create({
        exchange_ref: exchangeRef,
        location_id: locationId,
        return_items: returnItems.map(i => ({ product_id: i.product.sku, product_name: i.product.name, quantity: i.quantity, unit_price: getPrice(i.product), line_total: getPrice(i.product) * i.quantity })),
        take_items: takeItems.map(i => ({ product_id: i.product.sku, product_name: i.product.name, quantity: i.quantity, unit_price: getPrice(i.product), line_total: getPrice(i.product) * i.quantity })),
        return_total: returnTotal,
        take_total: takeTotal,
        difference,
        price_list_code: selectedPriceList,
        payment_methods: paymentMethods,
        sale_id: saleId,
        notes: notes || "",
        status: "completed"
      });

      setShowPayment(false);
      setReceiptData({
        exchangeRef,
        returnItems: returnItems.map(i => ({ product_name: i.product.name, quantity: i.quantity, unit_price: getPrice(i.product) })),
        takeItems: takeItems.map(i => ({ product_name: i.product.name, quantity: i.quantity, unit_price: getPrice(i.product) })),
        returnTotal,
        takeTotal,
        difference,
        paymentMethods,
        customerName: customerName || (difference === 0 ? "" : "Cliente General"),
        notes,
        date: new Date().toLocaleString("es-CO"),
      });
      onComplete({ exchangeRef });
    } catch (err) {
      alert("Error procesando cambio: " + err.message);
    }
    setIsProcessing(false);
  };

  const handleClickProcess = () => {
    if (difference > 0) {
      setShowPayment(true);
    } else {
      handleProcess([], "");
    }
  };

  const priceListName = priceLists.find(l => l.code === selectedPriceList)?.name;

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-6xl w-full h-[100dvh] sm:h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-xl pb-safe z-[70]">
          <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              <span>Modo Cambio/Devolución</span>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">Cancelar Cambio</Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Columna izquierda: productos */}
            <div className="flex-1 flex flex-col overflow-hidden md:border-r border-0">
              {/* Búsqueda */}
              <div className="p-3 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Buscar por nombre, SKU o código de barras..." value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
                </div>
              </div>

              {/* Grid productos */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-3">
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {filtered.map(p => {
                    const stock = getStock(p);
                    const price = getPrice(p);
                    const inReturn = returnItems.find(i => i.product.id === p.id)?.quantity || 0;
                    const inTake = takeItems.find(i => i.product.id === p.id)?.quantity || 0;

                    return (
                      <div key={p.id} className="border rounded-xl bg-white overflow-hidden shadow-sm">
                        <div className="hidden sm:block">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="w-full h-20 object-cover" />
                            : <div className="w-full h-20 bg-slate-100 flex items-center justify-center"><Package className="w-8 h-8 text-slate-300" /></div>
                          }
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{p.name}</p>
                          <p className="text-xs text-slate-400 truncate">{p.sku}</p>
                          <div className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${stock === 0 ? 'bg-red-100 text-red-600' : 'bg-slate-800 text-white'}`}>
                            Stock: {stock}
                          </div>
                          <p className="text-sm font-bold text-blue-600 mt-1">${price?.toLocaleString()}</p>
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            <button onClick={() => addReturn(p)}
                              className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[11px] sm:text-xs font-medium transition-colors select-none">
                              <RotateCcw className="w-3 h-3" /> Devuelve{inReturn > 0 ? ` (${inReturn})` : ''}
                            </button>
                            <button onClick={() => addTake(p)}
                              disabled={stock === 0}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors select-none
                                ${stock === 0 ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                                  : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'}`}>
                              <Plus className="w-3 h-3" /> Se lleva{inTake > 0 ? ` (${inTake})` : ''}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna derecha: resumen */}
            <div className="w-full md:w-80 flex flex-col overflow-hidden bg-slate-50 border-t md:border-t-0">
              <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-3">
                {/* Lista de precios */}
                {priceLists.length > 0 && (
                  <div className="bg-white border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-blue-500" />
                      <p className="text-xs font-semibold text-slate-700">Lista de Precios para el Cambio</p>
                    </div>
                    <Select value={selectedPriceList || ""} onValueChange={setSelectedPriceList}>
                      <SelectTrigger className="h-8 text-sm focus:ring-2 focus:ring-blue-500"><SelectValue placeholder="Seleccionar lista" /></SelectTrigger>
                      <SelectContent className="z-[80]" position="popper">
                        {priceLists.map(pl => <SelectItem key={pl.code} value={pl.code}>{pl.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {priceListName && <p className="text-xs text-blue-600 mt-1">Usando precios de: {priceListName}</p>}
                  </div>
                )}

                {/* Productos que DEVUELVE */}
                <div className="bg-white border border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <RotateCcw className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-semibold text-red-700">Productos que DEVUELVE</p>
                  </div>
                  {returnItems.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-3">Agrega productos que el cliente devuelve</p>
                    : returnItems.map(item => (
                        <div key={item.product.id} className="mb-2 last:mb-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">{item.product.name}</p>
                              <p className="text-xs text-slate-500">${getPrice(item.product).toLocaleString()} × {item.quantity}</p>
                              <p className="text-xs font-semibold text-red-600">−${(getPrice(item.product) * item.quantity).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => updateQty(returnItems, setReturnItems, item.product.id, -1)} className="w-6 h-6 rounded border bg-white flex items-center justify-center hover:bg-red-50"><Minus className="w-3 h-3" /></button>
                              <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                              <button onClick={() => updateQty(returnItems, setReturnItems, item.product.id, 1)} className="w-6 h-6 rounded border bg-white flex items-center justify-center hover:bg-green-50"><Plus className="w-3 h-3" /></button>
                              <button onClick={() => setReturnItems(p => p.filter(i => i.product.id !== item.product.id))} className="w-6 h-6 rounded border bg-white flex items-center justify-center hover:bg-red-50 text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                    <span className="text-slate-600">Total devolución:</span>
                    <span className="text-red-600">${returnTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Productos que SE LLEVA */}
                <div className="bg-white border border-green-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-700">Productos que SE LLEVA</p>
                  </div>
                  {takeItems.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-3">Agrega productos que el cliente se lleva</p>
                    : takeItems.map(item => (
                        <div key={item.product.id} className="mb-2 last:mb-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">{item.product.name}</p>
                              <p className="text-xs text-slate-500">${getPrice(item.product).toLocaleString()} × {item.quantity}</p>
                              <p className="text-xs font-semibold text-green-600">+${(getPrice(item.product) * item.quantity).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => updateQty(takeItems, setTakeItems, item.product.id, -1)} className="w-6 h-6 rounded border bg-white flex items-center justify-center hover:bg-red-50"><Minus className="w-3 h-3" /></button>
                              <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                              <button onClick={() => {
                                const stock = getStock(item.product);
                                if (item.quantity < stock) updateQty(takeItems, setTakeItems, item.product.id, 1);
                              }} className="w-6 h-6 rounded border bg-white flex items-center justify-center hover:bg-green-50"><Plus className="w-3 h-3" /></button>
                              <button onClick={() => setTakeItems(p => p.filter(i => i.product.id !== item.product.id))} className="w-6 h-6 rounded border bg-white flex items-center justify-center hover:bg-red-50 text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                    <span className="text-slate-600">Total a llevar:</span>
                    <span className="text-green-600">${takeTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Nota */}
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Motivo del cambio (opcional)..." className="text-sm" />

                {/* Resumen */}
                <div className={`bg-white border-2 rounded-xl p-3 ${difference < 0 ? 'border-red-300' : difference > 0 ? 'border-blue-300' : 'border-slate-200'}`}>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Devuelve:</span><span className="text-red-600 font-medium">${returnTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mb-2">
                    <span>Se lleva:</span><span className="text-green-600 font-medium">${takeTotal.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>Cliente paga:</span>
                    <span className={difference < 0 ? 'text-red-600' : difference > 0 ? 'text-blue-700' : 'text-slate-500'}>${Math.abs(difference).toLocaleString()}</span>
                  </div>
                  {difference < 0 && <p className="text-xs text-red-500 mt-1">⚠ No se permiten devoluciones de dinero. El cliente debe llevarse artículos por al menos ${returnTotal.toLocaleString()}.</p>}
                </div>
              </div>

              {/* Botón procesar */}
              <div className="p-3 border-t bg-white space-y-2 shrink-0">
                {isProcessing
                  ? <div className="flex items-center justify-center gap-2 py-3 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin" /> Procesando...</div>
                  : (
                    <Button
                      onClick={handleClickProcess}
                      disabled={!canProcess || isProcessing}
                      className="w-full bg-blue-600 hover:bg-blue-700 gap-2 h-11 text-sm"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      {difference > 0 ? `Procesar Cambio ($${difference.toLocaleString()})` : "Procesar Cambio"}
                    </Button>
                  )
                }
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showPayment && (
        <ExchangePaymentModal
          total={difference}
          onConfirm={handleProcess}
          onCancel={() => setShowPayment(false)}
          isProcessing={isProcessing}
        />
      )}

      {receiptData && (
        <ExchangeReceipt
          data={receiptData}
          onClose={() => { setReceiptData(null); onClose(); }}
        />
      )}
    </>
  );
}