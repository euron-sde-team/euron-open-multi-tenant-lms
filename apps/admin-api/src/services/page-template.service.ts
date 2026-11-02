/**
 * Applying a whole page template to a tenant's site.
 *
 * WHY THIS EXISTS
 * ---------------
 * Choosing a look for a tenant site was a browser-only act. The templates live
 * in the admin portal, the editor renders them, and the browser wrote the
 * resulting sections. There was no route. So "pick a proper template for a
 * coding academy and put it live" had no path to an answer, the only option
 * was to hand-write a dozen sections one at a time and hope the shapes matched.
 *
 * WHAT APPLYING MEANS, EXACTLY
 * ----------------------------
 * It REPLACES the page's sections with the template's, and optionally writes
 * the theme. On the homepage that re-themes the whole site, because the web app
 * treats the homepage's theme as the global one.
 *
 * That is a big, visible change to a live site, so two things are true here:
 *
 *   1. The previous sections are returned in the result. The caller (and the
 *      assistant's undo) needs them to put things back; nothing else stores a
 *      section-level snapshot, `tenant_page_revisions` holds custom HTML, not
 *      section arrays, so it cannot serve as the undo path.
 *
 *   2. `dryRun` is supported and is the honest default for "what would this
 *      look like". It reports what WOULD change without touching anything, so
 *      the assistant can describe a template before committing a tenant to it.
 */
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import {
  describePageTemplate,
  rankPageTemplates,
  getPageTemplate,
  getTheme,
  listPageTemplates,
  listPalettes,
  listThemes,
  paletteIdOf,
  paletteNameOf,
  templateIds,
  themeIds,
  type CatalogueSection,
  type PaletteFamily,
  type PaletteSummary,
} from "../lib/page-template-catalogue";
import pagesRepository from "../repositories/pages.repository";
import { ulid } from "ulid";

export interface ApplyTemplateInput {
  tenantId: string;
  /** Page to write into. Omit to target the tenant's homepage. */
  pageId?: string;
  templateId: string;
  /** Optional palette. Omit to leave the existing theme alone. */
  themeId?: string;
  /** Report what would change; write nothing. */
  dryRun?: boolean;
  /**
   * Required to overwrite a page that already has real content on it.
   * Applying a template REPLACES every section; on a homepage somebody has
   * built out, that is the difference between a redesign and a deletion.
   */
  confirmReplace?: boolean;
}

export interface ApplyTemplateResult {
  applied: boolean;
  dryRun: boolean;
  pageId: string;
  pageSlug: string;
  templateId: string;
  templateName: string;
  themeId?: string;
  themeName?: string;
  sectionsBefore: number;
  sectionsAfter: number;
  sectionTypes: string[];
  /** The sections that were replaced, so the change can be undone. */
  previousSections?: unknown;
}

function materialise(sections: CatalogueSection[]): Record<string, unknown>[] {
  const now = new Date().toISOString();
  return sections.map((s, i) => ({
    id: ulid(),
    type: s.type,
    variant: s.variant || "default",
    order: typeof s.order === "number" ? s.order : i,
    // The template's own default copy. It is generic on purpose, real content
    // is the tenant's to write, and inventing specifics about a business we
    // know nothing about is how a site ends up claiming things that are false.
    content: s.content ?? {},
    settings: {},
    visible: true,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }));
}


/* ------------------------------------------------------------------ */
/*  Palettes: changing how the site LOOKS without touching what it says */
/* ------------------------------------------------------------------ */

export interface ApplyPaletteInput {
  tenantId: string;
  /** A catalogue id. Omit it and give a colour instead to have one chosen. */
  paletteId?: string;
  /**
   * Pick a palette by the colour asked for rather than by id.
   *
   * WHY THIS EXISTS
   * ---------------
   * "Make my dark theme bluish" used to need two calls: list the palettes,
   * then apply one. The model did the first, had nothing forcing it to do the
   * second, and stopped, leaving the admin with an honest "the theme was not
   * updated" and no new theme. One call that finishes the job cannot stop
   * halfway. `darkFamily` is the CANVAS in dark mode, which is what anyone
   * asking about dark mode means; `family` is the brand colour.
   */
  darkFamily?: PaletteFamily;
  family?: PaletteFamily;
  /** Page to write into. Omit for the homepage, which is the site-wide theme. */
  pageId?: string;
  dryRun?: boolean;
  /**
   * Restore a previously captured theme instead of a catalogue palette. Used
   * only by undo, which has to be able to put back a theme that was never a
   * catalogue palette to begin with.
   */
  restoreTheme?: Record<string, unknown>;
}

