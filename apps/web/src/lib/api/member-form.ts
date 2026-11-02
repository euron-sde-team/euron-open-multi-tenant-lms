import { apiGet, apiPost } from "./api-client";

export type MemberFormMode = "OPTIONAL" | "MANDATORY";

export type MemberFormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "url";

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

export interface MemberForm {
  id: string;
  mode: MemberFormMode;
  repromptAfterHours: number;
  title: string;
  description: string | null;
  fields: MemberFormField[];
  completed: boolean;
}

export interface MemberFormList {
  forms: MemberForm[];
}

export const memberFormApi = {
  get: (): Promise<MemberFormList> => apiGet("/member-form"),

  submit: (
    formId: string,
    data: Record<string, unknown>
  ): Promise<{ completed: boolean }> =>
    apiPost("/member-form/responses", { formId, data }),
};
