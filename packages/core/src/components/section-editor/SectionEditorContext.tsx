"use client";

import type { ContentListingItem, TestimonialScrollItem, TextStyle } from "@open-mtlms/shared";
import React, { createContext, useContext } from "react";

import type { CardPriceParts } from "../cards/price-parts";

// ── Shared prop interfaces for editor components ──

export interface SharedEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  styleKey?: string;
  style?: TextStyle;
  onStyleChange?: (style: TextStyle) => void;
  /**
   * Keep the editor inline with sibling text. Needed wherever a section renders
   * literal text next to the editable value, `{prefix}<EditableText/>{suffix}`
   * in the stat bars, because the admin editor's toolbar wrapper is otherwise
   * block-level and pushes the suffix onto its own line. No-op on the published
   * page, which renders the tag directly with no wrapper.
   */
  inline?: boolean;
}

export interface SharedEditableMediaProps {
  image?: string;
  imageAlt?: string;
  videoUrl?: string;
  onImageChange: (src: string, alt: string) => void;
  onVideoChange: (url: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  placeholder?: string;
  /** When set, locks the aspect ratio selector in the image picker to this value */
  lockedAspectRatio?: string;
  /** Shown as a recommendation note in the upload tab */
  recommendedAspectRatio?: string;
  /** Section context passed to AI for contextual image generation */
  sectionContext?: {
    sectionType?: string;
    headline?: string;
    description?: string;
    badge?: string;
  };
}

export interface SharedEditableImageProps {
  src: string;
  alt: string;
  onChange: (src: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  placeholder?: string;
  /**
   * Render the edit affordance icon-only (no "Change Image" text label) for
   * small thumbnail controls (e.g. the ~40px per-item image editor in gallery
   * sections). Optional; defaults to the full labelled overlay.
   */
  compact?: boolean;
}

export interface SharedLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

// ── Context value ──

export interface SectionEditorContextValue {
  /** Whether the section is in edit mode */
  isEditMode: boolean;
  /** Update section content by section ID */
  updateSectionContent: (
    sectionId: string,
    content: Record<string, unknown>,
  ) => void;
  /** App-specific EditableText component */
  EditableText: React.ComponentType<SharedEditableTextProps>;
  /** App-specific EditableMedia component */
  EditableMedia: React.ComponentType<SharedEditableMediaProps>;
  /** App-specific EditableImage component */
  EditableImage: React.ComponentType<SharedEditableImageProps>;
  /** App-specific Link component (next/link Link or SafeLink) */
  LinkComponent: React.ComponentType<SharedLinkProps>;
  /** Optional: fetch testimonials for sections that need live data */
  fetchTestimonials?: () => Promise<TestimonialScrollItem[]>;
  /** Optional: fetch content items for listing sections (courses, books, bundles, categories) */
  fetchContentItems?: (params: {
    sectionType: string;
    limit: number;
    sortBy?: string;
    sortOrder?: string;
  }) => Promise<ContentListingItem[]>;
  /** Tenant identifier for cache keying (e.g. tenant host). Prevents stale cache when tenant context hydrates. */
  tenantIdentifier?: string;
  /** Read-only tenant branding for editor previews that mirror tenant context
   *  (e.g. the login brand panel's non-editable logo / name / footer). */
  tenantBrand?: { name?: string | null; logoUrl?: string | null };
  /** Optional: navigate to content item detail page (courses, books, bundles, categories) */
  onContentItemClick?: (item: { type: string; slug: string }) => void;
  /** Optional: navigate to LMS for enrolled content (courses → /learn/courses/{slug}, books → /learn/books/{slug}) */
  onContentItemContinue?: (item: { type: string; slug: string }) => void;
  /** Optional: set section visibility (used by API-driven sections to auto-hide when empty) */
  setSectionVisible?: (sectionId: string, visible: boolean) => void;
  /** Optional: toggle cart for a content item (adds if not in cart, removes if already in cart) */
  onCartToggle?: (item: { type: string; id: string; title: string }) => void;
  /** Optional: check if item is in cart */
  isInCart?: (itemId: string) => boolean;
  /** Optional: toggle bookmark for a content item */
  onBookmarkToggle?: (item: { type: string; id: string; title: string; slug: string; thumbnailUrl?: string | null }) => void;
  /** Optional: check if item is bookmarked */
  isBookmarked?: (itemId: string) => boolean;
  /**
   * Optional: resolve an item's multi-currency price display parts under the
   * buyer's currency context. Provided by the web app; absent in the admin
   * editor, where cards fall back to legacy INR/USD math. Return null while
   * the context is loading or for free items.
   */
  resolveItemPriceParts?: (item: ContentListingItem) => CardPriceParts | null;
  /**
   * Optional: submit a contact form (live render only). Provided by the web
   * app; absent in the admin editor (where the form stays a disabled preview).
   */
  onContactSubmit?: (payload: ContactFormSubmitPayload) => Promise<void>;
  /**
   * Optional: prefill values from the logged-in member (live render only).
   * Provided by the web app from the auth store; absent (or null) for
   * logged-out visitors and in the admin editor, so the form stays blank.
   */
  contactPrefill?: ContactPrefill | null;
  /**
   * Optional: the tenant's word for a course (web only), used in an owned
   * course card's label ("Start Course", "Course Completed").
   */
  courseTerm?: string;
}

export interface ContactPrefill {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ContactFormSubmitPayload {
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  fields: Record<string, unknown>;
  source: "PAGE" | "FLOATING";
}

const SectionEditorContext = createContext<SectionEditorContextValue | null>(
  null,
);

// ── Provider ──

export interface SectionEditorProviderProps {
  children: React.ReactNode;
  value: SectionEditorContextValue;
}

export function SectionEditorProvider({
  children,
  value,
}: SectionEditorProviderProps) {
  return (
    <SectionEditorContext.Provider value={value}>
      {children}
    </SectionEditorContext.Provider>
  );
}

// ── Hook ──

export function useSectionEditor(): SectionEditorContextValue {
  const ctx = useContext(SectionEditorContext);
  if (!ctx) {
    throw new Error(
      "useSectionEditor must be used within a SectionEditorProvider. " +
        "Wrap your section renderer with <SectionEditorProvider>.",
    );
  }
  return ctx;
}
