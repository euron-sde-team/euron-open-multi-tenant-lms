import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

// A form's visibility is governed by `active`; `mode` only distinguishes a
// blocking (MANDATORY) form from a skippable (OPTIONAL) one.
export type MemberFormMode = "OPTIONAL" | "MANDATORY";

export const MEMBER_FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "date",
  "select",
  "multiselect",
  "checkbox",
  "radio",
  "url",
] as const;

export type MemberFormFieldType = (typeof MEMBER_FORM_FIELD_TYPES)[number];

export interface MemberFormField {
  id: string;
  name: string;
  label: string;
  type: MemberFormFieldType;
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
  order: number;
  halfWidth?: boolean;
}

/** Full form config (editor view). */
export interface MemberFormConfig {
  id: string;
  name: string;
  mode: MemberFormMode;
  active: boolean;
  sortOrder: number;
  repromptAfterHours: number;
  title: string;
  description: string | null;
  fields: MemberFormField[];
  createdAt: string;
  updatedAt: string;
}

/** Lightweight row for the forms list page. */
export interface MemberFormSummary {
  id: string;
  name: string;
  mode: MemberFormMode;
  active: boolean;
  sortOrder: number;
  fieldCount: number;
  responseCount: number;
  updatedAt: string;
}

export interface SaveMemberFormRequest {
  name: string;
  mode: MemberFormMode;
  active: boolean;
  repromptAfterHours: number;
  title: string;
  description: string | null;
  fields: MemberFormField[];
}

export interface MemberFormResponse {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
  data: Record<string, unknown>;
  completedAt: string;
}

export interface MemberFormResponsesResult {
  form: { id: string; name: string; title: string };
  fields: MemberFormField[];
  responses: MemberFormResponse[];
  total: number;
  page: number;
  limit: number;
}

/** One member's answers to a single form (used in the user detail tab). */
export interface MemberResponseForMember {
  formId: string;
  formName: string;
  fields: MemberFormField[];
  data: Record<string, unknown>;
  completedAt: string;
}

export const memberFormApi = {
  listForms: async (): Promise<MemberFormSummary[]> => {
    const res = await apiClient.get<ApiResponse<MemberFormSummary[]>>(
      "/tenant/member-form"
    );
    return res.data.data;
  },

  getForm: async (formId: string): Promise<MemberFormConfig> => {
    const res = await apiClient.get<ApiResponse<MemberFormConfig>>(
      `/tenant/member-form/${formId}`
    );
    return res.data.data;
  },

  createForm: async (
    data: Partial<SaveMemberFormRequest>
  ): Promise<MemberFormConfig> => {
    const res = await apiClient.post<ApiResponse<MemberFormConfig>>(
      "/tenant/member-form",
      data
    );
    return res.data.data;
  },

  updateForm: async (
    formId: string,
    data: SaveMemberFormRequest
  ): Promise<MemberFormConfig> => {
    const res = await apiClient.put<ApiResponse<MemberFormConfig>>(
      `/tenant/member-form/${formId}`,
      data
    );
    return res.data.data;
  },

  deleteForm: async (formId: string): Promise<void> => {
    await apiClient.delete(`/tenant/member-form/${formId}`);
  },

  // Partial update, the backend merges with the stored form, so the list can
  // flip the active toggle without re-sending the whole config.
  setActive: async (
    formId: string,
    active: boolean
  ): Promise<MemberFormConfig> => {
    const res = await apiClient.put<ApiResponse<MemberFormConfig>>(
      `/tenant/member-form/${formId}`,
      { active }
    );
    return res.data.data;
  },

  reorderForms: async (orderedIds: string[]): Promise<void> => {
    await apiClient.put("/tenant/member-form/reorder", { orderedIds });
  },

  listResponses: async (
    formId: string,
    params: { page?: number; limit?: number }
  ): Promise<MemberFormResponsesResult> => {
    const res = await apiClient.get<ApiResponse<MemberFormResponsesResult>>(
      `/tenant/member-form/${formId}/responses`,
      { params }
    );
    return res.data.data;
  },

  listMemberResponses: async (
    memberId: string
  ): Promise<MemberResponseForMember[]> => {
    const res = await apiClient.get<ApiResponse<MemberResponseForMember[]>>(
      `/tenant/member-form/responses/member/${memberId}`
    );
    return res.data.data;
  },
};
