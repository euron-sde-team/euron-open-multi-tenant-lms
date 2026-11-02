"use client";

import { CertNumberBadge, Divider, VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

export function ModernBlue({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "1122px", height: "793px", background: "#030d18" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 30% 25%, rgba(59,130,246,0.15) 0%, transparent 55%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 70% 75%, rgba(96,165,250,0.10) 0%, transparent 50%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(96,165,250,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(96,165,250,0.015) 3px, rgba(96,165,250,0.015) 4px)",
        }}
      />

      <div
        className="absolute left-[10%] right-[10%] top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, transparent, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent)" }}
      />
      <div
        className="absolute bottom-0 left-[10%] right-[10%] h-[3px]"
        style={{ background: "linear-gradient(90deg, transparent, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent)" }}
      />
      <div
        className="absolute bottom-[12%] left-0 top-[12%] w-[3px]"
        style={{ background: "linear-gradient(180deg, transparent, rgba(59,130,246,0.4) 50%, transparent)" }}
      />
      <div
        className="absolute bottom-[12%] right-0 top-[12%] w-[3px]"
        style={{ background: "linear-gradient(180deg, transparent, rgba(59,130,246,0.4) 50%, transparent)" }}
      />

      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: "50%", height: "150px", borderLeft: "1px solid rgba(59,130,246,0.15)", borderTop: "1px solid rgba(59,130,246,0.15)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0"
        style={{ width: "50%", height: "150px", borderRight: "1px solid rgba(59,130,246,0.15)", borderBottom: "1px solid rgba(59,130,246,0.15)" }}
      />

      <div
        className="absolute inset-[36px] flex flex-col rounded-lg"
        style={{
          background: "rgba(10,22,40,0.65)",
          border: "1px solid rgba(96,165,250,0.1)",
          boxShadow: "0 0 60px rgba(59,130,246,0.06)",
        }}
      >
        <CertNumberBadge number={data.certificateNumber} color="rgba(148,163,184,0.5)" numColor="#60a5fa" />
        <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ padding: "0 100px" }}>
          <LogoImage
            src={data.logoUrl}
            className="mb-6 h-[100px] w-auto max-w-[340px] object-contain"
            style={{ filter: "brightness(1.3)" }}
          />
          <h3 className="mb-3 text-[3rem] font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#93c5fd" }}>
            Certificate of Completion
          </h3>
          <h1 className="mb-5 max-w-[650px] text-[1.65rem] font-bold" style={{ fontFamily: "'Inter', sans-serif", color: "#f1f5f9" }}>
            {data.courseTitle}
          </h1>
          <Divider width="75%" color="#3b82f6" />
          <p className="mt-4 text-base" style={{ fontFamily: "'Inter', sans-serif", color: "#94a3b8" }}>
            This certificate acknowledges that
          </p>
          <AutoFitName
            text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
            maxRem={3.8}
            minRem={2.2}
            lineHeight={1.1}
            maxLines={2}
            className="my-4 italic"
            style={{ fontFamily: "'Playfair Display', serif", color: "#f8fafc" }}
          />
          <p className="text-base" style={{ fontFamily: "'Inter', sans-serif", color: "#94a3b8" }}>
            has successfully completed the course by passing all requirements.
          </p>
          <Divider width="60%" color="rgba(59,130,246,0.3)" />
          <div className="mt-3 flex gap-28">
            <div className="text-center">
              <p className="text-xs font-bold uppercase" style={{ color: "#60a5fa", letterSpacing: "3px" }}>
                Issue Date
              </p>
              <p className="mt-1 text-base" style={{ fontFamily: "'Inter', sans-serif", color: "#e2e8f0" }}>
                {data.formattedIssuedAt}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase" style={{ color: "#60a5fa", letterSpacing: "3px" }}>
                {data.directorTitle || "Director"}
              </p>
              <p className="mt-1 text-2xl italic" style={{ fontFamily: "'Playfair Display', serif", color: "#f1f5f9", whiteSpace: "nowrap", marginBottom: "8px" }}>
                {data.directorName}
              </p>
            </div>
          </div>
        </div>
        <VerifyLink
          href={data.verifyUrl}
          color="rgba(148,163,184,0.8)"
          fontFamily="'Inter', sans-serif"
        />
      </div>
    </div>
  );
}
