"use client";

import { VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const WHITE = "#ffffff";
const INK = "#0F172A";
const INK_SOFT = "#334155";
const MUTE = "#64748B";
const MUTE_LIGHT = "#94A3B8";
const VIOLET = "#7C3AED";
const VIOLET_SOFT = "#A78BFA";

export function MasterclassLight({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: WHITE }}
    >
      {/* Soft violet wash top-left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 0% 0%, rgba(124,58,237,0.07) 0%, transparent 45%)`,
        }}
      />

      {/* Thin top ribbon */}
      <div
        className="absolute left-0 right-0 top-0 h-[4px]"
        style={{
          background: `linear-gradient(90deg, ${VIOLET} 0%, ${VIOLET_SOFT} 50%, ${VIOLET} 100%)`,
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
              />
              <div className="h-[26px] w-[1px]" style={{ background: MUTE_LIGHT }} />
            </>
          )}
          <div className="leading-tight">
            <p
              className="text-[10px] font-semibold uppercase"
              style={{
                color: VIOLET,
                letterSpacing: "4px",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              Certificate
            </p>
            <p
              className="mt-0.5 text-[11px] font-medium uppercase"
              style={{
                color: MUTE,
                letterSpacing: "3px",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              of Completion
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTE_LIGHT, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            Certificate No.
          </p>
          <p
            className="mt-0.5 font-mono text-[11px]"
            style={{ color: INK_SOFT, letterSpacing: "0.6px" }}
          >
            {data.certificateNumber}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="absolute left-[64px] right-[64px] top-[190px]">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{
            color: VIOLET,
            letterSpacing: "6px",
            fontFamily: "'Manrope', sans-serif",
          }}
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
            color: INK,
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "-2.2px",
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
            color: INK,
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "-0.6px",
          }}
        >
          {data.courseTitle}
        </h1>

        <p
          className="mt-6 max-w-[640px] text-[14px] leading-[1.7]"
          style={{ color: INK_SOFT, fontFamily: "'Inter', sans-serif" }}
        >
          Awarded in recognition of dedication, discipline, and the mastery of every
          required module of this program.
        </p>
      </div>

      {/* Bottom strip, date / director / QR */}
      <div
        className="absolute bottom-[64px] left-[64px] right-[64px] flex items-end justify-between"
        style={{ borderTop: `1px solid ${MUTE_LIGHT}`, paddingTop: "18px" }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTE_LIGHT, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            Issued On
          </p>
          <p
            className="mt-1 text-base font-semibold"
            style={{ color: INK, fontFamily: "'Manrope', sans-serif" }}
          >
            {data.formattedIssuedAt}
          </p>
        </div>

        <div className="text-center">
          <p
            className="text-2xl italic"
            style={{
              color: INK,
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="mx-auto mt-0.5 h-[1px] w-[180px]" style={{ background: INK }} />
          <p
            className="mt-1 text-[10px] font-semibold uppercase"
            style={{ color: MUTE, letterSpacing: "3px", fontFamily: "'Manrope', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>

        <div style={{ padding: "4px", background: WHITE, border: `1px solid ${VIOLET_SOFT}` }}>
          <CertificateQR value={data.verifyUrl} size={64} fgColor={VIOLET} />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={MUTE} fontFamily="'Manrope', sans-serif" />
    </div>
  );
}
