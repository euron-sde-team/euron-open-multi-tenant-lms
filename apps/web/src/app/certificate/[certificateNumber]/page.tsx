"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Download,
  Share2,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  CertificateRenderer,
  ConfigCertificateRenderer,
  CERTIFICATE_PAGE_DIMENSIONS,
  useCertificateFonts,
  type CertificateData as TemplateData,
  type CertificateDesign,
} from "@open-mtlms/certificate-templates";
import { CertificateShareModal } from "@/components/certificate/CertificateShareModal";
import { useToast } from "@/components/ui/use-toast";
import { getLogoProxyUrl, verifyCertificate } from "@/lib/api/certificates";

interface CertificateData extends TemplateData {
  templateId: string;
  tenantName: string;
  issuedAt: string;
  design?: CertificateDesign | null;
}

type PageMode = "loading" | "certificate" | "verified" | "not-found";

const PAGE_MM: Record<string, { width: number; height: number }> = {
  A4: { width: 297, height: 210 },
  LETTER: { width: 279, height: 216 },
};

/** PDF page geometry (mm) from a config design; legacy certs are A4 landscape. */
function pdfPageMm(design?: CertificateDesign | null): {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
} {
  const base = (design && PAGE_MM[design.page.size]) || PAGE_MM.A4;
  const portrait = design?.page.orientation === "PORTRAIT";
  return {
    width: portrait ? Math.min(base.width, base.height) : Math.max(base.width, base.height),
    height: portrait ? Math.max(base.width, base.height) : Math.min(base.width, base.height),
    orientation: portrait ? "portrait" : "landscape",
  };
}

// Raster scale for the PDF bitmap: the A4 canvas (793x1122 / 1122x793 px) at
// 3x is ~285 DPI on paper, crisp for print without ballooning the file.
const PDF_PIXEL_RATIO = 3;
const PDF_JPEG_QUALITY = 0.92;

// Safari's SVG-foreignObject rasterizer can miss embedded resources on its
// first pass; a cheap warm-up render primes them so the real capture is complete.
const isWebKitOnly = () =>
  typeof navigator !== "undefined" &&
  /AppleWebKit/i.test(navigator.userAgent) &&
  !/Chrome|CriOS|Edg/i.test(navigator.userAgent);

// Every certificate template renders at this fixed pixel canvas. On screens
// narrower than this we scale the whole canvas down (CSS transform) to fit the
// viewport instead of forcing a horizontal scroll, see the scaler in the render.
const CERT_WIDTH = 1122;
const CERT_HEIGHT = 793;

// Native canvas dimensions for a certificate. Config designs carry their own
// page size/orientation; legacy templates use the fixed A4-landscape canvas.
function canvasDims(design?: CertificateDesign | null): { width: number; height: number } {
  if (design) return CERTIFICATE_PAGE_DIMENSIONS[design.page.size][design.page.orientation];
  return { width: CERT_WIDTH, height: CERT_HEIGHT };
}

/**
 * Decode HTML entities for display on the certificate (view + PDF + filename).
 *
 * Why this is needed:
 * - The backend xss-sanitizer encodes text on write, so a course/org name like
 *   "Agile & Scrum" is stored as "Agile &amp; Scrum". Rendered verbatim, the
 *   certificate shows the raw "&amp;" instead of "&".
 * - `&amp;` is decoded LAST so we never double-decode (e.g. "&amp;lt;" stays
 *   "&lt;" rather than collapsing to "<").
 */
