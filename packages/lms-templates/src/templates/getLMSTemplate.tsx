"use client";

import type { LMSTemplateId } from "../types";
import { ClassicLMS } from "./ClassicLMS";
import { ModernLMS } from "./ModernLMS";
import { MinimalLMS } from "./MinimalLMS";

type LMSTemplateComponent = typeof ClassicLMS | typeof ModernLMS | typeof MinimalLMS;

/**
 * Get the LMS template component by ID
 */
export function getLMSTemplate(templateId: LMSTemplateId): LMSTemplateComponent {
  switch (templateId) {
    case "classic":
      return ClassicLMS;
    case "modern":
      return ModernLMS;
    case "minimal":
      return MinimalLMS;
    default:
      // Default to Classic if unknown template
      console.warn(`Unknown LMS template: ${templateId}, falling back to Classic`);
      return ClassicLMS;
  }
}

/**
 * Check if a template ID is valid
 */
export function isValidLMSTemplateId(id: string): id is LMSTemplateId {
  return ["classic", "modern", "minimal"].includes(id);
}

export default getLMSTemplate;
