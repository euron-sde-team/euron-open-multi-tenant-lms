export type {
  CertificateData,
  CertificateTheme,
  CertificateTemplateMeta,
  CertificateComponentProps,
  CertificateTemplateComponent,
  RegistryEntry,
  CertificatePageSize,
  CertificateOrientation,
  CertificateVariable,
  CertificateElement,
  CertificateElementBase,
  CertificateVariableElement,
  CertificateTextElement,
  CertificateImageElement,
  CertificateQrElement,
  CertificateDesign,
} from "./types";

export { CERTIFICATE_PAGE_DIMENSIONS } from "./types";

export {
  CERTIFICATE_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  listTemplates,
} from "./registry";

export {
  CertificateRenderer,
  ConfigCertificateRenderer,
  CertificateQR,
  LogoImage,
  Divider,
  CertNumberBadge,
  VerifyLink,
  VerticalText,
  AutoFitName,
  useCertificateFonts,
} from "./components";
