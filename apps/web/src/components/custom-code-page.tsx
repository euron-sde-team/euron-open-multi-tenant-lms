"use client";

/**
 * Renders a tenant's custom-code landing page.
 *
 * The tenant's HTML/CSS/JS document is served inside a sandboxed iframe via
 * `srcDoc`, with `sandbox="allow-scripts …"` but WITHOUT `allow-same-origin`.
 * That gives the tenant's code an OPAQUE origin: JavaScript runs, but it cannot
 * read the storefront's cookies, localStorage (the `auth-storage` token), DOM,
 * or call our APIs with credentials. Same isolation model as other sandboxed
 * ArtifactCanvas. Static (SANITIZED_INLINE) pages drop `allow-scripts` so no JS
 * runs at all.
 */
/**
 * Ensure links navigate the top-level storefront (not inside the iframe) by
 * default: inject `<base target="_top">` into <head> unless the tenant already
 * set a <base>. Combined with allow-top-navigation-by-user-activation, a plain
 * `<a href="/courses">` takes the visitor to the real platform route on click.
 */
function withTopBase(html: string): string {
  if (/<base\b/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1><base target="_top">');
  }
  return `<base target="_top">${html}`;
}

export function CustomCodePage({
  html,
  kind,
  title,
}: {
  html: string;
  kind?: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  title?: string;
}) {
  // JS-capable pages get allow-scripts; static pages don't run scripts.
  // Never include allow-same-origin (keeps the opaque origin) or
  // allow-top-navigation (tenant code can't navigate the storefront away).
  // allow-top-navigation-by-user-activation lets links (target="_top") navigate
  // the storefront to real routes (/courses, /books, /checkout, …) on a click,
  // so custom pages can drive users into the platform. It is gesture-gated, so
  // tenant JS can't silently redirect the page on its own.
  const sandbox =
    kind === "SANITIZED_INLINE"
      ? "allow-forms allow-popups allow-top-navigation-by-user-activation"
      : "allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-top-navigation-by-user-activation";

  return (
    <iframe
      srcDoc={withTopBase(html)}
      sandbox={sandbox}
      referrerPolicy="no-referrer"
      title={title ?? "Custom page"}
      className="block h-screen w-full border-0"
      style={{ minHeight: "100vh" }}
    />
  );
}
