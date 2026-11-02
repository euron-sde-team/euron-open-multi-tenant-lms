export const addon_subscription_status = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type addon_subscription_status =
  (typeof addon_subscription_status)[keyof typeof addon_subscription_status];
export const admin_user_status = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
} as const;
export type admin_user_status = (typeof admin_user_status)[keyof typeof admin_user_status];
export const assignment_content_type = {
  TEXT: "TEXT",
  PDF: "PDF",
} as const;
export type assignment_content_type =
  (typeof assignment_content_type)[keyof typeof assignment_content_type];
export const assignment_scope = {
  COURSE: "COURSE",
  SECTION: "SECTION",
  LESSON: "LESSON",
} as const;
export type assignment_scope = (typeof assignment_scope)[keyof typeof assignment_scope];
export const assignment_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;
export type assignment_status = (typeof assignment_status)[keyof typeof assignment_status];
export const batch_item_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
} as const;
export type batch_item_type = (typeof batch_item_type)[keyof typeof batch_item_type];
export const batch_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type batch_status = (typeof batch_status)[keyof typeof batch_status];
export const billing_cycle = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
  TWO_YEARLY: "TWO_YEARLY",
} as const;
export type billing_cycle = (typeof billing_cycle)[keyof typeof billing_cycle];
export const book_conversion_status = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type book_conversion_status =
  (typeof book_conversion_status)[keyof typeof book_conversion_status];
export const book_file_format = {
  EPUB: "EPUB",
  PDF: "PDF",
} as const;
export type book_file_format = (typeof book_file_format)[keyof typeof book_file_format];
export const book_source_type = {
  PDF: "PDF",
} as const;
export type book_source_type = (typeof book_source_type)[keyof typeof book_source_type];
export const book_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type book_status = (typeof book_status)[keyof typeof book_status];
export const bookmark_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
} as const;
export type bookmark_type = (typeof bookmark_type)[keyof typeof bookmark_type];
export const bundle_item_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BATCH: "BATCH",
  TEST_SERIES: "TEST_SERIES",
} as const;
export type bundle_item_type = (typeof bundle_item_type)[keyof typeof bundle_item_type];
export const bundle_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type bundle_status = (typeof bundle_status)[keyof typeof bundle_status];
export const cart_item_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
  BATCH: "BATCH",
} as const;
export type cart_item_type = (typeof cart_item_type)[keyof typeof cart_item_type];
export const certificate_status = {
  ISSUED: "ISSUED",
  REVOKED: "REVOKED",
} as const;
export type certificate_status = (typeof certificate_status)[keyof typeof certificate_status];
export const constraint_type = {
  BOOLEAN: "BOOLEAN",
  COUNT: "COUNT",
  LIMIT: "LIMIT",
} as const;
export type constraint_type = (typeof constraint_type)[keyof typeof constraint_type];
export const content_discount_type = {
  PERCENTAGE: "PERCENTAGE",
  FLAT: "FLAT",
} as const;
export type content_discount_type =
  (typeof content_discount_type)[keyof typeof content_discount_type];
export const coupon_discount_type = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
} as const;
export type coupon_discount_type = (typeof coupon_discount_type)[keyof typeof coupon_discount_type];
export const course_difficulty = {
  BEGINNER: "BEGINNER",
  INTERMEDIATE: "INTERMEDIATE",
  ADVANCED: "ADVANCED",
  NONE: "NONE",
} as const;
export type course_difficulty = (typeof course_difficulty)[keyof typeof course_difficulty];
export const course_mode = {
  SELF_PACED: "SELF_PACED",
} as const;
export type course_mode = (typeof course_mode)[keyof typeof course_mode];
export const course_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  SUSPENDED: "SUSPENDED",
} as const;
export type course_status = (typeof course_status)[keyof typeof course_status];
export const course_type = {
  NORMAL: "NORMAL",
  PROJECT: "PROJECT",
} as const;
export type course_type = (typeof course_type)[keyof typeof course_type];
export const custom_code_kind = {
  SANITIZED_INLINE: "SANITIZED_INLINE",
  SANDBOXED_IFRAME: "SANDBOXED_IFRAME",
} as const;
export type custom_code_kind = (typeof custom_code_kind)[keyof typeof custom_code_kind];
export const discount_type = {
  NONE: "NONE",
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
} as const;
export type discount_type = (typeof discount_type)[keyof typeof discount_type];
export const domain_status = {
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  PENDING_SSL: "PENDING_SSL",
  ACTIVE: "ACTIVE",
  FAILED: "FAILED",
  REMOVING: "REMOVING",
  REDIRECT: "REDIRECT",
} as const;
export type domain_status = (typeof domain_status)[keyof typeof domain_status];
export const domain_type = {
  SUBDOMAIN: "SUBDOMAIN",
  CUSTOM: "CUSTOM",
} as const;
export type domain_type = (typeof domain_type)[keyof typeof domain_type];
export const email_message_category = {
  TRANSACTIONAL: "TRANSACTIONAL",
  NOTIFICATION: "NOTIFICATION",
  MARKETING: "MARKETING",
} as const;
export type email_message_category =
  (typeof email_message_category)[keyof typeof email_message_category];
