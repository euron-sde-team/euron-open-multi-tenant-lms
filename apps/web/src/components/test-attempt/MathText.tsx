"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

/**
 * Render markdown links as clickable anchors. External (http/https) links open
 * in a new tab with rel="noopener", used for per-question resources like a
 * Google Drive dataset linked from the question text.
 */
const MARKDOWN_COMPONENTS = {
  a({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="text-primary font-medium underline decoration-2 underline-offset-2 hover:opacity-80"
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        {...props}
      >
        {children}
      </a>
    );
  },
};

interface MathTextProps {
  /**
   * The text to render. Math expressions should be wrapped in `$...$`
   * for inline math or `$$...$$` for display math (KaTeX syntax).
   *
   * Examples:
   * - "Find $\\pi r^2$ where r is radius."
   * - "$A = 2\\pi r, C = \\pi r^2, D = r$"
   */
  children: string;
  className?: string;
  /**
   * If true, renders as a `<p>`-like block. If false, tries to be inline-friendly
   * (still uses block elements internally, just suppresses outer paragraph margins).
   */
  block?: boolean;
  /**
   * If true, split the text at sentence/step boundaries (outside math) and
   * render each on its own line. Used for solutions/explanations so multi-step
   * working is human-readable instead of one dense paragraph.
   */
  multiline?: boolean;
}

/**
 * Split a solution into step lines at sentence/colon boundaries that fall
 * OUTSIDE `$...$` math, so "Compute …: $a$. Now …: $b$." becomes three lines.
 */
