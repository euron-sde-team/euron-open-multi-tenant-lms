/**
 * Button Action System: Zod Validation Schemas
 *
 * These schemas validate button action configurations from admin input,
 * API payloads, and stored data. They mirror the types in types/button-actions.ts.
 */

import { z } from "zod";

// ============================================================================
// Action Type Schema
// ============================================================================

export const buttonActionTypeSchema = z.enum([
  "navigate",
  "external_link",
  "enroll_course",
  "add_to_cart",
  "mark_complete",
  "download",
  "open_modal",
  "scroll_to_section",
  "login",
  "signup",
  "contact_form",
  "custom",
]);

// ============================================================================
// Per-Action Parameter Schemas
// ============================================================================

export const navigateActionParamsSchema = z.object({
  path: z.string().min(1, "Page path is required"),
});

export const externalLinkActionParamsSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  newTab: z.boolean().optional().default(true),
});

export const enrollCourseActionParamsSchema = z.object({
  courseId: z.string().optional(),
  useCurrentCourse: z.boolean().optional().default(true),
});

export const addToCartActionParamsSchema = z.object({
  productId: z.string().optional(),
  productType: z.enum(["course", "book", "bundle"]).optional().default("course"),
  useCurrentProduct: z.boolean().optional().default(true),
});

export const markCompleteActionParamsSchema = z.object({
  lessonId: z.string().optional(),
  useCurrentLesson: z.boolean().optional().default(true),
});

export const downloadActionParamsSchema = z.object({
  resourceUrl: z.string().url("Must be a valid URL"),
  filename: z.string().optional(),
});

export const openModalActionParamsSchema = z.object({
  modalId: z.string().min(1, "Modal ID is required"),
  data: z.record(z.unknown()).optional(),
});

export const scrollToSectionActionParamsSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  behavior: z.enum(["smooth", "instant"]).optional().default("smooth"),
  offset: z.number().optional().default(0),
});

export const loginActionParamsSchema = z.object({
  redirectPath: z.string().optional(),
});

export const signupActionParamsSchema = z.object({
  redirectPath: z.string().optional(),
  defaultPlan: z.string().optional(),
});

export const contactFormActionParamsSchema = z.object({
  subject: z.string().optional(),
  display: z.enum(["modal", "inline"]).optional().default("modal"),
});

export const customActionParamsSchema = z.object({
  actionId: z.string().min(1, "Action identifier is required"),
  params: z.record(z.unknown()).optional(),
});

// ============================================================================
// Discriminated Union Schema for ButtonActionConfig
// ============================================================================

export const buttonActionConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), params: navigateActionParamsSchema }),
  z.object({ type: z.literal("external_link"), params: externalLinkActionParamsSchema }),
  z.object({ type: z.literal("enroll_course"), params: enrollCourseActionParamsSchema }),
  z.object({ type: z.literal("add_to_cart"), params: addToCartActionParamsSchema }),
  z.object({ type: z.literal("mark_complete"), params: markCompleteActionParamsSchema }),
  z.object({ type: z.literal("download"), params: downloadActionParamsSchema }),
  z.object({ type: z.literal("open_modal"), params: openModalActionParamsSchema }),
  z.object({ type: z.literal("scroll_to_section"), params: scrollToSectionActionParamsSchema }),
  z.object({ type: z.literal("login"), params: loginActionParamsSchema }),
  z.object({ type: z.literal("signup"), params: signupActionParamsSchema }),
  z.object({ type: z.literal("contact_form"), params: contactFormActionParamsSchema }),
  z.object({ type: z.literal("custom"), params: customActionParamsSchema }),
]);

// ============================================================================
// ActionButton Schema
// ============================================================================

export const actionButtonSchema = z.object({
  id: z.string().min(1, "Button ID is required"),
  text: z.string().min(1, "Button text is required"),
  variant: z.enum(["primary", "secondary", "outline", "ghost"]),
  size: z.enum(["sm", "md", "lg"]).optional(),
  icon: z.string().optional(),
  iconPosition: z.enum(["left", "right"]).optional(),
  action: buttonActionConfigSchema,
  loadingText: z.string().optional(),
  disabled: z.boolean().optional(),
  visible: z.boolean().optional(),
});

// ============================================================================
// Backward-Compatible CTA Button Schema (accepts both old href and new action)
// ============================================================================

export const compatibleCtaButtonSchema = z.object({
  text: z.string().min(1, "Button text is required"),
  href: z.string().optional(), // Legacy field
  variant: z.enum(["primary", "secondary", "outline", "ghost"]),
  action: buttonActionConfigSchema.optional(), // New action field
});
