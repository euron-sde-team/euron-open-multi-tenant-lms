/**
 * The tenant's own layout, header, footer, sidebar, top bar.
 *
 * WHY THESE EXIST BESIDE `/tenants/:id/layout`
 * -------------------------------------------
 * The original routes carry the tenant id in the path and then refuse it if it
 * does not match the caller's own (`tenants.controller.ts` compares them and
 * throws). That check is correct, and it makes the path parameter redundant:
 * the only value it is ever allowed to hold is the one already in the JWT.
 *
 * For the assistant that redundancy is not harmless. A capability would have to
 * accept a `tenantId` argument, and a model-supplied tenant id is the one input
 * this system refuses everywhere, it is the difference between "act in my
 * workspace" and "act in theirs". Rather than carve an exception into that
 * rule, these routes take the tenant from the authenticated context, which is
 * what every other `/tenant/*` route in this codebase already does.
 *
 * They delegate to the same service the originals use, so there is one
 * behaviour and not two.
 */
import { Request, Response } from "express";
import { ConflictError } from "../errors/conflict-custom.error";
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";

import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantRepository from "../repositories/tenant.repository";
import footerGeneratorService from "../services/footer-generator.service";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function requireTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

/** The whole layout: header, footer, sidebar and top bar. */
export const getMyLayout = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);
  const layout = await tenantRepository.getLayout(tenantId);
  if (!layout) throw new NotFoundError("This workspace has no layout yet");

  sendSuccessResponse({
    res,
    data: layout,
    statusCode: HttpSuccessStatus.OK,
    message: "Layout retrieved successfully",
  });
};

/**
 * Replace part of the layout.
 *
 * Merged at the TOP level only, and deliberately so: sending `{ footer: … }`
 * replaces the footer and leaves the header alone, but a footer must arrive
 * whole. Deep-merging would make it impossible to remove a navigation column,
 * because an omitted array would read as "unchanged" rather than "gone".
 */
