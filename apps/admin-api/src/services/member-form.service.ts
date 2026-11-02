import { ulid } from "ulid";

import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import memberFormConfigRepository, {
  type MemberFormConfigRow,
} from "../repositories/member-form-config.repository";
import {
  MEMBER_FORM_FIELD_TYPES,
  MEMBER_FORM_MODES,
  type CreateMemberFormRequest,
  type MemberFormConfigResponse,
  type MemberFormField,
  type MemberFormFieldType,
  type MemberFormMode,
  type MemberFormSummary,
  type UpdateMemberFormConfigRequest,
} from "../types/member-form.type";
import {
  decodeHtmlEntities,
  decodeNullableText,
} from "../utils/decode-html";

const OPTION_FIELD_TYPES: MemberFormFieldType[] = [
  "select",
  "multiselect",
  "radio",
];
const MAX_FIELDS = 50;
const MAX_FORMS = 50;

class MemberFormService {
  // ── Forms (admin) ────────────────────────────────────────────────────

  async listForms(tenantId: string): Promise<MemberFormSummary[]> {
    const rows = await memberFormConfigRepository.listSummariesByTenant(
      tenantId
    );
    return rows.map((row) => ({
      id: row.id,
      name: decodeHtmlEntities(row.name),
      mode: this.coerceMode(row.mode),
      active: row.active,
      sortOrder: row.sort_order,
      fieldCount: row.field_count,
      responseCount: row.response_count,
      updatedAt: row.updated_at,
    }));
  }

  async getForm(
    tenantId: string,
    formId: string
  ): Promise<MemberFormConfigResponse> {
    const row = await memberFormConfigRepository.findById(tenantId, formId);
    if (!row) throw new NotFoundError("Form not found");
    return this.mapRowToResponse(row);
  }

  async createForm(
    tenantId: string,
    data: CreateMemberFormRequest
  ): Promise<MemberFormConfigResponse> {
    const fields =
      data.fields !== undefined ? this.validateFields(data.fields) : [];
    const validated = this.validateMeta(data, fields);

    const existing = await memberFormConfigRepository.listByTenant(tenantId);
    if (existing.length >= MAX_FORMS) {
      throw new BadRequestError(`You can create at most ${MAX_FORMS} forms`);
    }

    const sortOrder = (await memberFormConfigRepository.maxSortOrder(tenantId)) + 1;
    const row = await memberFormConfigRepository.create(ulid(), tenantId, {
      name: validated.name,
      mode: validated.mode,
      active: validated.active,
      sort_order: sortOrder,
      reprompt_after_hours: validated.repromptAfterHours,
      title: validated.title,
      description: validated.description,
      fields,
    });
    return this.mapRowToResponse(row);
  }

  async updateForm(
    tenantId: string,
    formId: string,
    data: UpdateMemberFormConfigRequest
  ): Promise<MemberFormConfigResponse> {
    const current = await memberFormConfigRepository.findById(tenantId, formId);
    if (!current) throw new NotFoundError("Form not found");

    const fields =
      data.fields !== undefined
        ? this.validateFields(data.fields)
        : this.coerceStoredFields(current.fields);

    const validated = this.validateMeta(
      {
        name: data.name ?? current.name,
        mode: data.mode ?? this.coerceMode(current.mode),
        active: data.active ?? current.active,
        repromptAfterHours:
          data.repromptAfterHours ?? current.reprompt_after_hours,
        title: data.title ?? current.title,
        description:
          data.description !== undefined
            ? data.description
            : current.description,
      },
      fields
    );

    const row = await memberFormConfigRepository.update(tenantId, formId, {
      name: validated.name,
      mode: validated.mode,
      active: validated.active,
      reprompt_after_hours: validated.repromptAfterHours,
      title: validated.title,
      description: validated.description,
      fields,
    });
    if (!row) throw new NotFoundError("Form not found");
    return this.mapRowToResponse(row);
  }

  async deleteForm(tenantId: string, formId: string): Promise<void> {
    const ok = await memberFormConfigRepository.delete(tenantId, formId);
    if (!ok) throw new NotFoundError("Form not found");
  }

