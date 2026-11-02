"use client";

import {
  BookProvider,
  ClassicTemplate,
  ModernTemplate,
  MinimalTemplate,
  AmazonTemplate,
  getDefaultBookFormData,
  type BookTemplateId,
  type BookDisplayData,
  type BookEditCallbacks,
  type BookAuthor,
  type BookCategory,
  type BookFormData,
  type TemplatePriceParts,
} from "@open-mtlms/book-templates";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Separator,
  useToast,
} from "@open-mtlms/core";
import type { TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { formatMoney, getCurrencySymbol } from "@open-mtlms/shared";
import { defaultThemeConfig, getDefaultTenantLayout } from "@open-mtlms/ui-config";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  Link2,
  Loader2,
  Package,
  Pencil,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";

import { BookEditorContainer } from "@/components/book-editor/BookEditorContainer";
import { BookAIGenerateModal } from "@/components/book-editor/modals/BookAIGenerateModal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { ProductLinker } from "@/components/product-linker/ProductLinker";
import { SlugEditor } from "@/components/shared/slug-editor";
import type { BookAISectionKey, GeneratedBookContent } from "@/lib/api/book-ai";
import { booksApi, type Book } from "@/lib/api/books";
import { getLayoutWithHomepageLogo } from "@/lib/api/layout";
import { pagesApi } from "@/lib/api/pages";
import { uploadApi } from "@/lib/api/upload";
import { useCourseEditorHeader } from "@/lib/contexts/course-editor-header-context";
import { availableRoutesKeys } from "@/lib/hooks/use-available-routes";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCurrencySettings } from "@/lib/hooks/use-currency-settings";
import { useInstructors } from "@/lib/hooks/use-instructors";
import { useSidebarConfig } from "@/lib/hooks/use-sidebar-config";
import { useBookStore, type BookFormDataWithPrices } from "@/lib/stores/book-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { pageToPageConfig } from "@/lib/types/page";
import { buildEditorPreviewPriceParts, legacyToPrices } from "@/lib/utils/price-fields";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

// Convert API book response to BookFormData
function apiBookToFormData(apiBook: Book): BookFormDataWithPrices {
  const priceInr = apiBook.priceInr ? parseFloat(apiBook.priceInr) : 0;
  const priceUsd = apiBook.priceUsd ? parseFloat(apiBook.priceUsd) : 0;
  const discountInr = apiBook.discountInr ? parseFloat(apiBook.discountInr) : 0;
  const discountUsd = apiBook.discountUsd ? parseFloat(apiBook.discountUsd) : 0;
  const thumbnailUrl = apiBook.thumbnailUrl || "";

  return {
    id: apiBook.id,
    title: apiBook.title,
    slug: apiBook.slug,
    description: apiBook.description || "",
    summary: "",
    author: "",
    language: apiBook.language || ["English"],
    pages: apiBook.pages ?? 0,
    purchaseMode: apiBook.purchaseMode,
    status: apiBook.status,
    priceInr,
    priceUsd,
    discountInr,
    discountUsd,
    thumbnailUrl,
    previewUrl: apiBook.previewUrl || "",
    url: apiBook.url || "",
    pageImages: apiBook.pageImages || [],
    authorIds: apiBook.authorIds || [],
    categoryIds: apiBook.categoryIds || [],
    sortOrder: apiBook.sortOrder || 0,
    isBought: false,
    publishStatus: apiBook.status === "PUBLISHED" ? "PUBLISHED" : "NOT_PUBLISHED",
    webPriceINR: priceInr,
    mobilePriceINR: priceInr,
    webPriceUSD: priceUsd,
    mobilePriceUSD: priceUsd,
    webDiscount: discountInr,
    mobileDiscount: discountInr,
    webThumbnailUrl: thumbnailUrl,
    mobileThumbnailUrl: thumbnailUrl,
    offerings: [],
    rating: (apiBook as { rating?: number | null }).rating != null ? Number((apiBook as { rating?: number | null }).rating) : undefined,
    ratingTotalCount: (apiBook as { ratingTotalCount?: number | null }).ratingTotalCount ?? undefined,
    sampleEnabled: (apiBook as { sampleEnabled?: boolean }).sampleEnabled ?? true,
    samplePages: (apiBook as { samplePages?: number | null }).samplePages ?? 10,
    fileFormat: (apiBook as { fileFormat?: "EPUB" | "PDF" }).fileFormat ?? "EPUB",
    prices: apiBook.prices?.length
      ? apiBook.prices
      : legacyToPrices(apiBook.priceInr, apiBook.priceUsd, apiBook.discountInr, apiBook.discountUsd),
  } as BookFormDataWithPrices;
}

