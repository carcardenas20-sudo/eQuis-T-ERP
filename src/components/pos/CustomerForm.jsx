import React, { useState, useEffect } from 'react';
import { Customer } from "@/entities/Customer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Removed Command, CommandEmpty, CommandGroup, CommandInput, CommandItem as they are no longer used for search UI
// Removed Popover, PopoverContent, PopoverTrigger as they are no longer used for search UI

import { Search, Plus, UserCheck } from "lucide-react"; // UserCheck is new, Plus and Search are kept from previous version

export default function CustomerForm({ customer, onCustomerChange, isMobile = false }) {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false); // New state for toggling the customer selection/entry form
  const [searchTerm, setSearchTerm] = useState(""); // New state for the search input
  const [manualCustomer, setManualCustomer] = useState({ // New state for manually entered customer details
    name: "",
    phone: ""
  });
  const [isLoading, setIsLoading] = useState(false); // New state, as per outline (not actively used in this snippet)

  useEffect(() => {
    loadCustomers();
  }, []);

  // The previous useEffect that handled `customer` prop to set `selectedCustomer` and `isManualEntry`
  // has been removed. The `customer` prop itself is now the source of truth for the displayed customer
  // when `showForm` is false, and `onCustomerChange` updates this prop from the parent component.

  const loadCustomers = async () => {
    try {
      const activeCustomers = await Customer.filter({ is_active: true });
      setCustomers(activeCustomers);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  // Filter customers based on the search term
  const filteredCustomers = searchTerm
    ? customers.filter(
        (cust) =>
          cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (cust.phone && cust.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (cust.document && cust.document.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  const handleSelectCustomer = (customerData) => {
    console.log("🔍 Seleccionando cliente:", customerData);
    onCustomerChange({
      id: customerData.id,
      name: customerData.name,
      phone: customerData.phone,
      document: customerData.document || null
    });
    setSearchTerm("");
    setShowForm(false);
  };

  const handleQuickAdd = async () => {
    // Check if customer already exists (by phone)
    const existing = customers.find(c => c.phone === manualCustomer.phone);
    if (existing) {
      onCustomerChange({ id: existing.id, name: existing.name, phone: existing.phone });
    } else {
      // Save to customers DB
      const newCustomer = await Customer.create({ name: manualCustomer.name, phone: manualCustomer.phone, is_active: true });
      onCustomerChange({ id: newCustomer.id, name: newCustomer.name, phone: newCustomer.phone });
      loadCustomers();
    }
    setManualCustomer({ name: "", phone: "" });
    setShowForm(false);
  };

  return (
    <Card className={`shadow-lg border-0 ${isMobile ? 'h-full' : ''}`}>
      <CardHeader className="pb-4">
        <CardTitle className={`flex items-center justify-between ${
          isMobile ? 'text-lg' : 'text-xl'
        }`}>
          <div className="flex items-center gap-2">
            {/* Changed Users icon to UserCheck icon as per outline */}
            <UserCheck className={`text-blue-600 ${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
            {isMobile ? 'Cliente' : 'Información del Cliente'}
          </div>
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={() => setShowForm(!showForm)}
            className={isMobile ? 'px-4' : ''}
          >
            {showForm ? "Cerrar" : "Cambiar"}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className={`space-y-4 ${isMobile ? 'h-full overflow-auto pb-20' : ''}`}>
        {!showForm ? (
          // Display current customer when the form is not shown
          <div className={`bg-slate-50 rounded-lg flex items-center justify-between ${
            isMobile ? 'p-4' : 'p-3'
          }`}>
            <div className="flex-1">
              <p className={`font-medium text-slate-900 ${
                isMobile ? 'text-base' : 'text-sm'
              }`}>
                {customer?.name || "Cliente General"}
              </p>
              {customer?.phone && (
                <p className={`text-slate-600 ${
                  isMobile ? 'text-sm' : 'text-xs'
                } mt-1`}>
                  📞 {customer.phone}
                </p>
              )}
              {customer?.document && (
                <p className={`text-slate-600 ${
                  isMobile ? 'text-sm' : 'text-xs'
                }`}>
                  📄 {customer.document}
                </p>
              )}
            </div>
          </div>
        ) : (
          // Customer selection/manual entry form when showForm is true
          <div className="space-y-4">
            {/* Customer Search Input */}
            <div className="space-y-2">
              <Label className={isMobile ? 'text-base' : ''}>
                Buscar Cliente Existente
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre, teléfono o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 ${isMobile ? 'h-12 text-base' : ''}`}
                />
              </div>
            </div>

            {/* Customer Search Results */}
            {searchTerm && filteredCustomers.length > 0 && (
              <div className="border rounded-lg bg-white shadow-sm">
                <div className={`text-xs text-slate-600 font-medium px-3 py-2 bg-slate-50 border-b ${
                  isMobile ? 'text-sm px-4 py-3' : ''
                }`}>
                  Clientes encontrados:
                </div>
                <div className={`max-h-40 overflow-y-auto ${isMobile ? 'max-h-60' : ''}`}>
                  {filteredCustomers.slice(0, 10).map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className={`w-full hover:bg-blue-50 cursor-pointer transition-colors ${
                        isMobile ? 'p-4' : 'p-3'
                      } border-b last:border-b-0 active:bg-blue-100`}
                    >
                      <p className={`font-medium text-slate-900 ${
                        isMobile ? 'text-base' : 'text-sm'
                      }`}>
                        {cust.name}
                      </p>
                      <p className={`text-slate-600 ${
                        isMobile ? 'text-sm' : 'text-xs'
                      }`}>
                        📞 {cust.phone}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {searchTerm && filteredCustomers.length === 0 && (
                <div className={`text-sm text-center text-slate-500 py-4 ${isMobile ? 'text-base' : ''}`}>
                    No se encontraron clientes con "{searchTerm}".
                </div>
            )}

            {/* Manual Customer Form */}
            <div className="border-t pt-4">
              <Label className={`block mb-2 ${
                isMobile ? 'text-base' : ''
              }`}>
                O Ingresar Datos Manualmente
              </Label>
              <div className="space-y-3">
                <Input
                  placeholder="Nombre completo"
                  value={manualCustomer.name}
                  onChange={(e) => setManualCustomer(prev => ({...prev, name: e.target.value}))}
                  className={isMobile ? 'h-12 text-base' : ''}
                />
                <Input
                  placeholder="Teléfono"
                  value={manualCustomer.phone}
                  onChange={(e) => setManualCustomer(prev => ({...prev, phone: e.target.value}))}
                  className={isMobile ? 'h-12 text-base' : ''}
                />
                <Button
                  onClick={handleQuickAdd}
                  disabled={!manualCustomer.name || !manualCustomer.phone}
                  className={`w-full gap-2 ${
                    isMobile ? 'h-12 text-base' : ''
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Usar Estos Datos
                </Button>
              </div>
            </div>

            {/* General Customer Button */}
            <Button
              variant="outline"
              onClick={() => {
                onCustomerChange(null); // Set customer to null to represent a general customer
                setShowForm(false); // Hide the form
                setSearchTerm(""); // Clear search term
              }}
              className={`w-full ${isMobile ? 'h-12 text-base' : ''}`}
            >
              Cliente General (Sin datos)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}