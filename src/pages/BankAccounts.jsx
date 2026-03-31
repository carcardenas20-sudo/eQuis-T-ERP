import React, { useState, useEffect, useCallback } from "react";
import { BankAccount } from "@/entities/BankAccount";
import { Plus, Building2, Loader2, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

import BankAccountForm from "../components/settings/BankAccountForm";

export default function BankAccountsPage() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const loadBankAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const accounts = await BankAccount.list("-created_date");
      setBankAccounts(accounts);
    } catch (error) {
      console.error("Error loading bank accounts:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts]);

  const handleSave = async (accountData) => {
    try {
      if (editingAccount) {
        await BankAccount.update(editingAccount.id, accountData);
      } else {
        await BankAccount.create(accountData);
      }
      setIsFormOpen(false);
      setEditingAccount(null);
      loadBankAccounts();
    } catch (error) {
      console.error("Error saving bank account:", error);
    }
  };

  const handleToggleActive = async (account) => {
    try {
      await BankAccount.update(account.id, { is_active: !account.is_active });
      loadBankAccounts();
    } catch (error) {
      console.error("Error toggling account status:", error);
    }
  };

  const handleDelete = async (account) => {
    if (window.confirm(`¿Seguro que quieres eliminar la cuenta de ${account.name}?`)) {
      try {
        await BankAccount.delete(account.id);
        loadBankAccounts();
      } catch (error) {
        console.error("Error deleting bank account:", error);
      }
    }
  };

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cuentas Bancarias</h1>
            <p className="text-slate-600 mt-1">Gestiona las cuentas para recibir transferencias.</p>
          </div>
          <Button 
            onClick={() => { setEditingAccount(null); setIsFormOpen(true); }} 
            className="gap-2"
          >
            <Plus className="w-5 h-5" /> 
            Nueva Cuenta
          </Button>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : bankAccounts.map((account) => (
            <Card key={account.id} className="shadow-sm border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{account.name}</div>
                      <div className="text-sm text-slate-500 truncate">{account.holder_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={account.is_active ? "default" : "destructive"} className={account.is_active ? "bg-emerald-500" : ""}>
                      {account.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingAccount(account); setIsFormOpen(true); }}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                          {account.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</> : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(account)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <code className="bg-gray-100 px-2 py-1 rounded">{account.account_number}</code>
                  <Badge variant="outline" className="capitalize">{account.account_type}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop table */}
        <Card className="shadow-lg border-0 hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Banco</TableHead>
                  <TableHead>Número de Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                    </TableCell>
                  </TableRow>
                ) : (
                  bankAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="font-medium text-slate-900">{account.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">{account.account_number}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{account.account_type}</Badge>
                      </TableCell>
                      <TableCell>{account.holder_name}</TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "destructive"} className={account.is_active ? "bg-emerald-500" : ""}>
                          {account.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingAccount(account); setIsFormOpen(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                              {account.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> Desactivar</> : <><Eye className="w-4 h-4 mr-2" /> Activar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(account)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {isFormOpen && (
          <BankAccountForm
            account={editingAccount}
            onSave={handleSave}
            onCancel={() => { setIsFormOpen(false); setEditingAccount(null); }}
          />
        )}
      </div>
    </div>
  );
}