// Convert BookFormData to API request format
function formDataToApiRequest(bookData: BookFormDataWithPrices): Record<string, unknown> {
  const language = bookData.language;
  // Use new schema fields if available, otherwise fall back to legacy fields
  const priceInr = bookData.priceInr ?? bookData.webPriceINR ?? 0;
  const priceUsd = bookData.priceUsd ?? bookData.webPriceUSD ?? 0;
  const discountInr = bookData.discountInr ?? bookData.webDiscount ?? 0;
  const discountUsd = bookData.discountUsd ?? 0;
  const thumbnailUrl = bookData.thumbnailUrl ?? bookData.webThumbnailUrl ?? "";
  const status = bookData.status ?? (bookData.publishStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
  
  return {
    title: bookData.title,
    slug: bookData.slug,
    author: bookData.author || null,
    description: bookData.description || null,
    summary: bookData.summary || null,
    pages: bookData.pages || null,
    url: bookData.url || null,
    page_images: bookData.pageImages || [],
    price_inr: priceInr ? String(priceInr) : null,
    price_usd: priceUsd ? String(priceUsd) : null,
    discount_inr: discountInr ? String(discountInr) : null,
    discount_usd: discountUsd ? String(discountUsd) : null,
    prices: bookData.prices,
    purchase_mode: bookData.purchaseMode,
    status: status,
    language: Array.isArray(language) ? language : [language || "English"],
    thumbnail_url: thumbnailUrl || null,
    preview_url: bookData.previewUrl || null,
    sort_order: bookData.sortOrder || 0,
    rating: bookData.rating != null ? String(bookData.rating) : null,
    rating_total_count: bookData.ratingTotalCount ?? null,
    sample_enabled: bookData.sampleEnabled ?? true,
    sample_pages: bookData.samplePages ?? 10,
    file_format: bookData.fileFormat ?? "EPUB",
    author_ids: bookData.authorIds || [],
    category_ids: bookData.categoryIds || [],
  };
}

// Template component mapping
const templateComponents: Record<
  BookTemplateId,
  React.ComponentType<{
    onStartReading?: () => void;
    onUnlock?: () => void;
    onEpubUpload?: (file: File) => Promise<string | undefined>;
    onPdfUpload?: (file: File) => Promise<string | undefined>;
  }>
> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  amazon: AmazonTemplate,
};

// Map API Instructor to BookAuthor
function instructorToBookAuthor(instructor: { id: string; name: string; profileUrl: string | null; bio: string | null; expertise: string | null }): BookAuthor {
  return {
    id: instructor.id,
    name: instructor.name,
    avatar: instructor.profileUrl ?? undefined,
    bio: instructor.bio ?? undefined,
    role: instructor.expertise ?? undefined,
  };
}

// Map API Category to BookCategory
function categoryToBookCategory(category: { id: string; name: string; iconUrl: string | null }): BookCategory {
  return {
    id: category.id,
    name: category.name,
    icon: category.iconUrl ?? undefined,
  };
}

