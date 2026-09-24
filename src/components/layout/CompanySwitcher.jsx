import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Combined";
import { getActiveCompany, setActiveCompany } from "@/api/localClient";
import { Building2 } from "lucide-react";

// Ámbito virtual "Común" (grupo): empleados y gastos compartidos por las empresas.
const COMUN = { id: "comun", name: "Común (grupo)" };
const DEFAULT_ID = "equist"; // Empresa 1 = eQuis-T

// Selector de empresa para el super-admin. Cambia el contexto de TODO el sistema
// (manda X-Company-Id en cada petición). Se oculta si solo hay una empresa.
export default function CompanySwitcher({ isAdmin }) {
  const [companies, setCompanies] = useState([]);
  const active = getActiveCompany() || DEFAULT_ID;

  useEffect(() => {
    if (!isAdmin) return;
    base44.entities.Company.list()
      .then(list => setCompanies((list || []).filter(c => c.is_active !== false)))
      .catch(() => {});
  }, [isAdmin]);

  // Solo para admin y solo si hay más de una empresa real.
  if (!isAdmin || companies.length <= 1) return null;

  const onChange = (id) => {
    // 'equist' es el default → sin header; el resto se guarda y se manda.
    setActiveCompany(id === DEFAULT_ID ? "" : id);
    window.location.reload();
  };

  const options = [...companies, COMUN];
  const isComun = active === COMUN.id;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
        isComun ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"
      }`}
      title="Empresa activa"
    >
      <Building2 className={`w-4 h-4 shrink-0 ${isComun ? "text-amber-600" : "text-slate-500"}`} />
      <select
        value={active}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[160px]"
      >
        {options.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
