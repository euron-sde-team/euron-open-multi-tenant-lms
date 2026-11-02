import type {
  BookFormData,
  BookRecommendationData,
  BookTemplateId,
} from "@open-mtlms/book-templates";
import {
  getDefaultBookFormData,
} from "@open-mtlms/book-templates";
import type { ContentPrice } from "@open-mtlms/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { booksApi, type Book, type CreateBookRequest } from "../api/books";
import { uploadApi } from "../api/upload";
import { legacyToPrices } from "../utils/price-fields";

/** BookFormData extended with the multi-currency price book (admin-only). */
export type BookFormDataWithPrices = BookFormData & { prices?: ContentPrice[] };

// Convert API book response to BookFormData
function apiBookToFormData(apiBook: Book): BookFormDataWithPrices {
  const priceInr = apiBook.priceInr ? parseFloat(apiBook.priceInr) : 0;
  const priceUsd = apiBook.priceUsd ? parseFloat(apiBook.priceUsd) : 0;
  const discountInr = apiBook.discountInr ? parseFloat(apiBook.discountInr) : 0;
  const discountUsd = apiBook.discountUsd ? parseFloat(apiBook.discountUsd) : 0;
  const thumbnailUrl = apiBook.thumbnailUrl || "";
  const lang = apiBook.language || ["English"];

  // Build the object with all required BookFormData fields
  const formData: BookFormDataWithPrices = {
    id: apiBook.id,
    title: apiBook.title,
    slug: apiBook.slug,
    description: apiBook.description || "",
    // New schema fields
    summary: (apiBook as unknown as { summary?: string }).summary || "",
    author: apiBook.author || "",
    language: lang, // string[]
    pages: (apiBook as unknown as { pages?: number }).pages || 0,
    purchaseMode: apiBook.purchaseMode,
    status: apiBook.status,
    priceInr,
    priceUsd,
    discountInr,
    discountUsd,
    thumbnailUrl,
    pageImages: apiBook.pageImages || [],
    sortOrder: apiBook.sortOrder || 0,
    // Legacy fields for backward compatibility
    publishStatus: apiBook.status === "PUBLISHED" ? "PUBLISHED" as const : "NOT_PUBLISHED" as const,
    webPriceINR: priceInr,
    mobilePriceINR: priceInr,
    webPriceUSD: priceUsd,
    mobilePriceUSD: priceUsd,
    webDiscount: discountInr,
    mobileDiscount: discountInr,
    webThumbnailUrl: thumbnailUrl,
    mobileThumbnailUrl: thumbnailUrl,
    previewUrl: apiBook.previewUrl || "",
    url: apiBook.url || "",
    authorIds: apiBook.authorIds || [],
    categoryIds: apiBook.categoryIds || [],
    offerings: [],
    isBought: false,
    rating: (apiBook as { rating?: number | null }).rating != null ? Number((apiBook as { rating?: number | null }).rating) : undefined,
    ratingTotalCount: (apiBook as { ratingTotalCount?: number | null }).ratingTotalCount ?? undefined,
    sampleEnabled: (apiBook as { sampleEnabled?: boolean }).sampleEnabled ?? true,
    samplePages: (apiBook as { samplePages?: number | null }).samplePages ?? 10,
    fileFormat: (apiBook as { fileFormat?: "EPUB" | "PDF" }).fileFormat ?? "EPUB",
    prices: apiBook.prices?.length
      ? apiBook.prices
      : legacyToPrices(apiBook.priceInr, apiBook.priceUsd, apiBook.discountInr, apiBook.discountUsd),
  };

  return formData;
}

