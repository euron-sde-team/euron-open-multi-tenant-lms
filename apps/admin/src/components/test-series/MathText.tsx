"use client";

import katex from "katex";
import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MathTextProps {
  /**
   * Text containing LaTeX math. Math expressions can be wrapped in `$...$`
   * (inline) or `$$...$$` (display). If the input has no delimiters but
   * contains LaTeX-looking content (`\pi`, `\frac`, `^`, `_`, etc.), the
   * whole thing is auto-wrapped in `$...$`.
   */
  children: string;
  className?: string;
  /** When true, renders as a block; when false, as inline. */
  block?: boolean;
  /** Split at sentence/step boundaries (outside math) onto separate lines. */
  multiline?: boolean;
}

/** Split a solution into step lines at sentence/colon boundaries outside math. */
function splitSteps(text: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let inMath = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (ch === "$") inMath = !inMath;
    if (!inMath && (ch === "." || ch === ":") && text[i + 1] === " ") {
      const prev = text[i - 1];
      if (ch === "." && /\d/.test(prev ?? "") && /\d/.test(text[i + 2] ?? "")) continue;
      parts.push(buf.trim());
      buf = "";
      i++;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter(Boolean);
}

/**
 * Renders text with embedded LaTeX math using KaTeX.
 *
 * Used in the admin-side preview surfaces (question editor, picker, list)
 * so authors can verify their `\pi r^2`-style content renders correctly.
 *
 * Lighter than the web app's `MathText` (no markdown / GFM / link parsing).
 * we just need math + plain text here.
 */
/** Drop leftover "[FIGURE-1]" placeholders so they never surface as literal text. */
function stripFigureMarkers(s: string): string {
  return (s ?? "").replace(/\s*\[FIGURE-\d+\]\s*/gi, " ").replace(/[ \t]{2,}/g, " ");
}

/**
 * Collapse a double backslash before a letter-command ("\\frac" -> "\frac").
 * "\\" is a LaTeX line break, so a double-escaped command renders as a newline +
 * literal "frac"; real line breaks (before space/brace/digit) are left alone.
 */
function fixDoubleEscapedCommands(s: string): string {
  return (s ?? "").replace(/\\\\(?=[a-zA-Z])/g, "\\");
}

export function MathText({ children, className, block = true, multiline = false }: MathTextProps) {
  const source = fixDoubleEscapedCommands(stripFigureMarkers(children ?? ""));
  const segments = useMemo(() => parseSegments(source), [source]);
  const steps = useMemo(
    () => (multiline ? splitSteps(source) : []),
    [source, multiline]
  );
  if (multiline) {
    return (
      <div className={cn("space-y-1.5", className)}>
        {steps.map((step, i) => (
          <MathText key={i} block>
            {step}
          </MathText>
        ))}
      </div>
    );
  }
  const Wrapper = block ? "div" : "span";
  return (
    <Wrapper className={cn(block && "leading-relaxed", className)}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          // Preserve newlines in plain text; restore any currency sentinel to '$'.
          const value = seg.value.split(CURRENCY_SENTINEL).join("$");
          return (
            <span key={i} className="whitespace-pre-wrap">
              {renderInlineLinks(value)}
            </span>
          );
        }
        const html = renderKatex(seg.value, seg.display);
        return (
          <span
            key={i}
            className={seg.display ? "katex-display-inline" : ""}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </Wrapper>
  );
}

/**
 * Render markdown links `[text](url)` inside a plain-text segment as clickable
 * anchors so the author preview matches how the student side renders them
 * (external http/https links open in a new tab). Everything else stays plain
 * text with newlines preserved by the parent `whitespace-pre-wrap` wrapper.
 */
const MD_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
function renderInlineLinks(value: string): ReactNode {
  if (!value.includes("](")) return value;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MD_LINK_RE.lastIndex = 0;
  let key = 0;
  while ((m = MD_LINK_RE.exec(value)) !== null) {
    if (m.index > last) nodes.push(value.slice(last, m.index));
    const [, text, href] = m;
    const external = /^https?:\/\//i.test(href);
    nodes.push(
      <a
        key={`lnk-${key++}`}
        href={href}
        className="text-primary underline underline-offset-2 hover:opacity-80"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {text}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < value.length) nodes.push(value.slice(last));
  return nodes;
}

interface Segment {
  type: "text" | "math";
  value: string;
  display: boolean; // true = block math ($$...$$), false = inline ($...$)
}

// Private-use sentinel that stands in for a currency `$` while we split on the
// math `$` delimiter, then gets restored to a literal `$` in text segments.
const CURRENCY_SENTINEL = "";

/**
 * Replace currency `$` (money) with a sentinel so it isn't treated as a math
 * delimiter, by PAIRING `$...$`. A pair whose content is math-like (`$3$`,
 * `$x^2$`, `$12x+20y\ge150$`) is kept; every other `$` (e.g. `$80`, `$1,700`,
 * "$80 per adult … $60") becomes a sentinel that renders as a literal `$`.
 */
function escapeCurrency(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "$" && text[i + 1] === "$") {
      out.push("$$"); // display-math delimiter, parser handles the pair
      i += 2;
      continue;
    }
    if (ch === "$") {
      let j = i + 1;
      while (j < text.length && text[j] !== "$" && text[j] !== "\n") j++;
      if (text[j] === "$" && isMathLike(text.slice(i + 1, j))) {
        out.push("$", text.slice(i + 1, j), "$");
        i = j + 1;
        continue;
      }
      out.push(CURRENCY_SENTINEL);
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}

/** Is the content of a `$...$` span math (vs money/prose)? */
function isMathLike(c: string): boolean {
  if (!c || /\n/.test(c)) return false;
  // Explicit LaTeX / scripts → math at ANY length (long equation chains like
  // "\frac{x+7}{6}=\frac{x+7}{13} \implies ... \implies x+7=0" must still render).
  if (/\\[a-zA-Z]/.test(c) || /[\^_{}]/.test(c)) return true;
  if (c.length > 80) return false;
  if (/\d,\d{3}\b/.test(c)) return false;
  if (/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(c)) return false;
  return /[0-9]/.test(c) || /[+\-*/=<>]/.test(c) || /^[A-Za-z]{1,3}$/.test(c.trim());
}

/** Collapse over-encoded HTML entities ("&amp;lt;" -> "&lt;") then decode the
 *  common ones, so `<`/`>`/`&` from the XSS sanitizer render correctly. */
function decodeHtmlEntities(text: string): string {
  let t = text;
  let prev: string;
  do {
    prev = t;
    t = t.replace(/&amp;(?=[a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, "&");
  } while (t !== prev);
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSegments(rawInput: string): Segment[] {
  if (!rawInput) return [{ type: "text", value: "", display: false }];

  // Decode HTML entities, repair JSON-escape damage, then guard currency `$`.
  const repaired = escapeCurrency(unmangleLatex(decodeHtmlEntities(rawInput)));

  // If author hasn't used $ delimiters, try to auto-wrap math fragments.
  // Handles `{ \cmd... }` curly-brace-wrapped math and bare `\cmd{...}`
  // commands embedded in prose. Whole sentences are never wrapped, that
  // would collapse whitespace.
  const input = repaired.includes("$") ? repaired : autoWrapEquations(repaired);

  if (!input.includes("$")) {
    return [{ type: "text", value: input, display: false }];
  }

  const segments: Segment[] = [];
  let i = 0;
  let textBuf = "";

  while (i < input.length) {
    if (input.startsWith("$$", i)) {
      if (textBuf) {
        segments.push({ type: "text", value: textBuf, display: false });
        textBuf = "";
      }
      const close = input.indexOf("$$", i + 2);
      if (close === -1) {
        // Unmatched, render the rest as plain text
        textBuf = input.slice(i);
        i = input.length;
      } else {
        segments.push({
          type: "math",
          value: input.slice(i + 2, close),
          display: true,
        });
        i = close + 2;
      }
      continue;
    }
    if (input[i] === "$") {
      if (textBuf) {
        segments.push({ type: "text", value: textBuf, display: false });
        textBuf = "";
      }
      const close = input.indexOf("$", i + 1);
      if (close === -1) {
        textBuf = input.slice(i);
        i = input.length;
      } else {
        segments.push({
          type: "math",
          value: input.slice(i + 1, close),
          display: false,
        });
        i = close + 1;
      }
      continue;
    }
    textBuf += input[i];
    i += 1;
  }
  if (textBuf) {
    segments.push({ type: "text", value: textBuf, display: false });
  }
  return segments;
}

/**
 * Wrap math fragments inline with `$...$`, leaving surrounding prose alone.
 *
 *  Pass 1, `{ \cmd... }` (curly-brace-wrapped math from authors / AI)
 *  becomes `$\cmd...$` via manual brace-balancing.
 *
 *  Pass 2, bare `\cmd{...}` or `\cmd` is wrapped in `$...$`, skipping
 *  matches already inside an existing math span.
 *
 * Whole sentences are never wrapped, that would collapse whitespace.
 */
function autoWrapEquations(text: string): string {
  if (text.includes("$")) return wrapBareCommands(text);

  // Pass 1: { \cmd ... } → $\cmd ...$ with brace-balancing
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "\\" && /[a-zA-Z]/.test(text[j + 1] ?? "")) {
        let depth = 1;
        let k = i + 1;
        while (k < text.length && depth > 0) {
          if (text[k] === "{") depth++;
          else if (text[k] === "}") {
            depth--;
            if (depth === 0) break;
          }
          k++;
        }
        if (depth === 0) {
          const inner = text.slice(i + 1, k).trim();
          out.push("$", inner, "$");
          i = k + 1;
          continue;
        }
      }
    }
    out.push(text[i]);
    i++;
  }
  let result = out.join("");

  // Pass 2: equation-form prose ("A = \pi r^2") wraps the whole equation so
  // exponents/subscripts render correctly. Skipped if Pass 1 already added a
  // `$`. Same heuristic the original renderer used.
  if (!result.includes("$")) {
    const equationPattern =
      /\b[A-Za-z][\w()]*\s*=\s*[^,;.!?$\n]*?\\[a-zA-Z]+[^,;.!?$\n]*/g;
    result = result.replace(equationPattern, (m) => `$${m.trim()}$`);
  }

  // Pass 3: brace-balanced scan for bare \cmd[{...}{...}...] outside $...$.
  return wrapBareCommands(result);
}

function wrapBareCommands(text: string): string {
  const out: string[] = [];
  let i = 0;
  let inMath = false;
  while (i < text.length) {
    const ch = text[i];
    // Display math `$$` toggles inMath ONCE, not twice.
    if (ch === "$" && text[i + 1] === "$") {
      out.push("$$");
      inMath = !inMath;
      i += 2;
      continue;
    }
    if (ch === "$") {
      out.push(ch);
      inMath = !inMath;
      i++;
      continue;
    }
    if (
      !inMath &&
      ch === "\\" &&
      /[a-zA-Z]/.test(text[i + 1] ?? "")
    ) {
      let j = i + 1;
      while (j < text.length && /[a-zA-Z]/.test(text[j])) j++;
      while (j < text.length && text[j] === "{") {
        let depth = 1;
        j++;
        while (j < text.length && depth > 0) {
          if (text[j] === "{") depth++;
          else if (text[j] === "}") {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
          j++;
        }
      }
      out.push("$", text.slice(i, j), "$");
      i = j;
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}

const CTRL_TO_LETTER: Record<string, string> = {
  "\b": "b",
  "\t": "t",
  "\n": "n",
  "\f": "f",
  "\r": "r",
};

const KNOWN_LATEX_COMMANDS = new Set([
  "frac", "sqrt", "sum", "int", "prod", "lim", "log", "ln", "exp",
  "sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
  "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi",
  "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi", "varphi", "chi",
  "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  "infty", "partial", "nabla", "exists", "forall", "in", "notin", "ni",
  "subset", "supset", "subseteq", "supseteq", "emptyset", "varnothing",
  "neq", "leq", "geq", "equiv", "approx", "propto", "sim", "simeq", "cong", "ll", "gg", "ne",
  "times", "div", "cdot", "pm", "mp", "oplus", "ominus", "otimes", "odot",
  "wedge", "vee", "neg", "land", "lor",
  "to", "mapsto", "leftarrow", "rightarrow", "leftrightarrow",
  "Leftarrow", "Rightarrow", "Leftrightarrow",
  "text", "textbf", "textit", "texttt", "textrm", "textsf",
  "mathbb", "mathbf", "mathcal", "mathit", "mathrm", "mathsf", "mathtt",
  "boldsymbol", "underline", "overline", "vec", "hat", "tilde", "bar", "dot", "ddot",
  "left", "right", "langle", "rangle", "lceil", "rceil", "lfloor", "rfloor",
  "begin", "end", "quad", "qquad",
  "binom", "choose",
]);

/**
 * Recover from JSON-escape damage. JSON parsers turn `\t \n \r \b \f` into
 * control chars, eating the leading letter of LaTeX commands. We restore the
 * missing letter and prepend the backslash, but only when the resulting word
 * is a known LaTeX command, so legitimate whitespace is left alone.
 */
function unmangleLatex(text: string): string {
  if (!text) return text;
  return text.replace(
    /([\b\t\n\f\r])([a-zA-Z]+)/g,
    (match, ctl, word) => {
      const letter = CTRL_TO_LETTER[ctl as string];
      if (!letter) return match;
      const fullCmd = letter + word;
      if (KNOWN_LATEX_COMMANDS.has(fullCmd)) return "\\" + fullCmd;
      // Greedy fallback: longest known command prefix
      for (let n = word.length - 1; n >= 1; n--) {
        const candidate = letter + word.slice(0, n);
        if (KNOWN_LATEX_COMMANDS.has(candidate)) {
          return "\\" + candidate + word.slice(n);
        }
      }
      return match;
    }
  );
}

function renderKatex(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr, {
      displayMode: display,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return expr;
  }
}
