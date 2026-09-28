import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Combined";
import { getActiveCompany } from "@/api/localClient";
import { SystemSettings, Location } from "@/entities/all";
import { useSession } from "@/components/providers/SessionProvider";

const DEFAULT_ID = "equist"; // Empresa 1 = eQuis-T

// Id de la empresa en la que se está trabajando: el admin elige con el selector
// (guardado en localStorage); el resto de usuarios siempre trabaja en la suya.
export function getCurrentCompanyId(currentUser, isAdmin) {
  if (isAdmin) return getActiveCompany() || DEFAULT_ID;
  return currentUser?.company_id || DEFAULT_ID;
}

// La lista de empresas cambia muy poco: se pide una vez por carga de página.
let companiesPromise = null;
function loadCompanies() {
  if (!companiesPromise) {
    companiesPromise = base44.entities.Company.list().catch(() => {
      companiesPromise = null;
      return [];
    });
  }
  return companiesPromise;
}

// Registro de la empresa activa (name, display_name, nit, brand_color, …) o null mientras carga.
export function useActiveCompany() {
  const { currentUser, isRealAdmin } = useSession();
  const [company, setCompany] = useState(null);
  const id = currentUser ? getCurrentCompanyId(currentUser, isRealAdmin) : null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadCompanies().then(list => {
      if (!cancelled) setCompany((list || []).find(c => c.id === id) || null);
    });
    return () => { cancelled = true; };
  }, [id]);

  return company;
}

// Datos de encabezado para recibos/facturas: la Configuración del Sistema de la
// empresa manda; lo que falte se completa con el registro de la empresa.
// locationName = punto de venta (sucursal) donde se hizo la venta.
export function buildCompanyInfo(settings, company, locationName) {
  const s = settings || {};
  const c = company || {};
  return {
    locationName: locationName || "",
    name: s.company_name || c.display_name || c.name || "eQuis-T",
    address: s.company_address || "Dirección no configurada",
    document: s.company_document || c.nit || "NIT no configurado",
    phone: s.company_phone || "Teléfono no configurado",
    email: s.company_email || "",
    receiptHeader: s.receipt_header || "",
    receiptFooter: s.receipt_footer || "¡Gracias por su compra!",
  };
}

// Configuración del sistema + sucursales, para armar el encabezado de una factura
// desde cualquier lista (p. ej. el botón de WhatsApp en la tabla de ventas).
let invoiceCtxPromise = null;
function loadInvoiceCtx() {
  if (!invoiceCtxPromise) {
    invoiceCtxPromise = Promise.all([
      SystemSettings.list().catch(() => []),
      Location.list().catch(() => []),
    ]).then(([settings, locations]) => ({
      settings: (settings || [])[0] || null,
      locations: Object.fromEntries((locations || []).map(l => [l.id, l.name])),
    }));
  }
  return invoiceCtxPromise;
}

export function useInvoiceCompanyInfo() {
  const company = useActiveCompany();
  const [ctx, setCtx] = useState({ settings: null, locations: {} });
  useEffect(() => { loadInvoiceCtx().then(setCtx); }, []);
  const locationNameOf = (locationId) => ctx.locations[locationId] || "";
  const companyInfoFor = (locationId) => buildCompanyInfo(ctx.settings, company, locationNameOf(locationId));
  return { companyInfoFor, locationNameOf };
}