// Convert BookFormData to API request format
function formDataToApiRequest(bookData: BookFormDataWithPrices): CreateBookRequest {
  const language = bookData.language;
  const thumbnailUrl = bookData.thumbnailUrl || bookData.webThumbnailUrl || "";
  const priceInr = bookData.priceInr ?? bookData.webPriceINR ?? 0;
  const priceUsd = bookData.priceUsd ?? bookData.webPriceUSD ?? 0;
  const discountInr = bookData.discountInr ?? bookData.webDiscount ?? 0;
  const status = bookData.status ?? (bookData.publishStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
  
  // language is now string[] in BookFormData
  const languageArray = Array.isArray(language) ? language : [language || "English"];
  
  return {
    title: bookData.title,
    slug: bookData.slug,
    author: bookData.author || null,
    description: bookData.description || null,
    summary: bookData.summary || null,
    pages: bookData.pages ?? null,
    url: bookData.url || null,
    page_images: bookData.pageImages || [],
    price_inr: priceInr ? String(priceInr) : null,
    price_usd: priceUsd ? String(priceUsd) : null,
    discount_inr: discountInr ? String(discountInr) : null,
    discount_usd: bookData.discountUsd ? String(bookData.discountUsd) : null,
    prices: bookData.prices,
    purchase_mode: bookData.purchaseMode,
    status: status as "DRAFT" | "PUBLISHED",
    language: languageArray,
    thumbnail_url: thumbnailUrl || null,
    preview_url: bookData.previewUrl || null,
    sort_order: bookData.sortOrder || 0,
    rating: bookData.rating != null ? String(bookData.rating) : null,
    rating_total_count: bookData.ratingTotalCount ?? null,
    sample_enabled: bookData.sampleEnabled ?? true,
    sample_pages: bookData.samplePages ?? 10,
    file_format: bookData.fileFormat ?? "EPUB",
  };
}

// Generate a URL-friendly slug from text
function generateBookSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// History state for undo/redo
interface HistoryState {
  past: BookFormData[];
  future: BookFormData[];
}

// Validation errors
interface ValidationErrors {
  title?: string;
  slug?: string;
  description?: string;
  webThumbnailUrl?: string;
  url?: string;
  [key: string]: string | undefined;
}

// Book Store State
interface BookStoreState {
  // Form data
  bookData: BookFormDataWithPrices;
  
  // Page template (visual design)
  selectedPageTemplate: BookTemplateId;
  
  // History for undo/redo
  history: HistoryState;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isEditMode: boolean;
  
  // Validation
  errors: ValidationErrors;
  isValid: boolean;
}

// Book Store Actions
interface BookStoreActions {
  // Initialize / Reset
  initializeBook: (bookId?: string) => void;
  resetBook: () => void;
  loadBook: (data: BookFormData) => void;
  loadBookFromApi: (apiBook: Book) => void;
  
  // API Operations
  fetchBook: (bookId: string) => Promise<void>;
  saveBook: (tenantId: string) => Promise<string>;
  
  // Page Template (visual design)
  setPageTemplate: (templateId: BookTemplateId) => void;
  
  // Basic Info Updates
  updateBasicInfo: (updates: Partial<BookFormData>) => void;
  updateTitle: (title: string) => void;
  generateSlug: () => void;
  /**
   * Take the slug the server stored (after a URL change or a save). It is not
   * an unsaved edit, so it neither marks the editor dirty nor adds an undo step.
   */
  setSavedSlug: (slug: string) => void;
  
  // Settings Updates
  updateSettings: (updates: Partial<BookFormData>) => void;
  
  // Pricing Updates (new schema-aligned)
  updatePricing: (updates: Partial<BookFormDataWithPrices>) => void;
  
  // Media Updates (new schema-aligned)
  updateMedia: (updates: Partial<BookFormData>) => void;
  
  // Upload methods
  uploadThumbnail: (file: File, tenantId: string, bookId: string | null) => Promise<string>;
  /** Upload an EPUB file directly. Sets bookData.url and fileFormat="EPUB". */
  uploadEpub: (file: File, tenantId: string, bookId: string) => Promise<string>;
  /**
   * Upload a PDF file directly. Sets bookData.url and fileFormat="PDF", plus
   * persists the page count returned by the backend (via pdf-parse).
   */
  uploadPdf: (
    file: File,
    tenantId: string,
    bookId: string,
    onProgress?: (pct: number) => void
  ) => Promise<string>;
  
  // Authors
  addAuthor: (authorId: string) => void;
  removeAuthor: (authorId: string) => void;
  setAuthors: (authorIds: string[]) => void;
  
  // Categories
  addCategory: (categoryId: string) => void;
  removeCategory: (categoryId: string) => void;
  setCategories: (categoryIds: string[]) => void;

  // Recommendations
  addRecommendation: (rec: BookRecommendationData) => void;
  removeRecommendation: (id: string) => void;
  reorderRecommendations: (fromIndex: number, toIndex: number) => void;
  setRecommendations: (recommendations: BookRecommendationData[]) => void;

  // Rating (admin-editable average)
  updateRating: (rating: number, ratingTotalCount?: number) => void;

  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Validation
  validate: () => boolean;
  clearErrors: () => void;
  
  // UI State
  setEditMode: (enabled: boolean) => void;
  toggleEditMode: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setDirty: (dirty: boolean) => void;
  
  // Export/Import
  exportBook: () => string;
  importBook: (json: string) => boolean;
}

export type BookStore = BookStoreState & BookStoreActions;

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      // Initial State
      bookData: getDefaultBookFormData(),
      selectedPageTemplate: "minimal",
      history: {
        past: [],
        future: [],
      },
      isLoading: false,
      isSaving: false,
      isDirty: false,
      isEditMode: true,
      errors: {},
      isValid: true,

      // Initialize / Reset
      initializeBook: (bookId) => {
        if (bookId) {
          // TODO: Fetch book from API
          set({ isLoading: true });
        } else {
          const defaultData = getDefaultBookFormData();
          set({
            bookData: defaultData,
            history: { past: [], future: [] },
            isDirty: false,
            errors: {},
            isValid: true,
          });
        }
      },

      resetBook: () => {
        const defaultData = getDefaultBookFormData();
        set({
          bookData: defaultData,
          history: { past: [], future: [] },
          isDirty: false,
          errors: {},
          isValid: true,
        });
      },

      loadBook: (data) => {
        set({
          bookData: data,
          history: { past: [], future: [] },
          isDirty: false,
          isLoading: false,
        });
      },

      loadBookFromApi: (apiBook) => {
        const formData = apiBookToFormData(apiBook);
        set({
          bookData: formData,
          history: { past: [], future: [] },
          isDirty: false,
          isLoading: false,
        });
      },

      // API Operations
      fetchBook: async (bookId) => {
        set({ isLoading: true });
        try {
          const book = await booksApi.getBook(bookId);
          const formData = apiBookToFormData(book);
          set({
            bookData: formData,
            history: { past: [], future: [] },
            isDirty: false,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      saveBook: async (_tenantId) => {
        const { bookData, validate } = get();
        
        if (!validate()) {
          throw new Error("Validation failed");
        }
        
        set({ isSaving: true });
        
        try {
          const requestData = formDataToApiRequest(bookData);
          
          let savedBook;
          if (bookData.id) {
            // Update existing book
            savedBook = await booksApi.updateBook(bookData.id, requestData);
          } else {
            // Create new book
            savedBook = await booksApi.createBook(requestData);
          }
          
          const formData = apiBookToFormData(savedBook);
          set({
            bookData: formData,
            isDirty: false,
            isSaving: false,
          });
          
          return savedBook.id;
        } catch (error) {
          set({ isSaving: false });
          throw error;
        }
      },

      // Page Template (visual design)
      setPageTemplate: (templateId) => {
        set({ selectedPageTemplate: templateId });
      },

      // Basic Info Updates
      updateBasicInfo: (updates) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            ...updates,
          },
          isDirty: true,
        });
      },

      updateTitle: (title) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        const slug = generateBookSlug(title);
        set({
          bookData: {
            ...bookData,
            title,
            slug,
          },
          isDirty: true,
        });
      },

      generateSlug: () => {
        const { bookData } = get();
        const slug = generateBookSlug(bookData.title);
        set({
          bookData: {
            ...bookData,
            slug,
          },
          isDirty: true,
        });
      },

      setSavedSlug: (slug) => {
        const { bookData, history } = get();
        // The undo snapshots take the slug too, so an undo never brings back
        // the old URL for the next Save to write.
        const withSlug = <T extends BookFormData>(data: T): T => ({ ...data, slug });
        set({
          bookData: withSlug(bookData),
          history: {
            past: history.past.map(withSlug),
            future: history.future.map(withSlug),
          },
        });
      },

      // Settings Updates
      updateSettings: (updates) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            ...updates,
          },
          isDirty: true,
        });
      },

      // Pricing Updates
      updatePricing: (updates) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();

        // Also update legacy fields so templates that read webPriceINR etc. stay in sync
        const updatesWithLegacy = { ...updates } as Record<string, unknown>;
        if (updates.priceInr !== undefined) {
          updatesWithLegacy.webPriceINR = updates.priceInr;
          updatesWithLegacy.mobilePriceINR = updates.priceInr;
        }
        if (updates.priceUsd !== undefined) {
          updatesWithLegacy.webPriceUSD = updates.priceUsd;
          updatesWithLegacy.mobilePriceUSD = updates.priceUsd;
        }
        if (updates.discountInr !== undefined) {
          updatesWithLegacy.webDiscount = updates.discountInr;
          updatesWithLegacy.mobileDiscount = updates.discountInr;
        }

        set({
          bookData: {
            ...bookData,
            ...updatesWithLegacy,
          } as BookFormDataWithPrices,
          isDirty: true,
        });
      },

      // Media Updates
      updateMedia: (updates) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        // Also update legacy fields for backward compatibility
        const updatesWithLegacy = { ...updates } as Record<string, unknown>;
        const typedUpdates = updates as Record<string, unknown>;
        if (typedUpdates.thumbnailUrl !== undefined) {
          updatesWithLegacy.webThumbnailUrl = typedUpdates.thumbnailUrl;
          updatesWithLegacy.mobileThumbnailUrl = typedUpdates.thumbnailUrl;
        }
        
        set({
          bookData: {
            ...bookData,
            ...updatesWithLegacy,
          } as BookFormData,
          isDirty: true,
        });
      },

      // Upload methods
      uploadThumbnail: async (file, tenantId, bookId) => {
        const result = await uploadApi.uploadBookThumbnail(file, {
          type: "book_thumbnail",
          tenantId,
          bookId,
        });
        
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            webThumbnailUrl: result.url,
            mobileThumbnailUrl: result.url,
          },
          isDirty: true,
        });
        
        return result.url;
      },

      uploadEpub: async (file, tenantId, bookId) => {
        const url = await uploadApi.uploadBookEpub(file, {
          tenantId,
          bookId,
        });

        const { saveToHistory, bookData } = get();
        saveToHistory();

        set({
          bookData: {
            ...bookData,
            url,
            fileFormat: "EPUB",
          },
          isDirty: true,
        });

        return url;
      },

      uploadPdf: async (file, tenantId, bookId, onProgress) => {
        const result = await uploadApi.uploadBookPdfMultipart(file, {
          tenantId,
          bookId,
          onProgress,
        });

        const { saveToHistory, bookData } = get();
        saveToHistory();

        set({
          bookData: {
            ...bookData,
            url: result.url,
            fileFormat: "PDF",
            // Only overwrite pages when the backend returned a count, so admins
            // who manually edited the field don't lose their value.
            pages: result.pages ?? bookData.pages,
          },
          isDirty: true,
        });

        return result.url;
      },

      // Authors
      addAuthor: (authorId) => {
        const { saveToHistory, bookData } = get();
        const currentAuthorIds = bookData.authorIds || [];
        if (currentAuthorIds.includes(authorId)) return;
        
        saveToHistory();
        set({
          bookData: {
            ...bookData,
            authorIds: [...currentAuthorIds, authorId],
          },
          isDirty: true,
        });
      },

      removeAuthor: (authorId) => {
        const { saveToHistory, bookData } = get();
        const currentAuthorIds = bookData.authorIds || [];
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            authorIds: currentAuthorIds.filter((id) => id !== authorId),
          },
          isDirty: true,
        });
      },

      setAuthors: (authorIds) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            authorIds,
          },
          isDirty: true,
        });
      },

      // Categories
      addCategory: (categoryId) => {
        const { saveToHistory, bookData } = get();
        const currentCategoryIds = bookData.categoryIds || [];
        if (currentCategoryIds.includes(categoryId)) return;
        
        saveToHistory();
        set({
          bookData: {
            ...bookData,
            categoryIds: [...currentCategoryIds, categoryId],
          },
          isDirty: true,
        });
      },

      removeCategory: (categoryId) => {
        const { saveToHistory, bookData } = get();
        const currentCategoryIds = bookData.categoryIds || [];
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            categoryIds: currentCategoryIds.filter((id) => id !== categoryId),
          },
          isDirty: true,
        });
      },

      setCategories: (categoryIds) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        
        set({
          bookData: {
            ...bookData,
            categoryIds,
          },
          isDirty: true,
        });
      },

      // Recommendations
      addRecommendation: (rec) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        const recs = bookData.recommendations || [];
        if (recs.some((r) => r.bookId === rec.bookId)) return;
        set({
          bookData: {
            ...bookData,
            recommendations: [...recs, { ...rec, sortOrder: recs.length }],
          },
          isDirty: true,
        });
      },

      removeRecommendation: (id) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        const recs = (bookData.recommendations || []).filter((r) => r.id !== id);
        set({
          bookData: {
            ...bookData,
            recommendations: recs.map((r, i) => ({ ...r, sortOrder: i })),
          },
          isDirty: true,
        });
      },

      reorderRecommendations: (fromIndex, toIndex) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        const recs = [...(bookData.recommendations || [])];
        const [removed] = recs.splice(fromIndex, 1);
        recs.splice(toIndex, 0, removed);
        set({
          bookData: {
            ...bookData,
            recommendations: recs.map((r, i) => ({ ...r, sortOrder: i })),
          },
          isDirty: true,
        });
      },

      setRecommendations: (recommendations) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        set({
          bookData: {
            ...bookData,
            recommendations,
          },
          isDirty: true,
        });
      },

      updateRating: (rating, ratingTotalCount) => {
        const { saveToHistory, bookData } = get();
        saveToHistory();
        const clamped = Math.min(5, Math.max(0, Number(rating)));
        const rounded = Math.round(clamped * 10) / 10;
        set({
          bookData: {
            ...bookData,
            rating: rounded,
            ratingTotalCount: ratingTotalCount ?? bookData.ratingTotalCount,
          },
          isDirty: true,
        });
      },

      // History
      saveToHistory: () => {
        const { bookData, history } = get();
        set({
          history: {
            past: [...history.past.slice(-19), bookData],
            future: [],
          },
        });
      },

      undo: () => {
        const { history, bookData } = get();
        if (history.past.length === 0) return;
        
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);
        
        set({
          bookData: previous,
          history: {
            past: newPast,
            future: [bookData, ...history.future],
          },
        });
      },

      redo: () => {
        const { history, bookData } = get();
        if (history.future.length === 0) return;
        
        const next = history.future[0];
        const newFuture = history.future.slice(1);
        
        set({
          bookData: next,
          history: {
            past: [...history.past, bookData],
            future: newFuture,
          },
        });
      },

      // Validation
      validate: () => {
        const { bookData } = get();
        const errors: ValidationErrors = {};
        
        if (!bookData.title?.trim()) {
          errors.title = "Title is required";
        }
        
        if (!bookData.slug?.trim()) {
          errors.slug = "Slug is required";
        }
        
        const isValid = Object.keys(errors).length === 0;
        
        set({ errors, isValid });
        return isValid;
      },

      clearErrors: () => {
        set({ errors: {}, isValid: true });
      },

      // UI State
      setEditMode: (enabled) => {
        set({ isEditMode: enabled });
      },

      toggleEditMode: () => {
        set((state) => ({ isEditMode: !state.isEditMode }));
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setSaving: (saving) => {
        set({ isSaving: saving });
      },

      setDirty: (dirty) => {
        set({ isDirty: dirty });
      },

      // Export/Import
      exportBook: () => {
        const { bookData } = get();
        return JSON.stringify(bookData, null, 2);
      },

      importBook: (json) => {
        try {
          const data = JSON.parse(json) as BookFormData;
          const { saveToHistory } = get();
          saveToHistory();
          
          set({
            bookData: data,
            isDirty: true,
          });
          
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "lms-book-editor-store",
      partialize: (state) => ({
        bookData: state.bookData,
        selectedPageTemplate: state.selectedPageTemplate,
        isEditMode: state.isEditMode,
      }),
    }
  )
);
