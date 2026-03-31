import React, { useState, useEffect, useCallback } from "react";
import { Customer } from "@/entities/Customer";
import { Plus, Users as UsersIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import CustomerList from "../components/customers/CustomerList";
import CustomerForm from "../components/customers/CustomerForm";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const customersData = await Customer.list("-created_date");
      setCustomers(customersData);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleOpenForm = (customer = null) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingCustomer(null);
    setIsFormOpen(false);
  };

  const handleSaveCustomer = async (customerData) => {
    try {
      if (editingCustomer) {
        await Customer.update(editingCustomer.id, customerData);
      } else {
        await Customer.create(customerData);
      }
      handleCloseForm();
      loadCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
    }
  };

  const handleToggleActive = async (customer) => {
    try {
      await Customer.update(customer.id, { is_active: !customer.is_active });
      loadCustomers();
    } catch (error) {
      console.error("Error toggling customer status:", error);
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar al cliente "${customer.name}"? Esta acción no se puede deshacer.`)) {
      try {
        await Customer.delete(customer.id);
        loadCustomers();
      } catch (error) {
        console.error("Error deleting customer:", error);
      }
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Gestión de Clientes</h1>
            <p className="text-slate-600 mt-1">
              Administra la información de tus clientes frecuentes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadCustomers}
              className="gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UsersIcon className="w-4 h-4" />
              )}
              {isLoading ? "Cargando..." : "Refrescar"}
            </Button>
            <Button
              onClick={() => handleOpenForm()}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Plus className="w-5 h-5" />
              Nuevo Cliente
            </Button>
          </div>
        </div>

        {/* Customer List */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-0">
            <CustomerList
              customers={filteredCustomers}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onEditCustomer={handleOpenForm}
              onToggleActive={handleToggleActive}
              onDeleteCustomer={handleDeleteCustomer}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}