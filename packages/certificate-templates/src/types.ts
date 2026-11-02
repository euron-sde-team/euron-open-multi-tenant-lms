export interface CertificateData {
  certificateNumber: string;
  courseTitle: string;
  firstName: string;
  lastName: string;
  formattedIssuedAt: string;
  directorName: string;
  directorTitle: string;
  logoUrl?: string | null;
  verifyUrl: string;
  // Extended variables for the config-driven designer (all optional so the
  // 16 legacy templates keep working with the original fields).
  testSeriesTitle?: string | null;
  hoursText?: string | null;
  lessonsCompleted?: number | null;
  quizzesPassed?: number | null;
  finalScore?: string | null;
  expiryText?: string | null;
  signatureUrl?: string | null;
  tenantName?: string | null;
}

// ─── Config-driven certificate designer ────────────────────────────────────

export type CertificatePageSize = "A4" | "LETTER";
export type CertificateOrientation = "LANDSCAPE" | "PORTRAIT";

/** Design-canvas dimensions (px at ~96 DPI) per page size + orientation. */
export const CERTIFICATE_PAGE_DIMENSIONS: Record<
  CertificatePageSize,
  Record<CertificateOrientation, { width: number; height: number }>
> = {
  A4: { LANDSCAPE: { width: 1122, height: 793 }, PORTRAIT: { width: 793, height: 1122 } },
  LETTER: { LANDSCAPE: { width: 1056, height: 816 }, PORTRAIT: { width: 816, height: 1056 } },
};

/** Variable tokens the designer can drop onto the canvas; resolved from CertificateData. */
export type CertificateVariable =
  | "participantName"
  | "firstName"
  | "lastName"
  | "courseTitle"
  | "testSeriesTitle"
  | "certificateNumber"
  | "formattedIssuedAt"
  | "expiryText"
  | "hoursText"
  | "lessonsCompleted"
  | "quizzesPassed"
  | "finalScore"
  | "directorName"
  | "directorTitle"
  | "tenantName";

export interface CertificateElementBase {
  id: string;
  x: number;
  y: number;
  width?: number;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | "normal" | "bold";
  color?: string;
  italic?: boolean;
  letterSpacing?: number;
  rotation?: number;
}
export interface CertificateVariableElement extends CertificateElementBase {
  type: "variable";
  variable: CertificateVariable;
  prefix?: string;
  suffix?: string;
}
export interface CertificateTextElement extends CertificateElementBase {
  type: "text";
  value: string;
}
export interface CertificateImageElement extends CertificateElementBase {
  type: "image";
  assetUrl: string;
  height?: number;
}
export interface CertificateQrElement extends CertificateElementBase {
  type: "qr";
  size?: number;
  fgColor?: string;
  bgColor?: string;
}
export type CertificateElement =
  | CertificateVariableElement
  | CertificateTextElement
  | CertificateImageElement
  | CertificateQrElement;

export interface CertificateDesign {
  page: { size: CertificatePageSize; orientation: CertificateOrientation };
  background?: { assetUrl?: string | null; color?: string | null };
  elements: CertificateElement[];
}

export type CertificateTheme =
  | "elegant"
  | "modern"
  | "minimal"
  | "academic"
  | "corporate"
  | "tech"
  | "editorial";

export interface CertificateTemplateMeta {
  id: string;
  name: string;
  description: string;
  theme: CertificateTheme;
}

export interface CertificateComponentProps {
  data: CertificateData;
  variant?: "full" | "thumbnail";
}

export type CertificateTemplateComponent = React.FC<CertificateComponentProps>;

export interface RegistryEntry {
  meta: CertificateTemplateMeta;
  component: CertificateTemplateComponent;
}
