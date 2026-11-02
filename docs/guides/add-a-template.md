# Add a section, a page template or a theme

How to extend the storefront's building blocks. The model behind them is in
[templates-and-theming.md](../architecture/templates-and-theming.md). Paths are relative to
the repository root. `packages/core/TEMPLATE_GUIDE.md` covers the same ground in less
detail; where they differ, this page follows the code.

Before you start: `pnpm install`, and keep `pnpm --filter @open-mtlms/shared dev` and
`pnpm --filter @open-mtlms/ui-config dev` running (tsup watch) while you edit those packages,
so the apps pick up changes.

## Add a page template

A page template is a list of sections and a theme. Use existing section types when you can;
then this is one file.

1. In [`packages/lms-templates/src/page-templates.ts`](../../packages/lms-templates/src/page-templates.ts),
   add a template. The `s(type, variant, order, contentOverrides)` helper fills each section
   with its registry defaults and lets you override fields:

   ```ts
   const cohortPageTemplate: PageTemplate = {
     id: "cohort",
     name: "Cohort School",
     description: "Hero, upcoming batches, outcomes, testimonials and FAQ",
     category: "landing",
     pageCategories: ["home"],
     thumbnail: "/templates/cohort.png",
     theme: getThemePreset("default"),
     seo: { title: "Learn with a cohort", description: "Live cohorts and self-paced courses" },
     sections: [
       s("hero", "centered", 0, { headline: "Learn together, finish together" }),
       s("features-grid", "3-col", 1),
       s("testimonials-grid", "uniform", 2),
       s("faq", "default", 3),
     ],
   };
   ```

   Then add it to the exported `pageTemplates` array. `pageCategories` decides where it is
   offered (`home`, `about`, `contact`, `faq`, `privacy`, `terms`, `profile`, `login`).
2. Put the thumbnail under `apps/admin/public` (and `apps/web/public` if the storefront shows
   it) at the path you gave. Remote images must be on a host allowed by the apps' image
   settings (`NEXT_PUBLIC_IMAGE_HOSTS`, `NEXT_PUBLIC_ASSET_HOSTS`).
3. Regenerate the two catalogues admin-api keeps, because the backend cannot import the
   front-end packages at runtime. The page template catalogue holds home templates
   (`templates`) and every other page template (`utilityTemplates`, applied by id); the
   frontend ids cover home templates and themes:

   ```bash
   pnpm build --filter @open-mtlms/ui-config --filter @open-mtlms/lms-templates
   node apps/admin-api/scripts/gen-page-template-catalogue.cjs     # src/data/page-template-catalogue.json
   pnpm --filter @open-mtlms/admin-api sync:frontend-ids            # TemplateId, ThemeId in src/lib/creator-intent/types.ts
   ```

   `sync-frontend-ids` takes each home template's theme id from its
   `theme: getThemePreset("<id>")` line and stops with an error if the id is not a known
   preset. Commit both generated files. admin-api refuses a template id its catalogue does
   not contain.
4. Check it: `pnpm --filter @open-mtlms/admin typecheck`, then in the tenant admin open a
   page, pick the template, and preview it at `/preview/template/<id>`.

## Add a theme preset

1. Add an entry to `themePresets` in
   [`packages/ui-config/src/themes/palettes.ts`](../../packages/ui-config/src/themes/palettes.ts):
   an `id`, `name`, `description`, `preview` colours and a full `ThemeConfig` (`colors.light`
   with all 21 keys, `colors.dark` with at least the required ones, `fonts` from
   `AVAILABLE_FONTS`, `spacing`, `borders`).
2. Pick foregrounds with enough contrast on both `primary` and `accent`; tenant colours end
   up behind text.
3. Regenerate the catalogues as in step 3 above.

## Add a section type

A section touches three packages and two apps. In order:

1. **Type.** In [`packages/shared/src/types/section.ts`](../../packages/shared/src/types/section.ts)
   add the id to the `SectionType` union, write its content interface, and add it to
   `SectionContentMap`:

   ```ts
   export interface StatsBandContent {
     headline?: string;
     stats: Array<{ value: string; label: string }>;
   }
   // SectionType: ... | "stats-band"
   // SectionContentMap: "stats-band": StatsBandContent;
   ```

