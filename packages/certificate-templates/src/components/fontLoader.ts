import { useEffect } from "react";

const FONT_LINK_ID = "certificate-fonts";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Manrope:wght@400;500;600;700",
    "family=Marck+Script",
    "family=Mea+Culpa",
    "family=Inter:wght@400;500;600;700",
    "family=Playfair+Display:ital,wght@0,500;0,700;1,400",
    "family=Space+Grotesk:wght@400;500;600;700",
    "family=Instrument+Serif:ital@0;1",
    "family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700",
    "family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400",
    "family=Lora:wght@400;500;600",
    "family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,700;1,9..144,400",
    "family=JetBrains+Mono:wght@400;500;600",
  ].join("&") +
  "&display=swap";

let injected = false;

export function useCertificateFonts(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (injected || document.getElementById(FONT_LINK_ID)) {
      injected = true;
      return;
    }
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
    injected = true;
  }, []);
}
