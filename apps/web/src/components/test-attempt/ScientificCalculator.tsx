"use client";

import { Calculator as CalcIcon, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A self-contained scientific calculator for the SAT math sections. Evaluates
 * expressions with a safe shunting-yard parser (NO eval): + - * / ^, parentheses,
 * unary minus, and sin/cos/tan/asin/acos/atan/log/ln/sqrt/abs plus π and e.
 * Degree/radian toggle. Draggable, closable overlay.
 */

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "func"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "const"; v: string };

const FUNCS = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "log",
  "ln",
  "sqrt",
  "abs",
  "exp",
]);
const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
const RIGHT_ASSOC = new Set(["^"]);

function tokenize(input: string): Token[] {
  const s = input.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, "pi");
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push({ t: "num", v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const word = s.slice(i, j).toLowerCase();
      if (FUNCS.has(word)) tokens.push({ t: "func", v: word });
      else if (word === "pi" || word === "e") tokens.push({ t: "const", v: word });
      else throw new Error(`Unknown "${word}"`);
      i = j;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rparen" });
      i++;
      continue;
    }
    if ("+-*/^".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Bad character "${c}"`);
  }
  return tokens;
}

function evaluate(input: string, degrees: boolean): number {
  const tokens = tokenize(input);
  // Shunting-yard → RPN, with unary-minus handling.
  const output: Token[] = [];
  const stack: Token[] = [];
  let prev: Token | null = null;
  for (let k = 0; k < tokens.length; k++) {
    let tok = tokens[k];
    // Unary minus → 0 - x
    if (
      tok.t === "op" &&
      tok.v === "-" &&
      (prev === null || prev.t === "op" || prev.t === "lparen" || prev.t === "func")
    ) {
      output.push({ t: "num", v: 0 });
      tok = { t: "op", v: "~" }; // marker for unary minus, precedence high
    }
    if (tok.t === "num" || tok.t === "const") output.push(tok);
    else if (tok.t === "func") stack.push(tok);
    else if (tok.t === "op") {
      const o1 = tok.v === "~" ? "u" : tok.v;
      const p1 = tok.v === "~" ? 4 : PREC[tok.v];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "func") {
          output.push(stack.pop()!);
          continue;
        }
        if (top.t === "op") {
          const p2 = top.v === "~" ? 4 : PREC[top.v];
          if (p2 > p1 || (p2 === p1 && !RIGHT_ASSOC.has(o1))) {
            output.push(stack.pop()!);
            continue;
          }
        }
        break;
      }
      stack.push(tok);
    } else if (tok.t === "lparen") stack.push(tok);
    else if (tok.t === "rparen") {
      while (stack.length && stack[stack.length - 1].t !== "lparen")
        output.push(stack.pop()!);
      if (!stack.length) throw new Error("Mismatched )");
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === "func")
        output.push(stack.pop()!);
    }
    prev = tokens[k];
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.t === "lparen") throw new Error("Mismatched (");
    output.push(top);
  }

  // Evaluate RPN.
  const toRad = (x: number) => (degrees ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (degrees ? (x * 180) / Math.PI : x);
  const num: number[] = [];
  for (const tok of output) {
    if (tok.t === "num") num.push(tok.v);
    else if (tok.t === "const") num.push(tok.v === "pi" ? Math.PI : Math.E);
    else if (tok.t === "op") {
      if (tok.v === "~") {
        const a = num.pop()!;
        const b = num.pop()!;
        num.push(b - a);
        continue;
      }
      const b = num.pop()!;
      const a = num.pop()!;
      if (tok.v === "+") num.push(a + b);
      else if (tok.v === "-") num.push(a - b);
      else if (tok.v === "*") num.push(a * b);
      else if (tok.v === "/") num.push(a / b);
      else if (tok.v === "^") num.push(Math.pow(a, b));
    } else if (tok.t === "func") {
      const a = num.pop()!;
      switch (tok.v) {
        case "sin": num.push(Math.sin(toRad(a))); break;
        case "cos": num.push(Math.cos(toRad(a))); break;
        case "tan": num.push(Math.tan(toRad(a))); break;
        case "asin": num.push(fromRad(Math.asin(a))); break;
        case "acos": num.push(fromRad(Math.acos(a))); break;
        case "atan": num.push(fromRad(Math.atan(a))); break;
        case "log": num.push(Math.log10(a)); break;
        case "ln": num.push(Math.log(a)); break;
        case "sqrt": num.push(Math.sqrt(a)); break;
        case "abs": num.push(Math.abs(a)); break;
        case "exp": num.push(Math.exp(a)); break;
      }
    }
  }
  if (num.length !== 1 || !Number.isFinite(num[0])) throw new Error("Error");
  return num[0];
}

const KEYS: { label: string; ins: string; cls?: string }[][] = [
  [
    { label: "sin", ins: "sin(" },
    { label: "cos", ins: "cos(" },
    { label: "tan", ins: "tan(" },
    { label: "(", ins: "(" },
    { label: ")", ins: ")" },
  ],
  [
    { label: "ln", ins: "ln(" },
    { label: "log", ins: "log(" },
    { label: "√", ins: "sqrt(" },
    { label: "xʸ", ins: "^" },
    { label: "π", ins: "π" },
  ],
  [
    { label: "7", ins: "7" },
    { label: "8", ins: "8" },
    { label: "9", ins: "9" },
    { label: "÷", ins: "/" },
    { label: "e", ins: "e" },
  ],
  [
    { label: "4", ins: "4" },
    { label: "5", ins: "5" },
    { label: "6", ins: "6" },
    { label: "×", ins: "*" },
    { label: "^2", ins: "^2" },
  ],
  [
    { label: "1", ins: "1" },
    { label: "2", ins: "2" },
    { label: "3", ins: "3" },
    { label: "−", ins: "-" },
    { label: "abs", ins: "abs(" },
  ],
  [
    { label: "0", ins: "0" },
    { label: ".", ins: "." },
    { label: "EXP", ins: "exp(" },
    { label: "+", ins: "+" },
    { label: "=", ins: "=", cls: "bg-primary text-primary-foreground" },
  ],
];

export function ScientificCalculator({
  onClose,
  docked = false,
  bare = false,
}: {
  onClose?: () => void;
  docked?: boolean;
  /** Render only the calculator body, the caller owns the chrome/header. */
  bare?: boolean;
}) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [degrees, setDegrees] = useState(true);
  const dragRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const compute = useCallback(() => {
    try {
      setResult(String(evaluate(expr, degrees)));
    } catch {
      setResult("Error");
    }
  }, [expr, degrees]);

  const press = (k: { label: string; ins: string }) => {
    if (k.ins === "=") {
      compute();
      return;
    }
    setExpr((e) => e + k.ins);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      setPos({ x: ev.clientX - drag.current.dx, y: ev.clientY - drag.current.dy });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      ref={dragRef}
      className={
        bare
          ? "bg-card mx-auto w-64 py-2"
          : docked
            ? "bg-card mx-auto w-64"
            : "bg-card border-border fixed z-50 w-64 rounded-xl border shadow-2xl"
      }
      style={docked || bare ? undefined : { left: pos.x, top: pos.y }}
    >
      {!bare && (
      <div
        onMouseDown={docked ? undefined : onMouseDown}
        className={
          docked
            ? "bg-muted/60 flex items-center justify-between rounded-t-xl px-3 py-2"
            : "bg-muted/60 flex cursor-move items-center justify-between rounded-t-xl px-3 py-2"
        }
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <CalcIcon className="h-3.5 w-3.5" /> Calculator
        </span>
        <button onClick={onClose} aria-label="Close calculator" className="hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
      )}
      <div className="space-y-2 p-3">
        <div className="bg-muted/40 rounded-md px-2 py-1.5 text-right">
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && compute()}
            placeholder="0"
            className="text-foreground w-full bg-transparent text-right font-mono text-sm outline-none"
          />
          <div className="text-muted-foreground min-h-[1rem] font-mono text-xs">{result}</div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDegrees((d) => !d)}
            className="border-border rounded border px-2 py-0.5 text-[10px] font-semibold"
          >
            {degrees ? "DEG" : "RAD"}
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => setExpr((e) => e.slice(0, -1))}
              className="border-border rounded border px-2 py-0.5 text-[10px]"
            >
              DEL
            </button>
            <button
              onClick={() => {
                setExpr("");
                setResult("");
              }}
              className="border-border rounded border px-2 py-0.5 text-[10px]"
            >
              AC
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {KEYS.flat().map((k, i) => (
            <button
              key={i}
              onClick={() => press(k)}
              className={cn(
                "hover:bg-muted rounded-md py-1.5 text-xs font-medium transition-colors",
                "border-border border",
                k.cls
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