2. **Schema.** Add the id to `sectionTypeSchema` and a content schema to `contentSchemaMap` in
   [`packages/shared/src/schemas/section.ts`](../../packages/shared/src/schemas/section.ts),
   so pages that use it validate.
3. **Definition.** Add a `SECTION_DEFINITIONS` entry (name, category, variants) in
   [`packages/shared/src/constants/sections.ts`](../../packages/shared/src/constants/sections.ts).
4. **Registry.** In [`packages/ui-config/src/sections/registry.ts`](../../packages/ui-config/src/sections/registry.ts)
   add default content and a `sectionRegistry` entry:

   ```ts
   "stats-band": {
     type: "stats-band",
     name: "Stats band",
     description: "A row of headline numbers",
     category: "social-proof",
     icon: "bar-chart",
     variants: [{ id: "default", name: "Default", description: "Numbers in a row" }],
     defaultContent: { headline: "", stats: [{ value: "", label: "" }] },
   },
   ```

   The registry is typed against `SectionType`, so the build fails until every type has an
   entry. Default content should not invent facts (no made-up learner counts).
5. **Component.** Create `packages/core/src/components/section-editor/sections/StatsBandSection.tsx`.
   Take `{ section }`, read `section.content`, and get editing helpers from
   `useSectionEditor()` (`EditableText`, `updateSectionContent`), as
   `FAQAccordionSection.tsx` does. The same component renders read-only on the storefront and
   editable in the admin. Use theme tokens (`bg-background`, `text-foreground`,
   `bg-primary/10`), never fixed colours, and `hover:bg-muted` rather than `hover:bg-accent`.
6. **Export** it from `packages/core/src/components/section-editor/index.ts`.
7. **Render** it: add `"stats-band": StatsBandSection` to `sectionComponents` in both
   [`apps/web/src/components/sections/section-renderer.tsx`](../../apps/web/src/components/sections/section-renderer.tsx)
   and [`apps/admin/src/components/sections/section-renderer.tsx`](../../apps/admin/src/components/sections/section-renderer.tsx).
   A type missing here renders "Coming soon".
8. **Offer** it in the editor: add `{ category: "social-proof", type: "stats-band", variant: "default" }`
   to `BASIC_SECTION_TEMPLATES` in
   [`apps/admin/src/components/editor/basic-section-templates.ts`](../../apps/admin/src/components/editor/basic-section-templates.ts).
   Only types listed there appear in **Add section**.
9. **AI (optional).** Describe its content for page AI in
   `apps/admin/src/lib/section-ai-configs.ts`.
10. **Check.**

    ```bash
    pnpm --filter @open-mtlms/shared build && pnpm --filter @open-mtlms/ui-config build
    pnpm --filter @open-mtlms/admin typecheck && pnpm --filter @open-mtlms/web typecheck
    ```

    Then preview it at `/preview/section/stats-band/default` in the tenant admin, add it to a
    page, publish, and look at the storefront in light and dark mode.

## Course, book and certificate templates

| Kind | Package | Registry |
| --- | --- | --- |
| Course landing page | `packages/course-templates` | `CourseTemplateId` and the template components; the storefront renders `ModernTemplate` |
| Book page | `packages/book-templates` | `BookTemplateId` (`classic`, `modern`, `minimal`, `amazon`), switched in `apps/web/src/app/books/[slug]/book-page-client.tsx` |
| Certificate | `packages/certificate-templates` | `CERTIFICATE_TEMPLATES` in `src/registry.ts` |
| LMS player | `packages/lms-templates/src/templates` | `getLMSTemplate`; only `ClassicLMS` is used today |

Each takes its data through a provider (`CourseProvider`, `BookProvider`) and the editable
helpers, so the same component serves the editor and the storefront.

## Rules that keep templates safe

- Content is data. Never render a content field with `dangerouslySetInnerHTML`; if a section
  needs rich text, sanitise it the way `RichTextContent` in `packages/lms-templates` does.
- Every storefront page uses both theming layers (critical CSS on the server,
  `TenantThemeProvider` on the client), or it paints in default colours first.
- A content field, once shipped, is a contract with stored pages. Add fields; do not rename
  or repurpose them.
