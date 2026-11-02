import type { CertificateDesign } from "@open-mtlms/certificate-templates";

import type { CertificateTemplateRow } from "@/lib/api/certificate-designer";

/** Reconstruct a full CertificateDesign from a stored custom design row. */
export function rowToDesign(row: CertificateTemplateRow): CertificateDesign {
  const layout = row.layout ?? { page: {}, elements: [] };
  return {
    page: {
      size: (row.page_size as CertificateDesign["page"]["size"]) ?? "A4",
      orientation:
        (row.orientation as CertificateDesign["page"]["orientation"]) ?? "LANDSCAPE",
    },
    background: {
      assetUrl: row.background_asset_url ?? layout.background?.assetUrl ?? null,
      color: layout.background?.color ?? "#ffffff",
    },
    elements: layout.elements ?? [],
  };
}
