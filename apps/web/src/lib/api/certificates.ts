import type { CertificateDesign } from "@open-mtlms/certificate-templates";

import { apiGet, apiPost } from "./api-client";

const API_BASE_URL =
  ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:5096/api/v1";

/** Extended, config-driven certificate variables (all optional; null when the
 *  achievement type doesn't populate them). Present on both generate + verify. */
export interface CertificateDesignFields {
  design: CertificateDesign | null;
  hoursText: string | null;
  lessonsCompleted: number | null;
  quizzesPassed: number | null;
  finalScore: string | null;
  testSeriesTitle: string | null;
  signatureUrl: string | null;
  expiryText: string | null;
}

/**
 * Returns a proxied logo URL that is safe to fetch with `crossOrigin="anonymous"`
 * regardless of the source bucket's CORS configuration. The backend fetches the
 * upstream image server-side and returns it with permissive CORS headers so the
 * PDF exporter can read pixel data for base64 embedding.
 *
 * Returns the original URL unchanged if it's not a string we can encode, the
 * caller handles that failure path by omitting the logo from the PDF.
 */
export function getLogoProxyUrl(logoUrl: string): string {
  if (!logoUrl) return logoUrl;
  return `${API_BASE_URL}/certificates/logo-proxy?url=${encodeURIComponent(logoUrl)}`;
}

export interface GenerateCertificateResponse extends CertificateDesignFields {
  html: string;
  certificateNumber: string;
  issuedAt: string;
  templateId: string;
  courseTitle: string;
  firstName: string;
  lastName: string;
  formattedIssuedAt: string;
  logoUrl: string;
  verifyUrl: string;
  directorName: string;
  directorTitle: string;
  tenantName: string;
}

export interface CertificateStatusResponse {
  hasCertificate: boolean;
  certificateEnabled: boolean;
  certificateNumber?: string;
}

export async function generateCertificate(
  courseId: string
): Promise<GenerateCertificateResponse> {
  return apiPost<GenerateCertificateResponse>(
    `/courses/${courseId}/certificate`
  );
}

export async function getCertificateStatus(
  courseId: string
): Promise<CertificateStatusResponse> {
  return apiGet<CertificateStatusResponse>(
    `/courses/${courseId}/certificate/status`
  );
}

export interface VerifyCertificateResponse extends CertificateDesignFields {
  valid: boolean;
  certificateNumber: string;
  templateId: string;
  courseTitle: string;
  firstName: string;
  lastName: string;
  formattedIssuedAt: string;
  logoUrl: string;
  verifyUrl: string;
  directorName: string;
  directorTitle: string;
  tenantName: string;
  issuedAt: string;
}

export async function verifyCertificate(
  certificateNumber: string
): Promise<VerifyCertificateResponse> {
  return apiGet<VerifyCertificateResponse>(
    `/certificates/verify/${certificateNumber}`
  );
}
