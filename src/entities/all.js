import { localClient } from '@/api/localClient';

function makeEntity(type) {
  return {
    list: (orderBy, limit) => localClient.entities[type].list(orderBy, limit),
    filter: (query, orderBy, limit) => localClient.entities[type].filter(query, orderBy, limit),
    get: (id) => localClient.entities[type].get(id),
    create: (data) => localClient.entities[type].create(data),
    update: (id, data) => localClient.entities[type].update(id, data),
    delete: (id) => localClient.entities[type].delete(id),
  };
}

export const AccountPayable = makeEntity('AccountPayable');
export const BankAccount = makeEntity('BankAccount');
export const Color = makeEntity('Color');
export const Credit = makeEntity('Credit');
export const Customer = makeEntity('Customer');
export const Expense = makeEntity('Expense');
export const ExpenseTask = makeEntity('ExpenseTask');
export const ExpenseTemplate = makeEntity('ExpenseTemplate');
export const Inventory = makeEntity('Inventory');
export const InventoryMovement = makeEntity('InventoryMovement');
export const Inventario = makeEntity('Inventario');
export const Location = makeEntity('Location');
export const MateriaPrima = makeEntity('MateriaPrima');
export const PayableInstallment = makeEntity('PayableInstallment');
export const PayablePayment = makeEntity('PayablePayment');
export const Payment = makeEntity('Payment');
export const PriceList = makeEntity('PriceList');
export const Product = makeEntity('Product');
export const ProductCategory = makeEntity('ProductCategory');
export const ProductPrice = makeEntity('ProductPrice');
export const Producto = makeEntity('Producto');
export const Proveedor = makeEntity('Proveedor');
export const Purchase = makeEntity('Purchase');
export const PurchaseItem = makeEntity('PurchaseItem');
export const Role = makeEntity('Role');
export const Sale = makeEntity('Sale');
export const SaleItem = makeEntity('SaleItem');
export const StockMovement = makeEntity('StockMovement');
export const SyncInbox = makeEntity('SyncInbox');
export const SystemSettings = makeEntity('SystemSettings');

// User entity: CRUD + auth methods (me, logout) for compatibility with all pages
export const User = {
  ...makeEntity('User'),
  me: () => localClient.auth.me(),
  logout: () => localClient.auth.logout(),
};

export const Remision = makeEntity('Remision');
export const Operacion = makeEntity('Operacion');
export const Presupuesto = makeEntity('Presupuesto');
export const Compra = makeEntity('Compra');
export const Devolucion = makeEntity('Devolucion');
export const Employee = makeEntity('Employee');
export const Delivery = makeEntity('Delivery');
export const Dispatch = makeEntity('Dispatch');
export const EmployeePurchase = makeEntity('EmployeePurchase');
export const PaymentRequest = makeEntity('PaymentRequest');
export const ActivityLog = makeEntity('ActivityLog');
export const AppConfig = makeEntity('AppConfig');

export const Supplier = makeEntity('Supplier');
export const CashControl = makeEntity('CashControl');
export const Exchange = makeEntity('Exchange');
export const HoldCart = makeEntity('HoldCart');
export const InventoryAudit = makeEntity('InventoryAudit');
export const InventoryAuditItem = makeEntity('InventoryAuditItem');
