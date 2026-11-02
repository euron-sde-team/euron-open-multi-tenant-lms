import type {
  BatchAISectionKey,
  GeneratedBatchContent,
  BatchThumbnailContext,
} from "../services/batch-ai.service";

export interface BatchAIJobData {
  tenantId: string;
  batchId: string;
  batchTitle: string;
  sections: BatchAISectionKey[];
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: BatchThumbnailContext;
}

export type SectionStatus = "pending" | "processing" | "completed" | "failed";

export interface SectionProgress {
  status: SectionStatus;
  error?: string;
  result?: Partial<GeneratedBatchContent>;
}

export interface BatchAIJobProgress {
  status: "processing" | "completed" | "failed";
  currentSection?: BatchAISectionKey;
  sections: Partial<Record<BatchAISectionKey, SectionProgress>>;
  result: Partial<GeneratedBatchContent>;
  completedCount: number;
  totalCount: number;
  error?: string;
}
