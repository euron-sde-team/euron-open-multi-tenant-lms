"use client";

import type { SectionPhoto } from "@open-mtlms/shared";

/**
 * Photos an admin dropped onto a section and positioned by dragging, rendered
 * on the live site.
 *
 * READ ONLY. The editable twin lives in
 * `apps/admin/src/components/sections/section-photo-layer.tsx`; keep the
 * geometry (percentages, transform, z-index) identical in both or a photo will
 * sit in one place in the editor and another on the site.
 *
 * `pointer-events-none` on the layer matters: a founder's portrait laid over an
 * About us section must not swallow clicks meant for the button underneath it.
 */
export function SectionPhotoLayer({ photos }: { photos?: SectionPhoto[] }) {
  const visible = (photos ?? []).filter((p) => !p.hidden && p.url);
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {visible.map((photo) => (
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.alt ?? ""}
          draggable={false}
          className="absolute select-none"
          style={{
            left: `${photo.x}%`,
            top: `${photo.y}%`,
            width: `${photo.width}%`,
            height: "auto",
            // x and y are the CENTRE of the photo, so it stays put when the
            // photo is resized rather than growing away from where it was put.
            transform: `translate(-50%, -50%) rotate(${photo.rotation ?? 0}deg)`,
            zIndex: photo.z ?? 0,
          }}
        />
      ))}
    </div>
  );
}
