# eQuis-T Sistema Unificado

## Overview
A unified enterprise application consolidating three business apps into a fully self-hosted stack:
- **Comercial** (equistpos): POS, Sales, Inventory, Finance, Purchases, Credits, Bank Accounts
- **Producción** (chaquetas-pro): Remisiones, Raw Materials, Budgeting, Colors, Products
- **Operarios** (produccionequist): Employees, Deliveries, Dispatches, Payments

## Tech Stack
- **Frontend**: React 18 + Vite 6
- **Backend**: Express.js (port 3001)
- **Database**: PostgreSQL (Replit built-in)
- **Auth**: JWT (bcryptjs) — local, no external dependency
- **Styling**: Tailwind CSS + Radix UI (shadcn/ui) — Inter font, indigo primary palette
- **State/Data**: TanStack Query v5
- **Package Manager**: npm

## UI Design
- **Font**: Inter (Google Fonts) — loaded via index.html
- **Primary color**: Indigo (`#4f46e5` / `hsl 243 75% 59%`)
- **Login**: Split layout — dark indigo gradient left panel (branding) + white form right panel
- **Sidebar**: Dark navy (`hsl 229 84% 5%`) with per-module colored accents (indigo=comercial, emerald=producción, violet=operarios)
- **Dark mode**: Supported via `.dark` class on `<html>`

## Architecture
- All Base44 SDK dependencies removed. Fully self-hosted.
- `src/api/localClient.js` — unified API client replacing all Base44 SDK calls
- `src/api/base44Client.js` — stub that re-exports `localClient` (backward compat for pages not yet fully refactored)
- `src/entities/all.js` — barrel export of all entity types (generic CRUD via localClient)
- `src/entities/*.js` — individual entity stubs re-exporting from `all.js`
- `src/integrations/Core.js` — UploadFile stub using local `/api/upload`
- `src/functions/logActivity.js` — activity logging via local DB
- `src/agents/index.js` — agentSDK stub (Base44 AI agents no longer available)

## Unified Product Architecture (Single Source of Truth)

### Producto entity (Producción module — SOLE CREATION POINT)
- All products are created ONLY in Producción → `Producto` entity
- Fields: `nombre`, `reference` (short code e.g. "001"–"004"), `familia_id` (links to POS Product), `costo_mano_obra`, `precio_venta`
- Active dispatch variants: Embone (001), Neo (002), Unicolor (003), Chulo (004)
- Future variants: Colombia Amarilla (005), Ovejera (006)

### Product entity (POS/Comercial — Familias Comerciales)
- Commercial groups used at point of sale: Hombre ($50K), Colombia ($70K), Doble Faz ($65K), Promo 20 ($20K)
- Multiple `Producto` variants map to one `Product` family via `familia_id`

### Inventory (Operarios module)
- Records linked to `Producto` via `producto_id` AND `product_reference` (short code, backward-compat)
- All operario inventory has `location: 'bodega_operarios'`
- Dispatch/Delivery records use `product_reference` short codes (unchanged, backward-compat)

### Normalization pattern (operario pages)
```js
// Producto → compatible with operario module components
productos.map(p => ({ ...p, name: p.nombre, is_active: true }))
```

## Permission & Role Structure

### Permissions by module
- **Comercial**: `pos_sales`, `sales_view`, `products_view/create/edit/delete`, `inventory_view/adjust/transfer/receive`, `customers_view/create/edit/delete`, `credits_view/create/collect/modify`, `expenses_view/create/edit/delete`, `reports_basic/advanced/financial/export`, `accounting_view_transactions/manage_bank_accounts/reconcile`, `users_*`, `locations_*`, `settings_*`, `purchases_view/create`, `agent_access`
- **Operarios**: `operarios_view` (read + basic ops), `operarios_admin` (employees, payments, bank transfers, audit)
- **Producción**: `produccion_view` (full production access), `produccion_pipeline_view` (read-only: Remisiones + Planificador + Presupuestos)

### Roles
| Rol | Módulos visibles |
|-----|----------------|
| Administrador | Todos (64 permisos) |
| Gerente | Comercial completo + pipeline producción |
| Gerente de Tienda | Comercial (su sucursal) + pipeline producción |
| Líder de Punto | POS + inventario + clientes + créditos |
| Vendedor | Ventas + clientes |
| Cajero | POS básico |
| Cajero Básico | POS mínimo |
| Bodeguero | Inventario |
| **Planillador** (nuevo) | Operarios completo + pipeline producción |

### Unified Dashboard (`/Dashboard`)
Adapts sections by role:
- **Sección Comercial**: visible si `pos_sales` o `sales_view` → ventas del día, caja, créditos
- **Sección Pipeline de Producción**: visible si `produccion_pipeline_view` o `produccion_view` → presupuestos por estado, remisiones recientes
- **Sección Operarios**: visible si `operarios_view` → despachos, solicitudes de pago

### Special access portals (no full login required)
- `Op_EmployeePortal` — employee accesses via `?employeeId=XXX` in URL
- `Op_RoutePortal` — planillador route management

## Data
- 5,911 records exported from all 3 Base44 apps before deletion
- Stored in PostgreSQL `app_entities` table (JSONB)
- Import script: `node scripts/import-to-postgres.js`

## Admin Bootstrap Account
- **Email**: `admin@equist.local`
- **Password**: Set via `ADMIN_PASSWORD` env var before running `import-to-postgres.js`.
  If not set, a random 16-char password is generated and printed to stdout once.
  Change the password after the first login. This account is created only on fresh import.

## Development
- Run: `npm run dev` — starts both Express API (port 3001) and Vite (port 5000) via concurrently
- API health: `GET /api/health`
- Auth: `POST /api/auth/login`, `GET /api/auth/me`
- Entities: `GET/POST/PUT/DELETE /api/entities/:type`
- Upload: `POST /api/upload`

## Project Structure
- `server/` — Express.js backend
  - `server/index.js` — main server + DB schema
  - `server/db.js` — PostgreSQL pool
  - `server/routes/auth.js` — JWT auth routes
  - `server/routes/entities.js` — generic CRUD
  - `server/routes/upload.js` — file uploads (multer)
- `src/pages/` — React pages
  - No prefix: Commercial/POS module
  - `Prod_` prefix: Production module
  - `Op_` prefix: Operators module
- `src/components/` — UI components
- `scripts/` — utility scripts
  - `scripts/exports/` — Base44 JSON exports (5,911 records)
  - `scripts/import-to-postgres.js` — import script

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (Replit auto-provides)
- `SESSION_SECRET` — JWT signing key (set as a Replit secret; persists across restarts)
- `JWT_SECRET` — fallback JWT key if SESSION_SECRET not set (deprecated)
