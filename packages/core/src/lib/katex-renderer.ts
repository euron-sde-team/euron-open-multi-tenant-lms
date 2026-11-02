import * as katexModule from "katex";

/**
 * KaTeX, resolved so it works whatever the bundler does with it.
 *
 * katex ships CommonJS. `import katex from "katex"` is compiled differently by
 * tsup, by Next's webpack and by tsx, and in at least one of those the default
 * import arrives as the module NAMESPACE rather than the module itself, which
 * makes `katex.renderToString` undefined. Calling it then throws a TypeError
 * that looks nothing like a maths problem, and the equation silently stays as
 * raw LaTeX on the page. Resolve both shapes once, here, rather than let every
 * caller trip over it.
 */
type KatexLike = {
  renderToString: (tex: string, options?: Record<string, unknown>) => string;
};

function resolveKatex(): KatexLike | null {
  const mod = katexModule as unknown as Record<string, unknown>;
  const candidate = (mod.default ?? mod) as Partial<KatexLike> | undefined;
  return typeof candidate?.renderToString === "function"
    ? (candidate as KatexLike)
    : null;
}

let warnedMissing = false;

/**
 * Render one LaTeX string to HTML.
 *
 * Returns null when it cannot be rendered, and says why on the console. The
 * previous version swallowed every failure in a bare catch, so an equation
 * that would not render was indistinguishable from one the renderer never saw:
 * both left the raw LaTeX sitting on the page with nothing logged.
 */
export function renderLatexToHtml(
  latex: string,
  displayMode: boolean
): string | null {
  const katex = resolveKatex();
  if (!katex) {
    if (!warnedMissing) {
      warnedMissing = true;
       
      console.warn(
        "[lms] KaTeX did not load, so equations will show as plain LaTeX."
      );
    }
    return null;
  }

  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      output: "html",
    });
  } catch (err) {
     
    console.warn(
      `[lms] Could not render equation: ${latex}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** Whether KaTeX is usable at all, for callers that want to show a preview. */
export function isKatexAvailable(): boolean {
  return resolveKatex() !== null;
}

/**
 * Same render, but hands back the reason it failed.
 *
 * The editor's equation dialog wants to SHOW that reason: an author halfway
 * through a formula has invalid LaTeX most of the time, so "\\frac{1}{ has an
 * unexpected end of input" is the normal, useful state, not an error to hide.
 */
export function renderLatexOrError(
  latex: string,
  displayMode: boolean
): { html: string; error: null } | { html: null; error: string } {
  const katex = resolveKatex();
  if (!katex) {
    return { html: null, error: "The maths renderer did not load." };
  }
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode,
        throwOnError: true,
        output: "html",
      }),
      error: null,
    };
  } catch (err) {
    return {
      html: null,
      error: err instanceof Error ? err.message : "Invalid expression",
    };
  }
}
