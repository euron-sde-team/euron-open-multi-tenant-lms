import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type {
  addon_subscription_status,
  admin_user_status,
  assignment_content_type,
  assignment_scope,
  assignment_status,
  batch_item_type,
  batch_status,
  billing_cycle,
  book_conversion_status,
  book_file_format,
  book_source_type,
  book_status,
  bookmark_type,
  bundle_item_type,
  bundle_status,
  cart_item_type,
  certificate_status,
  constraint_type,
  content_discount_type,
  coupon_discount_type,
  course_difficulty,
  course_mode,
  course_status,
  course_type,
  custom_code_kind,
  discount_type,
  domain_status,
  domain_type,
  email_message_category,
  email_message_status,
  email_reputation_event_trigger,
  email_sender_identity_status,
  email_sending_domain_status,
  email_sending_tenant_status,
  email_suppression_reason,
  enrollment_source,
  enrollment_status,
  entitlement_sources,
  gateway_connection_status,
  gateway_mode,
  invoice_status,
  invoice_type,
  lesson_resource_type,
  lesson_type,
  linkable_content_type,
  member_notification_type,
  member_payment_detail_type,
  member_status,
  offering_type,
  order_status,
  order_type,
  orientation,
  page_moderation_status,
  page_render_mode,
  payment_receipt_status,
  payment_webhook_status,
  plan_type,
  price_entity_type,
  pricing_frequency,
  purchase_mode,
  quiz_attempt_status,
  quiz_question_type,
  quiz_scope,
  quiz_status,
  refund_status,
  staff_membership_status,
  submission_content_type,
  submission_status,
  subscription_status,
  tax_mode,
  tenant_addon_event_type,
  tenant_addon_source,
  tenant_addon_status,
  tenant_app_event_type,
  tenant_app_source,
  tenant_app_status,
  tenant_bulk_import_scope_type,
  tenant_bulk_import_source,
  tenant_bulk_import_status,
  tenant_status,
  tenant_subscription_status,
  tenant_user_status,
  test_answer_grading_status,
  test_attempt_grading_status,
  test_attempt_module_status,
  test_attempt_status,
  test_mode,
  test_question_created_via,
  test_question_difficulty,
  test_question_status,
  test_question_type,
  test_series_access_mode,
  test_series_enrollment_source,
  test_series_enrollment_status,
  test_series_pricing_type,
  test_series_visibility,
  test_show_solutions,
  test_status,
  test_taxonomy_kind,
  testimonial_status,
  usage_event_type,
  usage_scope_type,
  usage_window_type,
  video_processing_status,
  video_provider,
  vote_type,
  webhook_status,
  translatable_entity_type,
} from "./enums";

