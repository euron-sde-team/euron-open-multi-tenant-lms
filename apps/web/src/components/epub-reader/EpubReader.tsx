"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ReactReader, type IReactReaderStyle } from "react-reader";
import { useRouter } from "next/navigation";
import type { Rendition, NavItem, Contents, Book } from "epubjs";
import { BOOK_AI_ENABLED, generateBookSummary, explainSelectedText } from "@/lib/book-ai";
import { type BookPageBookmark, bookReadingApi } from "@/lib/api/book-reading";
import { useContentTerm } from "@/lib/hooks/use-content-terms";


// Simple markdown to HTML converter for AI responses
function parseMarkdown(text: string): string {
  return (
    text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-5 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
      // Bullet points
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, "<br />")
  );
}

// Highlight colors
const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#FFEB3B", fill: "rgba(255, 235, 59, 0.4)" },
  { name: "Green", value: "#4CAF50", fill: "rgba(76, 175, 80, 0.4)" },
  { name: "Blue", value: "#2196F3", fill: "rgba(33, 150, 243, 0.4)" },
  { name: "Pink", value: "#E91E63", fill: "rgba(233, 30, 99, 0.4)" },
  { name: "Orange", value: "#FF9800", fill: "rgba(255, 152, 0, 0.4)" },
];

// Highlight interface (matches API response)
interface Highlight {
  id: string;
  cfiRange: string;
  text: string;
  color: string;
  createdAt: string | number;
}

// Selection popup position
interface SelectionPosition {
  x: number;
  y: number;
}

// Theme definitions
type ThemeKey = "light" | "sepia" | "dark";

interface ThemeConfig {
  body: {
    background: string;
    color: string;
  };
  readerArea: string;
  container: string;
  tocArea: string;
  tocButton: string;
  tocButtonBar: string;
}

const themes: Record<ThemeKey, ThemeConfig> = {
  light: {
    body: {
      background: "#ffffff",
      color: "#1a1a1a",
    },
    readerArea: "#ffffff",
    container: "#ffffff",
    tocArea: "#f8f8f8",
    tocButton: "#1a1a1a",
    tocButtonBar: "#1a1a1a",
  },
  sepia: {
    body: {
      background: "#f4ecd8",
      color: "#5b4636",
    },
    readerArea: "#f4ecd8",
    container: "#f4ecd8",
    tocArea: "#e8dcc8",
    tocButton: "#5b4636",
    tocButtonBar: "#5b4636",
  },
  dark: {
    body: {
      background: "#0a0a0a",
      color: "#e0e0e0",
    },
    readerArea: "#0a0a0a",
    container: "#0a0a0a",
    tocArea: "#1a1a1a",
    tocButton: "#e0e0e0",
    tocButtonBar: "#e0e0e0",
  },
};

