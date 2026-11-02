"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Minus, Plus, SunMoon, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { BOOK_AI_ENABLED, explainSelectedText, generateBookSummary } from "@/lib/book-ai";
import { bookReadingApi } from "@/lib/api/book-reading";
import { useContentTerm } from "@/lib/hooks/use-content-terms";

import "./pdf-reader.css";

// Load the pdf.js worker as a standalone module from /public. The obvious-looking
// `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` approach
// routes the worker through Webpack + SWC, which injects bare-specifier helper
// imports (e.g. "@swc/helpers/_/_class_private_field_get") that the browser
// can't resolve inside a worker context, blowing up with:
//   "Setting up fake worker failed: Failed to resolve module specifier ..."
// pdfjs-dist already ships a pre-bundled worker; serving it directly bypasses
// the bundler entirely. public/pdf.worker.min.mjs must match react-pdf's
// pdfjs-dist version (4.8.69); recopy it when react-pdf is upgraded.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type ThemeKey = "light" | "sepia" | "dark";
const THEME_CYCLE: ThemeKey[] = ["light", "sepia", "dark"];

interface PdfReaderProps {
  /** Raw PDF bytes streamed from the learner-api. */
  bookData: ArrayBuffer;
  bookName: string;
  bookId: string;
  /** Pre-generated description from admin panel, falls back when summary AI fails. */
  bookDescription?: string;
  onBack?: () => void;
  /** Sample mode caps rendered pages to this number. Ignored when null/undefined. */
  samplePageCap?: number | null;
}

interface SelectionPopupState {
  text: string;
  x: number;
  y: number;
}

