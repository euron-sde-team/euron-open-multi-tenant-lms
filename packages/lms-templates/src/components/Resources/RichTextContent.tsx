"use client";

import React, { useEffect, useRef } from "react";
import { sanitizeHtml } from "../../lib/sanitize-html";

interface RichTextContentProps {
  html: string;
  className?: string;
}

const COPY_BTN_CLASSES =
  "absolute right-2 top-2 rounded-md bg-muted-foreground/15 px-2 py-1 text-[11px] font-medium leading-none text-muted-foreground transition-colors hover:bg-muted-foreground/25 hover:text-foreground";

/**
 * Renders sanitized rich text (lesson TEXT resources) and decorates every
 * code block with a copy button. The DOM inside dangerouslySetInnerHTML is
 * not React-managed, so the buttons are attached imperatively per <pre>.
 */
export function RichTextContent({ html, className }: RichTextContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const buttons: HTMLButtonElement[] = [];

    for (const pre of Array.from(root.querySelectorAll("pre"))) {
      // Reuse an existing wrapper (StrictMode mounts effects twice, the
      // cleanup removes the button but the wrapper stays, so this must be
      // idempotent: re-add the button whenever it's missing).
      let wrap = pre.parentElement;
      if (!wrap || wrap.getAttribute("data-code-wrap") !== "1") {
        wrap = document.createElement("div");
        wrap.setAttribute("data-code-wrap", "1");
        wrap.style.position = "relative";
        pre.replaceWith(wrap);
        wrap.appendChild(pre);
      }
      if (wrap.querySelector("[data-copy-btn]")) continue;

      const btn = document.createElement("button");
      btn.setAttribute("data-copy-btn", "1");
      btn.type = "button";
      btn.textContent = "Copy";
      btn.className = COPY_BTN_CLASSES;
      btn.addEventListener("click", () => {
        const code = pre.innerText.replace(/\n?Copy$/, "");
        void navigator.clipboard.writeText(code).then(() => {
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 1500);
        });
      });
      wrap.appendChild(btn);
      buttons.push(btn);
    }

    return () => buttons.forEach((b) => b.remove());
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      // Sanitized via allowlist sanitizer (scripts/styles/event handlers stripped)
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

export default RichTextContent;
