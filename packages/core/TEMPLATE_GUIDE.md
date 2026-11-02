# Shared Section Template Guide

> How to create a new section template that works in both admin and web apps.

---

## Architecture Overview

Section templates live in `@open-mtlms/core` and are shared across both `apps/admin` and `apps/web`. Each app provides its own editor implementations (EditableText, EditableMedia, Link) via **dependency injection** through `SectionEditorContext`.

```
@open-mtlms/core (shared)
├── SectionEditorContext.tsx    ← DI context (isEditMode, updateSectionContent, components)
├── sections/
│   └── HeroCodeTechSection.tsx ← Shared template component
│   └── YourNewSection.tsx      ← Add new templates here
└── index.ts                    ← Re-exports everything

apps/admin/section-renderer.tsx ← imports shared sections directly from @open-mtlms/core
                                  wraps once with SectionEditorBridge (provides local EditableText/Media/Link)

apps/web/section-renderer.tsx   ← same pattern, provides web's implementations
```

**No per-section adapter files needed.** The DI bridge is set up once in each app's `SectionRenderer`.

---

## Step-by-Step: Adding a New Section Template

### 1. Define the content type (`packages/shared/src/types/section.ts`)

```typescript
// Add to SectionType union
export type SectionType =
  | "hero"
  | "hero-code-tech"
  | "your-new-section"   // ← Add here
  // ...

// Define the content interface
export interface YourNewSectionContent {
  headline: string;
  description?: string;
  items?: Array<{ id: string; title: string; text: string }>;
  primaryCta?: CTAButton;
  image?: string;
  imageAlt?: string;
  textStyles?: Record<string, TextStyle>;
}

// Add to SectionContentMap
export type SectionContentMap = {
  // ...
  "your-new-section": YourNewSectionContent;
};
```

After editing, rebuild shared: `pnpm --filter @open-mtlms/shared build`

### 2. Register default content (`packages/ui-config/src/sections/registry.ts`)

```typescript
// Add import
import type { YourNewSectionContent } from "@open-mtlms/shared";

// Define default content
const defaultYourNewContent: YourNewSectionContent = {
  headline: "Your Default Headline",
  description: "Your default description text",
  items: [
    { id: "1", title: "Item One", text: "Description one" },
    { id: "2", title: "Item Two", text: "Description two" },
  ],
  primaryCta: { text: "Get Started", href: "/signup", variant: "primary" },
  image: "https://images.unsplash.com/photo-XXXX?w=800&q=80",
  imageAlt: "Section preview",
};

// Add registry entry (inside sectionRegistry object)
"your-new-section": {
  type: "your-new-section",
  name: "Your Section Name",
  description: "Brief description for the add-section panel",
  category: "hero",  // hero | features | social-proof | content | conversion | ecommerce
  icon: "layout",    // Lucide icon name
  variants: [
    { id: "default", name: "Default", description: "Default layout" },
  ],
  defaultContent: defaultYourNewContent,
},
```

After editing, rebuild ui-config: `pnpm --filter @open-mtlms/ui-config build`

### 3. Add to section definitions (`packages/shared/src/constants/sections.ts`)

```typescript
{
  type: "your-new-section",
  name: "Your Section Name",
  description: "Brief description",
  category: "hero",
  icon: "layout",
  variants: [
    { id: "default", name: "Default", description: "Default layout" },
  ],
},
```

### 4. Create the shared component (`packages/core/src/components/section-editor/sections/YourNewSection.tsx`)

```typescript
"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { YourNewSectionContent, SectionConfig, TextStyle } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface YourNewSectionProps {
  section: SectionConfig;
}

export function YourNewSection({ section }: YourNewSectionProps) {
  const content = section.content as YourNewSectionContent;

  // ── Get editor tools from context (DI) ──
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableMedia,
    LinkComponent,
  } = useSectionEditor();

  const handleContentUpdate = (key: keyof YourNewSectionContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section className={cn("section-padding relative overflow-hidden", hasCustomBg && "bg-transparent")}>
      <div className="container-custom">
        {/* Headline, editable */}
        <EditableText
          value={content.headline}
          onChange={(v) => handleContentUpdate("headline", v)}
          styleKey="headline"
          style={content.textStyles?.headline}
          onStyleChange={(s) => handleTextStyleChange("headline", s)}
          as="h2"
          className="text-3xl font-bold"
        />

        {/* Image, editable */}
        <EditableMedia
          image={content.image}
          imageAlt={content.imageAlt}
          onImageChange={(src, alt) => {
            handleContentUpdate("image", src);
            handleContentUpdate("imageAlt", alt);
          }}
          onVideoChange={() => {}}
          className="rounded-lg"
          aspectRatio="video"
        />

        {/* CTA button, uses LinkComponent from context */}
        {content.primaryCta && !content.primaryCta.hidden && (
          <Button size="lg" asChild={!isEditMode}>
            {isEditMode ? (
              <EditableText
                value={content.primaryCta.text}
                onChange={(v) => handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })}
              />
            ) : (
              <LinkComponent href={content.primaryCta.href}>
                {content.primaryCta.text}
              </LinkComponent>
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
```

