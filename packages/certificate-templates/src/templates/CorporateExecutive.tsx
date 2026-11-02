"use client";

import { VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const IVORY = "#fafaf5";
const IVORY_SOFT = "#f3f1e8";
const CHARCOAL = "#1f2937";
const SLATE = "#475569";
const SLATE_SOFT = "#94a3b8";
const TEAL = "#0f766e";

export function CorporateExecutive({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1122px",
        height: "793px",
        background: `linear-gradient(180deg, ${IVORY} 0%, ${IVORY_SOFT} 100%)`,
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute left-0 right-0 top-0 h-[6px]"
        style={{ background: `linear-gradient(90deg, ${CHARCOAL} 0%, ${SLATE} 50%, ${TEAL} 100%)` }}
      />

      {/* Left vertical accent */}
      <div
        className="absolute bottom-[60px] left-[60px] top-[60px] w-[3px]"
        style={{ background: CHARCOAL }}
      />

      {/* Grid guide lines (very subtle) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(15,23,42,0.025) 1px, transparent 1px)",
          backgroundSize: "93.5px 100%", // 12-column grid on 1122px
        }}
      />

      {/* Cert number top-right */}
      <div className="absolute right-[60px] top-[36px] text-right">
        <p
          className="text-[10px] font-semibold uppercase"
          style={{ color: SLATE_SOFT, letterSpacing: "3px" }}
        >
          Certificate No.
        </p>
        <p
          className="mt-0.5 font-mono text-xs"
          style={{ color: CHARCOAL, letterSpacing: "1px" }}
        >
          {data.certificateNumber}
        </p>
      </div>

      {/* Brand row */}
      <div className="absolute left-[90px] top-[36px] flex h-[40px] items-center gap-4">
        {data.logoUrl && (
          <>
            <LogoImage
              src={data.logoUrl}
              className="h-[34px] w-auto max-w-[160px] object-contain"
            />
            <div className="h-[24px] w-[1px]" style={{ background: SLATE_SOFT }} />
          </>
        )}
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: SLATE, letterSpacing: "5px" }}
        >
          Professional Certification
        </p>
      </div>

      {/* Main content */}
      <div className="absolute bottom-[180px] left-[110px] right-[60px] top-[120px]">
        <p
          className="mb-1 text-sm font-medium uppercase"
          style={{ color: TEAL, letterSpacing: "6px" }}
        >
          Certificate of Completion
        </p>

        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={4.2}
          minRem={2.4}
          lineHeight={1.05}
          maxLines={2}
          className="mb-3 font-bold"
          style={{
            color: CHARCOAL,
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "-1.5px",
          }}
        />

        <div className="mt-2 flex items-center gap-4">
          <div className="h-[2px] w-[60px]" style={{ background: TEAL }} />
          <p className="text-sm" style={{ color: SLATE }}>
            has demonstrated proficiency in
          </p>
        </div>

        <h1
          className="mt-4 max-w-[740px] text-[2rem] font-semibold leading-[1.15]"
          style={{
            color: CHARCOAL,
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "-0.5px",
          }}
        >
          {data.courseTitle}
        </h1>

        <p
          className="mt-4 max-w-[720px] text-sm leading-relaxed"
          style={{ color: SLATE }}
        >
          Having successfully met all assessment criteria, this credential attests to practical mastery of the subject matter and is issued in recognition of verified completion of the program.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <div className="h-[1px] w-[40px]" style={{ background: TEAL }} />
          <p
            className="text-base italic"
            style={{
              color: CHARCOAL,
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
            }}
          >
            Awarded in recognition of professional excellence and commitment to
            continuous learning.
          </p>
        </div>
      </div>

      {/* Bottom signature strip */}
      <div
        className="absolute bottom-[60px] left-[90px] right-[60px] flex items-end justify-between"
        style={{ borderTop: `1px solid ${SLATE_SOFT}`, paddingTop: "16px" }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: SLATE_SOFT, letterSpacing: "3px" }}
          >
            Issued On
          </p>
          <p className="mt-1 text-lg font-medium" style={{ color: CHARCOAL }}>
            {data.formattedIssuedAt}
          </p>
        </div>

        <div className="text-center">
          <p
            className="mb-0.5 text-2xl italic"
            style={{
              color: CHARCOAL,
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="mx-auto h-[1px] w-[180px]" style={{ background: CHARCOAL }} />
          <p
            className="mt-1 text-[10px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>

        <div style={{ padding: "4px", background: "#fff", border: `1px solid ${SLATE_SOFT}` }}>
          <CertificateQR value={data.verifyUrl} size={72} fgColor={CHARCOAL} />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={SLATE} fontFamily="'Manrope', sans-serif" />
    </div>
  );
}