export const email_message_status = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  BOUNCED: "BOUNCED",
  COMPLAINED: "COMPLAINED",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
  SUPPRESSED: "SUPPRESSED",
  FROZEN: "FROZEN",
} as const;
export type email_message_status = (typeof email_message_status)[keyof typeof email_message_status];
export const email_reputation_event_trigger = {
  AUTO_BOUNCE: "AUTO_BOUNCE",
  AUTO_COMPLAINT: "AUTO_COMPLAINT",
  AUTO_RECOVERY: "AUTO_RECOVERY",
  ADMIN_OVERRIDE: "ADMIN_OVERRIDE",
  EMERGENCY_BRAKE: "EMERGENCY_BRAKE",
} as const;
export type email_reputation_event_trigger =
  (typeof email_reputation_event_trigger)[keyof typeof email_reputation_event_trigger];
export const email_sender_identity_status = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type email_sender_identity_status =
  (typeof email_sender_identity_status)[keyof typeof email_sender_identity_status];
export const email_sending_domain_status = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
  DISABLED: "DISABLED",
} as const;
export type email_sending_domain_status =
  (typeof email_sending_domain_status)[keyof typeof email_sending_domain_status];
export const email_sending_tenant_status = {
  ACTIVE: "ACTIVE",
  WARNING: "WARNING",
  THROTTLED: "THROTTLED",
  PAUSED: "PAUSED",
} as const;
export type email_sending_tenant_status =
  (typeof email_sending_tenant_status)[keyof typeof email_sending_tenant_status];
export const email_suppression_reason = {
  HARD_BOUNCE: "HARD_BOUNCE",
  COMPLAINT: "COMPLAINT",
  MANUAL_UNSUBSCRIBE: "MANUAL_UNSUBSCRIBE",
  ADMIN_BLOCK: "ADMIN_BLOCK",
  IMPORTED: "IMPORTED",
} as const;
export type email_suppression_reason =
  (typeof email_suppression_reason)[keyof typeof email_suppression_reason];
export const enrollment_source = {
  PURCHASED: "PURCHASED",
  FREE: "FREE",
  ADMIN_GRANT: "ADMIN_GRANT",
  BUNDLE: "BUNDLE",
  COUPON: "COUPON",
  SUBSCRIPTION: "SUBSCRIPTION",
  BATCH: "BATCH",
} as const;
export type enrollment_source = (typeof enrollment_source)[keyof typeof enrollment_source];
export const enrollment_status = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  SUSPENDED: "SUSPENDED",
} as const;
export type enrollment_status = (typeof enrollment_status)[keyof typeof enrollment_status];
export const entitlement_sources = {
  PLAN: "PLAN",
  ADMIN: "ADMIN",
  ADDON: "ADDON",
  PROMO: "PROMO",
} as const;
export type entitlement_sources = (typeof entitlement_sources)[keyof typeof entitlement_sources];
export const gateway_connection_status = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISCONNECTED: "DISCONNECTED",
} as const;
export type gateway_connection_status =
  (typeof gateway_connection_status)[keyof typeof gateway_connection_status];
