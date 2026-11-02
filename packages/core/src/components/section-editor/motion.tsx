"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/**
 * Shared framer-motion primitives for the bespoke landing sections.
 *
 * All motion is opt-out: pass `disabled` (sections pass `isEditMode`) and the
 * primitive renders a plain element with no animation, so the editor stays
 * static and light. `prefers-reduced-motion` is also honoured automatically.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

interface RevealProps {
  children: ReactNode;
  disabled?: boolean;
  delay?: number;
  y?: number;
  x?: number;
  once?: boolean;
  amount?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}

/** Fade + slide a block into view once it scrolls into the viewport. */
export function Reveal({
  children,
  disabled = false,
  delay = 0,
  y = 24,
  x = 0,
  once = true,
  amount = 0.2,
  duration = 0.6,
  className,
  style,
}: RevealProps) {
  const reduce = useReducedMotion();
  if (disabled || reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: ReactNode;
  disabled?: boolean;
  gap?: number;
  amount?: number;
  className?: string;
  style?: CSSProperties;
}

/** Parent that reveals its <StaggerItem/> children one after another. */
export function Stagger({
  children,
  disabled = false,
  gap = 0.09,
  amount = 0.2,
  className,
  style,
}: StaggerProps) {
  const reduce = useReducedMotion();
  if (disabled || reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  y?: number;
  className?: string;
  style?: CSSProperties;
}

export function StaggerItem({ children, y = 20, className, style }: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

interface FloatProps {
  children: ReactNode;
  disabled?: boolean;
  amount?: number;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/** Gentle continuous bobbing for decorative hero elements. */
export function Float({
  children,
  disabled = false,
  amount = 12,
  duration = 6,
  delay = 0,
  className,
  style,
}: FloatProps) {
  const reduce = useReducedMotion();
  if (disabled || reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      animate={{ y: [0, -amount, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
