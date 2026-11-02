/**
 * A custom certificate design (certificate_templates row) in the shape the
 * renderer (packages/certificate-templates ConfigCertificateRenderer) takes.
 * Mirrors normalizeDesign in the learner-api's certificate.service.ts.
 */
export interface CertificateDesignSnapshot {
  page: { size: string; orientation: string };
  background: { assetUrl: string | null; color: string };
  elements: unknown[];
}

export function toCertificateDesignSnapshot(row: {
  layout: unknown;
  page_size: string;
  orientation: string;
  background_asset_url: string | null;
}): CertificateDesignSnapshot {
  const layout = (row.layout ?? {}) as {
    background?: { assetUrl?: string | null; color?: string | null };
    elements?: unknown[];
  };
  return {
    page: { size: row.page_size, orientation: row.orientation },
    background: {
      assetUrl: row.background_asset_url ?? layout.background?.assetUrl ?? null,
      color: layout.background?.color ?? "#ffffff",
    },
    elements: Array.isArray(layout.elements) ? layout.elements : [],
  };
}

/** A stored snapshot back into a design, or null when it is not one. */
export function snapshotToDesign(snapshot: unknown): CertificateDesignSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as CertificateDesignSnapshot;
  if (!s.page || !Array.isArray(s.elements)) return null;
  return s;
}
