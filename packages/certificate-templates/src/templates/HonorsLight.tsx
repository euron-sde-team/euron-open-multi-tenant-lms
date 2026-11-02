"use client";

import { VerifyLink } from "../components/shared";
import { AutoFitName } from "../components/AutoFitName";
import { CertificateQR } from "../components/CertificateQR";
import { LogoImage } from "../components/LogoImage";
import { useCertificateFonts } from "../components/fontLoader";
import type { CertificateComponentProps } from "../types";

const CREAM = "#F7F3EB";
const CREAM_SOFT = "#F0EADB";
const PLUM = "#5C1A47";
const PLUM_SOFT = "#7A2B5F";
const PLUM_DEEP = "#3B0E2C";
const GOLD = "#B68F3A";
const GOLD_LIGHT = "#D9B86A";
const SLATE = "#475569";
const INK = "#1F1222";

function CornerFleur({
  position,
  color,
}: {
  position: "tl" | "tr" | "bl" | "br";
  color: string;
}) {
  const rotate = {
    tl: "rotate(0deg)",
    tr: "rotate(90deg)",
    br: "rotate(180deg)",
    bl: "rotate(270deg)",
  }[position];
  const pos: React.CSSProperties = {};
  if (position === "tl" || position === "bl") pos.left = "40px";
  if (position === "tr" || position === "br") pos.right = "40px";
  if (position === "tl" || position === "tr") pos.top = "40px";
  if (position === "bl" || position === "br") pos.bottom = "40px";
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        ...pos,
        width: "56px",
        height: "56px",
        transform: rotate,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "56px",
          height: "1px",
          background: color,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "1px",
          height: "56px",
          background: color,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "12px",
          top: "12px",
          width: "10px",
          height: "10px",
          border: `1px solid ${color}`,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

export function HonorsLight({ data }: CertificateComponentProps) {
  useCertificateFonts();
  return (
    <div
      className="relative overflow-hidden text-center"
      style={{
        width: "1122px",
        height: "793px",
        background: `linear-gradient(180deg, ${CREAM} 0%, ${CREAM_SOFT} 100%)`,
      }}
    >
      {/* Subtle paper texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(92,26,71,0.012) 2px, rgba(92,26,71,0.012) 3px)",
          backgroundSize: "6px 6px",
        }}
      />

      {/* Top double hairline */}
      <div
        className="absolute left-[64px] right-[64px] top-[44px] h-[1px]"
        style={{ background: PLUM }}
      />
      <div
        className="absolute left-[64px] right-[64px] top-[50px] h-[1px]"
        style={{ background: PLUM, opacity: 0.35 }}
      />

      {/* Bottom double hairline */}
      <div
        className="absolute bottom-[44px] left-[64px] right-[64px] h-[1px]"
        style={{ background: PLUM }}
      />
      <div
        className="absolute bottom-[50px] left-[64px] right-[64px] h-[1px]"
        style={{ background: PLUM, opacity: 0.35 }}
      />

      {/* Corner fleurs */}
      <CornerFleur position="tl" color={GOLD} />
      <CornerFleur position="tr" color={GOLD} />
      <CornerFleur position="bl" color={GOLD} />
      <CornerFleur position="br" color={GOLD} />

      {/* Letterhead caption */}
      <div className="absolute left-0 right-0 top-[82px]">
        <p
          className="text-[10px] font-bold uppercase"
          style={{
            color: GOLD,
            letterSpacing: "12px",
            fontFamily: "'Fraunces', serif",
          }}
        >
          Certificate of Honors
        </p>
        <div
          className="mx-auto mt-3 h-[4px] w-[120px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_LIGHT} 50%, ${GOLD} 80%, transparent)`,
          }}
        />
      </div>

      {/* Tenant logo centered */}
      {data.logoUrl && (
        <div className="absolute left-0 right-0 top-[130px] flex justify-center">
          <LogoImage
            src={data.logoUrl}
            className="h-[64px] w-auto max-w-[220px] object-contain"
          />
        </div>
      )}

      {/* Main content */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-[120px]"
        style={{ top: data.logoUrl ? "218px" : "176px" }}
      >
        <p
          className="text-[11px] italic"
          style={{
            color: SLATE,
            fontFamily: "'Fraunces', serif",
            letterSpacing: "2px",
          }}
        >
          This is to certify that
        </p>

        <AutoFitName
          text={`${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`}
          maxRem={4.6}
          minRem={2.5}
          lineHeight={1.02}
          maxLines={2}
          className="mt-3"
          style={{
            color: PLUM,
            fontFamily: "'Fraunces', serif",
            fontWeight: 500,
            letterSpacing: "-1.5px",
          }}
        />

        <div className="mt-4 flex w-[440px] items-center gap-3">
          <div
            className="h-[1px] flex-1"
            style={{ background: `linear-gradient(90deg, transparent, ${PLUM})` }}
          />
          <span
            className="text-[10px] font-semibold uppercase"
            style={{ color: PLUM, letterSpacing: "4px", fontFamily: "'Inter', sans-serif" }}
          >
            has satisfactorily completed
          </span>
          <div
            className="h-[1px] flex-1"
            style={{ background: `linear-gradient(270deg, transparent, ${PLUM})` }}
          />
        </div>

        <h1
          className="mt-4 max-w-[760px] text-[2rem] italic leading-[1.2]"
          style={{
            color: PLUM_DEEP,
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            letterSpacing: "-0.3px",
          }}
        >
          {data.courseTitle}
        </h1>

        <p
          className="mt-5 max-w-[640px] text-[13px] italic leading-[1.75]"
          style={{ color: SLATE, fontFamily: "'Fraunces', serif" }}
        >
          and is therefore awarded this credential in recognition of academic achievement
          and the demonstrated mastery prescribed by the program faculty.
        </p>
      </div>

      {/* Tri-signature footer */}
      <div className="absolute bottom-[76px] left-[140px] right-[140px] grid grid-cols-3 items-end gap-8">
        <div className="text-center">
          <p
            className="text-base"
            style={{ color: INK, fontFamily: "'Fraunces', serif", fontWeight: 500 }}
          >
            {data.formattedIssuedAt}
          </p>
          <div className="mx-auto mt-1 h-[1px] w-[130px]" style={{ background: PLUM }} />
          <p
            className="mt-1 text-[9px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            Date Conferred
          </p>
        </div>

        <div className="text-center">
          <p
            className="font-mono text-[11px]"
            style={{ color: PLUM, letterSpacing: "0.4px" }}
          >
            {data.certificateNumber}
          </p>
          <div className="mx-auto mt-1 h-[1px] w-[130px]" style={{ background: PLUM }} />
          <p
            className="mt-1 text-[9px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            Credential ID
          </p>
        </div>

        <div className="text-center">
          <p
            className="text-xl italic"
            style={{
              color: PLUM,
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginBottom: "8px",
            }}
          >
            {data.directorName}
          </p>
          <div className="mx-auto mt-0.5 h-[1px] w-[130px]" style={{ background: PLUM }} />
          <p
            className="mt-1 text-[9px] font-semibold uppercase"
            style={{ color: SLATE, letterSpacing: "3px", fontFamily: "'Inter', sans-serif" }}
          >
            {data.directorTitle || "Director"}
          </p>
        </div>
      </div>

      {/* QR bottom-right */}
      <div className="absolute bottom-[72px] right-[56px]">
        <div style={{ padding: "3px", background: CREAM, border: `1px solid ${GOLD}` }}>
          <CertificateQR value={data.verifyUrl} size={52} fgColor={PLUM} bgColor="transparent" />
        </div>
      </div>

      <VerifyLink href={data.verifyUrl} color={PLUM_SOFT} fontFamily="'Inter', sans-serif" />
    </div>
  );
}
