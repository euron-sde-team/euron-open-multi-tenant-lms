/**
 * Monochrome brand marks for Corporate Upskilling “trusted by” bar
 * (matches HTML Font Awesome brand row, icon-only, white on dark).
 */
import { Building2 } from "lucide-react";
import type { SVGProps } from "react";

const iconClass = "h-7 w-7 shrink-0 sm:h-8 sm:w-8";

function Svg(props: SVGProps<SVGSVGElement> & { title?: string }) {
  const { title, children, className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      role="img"
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function CorpupskillBrandLogo({
  brandKey,
  title,
}: {
  brandKey: string;
  /** Accessible label when falling back to generic icon */
  title?: string;
}) {
  const k = brandKey.toLowerCase().trim();

  if (k === "brand-microsoft" || k === "microsoft") {
    return (
      <Svg className={iconClass} title="Microsoft">
        <path d="M0 0h11.5v11.5H0V0zm12.5 0H24v11.5H12.5V0zM0 12.5h11.5V24H0V12.5zm12.5 0H24V24H12.5V12.5z" />
      </Svg>
    );
  }
  if (k === "brand-aws" || k === "aws") {
    return (
      <Svg className={iconClass} title="AWS">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 .17-10z" />
      </Svg>
    );
  }
  if (k === "brand-google" || k === "google") {
    return (
      <Svg className={iconClass} title="Google">
        <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.845l3.267-3.127C18.189 1.088 15.478 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
      </Svg>
    );
  }
  if (k === "brand-slack" || k === "slack") {
    return (
      <Svg className={iconClass} title="Slack">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834V5.042zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </Svg>
    );
  }
  if (k === "brand-salesforce" || k === "salesforce") {
    return (
      <Svg className={iconClass} title="Salesforce">
        <path d="M10.006 5.415a4.195 4.195 0 0 0-3.974 2.876 3.113 3.113 0 0 0-1.638-.462c-1.724 0-3.12 1.396-3.12 3.12 0 .384.07.75.198 1.086A3.78 3.78 0 0 0 0 14.52C0 16.426 1.574 18 3.48 18h12.24c2.485 0 4.5-2.015 4.5-4.5 0-2.19-1.56-4.014-3.63-4.416a4.204 4.204 0 0 0-6.584-3.669z" />
      </Svg>
    );
  }

  return <Building2 className={iconClass} aria-label={title || "Partner"} />;
}
