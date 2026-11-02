"use client";

import { Editor } from "@tinymce/tinymce-react";
import { forwardRef, useImperativeHandle, useRef } from "react";

import { renderLatexOrError } from "../lib/katex-renderer";

export interface RichTextEditorProps {
  value?: string;
  initialValue?: string;
  onEditorChange?: (content: string) => void;
  height?: number;
  onImageUpload?: (file: File) => Promise<string>;
}

type TinyMceEditor = {
  focus?: () => void;
  execCommand?: (cmd: string, flag: boolean, value: string) => void;
  getContent?: (args?: { format?: string }) => string;
  setContent?: (content: string) => void;
  selection?: {
    getContent: (args?: { format?: string }) => string;
    setContent: (content: string) => void;
    getNode?: () => HTMLElement | null;
  };
  ui?: {
    registry: {
      addButton: (name: string, spec: Record<string, unknown>) => void;
    };
  };
  windowManager?: {
    open: (spec: Record<string, unknown>) => { close: () => void };
  };
  on?: (event: string, handler: (e: Event) => void) => void;
  dom?: { getParent: (node: Node, selector: string) => HTMLElement | null };
};

export interface RichTextEditorRef {
  insertImageAtCursor: (imageUrl: string, alt?: string) => void;
  getEditor: () => TinyMceEditor | null;
  /** Set editor content programmatically (e.g. after AI generation). */
  setContent: (html: string) => void;
  /** Get current HTML from editor instance (for publish validation). */
  getContent: () => string;
  /** Get currently selected HTML (empty string if no selection). */
  getSelection: () => string;
  /** Replace current selection (or insert at cursor if none) with HTML. */
  replaceSelection: (html: string) => void;
}

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------

/**
 * How an equation is stored.
 *
 * Deliberately one small span rather than KaTeX's own output, which is dozens
 * of nested spans that no sanitizer should have to allow and no author could
 * ever edit again. `data-latex` is the source of truth; the text inside is a
 * plain fallback for a reader whose JavaScript has not run. The renderer on
 * the published page turns these into real KaTeX.
 *
 * The blog sanitizer in both backends allows exactly this shape:
 * span with class, data-latex and data-display.
 */
const MATH_CLASS = "math-tex";
const PREVIEW_ID = "lms-math-preview";

// TinyMCE (GPL build) script. Point NEXT_PUBLIC_TINYMCE_SCRIPT_SRC at a
// self-hosted copy (e.g. "/tinymce/tinymce.min.js" copied from the `tinymce`
// npm package into the app's public folder) to avoid the public CDN.
const TINYMCE_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_TINYMCE_SCRIPT_SRC ||
  "https://cdn.jsdelivr.net/npm/tinymce@8/tinymce.min.js";

function renderMathPreview(latex: string, display: boolean): string {
  if (!latex.trim()) {
    return `<p style="margin:0;color:#71717a;font-size:13px;">Start typing to see a preview.</p>`;
  }
  const { html, error } = renderLatexOrError(latex, display);
  if (html !== null) return html;

  // Show WHY it is wrong rather than an empty box. An author mid-formula has
  // invalid LaTeX most of the time, so this is the normal state, not an edge
  // case, and it must not look like a failure.
  return `<p style="margin:0;color:#b42318;font-size:12px;line-height:1.5;">${error.replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string
  )}</p>`;
}

/** Escape for an HTML attribute, so a formula with a quote cannot break out. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMathHtml(latex: string, display: boolean): string {
  const attr = escapeAttribute(latex);
  // The visible text is the raw LaTeX: readable enough to mean something in a
  // plain text client or an RSS reader, and it is what the author typed.
  return `<span class="${MATH_CLASS}" data-latex="${attr}" data-display="${
    display ? "block" : "inline"
  }">${attr}</span>`;
}

/**
 * The preview lives in an htmlpanel, which TinyMCE will only refresh by
 * rebuilding the whole dialog, that steals focus on every keystroke. Writing
 * into the panel's own node instead keeps the caret where the author left it.
 */
function paintPreview(latex: string, display: boolean): void {
  if (typeof document === "undefined") return;
  const node = document.getElementById(PREVIEW_ID);
  if (node) node.innerHTML = renderMathPreview(latex, display);
}