// Normalize theme to ensure it has the correct structure
const normalizeTheme = (theme: unknown): ThemeConfig => {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;

  const t = theme as Record<string, unknown>;

  // Check if it's the old simplified format
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) {
    return defaultThemeConfig;
  }

  // Check for correct structure
  const hasCorrectStructure =
    t.colors &&
    typeof t.colors === "object" &&
    "light" in (t.colors as object) &&
    t.fonts &&
    typeof t.fonts === "object" &&
    t.spacing &&
    typeof t.spacing === "object" &&
    t.borders &&
    typeof t.borders === "object";

  if (!hasCorrectStructure) return defaultThemeConfig;

  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: {
        ...defaultThemeConfig.colors.light,
        ...((t.colors as { light?: object })?.light || {}),
      },
      dark: {
        ...defaultThemeConfig.colors.dark,
        ...((t.colors as { dark?: object })?.dark || {}),
      },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
};

export default function BookEditorPage() {
  const params = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bookId = (params?.id as string) ?? "";

  const { selectedTenantId, selectedTenant } = useTenantStore();
  const bookStore = useBookStore();
  const { setHeaderContent } = useCourseEditorHeader() ?? {};
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const { data: sidebarConfig } = useSidebarConfig(selectedTenantId ?? undefined);

  const [globalTheme, setGlobalTheme] = useState<ThemeConfig>(defaultThemeConfig);
  const [tenantLayout, setTenantLayout] = useState<TenantLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showProductLinker, setShowProductLinker] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const hasInitialized = useRef(false);

  // Fetch instructors and categories from API (used for book authors and categories)
  const { data: instructorsData } = useInstructors(selectedTenantId ?? undefined);
  const { data: categoriesData } = useCategories(selectedTenantId ?? undefined);
  const { data: currencySettings } = useCurrencySettings();

  // Editor preview pricing: primary = tenant default currency from the price
  // book, with the other configured prices carried as additionalPrices.
  // Returns null when no price book exists yet (legacy INR/USD math fallback).
  const previewPriceParts = useMemo<TemplatePriceParts | null>(() => {
    const data = bookStore.bookData;
    if (data.purchaseMode !== "PAID") return null;
    return buildEditorPreviewPriceParts(data.prices, currencySettings?.currencies, {
      getCurrencySymbol,
      formatMoney,
    });
  }, [bookStore.bookData, currencySettings]);

  const allAuthors: BookAuthor[] = useMemo(
    () => (instructorsData?.instructors ?? []).map(instructorToBookAuthor),
    [instructorsData?.instructors]
  );
  const allCategories: BookCategory[] = useMemo(
    () => (categoriesData?.categories ?? []).map(categoryToBookCategory),
    [categoriesData?.categories]
  );

  // Load book and homepage data
  useEffect(() => {
    async function loadData() {
      if (!selectedTenantId || !bookId || hasInitialized.current) {
        if (!selectedTenantId) {
          setLoadError("Please select a tenant first");
          setIsLoading(false);
        }
        return;
      }

      hasInitialized.current = true;
      setIsLoading(true);
      setLoadError(null);

      try {
        // 1. Fetch layout (enriched with homepage logo) and homepage for theme in parallel
        const [loadedLayout, homepage] = await Promise.all([
          getLayoutWithHomepageLogo(selectedTenantId),
          pagesApi.getHomepage(selectedTenantId),
        ]);

        setTenantLayout(loadedLayout);

        let loadedTheme = defaultThemeConfig;

        if (homepage) {
          const pageConfig = pageToPageConfig(homepage);

          if (pageConfig.theme) {
            loadedTheme = normalizeTheme(pageConfig.theme);
            setGlobalTheme(loadedTheme);
          }
        }

        // 2. Fetch the book and recommendations in parallel
        const [book, recommendations] = await Promise.all([
          booksApi.getBook(bookId),
          booksApi.getRecommendations(bookId).catch(() => []),
        ]);

        // 3. Convert API response to book form data
        const bookFormData = apiBookToFormData(book);
        const defaults = getDefaultBookFormData();

        // Map API recommendations to BookRecommendationData
        const recommendationData = recommendations.map((r) => ({
          id: r.id,
          bookId: r.bookId,
          title: r.title,
          slug: r.slug,
          thumbnailUrl: r.thumbnailUrl ?? undefined,
          sortOrder: r.sortOrder,
        }));

        // Merge with defaults to ensure all fields exist
        const mergedBookData = {
          ...defaults,
          ...bookFormData,
          id: book.id,
          recommendations: recommendationData,
        };

        // 4. Load book into store
        bookStore.loadBook(mergedBookData);

        // 5. Use Amazon Template for book detail pages (matches user side)
        bookStore.setPageTemplate("amazon");

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load book:", error);
        setLoadError("Failed to load book. Please try again.");
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedTenantId, bookId]);

  // Reset initialization when book ID changes
  useEffect(() => {
    hasInitialized.current = false;
  }, [bookId]);

  // Get the selected template component
  const TemplateComponent = templateComponents[bookStore.selectedPageTemplate];

  // Map book store data to BookDisplayData
  const bookDisplayData: BookDisplayData = {
    ...bookStore.bookData,
    authors: allAuthors.filter((a) => bookStore.bookData.authorIds.includes(a.id)),
    categories: allCategories.filter((c) =>
      bookStore.bookData.categoryIds.includes(c.id)
    ),
    recommendations: bookStore.bookData.recommendations,
  };

  // Handle thumbnail upload
  const handleThumbnailUpload = useCallback(async (file: File) => {
    if (!selectedTenantId) return;
    
    try {
      const url = await bookStore.uploadThumbnail(file, selectedTenantId, bookId);
      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully.",
      });
      return url;
    } catch (error) {
      console.error("Failed to upload thumbnail:", error);
      toast({
        title: "Error",
        description: "Failed to upload thumbnail. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedTenantId, bookId, bookStore, toast]);

  // Upload progress state for the top-bar buttons (the in-template buttons keep
  // their own state, but the header buttons need their own indicator so users
  // know which action is in flight).
  const [isHeaderEpubUploading, setIsHeaderEpubUploading] = useState(false);
  const [isHeaderPdfUploading, setIsHeaderPdfUploading] = useState(false);
  const isAnyHeaderUploading = isHeaderEpubUploading || isHeaderPdfUploading;

  // EPUB upload (direct path, stays the same)
  const handleEpubUpload = useCallback(async (file: File) => {
    if (!selectedTenantId || !bookId) return;

    if (!file.name.toLowerCase().endsWith(".epub") && file.type !== "application/epub+zip") {
      toast({
        title: "Invalid file",
        description: "Please upload a valid EPUB file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = await bookStore.uploadEpub(file, selectedTenantId, bookId);
      toast({ title: "EPUB uploaded", description: "Saved to this book." });
      return url;
    } catch (error) {
      console.error("Failed to upload EPUB:", error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";
      toast({ title: "EPUB upload failed", description: detail, variant: "destructive" });
    }
  }, [selectedTenantId, bookId, bookStore, toast]);

  // PDF upload (direct path, replaces the old conversion flow)
  const handlePdfUpload = useCallback(async (file: File) => {
    if (!selectedTenantId || !bookId) return;

    const looksLikePdf =
      file.name.toLowerCase().endsWith(".pdf") ||
      file.type === "application/pdf" ||
      file.type === "application/x-pdf";
    if (!looksLikePdf) {
      toast({
        title: "Invalid file",
        description: "Please upload a valid PDF file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = await bookStore.uploadPdf(file, selectedTenantId, bookId);
      toast({ title: "PDF uploaded", description: "Saved to this book." });
      return url;
    } catch (error) {
      console.error("Failed to upload PDF:", error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";
      toast({ title: "PDF upload failed", description: detail, variant: "destructive" });
    }
  }, [selectedTenantId, bookId, bookStore, toast]);

  const pickAndUploadEpub = useCallback(() => {
    if (isAnyHeaderUploading) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".epub,application/epub+zip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsHeaderEpubUploading(true);
      try {
        await handleEpubUpload(file);
      } finally {
        setIsHeaderEpubUploading(false);
      }
    };
    input.click();
  }, [handleEpubUpload, isAnyHeaderUploading]);

  const pickAndUploadPdf = useCallback(() => {
    if (isAnyHeaderUploading) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsHeaderPdfUploading(true);
      try {
        await handlePdfUpload(file);
      } finally {
        setIsHeaderPdfUploading(false);
      }
    };
    input.click();
  }, [handlePdfUpload, isAnyHeaderUploading]);

  // Edit callbacks
  const editCallbacks: BookEditCallbacks = {
    priceParts: previewPriceParts,
    onEditTitle: useCallback((title: string) => {
      // Title only: the URL changes through the URL dialog (which can rebuild
      // it from the title), so a title edit never renames the live page or
      // overwrites a URL the admin chose.
      bookStore.updateBasicInfo({ title });
    }, []),
    onEditDescription: useCallback((description: string) => {
      bookStore.updateBasicInfo({ description });
    }, []),
    onEditLanguage: useCallback((language: string) => {
      // Convert string to array for new schema
      bookStore.updateBasicInfo({ language: [language] });
    }, []),
    onEditPages: useCallback((pages: number) => {
      bookStore.updateBasicInfo({ pages });
    }, []),
    onEditPrice: useCallback(() => {
      setActiveModal("pricing");
    }, []),
    onEditAuthors: useCallback(() => {
      setActiveModal("author");
    }, []),
    onEditCategories: useCallback(() => {
      setActiveModal("category");
    }, []),
    onEditThumbnail: useCallback(() => {
      setActiveModal("thumbnail");
    }, []),
    onEditPdfUrl: useCallback((url: string) => {
      bookStore.updateMedia({ url });
    }, []),
    onEditRecommendations: useCallback(() => {
      setActiveModal("recommendations");
    }, []),
    onEditSampleSettings: useCallback(() => {
      setActiveModal("sample");
    }, []),
    onEditRating: useCallback(() => {
      setActiveModal("rating");
    }, []),
  };

  // Handle save
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    if (!selectedTenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant first.",
        variant: "destructive",
      });
      return;
    }

    if (!bookStore.validate()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Upload AI-generated base64 thumbnail to S3 before saving
      if (
        bookStore.bookData.thumbnailUrl?.startsWith("data:") &&
        selectedTenantId
      ) {
        try {
          const result = await uploadApi.uploadBookThumbnailBase64(
            bookStore.bookData.thumbnailUrl,
            { type: "book_thumbnail", tenantId: selectedTenantId, bookId }
          );
          bookStore.updateMedia({ thumbnailUrl: result.url });
        } catch (err) {
          console.error("Failed to upload AI thumbnail:", err);
          // Continue saving without thumbnail update
        }
      }

      // Convert book form data to API request format
      const updateRequest = formDataToApiRequest(bookStore.bookData);

      // Update book via the books API, keeping the slug the server stored
      const savedBook = await booksApi.updateBook(bookId, updateRequest);
      if (savedBook?.slug) bookStore.setSavedSlug(savedBook.slug);

      // Sync book recommendations
      const recs = bookStore.bookData.recommendations || [];
      await booksApi.syncRecommendations(
        bookId,
        recs.map((r) => r.bookId)
      );

      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      bookStore.setDirty(false);

      toast({
        title: "Saved",
        description: "Book saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save book:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save book. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [bookId, bookStore, queryClient, selectedTenantId, isSaving, toast]);

  // Toggle edit/preview mode
  const toggleEditMode = useCallback(() => {
    setIsPreviewMode((p) => !p);
  }, []);

  // Book URL dialog. The slug saves on its own, apart from the main Save. The
  // server adds a short code when another book uses it, so the editor takes the
  // slug it stored; the next main Save then sends that slug, not the old one.
  const currentSlug = (bookStore.bookData.slug || "").replace(/^books\//, "");
  const handleSaveSlug = useCallback(
    async (slug: string) => {
      const updated = await booksApi.updateBook(bookId, { slug });
      const saved = updated?.slug || slug;
      bookStore.setSavedSlug(saved);
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      return saved.replace(/^books\//, "");
    },
    [bookId, bookStore, queryClient]
  );

  // AI generation handlers
  const handleAIClick = useCallback(() => {
    if (!bookStore.bookData.title?.trim()) {
      toast({
        title: "Book title required",
        description: "Please enter a book title before generating content with AI.",
        variant: "destructive",
      });
      return;
    }
    setIsAIModalOpen(true);
  }, [bookStore.bookData.title, toast]);

  const handleAISuccess = useCallback(
    (data: GeneratedBookContent, sections: BookAISectionKey[]) => {
      bookStore.saveToHistory();

      const updates: Partial<BookFormData> = {};

      if (data.description && sections.includes("description")) {
        updates.description = data.description;
      }

      // Apply EPUB metadata (author, language, pages)
      if (data.metadata) {
        if (data.metadata.author && !bookStore.bookData.author) {
          updates.author = data.metadata.author;
        }
        if (data.metadata.language) {
          updates.language = [data.metadata.language];
        }
        if (data.metadata.pageCount && !bookStore.bookData.pages) {
          updates.pages = data.metadata.pageCount;
        }
      }

      if (Object.keys(updates).length > 0) {
        bookStore.updateBasicInfo(updates);
      }

      // Thumbnail: store as base64 data URL, will be uploaded to S3 on save
      if (data.thumbnailDataUrl && sections.includes("thumbnail")) {
        bookStore.updateMedia({ thumbnailUrl: data.thumbnailDataUrl });
      }
    },
    [bookStore]
  );

  // Inject Back, Upload PDF, Preview, Save into dashboard header
  useEffect(() => {
    if (!setHeaderContent || isLoading || loadError) return;
    setHeaderContent(
      <>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/books">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <span className="text-muted-foreground text-sm">
          {bookStore.bookData.title || "Untitled Book"}
          {bookStore.isDirty && <span className="text-warning ml-1">•</span>}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={pickAndUploadEpub}
          disabled={isAnyHeaderUploading}
        >
          {isHeaderEpubUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isHeaderEpubUploading ? "Uploading..." : "Upload EPUB"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={pickAndUploadPdf}
          disabled={isAnyHeaderUploading}
        >
          {isHeaderPdfUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isHeaderPdfUploading ? "Uploading..." : "Upload PDF"}
        </Button>
        {aiAuthoringEnabled && (
          <Button variant="outline" size="sm" onClick={handleAIClick} className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUrlDialog(true)}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          URL
        </Button>
        <Button variant="outline" size="sm" onClick={toggleEditMode} className="gap-2">
          {isPreviewMode ? (
            <>
              <Pencil className="h-4 w-4" />
              Edit
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Preview
            </>
          )}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </>
    );
    return () => setHeaderContent(null);
  }, [
    setHeaderContent,
    isLoading,
    loadError,
    bookStore.bookData.title,
    aiAuthoringEnabled,
    bookStore.isDirty,
    isPreviewMode,
    isSaving,
    handleSave,
    toggleEditMode,
    pickAndUploadEpub,
    pickAndUploadPdf,
    isHeaderEpubUploading,
    isHeaderPdfUploading,
    isAnyHeaderUploading,
    handleAIClick,
  ]);

  // Use default layout if not loaded
  const effectiveLayout =
    tenantLayout ||
    (getDefaultTenantLayout(selectedTenantId || "default") as TenantLayout);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading book editor...</p>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-destructive mb-4">{loadError}</p>
        <Button asChild>
          <Link href="/dashboard/books">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Books
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Fixed Header */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/books">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {bookStore.bookData.title || "Untitled Book"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isPreviewMode ? "Preview" : "Editing"} mode
              {bookStore.isDirty && (
                <span className="text-warning ml-2">• Unsaved changes</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* EPUB upload */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={pickAndUploadEpub}
            disabled={isAnyHeaderUploading}
          >
            {isHeaderEpubUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isHeaderEpubUploading ? "Uploading..." : "Upload EPUB"}
          </Button>

          {/* PDF upload */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={pickAndUploadPdf}
            disabled={isAnyHeaderUploading}
          >
            {isHeaderPdfUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isHeaderPdfUploading ? "Uploading..." : "Upload PDF"}
          </Button>

          {/* Linked Products */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowProductLinker(true)}
          >
            <Package className="h-4 w-4" />
            Products
          </Button>

          {/* AI Generate */}
          {aiAuthoringEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleAIClick}
            >
              <Sparkles className="h-4 w-4" />
              AI
            </Button>
          )}

          {/* Book URL */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowUrlDialog(true)}
          >
            <Link2 className="h-4 w-4" />
            URL
          </Button>

          {/* Edit/Preview Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleEditMode}
            className="gap-2"
          >
            {isPreviewMode ? (
              <>
                <Pencil className="h-4 w-4" />
                Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Preview
              </>
            )}
          </Button>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Content with Layout */}
      <div className="flex-1 overflow-auto">
        <LayoutWrapper
          layout={effectiveLayout}
          theme={globalTheme}
          isHomePage={false}
          isEditing={false}
          sidebarTopOffset={64}
          sidebarNavItemsOverride={sidebarConfig?.items}
        >
          <div className="min-h-screen pt-6">
            <BookProvider
              bookData={bookDisplayData}
              authors={allAuthors.filter((a) =>
                bookStore.bookData.authorIds.includes(a.id)
              )}
              categories={allCategories.filter((c) =>
                bookStore.bookData.categoryIds.includes(c.id)
              )}
              isEditMode={!isPreviewMode}
              callbacks={editCallbacks}
              activeModal={activeModal}
              setActiveModal={setActiveModal}
            >
              <TemplateComponent
                onStartReading={() => {
                  toast({
                    title: "Editor Mode",
                    description: "Start reading is disabled in editor mode.",
                  });
                }}
                onUnlock={() => {
                  toast({
                    title: "Editor Mode",
                    description: "Unlock is disabled in editor mode.",
                  });
                }}
                onEpubUpload={async (file) => {
                  await handleEpubUpload(file);
                  return undefined;
                }}
                onPdfUpload={async (file) => {
                  await handlePdfUpload(file);
                  return undefined;
                }}
              />
            </BookProvider>
          </div>
        </LayoutWrapper>
      </div>

      {/* Edit Modals */}
      <BookEditorContainer
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        bookStore={bookStore}
        authors={allAuthors}
        categories={allCategories}
        onThumbnailUpload={handleThumbnailUpload}
      />

      {/* Product Linker Dialog */}
      <Dialog open={showProductLinker} onOpenChange={setShowProductLinker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Linked Products</DialogTitle>
          </DialogHeader>
          <ProductLinker contentType="books" contentId={bookStore.bookData.id || bookId} />
        </DialogContent>
      </Dialog>

      {/* Book URL Dialog */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book URL</DialogTitle>
            <DialogDescription>
              The address of this book on your site. Save URL changes it right
              away. Your other edits still need Save.
            </DialogDescription>
          </DialogHeader>
          <SlugEditor
            basePath="/books/"
            value={currentSlug}
            title={bookStore.bookData.title || ""}
            noun="book"
            onSave={handleSaveSlug}
            disabled={isSaving}
          />
        </DialogContent>
      </Dialog>

      <BookAIGenerateModal
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        bookTitle={bookStore.bookData.title || ""}
        epubUrl={bookStore.bookData.url || undefined}
        onSuccess={handleAISuccess}
        thumbnailContext={{
          authorName: bookStore.bookData.author || undefined,
          language: bookStore.bookData.language?.[0] || undefined,
          organizationName: selectedTenant?.tenant_name || undefined,
        }}
      />
    </div>
  );
}
