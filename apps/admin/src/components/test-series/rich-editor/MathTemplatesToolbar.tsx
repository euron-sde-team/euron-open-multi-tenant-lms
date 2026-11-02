"use client";

import { Button } from "@open-mtlms/core";
import katex from "katex";
import type { RefObject } from "react";

import { cn } from "@/lib/utils";

import type { MathFieldHandle } from "./MathField";

interface MathTemplatesToolbarProps {
  mathfieldRef: RefObject<MathFieldHandle>;
  className?: string;
}

interface TemplateGroup {
  name: string;
  items: Array<{
    /** What renders on the button: KaTeX-rendered preview when starts with "$",
     *  plain text otherwise. */
    label: string;
    title: string;
    /** LaTeX template. `#@` = current selection, `#?` = editable placeholder
     *  (cursor lands on the first one, Tab moves through the rest). */
    template: string;
  }>;
}

const TEMPLATES: TemplateGroup[] = [
  {
    name: "Structures",
    items: [
      { label: "$\\frac{a}{b}$", title: "Fraction", template: "\\frac{#@}{#?}" },
      { label: "$\\sqrt{x}$", title: "Square root", template: "\\sqrt{#@}" },
      { label: "$\\sqrt[n]{x}$", title: "Nth root", template: "\\sqrt[#?]{#@}" },
      { label: "$x^{n}$", title: "Power / superscript", template: "{#@}^{#?}" },
      { label: "$x_{n}$", title: "Subscript", template: "{#@}_{#?}" },
      { label: "$x_{n}^{m}$", title: "Sub + superscript", template: "{#@}_{#?}^{#?}" },
      { label: "|x|", title: "Absolute value", template: "\\left|#@\\right|" },
      { label: "(x)", title: "Parentheses", template: "\\left(#@\\right)" },
    ],
  },
  {
    name: "Calculus",
    items: [
      { label: "$\\int$", title: "Integral", template: "\\int #@ \\, d#?" },
      {
        label: "$\\int_{a}^{b}$",
        title: "Definite integral",
        template: "\\int_{#?}^{#?} #@ \\, d#?",
      },
      {
        label: "$\\sum$",
        title: "Summation",
        template: "\\sum_{#?}^{#?} #@",
      },
      { label: "$\\prod$", title: "Product", template: "\\prod_{#?}^{#?} #@" },
      {
        label: "$\\lim$",
        title: "Limit",
        template: "\\lim_{#? \\to #?} #@",
      },
      {
        label: "$\\frac{d}{dx}$",
        title: "Derivative",
        template: "\\frac{d}{d#?} #@",
      },
      {
        label: "$\\frac{\\partial}{\\partial x}$",
        title: "Partial derivative",
        template: "\\frac{\\partial #@}{\\partial #?}",
      },
    ],
  },
  {
    name: "Greek",
    items: [
      { label: "$\\alpha$", title: "alpha", template: "\\alpha" },
      { label: "$\\beta$", title: "beta", template: "\\beta" },
      { label: "$\\gamma$", title: "gamma", template: "\\gamma" },
      { label: "$\\delta$", title: "delta", template: "\\delta" },
      { label: "$\\theta$", title: "theta", template: "\\theta" },
      { label: "$\\lambda$", title: "lambda", template: "\\lambda" },
      { label: "$\\mu$", title: "mu", template: "\\mu" },
      { label: "$\\pi$", title: "pi", template: "\\pi" },
      { label: "$\\sigma$", title: "sigma", template: "\\sigma" },
      { label: "$\\phi$", title: "phi", template: "\\phi" },
      { label: "$\\omega$", title: "omega", template: "\\omega" },
      { label: "$\\Delta$", title: "Delta (capital)", template: "\\Delta" },
      { label: "$\\Sigma$", title: "Sigma (capital)", template: "\\Sigma" },
      { label: "$\\Omega$", title: "Omega (capital)", template: "\\Omega" },
    ],
  },
  {
    name: "Operators",
    items: [
      { label: "$\\pm$", title: "Plus or minus", template: "\\pm" },
      { label: "$\\cdot$", title: "Multiply (dot)", template: "\\cdot" },
      { label: "$\\times$", title: "Multiply (×)", template: "\\times" },
      { label: "$\\div$", title: "Divide", template: "\\div" },
      { label: "$\\leq$", title: "Less than or equal", template: "\\leq" },
      { label: "$\\geq$", title: "Greater than or equal", template: "\\geq" },
      { label: "$\\neq$", title: "Not equal", template: "\\neq" },
      { label: "$\\approx$", title: "Approximately", template: "\\approx" },
      { label: "$\\to$", title: "Right arrow", template: "\\to" },
      { label: "$\\Rightarrow$", title: "Implies", template: "\\Rightarrow" },
      { label: "$\\infty$", title: "Infinity", template: "\\infty" },
      { label: "$\\in$", title: "Element of", template: "\\in" },
    ],
  },
  {
    name: "Matrices",
    items: [
      {
        label: "(2×2)",
        title: "2×2 matrix",
        template:
          "\\begin{pmatrix} #@ & #? \\\\ #? & #? \\end{pmatrix}",
      },
      {
        label: "(3×3)",
        title: "3×3 matrix",
        template:
          "\\begin{pmatrix} #@ & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}",
      },
      {
        label: "{cases}",
        title: "Piecewise (cases)",
        template:
          "\\begin{cases} #@ & \\text{if } #? \\\\ #? & \\text{otherwise} \\end{cases}",
      },
    ],
  },
];

export function MathTemplatesToolbar({
  mathfieldRef,
  className,
}: MathTemplatesToolbarProps) {
  const insert = (tpl: string) => mathfieldRef.current?.insert(tpl);

  return (
    <div className={cn("space-y-2", className)}>
      {TEMPLATES.map((group) => (
        <div key={group.name}>
          <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
            {group.name}
          </p>
          <div className="flex flex-wrap gap-1">
            {group.items.map((item) => (
              <TemplateButton
                key={item.title}
                label={item.label}
                title={item.title}
                onClick={() => insert(item.template)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  // Render KaTeX preview if label is wrapped in $...$, else render text.
  const isMath = label.startsWith("$") && label.endsWith("$");
  const html = isMath
    ? (() => {
        try {
          return katex.renderToString(label.slice(1, -1), {
            throwOnError: false,
            strict: false,
          });
        } catch {
          return label;
        }
      })()
    : null;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      title={title}
      onClick={onClick}
      className="h-9 min-w-9 px-2"
    >
      {html ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="text-xs">{label}</span>
      )}
    </Button>
  );
}
