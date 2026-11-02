"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { ArrowLeft, ExternalLink, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { assignmentsApi } from "@/lib/api/assignments";
import { useTenantStore } from "@/lib/stores/tenant-store";

// Worker is served locally from public/ (copied from pdfjs-dist, same version as react-pdf).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function SubmissionDetailPage() {
  const { toast } = useToast();
  const params = useParams();
  const id = params?.id as string;
  const submissionId = params?.submissionId as string;
  const { selectedTenantId } = useTenantStore();

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [numPages, setNumPages] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const [submission, setSubmission] = useState<{
    id: string;
    member_name: string;
    member_email: string | null;
    content_type: string;
    text_content: string | null;
    status: string;
    submitted_at: string | null;
    assignment_title: string;
    assignment_max_score: number;
    assignment_passing_score: number | null;
    score: number | null;
    max_score: number | null;
    feedback: string | null;
    evaluated_at: string | null;
    passed: boolean | null;
    pdf_url?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [evalScore, setEvalScore] = useState("");
  const [evalFeedback, setEvalFeedback] = useState("");
  const [allowResubOnFail, setAllowResubOnFail] = useState(true);
  const [resubFeedback, setResubFeedback] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRequestingResub, setIsRequestingResub] = useState(false);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!id || !submissionId || !selectedTenantId) return;
      if (showSpinner) setIsLoading(true);
      try {
        const s = await assignmentsApi.getSubmissionDetail(id, submissionId);
        setSubmission(s);
        setEvalScore(s.score != null ? String(s.score) : "");
        setEvalFeedback(s.feedback || "");
      } catch (err) {
        console.error("Failed to load submission:", err);
        toast({ title: "Error", description: "Submission not found.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [id, submissionId, selectedTenantId, toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const pdfBlobUrlRef = useRef<string | null>(null);

  // Fetch PDF blob URL for in-page viewer (PDF submissions only)
  useEffect(() => {
    if (
      !submission ||
      submission.content_type !== "PDF" ||
      !id ||
      !submissionId ||
      !selectedTenantId
    ) {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
      setPdfBlobUrl(null);
      setPdfLoadError(false);
      return;
    }
    setPdfLoadError(false);
    let cancelled = false;
    assignmentsApi
      .getSubmissionPdfBlobUrl(id, submissionId)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
          pdfBlobUrlRef.current = null;
        }
        if (url) {
          pdfBlobUrlRef.current = url;
          setPdfBlobUrl(url);
        } else {
          setPdfBlobUrl(null);
          setPdfLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPdfBlobUrl(null);
          setPdfLoadError(true);
        }
      });
    return () => {
      cancelled = true;
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
      setPdfBlobUrl(null);
    };
  }, [submission?.id, submission?.content_type, id, submissionId, selectedTenantId]);

  // Resize observer for PDF container
  useEffect(() => {
    if (submission?.content_type !== "PDF" || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect?.width ?? 600;
      setContainerWidth(Math.min(w - 32, 800));
    });
    ro.observe(el);
    setContainerWidth(Math.min(el.clientWidth - 32, 800));
    return () => ro.disconnect();
  }, [submission?.content_type, pdfBlobUrl]);

  const handleEvaluate = async () => {
    if (!id || !submissionId || !submission) return;
    const score = parseInt(evalScore, 10);
    if (isNaN(score) || score < 0) {
      toast({ title: "Error", description: "Enter a valid score (0 or more).", variant: "destructive" });
      return;
    }
    if (score > submission.assignment_max_score) {
      toast({
        title: "Error",
        description: `Score cannot exceed ${submission.assignment_max_score}.`,
        variant: "destructive",
      });
      return;
    }
    setIsEvaluating(true);
    try {
      await assignmentsApi.evaluateSubmission(id, submissionId, {
        score,
        feedback: evalFeedback.trim() || undefined,
        allow_resubmission: allowResubOnFail,
      });
      toast({ title: "Success", description: "Submission evaluated." });
      load(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to evaluate.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRequestResubmission = async () => {
    if (!id || !submissionId) return;
    if (!resubFeedback.trim() || resubFeedback.trim().length < 10) {
      toast({
        title: "Error",
        description: "Feedback must be at least 10 characters.",
        variant: "destructive",
      });
      return;
    }
    setIsRequestingResub(true);
    try {
      await assignmentsApi.requestResubmission(id, submissionId, {
        feedback: resubFeedback.trim(),
      });
      toast({ title: "Success", description: "Resubmission requested." });
      setResubFeedback("");
      load(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to request resubmission.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsRequestingResub(false);
    }
  };

  const canEvaluate =
    submission &&
    (submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" || submission.status === "EVALUATED");
  const canRequestResub =
    submission &&
    (submission.status === "SUBMITTED" ||
      submission.status === "UNDER_REVIEW" ||
      submission.status === "EVALUATED");

  if (isLoading || !submission) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/assignments/${id}/submissions`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{submission.member_name}</h1>
          <p className="text-muted-foreground text-sm">
            {submission.member_email} · {submission.assignment_title}
          </p>
          <div className="mt-2">
            <Badge variant={submission.status === "EVALUATED" ? "default" : "secondary"}>
              {submission.status}
            </Badge>
            {submission.passed !== null && (
              <Badge
                variant={submission.passed ? "default" : "destructive"}
                className="ml-2"
              >
                {submission.passed ? "Passed" : "Failed"}
              </Badge>
            )}
            {submission.submitted_at && (
              <span className="text-muted-foreground ml-2 text-sm">
                Submitted {new Date(submission.submitted_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submission</CardTitle>
            <CardDescription>
              {submission.content_type === "TEXT" ? "Text submission" : "PDF submission"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission.content_type === "TEXT" && submission.text_content && (
              <div className="rounded-md border bg-muted/50 p-4">
                <pre className="whitespace-pre-wrap text-sm">{submission.text_content}</pre>
              </div>
            )}
            {submission.content_type === "PDF" && (
              <div className="space-y-4">
                {pdfBlobUrl ? (
                  <div
                    ref={containerRef}
                    className="flex max-h-[min(70vh,600px)] w-full flex-col items-center overflow-auto rounded-md border bg-muted/30 p-4"
                  >
                    <Document
                      file={pdfBlobUrl}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      loading={
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      }
                      error={
                        <div className="py-8 text-sm text-muted-foreground">
                          Could not load PDF preview.
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
                ) : pdfLoadError ? (
                  <p className="text-muted-foreground py-8 text-sm">
                    PDF not available for preview.
                  </p>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {submission.pdf_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={submission.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open PDF
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluation</CardTitle>
            <CardDescription>
              Score out of {submission.assignment_max_score}.
              {submission.assignment_passing_score != null
                ? ` Passing score is ${submission.assignment_passing_score}.`
                : ""}{" "}
              Add feedback for the student.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEvaluate && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="score">Score</Label>
                  <Input
                    id="score"
                    type="number"
                    min={0}
                    max={submission.assignment_max_score}
                    value={evalScore}
                    onChange={(e) => setEvalScore(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback">Feedback (optional)</Label>
                  <Textarea
                    id="feedback"
                    value={evalFeedback}
                    onChange={(e) => setEvalFeedback(e.target.value)}
                    placeholder="Provide feedback for the student..."
                    rows={4}
                  />
                </div>
                {submission.assignment_passing_score != null && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowResubOnFail}
                      onChange={(e) => setAllowResubOnFail(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Let the student resubmit if they score below the passing mark
                  </label>
                )}
                <Button onClick={handleEvaluate} disabled={isEvaluating}>
                  {isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Evaluation
                </Button>
              </>
            )}
            {submission.status === "EVALUATED" && (
              <div className="text-sm">
                <p>
                  <strong>Score:</strong> {submission.score}/{submission.max_score}
                  {submission.passed !== null && (
                    <span
                      className={
                        submission.passed
                          ? "ml-2 font-medium text-green-600"
                          : "ml-2 font-medium text-destructive"
                      }
                    >
                      {submission.passed ? "Passed" : "Failed"}
                    </span>
                  )}
                </p>
                {submission.feedback && (
                  <p className="mt-2">
                    <strong>Feedback:</strong> {submission.feedback}
                  </p>
                )}
                {submission.evaluated_at && (
                  <p className="text-muted-foreground mt-2">
                    Evaluated {new Date(submission.evaluated_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            {canRequestResub && (
              <div className="border-t pt-4 space-y-2">
                <Label htmlFor="resub-feedback">Request Resubmission</Label>
                <Textarea
                  id="resub-feedback"
                  value={resubFeedback}
                  onChange={(e) => setResubFeedback(e.target.value)}
                  placeholder="Explain what the student needs to fix (min 10 characters)..."
                  rows={3}
                />
                <Button
                  variant="outline"
                  onClick={handleRequestResubmission}
                  disabled={isRequestingResub || resubFeedback.trim().length < 10}
                >
                  {isRequestingResub ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Request Resubmission
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
