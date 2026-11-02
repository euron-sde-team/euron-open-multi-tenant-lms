"use client";

import { CertNumberBadge, VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const PARCHMENT = "#f5efdf";
const NAVY = "#1a2747";
const GOLD = "#a88a2f";
const GOLD_SOFT = "#c7a95a";

export function AcademicParchment({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1122px",
        height: "793px",
        background: `radial-gradient(ellipse at 50% 40%, #faf4e2 0%, ${PARCHMENT} 55%, #eee5cd 100%)`,
      }}
    >
      {/* Aged paper texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(120,95,45,0.02) 2px, rgba(120,95,45,0.02) 3px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(120,95,45,0.02) 2px, rgba(120,95,45,0.02) 3px)",
          backgroundSize: "6px 6px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 10% 90%, rgba(120,95,45,0.08) 0%, transparent 45%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 90% 10%, rgba(120,95,45,0.06) 0%, transparent 40%)" }}
      />

      {/* Outer + inner hairline double border */}
      <div className="pointer-events-none absolute inset-[18px]" style={{ border: `2.5px solid ${GOLD}` }} />
      <div className="pointer-events-none absolute inset-[26px]" style={{ border: `1px solid ${GOLD_SOFT}` }} />

      {/* Corner fleurs, simple geometric ornaments */}
      {[
        { l: "22px", t: "22px" },
        { r: "22px", t: "22px" },
        { l: "22px", b: "22px" },
        { r: "22px", b: "22px" },
      ].map((pos, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{
            width: "54px",
            height: "54px",
            left: pos.l,
            top: pos.t,
            right: pos.r,
            bottom: pos.b,
          }}
        >
          <div
            className="absolute"
            style={{
              inset: 0,
              borderRadius: "50%",
              border: `1.5px solid ${GOLD}`,
              opacity: 0.4,
            }}
          />
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: "20px",
              height: "20px",
              transform: "translate(-50%,-50%) rotate(45deg)",
              border: `1px solid ${GOLD}`,
            }}
          />
        </div>
      ))}

      {/* Ribbon sash across top-center */}
      <div className="pointer-events-none absolute left-1/2 top-[14px] -translate-x-1/2">
        <div
          style={{
            width: "140px",
            height: "24px",
            background: `linear-gradient(180deg, ${NAVY} 0%, #2c3a5f 100%)`,
            clipPath: "polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        />
      </div>

      {/* Inner content */}
      <CertNumberBadge number={data.certificateNumber} color={NAVY} numColor={GOLD} />

      <div className="absolute inset-[70px] flex flex-col items-center justify-center px-[110px] text-center">
        <LogoImage
          src={data.logoUrl}
          className="mb-5 h-[80px] w-auto max-w-[300px] object-contain"
        />

        <p
          className="mb-1 text-xs font-bold uppercase"
          style={{ color: NAVY, letterSpacing: "10px", fontFamily: "'EB Garamond', serif" }}
        >
          Academic Honors
        </p>
        <h3
          className="mb-2 text-[3.2rem]"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: NAVY, fontWeight: 600, letterSpacing: "1px" }}
        >
          Certificate of Completion
        </h3>

        {/* Ornamented divider: dot, line, diamond, line, dot */}
        <div className="my-2 flex w-[420px] items-center gap-2">
          <div className="flex-1" style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: GOLD }} />
          <div style={{ width: "14px", height: "14px", transform: "rotate(45deg)", border: `1px solid ${GOLD}` }} />
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: GOLD }} />
          <div className="flex-1" style={{ height: "1px", background: `linear-gradient(270deg, transparent, ${GOLD})` }} />
        </div>

        <p
          className="mt-2 text-base italic"
          style={{ color: "#3a3a3a", fontFamily: "'EB Garamond', serif" }}
        >
          This is to certify that
        </p>
        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={4}
          minRem={2.4}
          lineHeight={1.1}
          maxLines={2}
          className="my-2"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: NAVY, fontWeight: 700 }}
        />
        <p
          className="text-base italic"
          style={{ color: "#3a3a3a", fontFamily: "'EB Garamond', serif" }}
        >
          has successfully completed the course of study in
        </p>
        <h1
          className="my-2 max-w-[720px] text-[1.8rem] font-semibold"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: NAVY }}
        >
          {data.courseTitle}
        </h1>

        <div className="my-3 h-[1px] w-[60%]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD} 50%, transparent)` }} />

        <div className="flex items-end gap-24">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase" style={{ color: GOLD, letterSpacing: "3px" }}>
              Issued On
            </p>
            <p
              className="mt-1 text-base"
              style={{ fontFamily: "'EB Garamond', serif", color: NAVY, fontWeight: 500 }}
            >
              {data.formattedIssuedAt}
            </p>
          </div>

          {/* Wax-style round seal */}
          <div
            className="relative flex items-center justify-center"
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${GOLD_SOFT}, ${GOLD} 70%, #7a5f1a 100%)`,
              boxShadow: "0 3px 8px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: NAVY,
                  letterSpacing: "1px",
                }}
              >
                EST
              </span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[11px] font-bold uppercase" style={{ color: GOLD, letterSpacing: "3px" }}>
              {data.directorTitle || "Director"}
            </p>
            <p
              className="mt-1 text-2xl italic"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                color: NAVY,
                whiteSpace: "nowrap",
                marginBottom: "8px",
              }}
            >
              {data.directorName}
            </p>
          </div>
        </div>
      </div>

      {/* QR */}
      <div className="absolute bottom-[36px] right-[42px]">
        <div
          style={{
            padding: "4px",
            background: "rgba(255,255,255,0.7)",
            border: `1px solid ${GOLD_SOFT}`,
          }}
        >
          <CertificateQR value={data.verifyUrl} size={72} fgColor={NAVY} bgColor="transparent" />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={NAVY} fontFamily="'EB Garamond', serif" />
    </div>
  );
}
