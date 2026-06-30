/**
 * Sistema de movimiento global de eQuis-T.
 *
 * Primitivas reutilizables construidas sobre framer-motion. Todas respetan
 * `prefers-reduced-motion`: si el usuario lo activa en su sistema, las
 * animaciones se desactivan y el contenido aparece de inmediato.
 *
 * Uso típico:
 *   import { Stagger, StaggerItem, AnimatedNumber, Pressable, FadeIn } from "@/components/motion";
 *
 *   <Stagger className="grid grid-cols-3 gap-3">
 *     {items.map(it => (
 *       <StaggerItem key={it.id}><Card>...</Card></StaggerItem>
 *     ))}
 *   </Stagger>
 */
import React, { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  animate,
} from "framer-motion";

/* ── Presets ─────────────────────────────────────────────────────────── */

// Curva "ease-out expo": entra rápido y se asienta suave. Se siente premium.
export const EASE = [0.16, 1, 0.3, 1];

// Resorte suave para movimientos que reaccionan a interacción.
export const SPRING = { type: "spring", stiffness: 380, damping: 30, mass: 0.8 };

export const DURATION = { fast: 0.18, base: 0.32, slow: 0.5 };

/* ── Variants compartidas ────────────────────────────────────────────── */

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
};

export const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE } },
};

const staggerContainer = (stagger = 0.05, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/* ── Stagger: contenedor que revela a sus hijos en cascada ───────────── */

export function Stagger({
  children,
  className,
  stagger = 0.05,
  delay = 0,
  as = "div",
  ...props
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className} {...props}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      animate="show"
      {...props}
    >
      {children}
    </MotionTag>
  );
}

/* ── StaggerItem: cada hijo de un <Stagger> ──────────────────────────── */

export function StaggerItem({
  children,
  className,
  variant = fadeUp,
  as = "div",
  ...props
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className} {...props}>{children}</Tag>;
  }

  return (
    <MotionTag className={className} variants={variant} {...props}>
      {children}
    </MotionTag>
  );
}

/* ── FadeIn: aparición simple al montar (sin necesidad de contenedor) ── */

export function FadeIn({
  children,
  className,
  variant = fadeUp,
  delay = 0,
  as = "div",
  ...props
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className} {...props}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={variant}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      {...props}
    >
      {children}
    </MotionTag>
  );
}

/* ── Pressable: feedback táctil en botones/cards clicables ───────────── */

export function Pressable({
  children,
  className,
  as = "button",
  lift = false, // true => se eleva levemente al pasar el mouse
  ...props
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.button;

  if (reduce) {
    const Tag = as;
    return <Tag className={className} {...props}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      whileTap={{ scale: 0.97 }}
      whileHover={lift ? { y: -2 } : undefined}
      transition={SPRING}
      {...props}
    >
      {children}
    </MotionTag>
  );
}

/* ── AnimatedNumber: número que "cuenta" hacia su valor ──────────────── */

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("es-CO"),
  duration = 0.9,
  className,
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(() => format(0));

  useEffect(() => {
    const target = Number(value) || 0;
    if (reduce) {
      setDisplay(format(target));
      return;
    }
    const unsub = mv.on("change", (v) => setDisplay(format(v)));
    const controls = animate(mv, target, { duration, ease: EASE });
    return () => {
      controls.stop();
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return <span className={className}>{display}</span>;
}

/* ── Re-exports útiles ───────────────────────────────────────────────── */

export { motion, AnimatePresence, useReducedMotion };
