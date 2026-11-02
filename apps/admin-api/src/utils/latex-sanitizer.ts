/**
 * Recover JSON-escape damage in LaTeX strings produced by LLMs.
 *
 * Some LLMs emit single-backslash LaTeX commands (`\textbf`, `\frac`,
 * `\nabla`) inside JSON string values without escaping the backslash. JSON
 * parsers then interpret `\t \n \r \b \f` as control characters, silently
 * dropping the letter that followed:
 *
 *   `\textbf{v}`  ->  `[TAB]extbf{v}`
 *   `\frac{a}{b}` ->  `[FF]rac{a}{b}`
 *   `\nabla`      ->  `[LF]abla`
 *
 * We invert the damage by mapping the control character back to the letter
 * it ate, and only commit the fix when the reconstructed word is a known
 * LaTeX command. Real text whitespace ("Hello\nWorld") is left intact
 * because "nWorld" is not a recognised command.
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

export function unmangleLatex(text: string): string {
  if (!text) return text;
  return text.replace(
    /([\b\t\n\f\r])([a-zA-Z]+)/g,
    (match: string, ctl: string, word: string) => {
      const letter = CTRL_TO_LETTER[ctl];
      if (!letter) return match;
      const fullCmd = letter + word;
      if (KNOWN_LATEX_COMMANDS.has(fullCmd)) return "\\" + fullCmd;
      // Longest-prefix fallback: the LaTeX command might be a prefix of
      // `letter + word`, with the rest being trailing prose.
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
 * Apply unmangleLatex to a value that may be a string, an array, or a
 * shallow object. Used to scrub AI-generated question payloads (stem,
 * options[].label, explanation) before persisting them.
 */
export function unmangleLatexDeep<T>(value: T): T {
  if (typeof value === "string") {
    return unmangleLatex(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => unmangleLatexDeep(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = unmangleLatexDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
