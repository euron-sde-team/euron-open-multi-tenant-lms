"use client";

import type { CustomHtmlContent, SectionConfig } from "@open-mtlms/shared";
import { Code2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";

// Monaco loads client-side only and only when this block is edited (admin).
// The public storefront never renders edit mode, so this chunk is never
// fetched there. Mirrors the full-page custom-code editor.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[260px] w-full items-center justify-center rounded-lg border bg-muted/30 text-xs text-muted-foreground">
      Loading editor…
    </div>
  ),
});

interface CustomHtmlSectionProps {
  section: SectionConfig;
}

/**
 * Sandbox flags mirror the full-page custom-code renderer
 * (apps/web/src/components/custom-code-page.tsx). NEVER add allow-same-origin.
 * that keeps the tenant HTML on an opaque origin so it can't read our cookies,
 * localStorage (auth-storage), DOM, or call our APIs with credentials.
 */
const SANDBOX =
  "allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-top-navigation-by-user-activation";

/**
 * Inject `<base target="_top">` (so links open the storefront, not the iframe)
 * and a tiny resize reporter that posts the document height back to the parent
 * so the section can size itself to its content (no inner scrollbar). The
 * postMessage works across the opaque origin because it doesn't need
 * same-origin access.
 */
function buildSrcDoc(html: string): string {
  // "<\/script>" keeps an inline parser from ending the tag early.
  // eslint-disable-next-line no-useless-escape
  const resize = `<script>(function(){function send(){try{parent.postMessage({type:"lms-section-resize",height:Math.ceil(document.documentElement.getBoundingClientRect().height)},"*");}catch(e){}}window.addEventListener("load",send);window.addEventListener("resize",send);if(window.ResizeObserver){try{new ResizeObserver(send).observe(document.documentElement);}catch(e){}}setTimeout(send,150);setTimeout(send,600);})();<\/script>`;
  let out = html || "";
  if (!/<base\b/i.test(out)) {
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, '<head$1><base target="_top">');
    } else {
      out = `<base target="_top">${out}`;
    }
  }
  return out + resize;
}

export function CustomHtmlSection({ section }: CustomHtmlSectionProps) {
  const { isEditMode, updateSectionContent, EditableImage } =
    useSectionEditor();
  const content = section.content as CustomHtmlContent;
  const html = content.customHtml ?? "";
  const minHeight = content.minHeight ?? 160;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(minHeight);

  // Listen for the height report from THIS iframe only.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; height?: number };
      if (data?.type === "lms-section-resize" && typeof data.height === "number") {
        setHeight(Math.max(minHeight, Math.min(data.height, 20000)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [minHeight]);

  const frame = (
    <iframe
      ref={iframeRef}
      // Re-mount when the HTML changes so the resize reporter re-runs.
      key={html.length + ":" + html.slice(0, 32)}
      srcDoc={buildSrcDoc(html)}
      sandbox={SANDBOX}
      referrerPolicy="no-referrer"
      title="Custom HTML section"
      className="block w-full border-0"
      style={{ height, minHeight }}
      scrolling="no"
    />
  );

  if (!isEditMode) {
    return <section className="custom-html-section">{frame}</section>;
  }

  // Edit mode: inline code box + live sandboxed render below it.
  return (
    <section className="custom-html-section">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
          <Code2 className="h-4 w-4" />
          Custom HTML block
          <span className="text-xs font-normal text-muted-foreground/70">
            · HTML / CSS / JavaScript, renders safely below
          </span>
          <span className="ml-auto flex items-center gap-2">
            {/* Reuses the app's real image upload; on success append an <img>
                tag so it shows immediately in the code and the live preview. */}
            <span className="text-xs font-normal text-muted-foreground/70">
              Upload image:
            </span>
            <EditableImage
              src=""
              alt="Upload image"
              onChange={(url) => {
                if (!url) return;
                const tag = `\n<img src="${url}" alt="" style="max-width:100%" />\n`;
                updateSectionContent(section.id, {
                  customHtml: (content.customHtml ?? "") + tag,
                });
              }}
              className="h-8 w-12 rounded"
              aspectRatio="video"
              placeholder="Add"
              compact
            />
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <MonacoEditor
            height="320px"
            defaultLanguage="html"
            language="html"
            value={html}
            onChange={(value) =>
              updateSectionContent(section.id, { customHtml: value ?? "" })
            }
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: "on",
            }}
          />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border">
          <div className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Live preview
          </div>
          {frame}
        </div>
      </div>
    </section>
  );
}