export const gateway_mode = {
  SELF_MANAGED: "SELF_MANAGED",
} as const;
export type gateway_mode = (typeof gateway_mode)[keyof typeof gateway_mode];
export const invoice_status = {
  GENERATED: "GENERATED",
  VOIDED: "VOIDED",
} as const;
export type invoice_status = (typeof invoice_status)[keyof typeof invoice_status];
export const invoice_type = {
  PLAN_SUBSCRIPTION: "PLAN_SUBSCRIPTION",
  USER_PURCHASE: "USER_PURCHASE",
} as const;
export type invoice_type = (typeof invoice_type)[keyof typeof invoice_type];
export const lesson_resource_type = {
  PDF: "PDF",
  PPT: "PPT",
  LINK: "LINK",
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  GITHUB: "GITHUB",
} as const;
export type lesson_resource_type = (typeof lesson_resource_type)[keyof typeof lesson_resource_type];
export const lesson_type = {
  LECTURE: "LECTURE",
  QUIZ: "QUIZ",
  ASSIGNMENT: "ASSIGNMENT",
  PDF: "PDF",
  PPT: "PPT",
  LINK: "LINK",
  TEXT: "TEXT",
  IMAGE: "IMAGE",
} as const;
export type lesson_type = (typeof lesson_type)[keyof typeof lesson_type];
export const linkable_content_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
  PRODUCT_HUB_ITEM: "PRODUCT_HUB_ITEM",
  TEST_SERIES: "TEST_SERIES",
  BATCH: "BATCH",
} as const;
export type linkable_content_type =
  (typeof linkable_content_type)[keyof typeof linkable_content_type];
export const member_notification_type = {
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_REMINDER: "BOOKING_REMINDER",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_RESCHEDULED: "BOOKING_RESCHEDULED",
  PURCHASE_CONFIRMED: "PURCHASE_CONFIRMED",
  DM_REPLIED: "DM_REPLIED",
  ENROLLMENT_NEW: "ENROLLMENT_NEW",
  LESSON_PUBLISHED: "LESSON_PUBLISHED",
  ASSIGNMENT_GRADED: "ASSIGNMENT_GRADED",
  CERTIFICATE_AVAILABLE: "CERTIFICATE_AVAILABLE",
  SYSTEM: "SYSTEM",
  WORKSHOP_NEW_SESSION: "WORKSHOP_NEW_SESSION",
  DM_NEW_MESSAGE: "DM_NEW_MESSAGE",
  DM_THREAD_CLOSED: "DM_THREAD_CLOSED",
  CAMPAIGN: "CAMPAIGN",
} as const;
export type member_notification_type =
  (typeof member_notification_type)[keyof typeof member_notification_type];
export const member_payment_detail_type = {
  UPI: "UPI",
  BANK_TRANSFER: "BANK_TRANSFER",
  PAYPAL: "PAYPAL",
} as const;
export type member_payment_detail_type =
  (typeof member_payment_detail_type)[keyof typeof member_payment_detail_type];
export const member_status = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
} as const;
export type member_status = (typeof member_status)[keyof typeof member_status];
export const offering_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  TEST_SERIES: "TEST_SERIES",
} as const;
export type offering_type = (typeof offering_type)[keyof typeof offering_type];
export const order_status = {
  CREATED: "CREATED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
} as const;
export type order_status = (typeof order_status)[keyof typeof order_status];
export const order_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
  CART: "CART",
  BATCH: "BATCH",
  TEST_SERIES: "TEST_SERIES",
} as const;
export type order_type = (typeof order_type)[keyof typeof order_type];
export const orientation = {
  landscape: "landscape",
  portrait: "portrait",
  square: "square",
} as const;
export type orientation = (typeof orientation)[keyof typeof orientation];
export const page_moderation_status = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
} as const;
export type page_moderation_status =
  (typeof page_moderation_status)[keyof typeof page_moderation_status];
export const page_render_mode = {
  SECTIONS: "SECTIONS",
  CUSTOM_CODE: "CUSTOM_CODE",
} as const;
export type page_render_mode = (typeof page_render_mode)[keyof typeof page_render_mode];
export const payment_receipt_status = {
  DRAFT: "DRAFT",
  GENERATED: "GENERATED",
  SENT: "SENT",
  CANCELLED: "CANCELLED",
} as const;
export type payment_receipt_status =
  (typeof payment_receipt_status)[keyof typeof payment_receipt_status];
