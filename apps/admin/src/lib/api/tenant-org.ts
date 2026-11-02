import { apiClient } from "./axios";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TenantOrgAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface TenantOrgSocialLinks {
  website?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
  telegram?: string;
  discord?: string;
}

export interface TenantOrgDetails {
  id: string;
  tenantId: string;
  logoLightKey: string | null;
  logoDarkKey: string | null;
  faviconKey: string | null;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  supportEmail: string | null;
  phoneNumbers: string[] | null;
  whatsappNumbers: string[] | null;
  address: TenantOrgAddress | null;
  founderName: string | null;
  founderTitle: string | null;
  founderBio: string | null;
  founderPhotoKey: string | null;
  socialLinks: TenantOrgSocialLinks | null;
  legalEntityName: string | null;
  registrationNumber: string | null;
  yearEstablished: number | null;
  industry: string | null;
  androidAppUrl: string | null;
  iosAppUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantBillingDetails {
  legalEntityName: string | null;
  registrationNumber: string | null;
  gstin: string | null;
  panNumber: string | null;
  billingAddress: TenantOrgAddress | null;
  billingEmail: string | null;
  billingPhone: string | null;
  hsnSacCode: string | null;
  taxId: string | null;
  taxMode: string;
  taxPercentage: number;
}

export interface UpdateBillingDetailsRequest {
  legal_entity_name?: string | null;
  registration_number?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  billing_address?: TenantOrgAddress | null;
  billing_email?: string | null;
  billing_phone?: string | null;
  hsn_sac_code?: string | null;
  tax_id?: string | null;
  tax_mode?: string | null;
  tax_percentage?: number | null;
}

export interface UpdateTenantOrgRequest {
  tagline?: string | null;
  description?: string | null;
  contact_email?: string | null;
  support_email?: string | null;
  phone_numbers?: string[] | null;
  whatsapp_numbers?: string[] | null;
  address?: TenantOrgAddress | null;
  founder_name?: string | null;
  founder_title?: string | null;
  founder_bio?: string | null;
  social_links?: TenantOrgSocialLinks | null;
  legal_entity_name?: string | null;
  registration_number?: string | null;
  year_established?: number | null;
  industry?: string | null;
  /** Empty string clears the link. Omit the field to leave it untouched. */
  android_app_url?: string | null;
  ios_app_url?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─────────────────────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────────────────────

export const tenantOrgApi = {
  getOrgDetails: async (): Promise<TenantOrgDetails> => {
    const response = await apiClient.get<ApiResponse<TenantOrgDetails>>(
      "/tenant/org-details"
    );
    return response.data.data;
  },

  updateOrgDetails: async (data: UpdateTenantOrgRequest): Promise<TenantOrgDetails> => {
    const response = await apiClient.put<ApiResponse<TenantOrgDetails>>(
      "/tenant/org-details",
      data
    );
    return response.data.data;
  },

  uploadLogo: async (slot: "light" | "dark", file: File): Promise<TenantOrgDetails> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<ApiResponse<TenantOrgDetails>>(
      `/tenant/org-details/logo/${slot}`,
      formData
    );
    return response.data.data;
  },

  uploadFavicon: async (file: File): Promise<TenantOrgDetails> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<ApiResponse<TenantOrgDetails>>(
      "/tenant/org-details/favicon",
      formData
    );
    return response.data.data;
  },

  uploadFounderPhoto: async (file: File): Promise<TenantOrgDetails> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<ApiResponse<TenantOrgDetails>>(
      "/tenant/org-details/founder-photo",
      formData
    );
    return response.data.data;
  },

  deleteLogo: async (slot: "light" | "dark"): Promise<TenantOrgDetails> => {
    const response = await apiClient.delete<ApiResponse<TenantOrgDetails>>(
      `/tenant/org-details/logo/${slot}`
    );
    return response.data.data;
  },

  deleteFavicon: async (): Promise<TenantOrgDetails> => {
    const response = await apiClient.delete<ApiResponse<TenantOrgDetails>>(
      "/tenant/org-details/favicon"
    );
    return response.data.data;
  },

  deleteFounderPhoto: async (): Promise<TenantOrgDetails> => {
    const response = await apiClient.delete<ApiResponse<TenantOrgDetails>>(
      "/tenant/org-details/founder-photo"
    );
    return response.data.data;
  },

  getBillingDetails: async (): Promise<TenantBillingDetails> => {
    const response = await apiClient.get<ApiResponse<TenantBillingDetails>>(
      "/tenant/org-details/billing-details"
    );
    return response.data.data;
  },

  updateBillingDetails: async (data: UpdateBillingDetailsRequest): Promise<TenantBillingDetails> => {
    const response = await apiClient.put<ApiResponse<TenantBillingDetails>>(
      "/tenant/org-details/billing-details",
      data
    );
    return response.data.data;
  },
};
