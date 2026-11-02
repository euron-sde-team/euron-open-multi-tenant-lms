"use client";

import { CertNumberBadge, Divider, VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

export function MinimalDark({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: "#080808" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 25% 35%, rgba(120,120,120,0.08) 0%, transparent 55%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 75% 65%, rgba(120,120,120,0.06) 0%, transparent 50%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 60px, rgba(255,255,255,0.008) 60px, rgba(255,255,255,0.008) 61px)",
        }}
      />

      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: "55%", height: "140px", borderLeft: "1px solid rgba(255,255,255,0.06)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0"
        style={{ width: "55%", height: "140px", borderRight: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      />

      <div
        className="absolute left-[30px] right-[30px] top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, #3a3a3a 50%, transparent)" }}
      />
      <div
        className="absolute bottom-0 left-[30px] right-[30px] h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, #3a3a3a 50%, transparent)" }}
      />

      <div
        className="absolute inset-[36px] flex flex-col rounded-lg"
        style={{
          border: "1px solid #1a1a1a",
          background: "rgba(14,14,14,0.8)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <CertNumberBadge number={data.certificateNumber} color="#404040" numColor="#525252" />
        <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ padding: "0 100px" }}>
          <LogoImage
            src={data.logoUrl}
            className="mb-6 h-[100px] w-auto max-w-[340px] object-contain"
            style={{ filter: "grayscale(100%) brightness(1.8)" }}
          />
          <h3
            className="mb-3 text-[3.2rem]"
            style={{ fontFamily: "'Instrument Serif', serif", color: "#e5e5e5", fontWeight: 400, letterSpacing: "-0.5px" }}
          >
            Certificate of Completion
          </h3>
          <h1
            className="mb-5 max-w-[620px] text-[1.65rem] font-bold"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fafafa", letterSpacing: "-0.3px" }}
          >
            {data.courseTitle}
          </h1>
          <Divider width="70%" color="#4a4a4a" />
          <p className="mt-4 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#737373" }}>
            This certificate acknowledges that
          </p>
          <AutoFitName
            text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
            maxRem={3.8}
            minRem={2.4}
            lineHeight={1.1}
            maxLines={2}
            className="my-4 italic"
            style={{ fontFamily: "'Instrument Serif', serif", color: "#ffffff" }}
          />
          <p className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#737373" }}>
            has successfully completed the course by passing all requirements.
          </p>
          <Divider width="55%" color="#2a2a2a" />
          <div className="mt-3 flex gap-28">
            <div className="text-center">
              <p className="text-xs font-bold uppercase" style={{ color: "#a3a3a3", letterSpacing: "4px" }}>
                Issue Date
              </p>
              <p
                className="mt-1 text-base font-medium"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#d4d4d4" }}
              >
                {data.formattedIssuedAt}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase" style={{ color: "#a3a3a3", letterSpacing: "4px" }}>
                {data.directorTitle || "Director"}
              </p>
              <p className="mt-1 text-2xl italic" style={{ fontFamily: "'Instrument Serif', serif", color: "#e5e5e5", whiteSpace: "nowrap", marginBottom: "8px" }}>
                {data.directorName}
              </p>
            </div>
          </div>
        </div>
        <VerifyLink
          href={data.verifyUrl}
          color="rgba(255,255,255,0.55)"
          fontFamily="'Space Grotesk', sans-serif"
        />
      </div>
    </div>
  );
}
