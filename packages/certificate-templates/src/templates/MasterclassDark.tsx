"use client";

import { VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const BG = "#0F0A1A";
const IVORY = "#F5F3FA";
const IVORY_SOFT = "#D4CFE0";
const MUTE = "#9CA3AF";
const MUTE_LOW = "#4B5563";
const VIOLET = "#A78BFA";
const VIOLET_DEEP = "#7C3AED";

export function MasterclassDark({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: BG }}
    >
      {/* Soft violet glow top-left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 10% 0%, rgba(167,139,250,0.18) 0%, transparent 45%)`,
        }}
      />
      {/* Secondary glow bottom-right */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 90% 100%, rgba(124,58,237,0.12) 0%, transparent 50%)`,
        }}
      />
      {/* Fine dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(167,139,250,0.05) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Thin top ribbon */}
      <div
        className="absolute left-0 right-0 top-0 h-[4px]"
        style={{
          background: `linear-gradient(90deg, ${VIOLET_DEEP} 0%, ${VIOLET} 50%, ${VIOLET_DEEP} 100%)`,
        }}
      />

      {/* Header row, logo + caption (left), meta (right) */}
      <div className="absolute left-[64px] right-[64px] top-[52px] flex items-start justify-between">
        <div className="flex h-[48px] items-center gap-4">
          {data.logoUrl && (
            <>
              <LogoImage
                src={data.logoUrl}
                className="h-[40px] w-auto max-w-[160px] object-contain"
                style={{ filter: "brightness(1.35)" }}
              />
              <div className="h-[26px] w-[1px]" style={{ background: MUTE_LOW }} />
            </>
          )}
          <div className="leading-tight">
            <p
              className="text-[10px] font-semibold uppercase"
              style={{ color: VIOLET, letterSpacing: "4px", fontFamily: "'Manrope', sans-serif" }}
            >
              Certificate
            </p>
            <p
              className="mt-0.5 text-[11px] font-medium uppercase"
              style={{ color: MUTE, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
            >
              of Completion
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTE, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            Certificate No.
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
      <div className="absolute left-[64px] right-[64px] top-[190px]">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: VIOLET, letterSpacing: "6px", fontFamily: "'Manrope', sans-serif" }}
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
            textShadow: `0 0 36px rgba(167,139,250,0.25)`,
          }}
        />

        <div className="mt-5 flex items-center gap-4">
          <div className="h-[2px] w-[48px]" style={{ background: VIOLET }} />
          <p
            className="text-sm font-medium uppercase"
            style={{ color: MUTE, letterSpacing: "4px", fontFamily: "'Manrope', sans-serif" }}
          >
            has successfully completed
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
          Awarded in recognition of dedication, discipline, and the mastery of every
          required module of this program.
        </p>
      </div>

      {/* Bottom strip, date / director / QR */}
      <div
        className="absolute bottom-[64px] left-[64px] right-[64px] flex items-end justify-between"
        style={{ borderTop: `1px solid ${MUTE_LOW}`, paddingTop: "18px" }}
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
            style={{ color: VIOLET, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>

        <div
          style={{
            padding: "4px",
            background: "rgba(167,139,250,0.08)",
            border: `1px solid ${VIOLET}`,
          }}
        >
          <CertificateQR value={data.verifyUrl} size={64} fgColor={IVORY} bgColor="transparent" />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={MUTE} fontFamily="'Manrope', sans-serif" />
    </div>
  );
}