function splitSteps(text: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let inMath = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (ch === "$") inMath = !inMath;
    const next = text[i + 1];
    if (!inMath && (ch === "." || ch === ":") && next === " ") {
      // Don't break inside a decimal like "0. 5" (digit-period-space-digit).
      const prev = text[i - 1];
      if (ch === "." && /\d/.test(prev ?? "") && /\d/.test(text[i + 2] ?? "")) continue;
      parts.push(buf.trim());
      buf = "";
      i++; // skip the space
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter(Boolean);
}

/**
 * Renders text containing LaTeX math (delimited by `$...$` or `$$...$$`)
 * using KaTeX. Falls back to plain markdown for everything else.
 *
 * The pipeline runs three passes before handing the text to
 * remark-math/KaTeX:
 *
 *   1. unmangleLatex, recover JSON-escape damage (`[TAB]extbf` → `\textbf`).
 *   2. autoWrapMath, wrap `{ \cmd... }` and bare `\cmd{...}` in `$...$`.
 *   3. ReactMarkdown: KaTeX renders the math, GFM renders the prose.
 */
/**
 * Drop leftover figure placeholders like "[FIGURE-1]" from displayed text. The
 * actual image (when one exists) is rendered separately from the stem's
 * imageUrl, so the marker should never surface as literal text.
 */
function stripFigureMarkers(s: string): string {
  return (s ?? "").replace(/\s*\[FIGURE-\d+\]\s*/gi, " ").replace(/[ \t]{2,}/g, " ");
}

/**
 * Collapse a double backslash that sits immediately before a letter-command
 * (e.g. "\\frac", "\\neq", "\\pm") back to a single backslash. In LaTeX "\\"
 * is a line break, so a double-escaped command (from an over-escaped import)
 * renders as a newline + literal "frac". Real "\\" line breaks (followed by a
 * space/brace/digit) are left untouched.
 */
function fixDoubleEscapedCommands(s: string): string {
  return (s ?? "").replace(/\\\\(?=[a-zA-Z])/g, "\\");
}

/**
 * SAT style: titles of LONG works (novels, films, albums…) are italicized.
 * Authored/imported stems usually carry them in quotes ('the 1922 novel
 * "Ulysses"'), so at display time we convert a quoted title that directly
 * follows a long-work word into markdown italics (dropping the quotes).
 * Short works (poems, essays, short stories) correctly stay in quotes per
 * SAT convention, so their work-words are deliberately NOT in this list.
 * Display-only, the stored data is untouched.
 */
const LONG_WORK_WORDS =
  "novels?|novellas?|books?|plays?|memoirs?|biograph(?:y|ies)|autobiograph(?:y|ies)|films?|movies?|operas?|albums?|magazines?|newspapers?|journals?|antholog(?:y|ies)|epics?|trilog(?:y|ies)";
const TITLE_RE = new RegExp(
  `\\b(${LONG_WORK_WORDS})(\\s+)[“"]([^”"\\n]{2,90}?)[”"]`,
  "gi"
);
function italicizeTitles(s: string): string {
  return (s ?? "").replace(
    TITLE_RE,
    (_m, work: string, gap: string, title: string) =>
      `${work}${gap}*${title.trim()}*`
  );
}

/**
 * Keep a one-line text literal where markdown would turn its first characters
 * into block syntax and swallow them. An answer option "- 0.33" (minus 0.33)
 * rendered as a one-item bullet list showing just "0.33", so a learner saw two
 * identical "0.33" options and could not pick the right one. The same trap
 * hid "> 5" (blockquote), "2019. The year..." (ordered list) and "# 1".
 *
 * Only single-line text: a multi-line stem may use real markdown lists.
 */
function keepLeadingMarkersLiteral(s: string): string {
  if (!s || s.includes("\n")) return s;
  return s
    .replace(/^(\s*)([-*_])(?=(\s*\2){2,}\s*$)/, "$1\\$2") // --- / *** rule
    .replace(/^(\s*)([-+*])(?=\s)/, "$1\\$2") // bullet list
    .replace(/^(\s*)(\d{1,9})([.)])(?=\s|$)/, "$1$2\\$3") // ordered list
    .replace(/^(\s*)(#{1,6})(?=\s|$)/, "$1\\$2") // heading
    .replace(/^(\s*)>/, "$1\\>"); // blockquote
}

export function MathText({ children, className, block = true, multiline = false }: MathTextProps) {
  const source = italicizeTitles(
    fixDoubleEscapedCommands(stripFigureMarkers(children ?? ""))
  );
  const render = (s: string) =>
    keepLeadingMarkersLiteral(autoWrapMath(unmangleLatex(normalizePlainMath(s))));
  if (multiline) {
    const steps = splitSteps(source);
    return (
      <div className={cn("space-y-1.5", className)}>
        {steps.map((step, i) => (
          <div key={i}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
              components={MARKDOWN_COMPONENTS}
            >
              {render(step)}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn(block ? "" : "math-inline", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={MARKDOWN_COMPONENTS}
      >
        {render(source)}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Render plain-text math notation (no LaTeX delimiters) as KaTeX. AI-generated
 * SAT questions commonly use `x^2`, `(z^3)^4`, `x^2 * x^5`, `sqrt(x)`, `<=` etc.
 * rather than `$...$` LaTeX. We only act when the text has NO existing `$` and
 * NO `\` command (so authored LaTeX is left untouched), and we only wrap the
 * minimal math spans, prose is never put into math mode.
 */
function normalizePlainMath(raw: string): string {
  if (!raw) return raw;

  // 0. ENTITY GUARD: the XSS sanitizer encodes `<`/`>`/`&` on save, and some
  //    paths double-encode them ("&amp;lt;"). Collapse an over-encoded `&amp;`
  //    that precedes another entity back to `&` so a SINGLE entity remains for
  //    the markdown parser to decode safely (e.g. "&amp;lt;" -> "&lt;" -> "<").
  //    A standalone "&amp;" (literal ampersand) is left for CommonMark.
  let t = raw;
  let prev: string;
  do {
    prev = t;
    t = t.replace(/&amp;(?=[a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, "&");
  } while (t !== prev);

  // 1. CURRENCY vs MATH: walk `$...$` pairs. A pair whose content is math-like
  //    (short, has LaTeX/operators/digits and isn't prose) is kept as a math
  //    span; every other `$` is money and gets escaped to `\$`. This correctly
  //    keeps `$3$`, `$x^2$`, `$12x+20y\ge150$` as math while escaping `$80`,
  //    `$1,700`, and "$80 per adult … $60".
  t = escapeCurrencyByPairing(t);

  // 2. If the text has REAL authored LaTeX (a `$` not used as currency, or a
  //    `\command`), trust it and stop, currency is already safe.
  const probe = t.replace(/\\\$/g, "");
  if (probe.includes("$") || /\\[a-zA-Z]/.test(probe)) return t;

  // 3. Plain-text math → LaTeX. sqrt(expr) -> $\sqrt{expr}$.
  t = t.replace(
    /\bsqrt\s*\(([^()]+)\)/g,
    (_m, inner: string) => `$\\sqrt{${inner.trim()}}$`
  );

  // Caret-power runs: x^2, z^12, (z^3)^4, x^2 * x^5. Anchored on a `^`, so prose
  // (which has no caret) is never matched. `*` between factors becomes \cdot.
  const runRe =
    /[A-Za-z0-9(][A-Za-z0-9(){}.^]*\^[A-Za-z0-9(){}.^]*(?:\s*\*\s*[A-Za-z0-9(){}.^]+)*/g;
  t = t.replace(runRe, (run: string) => {
    if (run.includes("$")) return run; // already inside a sqrt span we just made
    const latex = run
      .replace(/\^([A-Za-z0-9]+)/g, "^{$1}")
      .replace(/\s*\*\s*/g, " \\cdot ");
    return `$${latex}$`;
  });

  // Common inequality / operator glyphs used in plain text.
  t = t
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠");

  return t;
}

/**
 * Distinguish currency `$` from math `$...$` by pairing. Keeps a `$...$` pair
 * when its content looks like math; escapes every other `$` to `\$` (money).
 * `$$...$$` display-math blocks are preserved whole.
 */
function escapeCurrencyByPairing(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "$" && text[i + 1] === "$") {
      const close = text.indexOf("$$", i + 2);
      if (close !== -1) {
        out.push(text.slice(i, close + 2)); // keep display math as-is
        i = close + 2;
        continue;
      }
      out.push("\\$\\$");
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
      out.push("\\$"); // currency / unpaired
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}

/** Heuristic: is the content of a `$...$` span a math expression (vs money/prose)? */
function isMathLike(c: string): boolean {
  if (!c || /\n/.test(c)) return false;
  // Explicit LaTeX / sub-superscripts / braces → definitely math, at ANY length.
  // (Checked BEFORE the length cap so long equation chains like
  // "\frac{x+7}{6}=\frac{x+7}{13} \implies ... \implies x+7=0" still render.)
  if (/\\[a-zA-Z]/.test(c) || /[\^_{}]/.test(c)) return true;
  // Beyond this point, a long span with no LaTeX reads as prose/money, not math.
  if (c.length > 80) return false;
  // Thousands-grouped numbers ("15,000") read as currency, not math.
  if (/\d,\d{3}\b/.test(c)) return false;
  // Two 3+ letter words in a row → prose (e.g. "80 per adult and").
  if (/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(c)) return false;
  // Otherwise accept if it has a digit, a math operator, or is a short symbol.
  return /[0-9]/.test(c) || /[+\-*/=<>]/.test(c) || /^[A-Za-z]{1,3}$/.test(c.trim());
}

/**
 * Recover JSON-escape damage in LaTeX. Some LLMs emit single-backslash
 * LaTeX (`\textbf`) inside JSON strings without escaping. Lenient JSON
 * parsers interpret `\t \n \r \b \f` as control characters, silently
 * swallowing the leading letter. Result: `\textbf` becomes `[TAB]extbf`,
 * `\frac` becomes `[FF]rac`, `\nabla` becomes `[LF]abla`, etc.
 *
 * We restore the missing letter (the one identifiable from the control
 * code) and put the backslash back, but ONLY when the resulting word is a
 * known LaTeX command. Real text whitespace ("Hello\nWorld") is left
 * untouched because "nWorld" isn't a recognised command.
 */
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

function unmangleLatex(text: string): string {
  if (!text) return text;
  return text.replace(
    /([\b\t\n\f\r])([a-zA-Z]+)/g,
    (match, ctl: string, word: string) => {
      const letter = CTRL_TO_LETTER[ctl];
      if (!letter) return match;
      const fullCmd = letter + word;
      if (KNOWN_LATEX_COMMANDS.has(fullCmd)) return "\\" + fullCmd;
      // Longest-prefix fallback: the LaTeX command might be a prefix of
      // `letter + word`, with the remaining characters being trailing prose.
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

/**
 * Wraps inline math fragments inside prose with `$...$` so KaTeX renders them,
 * while leaving the surrounding prose alone.
 *
 * If the text already has `$` delimiters, trust the author and do nothing.
 *
 * Two heuristics, applied in order:
 *
 *  Pass 1, `{ \cmd... }` (curly-brace-wrapped math): some authors and AI
 *  generators produce strings like "the notation { \frac{dv}{dt} } means".
 *  Replace those outer braces with `$...$`. We scan for matching braces
 *  manually so nested LaTeX (`\frac{a}{b}`, `\sqrt{\frac{x}{y}}`) is handled
 *  correctly.
 *
 *  Pass 2, bare `\cmd` or `\cmd{...}` inside prose: wrap each LaTeX
 *  command-with-args (and any number of brace-arg groups) in `$...$`. We
 *  skip matches already inside an existing math span.
 *
 *  We never wrap the whole text, that would put prose in math mode and
 *  collapse whitespace.
 */
function autoWrapMath(text: string): string {
  if (!text) return text;
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
  // exponents/subscripts ("r^2") render correctly. Skipped if Pass 1 added a
  // `$`. Pattern requires an `=` and a LaTeX `\command` somewhere on the
  // right-hand side, and stops at sentence-end punctuation. This is the same
  // heuristic the original renderer used.
  if (!result.includes("$")) {
    const equationPattern =
      /\b[A-Za-z][\w()]*\s*=\s*[^,;.!?$\n]*?\\[a-zA-Z]+[^,;.!?$\n]*/g;
    result = result.replace(equationPattern, (m) => `$${m.trim()}$`);
  }

  // Pass 3: bare \cmd outside any $...$ span (handles standalone `\frac{a}{b}`
  // and isolated `\pi`, while leaving anything already inside math alone).
  return wrapBareCommands(result);
}

/**
 * Brace-balanced scan for bare `\cmd[{...}{...}...]` outside `$...$` /
 * `$$...$$` math spans. Regex can't balance braces (`\frac{\sqrt{x}}{y}`),
 * and `$$` must toggle the math state once, not twice, so we walk manually.
 */
function wrapBareCommands(text: string): string {
  const out: string[] = [];
  let i = 0;
  let inMath = false;
  while (i < text.length) {
    const ch = text[i];
    // Display math `$$` toggles inMath ONCE, not twice. Treat the pair as a
    // single delimiter so `$$\sum...$$` keeps `\sum` inside math mode.
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
      // Consume any number of brace-balanced argument groups
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
