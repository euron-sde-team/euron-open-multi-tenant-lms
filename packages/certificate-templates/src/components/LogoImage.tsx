"use client";

interface Props {
  src?: string | null;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * Logo image used inside certificates.
 *
 * NOTE: Intentionally does NOT set `crossOrigin="anonymous"`. Some tenant S3 buckets
 * don't return CORS headers for every consuming origin (e.g. subdomain tenants on
 * *.localhost:3000), which would make the browser refuse to load the image and
 * display a broken-image icon. Without `crossOrigin`, the browser loads the image
 * normally for display. PDF export handles its own CORS fetch separately, if the
 * bucket doesn't permit cross-origin reads, the logo is simply omitted from the
 * PDF while the certificate itself still downloads.
 *
 * Every logo is tagged with `data-logo` so the PDF export pipeline can find them.
 */
export function LogoImage({ src, className, style, alt = "Logo" }: Props) {
  if (!src) return null;
  return <img src={src} alt={alt} data-logo className={className} style={style} />;
}
