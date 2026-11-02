// A form's visibility is governed by `active`; `mode` only distinguishes a
// blocking (MANDATORY) form from a skippable (OPTIONAL) one. The legacy
// "DISABLED" mode is gone, an inactive form is simply `active: false`.
export type MemberFormMode = "OPTIONAL" | "MANDATORY";

export const MEMBER_FORM_MODES: MemberFormMode[] = ["OPTIONAL", "MANDATORY"];

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
export interface MemberFormConfigResponse {
  id: string;
  name: string;
  mode: MemberFormMode;
  active: boolean;
  sortOrder: number;
  repromptAfterHours: number;
  title: string;
  description: string | null;
  fields: MemberFormField[];
  createdAt: Date;
  updatedAt: Date;
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
  updatedAt: Date;
}

export interface CreateMemberFormRequest {
  name?: string;
  mode?: MemberFormMode;
  active?: boolean;
  repromptAfterHours?: number;
  title?: string;
  description?: string | null;
  fields?: MemberFormField[];
}

export interface UpdateMemberFormConfigRequest {
  name?: string;
  mode?: MemberFormMode;
  active?: boolean;
  repromptAfterHours?: number;
  title?: string;
  description?: string | null;
  fields?: MemberFormField[];
}
