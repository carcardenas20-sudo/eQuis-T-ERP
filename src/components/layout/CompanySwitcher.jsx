import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Combined";
import { getActiveCompany, setActiveCompany } from "@/api/localClient";
import { Building2 } from "lucide-react";

const DEFAULT_ID = "equist"; // Empresa 1 = eQuis-T

// Selector de empresa para el super-admin. Cambia el contexto de TODO el sistema
// (manda X-Company-Id en cada petición). Se oculta si solo hay una empresa.
export default function CompanySwitcher({ isAdmin }) {
  const [companies, setCompanies] = useState([]);
  const active = getActiveCompany() || DEFAULT_ID;

  useEffect(() => {
    if (!isAdmin) return;
    base44.entities.Company.list()
      .then(list => {
        const activas = (list || []).filter(c => c.is_active !== false);
        setCompanies(activas);
        // Empresa guardada que ya no existe (o el antiguo ámbito "Común") → volver a eQuis-T.
        if (activas.length && active !== DEFAULT_ID && !activas.some(c => c.id === active)) {
          setActiveCompany("");
          window.location.reload();
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  // Solo para admin y solo si hay más de una empresa real.
  if (!isAdmin || companies.length <= 1) return null;

  const onChange = (id) => {
    // 'equist' es el default → sin header; el resto se guarda y se manda.
    setActiveCompany(id === DEFAULT_ID ? "" : id);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 bg-white border-slate-200" title="Empresa activa">
      <Building2 className="w-4 h-4 shrink-0 text-slate-500" />
      <select
        value={active}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[160px]"
      >
        {companies.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
