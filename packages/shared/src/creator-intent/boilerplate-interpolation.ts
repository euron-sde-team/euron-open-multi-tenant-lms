import type { SectionConfig } from "../types";

export interface BoilerplateVars {
  orgName: string;
  ownerName: string;
  contactEmail: string;
  year: string;
}

// Walk every section's content (deeply) and replace {{orgName}}, {{ownerName}},
// {{contactEmail}}, {{year}} placeholders. Used to seed terms / privacy / faq
// / about pages without invoking AI on legal text.
//
// Pure function, does not mutate input.
export function interpolateBoilerplate(
  sections: SectionConfig[],
  vars: BoilerplateVars,
): SectionConfig[] {
  return sections.map((section) => ({
    ...section,
    content: deepInterpolate(section.content, vars) as Record<string, unknown>,
  }));
}

function deepInterpolate(value: unknown, vars: BoilerplateVars): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll("{{orgName}}", vars.orgName)
      .replaceAll("{{ownerName}}", vars.ownerName)
      .replaceAll("{{contactEmail}}", vars.contactEmail)
      .replaceAll("{{year}}", vars.year);
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepInterpolate(item, vars));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepInterpolate(v, vars);
    }
    return out;
  }
  return value;
}