### 5. Export from core index (`packages/core/src/components/section-editor/index.ts`)

```typescript
export { YourNewSection } from "./sections/YourNewSection";
```

### 6. Register in section renderers

Import directly from `@open-mtlms/core` and add to the components map in BOTH `section-renderer.tsx` files:

```typescript
import { YourNewSection } from "@open-mtlms/core";

const sectionComponents = {
  // ...
  "your-new-section": YourNewSection,
};
```

**No adapter files needed**, each app's `SectionRenderer` already wraps all sections with a `SectionEditorBridge` that provides local `EditableText`, `EditableMedia`, and `LinkComponent` via `SectionEditorProvider`.

### 8. (Optional) Add a page template (`apps/admin/src/lib/data/page-templates.ts`)

```typescript
const myTemplate: PageTemplate = {
  id: "my-template",
  name: "My Template",
  description: "Description for the template picker",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/...",
  sections: [
    createSection({ type: "your-new-section", variant: "default", content: getDefaultContent("your-new-section") as Record<string, unknown>, visible: true, order: 0 }),
    // ... more sections
  ],
  theme: defaultThemeConfig,
  seo: { title: "My Template", description: "..." },
};
```

Add it to the `pageTemplates` array export.

---

## Key Rules

### Colors
- **NEVER** hardcode colors (no `#FF0000`, no `text-blue-500`)
- Use CSS variable tokens: `bg-primary`, `text-foreground`, `border-border`, `text-muted-foreground`
- For SVGs use: `fill="hsl(var(--primary))"`, `stroke="hsl(var(--primary) / 0.5)"`
- This ensures themes and dark/light mode work automatically

### Responsiveness
- Mobile-first: start with stacked layout, use `sm:`, `md:`, `lg:` for larger screens
- Use `clamp()` for fluid typography: `text-[clamp(1.5rem,3vw,2.5rem)]`
- Use Tailwind grid: `grid lg:grid-cols-2` for two-column layouts

### Editability
- All user-visible text → wrap in `EditableText`
- All images/videos → use `EditableMedia`
- All buttons with links → use `LinkComponent` from context (not direct `Link`/`SafeLink`)
- Stats/lists → make each item's text editable with index-based updates:
  ```typescript
  const newItems = [...(content.items || [])];
  newItems[index] = { ...newItems[index], title: value };
  handleContentUpdate("items", newItems);
  ```

### Hide/Show Support
- CTAs: check `!content.primaryCta.hidden` before rendering
- Sections: handled automatically by `SectionWrapper` (no action needed)

### Dark/Light Mode
- Components get dark mode free via CSS variables
- For conditional rendering based on mode, use `useTheme()` from `next-themes`
- Background images: use opacity/blend modes, not theme-specific URLs

### Text Styling Support
- Support `textStyles` in your content type for key text fields
- Wire up `styleKey`, `style`, and `onStyleChange` on `EditableText`
- This enables the text style toolbar (color, size, weight, alignment)

### Component Imports in Shared Templates
```
✅ import from "@open-mtlms/shared", types, utils
✅ import from useSectionEditor(): EditableText, EditableMedia, LinkComponent
✅ import { cn } from "../../../lib/utils", @open-mtlms/core local utility
✅ import { Button } from "../../ui/button", @open-mtlms/core local component
❌ import from "@/", app-local (breaks sharing)
❌ import from "next/link", use LinkComponent from context instead
```

---

## Build & Verify

After all changes:

```bash
pnpm --filter @open-mtlms/shared build      # Rebuild types
pnpm --filter @open-mtlms/ui-config build    # Rebuild registry
pnpm --filter @open-mtlms/admin typecheck    # Verify admin
pnpm --filter @open-mtlms/web typecheck      # Verify web
```

---

## File Checklist for New Section Template

| # | File | Action |
|---|------|--------|
| 1 | `packages/shared/src/types/section.ts` | Add to `SectionType`, create content interface, add to `SectionContentMap` |
| 2 | `packages/ui-config/src/sections/registry.ts` | Import content type, add default content, add registry entry |
| 3 | `packages/shared/src/constants/sections.ts` | Add to `SECTION_DEFINITIONS` |
| 4 | `packages/core/src/components/section-editor/sections/YourSection.tsx` | Create shared component using `useSectionEditor()` |
| 5 | `packages/core/src/components/section-editor/index.ts` | Export the new component |
| 6 | `apps/admin/src/components/sections/section-renderer.tsx` | Import from `@open-mtlms/core`, add to `sectionComponents` map |
| 7 | `apps/web/src/components/sections/section-renderer.tsx` | Import from `@open-mtlms/core`, add to `sectionComponents` map |
| 8 | `apps/admin/src/lib/data/page-templates.ts` | (Optional) Create page template |

**Total: 7-8 files.** No duplicate component files. Template code lives once in `@open-mtlms/core`.
