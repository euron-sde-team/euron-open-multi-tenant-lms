"use client";

import { Maximize2, Minimize2, X } from "lucide-react";

import { MathText } from "@/components/test-attempt/MathText";
import { cn } from "@/lib/utils";

/**
 * The official Digital SAT "Reference" sheet, laid out exactly like Bluebook:
 * a plain two-column grid of geometry figures with their formulas centered
 * beneath each drawing (no cards, no group headings), a bold
 * "Special Right Triangles" caption under the two special triangles, and the
 * three facts at the bottom. Figures are inline SVG so they follow the theme.
 */

// ---- Figures (stroke follows currentColor) ----
const FIG_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
} as const;
const FIG_TEXT = {
  fill: "currentColor",
  fontSize: 11,
  fontStyle: "italic" as const,
  fontFamily: "serif",
};

function FigCircle() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <circle cx="60" cy="42" r="30" {...FIG_STROKE} />
      <line x1="60" y1="42" x2="90" y2="42" {...FIG_STROKE} />
      <circle cx="60" cy="42" r="1.8" fill="currentColor" stroke="none" />
      <text x="71" y="37" {...FIG_TEXT}>
        r
      </text>
    </svg>
  );
}

function FigRectangle() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <rect x="25" y="22" width="70" height="40" {...FIG_STROKE} />
      <text x="57" y="76" {...FIG_TEXT}>
        ℓ
      </text>
      <text x="12" y="46" {...FIG_TEXT}>
        w
      </text>
    </svg>
  );
}

function FigTriangle() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <polygon points="20,66 100,66 62,16" {...FIG_STROKE} />
      <line x1="62" y1="16" x2="62" y2="66" strokeDasharray="3 3" {...FIG_STROKE} />
      <rect x="62" y="59" width="7" height="7" {...FIG_STROKE} strokeWidth={1} />
      <text x="56" y="80" {...FIG_TEXT}>
        b
      </text>
      <text x="66" y="45" {...FIG_TEXT}>
        h
      </text>
    </svg>
  );
}

function FigRightTriangle() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <polygon points="25,66 95,66 95,16" {...FIG_STROKE} />
      <rect x="87" y="58" width="8" height="8" {...FIG_STROKE} strokeWidth={1} />
      <text x="56" y="80" {...FIG_TEXT}>
        b
      </text>
      <text x="100" y="45" {...FIG_TEXT}>
        a
      </text>
      <text x="48" y="38" {...FIG_TEXT}>
        c
      </text>
    </svg>
  );
}

function FigTriangle306090() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <polygon points="15,66 105,66 105,20" {...FIG_STROKE} />
      <rect x="97" y="58" width="8" height="8" {...FIG_STROKE} strokeWidth={1} />
      <text x="30" y="62" fill="currentColor" fontSize="9">
        30°
      </text>
      <text x="92" y="34" fill="currentColor" fontSize="9">
        60°
      </text>
      <text x="52" y="80" {...FIG_TEXT}>
        x√3
      </text>
      <text x="109" y="46" {...FIG_TEXT}>
        x
      </text>
      <text x="46" y="34" {...FIG_TEXT}>
        2x
      </text>
    </svg>
  );
}

function FigTriangle454590() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <polygon points="30,66 95,66 95,16" {...FIG_STROKE} />
      <rect x="87" y="58" width="8" height="8" {...FIG_STROKE} strokeWidth={1} />
      <text x="40" y="61" fill="currentColor" fontSize="9">
        45°
      </text>
      <text x="83" y="32" fill="currentColor" fontSize="9">
        45°
      </text>
      <text x="58" y="80" {...FIG_TEXT}>
        s
      </text>
      <text x="100" y="45" {...FIG_TEXT}>
        s
      </text>
      <text x="42" y="34" {...FIG_TEXT}>
        s√2
      </text>
    </svg>
  );
}

function FigBox() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <rect x="22" y="30" width="56" height="38" {...FIG_STROKE} />
      <polygon points="22,30 40,16 96,16 78,30" {...FIG_STROKE} />
      <polygon points="78,30 96,16 96,54 78,68" {...FIG_STROKE} />
      <text x="46" y="81" {...FIG_TEXT}>
        ℓ
      </text>
      <text x="90" y="34" {...FIG_TEXT}>
        w
      </text>
      <text x="10" y="52" {...FIG_TEXT}>
        h
      </text>
    </svg>
  );
}

function FigCylinder() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <ellipse cx="60" cy="20" rx="28" ry="9" {...FIG_STROKE} />
      <line x1="32" y1="20" x2="32" y2="62" {...FIG_STROKE} />
      <line x1="88" y1="20" x2="88" y2="62" {...FIG_STROKE} />
      <path d="M 32 62 A 28 9 0 0 0 88 62" {...FIG_STROKE} />
      <line x1="60" y1="20" x2="88" y2="20" {...FIG_STROKE} strokeWidth={1} />
      <text x="70" y="16" {...FIG_TEXT}>
        r
      </text>
      <text x="94" y="45" {...FIG_TEXT}>
        h
      </text>
    </svg>
  );
}

