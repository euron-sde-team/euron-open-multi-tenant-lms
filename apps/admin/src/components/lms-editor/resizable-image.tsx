"use client";

import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useRef } from "react";

const MIN_WIDTH = 80;

/**
 * Inline image node with a drag-to-resize handle.
 *
 * Width is stored on the standard `width` attribute (NOT inline `style`) so it
 * survives the strict student-side HTML sanitizer (`sanitize-html.ts` allows
 * `img[width]`) and renders in any browser as `<img width="…">`, unlike
 * community resize extensions that stash size in non-standard attributes only
 * their own node view understands.
 *
 * Alignment is handled by the TextAlign extension on the wrapping paragraph
 * (`<p style="text-align:…">`); because the image is INLINE, paragraph
 * text-align centers/left/right-aligns it with plain, portable HTML.
 */
function ResizableImageView({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const width = (node.attrs.width as number | null) ?? null;
  const editable = editor.isEditable;

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      if (!img) return;
      const startX = e.clientX;
      const startWidth = img.offsetWidth;

      const onMove = (ev: PointerEvent) => {
        const next = Math.max(
          MIN_WIDTH,
          Math.round(startWidth + (ev.clientX - startX))
        );
        updateAttributes({ width: next });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [updateAttributes]
  );

  return (
    <NodeViewWrapper
      as="span"
      className="lesson-img"
      data-selected={selected ? "true" : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ""}
        title={(node.attrs.title as string) ?? undefined}
        width={width ?? undefined}
        draggable={false}
      />
      {editable && (
        <span
          className="lesson-img-handle"
          onPointerDown={startResize}
          contentEditable={false}
          aria-hidden="true"
        />
      )}
    </NodeViewWrapper>
  );
}

/**
 * Inline, resizable image extension. `.configure({ inline: true })` makes the
 * base Image node inline (group "inline"), so it lives inside paragraphs and is
 * alignable via TextAlign.
 */
export const ResizableImage = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute("width");
          if (!w) return null;
          const n = parseInt(w, 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (attributes) => {
          const w = attributes.width as number | null;
          return w ? { width: w } : {};
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
}).configure({ inline: true });

export default ResizableImage;
