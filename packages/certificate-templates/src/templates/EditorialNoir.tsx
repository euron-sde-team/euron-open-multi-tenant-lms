"use client";

import { VerifyLink, VerticalText } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const NEAR_BLACK = "#0a0a0a";
const CARD_BG = "#111111";
const WARM_WHITE = "#f5f2ea";
const WARM_WHITE_SOFT = "#d4cfbe";
const COGNAC = "#c2743b";
const MUTED = "#737373";

export function EditorialNoir({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: NEAR_BLACK }}
    >
      {/* Subtle warm radial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 80% 20%, rgba(194,116,59,0.10) 0%, transparent 50%)` }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 20% 85%, rgba(245,242,234,0.04) 0%, transparent 55%)` }}
      />

      {/* Top hairline */}
      <div className="absolute left-[80px] right-[80px] top-[48px] h-[1px]" style={{ background: WARM_WHITE }} />

      {/* Cognac accent block upper-right */}
      <div className="absolute right-[80px] top-[80px] h-[4px] w-[96px]" style={{ background: COGNAC }} />

      {/* Masthead */}
      <div className="absolute left-[80px] top-[60px] flex h-[42px] items-center gap-5">
        {data.logoUrl && (
          <>
            <LogoImage
              src={data.logoUrl}
              className="h-[36px] w-auto max-w-[140px] object-contain"
              style={{ filter: "brightness(1.4)" }}
            />
            <div className="h-[22px] w-[1px]" style={{ background: MUTED }} />
          </>
        )}
        <span
          className="text-[11px] font-medium uppercase leading-none"
          style={{ color: WARM_WHITE, letterSpacing: "4px", fontFamily: "'Inter', sans-serif" }}
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

      {/* Issue section */}
      <div className="absolute left-[80px] top-[140px]">
        <p
          className="text-[11px] font-medium uppercase"
          style={{ color: COGNAC, letterSpacing: "5px", fontFamily: "'Inter', sans-serif" }}
        >
          Issued &nbsp;&middot;&nbsp; {data.formattedIssuedAt}
        </p>
      </div>

      <div className="absolute left-[80px] top-[190px]">
        <p
          className="text-[10px] font-medium uppercase"
          style={{ color: MUTED, letterSpacing: "5px", fontFamily: "'Inter', sans-serif" }}
        >
          Presented to
        </p>
      </div>

      {/* Student name, auto-fits so long names stay within the band above the
          "has completed" divider instead of overflowing into it. */}
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
          color: WARM_WHITE,
          fontWeight: 400,
          letterSpacing: "-3px",
        }}
      />

      {/* Middle divider */}
      <div className="absolute left-[80px] right-[80px] top-[440px] flex items-center gap-6">
        <span
          className="text-[11px] font-medium uppercase"
          style={{ color: WARM_WHITE, letterSpacing: "4px", fontFamily: "'Inter', sans-serif" }}
        >
          has completed
        </span>
        <div className="flex-1 h-[1px]" style={{ background: WARM_WHITE }} />
      </div>

      {/* Course title */}
      <h1
        className="absolute left-[80px] right-[80px] top-[466px]"
        style={{
          fontFamily: "'Fraunces', serif",
          color: WARM_WHITE_SOFT,
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
          color: WARM_WHITE_SOFT,
          fontSize: "14px",
        }}
      >
        Awarded in recognition of dedication, effort, and the successful completion
        of all required coursework.
      </p>

      {/* Right rail vertical credential.
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
        <div style={{ padding: "3px", background: CARD_BG, border: `1px solid ${WARM_WHITE}` }}>
          <CertificateQR
            value={data.verifyUrl}
            size={64}
            fgColor={WARM_WHITE}
            bgColor="transparent"
          />
        </div>

        <div className="text-right">
          <p
            className="text-2xl italic"
            style={{
              fontFamily: "'Fraunces', serif",
              color: WARM_WHITE,
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div
            className="ml-auto mt-0.5 h-[1px] w-[160px]"
            style={{ background: WARM_WHITE }}
          />
          <p
            className="mt-1 text-[10px] font-medium uppercase"
            style={{ color: COGNAC, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>
      </div>

      {/* Bottom hairline */}
      <div
        className="absolute bottom-[46px] left-[80px] right-[80px] h-[1px]"
        style={{ background: WARM_WHITE }}
      />

      <VerifyLink href={data.verifyUrl} color={MUTED} fontFamily="'Inter', sans-serif" />
    </div>
  );
}
