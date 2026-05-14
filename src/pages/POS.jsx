import React, { useState, useEffect, useCallback } from "react";
import { Product, Sale, SaleItem, Inventory, PriceList, ProductPrice, Credit, Payment, Location, SystemSettings } from "@/entities/all";
import { Producto as ProductoFab } from "@/api/entitiesChaquetas";
import { Dispatch, Delivery } from "@/api/entitiesProduccion";
import { InventoryMovement } from "@/entities/InventoryMovement";
import { sendInvoiceWhatsApp } from '@/utils/whatsappInvoice';
import { generatePrintableHTML, buildInvoicePdfBlob } from '@/utils/invoicePdf';
import { useSession } from "../components/providers/SessionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingCart,
  Search,
  Building2,
  AlertCircle,
  Package,
  Users,
  Loader2,
  ArrowLeftRight,
  FileText,
  Clock,
  Shield,
  CalendarClock,
  Check,
  Printer,
  MessageCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import ProductSearch from "../components/pos/ProductSearch";
import ProximosIngresos from "../components/pos/ProximosIngresos";
import Cart from "../components/pos/Cart";
import PaymentModal from "../components/pos/PaymentModal";
import CustomerForm from "../components/pos/CustomerForm";
import ExchangeModal from "../components/pos/ExchangeModal";
import QuoteModal from "../components/pos/QuoteModal";
import HoldCartManager from "../components/pos/HoldCartManager";
import DiscountPinModal from "../components/pos/DiscountPinModal";



