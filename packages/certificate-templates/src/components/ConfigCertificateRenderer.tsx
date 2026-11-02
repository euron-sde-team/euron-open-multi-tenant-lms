"use client";

import { AutoFitName } from "./AutoFitName";
import { CertificateQR } from "./CertificateQR";
import {
  CERTIFICATE_PAGE_DIMENSIONS,
  type CertificateData,
  type CertificateDesign,
  type CertificateElement,
  type CertificateVariable,
} from "../types";

const LINE_HEIGHT = 1.15;
// Variable values (name, course title, …) can be arbitrarily long. Let them wrap
// up to this many lines, then shrink the font so they never overflow the box or
// overlap the element below.
const VARIABLE_MAX_LINES = 2;
const REM_PX = 16;
const MIN_FONT_PX = 8;

function resolveVariable(
  variable: CertificateVariable,
  data: CertificateData,
): string {
  switch (variable) {
    case "participantName":
      return `${data.firstName} ${data.lastName}`.trim();
    case "firstName":
      return data.firstName;
    case "lastName":
      return data.lastName;
    case "courseTitle":
      return data.courseTitle;
    case "testSeriesTitle":
      return data.testSeriesTitle ?? data.courseTitle;
    case "certificateNumber":
      return data.certificateNumber;
    case "formattedIssuedAt":
      return data.formattedIssuedAt;
    case "expiryText":
      return data.expiryText ?? "";
    case "hoursText":
      // Render just the number. Templates place their own "hours" label as
      // static text, so strip a trailing hours unit to avoid "12 hours hours".
      // Only a trailing unit is removed, so non-hour durations (e.g. "6 weeks")
      // are left untouched.
      return (data.hoursText ?? "").replace(/\s*(hours?|hrs?)\.?\s*$/i, "").trim();
    case "lessonsCompleted":
      return data.lessonsCompleted != null ? String(data.lessonsCompleted) : "";
    case "quizzesPassed":
      return data.quizzesPassed != null ? String(data.quizzesPassed) : "";
    case "finalScore":
      return data.finalScore ?? "";
    case "directorName":
      return data.directorName;
    case "directorTitle":
      return data.directorTitle;
    case "tenantName":
      return data.tenantName ?? "";
    default:
      return "";
  }
}

/**
 * Positioned text box shared by variable + text elements. Always bounded to a
 * width (the element's, or the remaining canvas width) and allowed to break long
 * tokens, so text can never spill outside the certificate horizontally.
 */
function textBoxStyle(
  el: CertificateElement,
  effectiveWidth: number,
): React.CSSProperties {
  return {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    maxWidth: effectiveWidth,
    margin: 0,
    textAlign: el.align ?? "left",
    fontFamily: el.fontFamily,
    fontWeight: el.fontWeight,
    color: el.color,
    fontStyle: el.italic ? "italic" : undefined,
    letterSpacing: el.letterSpacing,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    lineHeight: LINE_HEIGHT,
  };
}

function ElementNode({
  el,
  data,
  canvasWidth,
}: {
  el: CertificateElement;
  data: CertificateData;
  canvasWidth: number;
}) {
  if (el.type === "variable" || el.type === "text") {
    const fontSize = el.fontSize ?? 16;
    // Bound every text box: its own width, or the space left to the canvas edge.
    const effectiveWidth = el.width ?? Math.max(24, canvasWidth - el.x);
    const style = textBoxStyle(el, effectiveWidth);
    if (el.type === "variable") {
      // Reuse the shared AutoFitName (same auto-shrink the built-in templates
      // use): wraps up to maxLines, then shrinks to fit, and re-fits once web
      // fonts load so long values never overflow or overlap.
      const value =
        (el.prefix ?? "") + resolveVariable(el.variable, data) + (el.suffix ?? "");
      const maxRem = fontSize / REM_PX;
      return (
        <AutoFitName
          text={value}
          maxRem={maxRem}
          minRem={Math.min(maxRem, MIN_FONT_PX / REM_PX)}
          lineHeight={LINE_HEIGHT}
          maxLines={VARIABLE_MAX_LINES}
          style={style}
        />
      );
    }
    return <div style={{ ...style, fontSize }}>{el.value}</div>;
  }
  if (el.type === "image") {
    // data-logo: the PDF export pipeline proxies + inlines every tagged image
    // so html2canvas can read its pixels regardless of the bucket's CORS policy.
    return (
      <img
        src={el.assetUrl}
        alt=""
        data-logo
        style={{
          position: "absolute",
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          objectFit: "fill",
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        }}
      />
    );
  }
  // qr, always encodes the per-certificate verify URL.
  return (
    <CertificateQR
      value={data.verifyUrl}
      size={el.size ?? el.width ?? 96}
      fgColor={el.fgColor}
      bgColor={el.bgColor}
      style={{ position: "absolute", left: el.x, top: el.y }}
    />
  );
}

interface Props {
  design: CertificateDesign;
  data: CertificateData;
  /** Scale the print-size canvas down for previews/thumbnails (1 = full). */
  scale?: number;
}

/**
 * Renders a designer-built certificate: a fixed print-size canvas with a
 * background and absolutely-positioned variable/text/image/QR elements. The
 * same component powers the admin preview, the learner view, the public verify
 * page, and server-side PDF/PNG generation, so a design renders identically
 * everywhere. Long variable values are auto-fitted so they never overflow.
 */
export function ConfigCertificateRenderer({ design, data, scale = 1 }: Props) {
  const { width, height } =
    CERTIFICATE_PAGE_DIMENSIONS[design.page.size][design.page.orientation];

  return (
    <div
      data-certificate-canvas
      style={{
        width,
        height,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
      }}
    >
      <div
        data-certificate-background
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          backgroundColor: design.background?.color ?? "#ffffff",
          backgroundImage: design.background?.assetUrl
            ? `url(${design.background.assetUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {design.elements.map((el) => (
          <ElementNode key={el.id} el={el} data={data} canvasWidth={width} />
        ))}
      </div>
    </div>
  );
}
