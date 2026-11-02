"use client";

import { QRCodeSVG } from "qrcode.react";

interface Props {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export function CertificateQR({
  value,
  size = 84,
  fgColor = "#111111",
  bgColor = "transparent",
  className,
  style,
  title = "Scan to verify certificate",
}: Props) {
  return (
    <div
      className={className}
      style={style}
      aria-label={title}
      title={title}
      data-certificate-qr
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        fgColor={fgColor}
        bgColor={bgColor}
        marginSize={0}
      />
    </div>
  );
}