export const updateMyLayout = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);

  const current = (await tenantRepository.getLayout(tenantId)) ?? {};
  const incoming = (req.body ?? {}) as Record<string, unknown>;

  // STRUCTURAL CHECK BEFORE ANYTHING IS WRITTEN.
  //
  // A tenant site was found with no navigation and no way to sign in. The cause
  // was in this table: `layout.header` held a copy of the WHOLE layout.
  // header, footer, sidebar and colours nested inside the header key. Nothing
  // can draw a header out of that, so the renderer drew none, and the site had
  // been shipping without a menu or a login button.
  //
  // The write that did it was accepted because this endpoint took whatever it
  // was handed. A header that is not header-shaped is never what anyone meant,
  // and refusing it costs nothing next to a storefront with no way in.
  for (const key of ["header", "footer", "sidebar", "topBar"] as const) {
    const value = incoming[key];
    if (value === undefined) continue;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestError(
        `"${key}" must be an object describing the ${key}, not ${Array.isArray(value) ? "an array" : String(value)}.`
      );
    }
    const rec = value as Record<string, unknown>;

    // A layout nested inside one of its own parts. This is the exact shape that
    // broke the site: header.header, or header.footer, and so on.
    const nested = ["header", "footer", "sidebar", "topBar"].filter((k) => k in rec);
    if (nested.length > 0) {
      throw new BadRequestError(
        `"${key}" contains ${nested.map((n) => `"${n}"`).join(", ")} inside it, which means a whole layout was passed where only the ${key} belongs. Send just the ${key} object.`
      );
    }

    // The same disease under an INVENTED name. A caller once stored the whole
    // footer again inside itself as `currentFooter`, a key that exists
    // nowhere in this codebase, so the list above sailed straight past it,
    // and the stored footer carried a stale self-copy that kept a deleted
    // link alive. Names cannot be enumerated when callers make them up;
    // shapes can: any direct child OBJECT that itself carries the signature
    // fields of a header or footer is a nested layout part, whatever it is
    // called.
    for (const [childKey, child] of Object.entries(rec)) {
      if (child === null || typeof child !== "object" || Array.isArray(child)) continue;
      const c = child as Record<string, unknown>;
      if ("navItems" in c || "columns" in c || "copyright" in c) {
        throw new BadRequestError(
          `"${key}.${childKey}" looks like a whole ${"navItems" in c ? "header" : "footer"} nested inside the ${key}. Send the ${key}'s own fields at the top level, never a copy of the section under another name.`
        );
      }
    }

    // A header that carries a footer's fields is a footer under the wrong name.
    if (key === "header" && ("columns" in rec || "copyright" in rec)) {
      throw new BadRequestError(
        `"header" looks like a footer, it carries ${"columns" in rec ? "columns" : "copyright"}. A header needs navItems, not columns.`
      );
    }

    // An enabled header with nothing to show is a header nobody can use.
    if (key === "header" && rec.enabled !== false && !Array.isArray(rec.navItems)) {
      throw new BadRequestError(
        `"header" has no navItems array. A header without navigation leaves visitors no way to reach the catalogue or to sign in.`
      );
    }

    // Every entry in navItems must be a link.
    //
    // A caller adding one item to the menu wrote `[<the existing array>, <the
    // new link>]`, which produced an array nested inside the array, seven
    // links collapsed into one unusable entry. The menu still "was an array",
    // so the check above was satisfied while the navigation was destroyed.
    if (key === "header" && Array.isArray(rec.navItems)) {
      const bad = (rec.navItems as unknown[]).findIndex(
        (item) =>
          item === null ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          typeof (item as Record<string, unknown>).label !== "string" ||
          typeof (item as Record<string, unknown>).href !== "string"
      );
      if (bad !== -1) {
        const item = (rec.navItems as unknown[])[bad];
        const what = Array.isArray(item)
          ? "an array, you nested the existing menu inside the new one instead of spreading it"
          : `${typeof item}, which has no label and href`;
        throw new BadRequestError(
          `navItems[${bad}] is ${what}. Every entry must be a link: { label, href }.`
        );
      }
    }

    // Footer links get the same discipline as the header's: every column is
    // { title?, links: [{ label, href }] }. The footer renders on every page
    // of the site, so one malformed column is sitewide.
    if (key === "footer" && Array.isArray(rec.columns)) {
      for (let ci = 0; ci < (rec.columns as unknown[]).length; ci += 1) {
        const col = (rec.columns as unknown[])[ci];
        if (col === null || typeof col !== "object" || Array.isArray(col)) {
          throw new BadRequestError(
            `columns[${ci}] is not a footer column. Every column must be an object with a links array.`
          );
        }
        const linksVal = (col as Record<string, unknown>).links;
        if (!Array.isArray(linksVal)) continue;
        const badLink = linksVal.findIndex(
          (l) =>
            l === null ||
            typeof l !== "object" ||
            Array.isArray(l) ||
            typeof (l as Record<string, unknown>).label !== "string" ||
            typeof (l as Record<string, unknown>).href !== "string"
        );
        if (badLink !== -1) {
          throw new BadRequestError(
            `columns[${ci}].links[${badLink}] is not a link. Every footer link must be { label, href }.`
          );
        }
      }
    }
  }

  const merged = { ...(current as Record<string, unknown>) };
  for (const key of ["header", "footer", "sidebar", "topBar"]) {
    if (incoming[key] === undefined) continue;

    // MERGE THE SECTION, DO NOT SWAP IT WHOLESALE.
    //
    // This used to assign the incoming section straight over the stored one, so
    // a caller who sent only the part they were changing lost everything they
    // did not mention. Asked to add one link to the menu, the assistant sent
    // `{ header: { navItems: [...] } }`, perfectly reasonable, and the header
    // came back with no `enabled`, no `cta`, no search box and no login button.
    // The site lost its way in for the second time in a day.
    //
    // Arrays and scalars the caller DOES send still replace outright, so
    // removing a menu item or a footer column works exactly as before: send the
    // array you want to end up with. Only untouched keys survive.
    const before = (current as Record<string, unknown>)[key];
    const next = incoming[key];
    merged[key] =
      before && typeof before === "object" && !Array.isArray(before) &&
      next && typeof next === "object" && !Array.isArray(next)
        ? { ...(before as Record<string, unknown>), ...(next as Record<string, unknown>) }
        : next;

    // Strip a nested layout-part copy that is ALREADY STORED. The validation
    // above stops new ones arriving, but one self-copy (`footer.currentFooter`)
    // got in before the guard existed, and because the merge keeps every key
    // the caller does not mention, no ordinary edit could ever get rid of it.
    // the stale copy kept resurfacing deleted links. So the merge itself now
    // drops any child object with a layout part's signature: the next write,
    // whatever it changes, heals the stored shape.
    const mergedSection = merged[key];
    if (mergedSection && typeof mergedSection === "object" && !Array.isArray(mergedSection)) {
      for (const [childKey, child] of Object.entries(mergedSection as Record<string, unknown>)) {
        if (child === null || typeof child !== "object" || Array.isArray(child)) continue;
        const c = child as Record<string, unknown>;
        if ("navItems" in c || "columns" in c || "copyright" in c) {
          delete (mergedSection as Record<string, unknown>)[childKey];
        }
      }
    }
  }

  // Brand colours and the brand name live in this same layout blob, but were
  // silently dropped: the loop above only copied the four structural sections,
  // so "change my primary colour to dark blue" wrote nothing and reported
  // success. These are scalars, so they are copied individually, a caller
  // changing only the accent must not have to resend the whole palette.
  for (const key of [
    "primary_color",
    "secondary_color",
    "accent_color",
    "background_color",
    "foreground_color",
    "muted_color",
    "theme_id",
    "template_id",
    "brand_name",
    "logo_key",
  ]) {
    if (incoming[key] !== undefined) merged[key] = incoming[key];
  }

  const layout = await tenantRepository.updateLayout(tenantId, merged);

  sendSuccessResponse({
    res,
    data: layout,
    statusCode: HttpSuccessStatus.OK,
    message: "Layout updated successfully",
  });
};

