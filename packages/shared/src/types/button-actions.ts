/**
 * Button Action System Types
 *
 * Centralized type definitions for the unified button action system.
 * Every button across all templates (pages, LMS, courses, books) uses
 * these types to guarantee consistent behavior.
 */

// ============================================================================
// Action Type Enum
// ============================================================================

/** All possible button action types across the platform */
export type ButtonActionType =
  | "navigate" // Internal page navigation
  | "external_link" // Open URL in new tab
  | "enroll_course" // Enroll user in a course
  | "add_to_cart" // Add product to cart / initiate purchase
  | "mark_complete" // Mark a lesson as complete
  | "download" // Download a resource file
  | "open_modal" // Open a modal / dialog
  | "scroll_to_section" // Smooth-scroll to a page section
  | "login" // Redirect to login
  | "signup" // Redirect to signup
  | "contact_form" // Open contact form
  | "custom"; // Extensible custom action

// ============================================================================
// Action Parameter Types (per action)
// ============================================================================

export interface NavigateActionParams {
  /** Internal path (e.g. "/all-courses", "/about") or page slug */
  path: string;
}

export interface ExternalLinkActionParams {
  /** Full URL including protocol */
  url: string;
  /** Whether to open in a new tab (default: true) */
  newTab?: boolean;
}

export interface EnrollCourseActionParams {
  /** Specific course ID to enroll in */
  courseId?: string;
  /** If true, uses the course from current page context */
  useCurrentCourse?: boolean;
}

export interface AddToCartActionParams {
  /** Product/course/book ID */
  productId?: string;
  /** Product type */
  productType?: "course" | "book" | "bundle";
  /** If true, uses the product from current page context */
  useCurrentProduct?: boolean;
}

export interface MarkCompleteActionParams {
  /** Specific lesson ID to mark complete */
  lessonId?: string;
  /** If true, uses the lesson from current LMS context */
  useCurrentLesson?: boolean;
}

export interface DownloadActionParams {
  /** URL of the resource to download */
  resourceUrl: string;
  /** Filename to use for the download */
  filename?: string;
}

export interface OpenModalActionParams {
  /** Modal identifier (e.g. "preview_video", "enroll_confirm", "share") */
  modalId: string;
  /** Arbitrary data to pass to the modal */
  data?: Record<string, unknown>;
}

export interface ScrollToSectionActionParams {
  /** DOM ID of the section to scroll to */
  sectionId: string;
  /** Scroll behavior */
  behavior?: "smooth" | "instant";
  /** Offset from top in pixels */
  offset?: number;
}

export interface LoginActionParams {
  /** Path to redirect after successful login */
  redirectPath?: string;
}

export interface SignupActionParams {
  /** Path to redirect after successful signup */
  redirectPath?: string;
  /** Pre-select a plan */
  defaultPlan?: string;
}

export interface ContactFormActionParams {
  /** Pre-filled subject line */
  subject?: string;
  /** How to display the form */
  display?: "modal" | "inline";
}

export interface CustomActionParams {
  /** Unique identifier for the custom action handler */
  actionId: string;
  /** Arbitrary parameters for the handler */
  params?: Record<string, unknown>;
}

// ============================================================================
// Action Parameter Map (type-safe mapping)
// ============================================================================

/** Maps each action type to its parameter interface */
export interface ButtonActionParamsMap {
  navigate: NavigateActionParams;
  external_link: ExternalLinkActionParams;
  enroll_course: EnrollCourseActionParams;
  add_to_cart: AddToCartActionParams;
  mark_complete: MarkCompleteActionParams;
  download: DownloadActionParams;
  open_modal: OpenModalActionParams;
  scroll_to_section: ScrollToSectionActionParams;
  login: LoginActionParams;
  signup: SignupActionParams;
  contact_form: ContactFormActionParams;
  custom: CustomActionParams;
}

// ============================================================================
// Button Action Config (discriminated union)
// ============================================================================

/** Type-safe action configuration, each action has its own params shape */
export type ButtonActionConfig =
  | { type: "navigate"; params: NavigateActionParams }
  | { type: "external_link"; params: ExternalLinkActionParams }
  | { type: "enroll_course"; params: EnrollCourseActionParams }
  | { type: "add_to_cart"; params: AddToCartActionParams }
  | { type: "mark_complete"; params: MarkCompleteActionParams }
  | { type: "download"; params: DownloadActionParams }
  | { type: "open_modal"; params: OpenModalActionParams }
  | { type: "scroll_to_section"; params: ScrollToSectionActionParams }
  | { type: "login"; params: LoginActionParams }
  | { type: "signup"; params: SignupActionParams }
  | { type: "contact_form"; params: ContactFormActionParams }
  | { type: "custom"; params: CustomActionParams };

// ============================================================================
// ActionButton: The unified button type (replaces CTAButton usage)
// ============================================================================

export interface ActionButton {
  /** Unique identifier */
  id: string;
  /** Display text shown on the button */
  text: string;
  /** Visual variant */
  variant: "primary" | "secondary" | "outline" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Lucide icon name (optional) */
  icon?: string;
  /** Icon position relative to text */
  iconPosition?: "left" | "right";
  /** The action this button performs */
  action: ButtonActionConfig;
  /** Text shown while action is loading */
  loadingText?: string;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether button is visible */
  visible?: boolean;
}

// ============================================================================
// Action Handler Types (for the React context)
// ============================================================================

/** Result returned by every action handler */
export interface ButtonActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Optional message (for toast/feedback) */
  message?: string;
  /** Optional data returned by the action */
  data?: unknown;
  /** Error if action failed */
  error?: string;
}

/** Generic handler signature for a single action */
export type ButtonActionHandler<T extends ButtonActionType = ButtonActionType> =
  (params: ButtonActionParamsMap[T]) => Promise<ButtonActionResult>;

/** Map of all action handlers, provided via React context */
export type ButtonActionHandlerMap = {
  [K in ButtonActionType]?: ButtonActionHandler<K>;
};

// ============================================================================
// Action Metadata (for admin UI)
// ============================================================================

/** Metadata describing a parameter field for the admin editor */
export interface ActionParamFieldMeta {
  /** Field key name */
  key: string;
  /** Display label */
  label: string;
  /** Field input type */
  type: "text" | "url" | "select" | "boolean" | "number" | "json";
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Options for select type */
  options?: { label: string; value: string }[];
  /** Help text */
  helpText?: string;
}

/** Metadata for an action type, used in admin UI to render the editor */
export interface ButtonActionMeta {
  /** Action type */
  type: ButtonActionType;
  /** Human-readable label */
  label: string;
  /** Description of what this action does */
  description: string;
  /** Lucide icon name for the action */
  icon: string;
  /** Category for grouping in the admin dropdown */
  category: "navigation" | "commerce" | "learning" | "engagement" | "auth" | "advanced";
  /** Parameter fields the admin needs to configure */
  fields: ActionParamFieldMeta[];
}

// ============================================================================
// Section Default Actions (predefined per section type)
// ============================================================================

/** Predefined button slot for a section type */
export interface SectionButtonSlot {
  /** Slot key (e.g. "primaryCta", "secondaryCta", "enrollCta") */
  slotKey: string;
  /** Display label in admin (e.g. "Primary Button") */
  label: string;
  /** Default action for this slot */
  defaultAction: ButtonActionConfig;
  /** Default button text */
  defaultText: string;
  /** Default variant */
  defaultVariant: ActionButton["variant"];
  /** Whether admin can change the action type */
  allowCustomAction: boolean;
  /** Allowed action types (if restricted) */
  allowedActionTypes?: ButtonActionType[];
}
