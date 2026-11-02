"use client";

import { CertNumberBadge, Divider, VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

export function ElegantWhite({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1122px",
        height: "793px",
        background: "linear-gradient(135deg, #fdfbf5 0%, #f5f0e4 40%, #faf7ef 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 15% 20%, rgba(191,163,100,0.12) 0%, transparent 50%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 85% 80%, rgba(191,163,100,0.08) 0%, transparent 45%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(201,175,110,0.06) 0%, transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(160,140,90,0.015) 2px, rgba(160,140,90,0.015) 3px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(160,140,90,0.015) 2px, rgba(160,140,90,0.015) 3px)",
          backgroundSize: "8px 8px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 50px, rgba(180,155,90,0.018) 50px, rgba(180,155,90,0.018) 51px)",
        }}
      />

      <div className="pointer-events-none absolute inset-[12px]" style={{ border: "2px solid rgba(180,155,90,0.3)" }} />
      <div className="pointer-events-none absolute inset-[18px]" style={{ border: "1px solid rgba(180,155,90,0.18)" }} />

      <div className="pointer-events-none absolute left-[12px] top-[12px]" style={{ width: "80px", height: "80px" }}>
        <div className="absolute left-0 top-0 h-[2px] w-[40px]" style={{ background: "linear-gradient(90deg, #bfa364, transparent)" }} />
        <div className="absolute left-0 top-0 h-[40px] w-[2px]" style={{ background: "linear-gradient(180deg, #bfa364, transparent)" }} />
      </div>
      <div className="pointer-events-none absolute right-[12px] top-[12px]" style={{ width: "80px", height: "80px" }}>
        <div className="absolute right-0 top-0 h-[2px] w-[40px]" style={{ background: "linear-gradient(270deg, #bfa364, transparent)" }} />
        <div className="absolute right-0 top-0 h-[40px] w-[2px]" style={{ background: "linear-gradient(180deg, #bfa364, transparent)" }} />
      </div>
      <div className="pointer-events-none absolute bottom-[12px] left-[12px]" style={{ width: "80px", height: "80px" }}>
        <div className="absolute bottom-0 left-0 h-[2px] w-[40px]" style={{ background: "linear-gradient(90deg, #bfa364, transparent)" }} />
        <div className="absolute bottom-0 left-0 h-[40px] w-[2px]" style={{ background: "linear-gradient(0deg, #bfa364, transparent)" }} />
      </div>
      <div className="pointer-events-none absolute bottom-[12px] right-[12px]" style={{ width: "80px", height: "80px" }}>
        <div className="absolute bottom-0 right-0 h-[2px] w-[40px]" style={{ background: "linear-gradient(270deg, #bfa364, transparent)" }} />
        <div className="absolute bottom-0 right-0 h-[40px] w-[2px]" style={{ background: "linear-gradient(0deg, #bfa364, transparent)" }} />
      </div>

      <div
        className="absolute inset-[36px] flex flex-col"
        style={{ background: "rgba(255,252,245,0.6)", boxShadow: "0 2px 20px rgba(160,140,90,0.06)" }}
      >
        <CertNumberBadge
          number={data.certificateNumber}
          color="rgba(140,120,60,0.5)"
          numColor="rgba(120,100,50,0.7)"
        />

        <div
          className="absolute left-[15%] right-[15%] top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #bfa364 30%, #d4b96a 50%, #bfa364 70%, transparent)",
          }}
        />

        <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ padding: "0 100px" }}>
          <LogoImage
            src={data.logoUrl}
            className="mb-5 h-[90px] w-auto max-w-[320px] object-contain"
          />
          <p
            className="mb-2 text-sm font-bold uppercase tracking-[8px]"
            style={{ color: "#a08840" }}
          >
            Certificate
          </p>
          <h3
            className="mb-3 text-[3.5rem] font-bold"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1a1208", letterSpacing: "1px" }}
          >
            of Completion
          </h3>
          <Divider width="55%" color="#a08840" />
          <p className="mt-4 text-base" style={{ fontFamily: "'Lora', serif", color: "#5c5040" }}>
            This certificate is proudly presented to
          </p>
          <AutoFitName
            text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
            maxRem={4}
            minRem={2.4}
            lineHeight={1.2}
            maxLines={2}
            className="my-4 italic"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1a1208" }}
          />
          <p
            className="max-w-[600px] text-base leading-relaxed"
            style={{ fontFamily: "'Lora', serif", color: "#5c5040" }}
          >
            for successfully completing the course
          </p>
          <h1
            className="my-3 max-w-[700px] text-[1.75rem] font-bold"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: "#2c2418" }}
          >
            {data.courseTitle}
          </h1>
          <Divider width="40%" color="rgba(160,136,64,0.5)" />
          <div className="mt-4 flex gap-32">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[4px]" style={{ color: "#a08840" }}>
                Issue Date
              </p>
              <p
                className="mt-1.5 text-base font-semibold"
                style={{ fontFamily: "'Lora', serif", color: "#2c2418" }}
              >
                {data.formattedIssuedAt}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[4px]" style={{ color: "#a08840" }}>
                {data.directorTitle || "Director"}
              </p>
              <p
                className="mt-1.5 text-2xl italic"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: "#1a1208",
                  whiteSpace: "nowrap",
                  marginBottom: "8px",
                }}
              >
                {data.directorName}
              </p>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-[15%] right-[15%] h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #bfa364 30%, #d4b96a 50%, #bfa364 70%, transparent)",
          }}
        />

        <VerifyLink href={data.verifyUrl} color="#8a7a50" fontFamily="'Lora', serif" />
      </div>
    </div>
  );
}
