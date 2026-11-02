"use client";

import { CertNumberBadge, VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const IVORY = "#f9f6ee";
const BURGUNDY = "#6b1f27";
const BURGUNDY_DEEP = "#4a1219";
const GOLD = "#b68f3a";
const GOLD_LIGHT = "#d9b86a";

export function UniversityFormal({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1122px",
        height: "793px",
        background: `linear-gradient(180deg, ${IVORY} 0%, #f5efe1 100%)`,
      }}
    >
      {/* Subtle diagonal damask */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(107,31,39,0.02) 40px, rgba(107,31,39,0.02) 41px), repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(182,143,58,0.02) 40px, rgba(182,143,58,0.02) 41px)",
        }}
      />

      {/* Gold single hairline frame */}
      <div
        className="pointer-events-none absolute inset-[26px]"
        style={{ border: `1px solid ${GOLD}` }}
      />
      <div
        className="pointer-events-none absolute inset-[32px]"
        style={{ border: `1px solid ${GOLD_LIGHT}`, opacity: 0.35 }}
      />

      {/* Content area */}
      <div className="absolute bottom-[80px] left-[60px] right-[60px] top-[60px] flex flex-col items-center px-12 pb-6 pt-6 text-center">
        <CertNumberBadge number={data.certificateNumber} color={BURGUNDY} numColor={GOLD} />

        <LogoImage
          src={data.logoUrl}
          className="mb-3 h-[76px] w-auto max-w-[280px] object-contain"
        />

        <h3
          className="mt-1 text-[2.4rem]"
          style={{ fontFamily: "'Playfair Display', serif", color: BURGUNDY, fontWeight: 700, letterSpacing: "2px" }}
        >
          CERTIFICATE
        </h3>
        <p
          className="text-sm italic"
          style={{ fontFamily: "'Lora', serif", color: BURGUNDY_DEEP, letterSpacing: "6px" }}
        >
          of accomplishment
        </p>

        {/* Gold bar */}
        <div
          className="my-4 h-[3px] w-[320px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_LIGHT} 50%, ${GOLD} 80%, transparent)`,
          }}
        />

        <p
          className="text-base"
          style={{ fontFamily: "'Lora', serif", color: BURGUNDY_DEEP, fontStyle: "italic" }}
        >
          Be it known that
        </p>
        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={4.2}
          minRem={2.4}
          lineHeight={1.05}
          maxLines={2}
          className="my-2"
          style={{ fontFamily: "'Playfair Display', serif", color: BURGUNDY, fontWeight: 700 }}
        />
        <p
          className="max-w-[700px] text-base italic leading-relaxed"
          style={{ fontFamily: "'Lora', serif", color: BURGUNDY_DEEP }}
        >
          having fulfilled all requirements prescribed by the faculty, is hereby awarded this certificate in recognition of the successful completion of
        </p>
        <h1
          className="mt-3 max-w-[760px] text-[1.7rem]"
          style={{ fontFamily: "'Playfair Display', serif", color: BURGUNDY_DEEP, fontWeight: 700, letterSpacing: "0.5px" }}
        >
          {data.courseTitle}
        </h1>
      </div>

      {/* Bottom strip: date, medallion, signature */}
      <div className="absolute bottom-[34px] left-[60px] right-[60px] flex items-end justify-between px-6">
        <div className="flex flex-col items-center">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: BURGUNDY, letterSpacing: "3px", fontFamily: "'Lora', serif" }}
          >
            Conferred On
          </p>
          <p
            className="mt-1 text-base italic"
            style={{ fontFamily: "'Playfair Display', serif", color: BURGUNDY_DEEP }}
          >
            {data.formattedIssuedAt}
          </p>
        </div>

        {/* Medallion with logo */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: "110px",
            height: "110px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${GOLD_LIGHT}, ${GOLD} 60%, #7a5f1f 100%)`,
            boxShadow: "0 4px 12px rgba(74,18,25,0.25), inset 0 2px 4px rgba(255,255,255,0.35)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "92px",
              height: "92px",
              borderRadius: "50%",
              background: IVORY,
              border: `2px solid ${BURGUNDY}`,
            }}
          >
            {data.logoUrl ? (
              <LogoImage
                src={data.logoUrl}
                alt=""
                className="h-[60px] w-[60px] object-contain"
              />
            ) : (
              <span
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  fontSize: "32px",
                  color: BURGUNDY,
                }}
              >
                ★
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: BURGUNDY, letterSpacing: "3px", fontFamily: "'Lora', serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
          <p
            className="mt-1 text-2xl italic"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: BURGUNDY_DEEP,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="mt-0.5 h-[1px] w-[130px]" style={{ background: BURGUNDY }} />
        </div>
      </div>

      {/* QR */}
      <div className="absolute bottom-[32px] right-[18px] flex flex-col items-center gap-0.5">
        <div style={{ padding: "3px", background: IVORY, border: `1px solid ${GOLD}` }}>
          <CertificateQR value={data.verifyUrl} size={56} fgColor={BURGUNDY_DEEP} bgColor="transparent" />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={BURGUNDY} fontFamily="'Lora', serif" />
    </div>
  );
}