function decodeEntities(value: string): string {
  if (!value) return value;
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Return a copy of the certificate data with all human-readable text fields
 * HTML-decoded, so the on-screen certificate, the downloaded PDF, and the PDF
 * filename all show natural, readable names.
 */
function decodeCertData(data: CertificateData): CertificateData {
  return {
    ...data,
    courseTitle: decodeEntities(data.courseTitle),
    firstName: decodeEntities(data.firstName),
    lastName: decodeEntities(data.lastName),
    directorName: decodeEntities(data.directorName),
    directorTitle: decodeEntities(data.directorTitle),
    tenantName: decodeEntities(data.tenantName),
  };
}

const LOGO_FETCH_TIMEOUT_MS = 8_000;

/**
 * Load an image URL through our server-side proxy and convert it to a base64
 * data URL, ready to be dropped into an `<img>` so the PDF capture can embed it.
 *
 * Why a proxy?
 * - Certificate templates render `<img src={logoUrl}>` without `crossOrigin`,
 *   so the on-screen display works regardless of the logo bucket's CORS policy.
 * - For PDF export we must read pixel data via canvas; the browser only allows
 *   that if the image arrived with `Access-Control-Allow-Origin` headers.
 * - Tenant S3 buckets often don't CORS-allow every tenant subdomain.
 * - The backend proxy fetches the bytes server-side (no browser CORS
 *   enforcement) and returns them with permissive CORS headers we control.
 *
 * Guarantees:
 * - Resolves within `LOGO_FETCH_TIMEOUT_MS` (no infinite hangs).
 * - Returns `null` on any failure; caller just skips the swap and the PDF is
 *   generated without that logo bitmap (still a valid, downloadable PDF).
 */
function loadLogoAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), LOGO_FETCH_TIMEOUT_MS);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0);
        finish(canvas.toDataURL("image/png"));
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = getLogoProxyUrl(url);
  });
}

