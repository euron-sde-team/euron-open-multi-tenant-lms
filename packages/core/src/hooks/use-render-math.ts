"use client";

import { useEffect, type RefObject } from "react";

import { renderLatexToHtml } from "../lib/katex-renderer";

/**
 * Turn the equations stored in a blog post into real maths.
 *
 * The editor stores one small span per equation rather than KaTeX's own
 * output, which is dozens of nested spans that no sanitizer should have to
 * allow and no author could edit again:
 *
 *   <span class="math-tex" data-latex="E=mc^2" data-display="block">E=mc^2</span>
 *
 * `data-latex` is the source of truth and the text inside is the fallback a
 * reader sees before this runs, or if JavaScript never does.
 *
 * WHY AN OBSERVER AND NOT JUST AN EFFECT
 * --------------------------------------
 * The first version ran once per change of the HTML string and nothing else.
 * That is only correct if the container is already in the DOM and already
 * filled at the moment the effect fires, and on the published post it is not:
 * the body arrives from a query, the wrapper carries a `key` so React swaps
 * the node rather than updating it, and either can land after this effect has
 * already had its turn. The equation then sits as raw LaTeX forever, because
 * the HTML string never changes again to trigger a retry.
 *
 * Watching the container instead removes the timing question entirely: whenever
 * content appears or is replaced, the equations in it get rendered.
 */
export function useRenderMath(
  containerRef: RefObject<HTMLElement | null>,
  /** Re-check when the rendered HTML changes. */
  dependency: unknown
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderAll = () => {
      const nodes = container.querySelectorAll<HTMLElement>("span.math-tex");
      nodes.forEach((node) => {
        const latex = node.getAttribute("data-latex");
        if (!latex) return;
        // Already done. React can re-run this without the DOM having been
        // replaced, and feeding KaTeX output back in as LaTeX would destroy it.
        if (node.dataset.mathRendered === "true") return;

        const html = renderLatexToHtml(
          latex,
          node.getAttribute("data-display") === "block"
        );
        // On failure the fallback text stays exactly as it is. A post with one
        // malformed equation still reads, and the reader cannot fix it anyway.
        // renderLatexToHtml has already said why on the console.
        if (html === null) return;

        node.innerHTML = html;
        node.dataset.mathRendered = "true";
      });
    };

    renderAll();

    // Our own writes change the subtree, so the observer would wake itself in a
    // loop without the rendered flag above stopping the second pass.
    const observer = new MutationObserver(renderAll);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef, dependency]);
}
