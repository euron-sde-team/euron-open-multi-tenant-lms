"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Thin React wrapper around MathLive's <math-field> custom element.
 *
 * MathLive renders an interactive WYSIWYG math editor: type "1/2" and a
 * fraction appears, "x^2" gets a superscript, etc. The on-focus virtual
 * keyboard exposes Greek letters, calculus operators, set theory, and so
 * on, so authors don't need to know the LaTeX. The value is round-tripped
 * as LaTeX, which is what we save.
 */
interface MathFieldProps {
  value: string;
  onChange: (latex: string) => void;
  className?: string;
  placeholder?: string;
}

/** Imperative methods exposed via ref so parent toolbars can drive the editor. */
export interface MathFieldHandle {
  /** Insert a LaTeX template at the cursor. Use `#@` for current selection
   *  and `#?` for editable placeholders that the user tabs through. */
  insert: (template: string) => void;
  focus: () => void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { placeholder?: string };
    }
  }
}

// MathLive registers `customElements.define("math-field", ...)` on import.
// That call is browser-only, so we lazy-import inside useEffect.
let mathliveLoaded: Promise<void> | null = null;
function loadMathLive(): Promise<void> {
  if (mathliveLoaded) return mathliveLoaded;
  mathliveLoaded = import("mathlive").then(() => undefined);
  return mathliveLoaded;
}

export const MathField = forwardRef<MathFieldHandle, MathFieldProps>(
  function MathField({ value, onChange, className, placeholder }, ref) {
    const elRef = useRef<HTMLElement>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useImperativeHandle(
      ref,
      () => ({
        insert(template: string) {
          const el = elRef.current as unknown as
            | { executeCommand: (cmd: unknown) => void; focus: () => void }
            | null;
          if (!el) return;
          el.focus();
          // MathLive accepts ["insert", "<latex>", { format, selectionMode }]
          el.executeCommand([
            "insert",
            template,
            { format: "latex", selectionMode: "placeholder" },
          ]);
        },
        focus() {
          (elRef.current as unknown as { focus: () => void } | null)?.focus();
        },
      }),
      [],
    );

    // One-time load + bind input listener.
    useEffect(() => {
      let cancelled = false;
      loadMathLive().then(() => {
        if (cancelled) return;
        const el = elRef.current as unknown as HTMLElement & { value: string };
        if (!el) return;
        // Ensure initial value is applied after the custom element upgrades.
        if (el.value !== value) el.value = value;
        const handler = () => {
          const latex = (el as unknown as { value: string }).value ?? "";
          onChangeRef.current(latex);
        };
        el.addEventListener("input", handler);
        return () => el.removeEventListener("input", handler);
      });
      return () => {
        cancelled = true;
      };
      // We deliberately don't include `value` here, see the dedicated effect below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the element value in sync when the prop changes externally
    // (e.g. clicking a formula library entry).
    useEffect(() => {
      const el = elRef.current as unknown as { value?: string } | null;
      if (!el) return;
      if (el.value !== value) {
        el.value = value;
      }
    }, [value]);

    return (
      <math-field
        ref={elRef as unknown as React.Ref<HTMLElement>}
        placeholder={placeholder}
        className={cn(
          "block w-full rounded-md border bg-white px-3 py-3 text-lg shadow-sm",
          "min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-400",
          className,
        )}
      />
    );
  },
);
