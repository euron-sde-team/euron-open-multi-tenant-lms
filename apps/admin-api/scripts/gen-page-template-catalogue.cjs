/**
 * Regenerate src/data/page-template-catalogue.json from the admin portal's
 * template + theme packages.
 *
 * The backend cannot depend on the portal at runtime, so the library is
 * mirrored as data. Run this after the portal's templates or themes change:
 *
 *   pnpm build --filter @open-mtlms/ui-config --filter @open-mtlms/lms-templates
 *   node scripts/gen-page-template-catalogue.cjs
 *
 * Pinning it means a portal release cannot silently change what the assistant
 * applies to a live tenant site.
 */
const fs = require("node:fs");
const path = require("node:path");

const PORTAL =
  process.env.PORTAL_PATH ||
  path.resolve(__dirname, "../../../packages");

const { pageTemplates } = require(path.join(PORTAL, "lms-templates/dist/index.js"));
const { getAllThemePresets } = require(path.join(PORTAL, "ui-config/dist/index.js"));

const home = pageTemplates.filter((t) => (t.pageCategories || []).includes("home"));
// Sign-in, profile, about, contact, FAQ and legal pages. Applied like a home
// template but never offered in the home-page picker.
const utility = pageTemplates.filter((t) => t.category === "utility" || !(t.pageCategories || []).includes("home"));

const themes = {};
for (const t of getAllThemePresets()) {
  themes[t.id] = {
    id: t.id,
    name: t.name,
    description: t.description || "",
    preview: t.preview || null,
    // The full ThemeConfig, this is what gets written to the page's `theme`
    // field, and the homepage's theme is the whole site's theme.
    config: t.config,
  };
}

const out = {
  generatedFrom: "@open-mtlms/lms-templates + @open-mtlms/ui-config",
  utilityTemplates: utility.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    pageCategories: t.pageCategories || [],
    thumbnail: t.thumbnail || "",
    sections: t.sections.map((s) => ({ type: s.type, variant: s.variant, order: s.order, content: s.content })),
  })),
  templates: home.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    thumbnail: t.thumbnail || "",
    sections: t.sections.map((s) => ({
      type: s.type,
      variant: s.variant,
      order: s.order,
      content: s.content,
    })),
  })),
  themes,
};

const dest = path.resolve(__dirname, "../src/data/page-template-catalogue.json");
fs.writeFileSync(dest, JSON.stringify(out));
const kb = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`wrote ${dest}`);
console.log(`  templates: ${out.templates.length}  themes: ${Object.keys(themes).length}  ${kb} KB`);