function FigSphere() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <circle cx="60" cy="42" r="28" {...FIG_STROKE} />
      <path d="M 32 42 A 28 9 0 0 0 88 42" {...FIG_STROKE} strokeWidth={1} />
      <path
        d="M 32 42 A 28 9 0 0 1 88 42"
        {...FIG_STROKE}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <line x1="60" y1="42" x2="88" y2="42" {...FIG_STROKE} strokeWidth={1} />
      <circle cx="60" cy="42" r="1.8" fill="currentColor" stroke="none" />
      <text x="70" y="38" {...FIG_TEXT}>
        r
      </text>
    </svg>
  );
}

function FigCone() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <line x1="34" y1="62" x2="60" y2="12" {...FIG_STROKE} />
      <line x1="86" y1="62" x2="60" y2="12" {...FIG_STROKE} />
      <ellipse cx="60" cy="62" rx="26" ry="8" {...FIG_STROKE} />
      <line x1="60" y1="12" x2="60" y2="62" strokeDasharray="3 3" {...FIG_STROKE} strokeWidth={1} />
      <line x1="60" y1="62" x2="86" y2="62" {...FIG_STROKE} strokeWidth={1} />
      <text x="70" y="58" {...FIG_TEXT}>
        r
      </text>
      <text x="64" y="40" {...FIG_TEXT}>
        h
      </text>
    </svg>
  );
}

function FigPyramid() {
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-full" aria-hidden>
      <polygon points="28,64 84,64 100,50 60,10" {...FIG_STROKE} />
      <line x1="28" y1="64" x2="60" y2="10" {...FIG_STROKE} />
      <line x1="44" y1="50" x2="60" y2="10" strokeDasharray="3 3" {...FIG_STROKE} strokeWidth={1} />
      <line x1="28" y1="64" x2="44" y2="50" strokeDasharray="3 3" {...FIG_STROKE} strokeWidth={1} />
      <line x1="44" y1="50" x2="100" y2="50" strokeDasharray="3 3" {...FIG_STROKE} strokeWidth={1} />
      <text x="52" y="78" {...FIG_TEXT}>
        ℓ
      </text>
      <text x="94" y="66" {...FIG_TEXT}>
        w
      </text>
      <text x="46" y="34" {...FIG_TEXT}>
        h
      </text>
    </svg>
  );
}

function FigureCell({
  figure: Figure,
  formulas,
}: {
  figure: () => JSX.Element;
  formulas: string[];
}) {
  return (
    <div className="text-foreground flex flex-col items-center gap-0.5">
      <Figure />
      {formulas.map((tex) => (
        <div key={tex} className="text-center text-[13px] leading-tight">
          <MathText block={false}>{`$${tex}$`}</MathText>
        </div>
      ))}
    </div>
  );
}

const FACTS = [
  "The number of degrees of arc in a circle is 360.",
  "The number of radians of arc in a circle is 2π.",
  "The sum of the measures in degrees of the angles of a triangle is 180.",
];

/**
 * `docked` renders the sheet as a static side pane (the Bluebook player docks
 * it so the question reflows and nothing overlaps); default is a floating
 * side panel, per Bluebook it is never a full-screen page. `expanded` +
 * `onToggleExpand` add Bluebook's enlarge control when docked.
 */
export function FormulaSheet({
  onClose,
  docked = false,
  expanded = false,
  onToggleExpand,
}: {
  onClose: () => void;
  docked?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        docked
          ? "h-full w-full border-l"
          : "fixed inset-y-0 right-0 z-50 w-[88vw] max-w-sm border-l shadow-2xl"
      )}
    >
      {/* Bluebook-style dark header bar: "Reference" + expand + close */}
      <div className="bg-foreground text-background flex items-center justify-between px-4 py-2.5">
        <h2 className="text-sm font-bold">Reference</h2>
        <span className="flex items-center gap-3">
          {docked && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={expanded ? "Shrink reference sheet" : "Expand reference sheet"}
              title={expanded ? "Shrink" : "Expand"}
              className="opacity-80 hover:opacity-100"
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reference sheet"
            className="opacity-80 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-7">
          <FigureCell figure={FigCircle} formulas={["A = \\pi r^2", "C = 2\\pi r"]} />
          <FigureCell figure={FigRectangle} formulas={["A = \\ell w"]} />
          <FigureCell figure={FigTriangle} formulas={["A = \\tfrac{1}{2} b h"]} />
          <FigureCell figure={FigRightTriangle} formulas={["c^2 = a^2 + b^2"]} />
          <FigureCell figure={FigTriangle306090} formulas={[]} />
          <FigureCell figure={FigTriangle454590} formulas={[]} />
          <p className="text-foreground col-span-2 -mt-4 text-center text-sm font-bold">
            Special Right Triangles
          </p>
          <FigureCell figure={FigBox} formulas={["V = \\ell w h"]} />
          <FigureCell figure={FigCylinder} formulas={["V = \\pi r^2 h"]} />
          <FigureCell figure={FigSphere} formulas={["V = \\tfrac{4}{3}\\pi r^3"]} />
          <FigureCell figure={FigCone} formulas={["V = \\tfrac{1}{3}\\pi r^2 h"]} />
          <FigureCell figure={FigPyramid} formulas={["V = \\tfrac{1}{3}\\ell w h"]} />
        </div>

        <ul className="text-foreground border-border mt-7 space-y-1.5 border-t border-dashed pt-4 text-xs leading-relaxed">
          {FACTS.map((fact) => (
            <li key={fact} className="flex gap-2">
              <span aria-hidden>•</span>
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