export interface ApplyPaletteResult {
  applied: boolean;
  dryRun: boolean;
  pageId: string;
  pageSlug: string;
  paletteId: string;
  paletteName: string;
  /** Family of the brand colour, and of the dark canvas. They differ often. */
  family?: PaletteFamily;
  darkFamily?: PaletteFamily;
  darkBackground?: string;
  previousPaletteId?: string;
  previousPaletteName?: string;
  /** The whole theme that was replaced, so undo can put it back exactly. */
  previousTheme?: unknown;
  /** Set when the palette was chosen from a colour rather than named. */
  chosenBecause?: string;
  /** Other palettes that fitted, so the admin can ask for a different one. */
  alternatives?: Array<{ paletteId: string; paletteName: string }>;
  note: string;
}

class PageTemplateService {
  listTemplates(templateId?: string, search?: string) {
    // "What suits a coding academy?" is the question actually being asked, and
    // answering it with a filtered handful beats returning fifty-one and having
    // the list truncated to the first ten by whatever reads it.
    if (search && search.trim()) {
      const { matches, totalMatched } = rankPageTemplates(search.trim());
      return {
        query: search.trim(),
        // Deliberately the SAME key as the unfiltered list. The first version
        // called this `matches`, so the response shape changed depending on
        // whether a search was passed - and a plan written as
        // `$s1.templates.0.id` then failed against a searched result. A read
        // whose shape depends on its arguments cannot be planned against.
        templates: matches,
        totalAvailable: listPageTemplates().length,
        // The count MUST be the number that matched, not the number shown. It
        // was the latter, so a search that found eleven fits reported "8 of 51
        // templates matched", the display cap wearing the costume of a fact,
        // which left both the reader and the model believing the catalogue had
        // less to offer than it did.
        note:
          matches.length === 0
            ? "Nothing matched those words. Ask for the full list if you want to browse."
            : totalMatched > matches.length
              ? `${totalMatched} of ${listPageTemplates().length} templates matched; these are the ${matches.length} closest. Ask for any template by name to see it in full.`
              : `${totalMatched} of ${listPageTemplates().length} templates matched.`,
      };
    }
    // Asking about one template returns its detail; asking about none returns
    // the lean list, because the whole catalogue with per-template section
    // lists overflows what the assistant can read in one go.
    if (templateId) {
      const one = describePageTemplate(templateId);
      if (!one) {
        throw new BadRequestError(
          `No template called "${templateId}". Available: ${templateIds().join(", ")}`
        );
      }
      return { template: one };
    }
    return {
      templates: listPageTemplates(),
      themes: listThemes().map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        preview: t.preview,
      })),
    };
  }

  async applyTemplate(input: ApplyTemplateInput): Promise<ApplyTemplateResult> {
    const { tenantId, templateId, themeId, dryRun = false } = input;

    const template = getPageTemplate(templateId);
    if (!template) {
      // Naming the alternatives beats "not found", the caller asked for a look,
      // and the useful reply is which looks exist.
      throw new BadRequestError(
        `No template called "${templateId}". Available: ${templateIds().join(", ")}`
      );
    }

    let theme: ReturnType<typeof getTheme>;
    if (themeId) {
      theme = getTheme(themeId);
      if (!theme) {
        throw new BadRequestError(
          `No theme called "${themeId}". Available: ${themeIds().join(", ")}`
        );
      }
    }

    const page = input.pageId
      ? await pagesRepository.findById(input.pageId, tenantId)
      : await pagesRepository.findHomepage(tenantId);
    if (!page) {
      throw new NotFoundError(
        input.pageId ? "Page not found" : "This workspace has no homepage to apply a template to."
      );
    }

    const before = Array.isArray(page.sections) ? (page.sections as unknown[]) : [];
    const sections = materialise(template.sections);

    // A BUILT PAGE IS NOT A BLANK ONE.
    //
    // Applying a template replaces every section with the template's generic
    // placeholder copy, which includes invented figures like "12K+ Engineers"
    // and "4.9 Rating", because the library writes marketing prose for a
    // business it knows nothing about. Landing that on a homepage somebody has
    // already filled in is not a redesign, it is a deletion plus a set of false
    // claims published in the tenant's name.
    //
    // So overwriting real content takes an explicit yes. An empty or barely
    // started page (under five sections) still applies freely, because that is
    // the case the feature exists for.
    const SUBSTANTIAL = 5;
    if (!dryRun && before.length >= SUBSTANTIAL && input.confirmReplace !== true) {
      throw new BadRequestError(
        `"${page.slug}" already has ${before.length} sections on it. Applying "${template.name}" ` +
          `would replace all of them with the template's placeholder copy, and that cannot be undone ` +
          `from here. Preview it first, and pass confirmReplace once the user has said yes to losing ` +
          `the current page.`
      );
    }

    const result: ApplyTemplateResult = {
      applied: false,
      dryRun,
      pageId: page.id,
      pageSlug: page.slug,
      templateId: template.id,
      templateName: template.name,
      themeId: theme?.id,
      themeName: theme?.name,
      sectionsBefore: before.length,
      sectionsAfter: sections.length,
      sectionTypes: sections.map((s) => String(s.type)),
    };

    if (dryRun) return result;

    await pagesRepository.update(
      page.id,
      {
        sections: sections as never,
        ...(theme ? { theme: theme.config as never } : {}),
      },
      undefined,
      tenantId
    );

    result.applied = true;
    result.previousSections = before;
    return result;
  }

  /** The palettes on offer, plus the one this site is using now. */
  async listSitePalettes(tenantId: string): Promise<{
    palettes: PaletteSummary[];
    current?: { paletteId?: string; paletteName?: string; darkBackground?: string };
    note: string;
  }> {
    const page = await pagesRepository.findHomepage(tenantId);
    const theme = page?.theme as Record<string, unknown> | undefined;
    const currentId = paletteIdOf(theme);
    const currentName = paletteNameOf(theme);
    const dark = ((theme?.colors as Record<string, Record<string, string>> | undefined)?.dark ?? {}).background;

    return {
      palettes: listPalettes(),
      current: {
        paletteId: currentId,
        paletteName: currentName,
        darkBackground: dark,
      },
      note:
        "`family` is the brand colour; `darkFamily` is the CANVAS in dark mode. " +
        "Most palettes put a coloured brand on a near-black canvas, so to change what " +
        "dark mode actually looks like, choose on `darkFamily` and `darkIsTinted`.",
    };
  }

  /**
   * Change the site's colours and nothing else.
   *
   * WHY THIS IS SEPARATE FROM applyTemplate
   * ---------------------------------------
   * Applying a template replaces every section on the page. An admin asking to
   * "make the site blue" is not asking to lose their homepage, so the only
   * route that could change colours was one nobody could safely offer them.
   * The assistant reached instead for the brand-colour fields on the layout
   * record, which the storefront does not read: it reported success, and the
   * site did not change by a pixel. This writes the theme the web app actually
   * renders (`tenant_pages.theme` on the homepage, which is the global theme)
   * and leaves the sections untouched.
   */
  async applyPalette(input: ApplyPaletteInput): Promise<ApplyPaletteResult> {
    const { tenantId, dryRun = false, restoreTheme } = input;

    // Either a named palette, or a colour to choose one by. Choosing happens
    // HERE rather than in the caller so that one request finishes the job.
    let paletteId = input.paletteId ?? "";
    let chosenBecause: string | undefined;
    let alternatives: Array<{ paletteId: string; paletteName: string }> | undefined;

    if (!restoreTheme && !paletteId) {
      const wantDark = input.darkFamily;
      const wantBrand = input.family;
      if (!wantDark && !wantBrand) {
        throw new BadRequestError(
          "Say which palette to apply, or which colour to pick one by."
        );
      }

      const all = listPalettes();
      // Dark-mode requests are about the CANVAS, so a palette whose dark page
      // is actually tinted beats one that only has coloured buttons on black.
      const ranked = wantDark
        ? [
            ...all.filter((p) => p.darkFamily === wantDark && p.darkIsTinted),
            ...all.filter((p) => p.darkFamily === wantDark && !p.darkIsTinted),
          ]
        : all.filter((p) => p.family === wantBrand);

      const stable = [...ranked].sort((a, b) => a.id.localeCompare(b.id));
      const pick = wantDark
        ? ranked.sort((a, b) =>
            a.darkIsTinted === b.darkIsTinted ? a.id.localeCompare(b.id) : a.darkIsTinted ? -1 : 1
          )[0]
        : stable[0];

      if (!pick) {
        const available = wantDark
          ? [...new Set(all.filter((p) => p.darkIsTinted).map((p) => p.darkFamily))].join(", ")
          : [...new Set(all.map((p) => p.family))].join(", ");
        throw new BadRequestError(
          wantDark
            ? `No palette has a ${wantDark} page in dark mode. Tinted dark canvases available: ${available}.`
            : `No palette has a ${wantBrand} brand colour. Available: ${available}.`
        );
      }

      paletteId = pick.id;
      chosenBecause = wantDark
        ? pick.darkIsTinted
          ? `Chosen because its page itself is ${wantDark} in dark mode, not just its buttons.`
          : `Chosen because its dark mode carries ${wantDark}, though the page stays near-black.`
        : `Chosen because its brand colour is ${wantBrand}.`;
      alternatives = ranked
        .filter((p) => p.id !== pick.id)
        .slice(0, 5)
        .map((p) => ({ paletteId: p.id, paletteName: p.name }));
    }

    const palette = restoreTheme ? undefined : getTheme(paletteId);
    if (!restoreTheme && !palette) {
      throw new BadRequestError(
        `No palette called "${paletteId}". Available: ${themeIds().join(", ")}`
      );
    }

    const page = input.pageId
      ? await pagesRepository.findById(input.pageId, tenantId)
      : await pagesRepository.findHomepage(tenantId);
    if (!page) {
      throw new NotFoundError(
        input.pageId
          ? "Page not found"
          : "This workspace has no homepage, so there is no site-wide theme to change."
      );
    }

    const previousTheme = page.theme;
    const previousId = paletteIdOf(previousTheme);
    const summary = restoreTheme
      ? undefined
      : listPalettes().find((p) => p.id === paletteId);

    const config = (restoreTheme ?? palette?.config) as Record<string, unknown>;
    const darkBackground = (
      (config.colors as Record<string, Record<string, string>> | undefined)?.dark ?? {}
    ).background;

    const result: ApplyPaletteResult = {
      applied: false,
      dryRun,
      pageId: page.id,
      pageSlug: page.slug,
      paletteId: restoreTheme ? (paletteIdOf(restoreTheme) ?? "restored") : palette!.id,
      paletteName: restoreTheme ? "the previous colours" : palette!.name,
      family: summary?.family,
      darkFamily: summary?.darkFamily,
      darkBackground,
      previousPaletteId: previousId,
      previousPaletteName: paletteNameOf(previousTheme),
      ...(chosenBecause ? { chosenBecause } : {}),
      ...(alternatives && alternatives.length ? { alternatives } : {}),
      note: summary
        ? summary.darkIsTinted
          ? `In dark mode the page itself is ${summary.darkFamily}, not near-black.`
          : `The brand is ${summary.family}, but in dark mode the page stays near-black; ` +
            `only buttons, links and headings carry the colour.`
        : "Restored the colours that were in place before.",
    };

    if (dryRun) return result;

    await pagesRepository.update(page.id, { theme: config as never }, undefined, tenantId);

    result.applied = true;
    result.previousTheme = previousTheme;
    return result;
  }
}

export default new PageTemplateService();