export const payment_webhook_status = {
  PENDING: "PENDING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;
export type payment_webhook_status =
  (typeof payment_webhook_status)[keyof typeof payment_webhook_status];
export const plan_type = {
  SINGLE_APP: "SINGLE_APP",
  BUNDLE: "BUNDLE",
  ENTERPRISE: "ENTERPRISE",
} as const;
export type plan_type = (typeof plan_type)[keyof typeof plan_type];
export const price_entity_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
  BATCH: "BATCH",
  TEST_SERIES: "TEST_SERIES",
} as const;
export type price_entity_type = (typeof price_entity_type)[keyof typeof price_entity_type];
export const pricing_frequency = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
  BOTH: "BOTH",
  TWO_YEARLY: "TWO_YEARLY",
  ALL: "ALL",
} as const;
export type pricing_frequency = (typeof pricing_frequency)[keyof typeof pricing_frequency];
export const purchase_mode = {
  FREE: "FREE",
  PAID: "PAID",
} as const;
export type purchase_mode = (typeof purchase_mode)[keyof typeof purchase_mode];
export const quiz_attempt_status = {
  IN_PROGRESS: "IN_PROGRESS",
  PASSED: "PASSED",
  FAILED: "FAILED",
} as const;
export type quiz_attempt_status = (typeof quiz_attempt_status)[keyof typeof quiz_attempt_status];
export const quiz_question_type = {
  MCQ: "MCQ",
  DRAG_DROP: "DRAG_DROP",
} as const;
export type quiz_question_type = (typeof quiz_question_type)[keyof typeof quiz_question_type];
export const quiz_scope = {
  COURSE: "COURSE",
  SECTION: "SECTION",
  LESSON: "LESSON",
} as const;
export type quiz_scope = (typeof quiz_scope)[keyof typeof quiz_scope];
export const quiz_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;
export type quiz_status = (typeof quiz_status)[keyof typeof quiz_status];
export const refund_status = {
  INITIATED: "INITIATED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type refund_status = (typeof refund_status)[keyof typeof refund_status];
export const staff_membership_status = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  INVITED: "INVITED",
} as const;
export type staff_membership_status =
  (typeof staff_membership_status)[keyof typeof staff_membership_status];
export const submission_content_type = {
  TEXT: "TEXT",
  PDF: "PDF",
} as const;
export type submission_content_type =
  (typeof submission_content_type)[keyof typeof submission_content_type];
export const submission_status = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  EVALUATED: "EVALUATED",
  RESUBMISSION_REQUESTED: "RESUBMISSION_REQUESTED",
} as const;
export type submission_status = (typeof submission_status)[keyof typeof submission_status];
export const subscription_status = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  TRIALING: "TRIALING",
} as const;
export type subscription_status = (typeof subscription_status)[keyof typeof subscription_status];
export const tax_mode = {
  INCLUSIVE: "INCLUSIVE",
  EXCLUSIVE: "EXCLUSIVE",
} as const;
export type tax_mode = (typeof tax_mode)[keyof typeof tax_mode];
export const tenant_addon_event_type = {
  PURCHASED: "PURCHASED",
  ADMIN_GRANTED_PAID: "ADMIN_GRANTED_PAID",
  ADMIN_GRANTED_FREE: "ADMIN_GRANTED_FREE",
  ACTIVATED: "ACTIVATED",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  RENEWED: "RENEWED",
  UPGRADED: "UPGRADED",
} as const;
export type tenant_addon_event_type =
  (typeof tenant_addon_event_type)[keyof typeof tenant_addon_event_type];
