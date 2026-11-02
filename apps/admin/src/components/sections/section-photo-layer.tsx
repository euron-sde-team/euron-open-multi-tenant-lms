"use client";

import { Tooltip, TooltipContent, TooltipTrigger, useToast } from "@open-mtlms/core";
import type { SectionConfig, SectionPhoto } from "@open-mtlms/shared";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadApi } from "@/lib/api/upload";

// ssr:false keeps @imgly/background-removal (and onnxruntime) out of the server
// bundle. See the note in section-photo-remove-bg.tsx.
const RemoveBackgroundButton = dynamic(() => import("./section-photo-remove-bg"), {
  ssr: false,
  loading: () => <span className="grid h-7 w-7 place-items-center"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span>,
});
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

/**
 * Photos dropped onto a section and positioned by dragging them: a founder's
 * portrait on About us, a mascot in a corner, a signature under a quote.
 *
 * Geometry is PERCENTAGES of the section box, matching the read-only twin at
 * `apps/web/src/components/sections/section-photo-layer.tsx`. Keep the two in
 * step or a photo lands in one place here and another on the live site.
 *
 * A drag updates local state on every mouse move and writes to the editor store
 * ONCE, on release. Writing on each move would push a history entry per pixel,
 * making undo useless and re-rendering the whole page 60 times a second.
 */

const MIN_WIDTH_PCT = 4;
const MAX_WIDTH_PCT = 100;

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: "resize"; id: string; startX: number; startWidth: number };

function readPhotos(section: SectionConfig): SectionPhoto[] {
  return section.settings?.photos ?? [];
}

export function SectionPhotoLayer({
  section,
  editable,
}: {
  section: SectionConfig;
  /** False in the preview pane, where photos render but cannot be moved. */
  editable: boolean;
}) {
  const { updateSection } = useEditorStore();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<SectionPhoto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // What the photo overlay says while the background is being cut out.
  const [status, setStatus] = useState<string | null>(null);

  const stored = readPhotos(section);
  const photos = draft ?? stored;

  const commit = useCallback(
    (next: SectionPhoto[]) => {
      updateSection(section.id, {
        settings: { ...(section.settings ?? {}), photos: next },
      });
    },
    [section.id, section.settings, updateSection]
  );

  /* ---- drag and resize ------------------------------------------------ */

  useEffect(() => {
    if (!drag) return;
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;

    const onMove = (e: PointerEvent) => {
      setDraft((current) => {
        const list = current ?? stored;
        return list.map((p) => {
          if (p.id !== drag.id) return p;
          if (drag.kind === "move") {
            const dx = ((e.clientX - drag.startX) / box.width) * 100;
            const dy = ((e.clientY - drag.startY) / box.height) * 100;
            // Clamped so a photo can never be dragged fully out of its section
            // and become impossible to grab again.
            return {
              ...p,
              x: Math.min(100, Math.max(0, drag.originX + dx)),
              y: Math.min(100, Math.max(0, drag.originY + dy)),
            };
          }
          const dw = ((e.clientX - drag.startX) / box.width) * 100;
          return {
            ...p,
            width: Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, drag.startWidth + dw * 2)),
          };
        });
      });
    };

    const onUp = () => {
      setDraft((current) => {
        if (current) commit(current);
        return null;
      });
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, stored, commit]);

  /* ---- per photo actions ---------------------------------------------- */

  const update = (id: string, patch: Partial<SectionPhoto>) =>
    commit(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const remove = (id: string) => {
    commit(photos.filter((p) => p.id !== id));
    setSelectedId(null);
  };

  /** Save the cut out PNG produced in the browser and swap it in. */
  const saveCutout = async (photo: SectionPhoto, file: File) => {
    setBusyId(photo.id);
    try {
      const { url } = await uploadApi.uploadFile(file, "page-images");
      if (!url) throw new Error("The cut out image could not be saved.");
      update(photo.id, { url });
      toast({ title: "Background removed" });
    } catch (err) {
      toast({
        title: "Could not remove the background",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setStatus(null);
    }
  };

  const visible = photos.filter((p) => !p.hidden && p.url);
  if (visible.length === 0) return null;

  return (
    <div
      ref={containerRef}
      // The layer never takes clicks: a portrait laid over a section must not
      // swallow a click meant for the button underneath. Only the photos
      // themselves take pointer events, and only while editing.
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
    >
      {visible.map((photo) => {
        const isSelected = editable && selectedId === photo.id;
        return (
          <div
            key={photo.id}
            className={cn("absolute", editable && "pointer-events-auto")}
            style={{
              left: `${photo.x}%`,
              top: `${photo.y}%`,
              width: `${photo.width}%`,
              transform: `translate(-50%, -50%) rotate(${photo.rotation ?? 0}deg)`,
              zIndex: photo.z ?? 0,
            }}
          >
            <img
              src={photo.url}
              alt={photo.alt ?? ""}
              draggable={false}
              onPointerDown={(e) => {
                if (!editable) return;
                e.stopPropagation();
                e.preventDefault();
                setSelectedId(photo.id);
                setDrag({
                  kind: "move",
                  id: photo.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  originX: photo.x,
                  originY: photo.y,
                });
              }}
              className={cn(
                "block w-full select-none",
                editable && "cursor-move",
                isSelected && "outline-primary outline outline-2 outline-offset-2"
              )}
            />

            {(busyId === photo.id || (status && selectedId === photo.id)) && (
              <div className="absolute inset-0 grid place-items-center gap-1 bg-black/55 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
                <span className="px-1 text-[11px] font-medium leading-tight text-white">
                  {status ?? "Saving"}
                </span>
              </div>
            )}

            {isSelected && (
              <>
                {/* Resize grip, bottom right */}
                <span
                  role="button"
                  aria-label="Resize photo"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDrag({
                      kind: "resize",
                      id: photo.id,
                      startX: e.clientX,
                      startWidth: photo.width,
                    });
                  }}
                  className="border-primary absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 bg-white shadow"
                />

                {/* Actions, above the photo */}
                <div
                  className="bg-background absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-md border p-0.5 shadow-md"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <RemoveBackgroundButton
                    url={photo.url}
                    busy={busyId === photo.id}
                    onCutout={(file) => void saveCutout(photo, file)}
                    onStatus={setStatus}
                    onError={(message) =>
                      toast({ title: "Could not remove the background", description: message, variant: "destructive" })
                    }
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="hover:bg-muted grid h-7 w-7 place-items-center rounded"
                        onClick={() => update(photo.id, { rotation: ((photo.rotation ?? 0) + 15) % 360 })}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Rotate</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-destructive hover:bg-muted grid h-7 w-7 place-items-center rounded"
                        onClick={() => remove(photo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Remove photo</TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A fresh photo, dropped slightly off centre so it does not hide the heading. */
export function buildSectionPhoto(url: string): SectionPhoto {
  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    x: 50,
    y: 55,
    width: 22,
    rotation: 0,
    z: 1,
  };
}
