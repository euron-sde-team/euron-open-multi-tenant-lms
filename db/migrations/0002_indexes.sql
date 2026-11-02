-- Extensions, partial indexes Prisma cannot express, and read-path indexes
-- for the tenant analytics queries.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Exactly one default currency per tenant (multi-currency pricing).
CREATE UNIQUE INDEX IF NOT EXISTS tenant_currencies_one_default
  ON tenant_currencies (tenant_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_tenant_members_tid_joined
  ON tenant_members(tenant_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tid_status_login
  ON tenant_members(tenant_id, status, last_login_at);

CREATE INDEX IF NOT EXISTS idx_enrollments_tid_enrolled
  ON enrollments(tenant_id, enrolled_at);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tid_status_paid
  ON payment_orders(tenant_id, status, paid_at);

CREATE INDEX IF NOT EXISTS idx_mlp_tid_last_watched
  ON member_lecture_progress(tenant_id, last_watched_at);

CREATE INDEX IF NOT EXISTS idx_certificates_tid_issued
  ON certificates(tenant_id, issued_at);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_tid_created
  ON quiz_attempts(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_cart_items_tid_created
  ON cart_items(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_member_bookmarks_tid_created
  ON member_bookmarks(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tid_member_status
  ON payment_orders(tenant_id, tenant_member_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tid_type_item_status
  ON payment_orders(tenant_id, order_type, item_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tid_status_type
  ON payment_orders(tenant_id, status, order_type);

CREATE INDEX IF NOT EXISTS idx_enrollments_tid_member_enrolled
  ON enrollments(tenant_id, tenant_member_id, enrolled_at);

CREATE INDEX IF NOT EXISTS idx_enrollments_tid_course_status
  ON enrollments(tenant_id, course_id, status);

CREATE INDEX IF NOT EXISTS idx_book_access_tid_member_created
  ON book_access(tenant_id, tenant_member_id, created_at);

CREATE INDEX IF NOT EXISTS idx_book_access_tid_book
  ON book_access(tenant_id, book_id);

CREATE INDEX IF NOT EXISTS idx_certificates_tid_member_issued
  ON certificates(tenant_id, tenant_member_id, issued_at);

CREATE INDEX IF NOT EXISTS idx_certificates_tid_course
  ON certificates(tenant_id, course_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_tid_member
  ON cart_items(tenant_id, tenant_member_id);

CREATE INDEX IF NOT EXISTS idx_member_bookmarks_tid_member
  ON member_bookmarks(tenant_id, tenant_member_id);

CREATE INDEX IF NOT EXISTS idx_mbp_tid_book
  ON member_book_progress(tenant_id, book_id);

CREATE INDEX IF NOT EXISTS idx_mbp_tid_updated
  ON member_book_progress(tenant_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_member_book_highlights_tid_book
  ON member_book_highlights(tenant_id, book_id);

CREATE INDEX IF NOT EXISTS idx_mbpb_tid_book
  ON member_book_page_bookmarks(tenant_id, book_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_tid_product_event_created
  ON tenant_usage_events(tenant_id, product_code, event_type, created_at);

