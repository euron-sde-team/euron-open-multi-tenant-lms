"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen, ArrowLeft } from "lucide-react";
import "../../../components/epub-reader/epub-reader.css";
import { useContentTerm } from "@/lib/hooks/use-content-terms";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const authToken = localStorage.getItem("authToken");
  if (authToken) return authToken;
  const legacy = localStorage.getItem("auth_token");
  if (legacy) {
    localStorage.setItem("authToken", legacy);
    localStorage.removeItem("auth_token");
    return legacy;
  }
  return localStorage.getItem("accessToken");
}

// Dynamically import the EPUB reader to avoid SSR issues with epubjs.
const EpubReader = dynamic(
  () => import("../../../components/epub-reader/EpubReader").then((mod) => mod.EpubReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <div className="animate-pulse text-gray-500">Loading reader...</div>
        </div>
      </div>
    ),
  }
);

// PDF reader gets the same SSR-off treatment, since pdfjs-dist needs window.
const PdfReader = dynamic(
  () => import("../../../components/pdf-reader/PdfReader").then((mod) => mod.PdfReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <div className="animate-pulse text-gray-500">Loading reader...</div>
        </div>
      </div>
    ),
  }
);

interface BookReaderClientProps {
  slug: string;
}

type BookFileFormat = "EPUB" | "PDF";

interface BookData {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  /** Storage format. Drives which reader we mount. Defaults to EPUB if absent. */
  file_format?: BookFileFormat;
  hasEpubContent?: boolean;
  hasPdfContent?: boolean;
  url?: string | null;
  sample_enabled?: boolean;
  sample_pages?: number | null;
}

export function BookReaderClient({ slug }: BookReaderClientProps) {
  const router = useRouter();
  const bookTerm = useContentTerm("book");
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [content, setContent] = useState<ArrayBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBookData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
          ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
          : `http://localhost:${process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096"}/api/v1`;

        const token = getAuthToken();

        const metadataUrl = `${baseUrl}/books/${encodeURIComponent(slug)}`;
        const metadataResponse = await fetch(metadataUrl, {
          headers: {
            "X-Tenant-Host": typeof window !== "undefined" ? window.location.host : "",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!metadataResponse.ok) {
          if (metadataResponse.status === 404) {
            throw new Error(`${bookTerm.singular} not found`);
          }
          throw new Error(`Failed to load ${bookTerm.singular.toLowerCase()}`);
        }

        const metadataJson = await metadataResponse.json();
        if (!metadataJson?.data) {
          throw new Error("Invalid response from server");
        }

        const book: BookData = metadataJson.data;
        if (cancelled) return;
        setBookData(book);

        // Trust the file_format discriminator. Fall back to the legacy
        // `hasEpubContent` / `hasPdfContent` flags for backward compatibility.
        const format: BookFileFormat =
          book.file_format === "PDF" || book.hasPdfContent
            ? "PDF"
            : book.hasEpubContent || book.file_format === "EPUB"
              ? "EPUB"
              : book.url
                ? "EPUB"
                : "EPUB";

        const contentUrl = `${baseUrl}/books/${encodeURIComponent(slug)}/content`;
        const contentResponse = await fetch(contentUrl, {
          headers: {
            "X-Tenant-Host": typeof window !== "undefined" ? window.location.host : "",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!contentResponse.ok) {
          throw new Error(`Failed to load ${bookTerm.singular.toLowerCase()} content`);
        }

        const arrayBuffer = await contentResponse.arrayBuffer();
        if (cancelled) return;
        setContent(arrayBuffer);
        // Persist the resolved format on the book object so the renderer
        // doesn't have to repeat the inference.
        setBookData({ ...book, file_format: format });
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Failed to load ${bookTerm.singular.toLowerCase()}`);
          setIsLoading(false);
        }
      }
    };

    fetchBookData();

    return () => {
      cancelled = true;
    };
  }, [slug, bookTerm]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 gap-4">
        <BookOpen className="h-16 w-16 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-700">{error}</h2>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    );
  }

  if (isLoading || !content || !bookData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <div className="animate-pulse text-gray-500">Loading {bookTerm.singular.toLowerCase()}...</div>
        </div>
      </div>
    );
  }

  if (bookData.file_format === "PDF") {
    const cap = bookData.sample_enabled ? bookData.sample_pages ?? null : null;
    return (
      <PdfReader
        bookData={content}
        bookName={bookData.title}
        bookId={bookData.id}
        bookDescription={bookData.description || undefined}
        onBack={() => router.back()}
        samplePageCap={cap}
      />
    );
  }

  return (
    <EpubReader
      bookData={content}
      bookName={bookData.title}
      bookId={bookData.id}
      bookDescription={bookData.description || undefined}
      onBack={() => router.back()}
    />
  );
}
