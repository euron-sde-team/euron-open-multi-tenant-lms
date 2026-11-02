import type {
  BookAISectionKey,
  GeneratedBookContent,
  BookThumbnailContext,
} from "../services/book-ai.service";

export interface BookAIJobData {
  tenantId: string;
  bookTitle: string;
  sections: BookAISectionKey[];
  epubUrl?: string;
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: BookThumbnailContext;
}

export type SectionStatus = "pending" | "processing" | "completed" | "failed";

export interface SectionProgress {
  status: SectionStatus;
  error?: string;
  result?: Partial<GeneratedBookContent>;
}

export interface BookAIJobProgress {
  status: "processing" | "completed" | "failed";
  currentSection?: BookAISectionKey;
  sections: Partial<Record<BookAISectionKey, SectionProgress>>;
  result: Partial<GeneratedBookContent>;
  completedCount: number;
  totalCount: number;
  error?: string;
}