// Reader styles function
const getReaderStyles = (theme: ThemeConfig): IReactReaderStyle => ({
  toc: {},
  errorView: {
    position: "absolute",
    top: "50%",
    left: "10%",
    right: "10%",
    textAlign: "center",
    marginTop: "-1em",
    color: theme.tocButton,
  },
  container: {
    overflow: "hidden",
    height: "100%",
    background: theme.container,
  },
  readerArea: {
    position: "relative",
    zIndex: 1,
    height: "100%",
    width: "100%",
    backgroundColor: theme.readerArea,
    transition: "all 0.3s ease",
  },
  containerExpanded: {
    transform: "translateX(256px)",
  },
  titleArea: {
    position: "absolute",
    top: 20,
    left: 50,
    right: 50,
    textAlign: "center",
    color: theme.tocButton,
    display: "none",
  },
  reader: {
    position: "absolute",
    top: 50,
    left: 0,
    bottom: 30,
    right: 0,
  },
  swipeWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 200,
  },
  prev: {
    display: "none",
  },
  next: {
    display: "none",
  },
  arrow: {
    display: "none",
  },
  arrowHover: {
    display: "none",
  },
  tocBackground: {
    position: "absolute",
    left: 256,
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 1,
    background: "rgba(0,0,0,0.3)",
  },
  tocArea: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
    width: 256,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    background: theme.tocArea,
    padding: "10px 0",
  },
  tocAreaButton: {
    userSelect: "none",
    appearance: "none",
    background: "none",
    border: "none",
    display: "block",
    fontFamily: "sans-serif",
    width: "100%",
    fontSize: 14,
    textAlign: "left",
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.tocButton}22`,
    color: theme.tocButton,
    cursor: "pointer",
  },
  tocButton: {
    background: "none",
    border: "none",
    width: 32,
    height: 32,
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 2,
    outline: "none",
    cursor: "pointer",
    opacity: 0,
    pointerEvents: "none",
  },
  tocButtonExpanded: {
    background: theme.tocArea,
  },
  tocButtonBar: {
    position: "absolute",
    width: "60%",
    background: theme.tocButtonBar,
    height: 2,
    left: "50%",
    margin: "-1px -30%",
    top: "50%",
    transition: "all 0.5s ease",
  },
  tocButtonBarTop: {
    top: "35%",
  },
  tocButtonBottom: {
    top: "66%",
  },
  loadingView: {
    position: "absolute",
    top: "50%",
    left: "10%",
    right: "10%",
    color: theme.tocButton,
    textAlign: "center",
    marginTop: "-1em",
  },
});

// Font size options
const fontSizes = [70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 175, 200];

interface EpubReaderProps {
  bookData: ArrayBuffer;
  bookName: string;
  bookId: string;
  /** Pre-generated description from admin panel, used as summary if available */
  bookDescription?: string;
  onBack?: () => void;
}

export function EpubReader({ bookData, bookName, bookId, bookDescription, onBack }: EpubReaderProps) {
  const router = useRouter();
  const bookTerm = useContentTerm("book");
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const tocRef = useRef<NavItem[]>([]);
  const readerContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const [location, setLocation] = useState<string | number | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>("sepia");
  const [fontSize, setFontSize] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [_currentPage, setCurrentPage] = useState(1);
  const [_totalPages, setTotalPages] = useState(1);
  const [currentChapter, setCurrentChapter] = useState<string>("");
  const [overallProgress, setOverallProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [_transitionDirection, setTransitionDirection] = useState<"left" | "right" | null>(null);
  const [showHeader, setShowHeader] = useState(true);

  // Summary modal state
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string>("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string>("");

  // Text selection and highlight state
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectedCfiRange, setSelectedCfiRange] = useState<string>("");
  const [selectionPosition, setSelectionPosition] = useState<SelectionPosition | null>(null);
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Explain modal state
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explainContent, setExplainContent] = useState<string>("");
  const [isExplainLoading, setIsExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string>("");
  const [textToExplain, setTextToExplain] = useState<string>("");

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<BookPageBookmark[]>([]);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);

  // API/Auth state
  const [_isAuthenticated, setIsAuthenticated] = useState(false);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check authentication status
  useEffect(() => {
    if (!isClient) return;
    const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
    setIsAuthenticated(!!token);
  }, [isClient]);

  // Load reading data from API (or localStorage fallback)
  useEffect(() => {
    if (!isClient || !bookId) return;

    // Load theme and font size from localStorage (user preferences)
    const savedTheme = localStorage.getItem("epub-theme") as ThemeKey | null;
    const savedFontSize = localStorage.getItem("epub-font-size");

    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize, 10));
    }

    // Load reading data from API if authenticated
    const loadReadingData = async () => {
      const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
      
      if (!token) {
        // Not authenticated - use localStorage fallback
        const locationKey = `epub-location-${bookId}`;
        const savedLocation = localStorage.getItem(locationKey);
        if (savedLocation) {
          setLocation(savedLocation);
        }

        const highlightsKey = `epub-highlights-${bookId}`;
        const savedHighlights = localStorage.getItem(highlightsKey);
        if (savedHighlights) {
          try {
            const parsed = JSON.parse(savedHighlights) as Highlight[];
            setHighlights(parsed);
          } catch {
            console.error("Failed to parse saved highlights");
          }
        }

        setIsReady(true);
        return;
      }

      try {
        const data = await bookReadingApi.getReadingData(bookId);

        // Set reading progress
        if (data.progress?.location) {
          setLocation(data.progress.location);
        }

        // Set highlights
        if (data.highlights.length > 0) {
          setHighlights(data.highlights);
        }

        // Set bookmarks
        if (data.bookmarks.length > 0) {
          setBookmarks(data.bookmarks);
        }
      } catch (error) {
        console.error("Failed to load reading data from API:", error);
        // Fallback to localStorage
        const locationKey = `epub-location-${bookId}`;
        const savedLocation = localStorage.getItem(locationKey);
        if (savedLocation) {
          setLocation(savedLocation);
        }
      } finally {
        setIsReady(true);
      }
    };

    loadReadingData();
  }, [isClient, bookId]);

  // Apply theme and font size to rendition, then re-apply highlights
  useEffect(() => {
    if (renditionRef.current) {
      const theme = themes[currentTheme];
      renditionRef.current.themes.override("color", theme.body.color);
      renditionRef.current.themes.override("background", theme.body.background);
      renditionRef.current.themes.override("font-size", `${fontSize}%`);

      // Re-apply highlights after style changes with a delay to let the rendition update
      const timeoutId = setTimeout(() => {
        if (renditionRef.current && highlights.length > 0) {
          // Remove all existing highlight annotations first
          highlights.forEach((highlight) => {
            try {
              renditionRef.current?.annotations.remove(highlight.cfiRange, "highlight");
            } catch {
              // Ignore if highlight doesn't exist
            }
          });

          // Re-add all highlights
          highlights.forEach((highlight) => {
            const color =
              HIGHLIGHT_COLORS.find((c) => c.value === highlight.color) || HIGHLIGHT_COLORS[0];
            try {
              renditionRef.current?.annotations.add(
                "highlight",
                highlight.cfiRange,
                { id: highlight.id },
                undefined,
                "epub-highlight",
                { fill: color.fill, "fill-opacity": "0.4", "mix-blend-mode": "multiply" }
              );
            } catch {
              // Ignore if CFI is invalid for current view
            }
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [currentTheme, fontSize, highlights]);

  // Location change handler with debounced API save
  const locationChanged = useCallback(
    (epubcfi: string) => {
      if (epubcfi) {
        setLocation(epubcfi);

        // Save to localStorage as fallback
        if (isClient && bookId) {
          const locationKey = `epub-location-${bookId}`;
          localStorage.setItem(locationKey, epubcfi);
        }

        // Debounce API save to avoid too many requests
        // Check auth token directly instead of relying on state
        const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
        if (token && bookId) {
          if (saveProgressTimeoutRef.current) {
            clearTimeout(saveProgressTimeoutRef.current);
          }
          saveProgressTimeoutRef.current = setTimeout(() => {
            bookReadingApi.saveProgress(bookId, epubcfi).catch((err: unknown) => {
              console.error("Failed to save progress:", err);
            });
          }, 2000); // Save after 2 seconds of no page changes
        }
      }

      // Update page info with better location tracking
      if (renditionRef.current && bookRef.current) {
        const currentLocation = renditionRef.current.location;
        if (currentLocation && currentLocation.start) {
          // Get the overall progress percentage from the location
          const startCfi = currentLocation.start.cfi;
          const locations = bookRef.current.locations;
          
          if (locations && locations.length() > 0) {
            // Use epubjs locations for accurate progress
            const locationIndex = locations.locationFromCfi(startCfi);
            const totalLocations = locations.length();
            
            if (typeof locationIndex === 'number' && locationIndex >= 0) {
              setCurrentPage(locationIndex + 1);
              setTotalPages(totalLocations);
              setOverallProgress(Math.round((locationIndex / totalLocations) * 100));
            }
          } else {
            // Fallback to percentage-based calculation
            const percentage = currentLocation.start.percentage;
            if (typeof percentage === 'number') {
              setOverallProgress(Math.round(percentage * 100));
              // Estimate pages based on percentage
              const estimatedTotal = 100;
              setCurrentPage(Math.max(1, Math.round(percentage * estimatedTotal)));
              setTotalPages(estimatedTotal);
            }
          }
          
          // Try to get chapter name from TOC
          if (tocRef.current.length > 0) {
            const href = currentLocation.start.href;
            let foundChapter: string | null = null;
            
            // First try exact match
            if (href) {
              const chapter = tocRef.current.find(item => 
                href.includes(item.href.split('#')[0]) || 
                item.href.split('#')[0].includes(href.split('#')[0])
              );
              if (chapter) {
                foundChapter = chapter.label.trim();
              }
            }
            
            // If no match, try to find based on index/spine position
            if (!foundChapter && currentLocation.start.index !== undefined) {
              const spineIndex = currentLocation.start.index;
              // Use spine index to find corresponding TOC entry
              if (spineIndex < tocRef.current.length) {
                foundChapter = tocRef.current[spineIndex]?.label?.trim() || null;
              }
            }
            
            if (foundChapter) {
              setCurrentChapter(foundChapter);
            }
          }
        }
      }
    },
    [isClient, bookId]
  );

  // Theme change handler
  const handleThemeChange = (theme: ThemeKey) => {
    setCurrentTheme(theme);
    localStorage.setItem("epub-theme", theme);
  };

  // Font size handlers
  const increaseFontSize = () => {
    const currentIndex = fontSizes.indexOf(fontSize);
    if (currentIndex < fontSizes.length - 1) {
      const newSize = fontSizes[currentIndex + 1];
      setFontSize(newSize);
      localStorage.setItem("epub-font-size", newSize.toString());
    }
  };

  const decreaseFontSize = () => {
    const currentIndex = fontSizes.indexOf(fontSize);
    if (currentIndex > 0) {
      const newSize = fontSizes[currentIndex - 1];
      setFontSize(newSize);
      localStorage.setItem("epub-font-size", newSize.toString());
    }
  };

  // Generate book summary, use admin description if available, otherwise AI
  const handleGenerateSummary = useCallback(async () => {
    if (isSummaryLoading) return;

    setShowSummaryModal(true);
    setSummaryError("");

    // If admin already set a description, use it directly, no AI needed
    if (bookDescription?.trim()) {
      setSummaryContent(bookDescription.trim());
      return;
    }

    setIsSummaryLoading(true);
    setSummaryContent("");

    try {
      // Extract text content from the book using spine
      let bookContent = "";
      if (bookRef.current) {
        const spine = bookRef.current.spine as {
          each: (
            callback: (item: { load: (_loader: unknown) => Promise<Document> }) => void
          ) => void;
        };
        const items: Array<{ load: (_loader: unknown) => Promise<Document> }> = [];
        spine.each((item) => items.push(item));

        // Get text from first few chapters for summary
        const spineItems = items.slice(0, 5);
        for (const item of spineItems) {
          try {
            const doc = await item.load(bookRef.current.load.bind(bookRef.current));
            if (doc && doc.body) {
              bookContent += doc.body.textContent + "\n\n";
            }
          } catch {
            // Skip items that fail to load
          }
        }
      }

      if (!bookContent.trim()) {
        bookContent = `This is a book titled "${bookName}". Provide a summary based on the title.`;
      }

      const summary = await generateBookSummary(bookName, bookContent);
      setSummaryContent(summary);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Failed to generate summary");
    } finally {
      setIsSummaryLoading(false);
    }
  }, [bookName, bookDescription, isSummaryLoading]);

  // Handle text selection for highlighting and explanation
  const handleTextSelection = useCallback((cfiRange: string, contents: Contents) => {
    if (!renditionRef.current) return;

    const range = renditionRef.current.getRange(cfiRange);
    const text = range.toString().trim();

    if (!text || text.length < 3) {
      setShowSelectionPopup(false);
      return;
    }

    setSelectedText(text);
    setSelectedCfiRange(cfiRange);

    // Get selection position for popup with viewport clamping
    const selection = contents.window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const iframe = document.querySelector("iframe");
      if (iframe) {
        const iframeRect = iframe.getBoundingClientRect();
        const popupWidth = 280; // Approximate popup width
        const viewportWidth = window.innerWidth;

        // Calculate x position and clamp to viewport
        let x = iframeRect.left + rect.left + rect.width / 2;
        const minX = popupWidth / 2 + 10; // Minimum x to keep popup on screen
        const maxX = viewportWidth - popupWidth / 2 - 10; // Maximum x
        x = Math.max(minX, Math.min(maxX, x));

        // Calculate y position
        let y = iframeRect.top + rect.top - 10;
        // If too close to top, show below the selection
        if (y < 80) {
          y = iframeRect.top + rect.bottom + 50;
        }

        setSelectionPosition({ x, y });
      }
    }

    setShowSelectionPopup(true);
    setShowHighlightColors(false);
  }, []);

  // Copy selected text
  const handleCopyText = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      setShowSelectionPopup(false);
      setSelectedText("");
      // Clear selection in epub
      if (renditionRef.current) {
        const contents = renditionRef.current.getContents() as unknown as Contents[];
        if (Array.isArray(contents)) {
          contents.forEach((content: Contents) => {
            const selection = content.window.getSelection();
            selection?.removeAllRanges();
          });
        }
      }
    }
  }, [selectedText]);

  // Add highlight to selected text
  const handleAddHighlight = useCallback(
    async (color: (typeof HIGHLIGHT_COLORS)[0]) => {
      if (!selectedCfiRange || !renditionRef.current || !selectedText) return;

      const tempId = `hl-${Date.now()}`;
      const cfiRangeToSave = selectedCfiRange;
      const textToSave = selectedText;

      // Add visual highlight immediately
      renditionRef.current.annotations.add(
        "highlight",
        cfiRangeToSave,
        { id: tempId },
        undefined,
        "epub-highlight",
        { fill: color.fill, "fill-opacity": "0.4", "mix-blend-mode": "multiply" }
      );

      const newHighlight: Highlight = {
        id: tempId,
        cfiRange: cfiRangeToSave,
        text: textToSave,
        color: color.value,
        createdAt: Date.now(),
      };

      setHighlights((prev) => [...prev, newHighlight]);
      setShowSelectionPopup(false);
      setShowHighlightColors(false);
      setSelectedText("");
      setSelectedCfiRange("");

      // Clear selection
      if (renditionRef.current) {
        const contents = renditionRef.current.getContents() as unknown as Contents[];
        if (Array.isArray(contents)) {
          contents.forEach((content: Contents) => {
            const selection = content.window.getSelection();
            selection?.removeAllRanges();
          });
        }
      }

      // Save to API if authenticated - check token directly
      const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
      if (token && bookId) {
        try {
          const savedHighlight = await bookReadingApi.addHighlight(
            bookId,
            cfiRangeToSave,
            textToSave,
            color.value
          );
          // Update with real ID from API
          setHighlights((prev) =>
            prev.map((h) => (h.id === tempId ? { ...h, id: savedHighlight.id } : h))
          );
        } catch (error) {
          console.error("Failed to save highlight:", error);
        }
      }
    },
    [selectedCfiRange, selectedText, bookId]
  );

  // Remove a highlight (available for future use)
  const _handleRemoveHighlight = useCallback(
    (highlightId: string) => {
      const highlight = highlights.find((h) => h.id === highlightId);
      if (highlight && renditionRef.current) {
        renditionRef.current.annotations.remove(highlight.cfiRange, "highlight");
        setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      }
    },
    [highlights]
  );

  // Explain selected text using AI
  const handleExplainText = useCallback(async () => {
    if (!selectedText || isExplainLoading) return;

    setTextToExplain(selectedText);
    setShowExplainModal(true);
    setShowSelectionPopup(false);
    setIsExplainLoading(true);
    setExplainError("");
    setExplainContent("");

    try {
      const explanation = await explainSelectedText(selectedText, bookName);
      setExplainContent(explanation);
    } catch (error) {
      setExplainError(error instanceof Error ? error.message : "Failed to generate explanation");
    } finally {
      setIsExplainLoading(false);
    }

    // Clear selection
    if (renditionRef.current) {
      const contents = renditionRef.current.getContents() as unknown as Contents[];
      if (Array.isArray(contents)) {
        contents.forEach((content: Contents) => {
          const selection = content.window.getSelection();
          selection?.removeAllRanges();
        });
      }
    }
    setSelectedText("");
    setSelectedCfiRange("");
  }, [selectedText, bookName, isExplainLoading]);

  // Add bookmark for current page
  const handleAddBookmark = useCallback(async () => {
    if (!renditionRef.current || !location || isBookmarkSaving) return;

    const currentCfi = typeof location === "string" ? location : null;
    if (!currentCfi) return;

    // Check if bookmark already exists
    const existingBookmark = bookmarks.find((b) => b.cfiLocation === currentCfi);
    if (existingBookmark) return;

    setIsBookmarkSaving(true);

    // Create bookmark label with chapter info if available
    // Format: "Chapter Name" or "Reading progress: X%"
    const bookmarkLabel = currentChapter 
      ? currentChapter
      : `Reading progress: ${overallProgress}%`;

    const tempBookmark: BookPageBookmark = {
      id: `bm-${Date.now()}`,
      tenantId: "",
      tenantMemberId: "",
      bookId: bookId,
      cfiLocation: currentCfi,
      label: bookmarkLabel,
      createdAt: new Date().toISOString(),
    };

    setBookmarks((prev) => [...prev, tempBookmark]);

    // Check auth token directly instead of relying on state
    const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
    if (token && bookId) {
      try {
        const savedBookmark = await bookReadingApi.addPageBookmark(
          bookId,
          currentCfi,
          bookmarkLabel
        );
        setBookmarks((prev) =>
          prev.map((b) => (b.id === tempBookmark.id ? savedBookmark : b))
        );
      } catch (error) {
        console.error("Failed to save bookmark:", error);
      }
    }

    setIsBookmarkSaving(false);
  }, [location, overallProgress, currentChapter, bookmarks, bookId, isBookmarkSaving]);

  // Remove a bookmark
  const handleRemoveBookmark = useCallback(
    async (bookmarkId: string) => {
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));

      // Check auth token directly instead of relying on state
      const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
      if (token && bookId) {
        try {
          await bookReadingApi.removePageBookmark(bookId, bookmarkId);
        } catch (error) {
          console.error("Failed to remove bookmark:", error);
        }
      }
    },
    [bookId]
  );

  // Navigate to a bookmark
  const handleGoToBookmark = useCallback((cfiLocation: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(cfiLocation);
      setShowBookmarksModal(false);
    }
  }, []);

  // Check if current page is bookmarked
  const isCurrentPageBookmarked = useCallback(() => {
    if (!location || typeof location !== "string") return false;
    return bookmarks.some((b) => b.cfiLocation === location);
  }, [location, bookmarks]);

  // Restore highlights when rendition is ready
  const restoreHighlights = useCallback(
    (rendition: Rendition) => {
      highlights.forEach((highlight) => {
        const color =
          HIGHLIGHT_COLORS.find((c) => c.value === highlight.color) || HIGHLIGHT_COLORS[0];
        rendition.annotations.add(
          "highlight",
          highlight.cfiRange,
          { id: highlight.id },
          undefined,
          "epub-highlight",
          { fill: color.fill, "fill-opacity": "0.4", "mix-blend-mode": "multiply" }
        );
      });
    },
    [highlights]
  );

  // Navigation handlers with smooth slide-over transition
  const goNext = useCallback(() => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setTransitionDirection("left");

    if (readerContainerRef.current) {
      const wrapper = readerContainerRef.current.querySelector(
        ".page-content-wrapper"
      ) as HTMLElement;
      const overlay = readerContainerRef.current.querySelector(".page-overlay") as HTMLElement;
      const shadowRight = readerContainerRef.current.querySelector(
        ".page-shadow-right"
      ) as HTMLElement;

      if (wrapper) {
        wrapper.classList.remove("pushing-left", "pushing-right", "reset-animation");
        void wrapper.offsetWidth;
        wrapper.classList.add("pushing-left");
      }
      if (overlay) {
        overlay.classList.remove("slide-next", "slide-prev");
        overlay.style.display = "block";
        overlay.style.background = themes[currentTheme].container;
        void overlay.offsetWidth;
        overlay.classList.add("slide-next");
      }
      if (shadowRight) {
        shadowRight.classList.add("active");
      }
    }

    // Change page at the midpoint of animation
    setTimeout(() => {
      renditionRef.current?.next();
    }, 300);

    // Reset after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionDirection(null);
      if (readerContainerRef.current) {
        const wrapper = readerContainerRef.current.querySelector(
          ".page-content-wrapper"
        ) as HTMLElement;
        const overlay = readerContainerRef.current.querySelector(".page-overlay") as HTMLElement;
        const shadowRight = readerContainerRef.current.querySelector(
          ".page-shadow-right"
        ) as HTMLElement;

        if (wrapper) {
          wrapper.classList.remove("pushing-left", "pushing-right");
          wrapper.classList.add("reset-animation");
        }
        if (overlay) {
          overlay.classList.remove("slide-next", "slide-prev");
          overlay.style.display = "none";
        }
        if (shadowRight) {
          shadowRight.classList.remove("active");
        }
      }
    }, 620);
  }, [isTransitioning, currentTheme]);

  const goPrev = useCallback(() => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setTransitionDirection("right");

    if (readerContainerRef.current) {
      const wrapper = readerContainerRef.current.querySelector(
        ".page-content-wrapper"
      ) as HTMLElement;
      const overlay = readerContainerRef.current.querySelector(".page-overlay") as HTMLElement;
      const shadowLeft = readerContainerRef.current.querySelector(
        ".page-shadow-left"
      ) as HTMLElement;

      if (wrapper) {
        wrapper.classList.remove("pushing-left", "pushing-right", "reset-animation");
        void wrapper.offsetWidth;
        wrapper.classList.add("pushing-right");
      }
      if (overlay) {
        overlay.classList.remove("slide-next", "slide-prev");
        overlay.style.display = "block";
        overlay.style.background = themes[currentTheme].container;
        void overlay.offsetWidth;
        overlay.classList.add("slide-prev");
      }
      if (shadowLeft) {
        shadowLeft.classList.add("active");
      }
    }

    // Change page at the midpoint of animation
    setTimeout(() => {
      renditionRef.current?.prev();
    }, 300);

    // Reset after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionDirection(null);
      if (readerContainerRef.current) {
        const wrapper = readerContainerRef.current.querySelector(
          ".page-content-wrapper"
        ) as HTMLElement;
        const overlay = readerContainerRef.current.querySelector(".page-overlay") as HTMLElement;
        const shadowLeft = readerContainerRef.current.querySelector(
          ".page-shadow-left"
        ) as HTMLElement;

        if (wrapper) {
          wrapper.classList.remove("pushing-left", "pushing-right");
          wrapper.classList.add("reset-animation");
        }
        if (overlay) {
          overlay.classList.remove("slide-next", "slide-prev");
          overlay.style.display = "none";
        }
        if (shadowLeft) {
          shadowLeft.classList.remove("active");
        }
      }
    }, 620);
  }, [isTransitioning, currentTheme]);

  // Toggle header visibility on double tap and close selection popup
  const handleReaderTap = useCallback(() => {
    // Close selection popup when clicking elsewhere
    if (showSelectionPopup) {
      setShowSelectionPopup(false);
      setShowHighlightColors(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      setShowHeader((prev) => !prev);
    }
    lastTapRef.current = now;
  }, [showSelectionPopup]);

  // Get rendition ref
  const getRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition;

      // Store book reference for summary generation
      if (rendition.book) {
        bookRef.current = rendition.book;
        
        // Generate locations for accurate page tracking
        // This calculates positions throughout the book for progress tracking
        rendition.book.ready.then(() => {
          if (bookRef.current) {
            return bookRef.current.locations.generate(1024);
          }
        }).then(() => {
          // Locations generated, page numbers will now be accurate
          console.log("Book locations generated");
        }).catch((err: unknown) => {
          console.warn("Could not generate book locations:", err);
        });
      }

      const theme = themes[currentTheme];
      rendition.themes.default({
        body: {
          background: theme.body.background,
          color: theme.body.color,
          "font-size": `${fontSize}%`,
          "line-height": "1.6",
          "padding-left": "5%",
          "padding-right": "5%",
        },
        p: {
          "text-align": "justify",
          "margin-bottom": "1em",
        },
        a: {
          color: "inherit",
        },
      });

      // Listen for text selection
      rendition.on("selected", handleTextSelection);

      // Listen for click to close selection popup when clicking elsewhere
      rendition.on("click", () => {
        // Small delay to allow selection event to fire first
        setTimeout(() => {
          const contents = rendition.getContents() as unknown as Contents[];
          if (Array.isArray(contents)) {
            const hasSelection = contents.some((content: Contents) => {
              const selection = content.window.getSelection();
              return selection && selection.toString().trim().length > 0;
            });
            if (!hasSelection) {
              setShowSelectionPopup(false);
              setShowHighlightColors(false);
            }
          }
        }, 50);
      });

      // Restore saved highlights after a short delay
      setTimeout(() => {
        restoreHighlights(rendition);
      }, 500);

      rendition.on("keyup", (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") {
          goPrev();
        }
        if (event.key === "ArrowRight") {
          goNext();
        }
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          goPrev();
        } else if (e.key === "ArrowRight") {
          goNext();
        } else if (e.key === "Escape") {
          setShowSettings(false);
          setShowToc(false);
          setShowSelectionPopup(false);
          setShowSummaryModal(false);
          setShowExplainModal(false);
          setShowBookmarksModal(false);
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        rendition.off("selected", handleTextSelection);
      };
    },
    [currentTheme, fontSize, goNext, goPrev, handleTextSelection, restoreHighlights]
  );

  // Handle ToC navigation
  const handleTocClick = (href: string) => {
    if (renditionRef.current) {
      setIsTransitioning(true);
      setTimeout(() => {
        renditionRef.current?.display(href);
        setShowToc(false);
        setTimeout(() => setIsTransitioning(false), 200);
      }, 100);
    }
  };

  // Go back
  const goToLibrary = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  if (!isClient || !bookData || !isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="animate-pulse text-gray-500">Loading reader...</div>
      </div>
    );
  }

  const currentThemeConfig = themes[currentTheme];

  return (
    <div
      className="relative h-screen w-screen select-none overflow-hidden"
      style={{ background: currentThemeConfig.container }}
      onClick={handleReaderTap}
    >
      {/* Header Toggle Button - Shows when header is hidden */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowHeader(true);
          }}
          className={`pointer-events-auto rounded-b-xl px-4 py-1.5 shadow-lg transition-all duration-300 ease-out ${
            showHeader ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{
            background:
              currentTheme === "dark"
                ? "rgba(26, 26, 26, 0.9)"
                : currentTheme === "sepia"
                  ? "rgba(232, 220, 200, 0.9)"
                  : "rgba(248, 248, 248, 0.9)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: `1px solid ${currentThemeConfig.tocButton}15`,
            borderTop: "none",
          }}
          title="Show menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke={currentThemeConfig.tocButton}
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Header Bar */}
      <div
        className={`absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-2 transition-all duration-300 ${
          showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
        style={{
          background:
            currentTheme === "dark"
              ? "rgba(26, 26, 26, 0.95)"
              : currentTheme === "sepia"
                ? "rgba(232, 220, 200, 0.95)"
                : "rgba(248, 248, 248, 0.95)",
          borderBottom: `1px solid ${currentThemeConfig.tocButton}22`,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left section - Back & ToC */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToLibrary}
            className="rounded-xl p-2.5 transition-all duration-200 hover:bg-black/5 active:scale-95"
            title="Back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke={currentThemeConfig.tocButton}
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <button
            onClick={() => setShowToc(!showToc)}
            className={`rounded-xl p-2.5 transition-all duration-200 active:scale-95 ${
              showToc ? "bg-amber-500/20" : "hover:bg-black/5"
            }`}
            title="Table of Contents"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke={currentThemeConfig.tocButton}
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Center - Book title, Page info & Hide Button */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span
              className="max-w-[120px] truncate text-sm font-medium sm:max-w-[200px]"
              style={{ color: currentThemeConfig.tocButton }}
            >
              {bookName || `Untitled ${bookTerm.singular}`}
            </span>
            {/* Hide Header Button - Center */}
            <button
              onClick={() => setShowHeader(false)}
              className="rounded-lg p-1 transition-all duration-200 hover:bg-black/10 active:scale-95"
              title="Hide menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke={currentThemeConfig.tocButton}
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right section - Bookmark, Summary & Settings */}
        <div className="flex items-center gap-1">
          {/* Bookmark Current Page */}
          <button
            onClick={isCurrentPageBookmarked() ? () => {
              const bookmark = bookmarks.find(b => b.cfiLocation === location);
              if (bookmark) handleRemoveBookmark(bookmark.id);
            } : handleAddBookmark}
            disabled={isBookmarkSaving}
            className={`rounded-xl p-2.5 transition-all duration-200 active:scale-95 ${
              isCurrentPageBookmarked() ? "bg-amber-500/20" : "hover:bg-black/5"
            }`}
            title={isCurrentPageBookmarked() ? "Remove Bookmark" : "Bookmark Page"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill={isCurrentPageBookmarked() ? currentThemeConfig.tocButton : "none"}
              viewBox="0 0 24 24"
              stroke={currentThemeConfig.tocButton}
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>

          {/* View Bookmarks */}
          <button
            onClick={() => setShowBookmarksModal(true)}
            className={`rounded-xl p-2.5 transition-all duration-200 active:scale-95 ${
              showBookmarksModal ? "bg-amber-500/20" : "hover:bg-black/5"
            }`}
            title="View Bookmarks"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke={currentThemeConfig.tocButton}
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </button>

          {/* AI Summary Button */}
          <button
            onClick={handleGenerateSummary}
            className={`rounded-xl p-2.5 transition-all duration-200 active:scale-95 ${
              showSummaryModal ? "bg-amber-500/20" : "hover:bg-black/5"
            }`}
            title={`AI ${bookTerm.singular} Summary`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke={currentThemeConfig.tocButton}
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`rounded-xl p-2.5 transition-all duration-200 active:scale-95 ${
              showSettings ? "bg-amber-500/20" : "hover:bg-black/5"
            }`}
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke={currentThemeConfig.tocButton}
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
          <div
            className="absolute right-4 top-14 z-50 w-72 rounded-xl p-4 shadow-2xl"
            style={{
              background:
                currentTheme === "dark"
                  ? "#1a1a1a"
                  : currentTheme === "sepia"
                    ? "#e8dcc8"
                    : "#ffffff",
              border: `1px solid ${currentThemeConfig.tocButton}22`,
            }}
          >
            {/* Theme Selection */}
            <div className="mb-4">
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: currentThemeConfig.tocButton }}
              >
                Theme
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleThemeChange("light")}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 transition-all ${
                    currentTheme === "light" ? "border-blue-500" : "border-transparent"
                  }`}
                  style={{ background: "#ffffff" }}
                >
                  <span className="text-sm text-gray-800">Light</span>
                </button>
                <button
                  onClick={() => handleThemeChange("sepia")}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 transition-all ${
                    currentTheme === "sepia" ? "border-blue-500" : "border-transparent"
                  }`}
                  style={{ background: "#f4ecd8" }}
                >
                  <span className="text-sm text-amber-900">Sepia</span>
                </button>
                <button
                  onClick={() => handleThemeChange("dark")}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 transition-all ${
                    currentTheme === "dark" ? "border-blue-500" : "border-transparent"
                  }`}
                  style={{ background: "#0a0a0a" }}
                >
                  <span className="text-sm text-gray-200">Dark</span>
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div className="mb-4">
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: currentThemeConfig.tocButton }}
              >
                Font Size
              </label>

              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  onClick={decreaseFontSize}
                  disabled={fontSize === fontSizes[0]}
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-30"
                  style={{
                    background: `${currentThemeConfig.tocButton}15`,
                    color: currentThemeConfig.tocButton,
                  }}
                >
                  <span className="text-lg font-semibold">A</span>
                  <span className="text-xs">−</span>
                </button>

                <div
                  className="flex-1 rounded-xl py-2.5 text-center font-medium"
                  style={{
                    background: `${currentThemeConfig.tocButton}10`,
                    color: currentThemeConfig.tocButton,
                  }}
                >
                  <span className="text-base">{fontSize}%</span>
                </div>

                <button
                  onClick={increaseFontSize}
                  disabled={fontSize === fontSizes[fontSizes.length - 1]}
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-30"
                  style={{
                    background: `${currentThemeConfig.tocButton}15`,
                    color: currentThemeConfig.tocButton,
                  }}
                >
                  <span className="text-xl font-semibold">A</span>
                  <span className="text-xs">+</span>
                </button>
              </div>

              <div className="px-1">
                <input
                  type="range"
                  min={0}
                  max={fontSizes.length - 1}
                  value={fontSizes.indexOf(fontSize)}
                  onChange={(e) => {
                    const newSize = fontSizes[parseInt(e.target.value)];
                    setFontSize(newSize);
                    localStorage.setItem("epub-font-size", newSize.toString());
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, #f59e0b ${(fontSizes.indexOf(fontSize) / (fontSizes.length - 1)) * 100}%, ${currentThemeConfig.tocButton}20 ${(fontSizes.indexOf(fontSize) / (fontSizes.length - 1)) * 100}%)`,
                  }}
                />
                <div className="mt-1 flex justify-between">
                  <span
                    className="text-xs opacity-50"
                    style={{ color: currentThemeConfig.tocButton }}
                  >
                    Small
                  </span>
                  <span
                    className="text-xs opacity-50"
                    style={{ color: currentThemeConfig.tocButton }}
                  >
                    Large
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Controls */}
            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: currentThemeConfig.tocButton }}
              >
                Navigation
              </label>
              <div className="flex gap-2">
                <button
                  onClick={goPrev}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: `${currentThemeConfig.tocButton}15`,
                    color: currentThemeConfig.tocButton,
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Previous</span>
                </button>
                <button
                  onClick={goNext}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: `${currentThemeConfig.tocButton}15`,
                    color: currentThemeConfig.tocButton,
                  }}
                >
                  <span className="text-sm">Next</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Table of Contents Panel */}
      {showToc && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowToc(false)}
          />
          <div
            className="absolute bottom-0 left-0 z-50 w-80 overflow-y-auto shadow-2xl"
            style={{
              top: showHeader ? 56 : 0,
              background:
                currentTheme === "dark"
                  ? "#1a1a1a"
                  : currentTheme === "sepia"
                    ? "#e8dcc8"
                    : "#ffffff",
              borderRight: `1px solid ${currentThemeConfig.tocButton}15`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <h2
                className="mb-4 flex items-center gap-2 text-lg font-bold"
                style={{ color: currentThemeConfig.tocButton }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                Contents
              </h2>
              {tocRef.current.length > 0 ? (
                <ul className="space-y-0.5">
                  {tocRef.current.map((item, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handleTocClick(item.href)}
                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200 hover:bg-black/5 active:scale-[0.98]"
                        style={{ color: currentThemeConfig.tocButton }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Navigation Buttons */}
      <button
        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-3 opacity-40 transition-all duration-200 hover:opacity-80 active:scale-95"
        style={{
          background: currentTheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
        title="Previous page"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke={currentThemeConfig.tocButton}
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-3 opacity-40 transition-all duration-200 hover:opacity-80 active:scale-95"
        style={{
          background: currentTheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
        title="Next page"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke={currentThemeConfig.tocButton}
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Reader Container */}
      <div
        ref={readerContainerRef}
        className="page-transition-container absolute left-0 right-0"
        style={{
          top: showHeader ? 48 : 0,
          bottom: 20,
          transition: "top 0.3s ease",
        }}
      >
        {/* Shadow effects for page curl illusion */}
        <div className="page-shadow-left" />
        <div className="page-shadow-right" />

        {/* Overlay page that slides over during transition */}
        <div
          className="page-overlay"
          style={{
            display: "none",
            background: currentThemeConfig.container,
          }}
        />

        <div className="page-content-wrapper h-full w-full">
          <ReactReader
            url={bookData}
            location={location ?? 0}
            locationChanged={locationChanged}
            readerStyles={getReaderStyles(currentThemeConfig)}
            getRendition={(rendition) => {
              getRendition(rendition);
            }}
            tocChanged={(toc) => {
              tocRef.current = toc;
            }}
            epubOptions={{
              flow: "paginated",
              manager: "default",
            }}
            loadingView={
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="border-3 h-8 w-8 animate-spin rounded-full border-amber-500 border-t-transparent" />
                <div
                  className="animate-pulse text-sm"
                  style={{ color: currentThemeConfig.tocButton }}
                >
                  Loading book...
                </div>
              </div>
            }
            errorView={
              <div className="flex h-full flex-col items-center justify-center p-4">
                <div className="mb-2 text-lg text-red-500">Unable to load {bookTerm.singular.toLowerCase()}</div>
                <div className="mb-4 text-sm text-gray-500">The EPUB file could not be parsed</div>
                <button
                  onClick={goToLibrary}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-white transition-colors hover:bg-amber-600"
                >
                  Go Back
                </button>
              </div>
            }
          />
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div
        className="animate-hintFade pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-xs opacity-0"
        style={{
          background: `${currentThemeConfig.tocButton}15`,
          color: currentThemeConfig.tocButton,
        }}
      >
        Use arrow keys or tap edges to navigate • Double-tap to toggle header
      </div>

      {/* Text Selection Popup */}
      {showSelectionPopup && selectionPosition && (
        <div
          className="fixed z-[100]"
          style={{
            left: selectionPosition.x,
            top: selectionPosition.y,
            transform: selectionPosition.y > 80 ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center gap-1 rounded-xl p-1.5 shadow-xl"
            style={{
              background: currentTheme === "dark" ? "#2a2a2a" : "#ffffff",
              border: `1px solid ${currentThemeConfig.tocButton}22`,
            }}
          >
            {/* Copy Button */}
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all hover:bg-black/5 active:scale-95"
              style={{ color: currentThemeConfig.tocButton }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </button>

            {/* Highlight Button */}
            <div className="relative">
              <button
                onClick={() => setShowHighlightColors(!showHighlightColors)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all hover:bg-black/5 active:scale-95"
                style={{ color: currentThemeConfig.tocButton }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Highlight
              </button>

              {/* Highlight Colors Dropdown */}
              {showHighlightColors && (
                <div
                  className="absolute left-0 top-full mt-1 flex gap-1 rounded-lg p-2 shadow-lg"
                  style={{
                    background: currentTheme === "dark" ? "#2a2a2a" : "#ffffff",
                    border: `1px solid ${currentThemeConfig.tocButton}22`,
                  }}
                >
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => handleAddHighlight(color)}
                      className="h-7 w-7 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110 active:scale-95"
                      style={{ background: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Explain Button */}
            {BOOK_AI_ENABLED && (
            <button
              onClick={handleExplainText}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all hover:bg-black/5 active:scale-95"
              style={{ color: currentThemeConfig.tocButton }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Explain
            </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                setShowSelectionPopup(false);
                setShowHighlightColors(false);
              }}
              className="rounded-lg p-2 transition-all hover:bg-black/5 active:scale-95"
              style={{ color: currentThemeConfig.tocButton }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSummaryModal(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[95] max-h-[80vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
            style={{
              background: currentTheme === "dark" ? "#1a1a1a" : "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: `${currentThemeConfig.tocButton}22` }}
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: currentThemeConfig.tocButton }}
                >
                  AI {bookTerm.singular} Summary
                </h3>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="rounded-lg p-2 transition-all hover:bg-black/5 active:scale-95"
                style={{ color: currentThemeConfig.tocButton }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {isSummaryLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
                  <p className="text-sm" style={{ color: currentThemeConfig.tocButton }}>
                    Generating summary with AI...
                  </p>
                </div>
              ) : summaryError ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-3 h-12 w-12 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="mb-4 text-center text-red-500">{summaryError}</p>
                  <button
                    onClick={handleGenerateSummary}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-white transition-colors hover:bg-amber-600"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-none"
                  style={{ color: currentThemeConfig.tocButton }}
                  dangerouslySetInnerHTML={{
                    __html: `<p class="mb-3">${parseMarkdown(summaryContent)}</p>`,
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Explain Modal */}
      {showExplainModal && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowExplainModal(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[95] max-h-[80vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
            style={{
              background: currentTheme === "dark" ? "#1a1a1a" : "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: `${currentThemeConfig.tocButton}22` }}
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: currentThemeConfig.tocButton }}
                >
                  AI Explanation
                </h3>
              </div>
              <button
                onClick={() => setShowExplainModal(false)}
                className="rounded-lg p-2 transition-all hover:bg-black/5 active:scale-95"
                style={{ color: currentThemeConfig.tocButton }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Selected Text */}
            {textToExplain && (
              <div
                className="border-b px-5 py-3"
                style={{
                  borderColor: `${currentThemeConfig.tocButton}22`,
                  background: currentTheme === "dark" ? "#252525" : "#f8f8f8",
                }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-wide opacity-60"
                  style={{ color: currentThemeConfig.tocButton }}
                >
                  Selected Text
                </p>
                <p className="mt-1 text-sm italic" style={{ color: currentThemeConfig.tocButton }}>
                  &ldquo;
                  {textToExplain.length > 200 ? textToExplain.slice(0, 200) + "..." : textToExplain}
                  &rdquo;
                </p>
              </div>
            )}

            {/* Modal Content */}
            <div className="max-h-[50vh] overflow-y-auto p-5">
              {isExplainLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                  <p className="text-sm" style={{ color: currentThemeConfig.tocButton }}>
                    AI is analyzing the text...
                  </p>
                </div>
              ) : explainError ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-3 h-12 w-12 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="mb-4 text-center text-red-500">{explainError}</p>
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-none"
                  style={{ color: currentThemeConfig.tocButton }}
                  dangerouslySetInnerHTML={{
                    __html: `<p class="mb-3">${parseMarkdown(explainContent)}</p>`,
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Bookmarks Modal */}
      {showBookmarksModal && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowBookmarksModal(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[95] max-h-[80vh] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
            style={{
              background: currentTheme === "dark" ? "#1a1a1a" : "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: `${currentThemeConfig.tocButton}22` }}
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: currentThemeConfig.tocButton }}
                >
                  Bookmarks ({bookmarks.length})
                </h3>
              </div>
              <button
                onClick={() => setShowBookmarksModal(false)}
                className="rounded-lg p-2 transition-all hover:bg-black/5 active:scale-95"
                style={{ color: currentThemeConfig.tocButton }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-3 h-12 w-12 opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke={currentThemeConfig.tocButton}
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                  <p className="text-sm opacity-60" style={{ color: currentThemeConfig.tocButton }}>
                    No bookmarks yet
                  </p>
                  <p className="mt-1 text-xs opacity-40" style={{ color: currentThemeConfig.tocButton }}>
                    Tap the bookmark icon to save your place
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: `${currentThemeConfig.tocButton}15` }}>
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-black/5"
                    >
                      <button
                        onClick={() => handleGoToBookmark(bookmark.cfiLocation)}
                        className="flex flex-1 flex-col items-start text-left"
                      >
                        <span
                          className="text-sm font-medium line-clamp-1"
                          style={{ color: currentThemeConfig.tocButton }}
                        >
                          {bookmark.label && bookmark.label !== "Page 1" 
                            ? bookmark.label 
                            : "Saved location"}
                        </span>
                        <span
                          className="mt-0.5 text-xs opacity-50"
                          style={{ color: currentThemeConfig.tocButton }}
                        >
                          Saved {new Date(bookmark.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                      <button
                        onClick={() => handleRemoveBookmark(bookmark.id)}
                        className="ml-2 rounded-lg p-2 text-red-500 opacity-60 transition-all hover:bg-red-500/10 hover:opacity-100 active:scale-95"
                        title="Remove bookmark"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
