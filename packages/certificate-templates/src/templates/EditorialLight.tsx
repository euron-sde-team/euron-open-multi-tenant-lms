"use client";

import { VerifyLink, VerticalText } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const WHITE = "#ffffff";
const INK = "#111111";
const GRAPHITE = "#3f3f46";
const MUTED = "#71717a";
const OCHRE = "#b45309";

export function EditorialLight({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: WHITE }}
    >
      {/* Single top hairline rule */}
      <div className="absolute left-[80px] right-[80px] top-[48px] h-[1px]" style={{ background: INK }} />

      {/* Ochre accent block upper-right */}
      <div
        className="absolute right-[80px] top-[80px] h-[4px] w-[96px]"
        style={{ background: OCHRE }}
      />

      {/* Masthead */}
      <div className="absolute left-[80px] top-[60px] flex h-[42px] items-center gap-5">
        {data.logoUrl && (
          <>
            <LogoImage
              src={data.logoUrl}
              className="h-[36px] w-auto max-w-[140px] object-contain"
            />
            <div className="h-[22px] w-[1px]" style={{ background: MUTED }} />
          </>
        )}
        <span
          className="text-[11px] font-medium uppercase leading-none"
          style={{ color: INK, letterSpacing: "4px", fontFamily: "'Inter', sans-serif" }}
        >
          The Certificate
        </span>
        <span
          className="text-[11px] leading-none"
          style={{ color: MUTED, letterSpacing: "2px", fontFamily: "'Inter', sans-serif" }}
        >
          / No. {data.certificateNumber}
        </span>
      </div>

      {/* Issue section label */}
      <div className="absolute left-[80px] top-[140px]">
        <p
          className="text-[11px] font-medium uppercase"
          style={{ color: OCHRE, letterSpacing: "5px", fontFamily: "'Inter', sans-serif" }}
        >
          Issued &nbsp;&middot;&nbsp; {data.formattedIssuedAt}
        </p>
      </div>

      {/* Main kicker */}
      <div className="absolute left-[80px] top-[190px]">
        <p
          className="text-[10px] font-medium uppercase"
          style={{ color: MUTED, letterSpacing: "5px", fontFamily: "'Inter', sans-serif" }}
        >
          Presented to
        </p>
      </div>

      {/* Student name, display serif, left-aligned editorial. Auto-fits so long
          names stay within the band above the "has completed" divider. */}
      <AutoFitName
        text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
        maxRem={7.2}
        minRem={3.2}
        lineHeight={0.96}
        maxLines={2}
        maxHeightPx={160}
        className="absolute left-[80px] right-[220px] top-[222px]"
        style={{
          fontFamily: "'Fraunces', serif",
          color: INK,
          fontWeight: 400,
          letterSpacing: "-3px",
        }}
      />

      {/* Middle divider */}
      <div className="absolute left-[80px] right-[80px] top-[440px] flex items-center gap-6">
        <span
          className="text-[11px] font-medium uppercase"
          style={{ color: INK, letterSpacing: "4px", fontFamily: "'Inter', sans-serif" }}
        >
          has completed
        </span>
        <div className="flex-1 h-[1px]" style={{ background: INK }} />
      </div>

      {/* Course title */}
      <h1
        className="absolute left-[80px] right-[80px] top-[466px]"
        style={{
          fontFamily: "'Fraunces', serif",
          color: GRAPHITE,
          fontSize: "2.6rem",
          fontWeight: 500,
          letterSpacing: "-0.8px",
          lineHeight: 1.1,
        }}
      >
        {data.courseTitle}
      </h1>

      {/* Body paragraph */}
      <p
        className="absolute left-[80px] top-[560px] max-w-[600px] leading-[1.6]"
        style={{
          fontFamily: "'Inter', sans-serif",
          color: GRAPHITE,
          fontSize: "14px",
        }}
      >
        Awarded in recognition of dedication, effort, and the successful completion
        of all required coursework.
      </p>

      {/* Right rail: vertical cert-number running down.
          Single-transform rotation (avoids the writing-mode + rotate
          html2canvas bug that flipped the text in downloaded PDFs). */}
      <VerticalText
        width={36}
        height={460}
        className="absolute"
        style={{ right: "20px", top: "140px" }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "11px",
            letterSpacing: "6px",
            color: MUTED,
            textTransform: "uppercase",
          }}
        >
          Credential &nbsp;&middot;&nbsp; {data.certificateNumber}
        </span>
      </VerticalText>

      {/* Bottom row */}
      <div className="absolute bottom-[64px] left-[80px] right-[80px] flex items-end justify-between">
        <div style={{ padding: "3px", background: WHITE, border: `1px solid ${INK}` }}>
          <CertificateQR
            value={data.verifyUrl}
            size={64}
            fgColor={INK}
            bgColor="transparent"
          />
        </div>

        <div className="text-right">
          <p
            className="text-2xl italic"
            style={{
              fontFamily: "'Fraunces', serif",
              color: INK,
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="ml-auto mt-0.5 h-[1px] w-[160px]" style={{ background: INK }} />
          <p
            className="mt-1 text-[10px] font-medium uppercase"
            style={{ color: MUTED, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>
      </div>

      {/* Bottom hairline rule */}
      <div
        className="absolute bottom-[46px] left-[80px] right-[80px] h-[1px]"
        style={{ background: INK }}
      />

      <VerifyLink href={data.verifyUrl} color={MUTED} fontFamily="'Inter', sans-serif" />
    </div>
  );
}