export default function CertificatePage() {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const router = useRouter();
  const { toast } = useToast();
  useCertificateFonts();
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mode, setMode] = useState<PageMode>("loading");
  // Responsive scale for the fixed-size certificate canvas (1 on desktop,
  // <1 on tablet/mobile so the whole certificate fits the viewport width).
  const [certScale, setCertScale] = useState(1);
  const scaleWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`cert-${certificateNumber}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CertificateData;
        if (parsed && parsed.certificateNumber) {
          if (parsed.logoUrl) {
            const sep = parsed.logoUrl.includes("?") ? "&" : "?";
            parsed.logoUrl = `${parsed.logoUrl}${sep}v=${Date.now()}`;
          }
          // Build the verify URL from the domain the cert is actually viewed on.
          // The page only loads on a host that resolves to the owning tenant, so
          // this always produces a working link AND stays correct per environment
          // (dev domain in dev, prod domain in prod). The backend/stored value
          // can be a stale prod domain sitting in the dev DB, which is exactly
          // what pointed shares + QR at the wrong domain.
          parsed.verifyUrl = `${window.location.origin}/certificate/${parsed.certificateNumber}`;
          // Defensive: sessionStorage entries written before directorTitle existed.
          if (!parsed.directorTitle) parsed.directorTitle = "Director";
          setCertData(decodeCertData(parsed));
          setMode("certificate");
          return;
        }
      } catch {
        // Corrupted sessionStorage payload, fall through to the API path.
      }
    }

    const fetchFromApi = async () => {
      try {
        const result = await verifyCertificate(certificateNumber);
        // Cache-bust the logo URL the same way the sessionStorage path does
        // (line ~154). Without this, the API path's logoUrl was always the
        // raw S3/CDN URL, when the download flow proxied it through the
        // backend, intermediate caches could serve stale bytes and the
        // second download attempt would silently fail to capture the logo.
        // Bug #14 from QA: "Certificate downloadable from website only the
        // first time." Forcing a fresh ?v= per page load means every
        // download starts from a clean fetch chain.
        const logoUrl = result.logoUrl
          ? `${result.logoUrl}${result.logoUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
          : result.logoUrl;
        const data: CertificateData = {
          certificateNumber: result.certificateNumber,
          templateId: result.templateId,
          courseTitle: result.courseTitle,
          firstName: result.firstName,
          lastName: result.lastName,
          formattedIssuedAt: result.formattedIssuedAt,
          logoUrl,
          // Same-origin verify URL: env-correct and always resolvable (see the
          // sessionStorage path above for why we do not use the backend value).
          verifyUrl: `${window.location.origin}/certificate/${result.certificateNumber}`,
          directorName: result.directorName,
          directorTitle: result.directorTitle,
          tenantName: result.tenantName,
          issuedAt: result.issuedAt,
          design: result.design,
          hoursText: result.hoursText,
          lessonsCompleted: result.lessonsCompleted,
          quizzesPassed: result.quizzesPassed,
          finalScore: result.finalScore,
          testSeriesTitle: result.testSeriesTitle,
          signatureUrl: result.signatureUrl,
          expiryText: result.expiryText,
        };
        setCertData(decodeCertData(data));
        setMode("verified");
      } catch {
        setMode("not-found");
      }
    };

    fetchFromApi();
  }, [certificateNumber]);

  // Fit the fixed 1122px certificate canvas to the available width. Runs when the
  // certificate mounts and on any container resize (orientation change, etc.).
  useEffect(() => {
    if (mode === "loading" || mode === "not-found") return;
    const el = scaleWrapRef.current;
    if (!el) return;
    const compute = () => {
      const available = el.clientWidth;
      const nativeWidth = canvasDims(certData?.design).width;
      if (available > 0) setCertScale(Math.min(1, available / nativeWidth));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [mode, certData]);

  const handleDownload = useCallback(async () => {
    if (!certData) return;
    setDownloading(true);

    const container = document.getElementById("certificate-content");
    const logoImgs = container
      ? Array.from(container.querySelectorAll<HTMLImageElement>("img[data-logo]"))
      : [];
    const swaps: Array<{ img: HTMLImageElement; originalSrc: string }> = [];

    // Designed templates paint their background as a CSS background-image on a
    // tagged div (not an <img>), so it never matches the img[data-logo] query
    // above and needs its own proxy + data-URL swap before capture (the
    // rasterizer cannot embed cross-origin resources either).
    const bgEl =
      container?.querySelector<HTMLElement>("[data-certificate-background]") ?? null;
    const bgUrl = certData.design?.background?.assetUrl ?? null;
    let bgSwap: { el: HTMLElement; original: string } | null = null;

    // On tablet/mobile the certificate is visually scaled down (see certScale).
    // The PDF must always be captured at the native 1122x793 canvas, so drop the
    // scale transform for the duration of the snapshot and restore it afterwards.
    // This also keeps the verify-link anchor rect math (below) in native pixels.
    const prevTransform = container?.style.transform ?? "";

    try {
      if (!container) throw new Error("certificate element not found");
      container.style.transform = "none";
      // Fetch all logos in parallel through the backend proxy and swap `src`
      // to the resulting data URL. A swap only happens when proxying succeeds;
      // otherwise the original URL stays, the capture omits that one image,
      // and the PDF still generates.
      //
      // Add a per-attempt cache-buster on the proxy fetch so the second
      // download click in the same page session doesn't get a stale proxy
      // response (some CDNs/Cloudfronts cache the proxy endpoint by query
      // string). Bug #14: was working on first click, failing after.
      const downloadNonce = Date.now();
      const cacheBust = (src: string): string =>
        `${src}${src.includes("?") ? "&" : "?"}dl=${downloadNonce}`;
      const [base64Results, bgBase64] = await Promise.all([
        Promise.all(logoImgs.map((img) => loadLogoAsBase64(cacheBust(img.src)))),
        bgEl && bgUrl
          ? loadLogoAsBase64(cacheBust(bgUrl))
          : Promise.resolve<string | null>(null),
      ]);
      base64Results.forEach((b64, idx) => {
        const img = logoImgs[idx];
        if (b64 && img) {
          swaps.push({ img, originalSrc: img.src });
          img.src = b64;
        }
      });

      if (bgEl && bgUrl) {
        // A designed certificate without its background is an unusable export,
        // so fail the download (retryable via the error toast) rather than
        // silently saving a white PDF. Decorative <img> elements above keep
        // the graceful skip: the PDF still generates without them.
        if (!bgBase64) {
          throw new Error("certificate background could not be embedded");
        }
        bgSwap = { el: bgEl, original: bgEl.style.backgroundImage };
        bgEl.style.backgroundImage = `url("${bgBase64}")`;
      }

      if (swaps.length > 0 || bgSwap) {
        // Give the browser a tick to commit the new data-URL `src` before the
        // capture snapshots the DOM.
        await new Promise((r) => setTimeout(r, 50));
      }

      // Rasterize with the browser's own renderer (SVG foreignObject via
      // html-to-image) instead of html2canvas: html2canvas re-implements text
      // layout with its own font metrics and drew Garamond-class serifs about
      // half a line low, so overlay text drifted onto the ruled lines baked
      // into designed backgrounds. The browser painting its own layout is
      // WYSIWYG with the on-screen certificate by construction.
      // Precompute the @font-face CSS (webfonts inlined as data URLs) once and
      // share it across the warm-up and real renders. If embedding fails,
      // undefined lets toCanvas run its own internal font embedding instead of
      // aborting the download.
      const fontEmbedCSS = await getFontEmbedCSS(container).catch(
        () => undefined,
      );
      if (isWebKitOnly()) {
        await toCanvas(container, { pixelRatio: 1, fontEmbedCSS });
      }
      const canvas = await toCanvas(container, {
        pixelRatio: PDF_PIXEL_RATIO,
        backgroundColor: "#ffffff",
        fontEmbedCSS,
      });

      const page = pdfPageMm(certData.design);
      const doc = new jsPDF({
        unit: "mm",
        format: [page.width, page.height],
        orientation: page.orientation,
        compress: true,
      });
      doc.addImage(
        canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY),
        "JPEG",
        0,
        0,
        page.width,
        page.height,
        undefined,
        "FAST",
      );

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Place clickable link over the verify anchor if the template marked one.
      // Falls back to the bottom-left strip matching historical placement.
      const anchorEl = container?.querySelector<HTMLElement>("[data-pdf-verify='1']");
      if (anchorEl && container) {
        const anchorRect = anchorEl.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        if (contRect.width > 0 && contRect.height > 0) {
          const xMm = ((anchorRect.left - contRect.left) / contRect.width) * pageWidth;
          const yMm = ((anchorRect.top - contRect.top) / contRect.height) * pageHeight;
          const wMm = (anchorRect.width / contRect.width) * pageWidth;
          const hMm = (anchorRect.height / contRect.height) * pageHeight;
          doc.link(xMm, yMm, wMm, hMm, { url: certData.verifyUrl });
        } else {
          doc.link(10, pageHeight - 12, pageWidth * 0.5, 8, { url: certData.verifyUrl });
        }
      } else {
        doc.link(10, pageHeight - 12, pageWidth * 0.5, 8, { url: certData.verifyUrl });
      }

      doc.save(`${certData.firstName}_${certData.courseTitle}_certificate.pdf`);

      toast({ title: "Downloaded", description: "Certificate saved as PDF." });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate PDF.",
        variant: "destructive",
      });
    } finally {
      // ALWAYS restore the original `src` values, if we bail mid-way, the DOM
      // must not be left with base64 data URLs that would bloat the page and
      // confuse a subsequent retry.
      swaps.forEach(({ img, originalSrc }) => {
        img.src = originalSrc;
      });
      if (bgSwap) bgSwap.el.style.backgroundImage = bgSwap.original;
      if (container) container.style.transform = prevTransform;
      setDownloading(false);
    }
  }, [certData, toast]);

  if (mode === "loading") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">Verifying certificate...</p>
      </div>
    );
  }

  if (mode === "not-found") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Certificate Not Found
        </h1>
        <p className="max-w-md text-center text-sm text-gray-500">
          The certificate with number{" "}
          <span className="font-mono font-medium">{certificateNumber}</span> could not be
          found or has been revoked.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!certData) return null;

  const { width: canvasWidth, height: canvasHeight } = canvasDims(certData.design);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {mode === "verified" && (
        <div className="border-b border-green-200 bg-green-50 px-6 py-3 dark:border-green-900 dark:bg-green-950/40">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Verified Certificate
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                This certificate has been verified by {certData.tenantName}. Issued to{" "}
                {certData.firstName} {certData.lastName} on {certData.formattedIssuedAt}.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/80 px-6 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
        </div>
      </div>

      <div className="px-4 py-8">
        {/* Scaler: full width up to the native canvas width, centered. Its height
            mirrors the scaled canvas so the page reserves the right space. The
            canvas dimensions come from the config design when present. */}
        <div
          ref={scaleWrapRef}
          className="mx-auto w-full"
          style={{ maxWidth: canvasWidth, height: canvasHeight * certScale }}
        >
          <div
            id="certificate-content"
            className="flex-shrink-0"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: certScale < 1 ? `scale(${certScale})` : undefined,
              transformOrigin: "top left",
            }}
          >
            {certData.design ? (
              <ConfigCertificateRenderer design={certData.design} data={certData} />
            ) : (
              <CertificateRenderer templateId={certData.templateId} data={certData} />
            )}
          </div>
        </div>
      </div>

      <CertificateShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        certificateNumber={certData.certificateNumber}
        courseTitle={certData.courseTitle}
        tenantName={certData.tenantName}
        issuedAt={certData.issuedAt}
        verifyUrl={certData.verifyUrl}
      />
    </div>
  );
}