export type addon_subscriptions = {
  id: string;
  tenant_id: string;
  addon_id: string;
  billing_cycle: Generated<billing_cycle>;
  currency: string;
  original_price: string;
  discount_applied: Generated<string>;
  price_snapshot: string;
  billing_provider_id: string | null;
  external_subscription_id: string | null;
  started_at: Generated<Timestamp>;
  current_period_start: Generated<Timestamp>;
  current_period_end: Timestamp;
  cancelled_at: Timestamp | null;
  status: Generated<addon_subscription_status>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type addons = {
  id: string;
  application_id: string;
  code: string;
  name: string;
  description: string | null;
  product_id: string;
  grant_value: number;
  is_unlimited: Generated<boolean>;
  price_monthly_inr: string;
  price_yearly_inr: string;
  discount_monthly_inr_type: Generated<discount_type>;
  discount_monthly_inr_value: Generated<string>;
  discount_yearly_inr_type: Generated<discount_type>;
  discount_yearly_inr_value: Generated<string>;
  price_monthly_usd: string;
  price_yearly_usd: string;
  discount_monthly_usd_type: Generated<discount_type>;
  discount_monthly_usd_value: Generated<string>;
  discount_yearly_usd_type: Generated<discount_type>;
  discount_yearly_usd_value: Generated<string>;
  is_active: Generated<boolean>;
  is_public: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type admin_audit_logs = {
  id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_id: string | null;
  resource_label: string | null;
  tenant_id: string | null;
  summary: string;
  metadata: unknown | null;
  ip_address: string | null;
  user_agent: string | null;
  is_system: Generated<boolean>;
  created_at: Generated<Timestamp>;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};
export type admin_permissions = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Timestamp;
};
export type admin_role_permissions = {
  role_id: string;
  permission_id: string;
  created_at: Generated<Timestamp>;
};
export type admin_roles = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type admin_user_roles = {
  admin_user_id: string;
  role_id: string;
  assigned_at: Generated<Timestamp>;
  assigned_by: string | null;
};
export type admin_users = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  status: Generated<admin_user_status>;
  email_verified: Generated<boolean>;
  last_login_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type applications = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  is_active: Generated<boolean>;
  is_public: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  config: unknown | null;
};
export type assignment_evaluations = {
  id: string;
  tenant_id: string;
  submission_id: string;
  assignment_id: string;
  tenant_member_id: string;
  score: number;
  max_score: Generated<number>;
  feedback: string | null;
  evaluated_by: string;
  evaluated_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type assignment_submissions = {
  id: string;
  tenant_id: string;
  assignment_id: string;
  tenant_member_id: string;
  course_id: string;
  content_type: Generated<submission_content_type>;
  text_content: string | null;
  pdf_key: string | null;
  status: Generated<submission_status>;
  submitted_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type assignments = {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  resource_links: Generated<string[]>;
  created_at: Timestamp;
  updated_at: Timestamp;
  ai_generated: Generated<boolean>;
  content_type: Generated<assignment_content_type>;
  due_date: Timestamp | null;
  max_score: Generated<number>;
  pdf_key: string | null;
  scope: Generated<assignment_scope>;
  section_id: string | null;
  sort_order: Generated<number>;
  source_lecture_id: string | null;
  status: Generated<assignment_status>;
  passing_score: number | null;
};
export type batch_enrollments = {
  id: string;
  tenant_id: string;
  batch_id: string;
  tenant_member_id: string;
  joined_at: Generated<Timestamp>;
  valid_till: Timestamp | null;
  status: Generated<enrollment_status>;
  source: Generated<enrollment_source>;
  source_order_id: string | null;
  source_coupon_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type batch_items = {
  id: string;
  tenant_id: string;
  batch_id: string;
  item_type: batch_item_type;
  course_id: string | null;
  book_id: string | null;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type batch_leaderboard_snapshots = {
  id: string;
  tenant_id: string;
  batch_id: string;
  computed_at: Generated<Timestamp>;
  participants: Generated<number>;
  payload: unknown;
  created_at: Generated<Timestamp>;
};
export type batches = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  cover_image_url: string | null;
  preview_url: string | null;
  start_date: Timestamp;
  end_date: Timestamp | null;
  enrollment_open_date: Timestamp | null;
  enrollment_close_date: Timestamp | null;
  duration_days: number | null;
  validity_days: number | null;
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
  purchase_mode: Generated<purchase_mode>;
  status: Generated<batch_status>;
  sort_order: Generated<number>;
  total_enrollments: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  learning_outcomes: Generated<string[]>;
  mobile_thumbnail_key: string | null;
  web_thumbnail_key: string | null;
};
export type billing_providers = {
  id: string;
  name: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  is_active: Generated<boolean>;
  is_visible_to_tenant: Generated<boolean>;
  credential_schema: unknown | null;
};
export type billing_webhooks = {
  id: string;
  billing_provider_id: string;
  event_type: string;
  event_id: string;
  payload: unknown;
  status: Generated<webhook_status>;
  processed_at: Timestamp | null;
  error_message: string | null;
  created_at: Timestamp;
};
export type book_access = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  book_id: string;
  status: Generated<enrollment_status>;
  source: Generated<enrollment_source>;
  source_bundle_id: string | null;
  source_coupon_id: string | null;
  valid_till: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  source_batch_id: string | null;
};
export type book_authors = {
  id: string;
  tenant_id: string;
  book_id: string;
  instructor_id: string;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type book_categories = {
  id: string;
  tenant_id: string;
  book_id: string;
  category_id: string;
  created_at: Generated<Timestamp>;
};
export type book_conversions = {
  id: string;
  tenant_id: string;
  book_id: string;
  source_type: book_source_type;
  source_url: string;
  source_key: string;
  source_filename: string;
  source_size_bytes: string;
  status: Generated<book_conversion_status>;
  job_id: string | null;
  output_url: string | null;
  output_key: string | null;
  output_size_bytes: string | null;
  pipeline: string | null;
  error_message: string | null;
  error_code: string | null;
  attempt: Generated<number>;
  duration_ms: number | null;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type book_recommendations = {
  id: string;
  tenant_id: string;
  book_id: string;
  recommended_book_id: string;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type books = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  pages: number | null;
  url: string | null;
  page_images: Generated<string[]>;
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
  purchase_mode: Generated<purchase_mode>;
  status: Generated<book_status>;
  language: Generated<string[]>;
  thumbnail_url: string | null;
  preview_url: string | null;
  summary: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  rating: string | null;
  rating_total_count: Generated<number | null>;
  validity_days: number | null;
  sample_enabled: Generated<boolean>;
  sample_pages: number | null;
  file_format: Generated<book_file_format>;
};
export type bulk_certificates = {
  id: string;
  tenant_id: string;
  batch_id: string;
  recipient_name: string;
  certificate_number: string;
  status: Generated<certificate_status>;
  issued_at: Generated<Timestamp>;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  email: string | null;
  emailed_at: Timestamp | null;
  tenant_member_id: string | null;
};
export type bundle_items = {
  id: string;
  tenant_id: string;
  bundle_id: string;
  item_type: bundle_item_type;
  course_id: string | null;
  book_id: string | null;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
  test_series_id: string | null;
};
export type bundles = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  status: Generated<bundle_status>;
  validity_days: number | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  purchase_mode: Generated<purchase_mode>;
};
export type cart_items = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  item_type: cart_item_type;
  course_id: string | null;
  book_id: string | null;
  bundle_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  coupon_code: string | null;
  batch_id: string | null;
};
export type cart_order_items = {
  id: string;
  tenant_id: string;
  order_id: string;
  item_type: cart_item_type;
  course_id: string | null;
  book_id: string | null;
  bundle_id: string | null;
  base_amount: string;
  discount_amount: Generated<string>;
  net_amount: string;
  created_at: Generated<Timestamp>;
  coupon_code_snapshot: string | null;
  coupon_id: string | null;
  batch_id: string | null;
};
export type categories = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  parent_id: string | null;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type certificate_batches = {
  id: string;
  tenant_id: string;
  title: string;
  template_id: string;
  /**
   * A custom design (certificate_templates.id) when the batch uses one
   */
  certificate_template_id: string | null;
  /**
   * The design as it was when the batch was issued
   */
  template_snapshot: unknown | null;
  signatory_name: string | null;
  signatory_title: string | null;
  total_count: Generated<number>;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type certificate_templates = {
  id: string;
  tenant_id: string;
  name: string;
  page_size: Generated<string>;
  orientation: Generated<string>;
  background_asset_url: string | null;
  layout: unknown;
  is_default: Generated<boolean>;
  status: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type certificates = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  certificate_number: string;
  status: Generated<certificate_status>;
  issued_at: Generated<Timestamp>;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  emailed_at: Timestamp | null;
  certificate_template_id: string | null;
  template_snapshot: unknown | null;
};
export type content_prices = {
  id: string;
  tenant_id: string;
  entity_type: price_entity_type;
  entity_id: string;
  currency: string;
  amount: string;
  discount: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  discount_type: Generated<content_discount_type>;
};
export type content_product_links = {
  id: string;
  tenant_id: string;
  product_id: string;
  product_code: string;
  content_type: linkable_content_type;
  course_id: string | null;
  book_id: string | null;
  bundle_id: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  batch_id: string | null;
};
export type content_translations = {
  id: string;
  tenant_id: string;
  entity_type: translatable_entity_type;
  entity_id: string;
  locale: string;
  field: string;
  value: string;
  is_machine: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type coupon_applicable_items = {
  id: string;
  tenant_id: string;
  coupon_id: string;
  item_type: bundle_item_type;
  course_id: string | null;
  book_id: string | null;
  bundle_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp | null;
  batch_id: string | null;
  test_series_id: string | null;
};
export type coupon_redemptions = {
  id: string;
  tenant_id: string;
  coupon_id: string;
  member_id: string;
  order_id: string;
  discount_amount: string;
  currency: string;
  created_at: Generated<Timestamp>;
};
export type coupons = {
  id: string;
  tenant_id: string;
  code: string;
  discount_type: coupon_discount_type;
  discount_value: string;
  is_active: Generated<boolean>;
  valid_from: Timestamp | null;
  valid_to: Timestamp | null;
  max_uses: number | null;
  used_count: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  max_uses_per_user: number | null;
  currency: string | null;
  is_public: Generated<boolean>;
};
export type course_categories = {
  id: string;
  tenant_id: string;
  course_id: string;
  category_id: string;
  created_at: Generated<Timestamp>;
};
export type course_faqs = {
  id: string;
  tenant_id: string;
  course_id: string;
  question: string;
  answer: string;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type course_instructors = {
  id: string;
  tenant_id: string;
  course_id: string;
  instructor_id: string;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type course_lessons = {
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string;
  title: string;
  type: lesson_type;
  sort_order: Generated<number>;
  is_preview: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type course_recommendations = {
  id: string;
  tenant_id: string;
  course_id: string;
  recommended_course_id: string;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type course_review_votes = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  review_id: string;
  vote_type: vote_type;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type course_reviews = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  rating: number;
  review_text: string | null;
  is_visible: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type course_sections = {
  id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type course_syllabus_items = {
  id: string;
  tenant_id: string;
  syllabus_section_id: string;
  title: string;
  preview_url: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type course_syllabus_sections = {
  id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type courses = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
  purchase_mode: Generated<purchase_mode>;
  status: Generated<course_status>;
  mode: Generated<course_mode>;
  difficulty: Generated<course_difficulty>;
  language: Generated<string[]>;
  duration: string | null;
  learning_outcomes: Generated<string[]>;
  prerequisites: Generated<string[]>;
  class_timing: string | null;
  start_date: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  lms_settings: unknown | null;
  lms_template_id: string | null;
  preview_key: string | null;
  secondary_thumbnail_key: string | null;
  thumbnail_key: string | null;
  course_type: Generated<course_type>;
  validity_days: number | null;
  certificate_template_id: string | null;
  unlocks_after_type: offering_type | null;
  unlocks_after_id: string | null;
};
export type enrollments = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  status: Generated<enrollment_status>;
  source: Generated<enrollment_source>;
  source_bundle_id: string | null;
  source_coupon_id: string | null;
  enrolled_at: Generated<Timestamp>;
  completed_at: Timestamp | null;
  valid_till: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  source_batch_id: string | null;
};
export type entitlement_overrides = {
  id: string;
  entitlement_id: string;
  old_limit_value: number;
  new_limit_value: number;
  reason: string;
  admin_id: string;
  created_at: Generated<Timestamp>;
};
export type entitlements = {
  id: string;
  tenant_id: string;
  product_id: string;
  application_code: string;
  feature_key: string;
  product_code: string;
  is_unlimited: Generated<boolean>;
  limit_value: number;
  used_value: Generated<number>;
  source: Generated<entitlement_sources>;
  source_subscription_id: string | null;
  source_plan_version_id: string | null;
  source_addon_id: string | null;
  is_active: Generated<boolean>;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type features = {
  id: string;
  application_id: string;
  key: string;
  name: string | null;
  description: string | null;
  category: string | null;
  is_deprecated: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
  is_navigable: Generated<boolean>;
  nav_icon: string | null;
  nav_label: string | null;
  nav_route: string | null;
  nav_sort_order: Generated<number>;
};
export type instructor_experiences = {
  id: string;
  tenant_id: string;
  instructor_id: string;
  company: string;
  company_logo: string | null;
  years: number;
  details: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type instructor_socials = {
  id: string;
  tenant_id: string;
  instructor_id: string;
  linkedin_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  github_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type instructors = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  bio: string | null;
  expertise: string | null;
  profile_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  email: string | null;
  name: string;
};
export type invoices = {
  id: string;
  tenant_id: string;
  invoice_number: string;
  invoice_type: invoice_type;
  subscription_id: string | null;
  order_id: string | null;
  member_id: string | null;
  currency: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  invoice_url: string;
  s3_key: string;
  payment_method: string | null;
  transaction_id: string | null;
  status: Generated<invoice_status>;
  generated_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type lecture_dropoff_buckets = {
  tenant_id: string;
  lecture_id: string;
  bucket_index: number;
  sessions_count: Generated<number>;
  updated_at: Generated<Timestamp>;
};
export type lecture_watch_sessions = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  lecture_id: string;
  started_at: Generated<Timestamp>;
  last_heartbeat_at: Generated<Timestamp>;
  ended_at: Timestamp | null;
  start_position: Generated<number>;
  end_position: Generated<number>;
  seconds_watched: Generated<string>;
  device_type: string | null;
  user_agent: string | null;
  created_at: Generated<Timestamp>;
};
export type lectures = {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  title: string;
  duration: string | null;
  processing_status: Generated<video_processing_status>;
  resource_links: Generated<string[]>;
  summary: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  video_key: string | null;
  video_provider: video_provider | null;
};
export type lesson_resources = {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  type: lesson_resource_type;
  title: string;
  url: string | null;
  content: string | null;
  downloadable: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_assignment_progress = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  assignment_id: string;
  lesson_id: string | null;
  course_id: string;
  completed: Generated<boolean>;
  completed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_book_highlights = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  book_id: string;
  cfi_range: string;
  text: string;
  color: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_book_page_bookmarks = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  book_id: string;
  cfi_location: string;
  label: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_book_progress = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  book_id: string;
  last_page: number | null;
  completed: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
  location: string | null;
};
export type member_bookmarks = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  bookmark_type: bookmark_type;
  course_id: string | null;
  book_id: string | null;
  bundle_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_lecture_progress = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  lecture_id: string;
  watched_duration: Generated<number>;
  completed: Generated<boolean>;
  last_watched_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  last_position_seconds: Generated<number>;
  total_watch_seconds: Generated<string>;
};
export type member_lesson_progress = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  lesson_id: string;
  course_id: string;
  completed: Generated<boolean>;
  completed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_notifications = {
  id: string;
  tenant_id: string;
  member_id: string;
  type: member_notification_type;
  title: string;
  message: string;
  action_url: string | null;
  is_read: Generated<boolean>;
  read_at: Timestamp | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_payment_details = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  type: member_payment_detail_type;
  upi_vpa: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  pan_number: string | null;
  paypal_email: string | null;
  is_primary: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type member_quiz_progress = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  quiz_id: string;
  lesson_id: string | null;
  course_id: string;
  completed: Generated<boolean>;
  completed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type payment_orders = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  gateway_connection_id: string | null;
  order_number: string;
  order_type: order_type;
  item_id: string;
  currency: string;
  base_amount: string;
  discount_amount: Generated<string>;
  coupon_id: string | null;
  coupon_code_snapshot: string | null;
  net_amount: string;
  tax_amount: Generated<string>;
  total_amount: string;
  platform_fee: Generated<string>;
  tenant_payout_amount: string | null;
  gateway_provider_name: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  status: Generated<order_status>;
  paid_at: Timestamp | null;
  failed_at: Timestamp | null;
  refunded_at: Timestamp | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  fx_rate_to_tenant_default: string | null;
  resolved_country: string | null;
  tenant_default_currency: string | null;
};
export type payment_receipt_counters = {
  fiscal_year: string;
  last_sequence: Generated<number>;
  updated_at: Timestamp;
};
export type payment_receipt_items = {
  id: string;
  receipt_id: string;
  kind: Generated<string>;
  description: string;
  quantity: Generated<string>;
  unit_price: Generated<string>;
  line_total: Generated<string>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type payment_receipts = {
  id: string;
  receipt_number: string | null;
  status: Generated<payment_receipt_status>;
  currency: Generated<string>;
  tenant_id: string | null;
  buyer_name: string;
  buyer_legal_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_address_line1: string | null;
  buyer_address_line2: string | null;
  buyer_city: string | null;
  buyer_state: string | null;
  buyer_country: Generated<string | null>;
  buyer_postal_code: string | null;
  buyer_gstin: string | null;
  buyer_pan: string | null;
  buyer_registration_number: string | null;
  receipt_date: Timestamp;
  payment_method: string | null;
  payment_reference: string | null;
  tax_rate: Generated<string>;
  tax_mode: Generated<tax_mode>;
  subtotal_amount: Generated<string>;
  taxable_amount: Generated<string>;
  tax_amount: Generated<string>;
  total_amount: Generated<string>;
  notes: string | null;
  terms: string | null;
  pdf_storage_key: string | null;
  pdf_generated_at: Timestamp | null;
  sent_at: Timestamp | null;
  sent_to_email: string | null;
  cancelled_at: Timestamp | null;
  created_by: string;
  updated_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type payment_webhook_events = {
  id: string;
  tenant_id: string;
  gateway_connection_id: string;
  provider_name: string;
  event_type: string;
  event_id: string;
  payload: unknown;
  status: Generated<payment_webhook_status>;
  processed_at: Timestamp | null;
  error_message: string | null;
  retry_count: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type pending_subscription_checkouts = {
  id: string;
  tenant_id: string;
  external_subscription_id: string;
  plan_version_id: string;
  billing_cycle: Generated<billing_cycle>;
  currency: string;
  created_at: Generated<Timestamp>;
  billing_provider_name: Generated<string>;
};
export type plan_applications = {
  id: string;
  plan_id: string;
  application_id: string;
  created_at: Generated<Timestamp>;
};
export type plan_version_billing_mappings = {
  id: string;
  plan_version_id: string;
  billing_provider_id: string;
  billing_cycle: billing_cycle;
  currency: string;
  external_plan_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type plan_version_products = {
  id: string;
  plan_version_id: string;
  product_id: string;
  limit_value: number;
  is_unlimited: Generated<boolean>;
  created_at: Generated<Timestamp>;
};
export type plan_versions = {
  id: string;
  plan_id: string;
  version: Generated<number>;
  price_monthly_inr: string;
  price_yearly_inr: string;
  discount_monthly_inr_type: Generated<discount_type>;
  discount_monthly_inr_value: Generated<string>;
  discount_yearly_inr_type: Generated<discount_type>;
  discount_yearly_inr_value: Generated<string>;
  price_monthly_usd: string;
  price_yearly_usd: string;
  discount_monthly_usd_type: Generated<discount_type>;
  discount_monthly_usd_value: Generated<string>;
  discount_yearly_usd_type: Generated<discount_type>;
  discount_yearly_usd_value: Generated<string>;
  is_active: Generated<boolean>;
  published_at: Timestamp | null;
  retired_at: Timestamp | null;
  created_at: Timestamp;
  is_offer: Generated<boolean>;
  offer_description: string | null;
  offer_name: string | null;
  offer_valid_from: Timestamp | null;
  offer_valid_to: Timestamp | null;
  pricing_frequency: Generated<pricing_frequency>;
  grace_period_days: Generated<number>;
  discount_two_yearly_inr_type: Generated<discount_type>;
  discount_two_yearly_inr_value: Generated<string | null>;
  discount_two_yearly_usd_type: Generated<discount_type>;
  discount_two_yearly_usd_value: Generated<string | null>;
  price_two_yearly_inr: Generated<string | null>;
  price_two_yearly_usd: Generated<string | null>;
  purchase_mode: Generated<purchase_mode>;
};
export type plans = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  plan_type: Generated<plan_type>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  is_public: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type platform_exchange_rates = {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: string;
  source: string;
  fetched_at: Timestamp;
  created_at: Generated<Timestamp>;
};
export type platform_notification_suppressions = {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  source: string | null;
  created_at: Generated<Timestamp>;
};
export type products = {
  id: string;
  feature_id: string;
  code: string;
  constraint_type: constraint_type;
  unit: string | null;
  is_hard_limit: Generated<boolean>;
  created_at: Generated<Timestamp>;
  title: string | null;
  usage_scope: Generated<usage_scope_type>;
  usage_window: Generated<usage_window_type>;
};
export type question_serve_stats = {
  id: string;
  tenant_id: string;
  owner_type: string;
  owner_id: string;
  question_id: string;
  served_count: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type question_upload_assets = {
  id: string;
  tenant_id: string;
  name: string;
  question_count: Generated<number>;
  questions: unknown;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type quiz_attempt_answers = {
  id: string;
  tenant_id: string;
  attempt_id: string;
  question_id: string;
  option_id: string;
  is_correct: Generated<boolean>;
  marks_awarded: Generated<number>;
  created_at: Generated<Timestamp>;
  answer: unknown | null;
};
export type quiz_attempts = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  quiz_id: string;
  score: Generated<number>;
  total_marks: Generated<number>;
  status: Generated<quiz_attempt_status>;
  started_at: Generated<Timestamp>;
  completed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  question_ids: Generated<string[]>;
  proctoring_flags: unknown | null;
  tab_switch_count: Generated<number>;
};
export type quiz_options = {
  id: string;
  tenant_id: string;
  question_id: string;
  option_text: string;
  is_correct: Generated<boolean>;
  explanation: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  blank_index: number | null;
};
export type quiz_questions = {
  id: string;
  tenant_id: string;
  quiz_id: string;
  question: string;
  marks: Generated<number>;
  sort_order: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  question_type: Generated<quiz_question_type>;
  source_question_id: string | null;
};
export type quizzes = {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  ai_generated: Generated<boolean>;
  due_date: Timestamp | null;
  instructions: string | null;
  max_score: Generated<number>;
  pass_percentage: Generated<number>;
  scope: Generated<quiz_scope>;
  section_id: string | null;
  sort_order: Generated<number>;
  source_lecture_id: string | null;
  status: Generated<quiz_status>;
  random_question_count: number | null;
  allow_reattempt: Generated<boolean>;
  max_attempts: number | null;
  calculator_mode: Generated<string>;
  proctor_camera: Generated<boolean>;
  proctor_max_tab_switches: number | null;
  proctoring_enabled: Generated<boolean>;
  bank_selection: unknown | null;
  question_bank_id: string | null;
  duration_min: number | null;
};
export type refunds = {
  id: string;
  tenant_id: string;
  order_id: string;
  gateway_refund_id: string | null;
  amount: string;
  reason: string | null;
  status: Generated<refund_status>;
  initiated_by: string | null;
  processed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type subscription_events = {
  id: string;
  subscription_id: string;
  tenant_id: string;
  event_type: string;
  event_source: string;
  provider_event_id: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
};
export type subscriptions = {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  plan_code_snapshot: string;
  plan_name_snapshot: string;
  plan_version_snapshot: number;
  billing_cycle: Generated<billing_cycle>;
  currency: string;
  original_price: string;
  discount_applied: Generated<string>;
  price_snapshot: string;
  billing_provider_id: string | null;
  external_subscription_id: string | null;
  external_customer_id: string | null;
  started_at: Generated<Timestamp>;
  current_period_start: Generated<Timestamp>;
  current_period_end: Timestamp;
  cancelled_at: Timestamp | null;
  cancel_effective_at: Timestamp | null;
  status: Generated<subscription_status>;
  created_at: Timestamp;
  updated_at: Timestamp;
  grace_period_ends_at: Timestamp | null;
  billing_provider_name: string | null;
  dunning_started_at: Timestamp | null;
  last_payment_attempt_at: Timestamp | null;
  payment_failure_count: Generated<number>;
};
export type tenant_active_learners_daily = {
  tenant_id: string;
  date: Timestamp;
  distinct_members_count: Generated<number>;
  updated_at: Generated<Timestamp>;
};
export type tenant_addon_events = {
  id: string;
  tenant_addon_id: string;
  tenant_id: string;
  addon_id: string;
  event_type: tenant_addon_event_type;
  old_status: tenant_addon_status | null;
  new_status: tenant_addon_status | null;
  reason: string | null;
  admin_id: string | null;
  is_system: Generated<boolean>;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
};
export type tenant_addons = {
  id: string;
  tenant_id: string;
  addon_id: string;
  source: tenant_addon_source;
  status: Generated<tenant_addon_status>;
  custom_grant_value: number | null;
  addon_subscription_id: string | null;
  entitlement_id: string | null;
  granted_by: string | null;
  reason: string | null;
  activated_at: Generated<Timestamp>;
  cancelled_at: Timestamp | null;
  expires_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type tenant_admin_otp_codes = {
  id: string;
  user_id: string;
  identifier: string;
  code: string;
  channel: string;
  expires_at: Timestamp;
  verified: Generated<boolean>;
  attempts: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type tenant_admin_signup_otp_codes = {
  id: string;
  phone: string;
  code: string;
  channel: Generated<string>;
  expires_at: Timestamp;
  verified: Generated<boolean>;
  attempts: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type tenant_application_events = {
  id: string;
  tenant_application_id: string;
  tenant_id: string;
  application_id: string;
  event_type: tenant_app_event_type;
  old_status: tenant_app_status | null;
  new_status: tenant_app_status;
  reason: string | null;
  admin_user_id: string | null;
  is_system: Generated<boolean>;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
};
export type tenant_applications = {
  id: string;
  tenant_id: string;
  application_id: string;
  status: Generated<tenant_app_status>;
  activated_at: Generated<Timestamp>;
  suspended_at: Timestamp | null;
  trial_ends_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  grant_reason: string | null;
  granted_by: string | null;
  source: tenant_app_source;
  source_subscription_id: string | null;
};
export type tenant_audit_logs = {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  summary: string;
  metadata: unknown | null;
  succeeded: Generated<boolean>;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: Generated<Timestamp>;
};
export type tenant_auth_config = {
  id: string;
  tenant_id: string;
  email_password_enabled: Generated<boolean>;
  google_oauth_enabled: Generated<boolean>;
  email_otp_enabled: Generated<boolean>;
  phone_otp_enabled: Generated<boolean>;
  signup_enabled: Generated<boolean>;
  auto_signup_on_login: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  phone_number_required: Generated<boolean>;
  google_client_id: string | null;
  easy_checkout_enabled: Generated<boolean>;
  name_confirmation_enabled: Generated<boolean>;
};
export type tenant_bulk_imports = {
  id: string;
  tenant_id: string;
  acting_user_id: string;
  scope_type: tenant_bulk_import_scope_type;
  scope_id: string | null;
  source: Generated<tenant_bulk_import_source>;
  status: Generated<tenant_bulk_import_status>;
  original_filename: string | null;
  total_rows: Generated<number>;
  created_count: Generated<number>;
  merged_count: Generated<number>;
  granted_count: Generated<number>;
  skipped_count: Generated<number>;
  error_count: Generated<number>;
  report_s3_key: string | null;
  failure_reason: string | null;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type tenant_certificate_assignments = {
  id: string;
  tenant_id: string;
  offering_type: linkable_content_type;
  preset_template: string | null;
  certificate_template_id: string | null;
  certificate_logo: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type tenant_currencies = {
  id: string;
  tenant_id: string;
  currency: string;
  is_default: Generated<boolean>;
  countries: Generated<unknown>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_domains = {
  id: string;
  tenant_id: string;
  domain_type: domain_type;
  domain_name: string;
  subdomain_prefix: string | null;
  hostname_id: string | null;
  status: Generated<domain_status>;
  error_message: string | null;
  is_primary: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  verified_at: Timestamp | null;
  ssl_status: string | null;
  ownership_verified: Generated<boolean>;
  ssl_active: Generated<boolean>;
  verification_records: unknown | null;
};
export type tenant_email_domain_health_checks = {
  id: string;
  sending_domain_id: string;
  dkim_status: string;
  mail_from_status: string;
  spf_present: Generated<boolean>;
  dmarc_present: Generated<boolean>;
  failures: unknown | null;
  created_at: Generated<Timestamp>;
};
export type tenant_email_messages = {
  id: string;
  tenant_id: string;
  category: email_message_category;
  sending_domain_id: string | null;
  sender_identity_id: string | null;
  from_address: string;
  to_address: string;
  subject: string;
  template_key: string | null;
  campaign_id: string | null;
  ses_message_id: string | null;
  status: Generated<email_message_status>;
  bounce_type: string | null;
  bounce_sub_type: string | null;
  complaint_feedback_type: string | null;
  delivered_at: Timestamp | null;
  bounced_at: Timestamp | null;
  complained_at: Timestamp | null;
  opened_at: Timestamp | null;
  clicked_at: Timestamp | null;
  metadata: unknown | null;
  idempotency_key: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_email_reputation_events = {
  id: string;
  tenant_id: string;
  from_status: email_sending_tenant_status;
  to_status: email_sending_tenant_status;
  trigger: email_reputation_event_trigger;
  triggered_by: string | null;
  reason: string;
  rates_snapshot: unknown;
  created_at: Generated<Timestamp>;
};
export type tenant_email_sender_identities = {
  id: string;
  tenant_id: string;
  sending_domain_id: string;
  email_address: string;
  display_name: string | null;
  reply_to: string | null;
  status: Generated<email_sender_identity_status>;
  is_default_transactional: Generated<boolean>;
  is_default_notification: Generated<boolean>;
  is_default_marketing: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_email_sending_domains = {
  id: string;
  tenant_id: string;
  subdomain: string;
  mail_from_subdomain: string;
  ses_configuration_set: string;
  status: Generated<email_sending_domain_status>;
  dkim_status: string | null;
  mail_from_status: string | null;
  dns_records: unknown;
  failure_reason: string | null;
  verified_at: Timestamp | null;
  last_checked_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_email_suppressions = {
  id: string;
  tenant_id: string;
  email: string;
  reason: email_suppression_reason;
  source_message_id: string | null;
  category_scope: email_message_category | null;
  notes: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_gateway_connections = {
  id: string;
  tenant_id: string;
  provider_id: string;
  mode: gateway_mode;
  label: string | null;
  credentials_encrypted: unknown | null;
  platform_commission_pct: string | null;
  platform_commission_flat: string | null;
  is_active: Generated<boolean>;
  is_verified: Generated<boolean>;
  connected_at: Timestamp | null;
  status: Generated<gateway_connection_status>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_locales = {
  id: string;
  tenant_id: string;
  locale: string;
  is_published: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_member_form_config = {
  id: string;
  tenant_id: string;
  mode: Generated<string>;
  reprompt_after_hours: Generated<number>;
  title: Generated<string>;
  description: string | null;
  fields: Generated<unknown>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  active: Generated<boolean>;
  name: Generated<string>;
  sort_order: Generated<number>;
};
export type tenant_member_form_responses = {
  id: string;
  tenant_id: string;
  member_id: string;
  data: Generated<unknown>;
  completed_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  form_id: string;
};
export type tenant_member_sessions = {
  id: string;
  tenant_id: string;
  member_id: string;
  session_token: string;
  device_info: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  last_seen_at: Generated<Timestamp>;
};
export type tenant_members = {
  id: string;
  tenant_id: string;
  joined_at: Generated<Timestamp>;
  invited_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  avatar_url: string | null;
  email: string | null;
  email_verified: Generated<boolean>;
  last_login_at: Timestamp | null;
  name: string;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  password_hash: string | null;
  phone: string | null;
  phone_verified: Generated<boolean>;
  status: Generated<member_status>;
  about: string | null;
  gender: string | null;
  profile_metadata: unknown | null;
  name_confirmed_at: Timestamp | null;
  preferred_locale: string | null;
};
export type tenant_nav_items = {
  id: string;
  tenant_id: string;
  item_type: string;
  feature_key: string | null;
  label: string;
  href: string;
  icon: string | null;
  sort_order: Generated<number>;
  visible: Generated<boolean>;
  is_external: Generated<boolean>;
  badge_text: string | null;
  badge_variant: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type tenant_nudge_dismissals = {
  id: string;
  tenant_id: string;
  nudge_id: string;
  dismissed_at: Generated<Timestamp>;
};
export type tenant_org_details = {
  id: string;
  tenant_id: string;
  logo_light_key: string | null;
  logo_dark_key: string | null;
  favicon_key: string | null;
  tagline: string | null;
  description: string | null;
  contact_email: string | null;
  support_email: string | null;
  phone_numbers: string[];
  whatsapp_numbers: string[];
  address: unknown | null;
  founder_name: string | null;
  founder_title: string | null;
  founder_bio: string | null;
  founder_photo_key: string | null;
  social_links: unknown | null;
  legal_entity_name: string | null;
  registration_number: string | null;
  year_established: number | null;
  industry: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  billing_address: unknown | null;
  billing_email: string | null;
  billing_phone: string | null;
  gstin: string | null;
  hsn_sac_code: string | null;
  pan_number: string | null;
  tax_id: string | null;
  tax_mode: Generated<tax_mode>;
  tax_percentage: Generated<string>;
  /**
   * Play Store listing for this academy's app. Optional: shown in emails only when set.
   */
  android_app_url: string | null;
  /**
   * App Store listing for this academy's app. Optional: shown in emails only when set.
   */
  ios_app_url: string | null;
};
export type tenant_otp_codes = {
  id: string;
  tenant_id: string;
  identifier: string;
  code: string;
  channel: string;
  expires_at: Timestamp;
  verified: Generated<boolean>;
  attempts: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type tenant_page_revisions = {
  id: string;
  tenant_id: string;
  page_id: string;
  custom_html: string;
  custom_code_kind: custom_code_kind | null;
  label: string | null;
  created_by: string | null;
  created_at: Generated<Timestamp>;
};
export type tenant_pages = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  sections: unknown;
  theme: unknown;
  seo: unknown;
  is_published: Generated<boolean>;
  published_at: Timestamp | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  custom_assets: unknown | null;
  custom_code_kind: custom_code_kind | null;
  custom_html: string | null;
  custom_html_draft: string | null;
  moderation_status: Generated<page_moderation_status>;
  render_mode: Generated<page_render_mode>;
  custom_code_kind_draft: custom_code_kind | null;
};
export type tenant_password_resets = {
  id: string;
  tenant_id: string | null;
  email: string;
  token: string;
  expires_at: Timestamp;
  used: Generated<boolean>;
  created_at: Generated<Timestamp>;
};
export type tenant_permissions = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Timestamp;
};
export type tenant_role_permissions = {
  role_id: string;
  permission_id: string;
  created_at: Generated<Timestamp>;
};
export type tenant_roles = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
  tenant_id: string | null;
};
export type tenant_staff_memberships = {
  id: string;
  tenant_id: string;
  user_id: string;
  status: Generated<staff_membership_status>;
  invited_by: string | null;
  invited_at: Timestamp | null;
  joined_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type tenant_subscription_events = {
  id: string;
  tenant_id: string;
  subscription_id: string;
  event_type: string;
  gateway_event_id: string | null;
  previous_status: string | null;
  new_status: string;
  gateway_payment_id: string | null;
  amount: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
};
export type tenant_subscription_plans = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  billing_cycle: billing_cycle;
  currency: string;
  amount: string;
  amount_in_smallest: number;
  gateway_plan_id: string | null;
  gateway_provider: Generated<string>;
  is_active: Generated<boolean>;
  trial_days: Generated<number>;
  features_summary: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_subscription_settings = {
  id: string;
  tenant_id: string;
  is_enabled: Generated<boolean>;
  grace_period_days: Generated<number>;
  reminder_days_before: unknown | null;
  dunning_email_interval_hours: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  subscription_name: string | null;
  page_config: unknown | null;
};
export type tenant_usage_counters = {
  id: string;
  tenant_id: string;
  product_code: string;
  scope_type: Generated<string>;
  scope_id: Generated<string>;
  window_type: Generated<string>;
  window_start: Timestamp | null;
  current_value: Generated<number>;
  last_reconciled_at: Timestamp | null;
  reconciled_value: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_usage_events = {
  id: string;
  tenant_id: string;
  product_code: string;
  scope_type: Generated<string>;
  scope_id: Generated<string>;
  event_type: string;
  delta: number;
  resulting_value: number | null;
  resource_type: string | null;
  resource_id: string | null;
  idempotency_key: string | null;
  reason: string | null;
  actor_type: Generated<string>;
  actor_id: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
};
export type tenant_user_roles = {
  role_id: string;
  assigned_at: Generated<Timestamp>;
  assigned_by: string | null;
  membership_id: string;
};
export type tenant_user_subscriptions = {
  id: string;
  tenant_id: string;
  member_id: string;
  plan_id: string;
  gateway_connection_id: string;
  gateway_subscription_id: string | null;
  gateway_customer_id: string | null;
  gateway_provider: Generated<string>;
  plan_name_snapshot: string;
  billing_cycle_snapshot: string;
  amount_snapshot: string;
  currency_snapshot: string;
  status: Generated<tenant_subscription_status>;
  current_period_start: Timestamp | null;
  current_period_end: Timestamp | null;
  trial_ends_at: Timestamp | null;
  grace_period_ends_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  cancel_at_period_end: Generated<boolean>;
  ended_at: Timestamp | null;
  paused_at: Timestamp | null;
  last_payment_at: Timestamp | null;
  last_payment_amount: string | null;
  next_charge_at: Timestamp | null;
  payment_failure_count: Generated<number>;
  last_dunning_email_at: Timestamp | null;
  short_url: string | null;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tenant_users = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  status: Generated<tenant_user_status>;
  email_verified: Generated<boolean>;
  last_login_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  designation: string | null;
  last_login_ip: string | null;
  login_count: Generated<number>;
  phone: string | null;
  phone_verified: Generated<boolean>;
  profile_completed_at: Timestamp | null;
  signup_city: string | null;
  signup_country: string | null;
  signup_ip: string | null;
  signup_referrer: string | null;
  signup_user_agent: string | null;
  signup_utm: unknown | null;
  timezone: string | null;
  creator_intent_profile: unknown | null;
  signup_quiz_answers: unknown | null;
  preferred_locale: string | null;
};
export type tenant_watch_time_daily = {
  tenant_id: string;
  date: Timestamp;
  course_id: string;
  lecture_id: string;
  total_seconds: Generated<string>;
  sessions_count: Generated<number>;
  distinct_members_count: Generated<number>;
  avg_completion_pct: Generated<number>;
  updated_at: Generated<Timestamp>;
};
export type tenants = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  owner_user_id: string;
  status: Generated<tenant_status>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  layout: unknown | null;
  certificate_template: string | null;
  certificate_template_published: Generated<boolean>;
  certificate_logo: string | null;
  onboarding_checklist_dismissed_at: Timestamp | null;
  email_marketing_blocked_reason: string | null;
  email_sending_status: Generated<email_sending_tenant_status>;
  email_sending_status_changed_at: Timestamp | null;
  email_tps_override: string | null;
  access_managed_enabled: Generated<boolean>;
  access_managed_enabled_at: Timestamp | null;
  access_managed_enabled_by_user_id: string | null;
  certificate_tab_enabled: Generated<boolean>;
  enrolled_courses_only_enabled: Generated<boolean>;
  enrolled_courses_only_enabled_at: Timestamp | null;
  enrolled_courses_only_enabled_by_user_id: string | null;
  sequential_courses_enabled: Generated<boolean>;
  sequential_courses_enabled_at: Timestamp | null;
  sequential_courses_enabled_by_user_id: string | null;
  ordered_products_enabled: Generated<boolean>;
  ordered_products_enabled_at: Timestamp | null;
  ordered_products_enabled_by_user_id: string | null;
  default_locale: Generated<string>;
  multi_language_enabled: Generated<boolean>;
};
export type test_attempt_answers = {
  id: string;
  tenant_id: string;
  attempt_id: string;
  question_id: string;
  answer: unknown | null;
  time_spent_sec: Generated<number>;
  marked_for_review: Generated<boolean>;
  is_correct: boolean | null;
  marks_awarded: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  graded_at: Timestamp | null;
  graded_by: string | null;
  grader_remarks: string | null;
  grading_status: Generated<test_answer_grading_status>;
};
export type test_attempt_modules = {
  id: string;
  tenant_id: string;
  attempt_id: string;
  module_id: string;
  section_id: string;
  stage_no: number;
  variant: string;
  order_index: number;
  status: Generated<test_attempt_module_status>;
  question_ids: Generated<string[]>;
  pretest_ids: Generated<string[]>;
  time_limit_sec: number;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  raw_correct: number | null;
  raw_score: string | null;
  routed_to_variant: string | null;
  auto_completed: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_attempts = {
  id: string;
  tenant_id: string;
  learner_id: string;
  test_id: string;
  test_series_id: string;
  started_at: Generated<Timestamp>;
  submitted_at: Timestamp | null;
  time_remaining_sec: number | null;
  status: Generated<test_attempt_status>;
  score: string | null;
  percentage: string | null;
  percentile: string | null;
  rank: number | null;
  predicted_rank_min: number | null;
  predicted_rank_max: number | null;
  analytics: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
  question_ids: Generated<string[]>;
  scaled_score: string | null;
  scaled_score_max: number | null;
  proctoring_flags: unknown | null;
  tab_switch_count: Generated<number>;
  break_ends_at: Timestamp | null;
  grading_status: Generated<test_attempt_grading_status>;
  total_marks: string | null;
};
export type test_bookmarks = {
  id: string;
  tenant_id: string;
  learner_id: string;
  question_id: string;
  attempt_id: string | null;
  note: string | null;
  created_at: Generated<Timestamp>;
};
export type test_certificates = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  test_id: string | null;
  test_series_id: string | null;
  attempt_id: string | null;
  certificate_number: string;
  template_id: string | null;
  status: Generated<string>;
  issued_at: Generated<Timestamp>;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  template_snapshot: unknown | null;
};
export type test_coupons = {
  id: string;
  tenant_id: string;
  test_series_id: string | null;
  code: string;
  type: coupon_discount_type;
  value: string;
  max_uses: number | null;
  used_count: Generated<number>;
  expires_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_exam_rank_curves = {
  id: string;
  tenant_id: string;
  exam_name: string;
  year: number;
  total_candidates: number;
  curve: unknown;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_module_questions = {
  id: string;
  tenant_id: string;
  test_id: string;
  module_id: string;
  question_id: string;
  is_pretest: Generated<boolean>;
  order_index: Generated<number>;
  created_at: Generated<Timestamp>;
};
export type test_module_score_scales = {
  id: string;
  tenant_id: string;
  test_id: string;
  section_id: string;
  path_key: string;
  scale: unknown;
  scale_max: number;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_modules = {
  id: string;
  tenant_id: string;
  test_id: string;
  section_id: string;
  stage_no: number;
  variant: string;
  difficulty_rank: Generated<number>;
  question_count: number;
  pretest_count: Generated<number>;
  time_limit_min: number;
  routing_rules: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_norm_tables = {
  id: string;
  tenant_id: string;
  test_id: string;
  points: unknown;
  max_score: number;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_question_banks = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type test_questions = {
  id: string;
  tenant_id: string;
  question_bank_id: string;
  type: test_question_type;
  stem: unknown;
  options: unknown | null;
  correct_answer: unknown | null;
  explanation: string | null;
  marks: Generated<string>;
  negative_marks: Generated<string>;
  difficulty: Generated<test_question_difficulty>;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  source: string | null;
  status: Generated<test_question_status>;
  created_via: Generated<test_question_created_via>;
  ai_metadata: unknown | null;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  chapter_node_id: string | null;
  subject_node_id: string | null;
  topic_node_id: string | null;
};
export type test_scholarship_awards = {
  id: string;
  tenant_id: string;
  scholarship_id: string;
  member_id: string;
  attempt_id: string | null;
  tier_label: string | null;
  amount: string | null;
  currency: string | null;
  score: string | null;
  status: Generated<string>;
  flagged_at: Generated<Timestamp>;
  decided_by: string | null;
  decided_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type test_scholarships = {
  id: string;
  tenant_id: string;
  test_id: string | null;
  test_series_id: string | null;
  name: string;
  description: string | null;
  basis: Generated<string>;
  tiers: unknown;
  max_awardees: number | null;
  status: Generated<string>;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type test_section_questions = {
  id: string;
  tenant_id: string;
  test_id: string;
  section_id: string;
  question_id: string;
  order_index: Generated<number>;
  marks_override: string | null;
  created_at: Generated<Timestamp>;
};
export type test_sections = {
  id: string;
  tenant_id: string;
  test_id: string;
  name: string;
  instructions: string | null;
  time_limit_min: number | null;
  order_index: Generated<number>;
  marking_scheme: unknown | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  break_after_sec: number | null;
  question_selection: unknown | null;
  question_bank_id: string | null;
  random_question_count: number | null;
};
export type test_series = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_key: string | null;
  category: string | null;
  pricing_type: Generated<test_series_pricing_type>;
  price_inr: string | null;
  price_usd: string | null;
  currency: Generated<string | null>;
  validity_days: number | null;
  end_date: Timestamp | null;
  visibility: Generated<test_series_visibility>;
  access_mode: Generated<test_series_access_mode>;
  status: Generated<test_status>;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  discount_inr: string | null;
  discount_usd: string | null;
  sort_order: Generated<number>;
};
export type test_series_enrollments = {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  test_series_id: string;
  status: Generated<test_series_enrollment_status>;
  source: Generated<test_series_enrollment_source>;
  source_coupon_id: string | null;
  enrolled_at: Generated<Timestamp>;
  valid_till: Timestamp | null;
  payment_id: string | null;
  amount_paid: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type test_series_tests = {
  id: string;
  tenant_id: string;
  test_series_id: string;
  test_id: string;
  order_index: Generated<number>;
  is_free_preview: Generated<boolean>;
  created_at: Generated<Timestamp>;
};
export type test_taxonomy_nodes = {
  id: string;
  tenant_id: string;
  kind: test_taxonomy_kind;
  parent_id: string | null;
  name: string;
  order_index: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type testimonials = {
  id: string;
  tenant_id: string;
  tenant_member_id: string | null;
  name: string;
  text: string | null;
  image_url: string | null;
  social_links: unknown | null;
  rating: number | null;
  status: Generated<testimonial_status>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
};
export type tests = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  cover_image_key: string | null;
  duration_min: number;
  total_marks: Generated<string>;
  status: Generated<test_status>;
  shuffle_questions: Generated<boolean>;
  shuffle_options: Generated<boolean>;
  show_solutions: Generated<test_show_solutions>;
  allow_reattempt: Generated<boolean>;
  pass_criteria_pct: string | null;
  target_exam: string | null;
  target_rank_curve_id: string | null;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  random_question_count: number | null;
  mode: Generated<test_mode>;
  max_attempts: number | null;
  calculator_mode: Generated<string>;
  proctor_camera: Generated<boolean>;
  proctor_max_tab_switches: number | null;
  proctoring_enabled: Generated<boolean>;
  proctor_mic: Generated<boolean>;
  proctor_fullscreen: Generated<boolean>;
  proctor_block_copy_paste: Generated<boolean>;
  proctor_action: Generated<string>;
  available_from: Timestamp | null;
  available_until: Timestamp | null;
  certificate_enabled: Generated<boolean>;
  certificate_template_id: string | null;
  certificate_min_score_pct: string | null;
};
export type usage_events = {
  id: string;
  tenant_id: string;
  feature_key: string;
  product_code: string;
  event_type: usage_event_type;
  amount: Generated<number>;
  resource_type: string | null;
  resource_id: string | null;
  idempotency_key: string | null;
  created_at: Generated<Timestamp>;
};
export type watch_time_rollup_state = {
  tenant_id: string;
  last_rollup_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type DB = {
  addon_subscriptions: addon_subscriptions;
  addons: addons;
  admin_audit_logs: admin_audit_logs;
  admin_permissions: admin_permissions;
  admin_role_permissions: admin_role_permissions;
  admin_roles: admin_roles;
  admin_user_roles: admin_user_roles;
  admin_users: admin_users;
  applications: applications;
  assignment_evaluations: assignment_evaluations;
  assignment_submissions: assignment_submissions;
  assignments: assignments;
  batch_enrollments: batch_enrollments;
  batch_items: batch_items;
  batch_leaderboard_snapshots: batch_leaderboard_snapshots;
  batches: batches;
  billing_providers: billing_providers;
  billing_webhooks: billing_webhooks;
  book_access: book_access;
  book_authors: book_authors;
  book_categories: book_categories;
  book_conversions: book_conversions;
  book_recommendations: book_recommendations;
  books: books;
  bulk_certificates: bulk_certificates;
  bundle_items: bundle_items;
  bundles: bundles;
  cart_items: cart_items;
  cart_order_items: cart_order_items;
  categories: categories;
  certificate_batches: certificate_batches;
  certificate_templates: certificate_templates;
  certificates: certificates;
  content_prices: content_prices;
  content_product_links: content_product_links;
  content_translations: content_translations;
  coupon_applicable_items: coupon_applicable_items;
  coupon_redemptions: coupon_redemptions;
  coupons: coupons;
  course_categories: course_categories;
  course_faqs: course_faqs;
  course_instructors: course_instructors;
  course_lessons: course_lessons;
  course_recommendations: course_recommendations;
  course_review_votes: course_review_votes;
  course_reviews: course_reviews;
  course_sections: course_sections;
  course_syllabus_items: course_syllabus_items;
  course_syllabus_sections: course_syllabus_sections;
  courses: courses;
  enrollments: enrollments;
  entitlement_overrides: entitlement_overrides;
  entitlements: entitlements;
  features: features;
  instructor_experiences: instructor_experiences;
  instructor_socials: instructor_socials;
  instructors: instructors;
  invoices: invoices;
  lecture_dropoff_buckets: lecture_dropoff_buckets;
  lecture_watch_sessions: lecture_watch_sessions;
  lectures: lectures;
  lesson_resources: lesson_resources;
  member_assignment_progress: member_assignment_progress;
  member_book_highlights: member_book_highlights;
  member_book_page_bookmarks: member_book_page_bookmarks;
  member_book_progress: member_book_progress;
  member_bookmarks: member_bookmarks;
  member_lecture_progress: member_lecture_progress;
  member_lesson_progress: member_lesson_progress;
  member_notifications: member_notifications;
  member_payment_details: member_payment_details;
  member_quiz_progress: member_quiz_progress;
  payment_orders: payment_orders;
  payment_receipt_counters: payment_receipt_counters;
  payment_receipt_items: payment_receipt_items;
  payment_receipts: payment_receipts;
  payment_webhook_events: payment_webhook_events;
  pending_subscription_checkouts: pending_subscription_checkouts;
  plan_applications: plan_applications;
  plan_version_billing_mappings: plan_version_billing_mappings;
  plan_version_products: plan_version_products;
  plan_versions: plan_versions;
  plans: plans;
  platform_exchange_rates: platform_exchange_rates;
  platform_notification_suppressions: platform_notification_suppressions;
  products: products;
  question_serve_stats: question_serve_stats;
  question_upload_assets: question_upload_assets;
  quiz_attempt_answers: quiz_attempt_answers;
  quiz_attempts: quiz_attempts;
  quiz_options: quiz_options;
  quiz_questions: quiz_questions;
  quizzes: quizzes;
  refunds: refunds;
  subscription_events: subscription_events;
  subscriptions: subscriptions;
  tenant_active_learners_daily: tenant_active_learners_daily;
  tenant_addon_events: tenant_addon_events;
  tenant_addons: tenant_addons;
  tenant_admin_otp_codes: tenant_admin_otp_codes;
  tenant_admin_signup_otp_codes: tenant_admin_signup_otp_codes;
  tenant_application_events: tenant_application_events;
  tenant_applications: tenant_applications;
  tenant_audit_logs: tenant_audit_logs;
  tenant_auth_config: tenant_auth_config;
  tenant_bulk_imports: tenant_bulk_imports;
  tenant_certificate_assignments: tenant_certificate_assignments;
  tenant_currencies: tenant_currencies;
  tenant_domains: tenant_domains;
  tenant_email_domain_health_checks: tenant_email_domain_health_checks;
  tenant_email_messages: tenant_email_messages;
  tenant_email_reputation_events: tenant_email_reputation_events;
  tenant_email_sender_identities: tenant_email_sender_identities;
  tenant_email_sending_domains: tenant_email_sending_domains;
  tenant_email_suppressions: tenant_email_suppressions;
  tenant_gateway_connections: tenant_gateway_connections;
  tenant_locales: tenant_locales;
  tenant_member_form_config: tenant_member_form_config;
  tenant_member_form_responses: tenant_member_form_responses;
  tenant_member_sessions: tenant_member_sessions;
  tenant_members: tenant_members;
  tenant_nav_items: tenant_nav_items;
  tenant_nudge_dismissals: tenant_nudge_dismissals;
  tenant_org_details: tenant_org_details;
  tenant_otp_codes: tenant_otp_codes;
  tenant_page_revisions: tenant_page_revisions;
  tenant_pages: tenant_pages;
  tenant_password_resets: tenant_password_resets;
  tenant_permissions: tenant_permissions;
  tenant_role_permissions: tenant_role_permissions;
  tenant_roles: tenant_roles;
  tenant_staff_memberships: tenant_staff_memberships;
  tenant_subscription_events: tenant_subscription_events;
  tenant_subscription_plans: tenant_subscription_plans;
  tenant_subscription_settings: tenant_subscription_settings;
  tenant_usage_counters: tenant_usage_counters;
  tenant_usage_events: tenant_usage_events;
  tenant_user_roles: tenant_user_roles;
  tenant_user_subscriptions: tenant_user_subscriptions;
  tenant_users: tenant_users;
  tenant_watch_time_daily: tenant_watch_time_daily;
  tenants: tenants;
  test_attempt_answers: test_attempt_answers;
  test_attempt_modules: test_attempt_modules;
  test_attempts: test_attempts;
  test_bookmarks: test_bookmarks;
  test_certificates: test_certificates;
  test_coupons: test_coupons;
  test_exam_rank_curves: test_exam_rank_curves;
  test_module_questions: test_module_questions;
  test_module_score_scales: test_module_score_scales;
  test_modules: test_modules;
  test_norm_tables: test_norm_tables;
  test_question_banks: test_question_banks;
  test_questions: test_questions;
  test_scholarship_awards: test_scholarship_awards;
  test_scholarships: test_scholarships;
  test_section_questions: test_section_questions;
  test_sections: test_sections;
  test_series: test_series;
  test_series_enrollments: test_series_enrollments;
  test_series_tests: test_series_tests;
  test_taxonomy_nodes: test_taxonomy_nodes;
  testimonials: testimonials;
  tests: tests;
  usage_events: usage_events;
  watch_time_rollup_state: watch_time_rollup_state;
};
