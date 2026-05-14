/**
 * publicEntities.js
 * Exports de entidades que usan el portal público (/api/portal) sin autenticación.
 * Compatibles en interfaz con @/entities/all para los portales de planillador y operarios.
 */
import { portalClient } from './portalClient';

const p = portalClient.entities;

export const Employee       = p.Employee;
export const Delivery       = p.Delivery;
export const Dispatch       = p.Dispatch;
export const Payment        = p.Payment;
export const PaymentRequest = p.PaymentRequest;
export const EmployeePurchase = p.EmployeePurchase;
export const Producto       = p.Producto;
export const AppConfig      = p.AppConfig;
export const Inventory      = p.Inventory;
export const StockMovement  = p.StockMovement;
export const Devolucion     = p.Devolucion;
export const ActivityLog    = p.ActivityLog;
export const Remision       = p.Remision;
export const OrdenServicio  = p.OrdenServicio;
