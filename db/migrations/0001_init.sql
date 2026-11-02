-- CreateEnum
CREATE TYPE "addon_subscription_status" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "admin_user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "assignment_content_type" AS ENUM ('TEXT', 'PDF');

-- CreateEnum
CREATE TYPE "assignment_scope" AS ENUM ('COURSE', 'SECTION', 'LESSON');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "batch_item_type" AS ENUM ('COURSE', 'BOOK');

-- CreateEnum
CREATE TYPE "batch_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'YEARLY', 'TWO_YEARLY');

-- CreateEnum
CREATE TYPE "book_conversion_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "book_file_format" AS ENUM ('EPUB', 'PDF');

-- CreateEnum
CREATE TYPE "book_source_type" AS ENUM ('PDF');

-- CreateEnum
CREATE TYPE "book_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "bookmark_type" AS ENUM ('COURSE', 'BOOK', 'BUNDLE');

-- CreateEnum
CREATE TYPE "bundle_item_type" AS ENUM ('COURSE', 'BOOK', 'BATCH', 'TEST_SERIES');

-- CreateEnum
CREATE TYPE "bundle_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "cart_item_type" AS ENUM ('COURSE', 'BOOK', 'BUNDLE', 'BATCH');

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('ISSUED', 'REVOKED');

-- CreateEnum
CREATE TYPE "constraint_type" AS ENUM ('BOOLEAN', 'COUNT', 'LIMIT');

-- CreateEnum
CREATE TYPE "content_discount_type" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "coupon_discount_type" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "course_difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NONE');

-- CreateEnum
CREATE TYPE "course_mode" AS ENUM ('SELF_PACED');

