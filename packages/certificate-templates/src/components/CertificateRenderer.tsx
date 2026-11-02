"use client";

import { getTemplate, DEFAULT_TEMPLATE_ID } from "../registry";
import type { CertificateData } from "../types";

interface Props {
  templateId: string | null | undefined;
  data: CertificateData;
  variant?: "full" | "thumbnail";
}

export function CertificateRenderer({ templateId, data, variant = "full" }: Props) {
  const entry = getTemplate(templateId ?? DEFAULT_TEMPLATE_ID) ?? getTemplate(DEFAULT_TEMPLATE_ID)!;
  const Component = entry.component;
  return <Component data={data} variant={variant} />;
}
