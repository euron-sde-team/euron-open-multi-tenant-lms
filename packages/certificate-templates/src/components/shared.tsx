"use client";

interface VerticalTextProps {
  children: React.ReactNode;
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders children as a vertically-stacked block (reads bottom-to-top,
 * book-spine orientation) using a single `transform: rotate(-90deg)`.
 *
 * Why not `writing-mode: vertical-rl` + `transform: rotate(180deg)`?
 * html2canvas (used for PDF export via `react-to-pdf`) has a long-standing bug
 * where compound `writing-mode` + `transform` combinations don't resolve the
 * same way they do in the browser, the rendered PDF flips the text vertically.
 * A single `transform: rotate()` on a normal horizontal block is rendered
 * correctly by html2canvas in every version we support.
 *
 * Layout: the outer div reserves `width` × `height` of normal layout space.
 * The inner span is rotated but doesn't affect that layout, it's visually
 * centered inside. Callers pass font / color / letter-spacing on the child.
 */
export function VerticalText({
  children,
  width,
  height,
  className,
  style,
}: VerticalTextProps) {
  return (
    <div
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <span
        style={{
          transform: "rotate(-90deg)",
          transformOrigin: "center center",
          whiteSpace: "nowrap",
          display: "inline-block",
        }}
      >
        {children}
      </span>
    </div>
  );
}

interface DividerProps {
  width: string;
  color: string;
}

export function Divider({ width, color }: DividerProps) {
  return (
    <div
      className="my-2"
      style={{
        width,
        height: "2px",
        background: `linear-gradient(90deg, transparent, ${color} 50%, transparent)`,
      }}
    />
  );
}

interface CertNumberBadgeProps {
  number: string;
  color: string;
  numColor: string;
}

export function CertNumberBadge({
  number,
  color,
  numColor,
}: CertNumberBadgeProps) {
  return (
    <div className="absolute right-6 top-5 text-right">
      <p
        className="text-[10px] font-semibold uppercase"
        style={{ color, letterSpacing: "2px" }}
      >
        Certificate No.
      </p>
      <p className="font-mono text-[11px]" style={{ color: numColor }}>
        {number}
      </p>
    </div>
  );
}

interface VerifyLinkProps {
  href: string;
  color: string;
  fontFamily?: string;
  label?: string;
}

/**
 * Small clickable link placed at bottom-left of every certificate. Functional
 * affordance only, the `data-pdf-verify="1"` attribute lets the PDF exporter
 * attach a clickable hyperlink region over this anchor's position so the
 * downloaded PDF is also verifiable.
 */
export function VerifyLink({
  href,
  color,
  fontFamily = "'Inter', sans-serif",
  label = "Verify",
}: VerifyLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-pdf-verify="1"
      className="absolute bottom-3 left-5 z-10 text-[10px] font-medium"
      style={{ color, fontFamily }}
    >
      {label}
    </a>
  );
}