export default function POS() {
  const { currentUser, permissions, userLocation, userRole, isLoading: isSessionLoading } = useSession();

  useEffect(() => {
    if (!isSessionLoading && currentUser) {
      console.log("🛒 POS - Estado de sesión:");
      console.log("   - Usuario:", currentUser.email);
      console.log("   - Rol:", userRole?.name);
      console.log("   - Permisos recibidos:", permissions);
      console.log("   - Cantidad de permisos:", permissions?.length || 0);
    }
  }, [isSessionLoading, currentUser, userRole, permissions]);
  
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customer, setCustomer] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [priceLists, setPriceLists] = useState([]);
  const [selectedPriceList, setSelectedPriceList] = useState(null);
  const [priceRules, setPriceRules] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState(null);
  const [systemSettings, setSystemSettings] = useState(null);

  const [showMobileCart, setShowMobileCart] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  // Próximos ingresos
  const [ingresosData, setIngresosData] = useState({ productos: [], dispatches: [], deliveries: [] });
  const [ingresosLoaded, setIngresosLoaded] = useState(false);
  const [ingresosLoading, setIngresosLoading] = useState(false);
  const [showIngresos, setShowIngresos] = useState(false);

  // New feature modals
  const [showExchange, setShowExchange] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [showHoldCart, setShowHoldCart] = useState(false);
  const [showDiscountPin, setShowDiscountPin] = useState(false);
  const [postSaleInfo, setPostSaleInfo] = useState(null);

  useEffect(() => {
    if (isSessionLoading) return;

    let cancelled = false;

    const loadAll = async () => {
      setIsLoadingData(true);
      setError(null);

      try {
        const [activeProducts, lists, allPriceRules, allLocations, settingsList] = await Promise.all([
          Product.filter({ is_active: true }),
          PriceList.list(),
          ProductPrice.list(),
          Location.filter({ is_active: true }),
          SystemSettings.list(),
        ]);
        if (settingsList && settingsList.length > 0) setSystemSettings(settingsList[0]);

        if (cancelled) return;

        setProducts(activeProducts || []);
        setPriceLists(lists || []);
        setPriceRules(allPriceRules || []);
        setLocations(allLocations || []);

        const defaultList = lists?.find(l => l.is_default) || lists?.[0];
        if (defaultList) {
          setSelectedPriceList(defaultList.code);
        }

        let locationId = null;
        if (currentUser?.role === 'admin' || userRole?.name === 'Administrador') {
          const defaultLocation = allLocations.find(l => l.is_main) || allLocations[0];
          locationId = defaultLocation?.id || null;
        } else {
          locationId = userLocation?.id || null;
        }

        if (cancelled) return;
        setSelectedLocationId(locationId);

        if (locationId) {
          const inventoryData = await Inventory.filter({ location_id: locationId });
          if (cancelled) return;
          setInventory(inventoryData || []);
        }

      } catch (error) {
        if (cancelled) return;
        console.error("Error loading POS data:", error);
        setError("Error al cargar datos del POS. Por favor, recarga la página.");
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [isSessionLoading, currentUser, userRole, userLocation]);

  const handleLocationChange = async (newLocationId) => {
    if (!newLocationId) {
      setInventory([]);
      setCart([]);
      setSelectedLocationId(null);
      return;
    }

    try {
      setSelectedLocationId(newLocationId);
      setCart([]);
      const inventoryData = await Inventory.filter({ location_id: newLocationId });
      setInventory(inventoryData || []);
    } catch (error) {
      console.error("Error loading inventory:", error);
      setInventory([]);
    }
  };

  const getPriceForProduct = useCallback((product, quantity) => {
    if (!selectedPriceList || !product) return product?.sale_price || 0;

    // Match by sku, then by id (familia_id is stored as product_sku in syncPriceLists)
    const matchingRules = priceRules.filter(rule =>
      (rule.product_sku === product.sku || rule.product_sku === product.id) &&
      rule.price_list_code === selectedPriceList &&
      rule.min_quantity <= quantity
    );

    if (matchingRules.length > 0) {
      const bestRule = matchingRules.sort((a, b) => b.min_quantity - a.min_quantity)[0];
      return bestRule.price;
    }

    return product.sale_price || 0;
  }, [selectedPriceList, priceRules]);

  const addToCart = useCallback((product) => {
    if (!product) return;

    const initialPrice = getPriceForProduct(product, 1);
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQuantity = existing.quantity + 1;
        const newPrice = getPriceForProduct(product, newQuantity);
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity, sale_price: newPrice }
            : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0, sale_price: initialPrice }];
    });

    if (window.innerWidth < 1024) {
      setActiveTab("cart");
      setShowMobileCart(true);
    }
  }, [getPriceForProduct]);

  const updateCartItem = useCallback((productId, updates) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const updatedItem = { ...item, ...updates };
          if (updates.quantity !== undefined && updates.quantity > 0) {
            updatedItem.sale_price = getPriceForProduct(item.product, updatedItem.quantity);
          }
          return updatedItem;
        }
        return item;
      })
    );
  }, [getPriceForProduct]);

  const removeFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomer(null);
    setGlobalDiscount(0);
    setShowMobileCart(false);
  }, []);

  const calculateTotals = useCallback(() => {
    const subtotal = cart.reduce((sum, item) => {
      const itemUnitPrice = item.sale_price || item.product.sale_price || 0;
      const itemSubtotal = item.quantity * itemUnitPrice;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      return sum + (itemSubtotal - itemDiscount);
    }, 0);

    const globalDiscountAmount = (subtotal * (globalDiscount || 0)) / 100;
    const subtotalAfterDiscount = subtotal - globalDiscountAmount;
    
    const taxAmount = cart.reduce((sum, item) => {
      const itemUnitPrice = item.sale_price || item.product.sale_price || 0;
      const itemSubtotal = item.quantity * itemUnitPrice;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const itemSubtotalAfterItemDiscount = itemSubtotal - itemDiscount;
      return sum + (itemSubtotalAfterItemDiscount * (item.product.tax_rate || 0)) / 100;
    }, 0);

    const finalTaxAmount = taxAmount * (1 - (globalDiscount || 0) / 100);
    const total = subtotalAfterDiscount + finalTaxAmount;

    return {
      subtotal,
      globalDiscountAmount,
      subtotalAfterDiscount,
      taxAmount: finalTaxAmount,
      total
    };
  }, [cart, globalDiscount]);

  const handleRestoreCart = useCallback((holdCart) => {
    // Re-map items back to full product shape
    const restoredItems = (holdCart.items || []).map(item => ({
      product: {
        id: item.product_id,
        sku: item.product_sku,
        name: item.product_name,
        sale_price: item.product_price,
        base_cost: item.product_cost,
        variant_attributes: item.variant_attributes || {}
      },
      quantity: item.quantity,
      sale_price: item.sale_price,
      discount: item.discount || 0
    }));
    setCart(restoredItems);
    setGlobalDiscount(holdCart.global_discount || 0);
    if (holdCart.price_list_code) setSelectedPriceList(holdCart.price_list_code);
    if (holdCart.customer_name) setCustomer({ name: holdCart.customer_name });
  }, []);

  const handleExchangeComplete = useCallback(async ({ exchangeRef }) => {
    // Refresh inventory after exchange
    if (selectedLocationId) {
      const updatedInventory = await Inventory.filter({ location_id: selectedLocationId });
      setInventory(updatedInventory || []);
    }
    setShowExchange(false);
    alert(`Cambio registrado exitosamente. Ref: ${exchangeRef}`);
  }, [selectedLocationId]);

  const handleDiscountAuthorized = useCallback(() => {
    setShowDiscountPin(false);
    // After authorization, admin has shared PIN. Now allow global discount for 5 min (use permission already in cart)
    alert("Descuento autorizado. Ahora puedes aplicar el descuento en el carrito.");
  }, []);

  const loadIngresos = async () => {
    if (ingresosLoaded) return;
    setIngresosLoading(true);
    const [productos, dispatches, deliveries] = await Promise.all([
      ProductoFab.list(),
      Dispatch.list(),
      Delivery.list(),
    ]);
    setIngresosData({ productos: (productos || []).filter(p => p.reference), dispatches: dispatches || [], deliveries: deliveries || [] });
    setIngresosLoaded(true);
    setIngresosLoading(false);
  };

  const handleSetCustomer = useCallback((customerData) => {
    console.log("📝 POS recibiendo customer:", customerData);
    if (!customerData) {
      setCustomer(null);
    } else if (typeof customerData === 'object') {
      setCustomer(customerData);
    }
    console.log("📝 Customer actualizado");
  }, []);

  const handlePostSalePrint = useCallback(() => {
    if (!postSaleInfo) return;
    const { sale, items, companyInfo } = postSaleInfo;
    const widthMM = 58;
    const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', courtesy: 'Cortesía' };
    const html = generatePrintableHTML(sale, items, companyInfo, labels, '58mm');
    const closeBanner = `<div class="no-print" style="background:#f5f5f5;padding:10px;text-align:center;font-family:sans-serif;font-size:13px;color:#555;">
      Después de imprimir, <a href="javascript:window.close()" style="color:#1a73e8;font-weight:bold;">cierra esta pestaña</a>
    </div>`;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;width:100%;max-width:100%;}@page{size:${widthMM}mm auto;margin:0;}@media print{body{width:${widthMM}mm;margin:0;}.no-print{display:none;}}</style></head><body>${closeBanner}${html}</body></html>`;
    const pw = window.open('', '_blank');
    if (!pw) { alert('Permite ventanas emergentes para imprimir.'); return; }
    pw.document.open();
    pw.document.write(fullHtml);
    pw.document.close();
    pw.onload = () => { pw.focus(); pw.print(); };
    pw.focus();
    pw.print();
  }, [postSaleInfo]);

  const handlePostSaleWhatsApp = useCallback(async () => {
    if (!postSaleInfo) return;
    const { sale, items, companyInfo, pdfBlobPromise } = postSaleInfo;
    try {
      await sendInvoiceWhatsApp({ sale, items, companyInfo, printFormat: '80mm', defaultPhone: sale.customer_phone, pdfBlobPromise });
    } catch (err) {
      console.error('WhatsApp share error:', err);
    }
  }, [postSaleInfo]);

  const processSale = useCallback(async (paymentData) => {
    if (!selectedLocationId) {
      alert("Por favor, selecciona una sucursal para procesar la venta.");
      return;
    }

    setIsProcessing(true);
    try {
      const totals = calculateTotals();
      const isCreditSale = paymentData.some(p => p.method === 'credit');

      if (isCreditSale && (!customer || !customer.name)) {
        alert("Para ventas a crédito, debe seleccionar un cliente.");
        setIsProcessing(false);
        return;
      }

      const locationInventory = await Inventory.filter({ location_id: selectedLocationId });

      for (const item of cart) {
        const inventoryRecord = locationInventory.find(inv =>
          inv.product_id === item.product.sku
        );

        const availableStock = inventoryRecord ? inventoryRecord.current_stock : 0;

        if (availableStock < item.quantity) {
          alert(`Stock insuficiente para ${item.product.name}. Disponible: ${availableStock}, Requerido: ${item.quantity}`);
          setIsProcessing(false);
          return;
        }
      }

      // ✅ FECHA SIMPLIFICADA: Hora actual directa
      const saleDateTime = new Date().toISOString();
      const saleDate = saleDateTime.split('T')[0]; // YYYY-MM-DD para inventory

      const sale = await Sale.create({
        location_id: selectedLocationId,
        customer_name: customer?.name || "Cliente General",
        customer_document: customer?.document || "",
        customer_phone: customer?.phone || "",
        customer_email: customer?.email || "",
        customer_id: customer?.id || null,
        sale_date: saleDateTime, // ✅ ISO timestamp completo
        subtotal: totals.subtotalAfterDiscount,
        tax_amount: totals.taxAmount,
        discount_amount: totals.globalDiscountAmount,
        total_amount: totals.total,
        status: isCreditSale ? "credit" : "completed",
        price_list_code: selectedPriceList,
        payment_methods: paymentData.map(p => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference,
          bank_account: p.bank_account
        }))
      });

      for (const payment of paymentData) {
        if (payment.method !== 'credit') {
          const newPayment = {
            sale_id: sale.id,
            payment_date: saleDateTime, // ✅ Misma fecha/hora
            amount: payment.amount,
            method: payment.method,
            type: "new_sale",
            location_id: selectedLocationId
          };
          
          if (payment.reference) {
            newPayment.reference = payment.reference;
          }
          
          if (payment.method === 'transfer' && payment.bank_account) {
            newPayment.bank_account_id = payment.bank_account;
          }
          
          await Payment.create(newPayment);
        }
      }

      for (const item of cart) {
        const itemUnitPrice = item.sale_price || item.product.sale_price || 0;
        const itemDiscountPercentage = item.discount || 0;
        const itemSubtotalBeforeDiscount = item.quantity * itemUnitPrice;
        const itemDiscountAmount = (itemSubtotalBeforeDiscount * itemDiscountPercentage) / 100;
        const itemLineTotal = itemSubtotalBeforeDiscount - itemDiscountAmount;

        await SaleItem.create({
          sale_id: sale.id,
          product_id: item.product.sku,
          quantity: item.quantity,
          unit_price: itemUnitPrice,
          unit_cost: item.product.base_cost || 0,
          discount_percentage: itemDiscountPercentage,
          discount_amount: itemDiscountAmount,
          tax_rate: item.product.tax_rate || 0,
          line_total: itemLineTotal
        });

        const inventoryRecord = locationInventory.find(inv =>
          inv.product_id === item.product.sku
        );

        if (inventoryRecord) {
          await Inventory.update(inventoryRecord.id, {
            current_stock: inventoryRecord.current_stock - item.quantity,
            last_movement_date: saleDate
          });
        } else {
          await Inventory.create({
            product_id: item.product.sku,
            location_id: selectedLocationId,
            current_stock: -item.quantity,
            last_movement_date: saleDate
          });
        }

        await InventoryMovement.create({
          product_id: item.product.sku,
          location_id: selectedLocationId,
          movement_type: "sale",
          quantity: -item.quantity,
          reference_id: sale.id,
          reason: `Venta #${sale.invoice_number || sale.id} - ${customer?.name || 'Cliente General'}`,
          cost_per_unit: item.product.base_cost || 0,
          movement_date: saleDate
        });
      }

      if (isCreditSale) {
        const creditPaymentMethod = paymentData.find(p => p.method === 'credit');
        const creditAmount = creditPaymentMethod ? creditPaymentMethod.amount : 0;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await Credit.create({
          sale_id: sale.id,
          customer_id: customer?.id || null,
          customer_name: customer?.name || "Cliente General",
          customer_phone: customer?.phone || "",
          total_amount: creditAmount,
          pending_amount: creditAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status: "pending",
          location_id: selectedLocationId,
          notes: `Crédito generado - Factura #${sale.invoice_number || sale.id}`
        });
      }

      const updatedInventory = await Inventory.filter({ location_id: selectedLocationId });
      setInventory(updatedInventory || []);

      const cartSnapshot = [...cart];
      setShowPayment(false);
      clearCart();

      const saleItems = await SaleItem.filter({ sale_id: sale.id });
      const enrichedItems = saleItems.map(si => {
        const cartItem = cartSnapshot.find(ci => ci.product.sku === si.product_id);
        return { ...si, product: cartItem?.product || null };
      });
      const companyInfo = systemSettings ? {
        name: systemSettings.company_name || 'JacketMaster POS',
        address: systemSettings.company_address || 'Dirección no configurada',
        document: systemSettings.company_document || 'NIT no configurado',
        phone: systemSettings.company_phone || 'Teléfono no configurado',
        email: systemSettings.company_email || '',
        receiptHeader: systemSettings.receipt_header || '',
        receiptFooter: systemSettings.receipt_footer || '¡Gracias por su compra!'
      } : {};
      // Inicia generación del PDF en segundo plano para que esté listo cuando el usuario toque WhatsApp
      const pdfBlobPromise = buildInvoicePdfBlob(sale, enrichedItems, companyInfo, '80mm');
      setPostSaleInfo({ sale, items: enrichedItems, companyInfo, pdfBlobPromise });

    } catch (error) {
      console.error("Error processing sale:", error);
      alert("Error al procesar la venta: " + (error.message || "Inténtalo de nuevo."));
    }
    setIsProcessing(false);
  }, [selectedLocationId, customer, cart, selectedPriceList, locations, calculateTotals, clearCart, globalDiscount]);

  const totals = calculateTotals();

  useEffect(() => {
    if (selectedPriceList) {
      setCart(prevCart =>
        prevCart.map(item => {
          const newPrice = getPriceForProduct(item.product, item.quantity);
          console.log(`📊 Actualizando precio para ${item.product.name}:`, {
            sku: item.product.sku,
            cantidad: item.quantity,
            listaPrecio: selectedPriceList,
            precioAnterior: item.sale_price,
            precioNuevo: newPrice
          });
          return {
            ...item,
            sale_price: newPrice
          };
        })
      );
    }
  }, [selectedPriceList]);

  if (isSessionLoading || isLoadingData) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Cargando Punto de Venta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 overflow-hidden flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin' || userRole?.name === 'Administrador';

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">

        {isAdmin && locations.length > 0 && (
          <div className="bg-white border-b border-slate-200 p-3 sm:p-4">
            <Card className="shadow-lg border-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                    <span className="font-medium text-slate-700 text-sm sm:text-base">Facturando desde:</span>
                  </div>
                  <div className="flex-1 w-full sm:max-w-xs">
                    <Select value={selectedLocationId || ''} onValueChange={handleLocationChange}>
                      <SelectTrigger className="bg-white h-10 sm:h-11">
                        <SelectValue placeholder="Seleccionar sucursal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              {location.name}
                              {location.is_main && (
                                <Badge variant="outline" className="text-xs">Principal</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!isAdmin && userLocation && (
          <div className="bg-white border-b border-slate-200 p-3 sm:p-4">
            <Card className="shadow-lg border-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    <span className="font-medium text-slate-700 text-sm sm:text-base">Facturando desde:</span>
                  </div>
                  <div className="flex-1">
                    <Input value={userLocation.name} readOnly disabled className="bg-gray-100 text-gray-700 h-10 sm:h-11" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedLocationId && (
          <div className="bg-white border-b border-slate-200 p-3 sm:p-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 text-sm">
                {currentUser?.role === 'admin'
                  ? "Por favor, selecciona una sucursal para comenzar a facturar."
                  : "No tienes una sucursal asignada o no se pudo cargar. Contacta al administrador."
                }
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              <h1 className="text-base sm:text-lg font-semibold text-slate-900">POS</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={() => setShowExchange(true)} disabled={!selectedLocationId}>
                <ArrowLeftRight className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={() => setShowQuote(true)} disabled={cart.length === 0}>
                <FileText className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={() => setShowHoldCart(true)} disabled={!selectedLocationId}>
                <Clock className="w-3 h-3" />
              </Button>
            </div>

            <Sheet open={showMobileCart} onOpenChange={setShowMobileCart}>
              <SheetTrigger asChild>
                <Button className="relative bg-blue-600 hover:bg-blue-700 gap-2 h-10 px-3 sm:px-4">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  {cart.length > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full px-1">
                      {cart.length}
                    </Badge>
                  )}
                  <span className="font-medium text-sm sm:text-base">
                    ${totals.total?.toLocaleString() || '0'}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:w-[400px] p-0"
                onPointerDownOutside={(e) => {}}
                onEscapeKeyDown={(e) => {
                  setShowMobileCart(false);
                }}
              >
                <div className="h-full flex flex-col">
                  <SheetHeader className="px-4 py-3 border-b">
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                      Carrito ({cart.length})
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto touch-pan-y">
                    <Cart
                      cart={cart}
                      onUpdateItem={updateCartItem}
                      onRemoveItem={removeFromCart}
                      globalDiscount={globalDiscount}
                      onGlobalDiscountChange={setGlobalDiscount}
                      totals={totals}
                      onCheckout={() => {
                        setShowMobileCart(false);
                        setShowPayment(true);
                      }}
                      onClearCart={clearCart}
                      priceLists={priceLists}
                      selectedPriceListCode={selectedPriceList}
                      onPriceListChange={setSelectedPriceList}
                      userPermissions={permissions}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex-1">
          <div className="hidden lg:flex max-w-8xl mx-auto w-full p-6 flex-col">
            {/* Desktop action buttons */}
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowExchange(true)} disabled={!selectedLocationId}>
                <ArrowLeftRight className="w-4 h-4 text-orange-600" /> Cambios
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowQuote(true)} disabled={cart.length === 0}>
                <FileText className="w-4 h-4 text-blue-600" /> Presupuesto
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowHoldCart(true)} disabled={!selectedLocationId}>
                <Clock className="w-4 h-4 text-amber-600" /> En Espera
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDiscountPin(true)}>
                <Shield className="w-4 h-4 text-purple-600" /> Pin Descuento
              </Button>
              <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => { setShowIngresos(true); loadIngresos(); }}>
                <CalendarClock className="w-4 h-4 text-indigo-600" /> Próximos ingresos
              </Button>
            </div>
            <div className="grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
              <div className="lg:col-span-2 space-y-6 flex flex-col min-h-0">
                <Card className="shadow-lg border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <Search className="w-6 h-6 text-blue-600" />
                      Buscar Productos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductSearch
                      products={products}
                      inventory={inventory}
                      selectedLocationId={selectedLocationId}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onAddToCart={addToCart}
                    />
                  </CardContent>
                </Card>

                <CustomerForm
                  customer={customer}
                  onCustomerChange={handleSetCustomer}
                />
              </div>

              <div className="flex flex-col min-h-0">
                <Cart
                  cart={cart}
                  onUpdateItem={updateCartItem}
                  onRemoveItem={removeFromCart}
                  globalDiscount={globalDiscount}
                  onGlobalDiscountChange={setGlobalDiscount}
                  totals={totals}
                  onCheckout={() => setShowPayment(true)}
                  onClearCart={clearCart}
                  priceLists={priceLists}
                  selectedPriceListCode={selectedPriceList}
                  onPriceListChange={setSelectedPriceList}
                  userPermissions={permissions}
                />
              </div>
            </div>
          </div>

          <div className="lg:hidden flex flex-col min-h-0 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-3 mx-2 my-2 sm:mx-4 sm:my-4">
                <TabsTrigger value="products" className="flex items-center gap-2 text-sm sm:text-base">
                  <Package className="w-4 h-4" />
                  Productos
                </TabsTrigger>
                <TabsTrigger value="customer" className="flex items-center gap-2 text-sm sm:text-base">
                  <Users className="w-4 h-4" />
                  Cliente
                </TabsTrigger>
                <TabsTrigger value="ingresos" className="flex items-center gap-2 text-sm sm:text-base"
                  onClick={() => loadIngresos()}>
                  <CalendarClock className="w-4 h-4" />
                  Ingresos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="flex-1 mx-2 sm:mx-4 mt-0 flex flex-col min-h-0 overflow-hidden">
                <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      Buscar Productos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 pb-28 -mx-2 sm:mx-0 overflow-y-auto touch-pan-y">
                    <ProductSearch
                      products={products}
                      inventory={inventory}
                      selectedLocationId={selectedLocationId}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onAddToCart={addToCart}
                      isMobile={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="customer" className="flex-1 mx-3 sm:mx-4 mt-0">
                <CustomerForm
                  customer={customer}
                  onCustomerChange={handleSetCustomer}
                  isMobile={true}
                />
              </TabsContent>

              <TabsContent value="ingresos" className="flex-1 mx-3 sm:mx-4 mt-0 overflow-y-auto pb-24">
                {ingresosLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                  </div>
                ) : (
                  <ProximosIngresos {...ingresosData} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          total={totals.total}
          customer={customer}
          onConfirm={processSale}
          onCancel={() => setShowPayment(false)}
          isProcessing={isProcessing}
        />
      )}

      {showExchange && selectedLocationId && (
        <ExchangeModal
          locationId={selectedLocationId}
          inventory={inventory}
          priceLists={priceLists}
          priceRules={priceRules}
          onClose={() => setShowExchange(false)}
          onComplete={handleExchangeComplete}
        />
      )}

      {showQuote && (
        <QuoteModal
          cart={cart}
          totals={totals}
          customer={customer}
          locationName={locations.find(l => l.id === selectedLocationId)?.name}
          companyInfo={systemSettings}
          onClose={() => setShowQuote(false)}
        />
      )}

      {showHoldCart && selectedLocationId && (
        <HoldCartManager
          locationId={selectedLocationId}
          currentCart={cart}
          currentTotal={totals.total}
          currentPriceList={selectedPriceList}
          currentDiscount={globalDiscount}
          currentCustomer={customer}
          onRestoreCart={handleRestoreCart}
          onClose={() => setShowHoldCart(false)}
        />
      )}

      {showDiscountPin && (
        <DiscountPinModal
          onAuthorized={handleDiscountAuthorized}
          onClose={() => setShowDiscountPin(false)}
        />
      )}

      {postSaleInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">¡Venta completada!</h2>
              <p className="text-sm text-slate-500 mt-1">
                Factura #{postSaleInfo.sale.invoice_number || postSaleInfo.sale.id?.slice(-8)}
                {' · '}${(postSaleInfo.sale.total_amount || 0).toLocaleString()}
              </p>
            </div>
            <p className="text-center text-slate-600 text-sm">¿Qué deseas hacer con la factura?</p>
            <div className="space-y-2">
              <Button className="w-full gap-2 bg-slate-800 hover:bg-slate-900" onClick={handlePostSalePrint}>
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
              <Button variant="outline" className="w-full gap-2 border-green-500 text-green-700 hover:bg-green-50" onClick={handlePostSaleWhatsApp}>
                <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
              </Button>
              <Button variant="ghost" className="w-full text-slate-500" onClick={() => setPostSaleInfo(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet: Próximos ingresos (desktop) */}
      {showIngresos && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowIngresos(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900">Próximos ingresos</h2>
              </div>
              <button onClick={() => setShowIngresos(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {ingresosLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
                </div>
              ) : (
                <ProximosIngresos {...ingresosData} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}