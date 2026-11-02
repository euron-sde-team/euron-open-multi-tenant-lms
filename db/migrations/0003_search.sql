-- Learner search: one materialized view over published courses, books and
-- bundles, with full-text and trigram indexes. Read by
-- apps/learner-api/src/repositories/search.repository.ts.
--
-- Refresh: learner-api runs REFRESH MATERIALIZED VIEW CONCURRENTLY
-- tenant_search_mv every 5 minutes on cluster worker 1 (src/index.ts), guarded
-- by a session advisory lock so only one process refreshes at a time.
-- CONCURRENTLY needs the unique index tsm_unique_idx below. Newly published
-- content therefore appears in search within about 5 minutes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Plain view: unions all published content types.
CREATE OR REPLACE VIEW tenant_search_view AS

-- Courses (published only)
SELECT
  c.id,
  c.tenant_id,
  c.title,
  c.subtitle,
  c.description,
  c.slug,
  c.thumbnail_key AS thumbnail,
  'COURSE'::text AS content_type,
  c.mode::text AS mode,
  c.difficulty::text AS difficulty,
  c.purchase_mode::text AS purchase_mode,
  c.price_inr,
  c.price_usd,
  c.discount_inr,
  c.discount_usd,
  c.language,
  COALESCE(
    (SELECT array_agg(DISTINCT cat.name)
     FROM course_categories cc
     JOIN categories cat ON cat.id = cc.category_id
     WHERE cc.course_id = c.id AND cc.tenant_id = c.tenant_id),
    '{}'::text[]
  ) AS categories,
  COALESCE(
    (SELECT json_agg(
       json_build_object('id', i.id, 'name', tu.name, 'avatar_url', tu.avatar_url)
       ORDER BY ci.sort_order
     )
     FROM course_instructors ci
     JOIN instructors i ON i.id = ci.instructor_id
     JOIN tenant_users tu ON tu.id = i.user_id
     WHERE ci.course_id = c.id AND ci.tenant_id = c.tenant_id),
    '[]'::json
  ) AS instructors_json,
  COALESCE(
    (SELECT array_agg(tu.name)
     FROM course_instructors ci
     JOIN instructors i ON i.id = ci.instructor_id
     JOIN tenant_users tu ON tu.id = i.user_id
     WHERE ci.course_id = c.id AND ci.tenant_id = c.tenant_id),
    '{}'::text[]
  ) AS instructor_names,
  c.created_at
FROM courses c
WHERE c.status = 'PUBLISHED'

UNION ALL

-- Books (published only)
SELECT
  b.id,
  b.tenant_id,
  b.title,
  NULL AS subtitle,
  b.description,
  b.slug,
  b.thumbnail_url AS thumbnail,
  'BOOK' AS content_type,
  NULL AS mode,
  NULL AS difficulty,
  b.purchase_mode::text AS purchase_mode,
  b.price_inr,
  b.price_usd,
  b.discount_inr,
  b.discount_usd,
  b.language,
  COALESCE(
    (SELECT array_agg(DISTINCT cat.name)
     FROM book_categories bc
     JOIN categories cat ON cat.id = bc.category_id
     WHERE bc.book_id = b.id AND bc.tenant_id = b.tenant_id),
    '{}'::text[]
  ) AS categories,
  COALESCE(
    (SELECT json_agg(
       json_build_object('id', i.id, 'name', tu.name, 'avatar_url', tu.avatar_url)
       ORDER BY ba.sort_order
     )
     FROM book_authors ba
     JOIN instructors i ON i.id = ba.instructor_id
     JOIN tenant_users tu ON tu.id = i.user_id
     WHERE ba.book_id = b.id AND ba.tenant_id = b.tenant_id),
    '[]'::json
  ) AS instructors_json,
  COALESCE(
    (SELECT array_agg(tu.name)
     FROM book_authors ba
     JOIN instructors i ON i.id = ba.instructor_id
     JOIN tenant_users tu ON tu.id = i.user_id
     WHERE ba.book_id = b.id AND ba.tenant_id = b.tenant_id),
    '{}'::text[]
  ) AS instructor_names,
  b.created_at
FROM books b
WHERE b.status = 'PUBLISHED'

UNION ALL

-- Bundles (published only)
SELECT
  bu.id,
  bu.tenant_id,
  bu.title,
  bu.subtitle,
  bu.description,
  bu.slug,
  bu.thumbnail_url AS thumbnail,
  'BUNDLE' AS content_type,
  NULL AS mode,
  NULL AS difficulty,
  bu.purchase_mode::text AS purchase_mode,
  bu.price_inr,
  bu.price_usd,
  bu.discount_inr,
  bu.discount_usd,
  '{}'::text[] AS language,
  '{}'::text[] AS categories,
  '[]'::json AS instructors_json,
  '{}'::text[] AS instructor_names,
  bu.created_at
FROM bundles bu
WHERE bu.status = 'PUBLISHED';

-- Materialized view with the search vector.
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_search_mv AS
SELECT
  *,
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(subtitle, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    array_to_string(instructor_names, ' ')
  ) AS search_vector
FROM tenant_search_view;

-- Unique index (required for REFRESH CONCURRENTLY).
CREATE UNIQUE INDEX IF NOT EXISTS tsm_unique_idx ON tenant_search_mv(id, content_type);

-- Full-text and fuzzy matching.
CREATE INDEX IF NOT EXISTS tsm_search_vector_idx ON tenant_search_mv USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS tsm_title_trgm_idx ON tenant_search_mv USING GIN(title gin_trgm_ops);

-- Tenant isolation and filters.
CREATE INDEX IF NOT EXISTS tsm_tenant_id_idx ON tenant_search_mv(tenant_id);
CREATE INDEX IF NOT EXISTS tsm_tenant_content_idx ON tenant_search_mv(tenant_id, content_type);
CREATE INDEX IF NOT EXISTS tsm_mode_idx ON tenant_search_mv(mode);
CREATE INDEX IF NOT EXISTS tsm_purchase_mode_idx ON tenant_search_mv(purchase_mode);
CREATE INDEX IF NOT EXISTS tsm_difficulty_idx ON tenant_search_mv(difficulty);
CREATE INDEX IF NOT EXISTS tsm_categories_idx ON tenant_search_mv USING GIN(categories);
CREATE INDEX IF NOT EXISTS tsm_language_idx ON tenant_search_mv USING GIN(language);
CREATE INDEX IF NOT EXISTS tsm_instructor_names_idx ON tenant_search_mv USING GIN(instructor_names);

-- Initial population (non-concurrent refresh is allowed inside the
-- migration transaction).
REFRESH MATERIALIZED VIEW tenant_search_mv;
