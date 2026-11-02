/**
 * The action registry: what a request means, in words an owner can read.
 *
 * The middleware knows only `POST /tenant/courses/:id/publish`. This turns that
 * into "Priya published the course 'Python Masterclass'", which is the whole
 * point. An audit log of `POST /tenant/courses/:id/publish 200` is a web-server
 * access log; it doesn't answer "who unpublished my course?".
 *
 * ADDING A FEATURE: an entry here is OPTIONAL. Anything not named is still
 * logged, `deriveAuditAction()` below synthesises a summary from the shape of
 * the route ("created a bundle"). Name a route here when the phrasing matters:
 * money, access, or anything an owner would read twice.
 *
 * `scripts/validate-audit-coverage.ts` fails the build if any write route would
 * leave NO trace, and reports how many are named vs derived.
 */

/**
 * What the middleware knows at the moment it writes the entry. Enough to name
 * the people and things involved, rather than saying "a teammate".
 */
export interface AuditContext {
  /** Name of the thing acted on, from the response ("Test role"). */
  label: string | null;
  /** URL params, `:userId`, `:roleId`, the TARGET of a relationship change. */
  params: Record<string, string>;
  /** The request body: what it was changed TO. */
  body: Record<string, unknown>;
  /**
   * Resolved display names, looked up just before writing. Keyed by id, so a
   * summary can turn `roleIds: ["01H..."]` into "Educator, Finance".
   */
  names: Record<string, string>;
}

export interface AuditAction {
  /** Stable verb, e.g. "course.publish". Survives UI copy changes. */
  action: string;
  /** Which part of the app, drives the Activity Log's module filter. */
  category: string;
  /** What kind of thing was acted on, for "history of this course" views. */
  resourceType?: string;
  /**
   * The sentence, minus the actor's name (the service prepends that), in the
   * PAST tense: "published the course 'Python Masterclass'".
   * `label` is the resource's name at the time.
   */
  summary: (label: string | null, ctx?: AuditContext) => string;
  /**
   * The same sentence as a bare infinitive, for the denial case:
   * "Priya tried to PUBLISH the course …". Optional, when a summary reads the
   * same either way ("changed the branding"), omit it and we fall back to
   * `summary`.
   */
  attempt?: (label: string | null, ctx?: AuditContext) => string;
  /**
   * Don't record the request body for this action. Set it wherever the body
   * carries a secret (gateway keys, passwords), an audit log that leaks
   * credentials is worse than no audit log.
   */
  redactBody?: boolean;
  /**
   * Ids the middleware should resolve to display names before calling
   * `summary()`. Without this, a role assignment reads "changed which roles a
   * teammate has", true, useless, and identical to every other one.
   *
   *   users: ["userId"]        → params.userId  → "Afeefa Sheikh"
   *   roles: ["roleIds"]       → body.roleIds[] → "Educator, Finance"
   */
  resolve?: {
    users?: string[];
    roles?: string[];
    /** Capability ids → the plain-English sentence the admin ticked. */
    capabilities?: string[];
  };
}

/** `POST /tenant/courses/:id/publish` → the key `POST /courses/:id/publish`. */
export type AuditKey = string;

/**
 * "created the course X", or "created a course" when we couldn't name it.
 *
 * Takes BOTH tenses because a success reads "Priya created the role" while a
 * denial reads "Priya tried to CREATE the role". Both are spelled out rather
 * than derived: stripping "-ed" turns "created" into "creat", and English only
 * gets worse from there ("sent"/"send", "issued"/"issue", "reset"/"reset").
 * Two words per entry is a cheap price for a log that reads like English.
 */
function wrote(past: string, base: string, noun: string) {
  const phrase = (verb: string) => (label: string | null) =>
    `${verb} ${label ? `the ${noun} "${label}"` : `a ${noun}`}`;
  return { summary: phrase(past), attempt: phrase(base) };
}

