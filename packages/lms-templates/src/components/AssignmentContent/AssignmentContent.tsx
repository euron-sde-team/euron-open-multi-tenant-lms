"use client";

import React, { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileText, Download, Loader2, Upload, Link as LinkIcon } from "lucide-react";
import { cn } from "../../lib/utils";

// Self-hosted pdf.js worker: the host app serves /pdf.worker.min.mjs from its
// public folder (same pdfjs-dist version as react-pdf).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** Extract a lowercased file extension from a (possibly signed) URL, ignoring query string. */
function getUrlExtension(url: string | null | undefined): string {
  if (!url) return "";
  const path = url.split("?")[0];
  const last = path.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  return dot >= 0 ? last.slice(dot + 1).toLowerCase() : "";
}

export interface AssignmentSubmissionInfo {
  id: string;
  content_type: string;
  text_content: string | null;
  status: string;
  submitted_at: string | null;
  evaluation?: {
    score: number;
    max_score: number;
    feedback: string | null;
    evaluated_at: string;
  };
}

export interface AssignmentData {
  id: string;
  title: string;
  instructions: string | null;
  content_type: string;
  max_score: number;
  /** Minimum score to pass; null = no pass/fail. */
  passing_score?: number | null;
  due_date: string | null;
  pdf_url: string | null;
  submission?: AssignmentSubmissionInfo | null;
}

interface AssignmentContentProps {
  assignment: AssignmentData;
  /** Fetches PDF as blob and returns blob URL for same-origin iframe (avoids S3 X-Frame-Options). */
  fetchPdfBlobUrl?: (assignmentId: string) => Promise<string | null>;
  /** Fetches full assignment detail (includes submission). Used to refresh submission status. */
  fetchAssignmentDetail?: (assignmentId: string) => Promise<AssignmentData>;
  /** Submits assignment (PDF file and/or text/link). */
  onSubmitAssignment?: (
    assignmentId: string,
    data: { file?: File; text_content?: string }
  ) => Promise<void>;
  /** Whether user has access (enrolled). Submission only shown when true. */
  hasAccess?: boolean;
  /** Aspect ratio for the container (default: 2.35 for video-like layout) */
  aspectRatio?: number;
  className?: string;
}