export const tenant_addon_source = {
  PURCHASED: "PURCHASED",
  ADMIN_PAID: "ADMIN_PAID",
  ADMIN_FREE: "ADMIN_FREE",
} as const;
export type tenant_addon_source = (typeof tenant_addon_source)[keyof typeof tenant_addon_source];
export const tenant_addon_status = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  SUSPENDED: "SUSPENDED",
} as const;
export type tenant_addon_status = (typeof tenant_addon_status)[keyof typeof tenant_addon_status];
export const tenant_app_event_type = {
  ACTIVATED: "ACTIVATED",
  SUSPENDED: "SUSPENDED",
  UNSUSPENDED: "UNSUSPENDED",
  TRIAL_STARTED: "TRIAL_STARTED",
  TRIAL_EXTENDED: "TRIAL_EXTENDED",
  TRIAL_EXPIRED: "TRIAL_EXPIRED",
  CANCELLED: "CANCELLED",
  REACTIVATED: "REACTIVATED",
} as const;
export type tenant_app_event_type =
  (typeof tenant_app_event_type)[keyof typeof tenant_app_event_type];
export const tenant_app_source = {
  SUBSCRIPTION: "SUBSCRIPTION",
  ADMIN_TRIAL: "ADMIN_TRIAL",
  ADMIN_GRANT: "ADMIN_GRANT",
  PROMO: "PROMO",
} as const;
export type tenant_app_source = (typeof tenant_app_source)[keyof typeof tenant_app_source];
export const tenant_app_status = {
  ACTIVE: "ACTIVE",
  TRIALING: "TRIALING",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
} as const;
export type tenant_app_status = (typeof tenant_app_status)[keyof typeof tenant_app_status];
export const tenant_bulk_import_scope_type = {
  TENANT: "TENANT",
  COURSE: "COURSE",
  BOOK: "BOOK",
  BATCH: "BATCH",
  TEST_SERIES: "TEST_SERIES",
  BUNDLE: "BUNDLE",
} as const;
export type tenant_bulk_import_scope_type =
  (typeof tenant_bulk_import_scope_type)[keyof typeof tenant_bulk_import_scope_type];
export const tenant_bulk_import_source = {
  CSV: "CSV",
  SELECT_EXISTING: "SELECT_EXISTING",
} as const;
export type tenant_bulk_import_source =
  (typeof tenant_bulk_import_source)[keyof typeof tenant_bulk_import_source];
export const tenant_bulk_import_status = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type tenant_bulk_import_status =
  (typeof tenant_bulk_import_status)[keyof typeof tenant_bulk_import_status];
export const tenant_status = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
} as const;
export type tenant_status = (typeof tenant_status)[keyof typeof tenant_status];
export const tenant_subscription_status = {
  CREATED: "CREATED",
  AUTHENTICATED: "AUTHENTICATED",
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  HALTED: "HALTED",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED",
} as const;
export type tenant_subscription_status =
  (typeof tenant_subscription_status)[keyof typeof tenant_subscription_status];
export const tenant_user_status = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
  INVITED: "INVITED",
} as const;
export type tenant_user_status = (typeof tenant_user_status)[keyof typeof tenant_user_status];
export const test_answer_grading_status = {
  AUTO_GRADED: "AUTO_GRADED",
  PENDING_REVIEW: "PENDING_REVIEW",
  MANUALLY_GRADED: "MANUALLY_GRADED",
} as const;
export type test_answer_grading_status =
  (typeof test_answer_grading_status)[keyof typeof test_answer_grading_status];
export const test_attempt_grading_status = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING_REVIEW: "PENDING_REVIEW",
  COMPLETED: "COMPLETED",
} as const;
export type test_attempt_grading_status =
  (typeof test_attempt_grading_status)[keyof typeof test_attempt_grading_status];
export const test_attempt_module_status = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;
export type test_attempt_module_status =
  (typeof test_attempt_module_status)[keyof typeof test_attempt_module_status];
export const test_attempt_status = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  AUTO_SUBMITTED: "AUTO_SUBMITTED",
  ON_BREAK: "ON_BREAK",
} as const;
export type test_attempt_status = (typeof test_attempt_status)[keyof typeof test_attempt_status];
export const test_mode = {
  STANDARD: "STANDARD",
  ADAPTIVE: "ADAPTIVE",
} as const;
export type test_mode = (typeof test_mode)[keyof typeof test_mode];
export const test_question_created_via = {
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
  AI: "AI",
} as const;
export type test_question_created_via =
  (typeof test_question_created_via)[keyof typeof test_question_created_via];
export const test_question_difficulty = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;
export type test_question_difficulty =
  (typeof test_question_difficulty)[keyof typeof test_question_difficulty];
