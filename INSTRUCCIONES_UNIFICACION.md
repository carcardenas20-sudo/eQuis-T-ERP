# 🔗 Sistema Unificado eQuis-T — Instrucciones de Configuración

## ¿Qué se unificó?
Este proyecto fusiona tres apps de Base44 en una sola:
- **Comercial** (equistpos): POS, Ventas, Inventario, Finanzas
- **Producción** (chaquetas-pro): Remisiones, Materias primas, Presupuestos
- **Operarios** (produccionequist): Empleados, Entregas, Despachos, Pagos

---

## 1. Permisos nuevos a agregar en Base44

Ve a **Settings → Roles** en el app unificado y agrega los siguientes permisos a los roles correspondientes:

### Módulo Producción
| Permiso | Descripción |
|---|---|
| `produccion_view` | Acceso completo al módulo de producción y chaquetas |

### Módulo Operarios
| Permiso | Descripción |
|---|---|
| `operarios_view` | Acceso básico al módulo de operarios (ver entregas, cotizador, etc.) |
| `operarios_admin` | Acceso administrativo al módulo de operarios (empleados, pagos, transferencias) |

---

## 2. Cómo asignar permisos por rol

### Rol: Administrador (admin)
- Ve automáticamente **todo** (no necesita permisos adicionales).

### Rol: Encargado de Producción
Asignar permiso: `produccion_view`

### Rol: Supervisor de Operarios
Asignar permisos: `operarios_view`, `operarios_admin`

### Rol: Operario (empleado de producción)
Asignar permiso: `operarios_view`

### Rol: Vendedor / Cajero
Mantener permisos actuales (`pos_sales`, `sales_view`, etc.)

---

## 3. Páginas públicas (sin login)
Las siguientes páginas no requieren autenticación y siguen siendo accesibles:
- `/Op_EmployeePortal` — Portal del empleado
- `/Op_EmployeeProfile` — Perfil del empleado  
- `/Op_RoutePortal` — Portal de ruta
- `/Prod_EstadoCuentaPublico` — Estado de cuenta público

---

## 4. Subir a Base44
1. Descomprime el ZIP en tu repositorio (reemplaza los archivos existentes de equistpos)
2. Ejecuta `npm install`
3. Ejecuta `npm run dev` para probar localmente
4. En Base44, haz clic en **Publish**

---

## 5. Estructura de archivos
- Páginas del módulo Producción tienen prefijo `Prod_` (ej: `Prod_Remisiones`)
- Páginas del módulo Operarios tienen prefijo `Op_` (ej: `Op_Dashboard`)
- Páginas del módulo Comercial no tienen prefijo (sin cambios)