-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "course_type" AS ENUM ('NORMAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "custom_code_kind" AS ENUM ('SANITIZED_INLINE', 'SANDBOXED_IFRAME');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "domain_status" AS ENUM ('PENDING_VERIFICATION', 'PENDING_SSL', 'ACTIVE', 'FAILED', 'REMOVING', 'REDIRECT');

-- CreateEnum
CREATE TYPE "domain_type" AS ENUM ('SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "email_message_category" AS ENUM ('TRANSACTIONAL', 'NOTIFICATION', 'MARKETING');

-- CreateEnum
CREATE TYPE "email_message_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'REJECTED', 'FAILED', 'SUPPRESSED', 'FROZEN');

-- CreateEnum
CREATE TYPE "email_reputation_event_trigger" AS ENUM ('AUTO_BOUNCE', 'AUTO_COMPLAINT', 'AUTO_RECOVERY', 'ADMIN_OVERRIDE', 'EMERGENCY_BRAKE');

-- CreateEnum
CREATE TYPE "email_sender_identity_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "email_sending_domain_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "email_sending_tenant_status" AS ENUM ('ACTIVE', 'WARNING', 'THROTTLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "email_suppression_reason" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'MANUAL_UNSUBSCRIBE', 'ADMIN_BLOCK', 'IMPORTED');

-- CreateEnum
CREATE TYPE "enrollment_source" AS ENUM ('PURCHASED', 'FREE', 'ADMIN_GRANT', 'BUNDLE', 'COUPON', 'SUBSCRIPTION', 'BATCH');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "entitlement_sources" AS ENUM ('PLAN', 'ADMIN', 'ADDON', 'PROMO');

-- CreateEnum
CREATE TYPE "gateway_connection_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "gateway_mode" AS ENUM ('SELF_MANAGED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('GENERATED', 'VOIDED');

-- CreateEnum
CREATE TYPE "invoice_type" AS ENUM ('PLAN_SUBSCRIPTION', 'USER_PURCHASE');

-- CreateEnum
CREATE TYPE "lesson_resource_type" AS ENUM ('PDF', 'PPT', 'LINK', 'TEXT', 'IMAGE', 'GITHUB');

-- CreateEnum
CREATE TYPE "lesson_type" AS ENUM ('LECTURE', 'QUIZ', 'ASSIGNMENT', 'PDF', 'PPT', 'LINK', 'TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "linkable_content_type" AS ENUM ('COURSE', 'BOOK', 'BUNDLE', 'PRODUCT_HUB_ITEM', 'TEST_SERIES', 'BATCH');

-- CreateEnum
CREATE TYPE "member_notification_type" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_REMINDER', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'PURCHASE_CONFIRMED', 'DM_REPLIED', 'ENROLLMENT_NEW', 'LESSON_PUBLISHED', 'ASSIGNMENT_GRADED', 'CERTIFICATE_AVAILABLE', 'SYSTEM', 'WORKSHOP_NEW_SESSION', 'DM_NEW_MESSAGE', 'DM_THREAD_CLOSED', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "member_payment_detail_type" AS ENUM ('UPI', 'BANK_TRANSFER', 'PAYPAL');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "offering_type" AS ENUM ('COURSE', 'BOOK', 'TEST_SERIES');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUND_INITIATED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "order_type" AS ENUM ('COURSE', 'BOOK', 'BUNDLE', 'CART', 'BATCH', 'TEST_SERIES');

-- CreateEnum
CREATE TYPE "orientation" AS ENUM ('landscape', 'portrait', 'square');

-- CreateEnum
CREATE TYPE "page_moderation_status" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "page_render_mode" AS ENUM ('SECTIONS', 'CUSTOM_CODE');

-- CreateEnum
CREATE TYPE "payment_receipt_status" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_webhook_status" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "plan_type" AS ENUM ('SINGLE_APP', 'BUNDLE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "price_entity_type" AS ENUM ('COURSE', 'BOOK', 'BUNDLE', 'BATCH', 'TEST_SERIES');

-- CreateEnum
CREATE TYPE "pricing_frequency" AS ENUM ('MONTHLY', 'YEARLY', 'BOTH', 'TWO_YEARLY', 'ALL');

-- CreateEnum
CREATE TYPE "purchase_mode" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "quiz_attempt_status" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "quiz_question_type" AS ENUM ('MCQ', 'DRAG_DROP');

-- CreateEnum
CREATE TYPE "quiz_scope" AS ENUM ('COURSE', 'SECTION', 'LESSON');

-- CreateEnum
CREATE TYPE "quiz_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "staff_membership_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');

-- CreateEnum
CREATE TYPE "submission_content_type" AS ENUM ('TEXT', 'PDF');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'EVALUATED', 'RESUBMISSION_REQUESTED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIALING');

-- CreateEnum
CREATE TYPE "tax_mode" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "tenant_addon_event_type" AS ENUM ('PURCHASED', 'ADMIN_GRANTED_PAID', 'ADMIN_GRANTED_FREE', 'ACTIVATED', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'RENEWED', 'UPGRADED');

-- CreateEnum
CREATE TYPE "tenant_addon_source" AS ENUM ('PURCHASED', 'ADMIN_PAID', 'ADMIN_FREE');

-- CreateEnum
CREATE TYPE "tenant_addon_status" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "tenant_app_event_type" AS ENUM ('ACTIVATED', 'SUSPENDED', 'UNSUSPENDED', 'TRIAL_STARTED', 'TRIAL_EXTENDED', 'TRIAL_EXPIRED', 'CANCELLED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "tenant_app_source" AS ENUM ('SUBSCRIPTION', 'ADMIN_TRIAL', 'ADMIN_GRANT', 'PROMO');

-- CreateEnum
CREATE TYPE "tenant_app_status" AS ENUM ('ACTIVE', 'TRIALING', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tenant_bulk_import_scope_type" AS ENUM ('TENANT', 'COURSE', 'BOOK', 'BATCH', 'TEST_SERIES', 'BUNDLE');

-- CreateEnum
CREATE TYPE "tenant_bulk_import_source" AS ENUM ('CSV', 'SELECT_EXISTING');

-- CreateEnum
CREATE TYPE "tenant_bulk_import_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tenant_subscription_status" AS ENUM ('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'PAUSED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "tenant_user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'INVITED');

-- CreateEnum
CREATE TYPE "test_answer_grading_status" AS ENUM ('AUTO_GRADED', 'PENDING_REVIEW', 'MANUALLY_GRADED');

-- CreateEnum
CREATE TYPE "test_attempt_grading_status" AS ENUM ('NOT_REQUIRED', 'PENDING_REVIEW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "test_attempt_module_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "test_attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'ON_BREAK');

-- CreateEnum
CREATE TYPE "test_mode" AS ENUM ('STANDARD', 'ADAPTIVE');

-- CreateEnum
CREATE TYPE "test_question_created_via" AS ENUM ('MANUAL', 'IMPORT', 'AI');

-- CreateEnum
CREATE TYPE "test_question_difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "test_question_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "test_question_type" AS ENUM ('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'FIB', 'NAT', 'DRAG_DROP', 'DESCRIPTIVE');

-- CreateEnum
CREATE TYPE "test_series_access_mode" AS ENUM ('SEQUENTIAL', 'OPEN');

-- CreateEnum
CREATE TYPE "test_series_enrollment_source" AS ENUM ('PURCHASED', 'ADMIN_GRANT', 'FREE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "test_series_enrollment_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "test_series_pricing_type" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "test_series_visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "test_show_solutions" AS ENUM ('IMMEDIATE', 'AFTER_SERIES_END', 'NEVER');

-- CreateEnum
CREATE TYPE "test_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "test_taxonomy_kind" AS ENUM ('SUBJECT', 'CHAPTER', 'TOPIC');

-- CreateEnum
CREATE TYPE "testimonial_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "usage_event_type" AS ENUM ('CONSUME', 'RELEASE', 'RESET');

-- CreateEnum
CREATE TYPE "usage_scope_type" AS ENUM ('TENANT', 'USER');

-- CreateEnum
CREATE TYPE "usage_window_type" AS ENUM ('LIFETIME', 'MONTHLY', 'YEARLY', 'DAILY');

-- CreateEnum
CREATE TYPE "video_processing_status" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "video_provider" AS ENUM ('YOUTUBE', 'EVS', 'HLS', 'MP4');

-- CreateEnum
CREATE TYPE "vote_type" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "webhook_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "translatable_entity_type" AS ENUM ('COURSE', 'BOOK', 'CATEGORY', 'BUNDLE', 'PAGE');

-- CreateTable
CREATE TABLE "addon_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "addon_id" TEXT NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL,
    "original_price" DECIMAL(10,2) NOT NULL,
    "discount_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_snapshot" DECIMAL(10,2) NOT NULL,
    "billing_provider_id" TEXT,
    "external_subscription_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "status" "addon_subscription_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addons" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "product_id" TEXT NOT NULL,
    "grant_value" INTEGER NOT NULL,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "price_monthly_inr" DECIMAL(10,2) NOT NULL,
    "price_yearly_inr" DECIMAL(10,2) NOT NULL,
    "discount_monthly_inr_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_monthly_inr_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_yearly_inr_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_yearly_inr_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_monthly_usd" DECIMAL(10,2) NOT NULL,
    "price_yearly_usd" DECIMAL(10,2) NOT NULL,
    "discount_monthly_usd_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_monthly_usd_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_yearly_usd_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_yearly_usd_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_admin_id" TEXT,
    "actor_email" TEXT,
    "actor_name" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "resource_id" TEXT,
    "resource_label" TEXT,
    "tenant_id" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user_roles" (
    "admin_user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "admin_user_roles_pkey" PRIMARY KEY ("admin_user_id","role_id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "oauth_provider" TEXT,
    "oauth_provider_id" TEXT,
    "status" "admin_user_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "config" JSONB,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_evaluations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "feedback" TEXT,
    "evaluated_by" TEXT NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "content_type" "submission_content_type" NOT NULL DEFAULT 'TEXT',
    "text_content" TEXT,
    "pdf_key" TEXT,
    "status" "submission_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "resource_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "content_type" "assignment_content_type" NOT NULL DEFAULT 'TEXT',
    "due_date" TIMESTAMP(3),
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "pdf_key" TEXT,
    "scope" "assignment_scope" NOT NULL DEFAULT 'LESSON',
    "section_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "source_lecture_id" TEXT,
    "status" "assignment_status" NOT NULL DEFAULT 'DRAFT',
    "passing_score" INTEGER,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_enrollments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_till" TIMESTAMP(3),
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "source" "enrollment_source" NOT NULL DEFAULT 'PURCHASED',
    "source_order_id" TEXT,
    "source_coupon_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "item_type" "batch_item_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participants" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "cover_image_url" TEXT,
    "preview_url" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "enrollment_open_date" TIMESTAMP(3),
    "enrollment_close_date" TIMESTAMP(3),
    "duration_days" INTEGER,
    "validity_days" INTEGER,
    "price_inr" DECIMAL(10,2),
    "price_usd" DECIMAL(10,2),
    "discount_inr" DECIMAL(10,2),
    "discount_usd" DECIMAL(10,2),
    "purchase_mode" "purchase_mode" NOT NULL DEFAULT 'PAID',
    "status" "batch_status" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "total_enrollments" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "learning_outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mobile_thumbnail_key" TEXT,
    "web_thumbnail_key" TEXT,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_visible_to_tenant" BOOLEAN NOT NULL DEFAULT true,
    "credential_schema" JSONB,

    CONSTRAINT "billing_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_webhooks" (
    "id" TEXT NOT NULL,
    "billing_provider_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "webhook_status" NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_access" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "source" "enrollment_source" NOT NULL DEFAULT 'FREE',
    "source_bundle_id" TEXT,
    "source_coupon_id" TEXT,
    "valid_till" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "source_batch_id" TEXT,

    CONSTRAINT "book_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_authors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_conversions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "source_type" "book_source_type" NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "source_filename" TEXT NOT NULL,
    "source_size_bytes" BIGINT NOT NULL,
    "status" "book_conversion_status" NOT NULL DEFAULT 'PENDING',
    "job_id" TEXT,
    "output_url" TEXT,
    "output_key" TEXT,
    "output_size_bytes" BIGINT,
    "pipeline" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_recommendations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "recommended_book_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "pages" INTEGER,
    "url" TEXT,
    "page_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_inr" DECIMAL(10,2),
    "price_usd" DECIMAL(10,2),
    "discount_inr" DECIMAL(10,2),
    "discount_usd" DECIMAL(10,2),
    "purchase_mode" "purchase_mode" NOT NULL DEFAULT 'PAID',
    "status" "book_status" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT[] DEFAULT ARRAY['English']::TEXT[],
    "thumbnail_url" TEXT,
    "preview_url" TEXT,
    "summary" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rating" DECIMAL(3,2),
    "rating_total_count" INTEGER DEFAULT 0,
    "validity_days" INTEGER,
    "sample_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sample_pages" INTEGER,
    "file_format" "book_file_format" NOT NULL DEFAULT 'EPUB',

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "status" "certificate_status" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "emailed_at" TIMESTAMP(3),
    "tenant_member_id" TEXT,

    CONSTRAINT "bulk_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "item_type" "bundle_item_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "test_series_id" TEXT,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "price_inr" DECIMAL(10,2),
    "price_usd" DECIMAL(10,2),
    "discount_inr" DECIMAL(10,2),
    "discount_usd" DECIMAL(10,2),
    "thumbnail_url" TEXT,
    "preview_url" TEXT,
    "status" "bundle_status" NOT NULL DEFAULT 'DRAFT',
    "validity_days" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "purchase_mode" "purchase_mode" NOT NULL DEFAULT 'PAID',

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "item_type" "cart_item_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "bundle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "coupon_code" VARCHAR(50),
    "batch_id" TEXT,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_order_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_type" "cart_item_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "bundle_id" TEXT,
    "base_amount" DECIMAL(16,2) NOT NULL,
    "discount_amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(16,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coupon_code_snapshot" VARCHAR(50),
    "coupon_id" TEXT,
    "batch_id" TEXT,

    CONSTRAINT "cart_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "certificate_template_id" TEXT,
    "template_snapshot" JSONB,
    "signatory_name" TEXT,
    "signatory_title" TEXT,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "page_size" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "background_asset_url" TEXT,
    "layout" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "status" "certificate_status" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "emailed_at" TIMESTAMP(3),
    "certificate_template_id" TEXT,
    "template_snapshot" JSONB,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_prices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" "price_entity_type" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "discount_type" "content_discount_type" NOT NULL DEFAULT 'PERCENTAGE',

    CONSTRAINT "content_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_product_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "content_type" "linkable_content_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "bundle_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "batch_id" TEXT,

    CONSTRAINT "content_product_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_applicable_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "item_type" "bundle_item_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "bundle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "batch_id" TEXT,
    "test_series_id" TEXT,

    CONSTRAINT "coupon_applicable_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "discount_amount" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "coupon_discount_type" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "max_uses_per_user" INTEGER,
    "currency" VARCHAR(8),
    "is_public" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_faqs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_instructors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "lesson_type" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_recommendations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "recommended_course_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_review_votes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "vote_type" "vote_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_review_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_syllabus_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "syllabus_section_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "preview_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_syllabus_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_syllabus_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_syllabus_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "price_inr" DECIMAL(10,2),
    "price_usd" DECIMAL(10,2),
    "discount_inr" DECIMAL(10,2),
    "discount_usd" DECIMAL(10,2),
    "purchase_mode" "purchase_mode" NOT NULL DEFAULT 'PAID',
    "status" "course_status" NOT NULL DEFAULT 'DRAFT',
    "mode" "course_mode" NOT NULL DEFAULT 'SELF_PACED',
    "difficulty" "course_difficulty" NOT NULL DEFAULT 'BEGINNER',
    "language" TEXT[] DEFAULT ARRAY['English']::TEXT[],
    "duration" TEXT,
    "learning_outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "class_timing" TEXT,
    "start_date" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lms_settings" JSONB,
    "lms_template_id" TEXT,
    "preview_key" TEXT,
    "secondary_thumbnail_key" TEXT,
    "thumbnail_key" TEXT,
    "course_type" "course_type" NOT NULL DEFAULT 'NORMAL',
    "validity_days" INTEGER,
    "certificate_template_id" TEXT,
    "unlocks_after_type" "offering_type",
    "unlocks_after_id" TEXT,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "source" "enrollment_source" NOT NULL DEFAULT 'FREE',
    "source_bundle_id" TEXT,
    "source_coupon_id" TEXT,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "valid_till" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "source_batch_id" TEXT,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_overrides" (
    "id" TEXT NOT NULL,
    "entitlement_id" TEXT NOT NULL,
    "old_limit_value" INTEGER NOT NULL,
    "new_limit_value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "application_code" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "limit_value" INTEGER NOT NULL,
    "used_value" INTEGER NOT NULL DEFAULT 0,
    "source" "entitlement_sources" NOT NULL DEFAULT 'PLAN',
    "source_subscription_id" TEXT,
    "source_plan_version_id" TEXT,
    "source_addon_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "category" TEXT,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_navigable" BOOLEAN NOT NULL DEFAULT false,
    "nav_icon" TEXT,
    "nav_label" TEXT,
    "nav_route" TEXT,
    "nav_sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_experiences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "company_logo" TEXT,
    "years" INTEGER NOT NULL,
    "details" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_socials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "linkedin_url" TEXT,
    "twitter_url" TEXT,
    "youtube_url" TEXT,
    "github_url" TEXT,
    "website_url" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_socials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "bio" TEXT,
    "expertise" TEXT,
    "profile_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_type" "invoice_type" NOT NULL,
    "subscription_id" TEXT,
    "order_id" TEXT,
    "member_id" TEXT,
    "currency" VARCHAR(10) NOT NULL,
    "subtotal" DECIMAL(16,2) NOT NULL,
    "tax_amount" DECIMAL(16,2) NOT NULL,
    "total_amount" DECIMAL(16,2) NOT NULL,
    "invoice_url" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "payment_method" TEXT,
    "transaction_id" TEXT,
    "status" "invoice_status" NOT NULL DEFAULT 'GENERATED',
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_dropoff_buckets" (
    "tenant_id" TEXT NOT NULL,
    "lecture_id" TEXT NOT NULL,
    "bucket_index" INTEGER NOT NULL,
    "sessions_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_dropoff_buckets_pkey" PRIMARY KEY ("tenant_id","lecture_id","bucket_index")
);

-- CreateTable
CREATE TABLE "lecture_watch_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lecture_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "start_position" INTEGER NOT NULL DEFAULT 0,
    "end_position" INTEGER NOT NULL DEFAULT 0,
    "seconds_watched" BIGINT NOT NULL DEFAULT 0,
    "device_type" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_watch_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectures" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" TEXT,
    "processing_status" "video_processing_status" NOT NULL DEFAULT 'PROCESSING',
    "resource_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "video_key" TEXT,
    "video_provider" "video_provider",

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "type" "lesson_resource_type" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "downloadable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_assignment_progress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "course_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_assignment_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_book_highlights" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "cfi_range" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FFEB3B',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_book_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_book_page_bookmarks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "cfi_location" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_book_page_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_book_progress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "last_page" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,

    CONSTRAINT "member_book_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_bookmarks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "bookmark_type" "bookmark_type" NOT NULL,
    "course_id" TEXT,
    "book_id" TEXT,
    "bundle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_lecture_progress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lecture_id" TEXT NOT NULL,
    "watched_duration" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "last_watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "total_watch_seconds" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "member_lecture_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_lesson_progress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_notifications" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "member_id" VARCHAR(26) NOT NULL,
    "type" "member_notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_payment_details" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "type" "member_payment_detail_type" NOT NULL,
    "upi_vpa" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "bank_name" TEXT,
    "account_holder_name" TEXT,
    "pan_number" TEXT,
    "paypal_email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_payment_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_quiz_progress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "course_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_quiz_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "gateway_connection_id" TEXT,
    "order_number" TEXT NOT NULL,
    "order_type" "order_type" NOT NULL,
    "item_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "base_amount" DECIMAL(16,2) NOT NULL,
    "discount_amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "coupon_id" TEXT,
    "coupon_code_snapshot" TEXT,
    "net_amount" DECIMAL(16,2) NOT NULL,
    "tax_amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(16,2) NOT NULL,
    "platform_fee" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "tenant_payout_amount" DECIMAL(16,2),
    "gateway_provider_name" TEXT NOT NULL,
    "gateway_order_id" TEXT,
    "gateway_payment_id" TEXT,
    "gateway_signature" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'CREATED',
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "idempotency_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fx_rate_to_tenant_default" DECIMAL(18,8),
    "resolved_country" VARCHAR(2),
    "tenant_default_currency" VARCHAR(8),

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipt_counters" (
    "fiscal_year" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_receipt_counters_pkey" PRIMARY KEY ("fiscal_year")
);

-- CreateTable
CREATE TABLE "payment_receipt_items" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL DEFAULT 0,
    "line_total" BIGINT NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT,
    "status" "payment_receipt_status" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "tenant_id" TEXT,
    "buyer_name" TEXT NOT NULL,
    "buyer_legal_name" TEXT,
    "buyer_email" TEXT,
    "buyer_phone" TEXT,
    "buyer_address_line1" TEXT,
    "buyer_address_line2" TEXT,
    "buyer_city" TEXT,
    "buyer_state" TEXT,
    "buyer_country" TEXT DEFAULT 'India',
    "buyer_postal_code" TEXT,
    "buyer_gstin" TEXT,
    "buyer_pan" TEXT,
    "buyer_registration_number" TEXT,
    "receipt_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT,
    "payment_reference" TEXT,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "tax_mode" "tax_mode" NOT NULL DEFAULT 'EXCLUSIVE',
    "subtotal_amount" BIGINT NOT NULL DEFAULT 0,
    "taxable_amount" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "pdf_storage_key" TEXT,
    "pdf_generated_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_to_email" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "gateway_connection_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "payment_webhook_status" NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_subscription_checkouts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "external_subscription_id" TEXT NOT NULL,
    "plan_version_id" TEXT NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billing_provider_name" TEXT NOT NULL DEFAULT 'RAZORPAY',

    CONSTRAINT "pending_subscription_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_applications" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_version_billing_mappings" (
    "id" TEXT NOT NULL,
    "plan_version_id" TEXT NOT NULL,
    "billing_provider_id" TEXT NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL,
    "currency" TEXT NOT NULL,
    "external_plan_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_version_billing_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_version_products" (
    "id" TEXT NOT NULL,
    "plan_version_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "limit_value" INTEGER NOT NULL,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_version_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_versions" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "price_monthly_inr" DECIMAL(10,2) NOT NULL,
    "price_yearly_inr" DECIMAL(10,2) NOT NULL,
    "discount_monthly_inr_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_monthly_inr_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_yearly_inr_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_yearly_inr_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_monthly_usd" DECIMAL(10,2) NOT NULL,
    "price_yearly_usd" DECIMAL(10,2) NOT NULL,
    "discount_monthly_usd_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_monthly_usd_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_yearly_usd_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_yearly_usd_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "is_offer" BOOLEAN NOT NULL DEFAULT false,
    "offer_description" TEXT,
    "offer_name" TEXT,
    "offer_valid_from" TIMESTAMP(3),
    "offer_valid_to" TIMESTAMP(3),
    "pricing_frequency" "pricing_frequency" NOT NULL DEFAULT 'BOTH',
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "discount_two_yearly_inr_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_two_yearly_inr_value" DECIMAL(10,2) DEFAULT 0,
    "discount_two_yearly_usd_type" "discount_type" NOT NULL DEFAULT 'NONE',
    "discount_two_yearly_usd_value" DECIMAL(10,2) DEFAULT 0,
    "price_two_yearly_inr" DECIMAL(10,2) DEFAULT 0,
    "price_two_yearly_usd" DECIMAL(10,2) DEFAULT 0,
    "purchase_mode" "purchase_mode" NOT NULL DEFAULT 'PAID',

    CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "plan_type" "plan_type" NOT NULL DEFAULT 'SINGLE_APP',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_exchange_rates" (
    "id" VARCHAR(26) NOT NULL,
    "base_currency" VARCHAR(8) NOT NULL,
    "quote_currency" VARCHAR(8) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_notification_suppressions" (
    "id" VARCHAR(26) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(20),
    "reason" VARCHAR(200),
    "source" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notification_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "constraint_type" "constraint_type" NOT NULL,
    "unit" TEXT,
    "is_hard_limit" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "usage_scope" "usage_scope_type" NOT NULL DEFAULT 'TENANT',
    "usage_window" "usage_window_type" NOT NULL DEFAULT 'LIFETIME',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_serve_stats" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "served_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_serve_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_upload_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "questions" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_upload_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempt_answers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "marks_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answer" JSONB,

    CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "total_marks" INTEGER NOT NULL DEFAULT 0,
    "status" "quiz_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "question_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proctoring_flags" JSONB,
    "tab_switch_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_options" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "blank_index" INTEGER,

    CONSTRAINT "quiz_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "question_type" "quiz_question_type" NOT NULL DEFAULT 'MCQ',
    "source_question_id" TEXT,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    "instructions" TEXT,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "pass_percentage" INTEGER NOT NULL DEFAULT 60,
    "scope" "quiz_scope" NOT NULL DEFAULT 'LESSON',
    "section_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "source_lecture_id" TEXT,
    "status" "quiz_status" NOT NULL DEFAULT 'DRAFT',
    "random_question_count" INTEGER,
    "allow_reattempt" BOOLEAN NOT NULL DEFAULT true,
    "max_attempts" INTEGER,
    "calculator_mode" TEXT NOT NULL DEFAULT 'NONE',
    "proctor_camera" BOOLEAN NOT NULL DEFAULT false,
    "proctor_max_tab_switches" INTEGER,
    "proctoring_enabled" BOOLEAN NOT NULL DEFAULT false,
    "bank_selection" JSONB,
    "question_bank_id" TEXT,
    "duration_min" INTEGER,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "gateway_refund_id" TEXT,
    "amount" DECIMAL(16,2) NOT NULL,
    "reason" TEXT,
    "status" "refund_status" NOT NULL DEFAULT 'INITIATED',
    "initiated_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_source" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_version_id" TEXT NOT NULL,
    "plan_code_snapshot" TEXT NOT NULL,
    "plan_name_snapshot" TEXT NOT NULL,
    "plan_version_snapshot" INTEGER NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL,
    "original_price" DECIMAL(10,2) NOT NULL,
    "discount_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_snapshot" DECIMAL(10,2) NOT NULL,
    "billing_provider_id" TEXT,
    "external_subscription_id" TEXT,
    "external_customer_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancel_effective_at" TIMESTAMP(3),
    "status" "subscription_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "grace_period_ends_at" TIMESTAMP(3),
    "billing_provider_name" TEXT,
    "dunning_started_at" TIMESTAMP(3),
    "last_payment_attempt_at" TIMESTAMP(3),
    "payment_failure_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_active_learners_daily" (
    "tenant_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distinct_members_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_active_learners_daily_pkey" PRIMARY KEY ("tenant_id","date")
);

-- CreateTable
CREATE TABLE "tenant_addon_events" (
    "id" TEXT NOT NULL,
    "tenant_addon_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "addon_id" TEXT NOT NULL,
    "event_type" "tenant_addon_event_type" NOT NULL,
    "old_status" "tenant_addon_status",
    "new_status" "tenant_addon_status",
    "reason" TEXT,
    "admin_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_addon_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_addons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "addon_id" TEXT NOT NULL,
    "source" "tenant_addon_source" NOT NULL,
    "status" "tenant_addon_status" NOT NULL DEFAULT 'ACTIVE',
    "custom_grant_value" INTEGER,
    "addon_subscription_id" TEXT,
    "entitlement_id" TEXT,
    "granted_by" TEXT,
    "reason" TEXT,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_admin_otp_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_admin_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_admin_signup_otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_admin_signup_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_application_events" (
    "id" TEXT NOT NULL,
    "tenant_application_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "event_type" "tenant_app_event_type" NOT NULL,
    "old_status" "tenant_app_status",
    "new_status" "tenant_app_status" NOT NULL,
    "reason" TEXT,
    "admin_user_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_applications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" "tenant_app_status" NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspended_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "grant_reason" TEXT,
    "granted_by" TEXT,
    "source" "tenant_app_source" NOT NULL,
    "source_subscription_id" TEXT,

    CONSTRAINT "tenant_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_email" TEXT,
    "actor_name" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "resource_label" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_auth_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email_password_enabled" BOOLEAN NOT NULL DEFAULT true,
    "google_oauth_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_otp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "phone_otp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "signup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_signup_on_login" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "phone_number_required" BOOLEAN NOT NULL DEFAULT false,
    "google_client_id" TEXT,
    "easy_checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "name_confirmation_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tenant_auth_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_bulk_imports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "acting_user_id" TEXT NOT NULL,
    "scope_type" "tenant_bulk_import_scope_type" NOT NULL,
    "scope_id" TEXT,
    "source" "tenant_bulk_import_source" NOT NULL DEFAULT 'CSV',
    "status" "tenant_bulk_import_status" NOT NULL DEFAULT 'QUEUED',
    "original_filename" TEXT,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "merged_count" INTEGER NOT NULL DEFAULT 0,
    "granted_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "report_s3_key" TEXT,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_bulk_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_certificate_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "offering_type" "linkable_content_type" NOT NULL,
    "preset_template" TEXT,
    "certificate_template_id" TEXT,
    "certificate_logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_certificate_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_currencies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "countries" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_domains" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "domain_type" "domain_type" NOT NULL,
    "domain_name" TEXT NOT NULL,
    "subdomain_prefix" TEXT,
    "hostname_id" TEXT,
    "status" "domain_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "error_message" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "ssl_status" TEXT,
    "ownership_verified" BOOLEAN NOT NULL DEFAULT false,
    "ssl_active" BOOLEAN NOT NULL DEFAULT false,
    "verification_records" JSONB,

    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_domain_health_checks" (
    "id" VARCHAR(26) NOT NULL,
    "sending_domain_id" VARCHAR(26) NOT NULL,
    "dkim_status" VARCHAR(32) NOT NULL,
    "mail_from_status" VARCHAR(32) NOT NULL,
    "spf_present" BOOLEAN NOT NULL DEFAULT false,
    "dmarc_present" BOOLEAN NOT NULL DEFAULT false,
    "failures" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_email_domain_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_messages" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "category" "email_message_category" NOT NULL,
    "sending_domain_id" VARCHAR(26),
    "sender_identity_id" VARCHAR(26),
    "from_address" VARCHAR(320) NOT NULL,
    "to_address" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(998) NOT NULL,
    "template_key" VARCHAR(128),
    "campaign_id" VARCHAR(26),
    "ses_message_id" VARCHAR(255),
    "status" "email_message_status" NOT NULL DEFAULT 'QUEUED',
    "bounce_type" VARCHAR(32),
    "bounce_sub_type" VARCHAR(64),
    "complaint_feedback_type" VARCHAR(64),
    "delivered_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "complained_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "metadata" JSONB,
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_reputation_events" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "from_status" "email_sending_tenant_status" NOT NULL,
    "to_status" "email_sending_tenant_status" NOT NULL,
    "trigger" "email_reputation_event_trigger" NOT NULL,
    "triggered_by" VARCHAR(64),
    "reason" VARCHAR(512) NOT NULL,
    "rates_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_email_reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_sender_identities" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "sending_domain_id" VARCHAR(26) NOT NULL,
    "email_address" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(255),
    "reply_to" VARCHAR(320),
    "status" "email_sender_identity_status" NOT NULL DEFAULT 'ACTIVE',
    "is_default_transactional" BOOLEAN NOT NULL DEFAULT false,
    "is_default_notification" BOOLEAN NOT NULL DEFAULT false,
    "is_default_marketing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_email_sender_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_sending_domains" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "subdomain" VARCHAR(253) NOT NULL,
    "mail_from_subdomain" VARCHAR(253) NOT NULL,
    "ses_configuration_set" VARCHAR(64) NOT NULL,
    "status" "email_sending_domain_status" NOT NULL DEFAULT 'PENDING',
    "dkim_status" VARCHAR(32),
    "mail_from_status" VARCHAR(32),
    "dns_records" JSONB NOT NULL,
    "failure_reason" VARCHAR(512),
    "verified_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_email_sending_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_email_suppressions" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "reason" "email_suppression_reason" NOT NULL,
    "source_message_id" VARCHAR(26),
    "category_scope" "email_message_category",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_email_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_gateway_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "mode" "gateway_mode" NOT NULL,
    "label" TEXT,
    "credentials_encrypted" JSONB,
    "platform_commission_pct" DECIMAL(5,2),
    "platform_commission_flat" DECIMAL(16,2),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "connected_at" TIMESTAMP(3),
    "status" "gateway_connection_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_gateway_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_member_form_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'OPTIONAL',
    "reprompt_after_hours" INTEGER NOT NULL DEFAULT 24,
    "title" TEXT NOT NULL DEFAULT 'Complete your profile',
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT 'User data form',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_member_form_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_member_form_responses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "form_id" TEXT NOT NULL,

    CONSTRAINT "tenant_member_form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_member_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "device_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_member_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "avatar_url" TEXT,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "oauth_provider" TEXT,
    "oauth_provider_id" TEXT,
    "password_hash" TEXT,
    "phone" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "member_status" NOT NULL DEFAULT 'ACTIVE',
    "about" TEXT,
    "gender" TEXT,
    "profile_metadata" JSONB,
    "name_confirmed_at" TIMESTAMP(3),
    "preferred_locale" TEXT,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_nav_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "feature_key" TEXT,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "badge_text" TEXT,
    "badge_variant" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_nav_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_nudge_dismissals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nudge_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_nudge_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_org_details" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "logo_light_key" TEXT,
    "logo_dark_key" TEXT,
    "favicon_key" TEXT,
    "tagline" VARCHAR(200),
    "description" TEXT,
    "contact_email" TEXT,
    "support_email" TEXT,
    "phone_numbers" TEXT[],
    "whatsapp_numbers" TEXT[],
    "address" JSONB,
    "founder_name" TEXT,
    "founder_title" TEXT,
    "founder_bio" TEXT,
    "founder_photo_key" TEXT,
    "social_links" JSONB,
    "legal_entity_name" TEXT,
    "registration_number" TEXT,
    "year_established" INTEGER,
    "industry" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "billing_address" JSONB,
    "billing_email" TEXT,
    "billing_phone" TEXT,
    "gstin" TEXT,
    "hsn_sac_code" TEXT,
    "pan_number" TEXT,
    "tax_id" TEXT,
    "tax_mode" "tax_mode" NOT NULL DEFAULT 'INCLUSIVE',
    "tax_percentage" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "android_app_url" TEXT,
    "ios_app_url" TEXT,

    CONSTRAINT "tenant_org_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_otp_codes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_page_revisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "custom_html" TEXT NOT NULL,
    "custom_code_kind" "custom_code_kind",
    "label" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_pages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "theme" JSONB NOT NULL,
    "seo" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "custom_assets" JSONB,
    "custom_code_kind" "custom_code_kind",
    "custom_html" TEXT,
    "custom_html_draft" TEXT,
    "moderation_status" "page_moderation_status" NOT NULL DEFAULT 'ACTIVE',
    "render_mode" "page_render_mode" NOT NULL DEFAULT 'SECTIONS',
    "custom_code_kind_draft" "custom_code_kind",

    CONSTRAINT "tenant_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_password_resets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "tenant_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" TEXT,

    CONSTRAINT "tenant_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_staff_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "staff_membership_status" NOT NULL DEFAULT 'ACTIVE',
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_staff_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_subscription_events" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "subscription_id" VARCHAR(26) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "gateway_event_id" VARCHAR(255),
    "previous_status" VARCHAR(50),
    "new_status" VARCHAR(50) NOT NULL,
    "gateway_payment_id" VARCHAR(255),
    "amount" DECIMAL(16,2),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_subscription_plans" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "billing_cycle" "billing_cycle" NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "amount_in_smallest" INTEGER NOT NULL,
    "gateway_plan_id" VARCHAR(255),
    "gateway_provider" VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "features_summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_subscription_settings" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "reminder_days_before" JSONB,
    "dunning_email_interval_hours" INTEGER NOT NULL DEFAULT 48,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "subscription_name" VARCHAR(100),
    "page_config" JSONB,

    CONSTRAINT "tenant_subscription_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_usage_counters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'TENANT',
    "scope_id" TEXT NOT NULL DEFAULT '__TENANT__',
    "window_type" TEXT NOT NULL DEFAULT 'LIFETIME',
    "window_start" TIMESTAMP(3),
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "last_reconciled_at" TIMESTAMP(3),
    "reconciled_value" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_usage_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'TENANT',
    "scope_id" TEXT NOT NULL DEFAULT '__TENANT__',
    "event_type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "resulting_value" INTEGER,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "idempotency_key" TEXT,
    "reason" TEXT,
    "actor_type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_user_roles" (
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,
    "membership_id" TEXT NOT NULL,

    CONSTRAINT "tenant_user_roles_pkey" PRIMARY KEY ("membership_id","role_id")
);

-- CreateTable
CREATE TABLE "tenant_user_subscriptions" (
    "id" VARCHAR(26) NOT NULL,
    "tenant_id" VARCHAR(26) NOT NULL,
    "member_id" VARCHAR(26) NOT NULL,
    "plan_id" VARCHAR(26) NOT NULL,
    "gateway_connection_id" VARCHAR(26) NOT NULL,
    "gateway_subscription_id" VARCHAR(255),
    "gateway_customer_id" VARCHAR(255),
    "gateway_provider" VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
    "plan_name_snapshot" VARCHAR(255) NOT NULL,
    "billing_cycle_snapshot" VARCHAR(20) NOT NULL,
    "amount_snapshot" DECIMAL(16,2) NOT NULL,
    "currency_snapshot" VARCHAR(10) NOT NULL,
    "status" "tenant_subscription_status" NOT NULL DEFAULT 'CREATED',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "grace_period_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "ended_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "last_payment_at" TIMESTAMP(3),
    "last_payment_amount" DECIMAL(16,2),
    "next_charge_at" TIMESTAMP(3),
    "payment_failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_dunning_email_at" TIMESTAMP(3),
    "short_url" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "oauth_provider" TEXT,
    "oauth_provider_id" TEXT,
    "status" "tenant_user_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "designation" TEXT,
    "last_login_ip" TEXT,
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_completed_at" TIMESTAMP(3),
    "signup_city" TEXT,
    "signup_country" TEXT,
    "signup_ip" TEXT,
    "signup_referrer" TEXT,
    "signup_user_agent" TEXT,
    "signup_utm" JSONB,
    "timezone" TEXT,
    "creator_intent_profile" JSONB,
    "signup_quiz_answers" JSONB,
    "preferred_locale" VARCHAR(10),

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_watch_time_daily" (
    "tenant_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "course_id" TEXT NOT NULL,
    "lecture_id" TEXT NOT NULL,
    "total_seconds" BIGINT NOT NULL DEFAULT 0,
    "sessions_count" INTEGER NOT NULL DEFAULT 0,
    "distinct_members_count" INTEGER NOT NULL DEFAULT 0,
    "avg_completion_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_watch_time_daily_pkey" PRIMARY KEY ("tenant_id","date","course_id","lecture_id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "custom_domain" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "layout" JSONB,
    "certificate_template" TEXT,
    "certificate_template_published" BOOLEAN NOT NULL DEFAULT false,
    "certificate_logo" TEXT,
    "onboarding_checklist_dismissed_at" TIMESTAMP(3),
    "email_marketing_blocked_reason" VARCHAR(512),
    "email_sending_status" "email_sending_tenant_status" NOT NULL DEFAULT 'ACTIVE',
    "email_sending_status_changed_at" TIMESTAMP(3),
    "email_tps_override" DECIMAL(6,2),
    "access_managed_enabled" BOOLEAN NOT NULL DEFAULT false,
    "access_managed_enabled_at" TIMESTAMP(3),
    "access_managed_enabled_by_user_id" TEXT,
    "certificate_tab_enabled" BOOLEAN NOT NULL DEFAULT true,
    "enrolled_courses_only_enabled" BOOLEAN NOT NULL DEFAULT false,
    "enrolled_courses_only_enabled_at" TIMESTAMP(3),
    "enrolled_courses_only_enabled_by_user_id" TEXT,
    "sequential_courses_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sequential_courses_enabled_at" TIMESTAMP(3),
    "sequential_courses_enabled_by_user_id" TEXT,
    "ordered_products_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ordered_products_enabled_at" TIMESTAMP(3),
    "ordered_products_enabled_by_user_id" TEXT,
    "default_locale" TEXT NOT NULL DEFAULT 'en',
    "multi_language_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt_answers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer" JSONB,
    "time_spent_sec" INTEGER NOT NULL DEFAULT 0,
    "marked_for_review" BOOLEAN NOT NULL DEFAULT false,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "graded_at" TIMESTAMP(3),
    "graded_by" TEXT,
    "grader_remarks" TEXT,
    "grading_status" "test_answer_grading_status" NOT NULL DEFAULT 'AUTO_GRADED',

    CONSTRAINT "test_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt_modules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "stage_no" INTEGER NOT NULL,
    "variant" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" "test_attempt_module_status" NOT NULL DEFAULT 'PENDING',
    "question_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pretest_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "time_limit_sec" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "raw_correct" INTEGER,
    "raw_score" DECIMAL(8,2),
    "routed_to_variant" TEXT,
    "auto_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempt_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "test_series_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "time_remaining_sec" INTEGER,
    "status" "test_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DECIMAL(8,2),
    "percentage" DECIMAL(5,2),
    "percentile" DECIMAL(5,2),
    "rank" INTEGER,
    "predicted_rank_min" INTEGER,
    "predicted_rank_max" INTEGER,
    "analytics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "question_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scaled_score" DECIMAL(8,2),
    "scaled_score_max" INTEGER,
    "proctoring_flags" JSONB,
    "tab_switch_count" INTEGER NOT NULL DEFAULT 0,
    "break_ends_at" TIMESTAMPTZ(6),
    "grading_status" "test_attempt_grading_status" NOT NULL DEFAULT 'NOT_REQUIRED',
    "total_marks" DECIMAL(8,2),

    CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_bookmarks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "attempt_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "test_id" TEXT,
    "test_series_id" TEXT,
    "attempt_id" TEXT,
    "certificate_number" TEXT NOT NULL,
    "template_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "template_snapshot" JSONB,

    CONSTRAINT "test_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_coupons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_series_id" TEXT,
    "code" TEXT NOT NULL,
    "type" "coupon_discount_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_exam_rank_curves" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "total_candidates" INTEGER NOT NULL,
    "curve" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_exam_rank_curves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_module_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "is_pretest" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_module_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_module_score_scales" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "path_key" TEXT NOT NULL,
    "scale" JSONB NOT NULL,
    "scale_max" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_module_score_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_modules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "stage_no" INTEGER NOT NULL,
    "variant" TEXT NOT NULL,
    "difficulty_rank" INTEGER NOT NULL DEFAULT 0,
    "question_count" INTEGER NOT NULL,
    "pretest_count" INTEGER NOT NULL DEFAULT 0,
    "time_limit_min" INTEGER NOT NULL,
    "routing_rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_norm_tables" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "max_score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_norm_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_question_banks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "question_bank_id" TEXT NOT NULL,
    "type" "test_question_type" NOT NULL,
    "stem" JSONB NOT NULL,
    "options" JSONB,
    "correct_answer" JSONB,
    "explanation" TEXT,
    "marks" DECIMAL(6,2) NOT NULL DEFAULT 4,
    "negative_marks" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "difficulty" "test_question_difficulty" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT,
    "chapter" TEXT,
    "topic" TEXT,
    "source" TEXT,
    "status" "test_question_status" NOT NULL DEFAULT 'DRAFT',
    "created_via" "test_question_created_via" NOT NULL DEFAULT 'MANUAL',
    "ai_metadata" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "chapter_node_id" TEXT,
    "subject_node_id" TEXT,
    "topic_node_id" TEXT,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_scholarship_awards" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scholarship_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "attempt_id" TEXT,
    "tier_label" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "score" DECIMAL(8,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "flagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_scholarship_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_scholarships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT,
    "test_series_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basis" TEXT NOT NULL DEFAULT 'PERCENT',
    "tiers" JSONB NOT NULL,
    "max_awardees" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_section_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "marks_override" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_section_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "time_limit_min" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "marking_scheme" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "break_after_sec" INTEGER,
    "question_selection" JSONB,
    "question_bank_id" TEXT,
    "random_question_count" INTEGER,

    CONSTRAINT "test_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_series" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_image_key" TEXT,
    "category" TEXT,
    "pricing_type" "test_series_pricing_type" NOT NULL DEFAULT 'FREE',
    "price_inr" DECIMAL(10,2),
    "price_usd" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'INR',
    "validity_days" INTEGER,
    "end_date" TIMESTAMP(3),
    "visibility" "test_series_visibility" NOT NULL DEFAULT 'PUBLIC',
    "access_mode" "test_series_access_mode" NOT NULL DEFAULT 'OPEN',
    "status" "test_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "discount_inr" DECIMAL(10,2),
    "discount_usd" DECIMAL(10,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_series_enrollments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT NOT NULL,
    "test_series_id" TEXT NOT NULL,
    "status" "test_series_enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "source" "test_series_enrollment_source" NOT NULL DEFAULT 'PURCHASED',
    "source_coupon_id" TEXT,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_till" TIMESTAMP(3),
    "payment_id" TEXT,
    "amount_paid" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_series_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_series_tests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "test_series_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_series_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_taxonomy_nodes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" "test_taxonomy_kind" NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_taxonomy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_member_id" TEXT,
    "name" TEXT NOT NULL,
    "text" TEXT,
    "image_url" TEXT,
    "social_links" JSONB,
    "rating" INTEGER,
    "status" "testimonial_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_image_key" TEXT,
    "duration_min" INTEGER NOT NULL,
    "total_marks" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "status" "test_status" NOT NULL DEFAULT 'DRAFT',
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "show_solutions" "test_show_solutions" NOT NULL DEFAULT 'IMMEDIATE',
    "allow_reattempt" BOOLEAN NOT NULL DEFAULT false,
    "pass_criteria_pct" DECIMAL(5,2),
    "target_exam" TEXT,
    "target_rank_curve_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "random_question_count" INTEGER,
    "mode" "test_mode" NOT NULL DEFAULT 'STANDARD',
    "max_attempts" INTEGER,
    "calculator_mode" TEXT NOT NULL DEFAULT 'NONE',
    "proctor_camera" BOOLEAN NOT NULL DEFAULT false,
    "proctor_max_tab_switches" INTEGER,
    "proctoring_enabled" BOOLEAN NOT NULL DEFAULT false,
    "proctor_mic" BOOLEAN NOT NULL DEFAULT false,
    "proctor_fullscreen" BOOLEAN NOT NULL DEFAULT false,
    "proctor_block_copy_paste" BOOLEAN NOT NULL DEFAULT false,
    "proctor_action" TEXT NOT NULL DEFAULT 'WARN',
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "certificate_enabled" BOOLEAN NOT NULL DEFAULT false,
    "certificate_template_id" TEXT,
    "certificate_min_score_pct" DECIMAL(5,2),

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "event_type" "usage_event_type" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_time_rollup_state" (
    "tenant_id" TEXT NOT NULL,
    "last_rollup_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watch_time_rollup_state_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" "translatable_entity_type" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_machine" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_locales" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_locales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addon_subscriptions_addon_id_idx" ON "addon_subscriptions"("addon_id");

-- CreateIndex
CREATE INDEX "addon_subscriptions_external_subscription_id_idx" ON "addon_subscriptions"("external_subscription_id");

-- CreateIndex
CREATE INDEX "addon_subscriptions_status_idx" ON "addon_subscriptions"("status");

-- CreateIndex
CREATE INDEX "addon_subscriptions_tenant_id_idx" ON "addon_subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "addons_code_key" ON "addons"("code");

-- CreateIndex
CREATE INDEX "addons_application_id_idx" ON "addons"("application_id");

-- CreateIndex
CREATE INDEX "addons_product_id_idx" ON "addons"("product_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_admin_id_idx" ON "admin_audit_logs"("actor_admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_idx" ON "admin_audit_logs"("actor_admin_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_category_idx" ON "admin_audit_logs"("category");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_tenant_id_idx" ON "admin_audit_logs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_code_key" ON "admin_permissions"("code");

-- CreateIndex
CREATE INDEX "admin_permissions_category_idx" ON "admin_permissions"("category");

-- CreateIndex
CREATE INDEX "admin_permissions_code_idx" ON "admin_permissions"("code");

-- CreateIndex
CREATE INDEX "admin_role_permissions_permission_id_idx" ON "admin_role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "admin_role_permissions_role_id_idx" ON "admin_role_permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_code_key" ON "admin_roles"("code");

-- CreateIndex
CREATE INDEX "admin_roles_code_idx" ON "admin_roles"("code");

-- CreateIndex
CREATE INDEX "admin_user_roles_admin_user_id_idx" ON "admin_user_roles"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_user_roles_role_id_idx" ON "admin_user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_status_idx" ON "admin_users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_oauth_provider_oauth_provider_id_key" ON "admin_users"("oauth_provider", "oauth_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_code_key" ON "applications"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_evaluations_submission_id_key" ON "assignment_evaluations"("submission_id");

-- CreateIndex
CREATE INDEX "assignment_evaluations_tenant_id_assignment_id_idx" ON "assignment_evaluations"("tenant_id", "assignment_id");

-- CreateIndex
CREATE INDEX "assignment_evaluations_tenant_id_submission_id_idx" ON "assignment_evaluations"("tenant_id", "submission_id");

-- CreateIndex
CREATE INDEX "assignment_evaluations_tenant_id_tenant_member_id_idx" ON "assignment_evaluations"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_tenant_id_assignment_id_idx" ON "assignment_submissions"("tenant_id", "assignment_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_tenant_id_course_id_idx" ON "assignment_submissions"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_tenant_id_status_idx" ON "assignment_submissions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "assignment_submissions_tenant_id_tenant_member_id_idx" ON "assignment_submissions"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_tenant_id_assignment_id_tenant_membe_key" ON "assignment_submissions"("tenant_id", "assignment_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_course_id_idx" ON "assignments"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_course_id_status_idx" ON "assignments"("tenant_id", "course_id", "status");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_lesson_id_idx" ON "assignments"("tenant_id", "lesson_id");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_section_id_idx" ON "assignments"("tenant_id", "section_id");

-- CreateIndex
CREATE INDEX "assignments_tenant_id_status_idx" ON "assignments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "batch_enrollments_batch_id_status_idx" ON "batch_enrollments"("batch_id", "status");

-- CreateIndex
CREATE INDEX "batch_enrollments_tenant_id_status_idx" ON "batch_enrollments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "batch_enrollments_tenant_id_tenant_member_id_idx" ON "batch_enrollments"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_enrollments_tenant_id_batch_id_tenant_member_id_key" ON "batch_enrollments"("tenant_id", "batch_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "batch_items_tenant_id_batch_id_idx" ON "batch_items"("tenant_id", "batch_id");

-- CreateIndex
CREATE INDEX "batch_items_tenant_id_book_id_idx" ON "batch_items"("tenant_id", "book_id");

-- CreateIndex
CREATE INDEX "batch_items_tenant_id_course_id_idx" ON "batch_items"("tenant_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_tenant_id_batch_id_book_id_key" ON "batch_items"("tenant_id", "batch_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_tenant_id_batch_id_course_id_key" ON "batch_items"("tenant_id", "batch_id", "course_id");

-- CreateIndex
CREATE INDEX "batch_leaderboard_snapshots_tenant_id_batch_id_computed_at_idx" ON "batch_leaderboard_snapshots"("tenant_id", "batch_id", "computed_at");

-- CreateIndex
CREATE INDEX "batches_tenant_id_purchase_mode_idx" ON "batches"("tenant_id", "purchase_mode");

-- CreateIndex
CREATE INDEX "batches_tenant_id_status_created_at_idx" ON "batches"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "batches_tenant_id_status_idx" ON "batches"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "batches_tenant_id_status_sort_order_created_at_idx" ON "batches"("tenant_id", "status", "sort_order", "created_at");

-- CreateIndex
CREATE INDEX "batches_tenant_id_status_start_date_idx" ON "batches"("tenant_id", "status", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "batches_tenant_id_slug_key" ON "batches"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "billing_providers_name_key" ON "billing_providers"("name");

-- CreateIndex
CREATE INDEX "billing_providers_name_idx" ON "billing_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhooks_event_id_key" ON "billing_webhooks"("event_id");

-- CreateIndex
CREATE INDEX "billing_webhooks_billing_provider_id_event_type_idx" ON "billing_webhooks"("billing_provider_id", "event_type");

-- CreateIndex
CREATE INDEX "billing_webhooks_status_idx" ON "billing_webhooks"("status");

-- CreateIndex
CREATE INDEX "book_access_tenant_id_book_id_idx" ON "book_access"("tenant_id", "book_id");

-- CreateIndex
CREATE INDEX "book_access_tenant_id_status_idx" ON "book_access"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "book_access_tenant_id_tenant_member_id_idx" ON "book_access"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_access_tenant_id_tenant_member_id_book_id_key" ON "book_access"("tenant_id", "tenant_member_id", "book_id");

-- CreateIndex
CREATE INDEX "book_authors_tenant_id_book_id_idx" ON "book_authors"("tenant_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_authors_tenant_id_book_id_instructor_id_key" ON "book_authors"("tenant_id", "book_id", "instructor_id");

-- CreateIndex
CREATE INDEX "book_categories_tenant_id_book_id_idx" ON "book_categories"("tenant_id", "book_id");

-- CreateIndex
CREATE INDEX "book_categories_tenant_id_category_id_idx" ON "book_categories"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_categories_tenant_id_book_id_category_id_key" ON "book_categories"("tenant_id", "book_id", "category_id");

-- CreateIndex
CREATE INDEX "book_conversions_status_created_at_idx" ON "book_conversions"("status", "created_at");

-- CreateIndex
CREATE INDEX "book_conversions_tenant_id_book_id_created_at_idx" ON "book_conversions"("tenant_id", "book_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "book_recommendations_tenant_id_book_id_idx" ON "book_recommendations"("tenant_id", "book_id");

-- CreateIndex
CREATE INDEX "book_recommendations_tenant_id_book_id_sort_order_idx" ON "book_recommendations"("tenant_id", "book_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "book_recommendations_tenant_id_book_id_recommended_book_id_key" ON "book_recommendations"("tenant_id", "book_id", "recommended_book_id");

-- CreateIndex
CREATE INDEX "books_tenant_id_purchase_mode_idx" ON "books"("tenant_id", "purchase_mode");

-- CreateIndex
CREATE INDEX "books_tenant_id_status_created_at_idx" ON "books"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "books_tenant_id_status_idx" ON "books"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "books_tenant_id_status_sort_order_created_at_idx" ON "books"("tenant_id", "status", "sort_order", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "books_tenant_id_slug_key" ON "books"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "bulk_certificates_tenant_id_batch_id_idx" ON "bulk_certificates"("tenant_id", "batch_id");

-- CreateIndex
CREATE INDEX "bulk_certificates_tenant_id_issued_at_idx" ON "bulk_certificates"("tenant_id", "issued_at");

-- CreateIndex
CREATE INDEX "bulk_certificates_tenant_id_tenant_member_id_idx" ON "bulk_certificates"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_certificates_tenant_id_certificate_number_key" ON "bulk_certificates"("tenant_id", "certificate_number");

-- CreateIndex
CREATE INDEX "bundle_items_tenant_id_book_id_idx" ON "bundle_items"("tenant_id", "book_id");

-- CreateIndex
CREATE INDEX "bundle_items_tenant_id_bundle_id_idx" ON "bundle_items"("tenant_id", "bundle_id");

-- CreateIndex
CREATE INDEX "bundle_items_tenant_id_course_id_idx" ON "bundle_items"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "bundle_items_tenant_id_test_series_id_idx" ON "bundle_items"("tenant_id", "test_series_id");

-- CreateIndex
CREATE INDEX "bundles_tenant_id_purchase_mode_idx" ON "bundles"("tenant_id", "purchase_mode");

-- CreateIndex
CREATE INDEX "bundles_tenant_id_status_created_at_idx" ON "bundles"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "bundles_tenant_id_status_idx" ON "bundles"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "bundles_tenant_id_status_sort_order_created_at_idx" ON "bundles"("tenant_id", "status", "sort_order", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_tenant_id_slug_key" ON "bundles"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "cart_items_tenant_id_created_at_idx" ON "cart_items"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "cart_items_tenant_id_tenant_member_id_idx" ON "cart_items"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_tenant_id_tenant_member_id_item_type_batch_id_key" ON "cart_items"("tenant_id", "tenant_member_id", "item_type", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_tenant_id_tenant_member_id_item_type_book_id_key" ON "cart_items"("tenant_id", "tenant_member_id", "item_type", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_tenant_id_tenant_member_id_item_type_bundle_id_key" ON "cart_items"("tenant_id", "tenant_member_id", "item_type", "bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_tenant_id_tenant_member_id_item_type_course_id_key" ON "cart_items"("tenant_id", "tenant_member_id", "item_type", "course_id");

-- CreateIndex
CREATE INDEX "cart_order_items_tenant_id_order_id_idx" ON "cart_order_items"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_is_active_idx" ON "categories"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "categories_tenant_id_parent_id_idx" ON "categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_sort_order_idx" ON "categories"("tenant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "certificate_batches_tenant_id_created_at_idx" ON "certificate_batches"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "certificate_templates_tenant_id_idx" ON "certificate_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "certificate_templates_tenant_id_is_default_idx" ON "certificate_templates"("tenant_id", "is_default");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_issued_at_idx" ON "certificates"("tenant_id", "issued_at");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_status_idx" ON "certificates"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_tenant_member_id_idx" ON "certificates"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_tenant_id_certificate_number_key" ON "certificates"("tenant_id", "certificate_number");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_tenant_id_tenant_member_id_course_id_key" ON "certificates"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE INDEX "content_prices_tenant_id_entity_type_entity_id_idx" ON "content_prices"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_prices_tenant_id_entity_type_entity_id_currency_key" ON "content_prices"("tenant_id", "entity_type", "entity_id", "currency");

-- CreateIndex
CREATE INDEX "content_product_links_tenant_id_content_type_batch_id_idx" ON "content_product_links"("tenant_id", "content_type", "batch_id");

-- CreateIndex
CREATE INDEX "content_product_links_tenant_id_content_type_book_id_idx" ON "content_product_links"("tenant_id", "content_type", "book_id");

-- CreateIndex
CREATE INDEX "content_product_links_tenant_id_content_type_bundle_id_idx" ON "content_product_links"("tenant_id", "content_type", "bundle_id");

-- CreateIndex
CREATE INDEX "content_product_links_tenant_id_content_type_course_id_idx" ON "content_product_links"("tenant_id", "content_type", "course_id");

-- CreateIndex
CREATE INDEX "content_product_links_tenant_id_product_code_idx" ON "content_product_links"("tenant_id", "product_code");

-- CreateIndex
CREATE UNIQUE INDEX "content_product_links_tenant_id_product_code_batch_id_key" ON "content_product_links"("tenant_id", "product_code", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_product_links_tenant_id_product_code_book_id_key" ON "content_product_links"("tenant_id", "product_code", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_product_links_tenant_id_product_code_bundle_id_key" ON "content_product_links"("tenant_id", "product_code", "bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_product_links_tenant_id_product_code_course_id_key" ON "content_product_links"("tenant_id", "product_code", "course_id");

-- CreateIndex
CREATE INDEX "coupon_applicable_items_tenant_id_batch_id_idx" ON "coupon_applicable_items"("tenant_id", "batch_id");

-- CreateIndex
CREATE INDEX "coupon_applicable_items_tenant_id_book_id_idx" ON "coupon_applicable_items"("tenant_id", "book_id");

-- CreateIndex
CREATE INDEX "coupon_applicable_items_tenant_id_bundle_id_idx" ON "coupon_applicable_items"("tenant_id", "bundle_id");

-- CreateIndex
CREATE INDEX "coupon_applicable_items_tenant_id_coupon_id_idx" ON "coupon_applicable_items"("tenant_id", "coupon_id");

-- CreateIndex
CREATE INDEX "coupon_applicable_items_tenant_id_course_id_idx" ON "coupon_applicable_items"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "coupon_applicable_items_tenant_id_test_series_id_idx" ON "coupon_applicable_items"("tenant_id", "test_series_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenant_id_coupon_id_idx" ON "coupon_redemptions"("tenant_id", "coupon_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenant_id_coupon_id_member_id_idx" ON "coupon_redemptions"("tenant_id", "coupon_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_tenant_id_coupon_id_order_id_key" ON "coupon_redemptions"("tenant_id", "coupon_id", "order_id");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_code_idx" ON "coupons"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_is_active_idx" ON "coupons"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenant_id_code_key" ON "coupons"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "course_categories_tenant_id_category_id_idx" ON "course_categories"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "course_categories_tenant_id_course_id_idx" ON "course_categories"("tenant_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_tenant_id_course_id_category_id_key" ON "course_categories"("tenant_id", "course_id", "category_id");

-- CreateIndex
CREATE INDEX "course_faqs_tenant_id_course_id_idx" ON "course_faqs"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_faqs_tenant_id_course_id_sort_order_idx" ON "course_faqs"("tenant_id", "course_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_instructors_tenant_id_course_id_idx" ON "course_instructors"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_instructors_tenant_id_instructor_id_idx" ON "course_instructors"("tenant_id", "instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_instructors_tenant_id_course_id_instructor_id_key" ON "course_instructors"("tenant_id", "course_id", "instructor_id");

-- CreateIndex
CREATE INDEX "course_lessons_tenant_id_course_id_idx" ON "course_lessons"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_lessons_tenant_id_course_id_type_idx" ON "course_lessons"("tenant_id", "course_id", "type");

-- CreateIndex
CREATE INDEX "course_lessons_tenant_id_section_id_sort_order_idx" ON "course_lessons"("tenant_id", "section_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_recommendations_tenant_id_course_id_idx" ON "course_recommendations"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_recommendations_tenant_id_course_id_sort_order_idx" ON "course_recommendations"("tenant_id", "course_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "course_recommendations_tenant_id_course_id_recommended_cour_key" ON "course_recommendations"("tenant_id", "course_id", "recommended_course_id");

-- CreateIndex
CREATE INDEX "course_review_votes_tenant_id_review_id_idx" ON "course_review_votes"("tenant_id", "review_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_review_votes_tenant_id_tenant_member_id_review_id_key" ON "course_review_votes"("tenant_id", "tenant_member_id", "review_id");

-- CreateIndex
CREATE INDEX "course_reviews_tenant_id_course_id_idx" ON "course_reviews"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_reviews_tenant_id_course_id_is_visible_idx" ON "course_reviews"("tenant_id", "course_id", "is_visible");

-- CreateIndex
CREATE UNIQUE INDEX "course_reviews_tenant_id_tenant_member_id_course_id_key" ON "course_reviews"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE INDEX "course_sections_tenant_id_course_id_idx" ON "course_sections"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_sections_tenant_id_course_id_sort_order_idx" ON "course_sections"("tenant_id", "course_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_syllabus_items_tenant_id_syllabus_section_id_idx" ON "course_syllabus_items"("tenant_id", "syllabus_section_id");

-- CreateIndex
CREATE INDEX "course_syllabus_items_tenant_id_syllabus_section_id_sort_or_idx" ON "course_syllabus_items"("tenant_id", "syllabus_section_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_syllabus_sections_tenant_id_course_id_idx" ON "course_syllabus_sections"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "course_syllabus_sections_tenant_id_course_id_sort_order_idx" ON "course_syllabus_sections"("tenant_id", "course_id", "sort_order");

-- CreateIndex
CREATE INDEX "courses_tenant_id_course_type_idx" ON "courses"("tenant_id", "course_type");

-- CreateIndex
CREATE INDEX "courses_tenant_id_mode_idx" ON "courses"("tenant_id", "mode");

-- CreateIndex
CREATE INDEX "courses_tenant_id_purchase_mode_idx" ON "courses"("tenant_id", "purchase_mode");

-- CreateIndex
CREATE INDEX "courses_tenant_id_status_created_at_idx" ON "courses"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "courses_tenant_id_status_idx" ON "courses"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "courses_tenant_id_status_sort_order_created_at_idx" ON "courses"("tenant_id", "status", "sort_order", "created_at");

-- CreateIndex
CREATE INDEX "courses_tenant_id_unlocks_after_id_idx" ON "courses"("tenant_id", "unlocks_after_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_tenant_id_slug_key" ON "courses"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_course_id_idx" ON "enrollments"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_enrolled_at_idx" ON "enrollments"("tenant_id", "enrolled_at");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_source_idx" ON "enrollments"("tenant_id", "source");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_status_idx" ON "enrollments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_tenant_member_id_idx" ON "enrollments"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "enrollments_tenant_id_tenant_member_id_status_idx" ON "enrollments"("tenant_id", "tenant_member_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_tenant_id_tenant_member_id_course_id_key" ON "enrollments"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE INDEX "entitlement_overrides_admin_id_idx" ON "entitlement_overrides"("admin_id");

-- CreateIndex
CREATE INDEX "entitlement_overrides_entitlement_id_idx" ON "entitlement_overrides"("entitlement_id");

-- CreateIndex
CREATE INDEX "entitlements_source_addon_id_idx" ON "entitlements"("source_addon_id");

-- CreateIndex
CREATE INDEX "entitlements_source_subscription_id_idx" ON "entitlements"("source_subscription_id");

-- CreateIndex
CREATE INDEX "entitlements_tenant_id_application_code_idx" ON "entitlements"("tenant_id", "application_code");

-- CreateIndex
CREATE INDEX "entitlements_tenant_id_feature_key_idx" ON "entitlements"("tenant_id", "feature_key");

-- CreateIndex
CREATE INDEX "entitlements_tenant_id_is_active_idx" ON "entitlements"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "entitlements_tenant_id_is_unlimited_idx" ON "entitlements"("tenant_id", "is_unlimited");

-- CreateIndex
CREATE INDEX "entitlements_tenant_id_product_code_idx" ON "entitlements"("tenant_id", "product_code");

-- CreateIndex
CREATE UNIQUE INDEX "features_key_key" ON "features"("key");

-- CreateIndex
CREATE INDEX "features_application_id_idx" ON "features"("application_id");

-- CreateIndex
CREATE INDEX "instructor_experiences_tenant_id_instructor_id_idx" ON "instructor_experiences"("tenant_id", "instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_socials_instructor_id_key" ON "instructor_socials"("instructor_id");

-- CreateIndex
CREATE INDEX "instructor_socials_tenant_id_idx" ON "instructor_socials"("tenant_id");

-- CreateIndex
CREATE INDEX "instructors_tenant_id_idx" ON "instructors"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "instructors_tenant_id_user_id_key" ON "instructors"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_invoice_type_created_at_idx" ON "invoices"("tenant_id", "invoice_type", "created_at");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_member_id_created_at_idx" ON "invoices"("tenant_id", "member_id", "created_at");

-- CreateIndex
CREATE INDEX "lecture_dropoff_buckets_tenant_id_lecture_id_idx" ON "lecture_dropoff_buckets"("tenant_id", "lecture_id");

-- CreateIndex
CREATE INDEX "lecture_watch_sessions_tenant_id_course_id_started_at_idx" ON "lecture_watch_sessions"("tenant_id", "course_id", "started_at");

-- CreateIndex
CREATE INDEX "lecture_watch_sessions_tenant_id_lecture_id_started_at_idx" ON "lecture_watch_sessions"("tenant_id", "lecture_id", "started_at");

-- CreateIndex
CREATE INDEX "lecture_watch_sessions_tenant_id_started_at_idx" ON "lecture_watch_sessions"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "lecture_watch_sessions_tenant_id_tenant_member_id_started_a_idx" ON "lecture_watch_sessions"("tenant_id", "tenant_member_id", "started_at");

-- CreateIndex
CREATE INDEX "lectures_tenant_id_course_id_idx" ON "lectures"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "lectures_tenant_id_lesson_id_idx" ON "lectures"("tenant_id", "lesson_id");

-- CreateIndex
CREATE INDEX "lectures_tenant_id_video_key_idx" ON "lectures"("tenant_id", "video_key");

-- CreateIndex
CREATE INDEX "lesson_resources_tenant_id_course_id_idx" ON "lesson_resources"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "lesson_resources_tenant_id_lesson_id_sort_order_idx" ON "lesson_resources"("tenant_id", "lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "member_assignment_progress_tenant_id_course_id_idx" ON "member_assignment_progress"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "member_assignment_progress_tenant_id_tenant_member_id_cours_idx" ON "member_assignment_progress"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE INDEX "member_assignment_progress_tenant_id_tenant_member_id_idx" ON "member_assignment_progress"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_assignment_progress_tenant_id_tenant_member_id_assig_key" ON "member_assignment_progress"("tenant_id", "tenant_member_id", "assignment_id");

-- CreateIndex
CREATE INDEX "member_book_highlights_tenant_id_tenant_member_id_book_id_idx" ON "member_book_highlights"("tenant_id", "tenant_member_id", "book_id");

-- CreateIndex
CREATE INDEX "member_book_highlights_tenant_id_tenant_member_id_idx" ON "member_book_highlights"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_book_highlights_tenant_id_tenant_member_id_book_id_c_key" ON "member_book_highlights"("tenant_id", "tenant_member_id", "book_id", "cfi_range");

-- CreateIndex
CREATE INDEX "member_book_page_bookmarks_tenant_id_tenant_member_id_book__idx" ON "member_book_page_bookmarks"("tenant_id", "tenant_member_id", "book_id");

-- CreateIndex
CREATE INDEX "member_book_page_bookmarks_tenant_id_tenant_member_id_idx" ON "member_book_page_bookmarks"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_book_page_bookmarks_tenant_id_tenant_member_id_book__key" ON "member_book_page_bookmarks"("tenant_id", "tenant_member_id", "book_id", "cfi_location");

-- CreateIndex
CREATE INDEX "member_book_progress_tenant_id_tenant_member_id_idx" ON "member_book_progress"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_book_progress_tenant_id_tenant_member_id_book_id_key" ON "member_book_progress"("tenant_id", "tenant_member_id", "book_id");

-- CreateIndex
CREATE INDEX "member_bookmarks_tenant_id_created_at_idx" ON "member_bookmarks"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "member_bookmarks_tenant_id_tenant_member_id_bookmark_type_idx" ON "member_bookmarks"("tenant_id", "tenant_member_id", "bookmark_type");

-- CreateIndex
CREATE INDEX "member_bookmarks_tenant_id_tenant_member_id_idx" ON "member_bookmarks"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "member_lecture_progress_tenant_id_course_id_idx" ON "member_lecture_progress"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "member_lecture_progress_tenant_id_last_watched_at_idx" ON "member_lecture_progress"("tenant_id", "last_watched_at");

-- CreateIndex
CREATE INDEX "member_lecture_progress_tenant_id_tenant_member_id_course_i_idx" ON "member_lecture_progress"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_lecture_progress_tenant_id_tenant_member_id_lecture__key" ON "member_lecture_progress"("tenant_id", "tenant_member_id", "lecture_id");

-- CreateIndex
CREATE INDEX "member_lesson_progress_tenant_id_course_id_idx" ON "member_lesson_progress"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "member_lesson_progress_tenant_id_tenant_member_id_course_id_idx" ON "member_lesson_progress"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE INDEX "member_lesson_progress_tenant_id_tenant_member_id_idx" ON "member_lesson_progress"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_lesson_progress_tenant_id_tenant_member_id_lesson_id_key" ON "member_lesson_progress"("tenant_id", "tenant_member_id", "lesson_id");

-- CreateIndex
CREATE INDEX "member_notifications_tenant_id_member_id_is_read_created_at_idx" ON "member_notifications"("tenant_id", "member_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "member_notifications_tenant_id_member_id_type_created_at_idx" ON "member_notifications"("tenant_id", "member_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "member_payment_details_tenant_id_tenant_member_id_idx" ON "member_payment_details"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_payment_details_tenant_id_tenant_member_id_type_key" ON "member_payment_details"("tenant_id", "tenant_member_id", "type");

-- CreateIndex
CREATE INDEX "member_quiz_progress_tenant_id_course_id_idx" ON "member_quiz_progress"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "member_quiz_progress_tenant_id_tenant_member_id_course_id_idx" ON "member_quiz_progress"("tenant_id", "tenant_member_id", "course_id");

-- CreateIndex
CREATE INDEX "member_quiz_progress_tenant_id_tenant_member_id_idx" ON "member_quiz_progress"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_quiz_progress_tenant_id_tenant_member_id_quiz_id_key" ON "member_quiz_progress"("tenant_id", "tenant_member_id", "quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_idempotency_key_key" ON "payment_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_orders_gateway_order_id_idx" ON "payment_orders"("gateway_order_id");

-- CreateIndex
CREATE INDEX "payment_orders_gateway_payment_id_idx" ON "payment_orders"("gateway_payment_id");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_created_at_idx" ON "payment_orders"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_currency_created_at_idx" ON "payment_orders"("tenant_id", "currency", "created_at");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_item_id_idx" ON "payment_orders"("tenant_id", "item_id");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_status_idx" ON "payment_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_status_paid_at_idx" ON "payment_orders"("tenant_id", "status", "paid_at");

-- CreateIndex
CREATE INDEX "payment_orders_tenant_id_tenant_member_id_idx" ON "payment_orders"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_tenant_id_order_number_key" ON "payment_orders"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "payment_receipt_items_receipt_id_idx" ON "payment_receipt_items"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receipt_number_key" ON "payment_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "payment_receipts_created_at_idx" ON "payment_receipts"("created_at");

-- CreateIndex
CREATE INDEX "payment_receipts_status_idx" ON "payment_receipts"("status");

-- CreateIndex
CREATE INDEX "payment_receipts_tenant_id_idx" ON "payment_receipts"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_status_created_at_idx" ON "payment_webhook_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_tenant_id_status_idx" ON "payment_webhook_events"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_tenant_id_provider_name_event_id_key" ON "payment_webhook_events"("tenant_id", "provider_name", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_subscription_checkouts_external_subscription_id_key" ON "pending_subscription_checkouts"("external_subscription_id");

-- CreateIndex
CREATE INDEX "pending_subscription_checkouts_created_at_idx" ON "pending_subscription_checkouts"("created_at");

-- CreateIndex
CREATE INDEX "pending_subscription_checkouts_external_subscription_id_idx" ON "pending_subscription_checkouts"("external_subscription_id");

-- CreateIndex
CREATE INDEX "pending_subscription_checkouts_tenant_id_idx" ON "pending_subscription_checkouts"("tenant_id");

-- CreateIndex
CREATE INDEX "plan_applications_application_id_idx" ON "plan_applications"("application_id");

-- CreateIndex
CREATE INDEX "plan_applications_plan_id_idx" ON "plan_applications"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_applications_plan_id_application_id_key" ON "plan_applications"("plan_id", "application_id");

-- CreateIndex
CREATE INDEX "plan_version_billing_mappings_billing_provider_id_idx" ON "plan_version_billing_mappings"("billing_provider_id");

-- CreateIndex
CREATE INDEX "plan_version_billing_mappings_plan_version_id_idx" ON "plan_version_billing_mappings"("plan_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_version_billing_mappings_plan_version_id_billing_provi_key" ON "plan_version_billing_mappings"("plan_version_id", "billing_provider_id", "billing_cycle", "currency");

-- CreateIndex
CREATE INDEX "plan_version_products_plan_version_id_idx" ON "plan_version_products"("plan_version_id");

-- CreateIndex
CREATE INDEX "plan_version_products_product_id_idx" ON "plan_version_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_version_products_plan_version_id_product_id_key" ON "plan_version_products"("plan_version_id", "product_id");

-- CreateIndex
CREATE INDEX "plan_versions_plan_id_idx" ON "plan_versions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_versions_plan_id_version_key" ON "plan_versions"("plan_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "platform_exchange_rates_base_currency_quote_currency_fetche_idx" ON "platform_exchange_rates"("base_currency", "quote_currency", "fetched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "platform_notification_suppressions_email_key" ON "platform_notification_suppressions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_notification_suppressions_phone_key" ON "platform_notification_suppressions"("phone");

-- CreateIndex
CREATE INDEX "platform_notification_suppressions_email_idx" ON "platform_notification_suppressions"("email");

-- CreateIndex
CREATE INDEX "platform_notification_suppressions_phone_idx" ON "platform_notification_suppressions"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_feature_id_idx" ON "products"("feature_id");

-- CreateIndex
CREATE INDEX "question_serve_stats_tenant_id_owner_type_owner_id_idx" ON "question_serve_stats"("tenant_id", "owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_serve_stats_tenant_id_owner_type_owner_id_question_key" ON "question_serve_stats"("tenant_id", "owner_type", "owner_id", "question_id");

-- CreateIndex
CREATE INDEX "question_upload_assets_tenant_id_created_at_idx" ON "question_upload_assets"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "quiz_attempt_answers_tenant_id_attempt_id_idx" ON "quiz_attempt_answers"("tenant_id", "attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempt_answers_tenant_id_attempt_id_question_id_key" ON "quiz_attempt_answers"("tenant_id", "attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_tenant_id_course_id_idx" ON "quiz_attempts"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_tenant_id_created_at_idx" ON "quiz_attempts"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "quiz_attempts_tenant_id_quiz_id_idx" ON "quiz_attempts"("tenant_id", "quiz_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_tenant_id_tenant_member_id_quiz_id_idx" ON "quiz_attempts"("tenant_id", "tenant_member_id", "quiz_id");

-- CreateIndex
CREATE INDEX "quiz_options_tenant_id_question_id_idx" ON "quiz_options"("tenant_id", "question_id");

-- CreateIndex
CREATE INDEX "quiz_questions_tenant_id_quiz_id_idx" ON "quiz_questions"("tenant_id", "quiz_id");

-- CreateIndex
CREATE INDEX "quiz_questions_tenant_id_quiz_id_sort_order_idx" ON "quiz_questions"("tenant_id", "quiz_id", "sort_order");

-- CreateIndex
CREATE INDEX "quizzes_tenant_id_course_id_idx" ON "quizzes"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "quizzes_tenant_id_course_id_status_idx" ON "quizzes"("tenant_id", "course_id", "status");

-- CreateIndex
CREATE INDEX "quizzes_tenant_id_lesson_id_idx" ON "quizzes"("tenant_id", "lesson_id");

-- CreateIndex
CREATE INDEX "quizzes_tenant_id_section_id_idx" ON "quizzes"("tenant_id", "section_id");

-- CreateIndex
CREATE INDEX "quizzes_tenant_id_status_idx" ON "quizzes"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "refunds_gateway_refund_id_idx" ON "refunds"("gateway_refund_id");

-- CreateIndex
CREATE INDEX "refunds_tenant_id_order_id_idx" ON "refunds"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "refunds_tenant_id_status_idx" ON "refunds"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscription_events_event_type_idx" ON "subscription_events"("event_type");

-- CreateIndex
CREATE INDEX "subscription_events_subscription_id_idx" ON "subscription_events"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_events_tenant_id_idx" ON "subscription_events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_external_subscription_id_key" ON "subscriptions"("external_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_external_subscription_id_idx" ON "subscriptions"("external_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_addon_events_addon_id_idx" ON "tenant_addon_events"("addon_id");

-- CreateIndex
CREATE INDEX "tenant_addon_events_admin_id_idx" ON "tenant_addon_events"("admin_id");

-- CreateIndex
CREATE INDEX "tenant_addon_events_created_at_idx" ON "tenant_addon_events"("created_at");

-- CreateIndex
CREATE INDEX "tenant_addon_events_event_type_idx" ON "tenant_addon_events"("event_type");

-- CreateIndex
CREATE INDEX "tenant_addon_events_tenant_addon_id_idx" ON "tenant_addon_events"("tenant_addon_id");

-- CreateIndex
CREATE INDEX "tenant_addon_events_tenant_id_idx" ON "tenant_addon_events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_addons_addon_subscription_id_key" ON "tenant_addons"("addon_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_addons_entitlement_id_key" ON "tenant_addons"("entitlement_id");

-- CreateIndex
CREATE INDEX "tenant_addons_addon_id_idx" ON "tenant_addons"("addon_id");

-- CreateIndex
CREATE INDEX "tenant_addons_status_idx" ON "tenant_addons"("status");

-- CreateIndex
CREATE INDEX "tenant_addons_tenant_id_idx" ON "tenant_addons"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_addons_tenant_id_addon_id_status_key" ON "tenant_addons"("tenant_id", "addon_id", "status");

-- CreateIndex
CREATE INDEX "tenant_admin_otp_codes_expires_at_idx" ON "tenant_admin_otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "tenant_admin_otp_codes_user_id_identifier_channel_idx" ON "tenant_admin_otp_codes"("user_id", "identifier", "channel");

-- CreateIndex
CREATE INDEX "tenant_admin_signup_otp_codes_expires_at_idx" ON "tenant_admin_signup_otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "tenant_admin_signup_otp_codes_phone_created_at_idx" ON "tenant_admin_signup_otp_codes"("phone", "created_at");

-- CreateIndex
CREATE INDEX "tenant_application_events_admin_user_id_idx" ON "tenant_application_events"("admin_user_id");

-- CreateIndex
CREATE INDEX "tenant_application_events_application_id_idx" ON "tenant_application_events"("application_id");

-- CreateIndex
CREATE INDEX "tenant_application_events_created_at_idx" ON "tenant_application_events"("created_at");

-- CreateIndex
CREATE INDEX "tenant_application_events_event_type_idx" ON "tenant_application_events"("event_type");

-- CreateIndex
CREATE INDEX "tenant_application_events_tenant_application_id_idx" ON "tenant_application_events"("tenant_application_id");

-- CreateIndex
CREATE INDEX "tenant_application_events_tenant_id_idx" ON "tenant_application_events"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_applications_application_id_idx" ON "tenant_applications"("application_id");

-- CreateIndex
CREATE INDEX "tenant_applications_source_idx" ON "tenant_applications"("source");

-- CreateIndex
CREATE INDEX "tenant_applications_source_subscription_id_idx" ON "tenant_applications"("source_subscription_id");

-- CreateIndex
CREATE INDEX "tenant_applications_status_idx" ON "tenant_applications"("status");

-- CreateIndex
CREATE INDEX "tenant_applications_tenant_id_idx" ON "tenant_applications"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_applications_tenant_id_application_id_key" ON "tenant_applications"("tenant_id", "application_id");

-- CreateIndex
CREATE INDEX "tenant_audit_logs_created_at_idx" ON "tenant_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "tenant_audit_logs_tenant_id_action_created_at_idx" ON "tenant_audit_logs"("tenant_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "tenant_audit_logs_tenant_id_actor_user_id_created_at_idx" ON "tenant_audit_logs"("tenant_id", "actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_audit_logs_tenant_id_category_created_at_idx" ON "tenant_audit_logs"("tenant_id", "category", "created_at");

-- CreateIndex
CREATE INDEX "tenant_audit_logs_tenant_id_created_at_idx" ON "tenant_audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_audit_logs_tenant_id_resource_type_resource_id_idx" ON "tenant_audit_logs"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_auth_config_tenant_id_key" ON "tenant_auth_config"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_auth_config_tenant_id_idx" ON "tenant_auth_config"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_bulk_imports_tenant_id_created_at_idx" ON "tenant_bulk_imports"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_bulk_imports_tenant_id_scope_type_scope_id_idx" ON "tenant_bulk_imports"("tenant_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "tenant_certificate_assignments_tenant_id_idx" ON "tenant_certificate_assignments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_certificate_assignments_tenant_id_offering_type_key" ON "tenant_certificate_assignments"("tenant_id", "offering_type");

-- CreateIndex
CREATE INDEX "tenant_currencies_tenant_id_is_default_idx" ON "tenant_currencies"("tenant_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_currencies_tenant_id_currency_key" ON "tenant_currencies"("tenant_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_domain_name_key" ON "tenant_domains"("domain_name");

-- CreateIndex
CREATE INDEX "tenant_domains_domain_type_idx" ON "tenant_domains"("domain_type");

-- CreateIndex
CREATE INDEX "tenant_domains_status_idx" ON "tenant_domains"("status");

-- CreateIndex
CREATE INDEX "tenant_domains_tenant_id_idx" ON "tenant_domains"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_email_domain_health_checks_sending_domain_id_created_idx" ON "tenant_email_domain_health_checks"("sending_domain_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_messages_ses_message_id_key" ON "tenant_email_messages"("ses_message_id");

-- CreateIndex
CREATE INDEX "tenant_email_messages_tenant_id_campaign_id_idx" ON "tenant_email_messages"("tenant_id", "campaign_id");

-- CreateIndex
CREATE INDEX "tenant_email_messages_tenant_id_created_at_idx" ON "tenant_email_messages"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenant_email_messages_tenant_id_status_idx" ON "tenant_email_messages"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_messages_tenant_id_idempotency_key_key" ON "tenant_email_messages"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "tenant_email_reputation_events_tenant_id_created_at_idx" ON "tenant_email_reputation_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenant_email_reputation_events_trigger_idx" ON "tenant_email_reputation_events"("trigger");

-- CreateIndex
CREATE INDEX "tenant_email_sender_identities_sending_domain_id_idx" ON "tenant_email_sender_identities"("sending_domain_id");

-- CreateIndex
CREATE INDEX "tenant_email_sender_identities_tenant_id_status_idx" ON "tenant_email_sender_identities"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_sender_identities_tenant_id_email_address_key" ON "tenant_email_sender_identities"("tenant_id", "email_address");

-- CreateIndex
CREATE INDEX "tenant_email_sending_domains_status_idx" ON "tenant_email_sending_domains"("status");

-- CreateIndex
CREATE INDEX "tenant_email_sending_domains_tenant_id_idx" ON "tenant_email_sending_domains"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_sending_domains_tenant_id_subdomain_key" ON "tenant_email_sending_domains"("tenant_id", "subdomain");

-- CreateIndex
CREATE INDEX "tenant_email_suppressions_tenant_id_email_idx" ON "tenant_email_suppressions"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "tenant_email_suppressions_tenant_id_reason_idx" ON "tenant_email_suppressions"("tenant_id", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_suppressions_tenant_id_email_category_scope_key" ON "tenant_email_suppressions"("tenant_id", "email", "category_scope");

-- CreateIndex
CREATE INDEX "tenant_gateway_connections_status_idx" ON "tenant_gateway_connections"("status");

-- CreateIndex
CREATE INDEX "tenant_gateway_connections_tenant_id_idx" ON "tenant_gateway_connections"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_gateway_connections_tenant_id_is_active_idx" ON "tenant_gateway_connections"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tenant_member_form_config_tenant_id_active_sort_order_idx" ON "tenant_member_form_config"("tenant_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "tenant_member_form_config_tenant_id_idx" ON "tenant_member_form_config"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_member_form_responses_tenant_id_form_id_idx" ON "tenant_member_form_responses"("tenant_id", "form_id");

-- CreateIndex
CREATE INDEX "tenant_member_form_responses_tenant_id_idx" ON "tenant_member_form_responses"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_member_form_responses_tenant_id_member_id_idx" ON "tenant_member_form_responses"("tenant_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_form_responses_tenant_id_form_id_member_id_key" ON "tenant_member_form_responses"("tenant_id", "form_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_sessions_session_token_key" ON "tenant_member_sessions"("session_token");

-- CreateIndex
CREATE INDEX "tenant_member_sessions_session_token_idx" ON "tenant_member_sessions"("session_token");

-- CreateIndex
CREATE INDEX "tenant_member_sessions_tenant_id_member_id_idx" ON "tenant_member_sessions"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "tenant_member_sessions_tenant_id_member_id_is_active_idx" ON "tenant_member_sessions"("tenant_id", "member_id", "is_active");

-- CreateIndex
CREATE INDEX "tenant_members_status_idx" ON "tenant_members"("status");

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_idx" ON "tenant_members"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_joined_at_idx" ON "tenant_members"("tenant_id", "joined_at");

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_status_last_login_at_idx" ON "tenant_members"("tenant_id", "status", "last_login_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_email_key" ON "tenant_members"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_phone_key" ON "tenant_members"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "tenant_nav_items_tenant_id_idx" ON "tenant_nav_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_nav_items_tenant_id_feature_key_key" ON "tenant_nav_items"("tenant_id", "feature_key");

-- CreateIndex
CREATE INDEX "tenant_nudge_dismissals_tenant_id_idx" ON "tenant_nudge_dismissals"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_nudge_dismissals_tenant_id_nudge_id_key" ON "tenant_nudge_dismissals"("tenant_id", "nudge_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_org_details_tenant_id_key" ON "tenant_org_details"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_org_details_tenant_id_idx" ON "tenant_org_details"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_otp_codes_expires_at_idx" ON "tenant_otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "tenant_otp_codes_tenant_id_identifier_channel_idx" ON "tenant_otp_codes"("tenant_id", "identifier", "channel");

-- CreateIndex
CREATE INDEX "tenant_page_revisions_page_id_created_at_idx" ON "tenant_page_revisions"("page_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_page_revisions_tenant_id_page_id_idx" ON "tenant_page_revisions"("tenant_id", "page_id");

-- CreateIndex
CREATE INDEX "tenant_pages_tenant_id_idx" ON "tenant_pages"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_pages_tenant_id_is_published_idx" ON "tenant_pages"("tenant_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_pages_tenant_id_slug_key" ON "tenant_pages"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_password_resets_token_key" ON "tenant_password_resets"("token");

-- CreateIndex
CREATE INDEX "tenant_password_resets_tenant_id_email_idx" ON "tenant_password_resets"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "tenant_password_resets_tenant_id_idx" ON "tenant_password_resets"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_password_resets_token_idx" ON "tenant_password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_permissions_code_key" ON "tenant_permissions"("code");

-- CreateIndex
CREATE INDEX "tenant_permissions_category_idx" ON "tenant_permissions"("category");

-- CreateIndex
CREATE INDEX "tenant_permissions_code_idx" ON "tenant_permissions"("code");

-- CreateIndex
CREATE INDEX "tenant_role_permissions_permission_id_idx" ON "tenant_role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "tenant_role_permissions_role_id_idx" ON "tenant_role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "tenant_roles_code_idx" ON "tenant_roles"("code");

-- CreateIndex
CREATE INDEX "tenant_roles_tenant_id_idx" ON "tenant_roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_roles_tenant_id_code_key" ON "tenant_roles"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "tenant_staff_memberships_status_idx" ON "tenant_staff_memberships"("status");

-- CreateIndex
CREATE INDEX "tenant_staff_memberships_tenant_id_idx" ON "tenant_staff_memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_staff_memberships_user_id_idx" ON "tenant_staff_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_staff_memberships_tenant_id_user_id_key" ON "tenant_staff_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "tenant_subscription_events_tenant_id_subscription_id_idx" ON "tenant_subscription_events"("tenant_id", "subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscription_events_tenant_id_gateway_event_id_key" ON "tenant_subscription_events"("tenant_id", "gateway_event_id");

-- CreateIndex
CREATE INDEX "tenant_subscription_plans_tenant_id_is_active_idx" ON "tenant_subscription_plans"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscription_plans_tenant_id_gateway_plan_id_key" ON "tenant_subscription_plans"("tenant_id", "gateway_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscription_settings_tenant_id_key" ON "tenant_subscription_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_usage_counters_tenant_id_product_code_idx" ON "tenant_usage_counters"("tenant_id", "product_code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_counters_tenant_id_product_code_scope_type_sco_key" ON "tenant_usage_counters"("tenant_id", "product_code", "scope_type", "scope_id", "window_type", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_events_idempotency_key_key" ON "tenant_usage_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "tenant_usage_events_resource_type_resource_id_idx" ON "tenant_usage_events"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "tenant_usage_events_tenant_id_created_at_idx" ON "tenant_usage_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_usage_events_tenant_id_product_code_idx" ON "tenant_usage_events"("tenant_id", "product_code");

-- CreateIndex
CREATE INDEX "tenant_user_roles_membership_id_idx" ON "tenant_user_roles"("membership_id");

-- CreateIndex
CREATE INDEX "tenant_user_roles_role_id_idx" ON "tenant_user_roles"("role_id");

-- CreateIndex
CREATE INDEX "tenant_user_subscriptions_status_grace_period_ends_at_idx" ON "tenant_user_subscriptions"("status", "grace_period_ends_at");

-- CreateIndex
CREATE INDEX "tenant_user_subscriptions_status_next_charge_at_idx" ON "tenant_user_subscriptions"("status", "next_charge_at");

-- CreateIndex
CREATE INDEX "tenant_user_subscriptions_tenant_id_member_id_idx" ON "tenant_user_subscriptions"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "tenant_user_subscriptions_tenant_id_status_idx" ON "tenant_user_subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_subscriptions_tenant_id_gateway_subscription_id_key" ON "tenant_user_subscriptions"("tenant_id", "gateway_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_email_key" ON "tenant_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_phone_key" ON "tenant_users"("phone");

-- CreateIndex
CREATE INDEX "tenant_users_email_idx" ON "tenant_users"("email");

-- CreateIndex
CREATE INDEX "tenant_users_phone_verified_idx" ON "tenant_users"("phone_verified");

-- CreateIndex
CREATE INDEX "tenant_users_status_idx" ON "tenant_users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_oauth_provider_oauth_provider_id_key" ON "tenant_users"("oauth_provider", "oauth_provider_id");

-- CreateIndex
CREATE INDEX "tenant_watch_time_daily_tenant_id_course_id_date_idx" ON "tenant_watch_time_daily"("tenant_id", "course_id", "date");

-- CreateIndex
CREATE INDEX "tenant_watch_time_daily_tenant_id_date_idx" ON "tenant_watch_time_daily"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_custom_domain_key" ON "tenants"("custom_domain");

-- CreateIndex
CREATE INDEX "tenants_owner_user_id_idx" ON "tenants"("owner_user_id");

-- CreateIndex
CREATE INDEX "test_attempt_answers_tenant_id_attempt_id_idx" ON "test_attempt_answers"("tenant_id", "attempt_id");

-- CreateIndex
CREATE INDEX "test_attempt_answers_tenant_id_grading_status_idx" ON "test_attempt_answers"("tenant_id", "grading_status");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempt_answers_attempt_id_question_id_key" ON "test_attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "test_attempt_modules_tenant_id_attempt_id_order_index_idx" ON "test_attempt_modules"("tenant_id", "attempt_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempt_modules_attempt_id_module_id_key" ON "test_attempt_modules"("attempt_id", "module_id");

-- CreateIndex
CREATE INDEX "test_attempts_tenant_id_grading_status_idx" ON "test_attempts"("tenant_id", "grading_status");

-- CreateIndex
CREATE INDEX "test_attempts_tenant_id_learner_id_idx" ON "test_attempts"("tenant_id", "learner_id");

-- CreateIndex
CREATE INDEX "test_attempts_tenant_id_test_id_score_idx" ON "test_attempts"("tenant_id", "test_id", "score");

-- CreateIndex
CREATE INDEX "test_attempts_tenant_id_test_id_status_idx" ON "test_attempts"("tenant_id", "test_id", "status");

-- CreateIndex
CREATE INDEX "test_attempts_tenant_id_test_series_id_idx" ON "test_attempts"("tenant_id", "test_series_id");

-- CreateIndex
CREATE INDEX "test_bookmarks_tenant_id_learner_id_idx" ON "test_bookmarks"("tenant_id", "learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_bookmarks_tenant_id_learner_id_question_id_key" ON "test_bookmarks"("tenant_id", "learner_id", "question_id");

-- CreateIndex
CREATE INDEX "test_certificates_tenant_id_status_idx" ON "test_certificates"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "test_certificates_tenant_id_tenant_member_id_idx" ON "test_certificates"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "test_certificates_tenant_id_test_id_idx" ON "test_certificates"("tenant_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_certificates_tenant_id_certificate_number_key" ON "test_certificates"("tenant_id", "certificate_number");

-- CreateIndex
CREATE INDEX "test_coupons_tenant_id_test_series_id_idx" ON "test_coupons"("tenant_id", "test_series_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_coupons_tenant_id_code_key" ON "test_coupons"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "test_exam_rank_curves_tenant_id_exam_name_idx" ON "test_exam_rank_curves"("tenant_id", "exam_name");

-- CreateIndex
CREATE INDEX "test_exam_rank_curves_tenant_id_idx" ON "test_exam_rank_curves"("tenant_id");

-- CreateIndex
CREATE INDEX "test_module_questions_tenant_id_module_id_order_index_idx" ON "test_module_questions"("tenant_id", "module_id", "order_index");

-- CreateIndex
CREATE INDEX "test_module_questions_tenant_id_test_id_idx" ON "test_module_questions"("tenant_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_module_questions_module_id_question_id_key" ON "test_module_questions"("module_id", "question_id");

-- CreateIndex
CREATE INDEX "test_module_score_scales_tenant_id_test_id_idx" ON "test_module_score_scales"("tenant_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_module_score_scales_section_id_path_key_key" ON "test_module_score_scales"("section_id", "path_key");

-- CreateIndex
CREATE INDEX "test_modules_tenant_id_section_id_idx" ON "test_modules"("tenant_id", "section_id");

-- CreateIndex
CREATE INDEX "test_modules_tenant_id_test_id_idx" ON "test_modules"("tenant_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_modules_section_id_stage_no_variant_key" ON "test_modules"("section_id", "stage_no", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "test_norm_tables_test_id_key" ON "test_norm_tables"("test_id");

-- CreateIndex
CREATE INDEX "test_norm_tables_tenant_id_test_id_idx" ON "test_norm_tables"("tenant_id", "test_id");

-- CreateIndex
CREATE INDEX "test_question_banks_tenant_id_created_at_idx" ON "test_question_banks"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "test_question_banks_tenant_id_idx" ON "test_question_banks"("tenant_id");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_chapter_node_id_idx" ON "test_questions"("tenant_id", "chapter_node_id");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_difficulty_idx" ON "test_questions"("tenant_id", "difficulty");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_question_bank_id_created_at_idx" ON "test_questions"("tenant_id", "question_bank_id", "created_at");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_status_idx" ON "test_questions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_subject_chapter_topic_idx" ON "test_questions"("tenant_id", "subject", "chapter", "topic");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_subject_node_id_idx" ON "test_questions"("tenant_id", "subject_node_id");

-- CreateIndex
CREATE INDEX "test_questions_tenant_id_topic_node_id_idx" ON "test_questions"("tenant_id", "topic_node_id");

-- CreateIndex
CREATE INDEX "test_scholarship_awards_tenant_id_scholarship_id_idx" ON "test_scholarship_awards"("tenant_id", "scholarship_id");

-- CreateIndex
CREATE INDEX "test_scholarship_awards_tenant_id_status_idx" ON "test_scholarship_awards"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "test_scholarship_awards_scholarship_id_member_id_key" ON "test_scholarship_awards"("scholarship_id", "member_id");

-- CreateIndex
CREATE INDEX "test_scholarships_tenant_id_status_idx" ON "test_scholarships"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "test_scholarships_tenant_id_test_id_idx" ON "test_scholarships"("tenant_id", "test_id");

-- CreateIndex
CREATE INDEX "test_scholarships_tenant_id_test_series_id_idx" ON "test_scholarships"("tenant_id", "test_series_id");

-- CreateIndex
CREATE INDEX "test_section_questions_tenant_id_section_id_order_index_idx" ON "test_section_questions"("tenant_id", "section_id", "order_index");

-- CreateIndex
CREATE INDEX "test_section_questions_tenant_id_test_id_idx" ON "test_section_questions"("tenant_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_section_questions_section_id_question_id_key" ON "test_section_questions"("section_id", "question_id");

-- CreateIndex
CREATE INDEX "test_sections_tenant_id_test_id_idx" ON "test_sections"("tenant_id", "test_id");

-- CreateIndex
CREATE INDEX "test_sections_tenant_id_test_id_order_index_idx" ON "test_sections"("tenant_id", "test_id", "order_index");

-- CreateIndex
CREATE INDEX "test_series_tenant_id_pricing_type_idx" ON "test_series"("tenant_id", "pricing_type");

-- CreateIndex
CREATE INDEX "test_series_tenant_id_status_idx" ON "test_series"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "test_series_tenant_id_status_sort_order_created_at_idx" ON "test_series"("tenant_id", "status", "sort_order", "created_at");

-- CreateIndex
CREATE INDEX "test_series_tenant_id_visibility_idx" ON "test_series"("tenant_id", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "test_series_tenant_id_slug_key" ON "test_series"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "test_series_enrollments_tenant_id_tenant_member_id_idx" ON "test_series_enrollments"("tenant_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "test_series_enrollments_tenant_id_test_series_id_idx" ON "test_series_enrollments"("tenant_id", "test_series_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_series_enrollments_tenant_id_tenant_member_id_test_ser_key" ON "test_series_enrollments"("tenant_id", "tenant_member_id", "test_series_id");

-- CreateIndex
CREATE INDEX "test_series_tests_tenant_id_test_series_id_idx" ON "test_series_tests"("tenant_id", "test_series_id");

-- CreateIndex
CREATE INDEX "test_series_tests_tenant_id_test_series_id_order_index_idx" ON "test_series_tests"("tenant_id", "test_series_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "test_series_tests_test_series_id_test_id_key" ON "test_series_tests"("test_series_id", "test_id");

-- CreateIndex
CREATE INDEX "test_taxonomy_nodes_tenant_id_kind_idx" ON "test_taxonomy_nodes"("tenant_id", "kind");

-- CreateIndex
CREATE INDEX "test_taxonomy_nodes_tenant_id_parent_id_idx" ON "test_taxonomy_nodes"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "testimonials_tenant_id_idx" ON "testimonials"("tenant_id");

-- CreateIndex
CREATE INDEX "testimonials_tenant_id_status_idx" ON "testimonials"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tests_tenant_id_created_at_idx" ON "tests"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tests_tenant_id_idx" ON "tests"("tenant_id");

-- CreateIndex
CREATE INDEX "tests_tenant_id_status_idx" ON "tests"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_idempotency_key_key" ON "usage_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- CreateIndex
CREATE INDEX "usage_events_tenant_id_feature_key_idx" ON "usage_events"("tenant_id", "feature_key");

-- CreateIndex
CREATE INDEX "usage_events_tenant_id_product_code_idx" ON "usage_events"("tenant_id", "product_code");

-- CreateIndex
CREATE INDEX "content_translations_tenant_id_entity_type_entity_id_locale_idx" ON "content_translations"("tenant_id", "entity_type", "entity_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_tenant_id_entity_type_entity_id_locale_key" ON "content_translations"("tenant_id", "entity_type", "entity_id", "locale", "field");

-- CreateIndex
CREATE INDEX "tenant_locales_tenant_id_is_published_idx" ON "tenant_locales"("tenant_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_locales_tenant_id_locale_key" ON "tenant_locales"("tenant_id", "locale");

-- AddForeignKey
ALTER TABLE "addon_subscriptions" ADD CONSTRAINT "addon_subscriptions_billing_provider_id_fkey" FOREIGN KEY ("billing_provider_id") REFERENCES "billing_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addons" ADD CONSTRAINT "addons_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addons" ADD CONSTRAINT "addons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_evaluations" ADD CONSTRAINT "assignment_evaluations_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollments" ADD CONSTRAINT "batch_enrollments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollments" ADD CONSTRAINT "batch_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollments" ADD CONSTRAINT "batch_enrollments_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_leaderboard_snapshots" ADD CONSTRAINT "batch_leaderboard_snapshots_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_leaderboard_snapshots" ADD CONSTRAINT "batch_leaderboard_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_webhooks" ADD CONSTRAINT "billing_webhooks_billing_provider_id_fkey" FOREIGN KEY ("billing_provider_id") REFERENCES "billing_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_access" ADD CONSTRAINT "book_access_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_access" ADD CONSTRAINT "book_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_access" ADD CONSTRAINT "book_access_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_conversions" ADD CONSTRAINT "book_conversions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_recommendations" ADD CONSTRAINT "book_recommendations_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_certificates" ADD CONSTRAINT "bulk_certificates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "certificate_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_certificates" ADD CONSTRAINT "bulk_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_test_series_id_fkey" FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_order_items" ADD CONSTRAINT "cart_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_batches" ADD CONSTRAINT "certificate_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_prices" ADD CONSTRAINT "content_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_product_links" ADD CONSTRAINT "content_product_links_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_product_links" ADD CONSTRAINT "content_product_links_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_product_links" ADD CONSTRAINT "content_product_links_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_product_links" ADD CONSTRAINT "content_product_links_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_product_links" ADD CONSTRAINT "content_product_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_product_links" ADD CONSTRAINT "content_product_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_applicable_items" ADD CONSTRAINT "coupon_applicable_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_applicable_items" ADD CONSTRAINT "coupon_applicable_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_applicable_items" ADD CONSTRAINT "coupon_applicable_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_applicable_items" ADD CONSTRAINT "coupon_applicable_items_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_applicable_items" ADD CONSTRAINT "coupon_applicable_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_applicable_items" ADD CONSTRAINT "coupon_applicable_items_test_series_id_fkey" FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_faqs" ADD CONSTRAINT "course_faqs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_recommendations" ADD CONSTRAINT "course_recommendations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_review_votes" ADD CONSTRAINT "course_review_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "course_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_review_votes" ADD CONSTRAINT "course_review_votes_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_syllabus_items" ADD CONSTRAINT "course_syllabus_items_syllabus_section_id_fkey" FOREIGN KEY ("syllabus_section_id") REFERENCES "course_syllabus_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_syllabus_sections" ADD CONSTRAINT "course_syllabus_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_experiences" ADD CONSTRAINT "instructor_experiences_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_socials" ADD CONSTRAINT "instructor_socials_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_assignment_progress" ADD CONSTRAINT "member_assignment_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_assignment_progress" ADD CONSTRAINT "member_assignment_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_assignment_progress" ADD CONSTRAINT "member_assignment_progress_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_book_highlights" ADD CONSTRAINT "member_book_highlights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_book_highlights" ADD CONSTRAINT "member_book_highlights_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_book_page_bookmarks" ADD CONSTRAINT "member_book_page_bookmarks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_book_page_bookmarks" ADD CONSTRAINT "member_book_page_bookmarks_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_book_progress" ADD CONSTRAINT "member_book_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_book_progress" ADD CONSTRAINT "member_book_progress_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_bookmarks" ADD CONSTRAINT "member_bookmarks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_bookmarks" ADD CONSTRAINT "member_bookmarks_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lecture_progress" ADD CONSTRAINT "member_lecture_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lecture_progress" ADD CONSTRAINT "member_lecture_progress_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lecture_progress" ADD CONSTRAINT "member_lecture_progress_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lesson_progress" ADD CONSTRAINT "member_lesson_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lesson_progress" ADD CONSTRAINT "member_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lesson_progress" ADD CONSTRAINT "member_lesson_progress_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notifications" ADD CONSTRAINT "member_notifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notifications" ADD CONSTRAINT "member_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payment_details" ADD CONSTRAINT "member_payment_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payment_details" ADD CONSTRAINT "member_payment_details_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_quiz_progress" ADD CONSTRAINT "member_quiz_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_quiz_progress" ADD CONSTRAINT "member_quiz_progress_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_quiz_progress" ADD CONSTRAINT "member_quiz_progress_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_gateway_connection_id_fkey" FOREIGN KEY ("gateway_connection_id") REFERENCES "tenant_gateway_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipt_items" ADD CONSTRAINT "payment_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "payment_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_gateway_connection_id_fkey" FOREIGN KEY ("gateway_connection_id") REFERENCES "tenant_gateway_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_subscription_checkouts" ADD CONSTRAINT "pending_subscription_checkouts_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_subscription_checkouts" ADD CONSTRAINT "pending_subscription_checkouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_applications" ADD CONSTRAINT "plan_applications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_applications" ADD CONSTRAINT "plan_applications_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_billing_mappings" ADD CONSTRAINT "plan_version_billing_mappings_billing_provider_id_fkey" FOREIGN KEY ("billing_provider_id") REFERENCES "billing_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_billing_mappings" ADD CONSTRAINT "plan_version_billing_mappings_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_products" ADD CONSTRAINT "plan_version_products_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_products" ADD CONSTRAINT "plan_version_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "quiz_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_provider_id_fkey" FOREIGN KEY ("billing_provider_id") REFERENCES "billing_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addon_events" ADD CONSTRAINT "tenant_addon_events_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addon_events" ADD CONSTRAINT "tenant_addon_events_tenant_addon_id_fkey" FOREIGN KEY ("tenant_addon_id") REFERENCES "tenant_addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_addon_subscription_id_fkey" FOREIGN KEY ("addon_subscription_id") REFERENCES "addon_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_admin_otp_codes" ADD CONSTRAINT "tenant_admin_otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_application_events" ADD CONSTRAINT "tenant_application_events_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_application_events" ADD CONSTRAINT "tenant_application_events_tenant_application_id_fkey" FOREIGN KEY ("tenant_application_id") REFERENCES "tenant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_source_subscription_id_fkey" FOREIGN KEY ("source_subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_applications" ADD CONSTRAINT "tenant_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_auth_config" ADD CONSTRAINT "tenant_auth_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_bulk_imports" ADD CONSTRAINT "tenant_bulk_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_currencies" ADD CONSTRAINT "tenant_currencies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_domain_health_checks" ADD CONSTRAINT "tenant_email_domain_health_checks_sending_domain_id_fkey" FOREIGN KEY ("sending_domain_id") REFERENCES "tenant_email_sending_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_messages" ADD CONSTRAINT "tenant_email_messages_sender_identity_id_fkey" FOREIGN KEY ("sender_identity_id") REFERENCES "tenant_email_sender_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_messages" ADD CONSTRAINT "tenant_email_messages_sending_domain_id_fkey" FOREIGN KEY ("sending_domain_id") REFERENCES "tenant_email_sending_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_messages" ADD CONSTRAINT "tenant_email_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_reputation_events" ADD CONSTRAINT "tenant_email_reputation_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_sender_identities" ADD CONSTRAINT "tenant_email_sender_identities_sending_domain_id_fkey" FOREIGN KEY ("sending_domain_id") REFERENCES "tenant_email_sending_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_sender_identities" ADD CONSTRAINT "tenant_email_sender_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_sending_domains" ADD CONSTRAINT "tenant_email_sending_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_suppressions" ADD CONSTRAINT "tenant_email_suppressions_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "tenant_email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_email_suppressions" ADD CONSTRAINT "tenant_email_suppressions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_gateway_connections" ADD CONSTRAINT "tenant_gateway_connections_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "billing_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_gateway_connections" ADD CONSTRAINT "tenant_gateway_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_form_config" ADD CONSTRAINT "tenant_member_form_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_form_responses" ADD CONSTRAINT "tenant_member_form_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "tenant_member_form_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_form_responses" ADD CONSTRAINT "tenant_member_form_responses_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_form_responses" ADD CONSTRAINT "tenant_member_form_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_sessions" ADD CONSTRAINT "tenant_member_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_sessions" ADD CONSTRAINT "tenant_member_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_nav_items" ADD CONSTRAINT "tenant_nav_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_nudge_dismissals" ADD CONSTRAINT "tenant_nudge_dismissals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_org_details" ADD CONSTRAINT "tenant_org_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_page_revisions" ADD CONSTRAINT "tenant_page_revisions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "tenant_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_page_revisions" ADD CONSTRAINT "tenant_page_revisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_pages" ADD CONSTRAINT "tenant_pages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_password_resets" ADD CONSTRAINT "tenant_password_resets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "tenant_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tenant_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_roles" ADD CONSTRAINT "tenant_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_staff_memberships" ADD CONSTRAINT "tenant_staff_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_staff_memberships" ADD CONSTRAINT "tenant_staff_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscription_events" ADD CONSTRAINT "tenant_subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "tenant_user_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscription_events" ADD CONSTRAINT "tenant_subscription_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscription_plans" ADD CONSTRAINT "tenant_subscription_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscription_settings" ADD CONSTRAINT "tenant_subscription_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_usage_counters" ADD CONSTRAINT "tenant_usage_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "tenant_staff_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tenant_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_subscriptions" ADD CONSTRAINT "tenant_user_subscriptions_gateway_connection_id_fkey" FOREIGN KEY ("gateway_connection_id") REFERENCES "tenant_gateway_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_subscriptions" ADD CONSTRAINT "tenant_user_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_subscriptions" ADD CONSTRAINT "tenant_user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "tenant_subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_subscriptions" ADD CONSTRAINT "tenant_user_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_modules" ADD CONSTRAINT "test_attempt_modules_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_modules" ADD CONSTRAINT "test_attempt_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "test_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_series_id_fkey" FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_bookmarks" ADD CONSTRAINT "test_bookmarks_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_bookmarks" ADD CONSTRAINT "test_bookmarks_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_bookmarks" ADD CONSTRAINT "test_bookmarks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_bookmarks" ADD CONSTRAINT "test_bookmarks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_coupons" ADD CONSTRAINT "test_coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_coupons" ADD CONSTRAINT "test_coupons_test_series_id_fkey" FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_exam_rank_curves" ADD CONSTRAINT "test_exam_rank_curves_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_module_questions" ADD CONSTRAINT "test_module_questions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "test_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_module_questions" ADD CONSTRAINT "test_module_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_module_questions" ADD CONSTRAINT "test_module_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_module_score_scales" ADD CONSTRAINT "test_module_score_scales_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "test_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_module_score_scales" ADD CONSTRAINT "test_module_score_scales_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_modules" ADD CONSTRAINT "test_modules_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "test_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_modules" ADD CONSTRAINT "test_modules_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_norm_tables" ADD CONSTRAINT "test_norm_tables_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question_banks" ADD CONSTRAINT "test_question_banks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_chapter_node_id_fkey" FOREIGN KEY ("chapter_node_id") REFERENCES "test_taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_bank_id_fkey" FOREIGN KEY ("question_bank_id") REFERENCES "test_question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_subject_node_id_fkey" FOREIGN KEY ("subject_node_id") REFERENCES "test_taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_topic_node_id_fkey" FOREIGN KEY ("topic_node_id") REFERENCES "test_taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_section_questions" ADD CONSTRAINT "test_section_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_section_questions" ADD CONSTRAINT "test_section_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "test_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_section_questions" ADD CONSTRAINT "test_section_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sections" ADD CONSTRAINT "test_sections_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series" ADD CONSTRAINT "test_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series_enrollments" ADD CONSTRAINT "test_series_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series_enrollments" ADD CONSTRAINT "test_series_enrollments_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series_enrollments" ADD CONSTRAINT "test_series_enrollments_test_series_id_fkey" FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series_tests" ADD CONSTRAINT "test_series_tests_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series_tests" ADD CONSTRAINT "test_series_tests_test_series_id_fkey" FOREIGN KEY ("test_series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_taxonomy_nodes" ADD CONSTRAINT "test_taxonomy_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "test_taxonomy_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_target_rank_curve_id_fkey" FOREIGN KEY ("target_rank_curve_id") REFERENCES "test_exam_rank_curves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_locales" ADD CONSTRAINT "tenant_locales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

