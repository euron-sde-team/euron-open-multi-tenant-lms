import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";

import { MathNodeView } from "./MathNodeView";

/**
 * Inline math node, rendered as a KaTeX-formatted span via MathNodeView.
 * The `latex` attribute holds the raw expression. Serializes to `$...$` in
 * Markdown via the markdown-io helper.
 */
export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-latex") ?? "",
        renderHTML: (attrs: { latex: string }) => ({
          "data-latex": attrs.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-math="inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-math": "inline" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});

/**
 * Display math node, block-level KaTeX-rendered equation. Serializes to
 * fenced `$$...$$` in Markdown.
 */
export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-latex") ?? "",
        renderHTML: (attrs: { latex: string }) => ({
          "data-latex": attrs.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-math="block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-math": "block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});
