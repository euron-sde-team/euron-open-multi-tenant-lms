"use client";

import { VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const BG = "#0A1421";
const IVORY = "#F5F3FA";
const IVORY_SOFT = "#CBD5E1";
const CYAN = "#22D3EE";
const CYAN_DEEP = "#06B6D4";
const MUTE = "#9CA3AF";
const MUTE_LOW = "#374151";
const STRIPE_WIDTH = 8;

export function ProgramDark({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: BG }}
    >
      {/* Soft cyan glow bottom-left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 0% 100%, rgba(34,211,238,0.15) 0%, transparent 55%)`,
        }}
      />
      {/* Secondary glow top-right */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 100% 0%, rgba(6,182,212,0.08) 0%, transparent 50%)`,
        }}
      />
      {/* Fine dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(34,211,238,0.05) 1px, transparent 1px)`,
          backgroundSize: "26px 26px",
        }}
      />

      {/* Left-edge glowing cyan stripe */}
      <div
        className="absolute bottom-0 left-0 top-0"
        style={{
          width: `${STRIPE_WIDTH}px`,
          background: `linear-gradient(180deg, ${CYAN_DEEP} 0%, ${CYAN} 50%, ${CYAN_DEEP} 100%)`,
          boxShadow: `2px 0 16px rgba(34,211,238,0.35)`,
        }}
      />

      {/* Header row */}
      <div
        className="absolute right-[64px] top-[52px] flex items-start justify-between"
        style={{ left: `${STRIPE_WIDTH + 56}px` }}
      >
        <div className="flex h-[48px] items-center gap-4">
          {data.logoUrl && (
            <>
              <LogoImage
                src={data.logoUrl}
                className="h-[40px] w-auto max-w-[160px] object-contain"
                style={{ filter: "brightness(1.3)" }}
              />
              <div className="h-[26px] w-[1px]" style={{ background: MUTE_LOW }} />
            </>
          )}
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-[9px] font-bold uppercase"
              style={{
                background: "rgba(34,211,238,0.12)",
                color: CYAN,
                letterSpacing: "2px",
                fontFamily: "'Manrope', sans-serif",
                border: `1px solid rgba(34,211,238,0.35)`,
              }}
            >
              Program
            </span>
            <span
              className="text-[11px] font-medium uppercase"
              style={{ color: MUTE, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
            >
              Certificate of Completion
            </span>
          </div>
        </div>

        <div className="text-right">
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTE, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            Credential ID
          </p>
          <p
            className="mt-0.5 font-mono text-[11px]"
            style={{ color: IVORY_SOFT, letterSpacing: "0.6px" }}
          >
            {data.certificateNumber}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div
        className="absolute right-[64px] top-[190px]"
        style={{ left: `${STRIPE_WIDTH + 56}px` }}
      >
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: CYAN, letterSpacing: "6px", fontFamily: "'Manrope', sans-serif" }}
        >
          This is to certify that
        </p>

        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={5}
          minRem={2.6}
          lineHeight={1.02}
          maxLines={2}
          className="mt-4 font-bold"
          style={{
            color: IVORY,
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "-2.2px",
            textShadow: `0 0 32px rgba(34,211,238,0.25)`,
          }}
        />

        <div className="mt-5 flex items-center gap-4">
          <div className="h-[2px] w-[48px]" style={{ background: CYAN }} />
          <p
            className="text-sm font-medium uppercase"
            style={{ color: MUTE, letterSpacing: "4px", fontFamily: "'Manrope', sans-serif" }}
          >
            has successfully completed the program
          </p>
        </div>

        <h1
          className="mt-5 max-w-[780px] text-[2.2rem] font-bold leading-[1.15]"
          style={{
            color: IVORY,
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "-0.6px",
          }}
        >
          {data.courseTitle}
        </h1>

        <p
          className="mt-6 max-w-[640px] text-[14px] leading-[1.7]"
          style={{ color: IVORY_SOFT, fontFamily: "'Inter', sans-serif" }}
        >
          Awarded in recognition of the successful completion of all required projects,
          assignments, and assessments of this program.
        </p>
      </div>

      {/* Bottom strip */}
      <div
        className="absolute bottom-[64px] right-[64px] flex items-end justify-between"
        style={{
          left: `${STRIPE_WIDTH + 56}px`,
          borderTop: `1px solid ${MUTE_LOW}`,
          paddingTop: "18px",
        }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTE, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            Issued On
          </p>
          <p
            className="mt-1 text-base font-semibold"
            style={{ color: IVORY, fontFamily: "'Manrope', sans-serif" }}
          >
            {data.formattedIssuedAt}
          </p>
        </div>

        <div className="text-center">
          <p
            className="text-2xl italic"
            style={{
              color: IVORY,
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="mx-auto mt-0.5 h-[1px] w-[180px]" style={{ background: IVORY }} />
          <p
            className="mt-1 text-[10px] font-semibold uppercase"
            style={{ color: CYAN, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>

        <div
          style={{
            padding: "4px",
            background: "rgba(34,211,238,0.08)",
            border: `1px solid ${CYAN}`,
          }}
        >
          <CertificateQR value={data.verifyUrl} size={64} fgColor={IVORY} bgColor="transparent" />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={MUTE} fontFamily="'Manrope', sans-serif" />
    </div>
  );
}