const PROGRESS_SAVE_DEBOUNCE_MS = 2000;
const TEXT_EXTRACT_PAGE_BUDGET = 8;
const TEXT_EXTRACT_CHAR_BUDGET = 30_000;

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken")
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function PdfReader({
  bookData,
  bookName,
  bookId,
  bookDescription,
  onBack,
  samplePageCap,
}: PdfReaderProps) {
  const bookTerm = useContentTerm("book");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const saveProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentProxyRef = useRef<{ numPages: number; getPage: (_n: number) => Promise<unknown> } | null>(
    null
  );

  // react-pdf's <Document file=...> is happiest with a stable identity. We
  // wrap the incoming ArrayBuffer in a memo so a re-render doesn't re-parse.
  const fileSource = useMemo(() => ({ data: new Uint8Array(bookData) }), [bookData]);

  const [theme, setTheme] = useState<ThemeKey>("sepia");
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectionPopup, setSelectionPopup] = useState<SelectionPopupState | null>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [showExplain, setShowExplain] = useState(false);
  const [explainText, setExplainText] = useState<string>("");
  const [explainSubject, setExplainSubject] = useState<string>("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  // Effective page count once sample mode is applied.
  const effectivePageCap = useMemo(() => {
    if (!samplePageCap || samplePageCap <= 0) return numPages;
    return Math.min(numPages, samplePageCap);
  }, [numPages, samplePageCap]);
  const samplingActive = samplePageCap != null && samplePageCap > 0 && numPages > samplePageCap;

  // Load theme preference shared with the EPUB reader so a user's choice
  // carries across both formats. localStorage is read once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("epub-theme") as ThemeKey | null;
    if (saved === "light" || saved === "sepia" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  // Persist theme on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("epub-theme", theme);
  }, [theme]);

  // Restore last-read page (server progress wins, localStorage fallback).
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const token = getAuthToken();
      let serverPage: number | null = null;
      if (token) {
        try {
          const data = await bookReadingApi.getReadingData(bookId);
          const loc = data?.progress?.location;
          if (loc) {
            const parsed = parseInt(loc, 10);
            if (Number.isFinite(parsed) && parsed > 0) serverPage = parsed;
          }
        } catch {
          // Fall through to localStorage.
        }
      }
      if (cancelled) return;
      const localKey = `pdf-page-${bookId}`;
      const localRaw = typeof window !== "undefined" ? window.localStorage.getItem(localKey) : null;
      const localPage = localRaw ? parseInt(localRaw, 10) : NaN;
      const target = serverPage ?? (Number.isFinite(localPage) && localPage > 0 ? localPage : 1);
      // Defer the jump until the document layout settles, otherwise the scroll
      // offsets resolve against 0-height placeholders and we end up at the top.
      requestAnimationFrame(() => {
        scrollToPage(target);
      });
    };
    restore();
    return () => {
      cancelled = true;
    };
    // We deliberately depend only on bookId; numPages changes shouldn't re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const scrollToPage = useCallback((page: number) => {
    const ref = pageRefs.current.get(page);
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Save progress with a debounce, mirroring the EPUB reader.
  const scheduleSaveProgress = useCallback(
    (page: number) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`pdf-page-${bookId}`, String(page));
      }
      const token = getAuthToken();
      if (!token) return;
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
      saveProgressTimeoutRef.current = setTimeout(() => {
        bookReadingApi.saveProgress(bookId, String(page)).catch(() => {
          // Best-effort; progress is also cached locally above.
        });
      }, PROGRESS_SAVE_DEBOUNCE_MS);
    },
    [bookId]
  );

  // Update current page based on which page is closest to the top of the viewport.
  const handleScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || pageRefs.current.size === 0) return;
    const scrollTop = scroller.scrollTop;
    let best = currentPage;
    let bestDist = Number.POSITIVE_INFINITY;
    pageRefs.current.forEach((el, page) => {
      const dist = Math.abs(el.offsetTop - scrollTop - 80);
      if (dist < bestDist) {
        bestDist = dist;
        best = page;
      }
    });
    if (best !== currentPage) {
      setCurrentPage(best);
      setPageInput(String(best));
      scheduleSaveProgress(best);
    }
  }, [currentPage, scheduleSaveProgress]);

  useEffect(() => {
    return () => {
      if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
    };
  }, []);

  const handleDocumentLoad = useCallback((doc: unknown) => {
    const d = doc as { numPages: number; getPage: (n: number) => Promise<unknown> };
    documentProxyRef.current = d;
    setNumPages(d.numPages);
  }, []);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };
  const commitPageInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) {
      const target = clamp(parsed, 1, effectivePageCap);
      scrollToPage(target);
      setPageInput(String(target));
    } else {
      setPageInput(String(currentPage));
    }
  };

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  // Selection handling. Watch for selectionchange and surface an "Explain" popup
  // when the user highlights text inside a page. Coordinates relative to the
  // scroll container so the popup follows the selection cleanly.
  useEffect(() => {
    const handleSelection = () => {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.rangeCount === 0 || text.length < 3) {
        setSelectionPopup((prev) => (prev ? null : prev));
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const scroller = scrollRef.current;
      if (!scroller) return;
      const containerRect = scroller.getBoundingClientRect();
      // Only fire when the selection is within the PDF scroll container.
      if (rect.top < containerRect.top || rect.bottom > containerRect.bottom + 200) {
        return;
      }
      // Clamp the popup x within the scroll container so it doesn't spill off
      // the left/right edges on phones. ~110px is half the popup's typical
      // width plus a small margin; cheap heuristic, no measurement needed.
      const rawX = rect.left - containerRect.left + rect.width / 2;
      const clampedX = Math.max(110, Math.min(containerRect.width - 110, rawX));
      setSelectionPopup({
        text,
        x: clampedX,
        y: rect.top - containerRect.top + scroller.scrollTop - 8,
      });
    };
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  const runExplain = useCallback(async () => {
    if (!selectionPopup || explainLoading) return;
    const text = selectionPopup.text;
    setExplainSubject(text);
    setSelectionPopup(null);
    setShowExplain(true);
    setExplainLoading(true);
    setExplainError(null);
    setExplainText("");
    try {
      const out = await explainSelectedText(text, bookName);
      setExplainText(out);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Failed to fetch explanation");
    } finally {
      setExplainLoading(false);
    }
  }, [selectionPopup, explainLoading, bookName]);

  // Pull text from the first few pages for AI summary. Cheaper than parsing
  // the whole book and matches the EPUB reader's first-30KB heuristic.
  const extractDocumentText = useCallback(async (): Promise<string> => {
    const doc = documentProxyRef.current;
    if (!doc) return "";
    const limit = Math.min(doc.numPages, TEXT_EXTRACT_PAGE_BUDGET);
    let collected = "";
    for (let i = 1; i <= limit; i += 1) {
      try {
        const page = (await doc.getPage(i)) as {
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
        };
        const content = await page.getTextContent();
        const text = content.items.map((it) => it.str ?? "").join(" ");
        collected += text + "\n\n";
        if (collected.length >= TEXT_EXTRACT_CHAR_BUDGET) break;
      } catch {
        // Skip pages that fail to parse.
      }
    }
    return collected.slice(0, TEXT_EXTRACT_CHAR_BUDGET);
  }, []);

  const runSummary = useCallback(async () => {
    if (summaryLoading) return;
    setShowSummary(true);
    if (summaryText) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      let content = await extractDocumentText();
      if (!content.trim()) {
        content = bookDescription || `This book is titled "${bookName}". Provide a summary based on the title.`;
      }
      const out = await generateBookSummary(bookName, content);
      setSummaryText(out);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [summaryLoading, summaryText, extractDocumentText, bookName, bookDescription]);

  // Render. Constrain page width to the scroll container so long mobile views
  // don't blow out horizontally; users zoom via toolbar controls instead.
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = useMemo(() => {
    const w = containerWidth || 800;
    // 24px gutter on each side for spacing.
    return Math.max(280, Math.min(1100, w - 48)) * scale;
  }, [containerWidth, scale]);

  if (loadError) {
    return (
      <div className="pdf-reader-root pdf-theme-light">
        <div style={{ margin: "auto", textAlign: "center" }}>
          <p>{loadError}</p>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, background: "#f59e0b", color: "white" }}
            >
              Go Back
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`pdf-reader-root pdf-theme-${theme}`}>
      <div className="pdf-reader-toolbar">
        {onBack ? (
          <button type="button" aria-label="Back" onClick={onBack}>
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <span
          className="pdf-reader-title"
          style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {bookName}
        </span>
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input
            className="pdf-reader-page-input"
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label="Go to page"
          />
          <span className="pdf-reader-page-total">/ {effectivePageCap || "-"}</span>
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => scrollToPage(Math.min(effectivePageCap, currentPage + 1))}
          disabled={currentPage >= effectivePageCap}
        >
          <ChevronRight size={16} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => setScale((s) => clamp(s - 0.15, 0.5, 2.5))}>
          <Minus size={16} />
        </button>
        <button type="button" aria-label="Reset zoom" onClick={() => setScale(1)} style={{ fontSize: 13 }}>
          {Math.round(scale * 100)}%
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => setScale((s) => clamp(s + 0.15, 0.5, 2.5))}>
          <Plus size={16} />
        </button>
        <button type="button" aria-label="Toggle theme" onClick={cycleTheme}>
          <SunMoon size={16} />
        </button>
        {BOOK_AI_ENABLED ? (
          <button type="button" aria-label="AI summary" onClick={runSummary}>
            <Sparkles size={16} />
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="pdf-reader-scroll" onScroll={handleScroll}>
        <Document
          file={fileSource}
          onLoadSuccess={handleDocumentLoad}
          onLoadError={(err) => setLoadError(err?.message || "Failed to load PDF")}
          loading={
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 className="animate-spin" />
            </div>
          }
          error={<p style={{ textAlign: "center", padding: 24 }}>Could not display this PDF.</p>}
        >
          {Array.from({ length: effectivePageCap }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              ref={(el) => {
                if (el) pageRefs.current.set(page, el);
                else pageRefs.current.delete(page);
              }}
            >
              <Page pageNumber={page} width={pageWidth} renderTextLayer renderAnnotationLayer={false} />
            </div>
          ))}
        </Document>

        {samplingActive ? (
          <div className="pdf-reader-sample-cta">
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Preview limited to {effectivePageCap} pages</p>
            <p style={{ fontSize: 14, opacity: 0.8 }}>Buy this {bookTerm.singular.toLowerCase()} to keep reading the full {numPages}-page edition.</p>
          </div>
        ) : null}

        {selectionPopup && BOOK_AI_ENABLED ? (
          <div
            className="pdf-selection-popup"
            style={{ left: selectionPopup.x, top: selectionPopup.y, transform: "translateX(-50%)" }}
          >
            <button type="button" onClick={runExplain}>
              Explain
            </button>
          </div>
        ) : null}
      </div>

      {showSummary ? (
        <ReaderModal title="AI summary" onClose={() => setShowSummary(false)}>
          {summaryLoading ? <Loader2 className="animate-spin" /> : null}
          {summaryError ? <p style={{ color: "#b91c1c" }}>{summaryError}</p> : null}
          {summaryText ? <div style={{ whiteSpace: "pre-wrap" }}>{summaryText}</div> : null}
        </ReaderModal>
      ) : null}

      {showExplain ? (
        <ReaderModal title={`Explain: "${explainSubject.slice(0, 80)}${explainSubject.length > 80 ? "…" : ""}"`} onClose={() => setShowExplain(false)}>
          {explainLoading ? <Loader2 className="animate-spin" /> : null}
          {explainError ? <p style={{ color: "#b91c1c" }}>{explainError}</p> : null}
          {explainText ? <div style={{ whiteSpace: "pre-wrap" }}>{explainText}</div> : null}
        </ReaderModal>
      ) : null}
    </div>
  );
}

// Lightweight modal so we don't pull in @open-mtlms/core's Dialog for one screen.
// Matches the visual weight of the EPUB reader's modals without introducing a
// new dependency on Radix in this leaf component.
function ReaderModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 10,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 20,
          color: "#111",
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
        {children}
        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 14, padding: "6px 14px", borderRadius: 6, background: "#111", color: "white" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
