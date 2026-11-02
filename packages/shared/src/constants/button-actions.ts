/**
 * Button Action System Constants
 *
 * Centralized metadata, labels, icons, and default configurations
 * for every button action type in the platform.
 */

import type {
  ButtonActionMeta,
  ButtonActionType,
  SectionButtonSlot,
} from "../types/button-actions";

// ============================================================================
// All action types (iterable list)
// ============================================================================

export const BUTTON_ACTION_TYPES: ButtonActionType[] = [
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
];

// ============================================================================
// Action Metadata Registry
// ============================================================================

export const BUTTON_ACTION_META: Record<ButtonActionType, ButtonActionMeta> = {
  navigate: {
    type: "navigate",
    label: "Navigate to Page",
    description: "Navigate to an internal page within the site",
    icon: "ArrowRight",
    category: "navigation",
    fields: [
      {
        key: "path",
        label: "Page Path",
        type: "text",
        placeholder: "/all-courses or /about",
        required: true,
        helpText: "Internal path or page slug (e.g. /all-courses, /pricing)",
      },
    ],
  },

  external_link: {
    type: "external_link",
    label: "External Link",
    description: "Open an external URL (opens in new tab by default)",
    icon: "ExternalLink",
    category: "navigation",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "url",
        placeholder: "https://example.com",
        required: true,
        helpText: "Full URL including https://",
      },
      {
        key: "newTab",
        label: "Open in New Tab",
        type: "boolean",
        defaultValue: true,
      },
    ],
  },

  enroll_course: {
    type: "enroll_course",
    label: "Enroll in Course",
    description: "Trigger course enrollment for the user",
    icon: "GraduationCap",
    category: "commerce",
    fields: [
      {
        key: "courseId",
        label: "Course ID",
        type: "text",
        placeholder: "Leave empty to use current course",
        helpText: "Specific course ID. Leave empty to use the current course context.",
      },
      {
        key: "useCurrentCourse",
        label: "Use Current Course",
        type: "boolean",
        defaultValue: true,
        helpText: "Automatically use the course from the current page context",
      },
    ],
  },

  add_to_cart: {
    type: "add_to_cart",
    label: "Add to Cart",
    description: "Add a product (course, book, or bundle) to the shopping cart",
    icon: "ShoppingCart",
    category: "commerce",
    fields: [
      {
        key: "productId",
        label: "Product ID",
        type: "text",
        placeholder: "Leave empty to use current product",
      },
      {
        key: "productType",
        label: "Product Type",
        type: "select",
        options: [
          { label: "Course", value: "course" },
          { label: "Book", value: "book" },
          { label: "Bundle", value: "bundle" },
        ],
        defaultValue: "course",
      },
      {
        key: "useCurrentProduct",
        label: "Use Current Product",
        type: "boolean",
        defaultValue: true,
        helpText: "Automatically use the product from the current page context",
      },
    ],
  },

  mark_complete: {
    type: "mark_complete",
    label: "Mark Complete",
    description: "Mark a lesson as completed in the LMS",
    icon: "CheckCircle",
    category: "learning",
    fields: [
      {
        key: "lessonId",
        label: "Lesson ID",
        type: "text",
        placeholder: "Leave empty to use current lesson",
      },
      {
        key: "useCurrentLesson",
        label: "Use Current Lesson",
        type: "boolean",
        defaultValue: true,
        helpText: "Automatically use the lesson from the current LMS context",
      },
    ],
  },

  download: {
    type: "download",
    label: "Download Resource",
    description: "Download a file or resource",
    icon: "Download",
    category: "engagement",
    fields: [
      {
        key: "resourceUrl",
        label: "Resource URL",
        type: "url",
        placeholder: "https://example.com/file.pdf",
        required: true,
      },
      {
        key: "filename",
        label: "Download Filename",
        type: "text",
        placeholder: "resource.pdf",
        helpText: "Optional custom filename for the download",
      },
    ],
  },

  open_modal: {
    type: "open_modal",
    label: "Open Modal",
    description: "Open a modal dialog (e.g. video preview, confirmation)",
    icon: "Maximize2",
    category: "engagement",
    fields: [
      {
        key: "modalId",
        label: "Modal ID",
        type: "select",
        required: true,
        options: [
          { label: "Video Preview", value: "preview_video" },
          { label: "Enrollment Confirm", value: "enroll_confirm" },
          { label: "Share", value: "share" },
          { label: "Image Gallery", value: "image_gallery" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },

  scroll_to_section: {
    type: "scroll_to_section",
    label: "Scroll to Section",
    description: "Smooth-scroll to a section on the current page",
    icon: "ChevronsDown",
    category: "navigation",
    fields: [
      {
        key: "sectionId",
        label: "Section ID",
        type: "text",
        placeholder: "pricing or features",
        required: true,
        helpText: "The DOM id of the target section",
      },
      {
        key: "behavior",
        label: "Scroll Behavior",
        type: "select",
        options: [
          { label: "Smooth", value: "smooth" },
          { label: "Instant", value: "instant" },
        ],
        defaultValue: "smooth",
      },
      {
        key: "offset",
        label: "Offset (px)",
        type: "number",
        defaultValue: 0,
        helpText: "Offset from the top of the section in pixels",
      },
    ],
  },

  login: {
    type: "login",
    label: "Go to Login",
    description: "Navigate to the login page",
    icon: "LogIn",
    category: "auth",
    fields: [
      {
        key: "redirectPath",
        label: "Redirect After Login",
        type: "text",
        placeholder: "/dashboard",
        helpText: "Where to redirect the user after successful login",
      },
    ],
  },

  signup: {
    type: "signup",
    label: "Go to Signup",
    description: "Navigate to the signup / registration page",
    icon: "UserPlus",
    category: "auth",
    fields: [
      {
        key: "redirectPath",
        label: "Redirect After Signup",
        type: "text",
        placeholder: "/dashboard",
      },
      {
        key: "defaultPlan",
        label: "Default Plan",
        type: "text",
        placeholder: "pro",
        helpText: "Pre-select a pricing plan on the signup page",
      },
    ],
  },

  contact_form: {
    type: "contact_form",
    label: "Open Contact Form",
    description: "Open a contact form (as modal or inline)",
    icon: "Mail",
    category: "engagement",
    fields: [
      {
        key: "subject",
        label: "Pre-filled Subject",
        type: "text",
        placeholder: "I have a question about...",
      },
      {
        key: "display",
        label: "Display Mode",
        type: "select",
        options: [
          { label: "Modal", value: "modal" },
          { label: "Inline", value: "inline" },
        ],
        defaultValue: "modal",
      },
    ],
  },

  custom: {
    type: "custom",
    label: "Custom Action",
    description: "Trigger a custom action (for advanced/extensible use)",
    icon: "Zap",
    category: "advanced",
    fields: [
      {
        key: "actionId",
        label: "Action Identifier",
        type: "text",
        placeholder: "my_custom_action",
        required: true,
        helpText: "Unique identifier that maps to a registered custom handler",
      },
      {
        key: "params",
        label: "Parameters (JSON)",
        type: "json",
        placeholder: '{ "key": "value" }',
        helpText: "Arbitrary JSON parameters passed to the custom handler",
      },
    ],
  },
};

// ============================================================================
// Action Category Labels
// ============================================================================

export const ACTION_CATEGORY_LABELS: Record<
  ButtonActionMeta["category"],
  string
> = {
  navigation: "Navigation",
  commerce: "Commerce",
  learning: "Learning",
  engagement: "Engagement",
  auth: "Authentication",
  advanced: "Advanced",
};

export const ACTION_CATEGORY_ICONS: Record<
  ButtonActionMeta["category"],
  string
> = {
  navigation: "Navigation",
  commerce: "ShoppingBag",
  learning: "BookOpen",
  engagement: "MessageCircle",
  auth: "Shield",
  advanced: "Settings",
};

// ============================================================================
// Section Default Button Slots
// ============================================================================

/**
 * Predefined button configurations per section type.
 * Admin sees these as defaults and can optionally customize them.
 */
export const SECTION_BUTTON_SLOTS: Record<string, SectionButtonSlot[]> = {
  // ─── Hero Sections ───
  hero: [
    {
      slotKey: "primaryCta",
      label: "Primary Button",
      defaultAction: { type: "navigate", params: { path: "/all-courses" } },
      defaultText: "Get Started",
      defaultVariant: "primary",
      allowCustomAction: true,
    },
    {
      slotKey: "secondaryCta",
      label: "Secondary Button",
      defaultAction: { type: "scroll_to_section", params: { sectionId: "features", behavior: "smooth" } },
      defaultText: "Learn More",
      defaultVariant: "outline",
      allowCustomAction: true,
    },
  ],

  // ─── CTA Sections ───
  "cta-banner": [
    {
      slotKey: "primaryCta",
      label: "Primary Button",
      defaultAction: { type: "signup", params: {} },
      defaultText: "Get Started Today",
      defaultVariant: "primary",
      allowCustomAction: true,
    },
    {
      slotKey: "secondaryCta",
      label: "Secondary Button",
      defaultAction: { type: "contact_form", params: { display: "modal" } },
      defaultText: "Contact Us",
      defaultVariant: "outline",
      allowCustomAction: true,
    },
  ],
  "cta-split": [
    {
      slotKey: "primaryCta",
      label: "Primary Button",
      defaultAction: { type: "signup", params: {} },
      defaultText: "Start Free Trial",
      defaultVariant: "primary",
      allowCustomAction: true,
    },
    {
      slotKey: "secondaryCta",
      label: "Secondary Button",
      defaultAction: { type: "navigate", params: { path: "/pricing" } },
      defaultText: "See Plans",
      defaultVariant: "secondary",
      allowCustomAction: true,
    },
  ],

  // ─── Pricing Section ───
  "pricing-table": [
    {
      slotKey: "cta",
      label: "Tier CTA Button",
      defaultAction: { type: "signup", params: {} },
      defaultText: "Choose Plan",
      defaultVariant: "primary",
      allowCustomAction: true,
      allowedActionTypes: ["signup", "navigate", "external_link", "add_to_cart", "custom"],
    },
  ],

  // ─── Header Section ───
  header: [
    {
      slotKey: "cta",
      label: "Header CTA Button",
      defaultAction: { type: "login", params: {} },
      defaultText: "Sign In",
      defaultVariant: "primary",
      allowCustomAction: true,
      allowedActionTypes: ["login", "signup", "navigate", "external_link"],
    },
  ],

  // ─── Course Page Sections ───
  "course-hero": [
    {
      slotKey: "enrollCta",
      label: "Enroll Button",
      defaultAction: { type: "enroll_course", params: { useCurrentCourse: true } },
      defaultText: "Enroll Now",
      defaultVariant: "primary",
      allowCustomAction: false,
      allowedActionTypes: ["enroll_course", "add_to_cart"],
    },
  ],

  // ─── Contact Form Section ───
  "contact-form": [
    {
      slotKey: "submitButton",
      label: "Submit Button",
      defaultAction: { type: "contact_form", params: { display: "inline" } },
      defaultText: "Send Message",
      defaultVariant: "primary",
      allowCustomAction: false,
    },
  ],

  // ─── LMS Buttons (used by LMS templates) ───
  "lms-mark-complete": [
    {
      slotKey: "markComplete",
      label: "Mark Complete",
      defaultAction: { type: "mark_complete", params: { useCurrentLesson: true } },
      defaultText: "Mark as Complete",
      defaultVariant: "primary",
      allowCustomAction: false,
      allowedActionTypes: ["mark_complete"],
    },
  ],
  "lms-navigation": [
    {
      slotKey: "previousLesson",
      label: "Previous Lesson",
      defaultAction: { type: "navigate", params: { path: "" } },
      defaultText: "Previous",
      defaultVariant: "outline",
      allowCustomAction: false,
      allowedActionTypes: ["navigate"],
    },
    {
      slotKey: "nextLesson",
      label: "Next Lesson",
      defaultAction: { type: "navigate", params: { path: "" } },
      defaultText: "Next",
      defaultVariant: "primary",
      allowCustomAction: false,
      allowedActionTypes: ["navigate"],
    },
  ],
  "lms-download": [
    {
      slotKey: "download",
      label: "Download Resource",
      defaultAction: { type: "download", params: { resourceUrl: "" } },
      defaultText: "Download",
      defaultVariant: "outline",
      allowCustomAction: false,
      allowedActionTypes: ["download"],
    },
  ],
};
