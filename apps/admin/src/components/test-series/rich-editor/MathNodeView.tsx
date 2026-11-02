"use client";

import katex from "katex";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { MathEquationDialog } from "./MathEquationDialog";

/**
 * Renders a math node (inline or block) using KaTeX. Double-click opens an
 * equation dialog so non-technical users can edit the LaTeX with a live
 * preview, never seeing the raw $...$ delimiters in the WYSIWYG view.
 */
export function MathNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const isBlock = node.type.name === "mathBlock";
  const latex = (node.attrs.latex as string) || "";

  const html = (() => {
    try {
      return katex.renderToString(latex || "?", {
        displayMode: isBlock,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return latex;
    }
  })();

  const Tag = isBlock ? "div" : "span";

  return (
    <NodeViewWrapper
      as={Tag}
      className={cn(
        "cursor-pointer rounded transition-shadow",
        isBlock
          ? "my-2 block px-2 py-1"
          : "mx-0.5 inline-block px-1",
        selected && "bg-blue-100 ring-2 ring-blue-400",
        !latex && "border-destructive border border-dashed text-xs text-red-500",
      )}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit equation"
      contentEditable={false}
    >
      {latex ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span>(empty equation, double-click to edit)</span>
      )}
      <MathEquationDialog
        open={editing}
        initialLatex={latex}
        displayMode={isBlock}
        onCancel={() => setEditing(false)}
        onConfirm={(nextLatex) => {
          if (nextLatex.trim() === "") {
            deleteNode();
          } else {
            updateAttributes({ latex: nextLatex });
          }
          setEditing(false);
        }}
      />
    </NodeViewWrapper>
  );
}
