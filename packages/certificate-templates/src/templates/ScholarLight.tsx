"use client";

import { VerifyLink, VerticalText } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const IVORY = "#FAFAF5";
const IVORY_SOFT = "#F3F1E8";
const NAVY = "#0F1E3D";
const NAVY_SOFT = "#1E3A6A";
const BLUE = "#1D4ED8";
const BLUE_DEEP = "#1E3A8A";
const GOLD = "#B68F3A";
const GOLD_LIGHT = "#D9B86A";
const SLATE = "#475569";
const RIBBON_WIDTH = 72;

export function ScholarLight({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1122px",
        height: "793px",
        background: `linear-gradient(180deg, ${IVORY} 0%, ${IVORY_SOFT} 100%)`,
      }}
    >
      {/* Soft texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(15,30,61,0.015) 2px, rgba(15,30,61,0.015) 3px)",
          backgroundSize: "6px 6px",
        }}
      />

      {/* Double border frame */}
      <div className="pointer-events-none absolute inset-[20px]" style={{ border: `1px solid ${NAVY}` }} />
      <div
        className="pointer-events-none absolute inset-[28px]"
        style={{ border: `1px solid ${BLUE}`, opacity: 0.35 }}
      />

      {/* Header, institution row */}
      <div
        className="absolute left-[64px] top-[52px] flex items-center gap-4"
        style={{ right: `${RIBBON_WIDTH + 32}px` }}
      >
        {data.logoUrl && (
          <>
            <LogoImage
              src={data.logoUrl}
              className="h-[48px] w-auto max-w-[180px] object-contain"
            />
            <div className="h-[30px] w-[1px]" style={{ background: GOLD }} />
          </>
        )}
        <div className="leading-tight">
          <p
            className="text-[10px] font-bold uppercase"
            style={{
              color: BLUE,
              letterSpacing: "6px",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Verified Credential
          </p>
          <p
            className="mt-0.5 text-[11px] font-medium italic"
            style={{ color: SLATE, fontFamily: "'Fraunces', serif" }}
          >
            Course Completion Certificate
          </p>
        </div>
      </div>

      {/* Cert number, discreet bottom-right meta later handled in footer */}

      {/* Main content block */}
      <div
        className="absolute left-[64px] top-[170px]"
        style={{ right: `${RIBBON_WIDTH + 32}px` }}
      >
        <p
          className="text-[11px] font-semibold uppercase"
          style={{
            color: GOLD,
            letterSpacing: "8px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          This certifies that
        </p>

        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={4.6}
          minRem={2.5}
          lineHeight={1.02}
          maxLines={2}
          className="mt-4"
          style={{
            color: NAVY,
            fontFamily: "'Fraunces', serif",
            fontWeight: 500,
            letterSpacing: "-1.5px",
          }}
        />

        <div className="mt-5 flex items-center gap-4">
          <div className="h-[1px] w-[40px]" style={{ background: NAVY }} />
          <p
            className="text-sm"
            style={{ color: SLATE, fontFamily: "'Inter', sans-serif", letterSpacing: "0.5px" }}
          >
            has successfully completed the course of study in
          </p>
          <div className="h-[1px] flex-1" style={{ background: NAVY }} />
        </div>

        <h1
          className="mt-5 max-w-[700px] text-[2rem] leading-[1.2]"
          style={{
            color: NAVY_SOFT,
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            letterSpacing: "-0.3px",
          }}
        >
          {data.courseTitle}
        </h1>

        <p
          className="mt-6 max-w-[620px] text-[14px] leading-[1.75]"
          style={{ color: SLATE, fontFamily: "'Inter', sans-serif" }}
        >
          Having fulfilled all requirements of the curriculum and demonstrated the
          competencies prescribed therein, this credential attests to the successful
          completion of the program on the date set forth below.
        </p>
      </div>

      {/* Bottom tri-signature row */}
      <div
        className="absolute bottom-[56px] left-[64px] grid grid-cols-3 items-end gap-6"
        style={{ right: `${RIBBON_WIDTH + 32}px` }}
      >
        <div>
          <div className="h-[1px] w-[140px]" style={{ background: NAVY }} />
          <p
            className="mt-1.5 text-base font-semibold"
            style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }}
          >
            {data.formattedIssuedAt}
          </p>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            Date Issued
          </p>
        </div>

        <div className="text-center">
          <p
            className="font-mono text-[11px]"
            style={{ color: NAVY_SOFT, letterSpacing: "0.5px" }}
          >
            {data.certificateNumber}
          </p>
          <div className="mx-auto mt-1 h-[1px] w-[140px]" style={{ background: NAVY }} />
          <p
            className="mt-1 text-[10px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            Credential ID
          </p>
        </div>

        <div className="text-right">
          <p
            className="text-xl italic"
            style={{
              color: NAVY,
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="ml-auto mt-0.5 h-[1px] w-[140px]" style={{ background: NAVY }} />
          <p
            className="mt-1 text-[10px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>
      </div>

      {/* Right vertical ribbon + seal */}
      <div
        className="absolute right-0 top-0 flex h-full flex-col items-center justify-between py-[52px]"
        style={{
          width: `${RIBBON_WIDTH}px`,
          background: `linear-gradient(180deg, ${BLUE} 0%, ${BLUE_DEEP} 100%)`,
        }}
      >
        {/* Top vertical text (reads bottom-to-top). Uses single-transform
            rotation to avoid the writing-mode + rotate html2canvas bug. */}
        <VerticalText width={RIBBON_WIDTH} height={240}>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              color: "#EFF6FF",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "8px",
              textTransform: "uppercase",
            }}
          >
            Certified &nbsp;&middot;&nbsp; Verified
          </span>
        </VerticalText>

        {/* Circular seal */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 30%, ${GOLD_LIGHT}, ${GOLD} 60%, #7a5f1f 100%)`,
            marginLeft: `-${(120 - RIBBON_WIDTH) / 2}px`,
            boxShadow: "0 4px 12px rgba(15,30,61,0.3), inset 0 2px 4px rgba(255,255,255,0.3)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "98px",
              height: "98px",
              borderRadius: "50%",
              background: IVORY,
              border: `2px solid ${BLUE_DEEP}`,
            }}
          >
            {data.logoUrl ? (
              <LogoImage
                src={data.logoUrl}
                alt=""
                className="h-[56px] w-[56px] object-contain"
              />
            ) : (
              <span
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  fontSize: "28px",
                  color: BLUE_DEEP,
                }}
              >
                ★
              </span>
            )}
          </div>
        </div>

        {/* QR at bottom of ribbon */}
        <div style={{ padding: "3px", background: IVORY, border: `1px solid ${GOLD}` }}>
          <CertificateQR value={data.verifyUrl} size={52} fgColor={NAVY} bgColor="transparent" />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={SLATE} fontFamily="'Inter', sans-serif" />
    </div>
  );
}
