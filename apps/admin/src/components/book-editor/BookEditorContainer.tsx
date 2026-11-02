"use client";

import type { BookAuthor, BookCategory } from "@open-mtlms/book-templates";

import type { BookStore } from "@/lib/stores/book-store";

import { AuthorModal } from "./modals/AuthorModal";
import { BookRecommendationModal } from "./modals/BookRecommendationModal";
import { CategoryModal } from "./modals/CategoryModal";
import { DescriptionModal } from "./modals/DescriptionModal";
import { PricingModal } from "./modals/PricingModal";
import { RatingModal } from "./modals/RatingModal";
import { SampleSettingsModal } from "./modals/SampleSettingsModal";
import { ThumbnailModal } from "./modals/ThumbnailModal";

interface BookEditorContainerProps {
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
  bookStore: BookStore;
  authors: BookAuthor[];
  categories: BookCategory[];
  onThumbnailUpload?: (file: File) => Promise<string | undefined>;
}

export function BookEditorContainer({
  activeModal,
  setActiveModal,
  bookStore,
  authors,
  categories,
  onThumbnailUpload,
}: BookEditorContainerProps) {
  return (
    <>
      {/* Book Recommendations Modal */}
      <BookRecommendationModal
        open={activeModal === "recommendations"}
        onOpenChange={(open) => setActiveModal(open ? "recommendations" : null)}
      />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={activeModal === "pricing"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
      />

      {/* Author Modal */}
      <AuthorModal
        isOpen={activeModal === "author"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
        availableAuthors={authors}
      />

      {/* Category Modal */}
      <CategoryModal
        isOpen={activeModal === "category"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
        availableCategories={categories}
      />

      {/* Thumbnail Modal */}
      <ThumbnailModal
        isOpen={activeModal === "thumbnail"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
        onUpload={onThumbnailUpload}
      />

      {/* Description Modal */}
      <DescriptionModal
        isOpen={activeModal === "description"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
      />

      {/* Sample Settings Modal */}
      <SampleSettingsModal
        isOpen={activeModal === "sample"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
      />

      {/* Rating Modal */}
      <RatingModal
        isOpen={activeModal === "rating"}
        onClose={() => setActiveModal(null)}
        bookStore={bookStore}
      />
    </>
  );
}
