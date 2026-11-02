"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Loader2, ShoppingCart, BookOpen } from "lucide-react";

interface SampleReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookSlug: string;
  bookTitle: string;
  onPurchase?: () => void;
  /**
   * Book format. The sample endpoint returns whatever the book is, and epubjs
   * cannot read a PDF, handed one it hangs on `book.ready` forever rather
   * than rejecting, which is what left every PDF book spinning on
   * "Loading sample...". Defaults to EPUB for callers that do not pass it;
   * the response's own Content-Type is trusted over this when it disagrees.
   */
  fileFormat?: "EPUB" | "PDF";
  /**
   * How many pages/screens the sample runs to. Applied to BOTH formats so a
   * PDF preview stops in the same place an EPUB one does. Defaults to 10.
   */
  samplePages?: number;
}

export function SampleReaderModal({
  isOpen,
  onClose,
  bookSlug,
  bookTitle,
  onPurchase,
  fileFormat = "EPUB",
  samplePages = 10,
}: SampleReaderModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setCurrentLocation] = useState<string>("");
  const [isEndOfSample, setIsEndOfSample] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  // PDF branch. `pdfData` holding bytes is what switches the render below.
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const tocRef = useRef<any[]>([]);
  const pageCountRef = useRef(1);
  // How long a PDF sample runs. The server still sends the whole file, so the
  // cap has to be applied here, same `samplePages` limit the EPUB path uses,
  // so both formats stop at the same point instead of a PDF exposing the
  // entire book. Never longer than the document itself.
  const pdfSampleLimit = pdfPageCount > 0 ? Math.min(samplePages, pdfPageCount) : samplePages;
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  /** Paint one PDF page onto the canvas, fitted to the modal width. */
  const renderPdfPage = useCallback(async (doc: any, pageNumber: number) => {
    const page = await doc.getPage(pageNumber);
    const canvas = pdfCanvasRef.current;
    if (!canvas) return;
    const base = page.getViewport({ scale: 1 });
    // Fit the modal's content width, and account for retina so text stays sharp.
    const scale = Math.min(900 / base.width, 1.8);
    const viewport = page.getViewport({ scale });
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await page.render({ canvasContext: ctx, viewport }).promise;
  }, []);

  // Load epubjs dynamically
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadSample = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setCurrentLocation("");
        setIsEndOfSample(false);
        setCurrentChapter("");
        setCurrentPage(1);
        setPdfData(null);
        setPdfPageCount(0);
        pageCountRef.current = 1;

        // Wait for container to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!containerRef.current || cancelled) return;

        // Fetch sample content
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
          ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
          : `http://localhost:${process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096"}/api/v1`;

        const response = await fetch(`${baseUrl}/books/${encodeURIComponent(bookSlug)}/sample`, {
          headers: {
            "X-Tenant-Host": typeof window !== "undefined" ? window.location.host : "",
          },
        });

        if (!response.ok) {
          // 404 is the ordinary "this book offers no preview" answer, not a fault.
          throw new Error(
            response.status === 404
              ? "No preview is available for this book"
              : "Failed to load book sample"
          );
        }

        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        // Decide the renderer from the bytes themselves. A PDF always starts
        // "%PDF-"; an EPUB is a zip and starts "PK". The sniff outranks both the
        // prop and the header because it is the one thing that cannot be stale.
        const magic = new Uint8Array(arrayBuffer.slice(0, 5));
        const looksPdf = String.fromCharCode(...magic.slice(0, 5)) === "%PDF-";
        const looksZip = magic[0] === 0x50 && magic[1] === 0x4b;
        const contentType = response.headers.get("content-type") || "";
        const isPdf = looksPdf
          ? true
          : looksZip
            ? false
            : contentType.includes("pdf") || fileFormat === "PDF";

        if (isPdf) {
          // pdf.js is imported HERE, inside the effect, not at module scope.
          // This module is bundled with "use client" but Next still evaluates it
          // on the server to render the initial HTML; a module-scope React.lazy
          // runs before the server dispatcher exists and crashes the whole page
          // with "Cannot read properties of undefined". An import inside an
          // effect only ever runs in the browser.
          const pdfjs = await import("pdfjs-dist");
          // Self-hosted worker served from the host app's public folder.
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

          const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          if (cancelled) return;

          pdfDocRef.current = doc;
          setPdfPageCount(doc.numPages);
          setPdfData(arrayBuffer);
          await renderPdfPage(doc, 1);
          if (cancelled) return;
          setIsLoading(false);
          return;
        }

        // Dynamically import epubjs, only on the path that can use it.
        const ePub = (await import("epubjs")).default;

        // Create book instance
        const book = ePub(arrayBuffer);
        bookRef.current = book;

        // `book.ready` never settles for a file epubjs cannot parse, which is
        // how a broken sample turned into an endless spinner. Bound it.
        await Promise.race([
          book.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("This preview could not be opened")), 15000)
          ),
        ]);

        if (cancelled) return;

        // Get table of contents for chapter names
        const toc = await book.loaded.navigation;
        tocRef.current = toc.toc || [];
        
        // Reset page counter
        pageCountRef.current = 1;

        // Clear container before rendering
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        // Create rendition
        const rendition = book.renderTo(containerRef.current!, {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: "paginated",
        });

        renditionRef.current = rendition;

        // Apply reading styles
        rendition.themes.default({
          body: {
            "font-family": "Georgia, serif",
            "line-height": "1.8",
            "padding": "20px 40px",
          },
          p: {
            "margin-bottom": "1em",
          }
        });

        // Track location changes
        rendition.on("relocated", (location: any) => {
          if (cancelled) return;
          
          const currentCfi = location.start?.cfi;
          if (currentCfi) {
            setCurrentLocation(currentCfi);
            setCurrentPage(pageCountRef.current);
            
            // Update current chapter name
            const chapter = tocRef.current.find(item => {
              if (!item.href) return false;
              const itemHref = item.href.split("#")[0];
              const locHref = location.start?.href?.split("#")[0];
              return itemHref === locHref;
            });
            if (chapter) {
              setCurrentChapter(chapter.label || "");
            }
          }
          
          // Check if at end of book
          if (location.atEnd) {
            setIsEndOfSample(true);
          }
        });

        // Display the first page
        await rendition.display();
        
        if (cancelled) return;
        
        setIsLoading(false);

      } catch (err) {
        console.error("Sample load error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sample");
          setIsLoading(false);
        }
      }
    };

    loadSample();

    return () => {
      cancelled = true;
      if (renditionRef.current) {
        try {
          renditionRef.current.destroy();
        } catch (e) {
          // ignore
        }
        renditionRef.current = null;
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch (e) {
          // ignore
        }
        pdfDocRef.current = null;
      }
      if (bookRef.current) {
        try {
          bookRef.current.destroy();
        } catch (e) {
          // ignore
        }
        bookRef.current = null;
      }
    };
  }, [isOpen, bookSlug, fileFormat]);

  const nextPage = useCallback(async () => {
    if (pdfData) {
      if (currentPage >= pdfSampleLimit) {
        setIsEndOfSample(true);
        return;
      }
      const next = currentPage + 1;
      setCurrentPage(next);
      if (pdfDocRef.current) await renderPdfPage(pdfDocRef.current, next);
      return;
    }

    if (!renditionRef.current || isEndOfSample) return;
    
    try {
      // Check if next page would exceed sample limit
      if (pageCountRef.current >= samplePages) {
        setIsEndOfSample(true);
        return;
      }
      
      await renditionRef.current.next();
      
      // Increment page counter
      pageCountRef.current += 1;
      setCurrentPage(pageCountRef.current);
      
      // Check if we've reached the limit after navigation
      if (pageCountRef.current >= samplePages) {
        setIsEndOfSample(true);
      }
    } catch (err) {
      console.error("Next page error:", err);
    }
  }, [isEndOfSample, samplePages, pdfData, pdfSampleLimit, currentPage, renderPdfPage]);

  const prevPage = useCallback(async () => {
    if (pdfData) {
      setIsEndOfSample(false);
      const prev = Math.max(1, currentPage - 1);
      setCurrentPage(prev);
      if (pdfDocRef.current) await renderPdfPage(pdfDocRef.current, prev);
      return;
    }

    if (!renditionRef.current) return;
    
    try {
      await renditionRef.current.prev();
      
      // Decrement page counter (minimum 1)
      if (pageCountRef.current > 1) {
        pageCountRef.current -= 1;
        setCurrentPage(pageCountRef.current);
      }
      
      setIsEndOfSample(false);
    } catch (err) {
      console.error("Prev page error:", err);
    }
  }, [pdfData, currentPage, renderPdfPage]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextPage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevPage();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, nextPage, prevPage, onClose]);

  // Close and cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(true);
      setError(null);
      setCurrentLocation("");
      setIsEndOfSample(false);
      setCurrentChapter("");
      setCurrentPage(1);
      setPdfData(null);
      setPdfPageCount(0);
      pageCountRef.current = 1;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-4xl h-[90vh] mx-4 rounded-xl overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BookOpen className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <div className="min-w-0">
              <h2 className="font-semibold text-sm line-clamp-1" style={{ color: "hsl(var(--foreground))" }}>
                {bookTitle}
              </h2>
              <p className="text-xs line-clamp-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                {currentChapter || "Sample Preview"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-black/10 shrink-0 ml-2"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: "hsl(var(--muted))" }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--primary))" }} />
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading sample...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: "hsl(var(--muted))" }}>
              <div className="text-center">
                <p className="text-sm mb-4" style={{ color: "hsl(var(--destructive))" }}>{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* PDF sample. Rendered instead of the epub container when the
              sample came back as a PDF. */}
          {pdfData && (
            <div className="w-full h-full overflow-auto flex items-start justify-center py-4">
              <canvas ref={pdfCanvasRef} className="max-w-full shadow-lg" />
            </div>
          )}

          {/* EPUB Renderer Container */}
          <div 
            ref={containerRef} 
            className={pdfData ? "hidden" : "w-full h-full"}
            style={{ backgroundColor: "#f9f6ef" }}
          />

          {/* End of Sample Overlay - Purchase CTA */}
          {isEndOfSample && !isLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
            >
              <div className="text-center px-6 py-8 max-w-md">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "hsl(var(--primary))" }}
                >
                  <BookOpen className="h-8 w-8" style={{ color: "hsl(var(--primary-foreground))" }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  End of Sample
                </h3>
                <p className="text-gray-300 mb-6">
                  You've reached the end of the free preview. Purchase the full book to continue reading all chapters.
                </p>
                {onPurchase && (
                  <button
                    onClick={onPurchase}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-transform hover:scale-105"
                    style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Purchase Full Book
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="block mx-auto mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          )}

          {/* Navigation Arrows */}
          {!isLoading && !error && !isEndOfSample && (
            <>
              <button
                onClick={prevPage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all hover:scale-110 z-10"
                style={{ 
                  backgroundColor: "hsl(var(--card))", 
                  color: "hsl(var(--foreground))",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextPage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all hover:scale-110 z-10"
                style={{ 
                  backgroundColor: "hsl(var(--card))", 
                  color: "hsl(var(--foreground))",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-t shrink-0"
          style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
        >
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {pdfPageCount > 0
              ? `Sample Preview: Page ${currentPage} of ${pdfSampleLimit}`
              : currentChapter
                ? `Sample Preview, ${currentChapter}`
                : "Sample Preview"}
          </p>
          <div className="flex items-center gap-2">
            {onPurchase && !isEndOfSample && (
              <button
                onClick={onPurchase}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                <ShoppingCart className="h-4 w-4" />
                Buy Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
