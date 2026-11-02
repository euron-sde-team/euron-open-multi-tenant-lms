"use client";

import { VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const INDIGO = "#0b1220";
const VIOLET = "#5b21b6";
const CYAN = "#06b6d4";
const CYAN_SOFT = "#67e8f9";
const ICE = "#e2e8f0";
const MUTED = "#64748b";

export function TechGradient({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1122px",
        height: "793px",
        background: `linear-gradient(140deg, ${INDIGO} 0%, #131a33 50%, #0d1428 100%)`,
      }}
    >
      {/* Gradient band diagonal top */}
      <div
        className="pointer-events-none absolute -left-[10%] -top-[40%]"
        style={{
          width: "140%",
          height: "85%",
          background: `linear-gradient(135deg, ${VIOLET} 0%, rgba(91,33,182,0.2) 30%, transparent 60%, ${CYAN} 100%)`,
          opacity: 0.35,
          transform: "rotate(-8deg)",
          filter: "blur(2px)",
        }}
      />
      {/* Soft glow bottom-right */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 85% 90%, rgba(6,182,212,0.28) 0%, transparent 50%)` }}
      />

      {/* Dot matrix */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(103,232,249,0.10) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Geometric outline blocks */}
      <div
        className="pointer-events-none absolute right-[40px] top-[40px]"
        style={{
          width: "120px",
          height: "120px",
          border: `1px solid ${CYAN}`,
          opacity: 0.3,
          transform: "rotate(15deg)",
        }}
      />
      <div
        className="pointer-events-none absolute left-[44px] top-[90px]"
        style={{
          width: "60px",
          height: "60px",
          border: `1px solid ${VIOLET}`,
          opacity: 0.4,
          transform: "rotate(20deg)",
        }}
      />

      {/* Top stripe with cert number */}
      <div className="absolute left-0 right-0 top-[28px] flex items-center justify-between px-[56px]">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: CYAN,
              boxShadow: `0 0 12px ${CYAN}`,
            }}
          />
          <span
            className="text-[10px] font-semibold uppercase"
            style={{ color: CYAN_SOFT, letterSpacing: "5px", fontFamily: "'JetBrains Mono', monospace" }}
          >
            digital.credential
          </span>
        </div>
        <span
          className="font-mono text-xs"
          style={{ color: CYAN_SOFT, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}
        >
          {data.certificateNumber}
        </span>
      </div>

      {/* Logo area */}
      {data.logoUrl && (
        <div className="absolute left-1/2 top-[90px] -translate-x-1/2">
          <LogoImage
            src={data.logoUrl}
            className="h-[72px] w-auto max-w-[280px] object-contain"
            style={{ filter: "brightness(1.3) drop-shadow(0 0 12px rgba(103,232,249,0.3))" }}
          />
        </div>
      )}

      {/* Main content */}
      <div
        className={`absolute left-[80px] right-[80px] flex flex-col items-center text-center ${
          data.logoUrl ? "top-[200px]" : "top-[140px]"
        }`}
      >
        <p
          className="mb-3 text-xs font-semibold uppercase"
          style={{ color: CYAN, letterSpacing: "8px", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Certificate of Achievement
        </p>

        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={4.6}
          minRem={2.5}
          lineHeight={1.02}
          maxLines={2}
          className="mb-2 font-bold"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: "#ffffff",
            letterSpacing: "-2px",
            textShadow: `0 0 24px rgba(103,232,249,0.25)`,
          }}
        />

        <div
          className="my-3 h-[2px] w-[160px]"
          style={{ background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)` }}
        />

        <p
          className="text-sm"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: ICE, letterSpacing: "1px" }}
        >
          has completed advanced coursework in
        </p>
        <h1
          className="mt-3 max-w-[780px] text-[2rem] font-semibold"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: CYAN_SOFT,
            letterSpacing: "-0.3px",
          }}
        >
          {data.courseTitle}
        </h1>

        <p
          className="mt-8 max-w-[640px] text-[13px] leading-[1.7]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: ICE,
            letterSpacing: "0.3px",
            opacity: 0.85,
          }}
        >
          Awarded in recognition of technical excellence, consistent effort, and the
          successful completion of all required modules and assessments.
        </p>
      </div>

      {/* Bottom row: date, QR, director */}
      <div className="absolute bottom-[56px] left-[80px] right-[80px] flex items-end justify-between">
        <div>
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTED, letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace" }}
          >
            &gt; issued_at
          </p>
          <p
            className="mt-1 text-base font-medium"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#ffffff" }}
          >
            {data.formattedIssuedAt}
          </p>
        </div>

        <div
          style={{
            padding: "5px",
            background: "rgba(6,182,212,0.08)",
            border: `1px solid rgba(103,232,249,0.35)`,
          }}
        >
          <CertificateQR
            value={data.verifyUrl}
            size={72}
            fgColor={CYAN_SOFT}
            bgColor="transparent"
          />
        </div>

        <div className="text-right">
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: MUTED, letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace" }}
          >
            &gt; signed_by
          </p>
          <p
            className="mt-1 text-xl italic"
            style={{
              fontFamily: "'Fraunces', serif",
              color: CYAN_SOFT,
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase"
            style={{ color: CYAN, letterSpacing: "3px" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[4px]"
        style={{
          background: `linear-gradient(90deg, ${VIOLET} 0%, ${CYAN} 100%)`,
        }}
      />

      <VerifyLink
        href={data.verifyUrl}
        color={CYAN_SOFT}
        fontFamily="'JetBrains Mono', monospace"
      />
    </div>
  );
}
