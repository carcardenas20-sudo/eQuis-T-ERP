import React from "react";
import { AnimatedNumber } from "@/components/motion";

/**
 * Tarjeta de KPI con gradiente vivo, número animado e ícono en vidrio
 * esmerilado. Componente compartido para mantener el mismo lenguaje visual
 * en Dashboard, Ventas, Inventario, etc.
 *
 * Props:
 *  - label:  título corto
 *  - value:  número (se anima contando) o string (se muestra tal cual)
 *  - icon:   componente de ícono (lucide)
 *  - tone:   emerald | blue | purple | amber | orange | red | sky | violet
 *  - sub:    texto secundario opcional
 *  - format: función para formatear el número (ej. moneda)
 */
export const KPI_TONES = {
  emerald: "from-emerald-500 to-teal-600",
  blue: "from-blue-500 to-indigo-600",
  purple: "from-purple-500 to-fuchsia-600",
  amber: "from-amber-500 to-orange-600",
  orange: "from-orange-500 to-rose-600",
  red: "from-rose-500 to-red-600",
  sky: "from-sky-500 to-cyan-600",
  violet: "from-violet-500 to-purple-600",
};

export default function KpiCard({ label, value, icon: Icon, tone = "blue", sub, format }) {
  const isNum = typeof value === "number";
  const grad = KPI_TONES[tone] || KPI_TONES.blue;
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white bg-gradient-to-br ${grad} shadow-lg hover-lift h-full`}>
      {/* Brillo decorativo */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/15 blur-sm" />
      <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-black/10" />
      <div className="relative flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-white/85 mb-1.5 leading-tight">{label}</p>
          <p className="text-2xl sm:text-4xl font-extrabold tracking-tight tabular-nums break-all drop-shadow">
            {isNum ? <AnimatedNumber value={value} format={format} duration={1.4} /> : value}
          </p>
          {sub && <p className="text-[11px] sm:text-xs text-white/75 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="bg-white/25 backdrop-blur-sm p-2.5 sm:p-3 rounded-xl shrink-0 shadow-inner ring-1 ring-white/30">
            <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
