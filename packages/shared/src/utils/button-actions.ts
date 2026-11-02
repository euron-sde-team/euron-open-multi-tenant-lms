/**
 * Button Action System: Utility Functions
 *
 * Helpers for converting between old CTAButton and new ActionButton formats,
 * creating default action buttons, and building action configs.
 */

import type { CTAButton } from "../types/section";
import type {
  ActionButton,
  ButtonActionConfig,
  ButtonActionType,
} from "../types/button-actions";

// ============================================================================
// CTAButton <-> ActionButton Converters
// ============================================================================

/**
 * Convert a legacy CTAButton to the new ActionButton format.
 * The `href` field is converted into a `navigate` or `external_link` action.
 */
export function ctaButtonToActionButton(
  cta: CTAButton,
  id?: string
): ActionButton {
  const isExternal = cta.href.startsWith("http://") || cta.href.startsWith("https://");

  const action: ButtonActionConfig = isExternal
    ? { type: "external_link", params: { url: cta.href, newTab: true } }
    : { type: "navigate", params: { path: cta.href } };

  return {
    id: id ?? `btn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: cta.text,
    variant: cta.variant,
    action,
  };
}

/**
 * Convert a new ActionButton back to a legacy CTAButton.
 * Only navigate and external_link actions can produce a meaningful href.
 * Other actions fall back to "#".
 */
export function actionButtonToCtaButton(button: ActionButton): CTAButton {
  let href = "#";

  if (button.action.type === "navigate") {
    href = button.action.params.path;
  } else if (button.action.type === "external_link") {
    href = button.action.params.url;
  } else if (button.action.type === "scroll_to_section") {
    href = `#${button.action.params.sectionId}`;
  }

  return {
    text: button.text,
    href,
    variant: button.variant,
  };
}

// ============================================================================
// ActionButton Factory
// ============================================================================

/** Generate a unique button ID */
export function generateButtonId(): string {
  return `btn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a new ActionButton with sensible defaults */
export function createActionButton(
  text: string,
  actionConfig: ButtonActionConfig,
  options?: Partial<Omit<ActionButton, "id" | "text" | "action">>
): ActionButton {
  return {
    id: generateButtonId(),
    text,
    variant: "primary",
    ...options,
    action: actionConfig,
  };
}

// ============================================================================
// Quick Action Config Builders
// ============================================================================

export function navigateAction(path: string): ButtonActionConfig {
  return { type: "navigate", params: { path } };
}

export function externalLinkAction(url: string, newTab = true): ButtonActionConfig {
  return { type: "external_link", params: { url, newTab } };
}

export function enrollCourseAction(courseId?: string): ButtonActionConfig {
  return {
    type: "enroll_course",
    params: courseId ? { courseId } : { useCurrentCourse: true },
  };
}

export function addToCartAction(
  productType: "course" | "book" | "bundle" = "course",
  productId?: string
): ButtonActionConfig {
  return {
    type: "add_to_cart",
    params: productId
      ? { productId, productType }
      : { useCurrentProduct: true, productType },
  };
}

export function markCompleteAction(lessonId?: string): ButtonActionConfig {
  return {
    type: "mark_complete",
    params: lessonId ? { lessonId } : { useCurrentLesson: true },
  };
}

export function downloadAction(resourceUrl: string, filename?: string): ButtonActionConfig {
  return { type: "download", params: { resourceUrl, filename } };
}

export function openModalAction(
  modalId: string,
  data?: Record<string, unknown>
): ButtonActionConfig {
  return { type: "open_modal", params: { modalId, data } };
}

export function scrollToSectionAction(
  sectionId: string,
  behavior: "smooth" | "instant" = "smooth"
): ButtonActionConfig {
  return { type: "scroll_to_section", params: { sectionId, behavior } };
}

export function loginAction(redirectPath?: string): ButtonActionConfig {
  return { type: "login", params: { redirectPath } };
}

export function signupAction(redirectPath?: string, defaultPlan?: string): ButtonActionConfig {
  return { type: "signup", params: { redirectPath, defaultPlan } };
}

export function contactFormAction(
  display: "modal" | "inline" = "modal",
  subject?: string
): ButtonActionConfig {
  return { type: "contact_form", params: { display, subject } };
}

export function customAction(
  actionId: string,
  params?: Record<string, unknown>
): ButtonActionConfig {
  return { type: "custom", params: { actionId, params } };
}

// ============================================================================
// Helpers
// ============================================================================

/** Check if a CTAButton has been upgraded to use the new action system */
export function hasActionConfig(
  button: CTAButton & { action?: ButtonActionConfig }
): button is CTAButton & { action: ButtonActionConfig } {
  return button.action !== undefined && button.action !== null;
}

/** Get the human-readable label for an action type */
export function getActionTypeLabel(type: ButtonActionType): string {
  const labels: Record<ButtonActionType, string> = {
    navigate: "Navigate to Page",
    external_link: "External Link",
    enroll_course: "Enroll in Course",
    add_to_cart: "Add to Cart",
    mark_complete: "Mark Complete",
    download: "Download Resource",
    open_modal: "Open Modal",
    scroll_to_section: "Scroll to Section",
    login: "Go to Login",
    signup: "Go to Signup",
    contact_form: "Open Contact Form",
    custom: "Custom Action",
  };
  return labels[type];
}

/** Get the default empty params for an action type */
export function getDefaultActionParams(type: ButtonActionType): ButtonActionConfig {
  const defaults: Record<ButtonActionType, ButtonActionConfig> = {
    navigate: { type: "navigate", params: { path: "/" } },
    external_link: { type: "external_link", params: { url: "", newTab: true } },
    enroll_course: { type: "enroll_course", params: { useCurrentCourse: true } },
    add_to_cart: { type: "add_to_cart", params: { useCurrentProduct: true, productType: "course" } },
    mark_complete: { type: "mark_complete", params: { useCurrentLesson: true } },
    download: { type: "download", params: { resourceUrl: "" } },
    open_modal: { type: "open_modal", params: { modalId: "" } },
    scroll_to_section: { type: "scroll_to_section", params: { sectionId: "", behavior: "smooth" } },
    login: { type: "login", params: {} },
    signup: { type: "signup", params: {} },
    contact_form: { type: "contact_form", params: { display: "modal" } },
    custom: { type: "custom", params: { actionId: "" } },
  };
  return defaults[type];
}