export function AssignmentContent({
  assignment,
  fetchPdfBlobUrl,
  fetchAssignmentDetail,
  onSubmitAssignment,
  hasAccess = true,
  aspectRatio = 2.35,
  className,
}: AssignmentContentProps) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [numPages, setNumPages] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [submission, setSubmission] = useState<AssignmentSubmissionInfo | null | undefined>(
    assignment.submission ?? undefined
  );
  // The lesson tree doesn't carry the passing score, so we take it from the
  // full detail fetch (which does) to drive the pass/fail display.
  const [detailPassingScore, setDetailPassingScore] = useState<
    number | null | undefined
  >(assignment.passing_score);
  const [submitMode, setSubmitMode] = useState<"file" | "link">("file");
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentExt = getUrlExtension(assignment.pdf_url);
  // PDFs render inline; everything else (zip, docx, xlsx, pptx, images, source code,
  // etc.) is offered as a download. Fall back to content_type for legacy keys with no ext.
  const isPdf =
    attachmentExt === "pdf" ||
    (attachmentExt === "" && assignment.content_type === "PDF");
  const isPastDue =
    assignment.due_date && new Date(assignment.due_date) < new Date();
  const pdfUrlForViewer = fetchPdfBlobUrl
    ? pdfBlobUrl
    : (assignment.pdf_url?.trim() || null);
  const pdfUrlForDownload = assignment.pdf_url?.trim() || pdfBlobUrl;
  const hasAttachment = !!pdfUrlForDownload;
  const downloadName = `${assignment.title.replace(/[^a-zA-Z0-9-_]/g, "_")}${
    attachmentExt ? `.${attachmentExt}` : ""
  }`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect?.width ?? 600;
      setContainerWidth(Math.min(w - 32, 800));
    });
    ro.observe(el);
    setContainerWidth(Math.min(el.clientWidth - 32, 800));
    return () => ro.disconnect();
  }, [isPdf, pdfUrlForViewer]);

  useEffect(() => {
    if (!isPdf || !assignment.id || !fetchPdfBlobUrl) {
      setPdfBlobUrl(null);
      setPdfError(false);
      return;
    }
    let cancelled = false;
    fetchPdfBlobUrl(assignment.id)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        if (url) {
          blobUrlRef.current = url;
          setPdfBlobUrl(url);
        } else {
          setPdfError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPdfError(true);
      });
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPdfBlobUrl(null);
    };
  }, [assignment.id, isPdf, fetchPdfBlobUrl]);

  useEffect(() => {
    if (!hasAccess || !assignment.id || !fetchAssignmentDetail) return;
    fetchAssignmentDetail(assignment.id)
      .then((d) => {
        setSubmission(d.submission ?? null);
        setDetailPassingScore(d.passing_score ?? null);
      })
      .catch(() => setSubmission(null));
  }, [assignment.id, hasAccess, fetchAssignmentDetail]);

  const handleSubmit = async () => {
    if (!onSubmitAssignment || !assignment.id) return;
    setSubmitError(null);
    if (submitMode === "file" && !submitFile) {
      setSubmitError("Please choose a file to upload.");
      return;
    }
    if (submitMode === "link" && (!submitText.trim() || submitText.trim().length < 10)) {
      setSubmitError("Please enter a link or description (min 10 characters).");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmitAssignment(assignment.id, {
        file: submitMode === "file" ? submitFile ?? undefined : undefined,
        text_content: submitMode === "link" ? submitText.trim() : undefined,
      });
      setSubmitFile(null);
      setSubmitText("");
      if (fetchAssignmentDetail) {
        const d = await fetchAssignmentDetail(assignment.id);
        setSubmission(d.submission ?? null);
        setDetailPassingScore(d.passing_score ?? null);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pass/fail against the assignment's passing score (only once graded). We
  // derive it from the freshest submission so it stays right after a resubmit.
  const passingScore = detailPassingScore ?? assignment.passing_score ?? null;
  const gradedScore = submission?.evaluation?.score ?? null;
  const passed =
    passingScore != null && gradedScore != null
      ? gradedScore >= passingScore
      : null;
  const needsResubmission = submission?.status === "RESUBMISSION_REQUESTED";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border/50 bg-background",
        className
      )}
    >
      {/* PDF viewer, file download card, or placeholder */}
      <div
        className="relative w-full overflow-hidden bg-muted/30"
        style={{ aspectRatio }}
      >
        {isPdf ? (
          <>
            {pdfUrlForViewer ? (
              <div
                ref={containerRef}
                className="flex h-full w-full flex-col items-center overflow-auto bg-muted/30 p-4"
              >
                <Document
                  file={pdfUrlForViewer}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <p>Could not load PDF.</p>
                      {pdfUrlForDownload && (
                        <a
                          href={pdfUrlForDownload}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Open in new tab
                        </a>
                      )}
                    </div>
                  }
                >
                  {Array.from({ length: numPages }, (_, i) => (
                    <Page
                      key={i}
                      pageNumber={i + 1}
                      width={containerWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="mb-4 shadow-md"
                    />
                  ))}
                </Document>
              </div>
            ) : pdfError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="text-sm text-muted-foreground">Could not load PDF.</p>
                {pdfUrlForDownload && (
                  <a
                    href={pdfUrlForDownload}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Open PDF in new tab
                  </a>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            )}
            {/* Download overlay button */}
            {pdfUrlForDownload && (
            <a
              href={pdfUrlForDownload}
              download={downloadName}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-sm font-medium shadow-md transition-colors hover:bg-background"
            >
              <Download className="h-4 w-4" />
              Download Assignment
            </a>
            )}
          </>
        ) : hasAttachment ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted/80 p-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                {assignment.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/80">
                {attachmentExt
                  ? `Attachment (.${attachmentExt})`
                  : "Attachment"}
              </p>
            </div>
            <a
              href={pdfUrlForDownload ?? undefined}
              download={downloadName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download Attachment
            </a>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted/80 p-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-muted-foreground">
                {assignment.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/80">
                {assignment.instructions
                  ? "See instructions below"
                  : "No attachment or instructions available."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions (always show when present) */}
      {assignment.instructions?.trim() && (
        <div className="border-t border-border/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Instructions
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
            {assignment.instructions}
          </div>
          {assignment.due_date && (
            <p className="mt-2 text-xs text-muted-foreground">
              Due: {new Date(assignment.due_date).toLocaleDateString()}
            </p>
          )}
          {assignment.max_score > 0 && (
            <p className="text-xs text-muted-foreground">
              Max score: {assignment.max_score}
            </p>
          )}
        </div>
      )}

      {/* Download button when an inline PDF exists but the instructions block is not shown */}
      {isPdf && !assignment.instructions?.trim() && pdfUrlForDownload && (
        <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
          <div className="text-xs text-muted-foreground">
            {assignment.due_date && (
              <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
            )}
            {assignment.max_score > 0 && (
              <span className={assignment.due_date ? " ml-3" : ""}>
                Max score: {assignment.max_score}
              </span>
            )}
          </div>
          <a
            href={pdfUrlForDownload}
            download={downloadName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Download Assignment
          </a>
        </div>
      )}

      {/* Submission section - only when enrolled and submission API available */}
      {hasAccess && onSubmitAssignment && (
        <div className="border-t border-border/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Submit Assignment
          </h3>
          {submission && submission.status !== "RESUBMISSION_REQUESTED" ? (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
              <p
                className={cn(
                  "font-medium",
                  passed === false
                    ? "text-destructive"
                    : "text-green-600 dark:text-green-400"
                )}
              >
                {submission.evaluation ? "Evaluated" : "Submitted"}
                {passed !== null && (passed ? " · Passed" : " · Failed")}
                {submission.submitted_at &&
                  ` on ${new Date(submission.submitted_at).toLocaleDateString()}`}
              </p>
              {submission.evaluation && (
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    Score: {submission.evaluation.score} / {submission.evaluation.max_score}
                    {passingScore != null && ` (pass mark ${passingScore})`}
                  </p>
                  {submission.evaluation.feedback && (
                    <p className="whitespace-pre-wrap">{submission.evaluation.feedback}</p>
                  )}
                </div>
              )}
            </div>
          ) : isPastDue ? (
            <p className="text-sm text-muted-foreground">
              The due date has passed. Submissions are no longer accepted.
            </p>
          ) : (
            <div className="space-y-3">
              {needsResubmission && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {passed === false
                      ? "You did not reach the passing score. Please resubmit."
                      : "Your instructor has asked you to resubmit."}
                  </p>
                  {submission?.evaluation && (
                    <div className="text-amber-700/90 dark:text-amber-300/90">
                      <p>
                        Previous score: {submission.evaluation.score} /{" "}
                        {submission.evaluation.max_score}
                        {passingScore != null && ` (pass mark ${passingScore})`}
                      </p>
                      {submission.evaluation.feedback && (
                        <p className="whitespace-pre-wrap">
                          {submission.evaluation.feedback}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubmitMode("file")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    submitMode === "file"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitMode("link")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    submitMode === "link"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <LinkIcon className="h-4 w-4" />
                  Link / Text
                </button>
              </div>
              {submitMode === "file" ? (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setSubmitFile(f ?? null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
                  >
                    {submitFile ? (
                      <span className="font-medium text-foreground">{submitFile.name}</span>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Choose file (max 10MB)
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <textarea
                  placeholder="Paste your assignment link (Google Drive, Dropbox, etc.) or write your response (min 10 characters)"
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              {submitError && (
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (submitMode === "file" && !submitFile) ||
                  (submitMode === "link" && submitText.trim().length < 10)
                }
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Assignment"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AssignmentContent;