/**
 * Add one link to the site's main menu.
 * POST /tenant/layout/nav
 *
 * WHY THIS EXISTS RATHER THAN "JUST USE PUT /layout"
 * --------------------------------------------------
 * "Add Roadmaps to the menu" is a read-modify-write: you must know the existing
 * links to send them back alongside the new one. An assistant plans its whole
 * sequence BEFORE any of it runs, so at planning time it has not read the menu
 * yet and cannot write the resulting list out.
 *
 * What it did instead was pass the header straight back through unchanged and
 * report that the link had been added, a false success, and the worst kind,
 * because the report was confident and the menu was untouched.
 *
 * The merge belongs on this side, where the current list is already in hand.
 * One call, no prior read, nothing to get wrong.
 */
export const addNavItem = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);
  const { label, href, position } = (req.body ?? {}) as {
    label?: unknown;
    href?: unknown;
    position?: unknown;
  };

  if (typeof label !== "string" || !label.trim()) {
    throw new BadRequestError("label is required");
  }
  if (typeof href !== "string" || !href.trim()) {
    throw new BadRequestError("href is required");
  }

  const current = ((await tenantRepository.getLayout(tenantId)) ?? {}) as Record<string, unknown>;
  const header = (current.header ?? {}) as Record<string, unknown>;
  const items = Array.isArray(header.navItems)
    ? [...(header.navItems as Record<string, unknown>[])]
    : [];

  // Adding a link that is already there is a no-op, and saying so is more
  // useful than silently producing a duplicate menu entry.
  const existing = items.find(
    (i) => String(i?.href ?? "").toLowerCase() === href.trim().toLowerCase()
  );
  if (existing) {
    throw new ConflictError(
      `The menu already links to "${href.trim()}" as "${String(existing.label ?? "")}". Nothing was changed.`
    );
  }

  const item = { id: `nav-${ulid().toLowerCase().slice(-8)}`, label: label.trim(), href: href.trim() };
  const at =
    typeof position === "number" && position >= 0 && position <= items.length
      ? position
      : items.length;
  items.splice(at, 0, item);

  const layout = await tenantRepository.updateLayout(tenantId, {
    ...current,
    header: { ...header, navItems: items },
  });

  sendSuccessResponse({
    res,
    data: { added: item, navItems: items, layout },
    statusCode: HttpSuccessStatus.OK,
    message: `Added "${item.label}" to the menu. It now has ${items.length} links.`,
  });
};

/**
 * Remove one link from the site's main menu.
 * DELETE /tenant/layout/nav/:navItemId
 *
 * Matches on id or on href, because a person asks to remove "the Blog link",
 * not "nav-3f2a".
 */
export const removeNavItem = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);
  const needle = decodeURIComponent(String(req.params.navItemId ?? "")).trim();
  if (!needle) throw new BadRequestError("navItemId is required");

  const current = ((await tenantRepository.getLayout(tenantId)) ?? {}) as Record<string, unknown>;
  const header = (current.header ?? {}) as Record<string, unknown>;
  const items = Array.isArray(header.navItems)
    ? [...(header.navItems as Record<string, unknown>[])]
    : [];

  const idx = items.findIndex(
    (i) =>
      String(i?.id ?? "") === needle ||
      String(i?.href ?? "").toLowerCase() === needle.toLowerCase() ||
      String(i?.label ?? "").toLowerCase() === needle.toLowerCase()
  );
  if (idx === -1) {
    throw new NotFoundError(
      `No menu link matching "${needle}". The menu has: ${items.map((i) => String(i?.label ?? "")).join(", ") || "nothing"}.`
    );
  }

  const [removed] = items.splice(idx, 1);
  const layout = await tenantRepository.updateLayout(tenantId, {
    ...current,
    header: { ...header, navItems: items },
  });

  sendSuccessResponse({
    res,
    data: { removed, navItems: items, layout },
    statusCode: HttpSuccessStatus.OK,
    message: `Removed "${String(removed?.label ?? needle)}" from the menu. It now has ${items.length} links.`,
  });
};

/**
 * Rebuild the footer from the workspace's own details.
 *
 * It reads the organisation record, contact details and social links, and
 * composes navigation columns from them, so the usual way to change a footer is
 * to correct the underlying information rather than to hand-write links.
 */
export const regenerateMyFooter = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);
  const footer = await footerGeneratorService.generateFooter(tenantId);

  const current = ((await tenantRepository.getLayout(tenantId)) ?? {}) as Record<string, unknown>;
  await tenantRepository.updateLayout(tenantId, { ...current, footer });

  sendSuccessResponse({
    res,
    data: footer,
    statusCode: HttpSuccessStatus.OK,
    message: "Footer regenerated from your organisation details",
  });
};