/** The people/roles a context resolved, as a readable list. */
function listNames(ctx: AuditContext | undefined, ids: unknown): string {
  const arr = Array.isArray(ids) ? ids : ids ? [ids] : [];
  const names = arr
    .map((id) => (typeof id === "string" ? ctx?.names[id] : undefined))
    .filter((n): n is string => !!n);
  if (names.length === 0) return "no roles";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

/** The person a relationship change was aimed AT ("Afeefa Sheikh"). */
function target(ctx: AuditContext | undefined, param = "userId"): string {
  const id = ctx?.params[param];
  const name = id ? ctx?.names[id] : undefined;
  if (name) return name;

  // See rolePhrase(): on a denied request the params are gone but the resolved
  // name survives.
  const values = Object.values(ctx?.names ?? {});
  return values.length === 1 ? values[0] : "a teammate";
}

/**
 * The role a change was made to, as a phrase: `the "Educator" role`, or just
 * `a role` when we couldn't name it (a DELETE removes the row before we look).
 *
 * Returning a bare word and letting the caller wrap it in "the … role" produced
 * "the a role" the moment a lookup missed. The fallback has to own the whole
 * phrase, not a fragment of it.
 */
function rolePhrase(ctx: AuditContext | undefined, param = "roleId"): string {
  const id = ctx?.params[param];
  let name = id ? ctx?.names[id] : undefined;

  // On a DENIED request req.params is empty (requirePermission throws before the
  // router matches), so there is no id to look up, but the middleware resolved
  // the name from the URL anyway. Take it from there: for these routes the names
  // map holds exactly one entry, and it is the thing being acted on.
  if (!name) {
    const values = Object.values(ctx?.names ?? {});
    if (values.length === 1) name = values[0];
  }

  return name ? `the "${name}" role` : "a role";
}

export const AUDIT_ACTIONS: Record<AuditKey, AuditAction> = {
  // --- Courses & content -----------------------------------------------------
  "POST /courses": {
    action: "course.create",
    category: "Courses",
    resourceType: "COURSE",
    ...wrote("created", "create", "course"),
  },
  "PUT /courses/:courseId": {
    action: "course.update",
    category: "Courses",
    resourceType: "COURSE",
    ...wrote("edited", "edit", "course"),
  },
  "DELETE /courses/:courseId": {
    action: "course.delete",
    category: "Courses",
    resourceType: "COURSE",
    ...wrote("deleted", "delete", "course"),
  },
  // The app has ONE toggle route, not separate publish/unpublish endpoints.
  // The response tells us which way it went, so the summary reads correctly.
  "POST /courses/:courseId/toggle-publish": {
    action: "course.publish",
    category: "Courses",
    resourceType: "COURSE",
    // The body says which way it went, so SAY it. "changed whether the course
    // is live" makes the reader open Details to learn the one fact they wanted.
    summary: (l, ctx) =>
      `${ctx?.body.publish === false ? "unpublished" : "published"} the course${l ? ` "${l}"` : ""}`,
    attempt: (l) => `publish or unpublish the course${l ? ` "${l}"` : ""}`,
  },
  "POST /books/:bookId/toggle-publish": {
    action: "book.publish",
    category: "Books",
    resourceType: "BOOK",
    // The body says which way it went, so SAY it. "changed whether the course
    // is live" makes the reader open Details to learn the one fact they wanted.
    summary: (l, ctx) =>
      `${ctx?.body.publish === false ? "unpublished" : "published"} the book${l ? ` "${l}"` : ""}`,
    attempt: (l) => `publish or unpublish the book${l ? ` "${l}"` : ""}`,
  },
  "POST /bundles/:bundleId/toggle-publish": {
    action: "bundle.publish",
    category: "Bundles",
    resourceType: "BUNDLE",
    // The body says which way it went, so SAY it. "changed whether the course
    // is live" makes the reader open Details to learn the one fact they wanted.
    summary: (l, ctx) =>
      `${ctx?.body.publish === false ? "unpublished" : "published"} the bundle${l ? ` "${l}"` : ""}`,
    attempt: (l) => `publish or unpublish the bundle${l ? ` "${l}"` : ""}`,
  },

  "POST /books": {
    action: "book.create",
    category: "Books",
    resourceType: "BOOK",
    ...wrote("created", "create", "book"),
  },
  "PUT /books/:bookId": {
    action: "book.update",
    category: "Books",
    resourceType: "BOOK",
    ...wrote("edited", "edit", "book"),
  },
  "DELETE /books/:bookId": {
    action: "book.delete",
    category: "Books",
    resourceType: "BOOK",
    ...wrote("deleted", "delete", "book"),
  },

  "POST /bundles": {
    action: "bundle.create",
    category: "Bundles",
    resourceType: "BUNDLE",
    ...wrote("created", "create", "bundle"),
  },
  "PUT /bundles/:bundleId": {
    action: "bundle.update",
    category: "Bundles",
    resourceType: "BUNDLE",
    ...wrote("edited", "edit", "bundle"),
  },
  "DELETE /bundles/:bundleId": {
    action: "bundle.delete",
    category: "Bundles",
    resourceType: "BUNDLE",
    ...wrote("deleted", "delete", "bundle"),
  },

  // --- Learners --------------------------------------------------------------
  "POST /members": {
    action: "member.create",
    category: "Learners",
    resourceType: "MEMBER",
    ...wrote("added", "add", "learner"),
  },


  // --- Money -----------------------------------------------------------------
  // The half of the log an owner reads first.
  "POST /coupons": {
    action: "coupon.create",
    category: "Payments",
    resourceType: "COUPON",
    ...wrote("created", "create", "coupon"),
  },
  "PUT /coupons/:id": {
    action: "coupon.update",
    category: "Payments",
    resourceType: "COUPON",
    ...wrote("edited", "edit", "coupon"),
  },
  "DELETE /coupons/:id": {
    action: "coupon.delete",
    category: "Payments",
    resourceType: "COUPON",
    ...wrote("deleted", "delete", "coupon"),
  },

  // Gateway credentials, the body carries API keys, so never record it.
  "POST /payment/gateway-connections": {
    action: "gateway.connect",
    category: "Payments",
    summary: () => "connected a payment gateway",
    attempt: () => "connect a payment gateway",
    redactBody: true,
  },
  "DELETE /payment/gateway-connections/:id": {
    action: "gateway.disconnect",
    category: "Payments",
    summary: () => "disconnected a payment gateway",
    attempt: () => "disconnect a payment gateway",
  },
  "POST /organization": {
    action: "settings.organisation",
    category: "Settings",
    summary: () => "changed the organisation settings",
    attempt: () => "change the organisation settings",
  },
  // A binary toggle that hides the entire public catalog. The body says which
  // way it went, so say it: "edited a course visibility setting" would make the
  // reader open Details to learn the one fact they wanted.
  "PUT /enrolled-courses-settings": {
    action: "settings.enrolled_courses_only",
    category: "Settings",
    summary: (_l, ctx) =>
      ctx?.body.enrolled_courses_only_enabled === true
        ? "restricted learners to their enrolled courses only (public catalog hidden)"
        : "made the full course catalog visible to learners again",
    attempt: () => "change whether learners see only their enrolled courses",
  },
  // Another binary toggle, and the one an admin will question later: "who
  // turned off the order I spent an afternoon arranging?" Turning it OFF never
  // discards that arrangement, so say so here, the reader's next worry after
  // seeing this line is whether their work survived.
  "PUT /ordered-products/settings": {
    action: "settings.ordered_products",
    category: "Settings",
    summary: (_l, ctx) =>
      ctx?.body.enabled === true
        ? "turned on ordered products (the catalog now follows the arrangement admins set)"
        : "turned off ordered products (the saved arrangement is kept, just not applied)",
    attempt: () => "change whether the catalog follows the admin-defined order",
  },

  // --- Platform plan ---------------------------------------------------------
  // Opening the Razorpay payment that renews the tenant's own plan. The payment
  // itself lands by webhook; this is who started it.
  "POST /subscriptions/renew": {
    action: "subscription.renew.start",
    category: "Payments",
    resourceType: "SUBSCRIPTION",
    summary: () => "started the payment to renew the plan",
    attempt: () => "start the payment to renew the plan",
    redactBody: true,
  },

  // --- Team & access ---------------------------------------------------------
  // Every entry here is load-bearing: this is how you find out someone granted
  // themselves a permission they shouldn't have.

  // Signing in. The middleware cannot write this one, at login nobody is
  // authenticated yet, so req.tenantUser is empty and the entry is dropped.
  // tenantAuthService.login() records it instead, once per organisation the
  // person belongs to. The entry lives here so it names the "Team" module and
  // shows up in the filters.
  "POST /auth/login": {
    action: "staff.login",
    category: "Team",
    resourceType: "STAFF",
    summary: () => "signed in",
    redactBody: true,
  },
  // Opening a page the role doesn't include. The portal's route guard stops it
  // on the client, so no API call is made and the middleware never sees it.
  // the portal reports it to POST /audit-logs/denied-view, which writes this
  // entry. NOT a route key: it is here for its wording and so "Access" shows up
  // in the module filter. Asked for by a tenant owner (Skilldunia, 2026-10-18):
  // "he opened some pages where he don't have access, that I cannot see".
  "VIEW /denied-page": {
    action: "page.view.denied",
    category: "Access",
    resourceType: "PAGE",
    summary: (l) => `opened ${l ? `the "${l}" page` : "a page"}`,
    attempt: (l) => `open ${l ? `the "${l}" page` : "a page"} without access`,
    redactBody: true,
  },
  "POST /auth/logout": {
    action: "staff.logout",
    category: "Team",
    resourceType: "STAFF",
    summary: () => "signed out",
    redactBody: true,
  },
  "POST /team/roles": {
    action: "role.create",
    category: "Team",
    resourceType: "ROLE",
    ...wrote("created", "create", "role"),
  },
  "POST /team/roles/:roleId/duplicate": {
    action: "role.duplicate",
    category: "Team",
    resourceType: "ROLE",
    summary: (l) => `duplicated the role${l ? ` "${l}"` : ""}`,
    attempt: (l) => `duplicate the role${l ? ` "${l}"` : ""}`,
  },
  // Name the role from its ID, not from the request body. A DELETE has no
  // response to read a name from ("deleted a role"), and on a DENIED rename the
  // body holds whatever the person TYPED, so the log would have credited them
  // with renaming a role to a name that was never applied.
  "PUT /team/roles/:roleId": {
    action: "role.update",
    category: "Team",
    resourceType: "ROLE",
    summary: (_l, ctx) => `renamed ${rolePhrase(ctx)}`,
    attempt: (_l, ctx) => `rename ${rolePhrase(ctx)}`,
    resolve: { roles: ["roleId"] },
  },
  "DELETE /team/roles/:roleId": {
    action: "role.delete",
    category: "Team",
    resourceType: "ROLE",
    summary: (_l, ctx) => `deleted ${rolePhrase(ctx)}`,
    attempt: (_l, ctx) => `delete ${rolePhrase(ctx)}`,
    resolve: { roles: ["roleId"] },
  },
  "PUT /team/roles/:roleId/capabilities": {
    action: "role.capabilities.update",
    category: "Team",
    resourceType: "ROLE",
    summary: (_l, ctx) => `changed what ${rolePhrase(ctx)} can do`,
    attempt: (_l, ctx) => `change what ${rolePhrase(ctx)} can do`,
    resolve: { roles: ["roleId"], capabilities: ["capabilityIds"] },
  },
  "PUT /team/roles/:roleId/permissions": {
    action: "role.permissions.update",
    category: "Team",
    resourceType: "ROLE",
    summary: (l) =>
      `changed the permissions on the role${l ? ` "${l}"` : ""} (Advanced)`,
    attempt: (l) =>
      `change the permissions on the role${l ? ` "${l}"` : ""} (Advanced)`,
  },
  "PUT /team/staff/:userId/roles": {
    action: "staff.roles.assign",
    category: "Team",
    resourceType: "STAFF",
    // "…set Afeefa Sheikh's roles to Educator and Finance", the WHO and the
    // WHAT. Without resolve[], this read "changed which roles a teammate has",
    // which is true of every such entry and tells an owner nothing.
    summary: (_l, ctx) =>
      `set ${target(ctx)}'s roles to ${listNames(ctx, ctx?.body.roleIds)}`,
    attempt: (_l, ctx) => `change ${target(ctx)}'s roles`,
    resolve: { users: ["userId"], roles: ["roleIds"] },
  },
  "DELETE /team/staff/:userId/roles/:roleId": {
    action: "staff.role.remove",
    category: "Team",
    resourceType: "STAFF",
    summary: (_l, ctx) =>
      `took the ${listNames(ctx, ctx?.params.roleId)} role away from ${target(ctx)}`,
    attempt: (_l, ctx) => `take a role away from ${target(ctx)}`,
    resolve: { users: ["userId"], roles: ["roleId"] },
  },
  "POST /team/members/invite": {
    action: "staff.invite",
    category: "Team",
    resourceType: "STAFF",
    // "…invited Afeefa Sheikh to the team as Educator", an invitation without
    // the role is half the story, and the role is the half that matters.
    summary: (l, ctx) =>
      `invited ${l ?? "someone"} to the team as ${listNames(ctx, ctx?.body.roleIds)}`,
    attempt: (l) => `invite ${l ?? "someone"} to the team`,
    resolve: { roles: ["roleIds"] },
    // Response carries a temp password; the body carries the invitee's email.
    redactBody: true,
  },
  "POST /team/members/:userId/reset-password": {
    action: "staff.password.reset",
    category: "Team",
    resourceType: "STAFF",
    summary: (_l, ctx) => `reset the password for ${target(ctx)}`,
    attempt: (_l, ctx) => `reset the password for ${target(ctx)}`,
    resolve: { users: ["userId"] },
    redactBody: true,
  },
  // Suspension is reversible and preserves history; removal is neither. An owner
  // wants to see which one happened, and to whom.
  "PUT /team/members/:userId/suspend": {
    action: "staff.suspend",
    category: "Team",
    resourceType: "STAFF",
    summary: (_l, ctx) => `suspended ${target(ctx)}`,
    attempt: (_l, ctx) => `suspend ${target(ctx)}`,
    resolve: { users: ["userId"] },
  },
  "PUT /team/members/:userId/reactivate": {
    action: "staff.reactivate",
    category: "Team",
    resourceType: "STAFF",
    summary: (_l, ctx) => `restored ${target(ctx)}'s access`,
    attempt: (_l, ctx) => `restore ${target(ctx)}'s access`,
    resolve: { users: ["userId"] },
  },
  "DELETE /team/members/:userId": {
    action: "staff.remove",
    category: "Team",
    resourceType: "STAFF",
    summary: (_l, ctx) => `removed ${target(ctx)} from the team`,
    attempt: (_l, ctx) => `remove ${target(ctx)} from the team`,
    resolve: { users: ["userId"] },
  },

  // --- Test taxonomy ---------------------------------------------------------
  // The subject/chapter/topic tree behind question tagging and section
  // blueprints. CRUD is a real authoring action; the availability check is a
  // read (see ALLOWED_QUIET in validate-audit-coverage.ts) and stays quiet.
  "POST /test-taxonomy": {
    action: "test-taxonomy.create",
    category: "Test Series",
    resourceType: "TEST_TAXONOMY",
    ...wrote("created", "create", "taxonomy item"),
  },
  "PUT /test-taxonomy/:nodeId": {
    action: "test-taxonomy.update",
    category: "Test Series",
    resourceType: "TEST_TAXONOMY",
    ...wrote("renamed", "rename", "taxonomy item"),
  },
  "DELETE /test-taxonomy/:nodeId": {
    action: "test-taxonomy.delete",
    category: "Test Series",
    resourceType: "TEST_TAXONOMY",
    ...wrote("deleted", "delete", "taxonomy item"),
  },
  "POST /test-taxonomy/import-from-tags": {
    action: "test-taxonomy.import",
    category: "Test Series",
    resourceType: "TEST_TAXONOMY",
    summary: () => "imported the test taxonomy from existing question tags",
    attempt: () => "import the test taxonomy from existing question tags",
  },

  // Marking. The single-answer route below it is a sub-resource shape
  // ("/answers/:answerId/grade") and the fallback silences it, but this one
  // takes the whole batch in one body, so nothing about its URL says what it
  // touched. It changes what a learner scored, which is exactly the kind of
  // decision someone comes back to argue about, so it says so by hand.
  "POST /test-grading/grade": {
    action: "test-grading.grade",
    category: "Test Series",
    resourceType: "TEST_ATTEMPT",
    summary: (_l, ctx) => {
      const n = Array.isArray(ctx?.body.marks) ? ctx.body.marks.length : 0;
      return n ? `marked ${n} answer${n === 1 ? "" : "s"}` : "marked answers";
    },
    attempt: () => "mark answers",
  },

  // --- Site structure --------------------------------------------------------
  // The layout is the header, footer and navigation of the public site: one
  // record, edited in place, with no id in the path, so the derived rule in
  // DOMAINS cannot reach it. Adding or removing one menu link gets its own
  // entry because the useful line is WHICH link moved.
  "POST /layout/nav": {
    action: "website.nav.add",
    category: "Pages",
    summary: (_label, ctx) => {
      const body = (ctx?.body ?? {}) as { label?: unknown; href?: unknown };
      const label = typeof body.label === "string" ? body.label : "a link";
      const href = typeof body.href === "string" ? ` (${body.href})` : "";
      return `added "${label}"${href} to the site menu`;
    },
    attempt: (_label, ctx) => {
      const body = (ctx?.body ?? {}) as { label?: unknown };
      return `add "${typeof body.label === "string" ? body.label : "a link"}" to the site menu`;
    },
  },
  "DELETE /layout/nav/:navItemId": {
    action: "website.nav.remove",
    category: "Pages",
    summary: (_label, ctx) =>
      `removed "${String(ctx?.params?.navItemId ?? "a link")}" from the site menu`,
    attempt: (_label, ctx) =>
      `remove "${String(ctx?.params?.navItemId ?? "a link")}" from the site menu`,
  },
  "PUT /layout": {
    action: "website.layout.update",
    category: "Pages",
    summary: () => "changed the site header, footer and navigation",
    attempt: () => "change the site header, footer and navigation",
  },
  // Regenerating rewrites the footer across every page at once. The summary
  // says "every page" because that scope is the whole reason someone scrolling
  // the log would stop on this line.
  "POST /layout/generate-footer": {
    action: "website.footer.regenerate",
    category: "Pages",
    summary: () => "rebuilt the site footer on every page",
    attempt: () => "rebuild the site footer on every page",
  },
  // The page builder lives at /pages, not /tenant/pages. Derived, these read
  // "created a template", for an action that REPLACES a live page's content.
  // Bodies are large and the agent sends them too, so none is recorded.
  "POST /pages/templates/apply": {
    action: "pages.template.apply",
    category: "Pages",
    resourceType: "PAGES",
    summary: () => "applied a design template to a page, replacing its sections",
    attempt: () => "apply a design template to a page",
    redactBody: true,
  },
  "POST /pages/templates/apply-theme": {
    action: "pages.palette.apply",
    category: "Pages",
    resourceType: "PAGES",
    summary: () => "changed the website's colour palette",
    attempt: () => "change the website's colour palette",
    redactBody: true,
  },
  "POST /pages/templates/restore-theme": {
    action: "pages.palette.restore",
    category: "Pages",
    resourceType: "PAGES",
    summary: () => "restored the website's previous colours",
    attempt: () => "restore the website's previous colours",
    redactBody: true,
  },
  "POST /pages/:id/revisions/:revisionId/restore": {
    action: "pages.revision.restore",
    category: "Pages",
    resourceType: "PAGES",
    summary: (l) => `restored an earlier version of ${l ? `the page "${l}"` : "a page"}`,
    attempt: (l) => `restore an earlier version of ${l ? `the page "${l}"` : "a page"}`,
    redactBody: true,
  },

  // --- Settings --------------------------------------------------------------
};

// ---------------------------------------------------------------------------
// The fallback: log the routes nobody hand-wrote an entry for.
// ---------------------------------------------------------------------------
//
// The registry above covers ~34 routes. The app has ~530 writes. Hand-writing
// the other 500 is not a plan, it's the same "remember to update the list in
// another file" trap that let 25 permissions rot, and it would leave every
// FUTURE feature unlogged by default.
//
// So an unregistered write is no longer DROPPED. We derive an action from the
// shape of the route, which is highly regular across this codebase:
//
//    POST   /bundles                 → "created a bundle"
//    PUT    /bundles/:bundleId       → "edited a bundle"
//    DELETE /bundles/:bundleId       → "deleted a bundle"
//    POST   /bundles/:id/toggle-publish → "published/unpublished a bundle"
//
// The result is less polished than a hand-written sentence, that's the point.
// Explicit entries WIN wherever the phrasing matters (money, access, anything
// an owner would read twice). The fallback guarantees the floor: nothing a
// staff member does goes unrecorded just because we forgot to name it.

/**
 * The things an owner would recognise, and what to call them.
 *
 * WHY A LIST AND NOT A RULE
 * -------------------------
 * This used to derive the noun from the route filename by stripping a trailing
 * "s". That cannot produce English, and it didn't: "created a batche", "a
 * quizze", "a test-sery", "a byte". Worse, it happily leaked our internals into
 * a log meant for tenants, "created a page.revision", "a gateway.connection",
 * "created a v1".
 *
 * So there is no rule. There is a list of the domains a person would actually
 * name, with the word they'd use. Everything else is SILENT: an entry reading
 * "created a wa.system-health" is worse than no entry, because it is noise that
 * makes the reader distrust the rest of the log.
 *
 * Adding a feature people care about? Add a line. That is a deliberate, one-line
 * decision, which is the right bar for something that appears in an audit trail.
 */
export const DOMAINS: Record<
  string,
  {
    noun: string;
    category: string;
    table?: string;
    /** Nouns for collections that live one level down: /vault/entries. */
    collections?: Record<string, string>;
  }
> = {
  // NOTE: settings-style domains (organization, payment, team) are absent on
  // purpose, you don't "create a team setting", you change one, and those
  // changes already have hand-written entries in AUDIT_ACTIONS above.
  courses: { table: "courses", noun: "course", category: "Courses" },
  books: { table: "books", noun: "book", category: "Books" },
  bundles: { table: "bundles", noun: "bundle", category: "Bundles" },
  batches: { table: "batches", noun: "batch", category: "Batches" },
  categories: { table: "categories", noun: "category", category: "Courses" },
  instructors: { table: "instructors", noun: "instructor", category: "Courses" },
  pages: { noun: "page", category: "Pages" },
  testimonials: { noun: "testimonial", category: "Marketing" },

  "test-series": { noun: "test series", category: "Test Series" },
  tests: { noun: "test", category: "Test Series" },

  members: { table: "tenant_members", noun: "learner", category: "Learners" },
  "bulk-enroll": { noun: "bulk enrolment", category: "Learners" },
  certificates: { noun: "certificate", category: "Certificates" },
  "certificate-templates": { noun: "certificate template", category: "Certificates" },

  coupons: { table: "coupons", noun: "coupon", category: "Payments" },
  invoices: { noun: "invoice", category: "Finance" },
  plans: { noun: "plan", category: "Payments" },


  // Money and access, the entries an owner reads first.
  payment: {
    noun: "payment setting",
    category: "Payments",
    collections: {
      "gateway-connections": "payment gateway",
    },
  },
  subscriptions: { noun: "subscription", category: "Payments" },
  entitlements: { noun: "plan entitlement", category: "Settings" },
  domains: { noun: "domain", category: "Settings" },
  quizzes: { noun: "quiz", category: "Courses" },
  "test-questions": { noun: "test question", category: "Test Series" },
  "test-question-banks": { noun: "question bank", category: "Test Series" },
  media: { noun: "media file", category: "Courses" },
  "bulk-imports": { noun: "bulk import", category: "Learners" },
  submissions: { noun: "submission", category: "Learners" },
  "member-form": { noun: "member form", category: "Learners" },

  // Money, and the things everyone sees. Silent until now.
  "user-subscriptions": {
    noun: "membership plan",
    category: "Payments",
    collections: { plans: "membership plan", settings: "membership setting" },
  },
  "test-scholarships": {
    noun: "scholarship",
    category: "Test Series",
    collections: { awards: "scholarship award" },
  },
  sidebar: {
    noun: "menu item",
    category: "Settings",
    collections: { items: "menu item" },
  },
  "question-assets": { noun: "question asset", category: "Test Series" },
  organization: {
    noun: "organisation setting",
    category: "Settings",
    collections: { name: "organisation name" },
  },
  contact: {
    noun: "contact setting",
    category: "Settings",
    collections: { settings: "contact setting" },
  },

  // Settings. You don't "create" these, you change them, but a change to how
  // the site authenticates or what it charges is exactly what an owner audits.
  "auth-config": { noun: "sign-in setting", category: "Settings" },
  "currency-settings": { noun: "currency setting", category: "Settings" },
  "storefront-settings": { noun: "storefront setting", category: "Settings" },
  "certificates-settings": { noun: "certificate setting", category: "Certificates" },
  "org-details": { noun: "organisation detail", category: "Settings" },
  users: { noun: "user", category: "Team" },
  "test-rank-curves": { noun: "rank curve", category: "Test Series" },
  assignments: { noun: "assignment", category: "Courses" },
  "certificate-designer": { noun: "certificate design", category: "Certificates" },
  "certificate-assignments": { noun: "certificate rule", category: "Certificates" },
  "question-library": { noun: "question", category: "Test Series" },
  "asset-library": { noun: "asset", category: "Courses" },
};

/**
 * Derive an action for a route nobody registered.
 *
 * `key` is the tenant-relative pattern the middleware built, e.g.
 * "/bundles/:bundleId/toggle-publish".
 */
/** "entries" → "entry", "folders" → "folder". Used for collection sub-paths. */
function singular(word: string): string {
  const w = word.replace(/[-_]/g, " ");
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

export function deriveAuditAction(
  method: string,
  key: string
): AuditAction | undefined {
  const segments = key.split("/").filter(Boolean);
  if (segments.length === 0) return undefined;

  // ---------------------------------------------------------------------
  // Log what a PERSON did, not what the API received.
  //
  // Building one course fires eight requests, create the course, a section,
  // two lessons, two lectures, sync the FAQs, sync the instructors. Deriving a
  // sentence for each turned "Maya created a course" into eight lines of
  // "created the lesson Welcome", and buried the one event that mattered.
  //
  // A NESTED route (/courses/:id/sections/:id) is part of editing its parent,
  // not an event of its own. Only top-level resources get a derived entry, and
  // only for a domain someone deliberately named in DOMAINS above. Anything
  // else is silent unless it earns a hand-written entry in AUDIT_ACTIONS.
  // ---------------------------------------------------------------------
  // A sub-resource OF A SPECIFIC THING is noise: "/courses/:id/sections" is
  // part of editing that course, and logging it turned one "created a course"
  // into eight lines. The tell is the ID, the route acts on something inside
  // an existing record.
  //
  // A COLLECTION at a sub-path is NOT noise: "/vault/entries" has no id, and
  // `entries` IS the thing. My first cut of this rule counted path segments and
  // silenced both, which meant saving a password wrote nothing to the log at
  // all. Look for the id, not the depth.
  // The tell is WHERE the id sits.
  //
  //   /courses/:id/sections      id BEFORE a noun  -> a sub-resource of that
  //                                                   course. Noise: editing one
  //                                                   course fired 8 of these.
  //   /vault/entries             no id             -> a collection. The thing.
  //   /vault/entries/:id         id LAST           -> that thing, by id. The thing.
  //
  // Counting depth (my first attempt) silenced /vault/entries entirely, so
  // saving a password wrote nothing to the log at all.
  const idIndex = segments.findIndex((seg) => seg.startsWith(":"));
  const words = segments.filter((seg) => !seg.startsWith(":"));

  // An id followed by a VERB is an action on the record itself, not a nested
  // collection, "/wa/campaigns/:id/launch" is the moment a campaign goes out to
  // real phones, and it must be logged. Only an id followed by a NOUN
  // ("/courses/:id/sections") is the sub-resource noise we want silenced.
  const ACTION_VERBS = new Set([
    "launch", "send", "publish", "unpublish", "toggle-publish", "duplicate",
    "archive", "restore", "approve", "reject", "cancel", "refund", "reveal",
    "share", "reset-password", "invite", "import", "export", "default",
  ]);
  const tail = segments[segments.length - 1];

  if (idIndex !== -1 && idIndex < segments.length - 1) {
    // Something follows the id. Log it only if that something is a verb.
    if (!ACTION_VERBS.has(tail)) return undefined;
  }
  if (words.length > 3) return undefined;

  const domain = DOMAINS[segments[0]];
  if (!domain) return undefined;

  // Name the thing being acted on. For "/vault/entries" that's the entry, not
  // the vault, otherwise you get "created a vault entry" for a folder too.
  //
  // Only the words BEFORE the id are nouns, and a trailing verb never is one:
  // reading words[1] off "/tests/:id/publish" named the thing "publish", and
  // the log said "published the publish "Test 1"".
  const nouns = (idIndex === -1 ? words : segments.slice(0, idIndex)).filter(
    (w, i, all) => !(i === all.length - 1 && w === tail && ACTION_VERBS.has(w))
  );
  const collection = nouns[1];

  const { category } = domain;

  // A collection sub-path names itself ("entries" -> "entry"), but a bare word
  // like "entry" is meaningless in a log. Let a domain override it.
  const noun = collection
    ? (domain.collections?.[collection] ?? singular(collection))
    : domain.noun;

  let past: string;
  let base: string;
  let verb: string;

  const VERB_PAST: Record<string, [string, string]> = {
    launch: ["launched", "launch"],
    send: ["sent", "send"],
    publish: ["published", "publish"],
    unpublish: ["unpublished", "unpublish"],
    "toggle-publish": ["changed the published state of", "change the published state of"],
    duplicate: ["duplicated", "duplicate"],
    archive: ["archived", "archive"],
    restore: ["restored", "restore"],
    approve: ["approved", "approve"],
    reject: ["rejected", "reject"],
    cancel: ["cancelled", "cancel"],
    refund: ["refunded", "refund"],
    reveal: ["revealed", "reveal"],
    share: ["shared", "share"],
    import: ["imported", "import"],
    export: ["exported", "export"],
  };

  if (VERB_PAST[tail]) {
    [past, base] = VERB_PAST[tail];
    verb = tail.replace(/-/g, "_");
  } else if (method === "POST") {
    [past, base, verb] = ["created", "create", "create"];
  } else if (method === "PUT" || method === "PATCH") {
    [past, base, verb] = ["edited", "edit", "update"];
  } else if (method === "DELETE") {
    [past, base, verb] = ["deleted", "delete", "delete"];
  } else {
    return undefined;
  }

  const phrase = (v: string) => (label: string | null) =>
    `${v} ${label ? `the ${noun} "${label}"` : `a ${noun}`}`;

  return {
    action: `${segments[0]}.${verb}`,
    category,
    resourceType: segments[0].toUpperCase(),
    summary: phrase(past),
    attempt: phrase(base),
    // We can't know whether an unnamed route carries a secret, so never record
    // its body. Naming the route is what unlocks change-tracking, a fair trade:
    // naming it is cheap, leaking a key is not.
    redactBody: true,
  };
}

/**
 * Match a request to an action, explicit registry first, derived shape second.
 *
 * Express gives us the matched route pattern on `req.route.path`. The middleware
 * reconstructs the tenant-relative key ("/courses/:id/publish") and passes it here.
 */
export function lookupAuditAction(
  method: string,
  routeKey: string
): AuditAction | undefined {
  const explicit = AUDIT_ACTIONS[`${method.toUpperCase()} ${routeKey}`];
  if (explicit) return explicit;

  return deriveAuditAction(method.toUpperCase(), routeKey);
}