  async reorderForms(tenantId: string, orderedIds: unknown): Promise<void> {
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
      throw new BadRequestError("orderedIds must be an array of form ids");
    }
    const existing = await memberFormConfigRepository.listByTenant(tenantId);
    const existingIds = new Set(existing.map((f) => f.id));
    const ids = orderedIds as string[];
    if (
      ids.length !== existing.length ||
      ids.some((id) => !existingIds.has(id)) ||
      new Set(ids).size !== ids.length
    ) {
      throw new BadRequestError(
        "orderedIds must contain each form exactly once"
      );
    }
    await memberFormConfigRepository.reorder(tenantId, ids);
  }

  // ── Responses (admin) ────────────────────────────────────────────────

  async listResponses(
    tenantId: string,
    formId: string,
    page: number,
    limit: number
  ) {
    const config = await memberFormConfigRepository.findById(tenantId, formId);
    if (!config) throw new NotFoundError("Form not found");

    const result = await memberFormConfigRepository.listResponses(
      tenantId,
      formId,
      page,
      limit
    );

    return {
      form: {
        id: config.id,
        name: decodeHtmlEntities(config.name),
        title: decodeHtmlEntities(config.title),
      },
      fields: this.coerceStoredFields(config.fields),
      responses: result.responses.map((r) => ({
        id: r.id,
        memberId: r.member_id,
        memberName: r.member_name,
        memberEmail: r.member_email,
        memberPhone: r.member_phone,
        data: this.decodeData(r.data),
        completedAt: r.completed_at,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  async getMemberResponse(
    tenantId: string,
    formId: string,
    memberId: string
  ) {
    const [config, response] = await Promise.all([
      memberFormConfigRepository.findById(tenantId, formId),
      memberFormConfigRepository.getResponseForMember(
        tenantId,
        formId,
        memberId
      ),
    ]);
    if (!config) throw new NotFoundError("Form not found");

    return {
      fields: this.coerceStoredFields(config.fields),
      response: response
        ? {
            data: this.decodeData(response.data),
            completedAt: response.completed_at,
          }
        : null,
    };
  }

  /** All of a member's responses, grouped per form (for the user detail tab). */
  async listMemberResponses(tenantId: string, memberId: string) {
    const rows = await memberFormConfigRepository.listResponsesForMember(
      tenantId,
      memberId
    );
    return rows.map((r) => ({
      formId: r.form_id,
      formName: decodeHtmlEntities(r.form_name),
      fields: this.coerceStoredFields(r.fields),
      data: this.decodeData(r.data),
      completedAt: r.completed_at,
    }));
  }

  // ── Validation helpers ───────────────────────────────────────────────

  private validateMeta(
    data: {
      name?: string;
      mode?: MemberFormMode;
      active?: boolean;
      repromptAfterHours?: number;
      title?: string;
      description?: string | null;
    },
    fields: MemberFormField[]
  ): {
    name: string;
    mode: MemberFormMode;
    active: boolean;
    repromptAfterHours: number;
    title: string;
    description: string | null;
  } {
    let name = decodeHtmlEntities(String(data.name ?? "")).trim();
    if (name.length === 0) name = "Untitled form";
    if (name.length > 120) throw new BadRequestError("Form name is too long");

    const mode: MemberFormMode = this.coerceMode(data.mode);

    const active = data.active === true;

    let repromptAfterHours = data.repromptAfterHours ?? 24;
    if (
      typeof repromptAfterHours !== "number" ||
      !Number.isFinite(repromptAfterHours) ||
      repromptAfterHours < 1 ||
      repromptAfterHours > 8760
    ) {
      throw new BadRequestError(
        "Re-prompt interval must be between 1 and 8760 hours"
      );
    }
    repromptAfterHours = Math.round(repromptAfterHours);

    const title = decodeHtmlEntities(
      String(data.title ?? "Complete your profile")
    ).trim();
    if (title.length === 0) throw new BadRequestError("Form title is required");
    if (title.length > 200) throw new BadRequestError("Form title is too long");

    let description: string | null =
      data.description != null ? decodeHtmlEntities(String(data.description)) : null;
    if (description !== null) {
      description = description.trim();
      if (description.length === 0) description = null;
      else if (description.length > 1000) {
        throw new BadRequestError("Form description is too long");
      }
    }

    // An active form with no fields would gate users behind an empty modal they
    // can never complete; block that footgun.
    if (active && fields.length === 0) {
      throw new BadRequestError(
        "Add at least one field before activating the form"
      );
    }

    return { name, mode, active, repromptAfterHours, title, description };
  }

  /**
   * Validate incoming field definitions and let the SYSTEM own field keys: the
   * admin only provides labels, we derive a stable, unique key from each label
   * (or keep a previously-assigned key). All user-facing text is decoded so the
   * xss-sanitizer's entities never reach storage.
   */
  private validateFields(input: unknown): MemberFormField[] {
    if (!Array.isArray(input)) {
      throw new BadRequestError("fields must be an array");
    }
    if (input.length > MAX_FIELDS) {
      throw new BadRequestError(`A form can have at most ${MAX_FIELDS} fields`);
    }

    const usedNames = new Set<string>();
    const result: MemberFormField[] = [];

    input.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") {
        throw new BadRequestError(`Field at position ${index + 1} is invalid`);
      }
      const f = raw as Record<string, unknown>;

      const label = decodeHtmlEntities(
        typeof f.label === "string" ? f.label : ""
      ).trim();
      if (label.length === 0) {
        throw new BadRequestError(
          `Field at position ${index + 1} needs a label`
        );
      }
      if (label.length > 200) {
        throw new BadRequestError(`Field "${label}" label is too long`);
      }

      const type = f.type as MemberFormFieldType;
      if (!MEMBER_FORM_FIELD_TYPES.includes(type)) {
        throw new BadRequestError(`Field "${label}" has an unsupported type`);
      }

      // System-managed key: reuse a valid prior key, else slugify the label.
      const provided = typeof f.name === "string" ? f.name.trim() : "";
      const base = this.slugify(provided) || this.slugify(label) || "field";
      const name = this.uniquify(base, usedNames);
      usedNames.add(name);

      let options: string[] | undefined;
      if (OPTION_FIELD_TYPES.includes(type)) {
        const rawOptions = Array.isArray(f.options) ? f.options : [];
        options = rawOptions
          .map((o) => (typeof o === "string" ? decodeHtmlEntities(o).trim() : ""))
          .filter((o) => o.length > 0);
        if (options.length === 0) {
          throw new BadRequestError(
            `Field "${label}" needs at least one option`
          );
        }
      }

      const field: MemberFormField = {
        id: typeof f.id === "string" && f.id.length > 0 ? f.id : ulid(),
        name,
        label,
        type,
        required: f.required === true,
        order: index,
      };
      if (typeof f.placeholder === "string" && f.placeholder.trim().length > 0) {
        field.placeholder = decodeHtmlEntities(f.placeholder).trim();
      }
      if (typeof f.helpText === "string" && f.helpText.trim().length > 0) {
        field.helpText = decodeHtmlEntities(f.helpText).trim();
      }
      if (options) field.options = options;
      if (f.halfWidth === true) field.halfWidth = true;

      result.push(field);
    });

    return result;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^([0-9])/, "f_$1");
  }

  private uniquify(base: string, used: Set<string>): string {
    if (!used.has(base)) return base;
    let i = 2;
    while (used.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  }

  private coerceMode(mode: unknown): MemberFormMode {
    return MEMBER_FORM_MODES.includes(mode as MemberFormMode)
      ? (mode as MemberFormMode)
      : "OPTIONAL";
  }

  private coerceStoredFields(stored: unknown): MemberFormField[] {
    if (!Array.isArray(stored)) return [];
    // Decode legacy rows that were stored entity-encoded; a no-op for new rows.
    return stored.map((f) => {
      if (!f || typeof f !== "object") return f as MemberFormField;
      const field = { ...(f as MemberFormField) };
      if (typeof field.label === "string") field.label = decodeHtmlEntities(field.label);
      if (typeof field.placeholder === "string")
        field.placeholder = decodeHtmlEntities(field.placeholder);
      if (typeof field.helpText === "string")
        field.helpText = decodeHtmlEntities(field.helpText);
      if (Array.isArray(field.options))
        field.options = field.options.map((o) =>
          typeof o === "string" ? decodeHtmlEntities(o) : o
        );
      return field;
    });
  }

  private decodeData(data: unknown): Record<string, unknown> {
    const obj = (data ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") out[k] = decodeHtmlEntities(v);
      else if (Array.isArray(v))
        out[k] = v.map((item) =>
          typeof item === "string" ? decodeHtmlEntities(item) : item
        );
      else out[k] = v;
    }
    return out;
  }

  private mapRowToResponse(
    row: MemberFormConfigRow
  ): MemberFormConfigResponse {
    return {
      id: row.id,
      name: decodeHtmlEntities(row.name),
      mode: this.coerceMode(row.mode),
      active: row.active,
      sortOrder: row.sort_order,
      repromptAfterHours: row.reprompt_after_hours,
      title: decodeHtmlEntities(row.title),
      description: decodeNullableText(row.description),
      fields: this.coerceStoredFields(row.fields),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new MemberFormService();