function openMathDialog(editor: TinyMceEditor): void {
  // Editing an existing equation rather than inserting a new one.
  const node = editor.selection?.getNode?.() ?? null;
  const existing =
    node && editor.dom
      ? editor.dom.getParent(node, `span.${MATH_CLASS}`)
      : null;

  const initialLatex = existing?.getAttribute("data-latex") ?? "";
  const initialDisplay = existing?.getAttribute("data-display") === "block";

  editor.windowManager?.open({
    title: existing ? "Edit equation" : "Insert equation",
    size: "normal",
    initialData: {
      latex: initialLatex,
      display: initialDisplay ? "block" : "inline",
    },
    body: {
      type: "panel",
      items: [
        {
          type: "textarea",
          name: "latex",
          label: "LaTeX",
          placeholder: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",
          maximized: false,
        },
        {
          type: "selectbox",
          name: "display",
          label: "Placement",
          items: [
            { text: "Inline, inside the sentence", value: "inline" },
            { text: "On its own line, centred", value: "block" },
          ],
        },
        {
          type: "htmlpanel",
          html: `<div style="padding:10px 12px;border:1px solid #e4e4e7;border-radius:6px;background:#fafafa;min-height:56px;overflow-x:auto;">
                   <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;margin-bottom:6px;">Preview</div>
                   <div id="${PREVIEW_ID}">${renderMathPreview(
                     initialLatex,
                     initialDisplay
                   )}</div>
                 </div>`,
        },
      ],
    },
    buttons: [
      { type: "cancel", text: "Cancel" },
      { type: "submit", text: existing ? "Update" : "Insert", primary: true },
    ],
    onChange: (api: { getData: () => { latex: string; display: string } }) => {
      const data = api.getData();
      paintPreview(data.latex ?? "", data.display === "block");
    },
    onSubmit: (api: {
      getData: () => { latex: string; display: string };
      close: () => void;
    }) => {
      const { latex, display } = api.getData();
      if (!latex?.trim()) {
        api.close();
        return;
      }
      const html = buildMathHtml(latex.trim(), display === "block");
      if (existing) {
        // Replace the whole span, not its innards, so the attributes move too.
        existing.outerHTML = html;
      } else {
        editor.execCommand?.("mceInsertContent", false, html);
      }
      api.close();
    },
  });
}

// ---------------------------------------------------------------------------

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, initialValue = "", onEditorChange, height = 500, onImageUpload }, ref) => {
    const editorRef = useRef<TinyMceEditor | null>(null);

    useImperativeHandle(ref, () => ({
      insertImageAtCursor: (imageUrl: string, alt = "") => {
        const editor = editorRef.current;
        if (editor?.focus && editor?.execCommand) {
          editor.focus();
          editor.execCommand(
            "mceInsertContent",
            false,
            `<img src="${imageUrl}" alt="${alt}" />`
          );
        }
      },
      getEditor: () => editorRef.current,
      setContent: (html: string) => {
        editorRef.current?.setContent?.(html);
      },
      getContent: () => editorRef.current?.getContent?.() ?? "",
      getSelection: () => editorRef.current?.selection?.getContent({ format: "html" }) ?? "",
      replaceSelection: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        if (editor.selection) {
          editor.selection.setContent(html);
        } else if (editor.execCommand) {
          editor.focus?.();
          editor.execCommand("mceInsertContent", false, html);
        }
      },
    }));

    return (
      <Editor
        tinymceScriptSrc={TINYMCE_SCRIPT_SRC}
        licenseKey="gpl"
        onInit={(_evt: unknown, editor: unknown) => {
          editorRef.current = editor as TinyMceEditor;
        }}
        value={value ?? initialValue}
        onEditorChange={(content: string) => onEditorChange?.(content)}
        init={{
          height,
          menubar: false,
          skin: "oxide",
          plugins: [
            "advlist",
            "autolink",
            "lists",
            "link",
            "image",
            "charmap",
            "preview",
            "anchor",
            "searchreplace",
            "visualblocks",
            "code",
            "codesample",
            "fullscreen",
            "insertdatetime",
            "media",
            "table",
            "wordcount",
            "emoticons",
            "quickbars",
          ],
          toolbar:
            "blocks | bold italic forecolor | link image table mathequation | codesample media | alignleft aligncenter alignright | bullist numlist | blockquote code | fullscreen",
          branding: false,
          promotion: false,
          // Equations are shown as their LaTeX inside the editor, boxed so they
          // read as one object rather than loose text the author might edit by
          // hand and break.
          content_style: `body { font-family: system-ui, sans-serif; font-size: 16px; max-width: 100%; }
            .${MATH_CLASS} {
              background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px;
              padding: 1px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 0.92em; color: #3730a3; cursor: pointer;
            }
            .${MATH_CLASS}[data-display="block"] { display: block; text-align: center; margin: 12px auto; }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; }
            table td, table th { border: 1px solid #d4d4d8; padding: 6px 10px; }`,
          codesample_languages: [
            { text: "Plain text", value: "plaintext" },
            { text: "TypeScript", value: "typescript" },
            { text: "JavaScript", value: "javascript" },
            { text: "Python", value: "python" },
            { text: "Java", value: "java" },
            { text: "C++", value: "cpp" },
            { text: "SQL", value: "sql" },
            { text: "HTML/XML", value: "markup" },
            { text: "CSS", value: "css" },
            { text: "Bash", value: "bash" },
            { text: "JSON", value: "json" },
          ],
          setup: (editor: TinyMceEditor) => {
            editor.ui?.registry.addButton("mathequation", {
              // TinyMCE has no maths glyph of its own, so the label carries it.
              text: "∑",
              tooltip: "Insert equation",
              onAction: () => openMathDialog(editor),
            });

            // Double clicking an equation reopens it rather than dropping a
            // caret into LaTeX the author would have to repair by hand.
            editor.on?.("dblclick", (e: Event) => {
              const target = e.target as HTMLElement | null;
              if (!target || !editor.dom) return;
              if (editor.dom.getParent(target, `span.${MATH_CLASS}`)) {
                openMathDialog(editor);
              }
            });
          },
          images_upload_handler: onImageUpload
            ? async (blobInfo: { blob: () => Blob }) => {
                const file = blobInfo.blob() as File;
                const url = await onImageUpload(file);
                return url;
              }
            : undefined,
          automatic_uploads: !!onImageUpload,
          file_picker_types: "image",
        }}
      />
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
export default RichTextEditor;