export const test_question_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type test_question_status = (typeof test_question_status)[keyof typeof test_question_status];
export const test_question_type = {
  MCQ_SINGLE: "MCQ_SINGLE",
  MCQ_MULTI: "MCQ_MULTI",
  TRUE_FALSE: "TRUE_FALSE",
  FIB: "FIB",
  NAT: "NAT",
  DRAG_DROP: "DRAG_DROP",
  DESCRIPTIVE: "DESCRIPTIVE",
} as const;
export type test_question_type = (typeof test_question_type)[keyof typeof test_question_type];
export const test_series_access_mode = {
  SEQUENTIAL: "SEQUENTIAL",
  OPEN: "OPEN",
} as const;
export type test_series_access_mode =
  (typeof test_series_access_mode)[keyof typeof test_series_access_mode];
export const test_series_enrollment_source = {
  PURCHASED: "PURCHASED",
  ADMIN_GRANT: "ADMIN_GRANT",
  FREE: "FREE",
  BUNDLE: "BUNDLE",
} as const;
export type test_series_enrollment_source =
  (typeof test_series_enrollment_source)[keyof typeof test_series_enrollment_source];
export const test_series_enrollment_status = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;
export type test_series_enrollment_status =
  (typeof test_series_enrollment_status)[keyof typeof test_series_enrollment_status];
export const test_series_pricing_type = {
  FREE: "FREE",
  PAID: "PAID",
} as const;
export type test_series_pricing_type =
  (typeof test_series_pricing_type)[keyof typeof test_series_pricing_type];
export const test_series_visibility = {
  PUBLIC: "PUBLIC",
  UNLISTED: "UNLISTED",
  PRIVATE: "PRIVATE",
} as const;
export type test_series_visibility =
  (typeof test_series_visibility)[keyof typeof test_series_visibility];
export const test_show_solutions = {
  IMMEDIATE: "IMMEDIATE",
  AFTER_SERIES_END: "AFTER_SERIES_END",
  NEVER: "NEVER",
} as const;
export type test_show_solutions = (typeof test_show_solutions)[keyof typeof test_show_solutions];
export const test_status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type test_status = (typeof test_status)[keyof typeof test_status];
export const test_taxonomy_kind = {
  SUBJECT: "SUBJECT",
  CHAPTER: "CHAPTER",
  TOPIC: "TOPIC",
} as const;
export type test_taxonomy_kind = (typeof test_taxonomy_kind)[keyof typeof test_taxonomy_kind];
export const testimonial_status = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type testimonial_status = (typeof testimonial_status)[keyof typeof testimonial_status];
export const usage_event_type = {
  CONSUME: "CONSUME",
  RELEASE: "RELEASE",
  RESET: "RESET",
} as const;
export type usage_event_type = (typeof usage_event_type)[keyof typeof usage_event_type];
export const usage_scope_type = {
  TENANT: "TENANT",
  USER: "USER",
} as const;
export type usage_scope_type = (typeof usage_scope_type)[keyof typeof usage_scope_type];
export const usage_window_type = {
  LIFETIME: "LIFETIME",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
  DAILY: "DAILY",
} as const;
export type usage_window_type = (typeof usage_window_type)[keyof typeof usage_window_type];
export const video_processing_status = {
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;
export type video_processing_status =
  (typeof video_processing_status)[keyof typeof video_processing_status];
export const video_provider = {
  YOUTUBE: "YOUTUBE",
  EVS: "EVS",
  HLS: "HLS",
  MP4: "MP4",
} as const;
export type video_provider = (typeof video_provider)[keyof typeof video_provider];
export const vote_type = {
  UPVOTE: "UPVOTE",
  DOWNVOTE: "DOWNVOTE",
} as const;
export type vote_type = (typeof vote_type)[keyof typeof vote_type];
export const webhook_status = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type webhook_status = (typeof webhook_status)[keyof typeof webhook_status];
export const translatable_entity_type = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  CATEGORY: "CATEGORY",
  BUNDLE: "BUNDLE",
  PAGE: "PAGE",
} as const;
export type translatable_entity_type =
  (typeof translatable_entity_type)[keyof typeof translatable_entity_type];
