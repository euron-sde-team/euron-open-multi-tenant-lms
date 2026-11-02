export type WizardStep = "template" | "theme" | "business-info";

export interface BusinessInfoAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface BusinessInfoSocialLinks {
  website: string;
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  youtube: string;
}

export interface BusinessInfo {
  // Basic
  name: string;
  tagline: string;
  description: string;
  // Contact
  contactEmail: string;
  supportEmail: string;
  phoneNumbers: string[];
  whatsappNumbers: string[];
  // Address
  address: BusinessInfoAddress;
  // Founder
  founderName: string;
  founderTitle: string;
  founderBio: string;
  // Social
  socialLinks: BusinessInfoSocialLinks;
  // Legal
  legalEntityName: string;
  registrationNumber: string;
  yearEstablished: string;
  industry: string;
}

export const defaultBusinessInfo: BusinessInfo = {
  name: "",
  tagline: "",
  description: "",
  contactEmail: "",
  supportEmail: "",
  phoneNumbers: [],
  whatsappNumbers: [],
  address: { line1: "", line2: "", city: "", state: "", country: "", postalCode: "" },
  founderName: "",
  founderTitle: "",
  founderBio: "",
  socialLinks: { website: "", linkedin: "", twitter: "", facebook: "", instagram: "", youtube: "" },
  legalEntityName: "",
  registrationNumber: "",
  yearEstablished: "",
  industry: "",
};

export interface WizardPageDefinition {
  slug: string;
  title: string;
  templateId: string;
  category: string;
  /** Skip AI content generation for this page (e.g. login, profile) */
  skipAI?: boolean;
}

export type PageCreationStatus =
  | "pending"
  | "creating"
  | "created"
  | "ai-generating"
  | "ai-done"
  | "ai-failed"
  | "publishing"
  | "published"
  | "error";

export interface PageProgress {
  slug: string;
  title: string;
  status: PageCreationStatus;
  pageId?: string;
  error?: string;
}

export type LaunchPhase = "idle" | "creating" | "ai-generating" | "publishing" | "done" | "error";
