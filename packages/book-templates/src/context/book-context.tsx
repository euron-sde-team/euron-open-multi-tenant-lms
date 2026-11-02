"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BookDisplayData, BookEditCallbacks, BookAuthor, BookCategory } from "../types";

/**
 * Context for book data - provides book data to all template components
 */
interface BookDataContextValue {
  bookData: BookDisplayData;
  authors: BookAuthor[];
  categories: BookCategory[];
  /** Base URL for resolving S3 thumbnail keys to display URLs. When set, keys (non-URL values) are resolved as baseUrl + key. */
  thumbnailBaseUrl?: string | null;
  /** Tenant-wide access-managed storefront: hide all pricing and self-serve purchase CTAs. */
  accessManaged: boolean;
  /** Tenant support email for the access-managed "Contact Support" CTA. */
  supportEmail: string | null;
}

const BookDataContext = createContext<BookDataContextValue | null>(null);

/**
 * Context for edit mode - provides edit state and callbacks
 */
interface BookEditContextValue {
  isEditMode: boolean;
  callbacks: BookEditCallbacks;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

const BookEditContext = createContext<BookEditContextValue | null>(null);

/**
 * Provider for book data
 */
interface BookDataProviderProps {
  children: ReactNode;
  bookData: BookDisplayData;
  authors?: BookAuthor[];
  categories?: BookCategory[];
  thumbnailBaseUrl?: string | null;
  /** Tenant-wide access-managed storefront: hide all pricing and self-serve purchase CTAs. */
  accessManaged?: boolean;
  /** Tenant support email for the access-managed "Contact Support" CTA. */
  supportEmail?: string | null;
}

export function BookDataProvider({
  children,
  bookData,
  authors = [],
  categories = [],
  thumbnailBaseUrl,
  accessManaged = false,
  supportEmail = null,
}: BookDataProviderProps) {
  return (
    <BookDataContext.Provider
      value={{ bookData, authors, categories, thumbnailBaseUrl, accessManaged, supportEmail }}
    >
      {children}
    </BookDataContext.Provider>
  );
}

/**
 * Provider for edit mode
 */
interface BookEditProviderProps {
  children: ReactNode;
  isEditMode: boolean;
  callbacks?: BookEditCallbacks;
  activeModal?: string | null;
  setActiveModal?: (modal: string | null) => void;
}

export function BookEditProvider({
  children,
  isEditMode,
  callbacks = {},
  activeModal = null,
  setActiveModal = () => {},
}: BookEditProviderProps) {
  return (
    <BookEditContext.Provider value={{ isEditMode, callbacks, activeModal, setActiveModal }}>
      {children}
    </BookEditContext.Provider>
  );
}

/**
 * Combined provider for both data and edit mode
 */
interface BookProviderProps {
  children: ReactNode;
  bookData: BookDisplayData;
  authors?: BookAuthor[];
  categories?: BookCategory[];
  isEditMode?: boolean;
  callbacks?: BookEditCallbacks;
  activeModal?: string | null;
  setActiveModal?: (modal: string | null) => void;
  /** Base URL for resolving S3 thumbnail keys to display URLs */
  thumbnailBaseUrl?: string | null;
  /** Tenant-wide access-managed storefront: hide all pricing and self-serve purchase CTAs. */
  accessManaged?: boolean;
  /** Tenant support email for the access-managed "Contact Support" CTA. */
  supportEmail?: string | null;
}

export function BookProvider({
  children,
  bookData,
  authors = [],
  categories = [],
  isEditMode = false,
  callbacks = {},
  activeModal = null,
  setActiveModal = () => {},
  thumbnailBaseUrl,
  accessManaged = false,
  supportEmail = null,
}: BookProviderProps) {
  return (
    <BookDataProvider
      bookData={bookData}
      authors={authors}
      categories={categories}
      thumbnailBaseUrl={thumbnailBaseUrl}
      accessManaged={accessManaged}
      supportEmail={supportEmail}
    >
      <BookEditProvider
        isEditMode={isEditMode}
        callbacks={callbacks}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
      >
        {children}
      </BookEditProvider>
    </BookDataProvider>
  );
}

/**
 * Hook to access book data
 */
export function useBookData(): BookDataContextValue {
  const context = useContext(BookDataContext);
  if (!context) {
    throw new Error("useBookData must be used within a BookDataProvider");
  }
  return context;
}

/**
 * Hook to access edit mode state and callbacks
 */
export function useBookEdit(): BookEditContextValue {
  const context = useContext(BookEditContext);
  if (!context) {
    // Return a default read-only context if not in edit mode
    return {
      isEditMode: false,
      callbacks: {},
      activeModal: null,
      setActiveModal: () => {},
    };
  }
  return context;
}

/**
 * Hook to check if edit mode is enabled
 */
export function useIsEditMode(): boolean {
  const context = useContext(BookEditContext);
  return context?.isEditMode ?? false;
}
