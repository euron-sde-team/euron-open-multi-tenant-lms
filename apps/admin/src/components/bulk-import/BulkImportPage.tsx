"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  useBulkImport,
  useBulkImportJob,
  useDownloadReport,
  useDownloadSample,
} from "../../lib/hooks/use-bulk-imports";
import type {
  BulkImportScope,
  ImportSummary,
  PerRowReportEntry,
} from "../../lib/types/bulk-imports";

interface CourseOptionsValue {
  validTill: string;
  batchId: string | null;
}

interface BookOptionsValue {
  validTill: string;
}

interface AvailableBatch {
  id: string;
  title: string;
}

export interface BulkImportPageProps {
  scope: "TENANT" | "COURSE" | "BOOK";
  courseId?: string;
  bookId?: string;
  contextTitle: string;
  contextSubtitle?: string;
  /** Live batches available for LIVE/HYBRID courses. Pass [] to hide the dropdown. */
  availableBatches?: AvailableBatch[];
}

function defaultValidTill(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function BulkImportPage(props: BulkImportPageProps) {
  const { toast } = useToast();
  // valid_till (per-learner expiry) only applies when the import grants access.
  // The plain member import (TENANT scope) grants nothing, so it hides validity.
  const showValidity = props.scope !== "TENANT";
  const [file, setFile] = useState<File | null>(null);
  const [courseOptions, setCourseOptions] = useState<CourseOptionsValue>({
    validTill: defaultValidTill(),
    batchId: null,
  });
  const [bookOptions, setBookOptions] = useState<BookOptionsValue>({
    validTill: defaultValidTill(),
  });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [polledJobId, setPolledJobId] = useState<string | null>(null);

  const downloadSample = useDownloadSample();
  const downloadReport = useDownloadReport();
  const runImport = useBulkImport();
  const jobQuery = useBulkImportJob(polledJobId, !!polledJobId);

  const scope = useMemo<BulkImportScope>(() => {
    if (props.scope === "TENANT") return { type: "TENANT" };
    if (props.scope === "COURSE") {
      return {
        type: "COURSE",
        courseId: props.courseId as string,
        batchId: courseOptions.batchId,
        validTill: courseOptions.validTill
          ? new Date(courseOptions.validTill).toISOString()
          : null,
      };
    }
    return {
      type: "BOOK",
      bookId: props.bookId as string,
      validTill: bookOptions.validTill
        ? new Date(bookOptions.validTill).toISOString()
        : null,
    };
  }, [props.scope, props.courseId, props.bookId, courseOptions, bookOptions]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleRun = useCallback(
    async (dryRun: boolean) => {
      if (!file) {
        toast({
          title: "Choose a file first",
          description: "Drop a CSV or XLSX file before running.",
          variant: "destructive",
        });
        return;
      }
      try {
        const result = await runImport.mutateAsync({ scope, file, dryRun });
        setSummary(result);
        if (result.asyncStatus === "QUEUED" && result.jobId) {
          setPolledJobId(result.jobId);
        }
        toast({
          title: dryRun ? "Dry run complete" : "Import processed",
          description:
            result.syncResult !== null
              ? `${result.syncResult.totalRows} rows processed.`
              : `Job queued. Job id: ${result.jobId}.`,
        });
      } catch (err) {
        toast({
          title: "Import failed",
          description:
            err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [file, runImport, scope, toast],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk import
          </CardTitle>
          <div className="space-y-1 pt-1">
            <p className="font-medium">{props.contextTitle}</p>
            {props.contextSubtitle && (
              <p className="text-sm text-muted-foreground">{props.contextSubtitle}</p>
            )}
          </div>
        </CardHeader>
      </Card>

      {(props.scope === "COURSE" || props.scope === "BOOK") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="valid-till">Access valid till</Label>
              <Input
                id="valid-till"
                type="date"
                value={
                  props.scope === "COURSE"
                    ? courseOptions.validTill
                    : bookOptions.validTill
                }
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  if (props.scope === "COURSE") {
                    setCourseOptions((s) => ({ ...s, validTill: e.target.value }));
                  } else {
                    setBookOptions((s) => ({ ...s, validTill: e.target.value }));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Existing active grants are never shortened; this date applies only to new and
                reactivated grants.
              </p>
            </div>

            {props.scope === "COURSE" &&
              props.availableBatches &&
              props.availableBatches.length > 0 && (
                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Also enroll in batch (optional)</Label>
                  <Select
                    value={courseOptions.batchId ?? "none"}
                    onValueChange={(v) =>
                      setCourseOptions((s) => ({
                        ...s,
                        batchId: v === "none" ? null : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Course access only</SelectItem>
                      {props.availableBatches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" /> Before you upload
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Follow the <strong>sample CSV / XLSX format strictly</strong>. Download a
                sample below if you haven&apos;t already.
              </li>
              {showValidity ? (
                <>
                  <li>
                    Columns are <code className="font-mono text-xs">name</code>,{" "}
                    <code className="font-mono text-xs">email</code>,{" "}
                    <code className="font-mono text-xs">phone</code>, and an optional{" "}
                    <code className="font-mono text-xs">valid_till</code> column. Headers are
                    case-insensitive but their meaning must match.
                  </li>
                  <li>
                    <code className="font-mono text-xs">valid_till</code> sets a{" "}
                    <strong>per-learner access expiry</strong> and is optional. Use a date in{" "}
                    <code className="font-mono text-xs">YYYY-MM-DD</code> format (for example{" "}
                    <code className="font-mono text-xs">2027-08-11</code>), or the word{" "}
                    <code className="font-mono text-xs">lifetime</code> for access that never
                    expires. Leave it blank to use the{" "}
                    <strong>Access valid till</strong> default above.
                  </li>
                </>
              ) : (
                <li>
                  Columns must be exactly <code className="font-mono text-xs">name</code>,{" "}
                  <code className="font-mono text-xs">email</code>, and{" "}
                  <code className="font-mono text-xs">phone</code>. Headers are
                  case-insensitive but their meaning must match.
                </li>
              )}
              <li>
                Every row must include either an <strong>email</strong> or a{" "}
                <strong>phone</strong> (or both). <em>Name is optional.</em>
              </li>
              <li>
                Phone numbers <strong>must be in E.164 format</strong>: a leading{" "}
                <code className="font-mono text-xs">+</code> followed by the country code
                and the national number, digits only. Examples:{" "}
                <code className="font-mono text-xs">+919876543210</code> (India),{" "}
                <code className="font-mono text-xs">+14155550101</code> (US). A 10-digit
                local number without a country code will be rejected.
              </li>
              <li>
                Double-check each row before uploading. Verify spelling of emails, presence
                of the leading <code className="font-mono text-xs">+</code> on phones, and
                that the rows belong to the correct people.
              </li>
              <li>
                Use the <strong>Dry run</strong> button first to preview exactly what will
                happen for each row without writing anything to the database.
              </li>
            </ul>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm">
              Drop a <strong>.csv</strong> or <strong>.xlsx</strong> file, or
            </p>
            <label className="cursor-pointer text-sm font-medium underline">
              choose from your computer
              <input
                type="file"
                className="sr-only"
                accept=".csv,.xlsx"
                onChange={onFilePick}
              />
            </label>
            {file && (
              <p className="mt-2 text-sm text-muted-foreground">
                Selected: <span className="font-mono">{file.name}</span> (
                {Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSample.mutate({ format: "csv", withValidity: showValidity })}
              disabled={downloadSample.isPending}
            >
              <Download className="mr-2 h-4 w-4" /> Sample CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSample.mutate({ format: "xlsx", withValidity: showValidity })}
              disabled={downloadSample.isPending}
            >
              <Download className="mr-2 h-4 w-4" /> Sample XLSX
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => handleRun(true)}
              disabled={runImport.isPending || !file}
            >
              {runImport.isPending && runImport.variables?.dryRun ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Dry run
            </Button>
            <Button
              onClick={() => handleRun(false)}
              disabled={runImport.isPending || !file}
            >
              {runImport.isPending && !runImport.variables?.dryRun ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm and import
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary?.syncResult && (
        <SyncResultPanel
          totalRows={summary.syncResult.totalRows}
          counters={summary.syncResult.counters}
          rows={summary.syncResult.perRow}
          showValidity={showValidity}
        />
      )}

      {summary?.asyncStatus === "QUEUED" && polledJobId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing in background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Large file detected. The import is processing in the background. This page polls
              every 2 seconds for status.
            </p>
            {jobQuery.data ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge>{jobQuery.data.status}</Badge>
                  <span className="text-sm">
                    {jobQuery.data.total_rows} rows total
                  </span>
                </div>
                {jobQuery.data.status === "COMPLETED" && (
                  <Button
                    size="sm"
                    onClick={() => downloadReport.mutate(jobQuery.data.id)}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download per-row report
                  </Button>
                )}
                {jobQuery.data.status === "FAILED" && (
                  <p className="text-sm text-destructive">
                    {jobQuery.data.failure_reason ?? "Job failed"}
                  </p>
                )}
              </div>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SyncResultPanel(props: {
  totalRows: number;
  counters: {
    createdCount: number;
    mergedCount: number;
    grantedCount: number;
    skippedCount: number;
    errorCount: number;
  };
  rows: PerRowReportEntry[];
  showValidity: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Result ({props.totalRows} rows)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Counter label="Created" value={props.counters.createdCount} tone="ok" />
          <Counter label="Merged" value={props.counters.mergedCount} tone="ok" />
          <Counter label="Granted" value={props.counters.grantedCount} tone="ok" />
          <Counter label="Skipped" value={props.counters.skippedCount} tone="warn" />
          <Counter label="Errors" value={props.counters.errorCount} tone="error" />
        </div>
        <div className="max-h-96 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Member</th>
                <th className="px-2 py-2">Course</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Book</th>
                {props.showValidity && <th className="px-2 py-2">Valid till</th>}
                <th className="px-2 py-2">Status@grant</th>
                <th className="px-2 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r) => (
                <tr key={r.rowNumber} className="border-t">
                  <td className="px-2 py-1 font-mono">{r.rowNumber}</td>
                  <td className="px-2 py-1">{r.name ?? ""}</td>
                  <td className="px-2 py-1">{r.email ?? ""}</td>
                  <td className="px-2 py-1">{r.phone ?? ""}</td>
                  <td className="px-2 py-1">
                    <ActionPill action={r.memberAction} />
                  </td>
                  <td className="px-2 py-1">{r.courseAction ?? ""}</td>
                  <td className="px-2 py-1">{r.batchAction ?? ""}</td>
                  <td className="px-2 py-1">{r.bookAction ?? ""}</td>
                  {props.showValidity && (
                    <td className="px-2 py-1">
                      {r.rowValidTill === null
                        ? "Default"
                        : r.rowValidTill === "LIFETIME"
                          ? "Lifetime"
                          : r.rowValidTill}
                    </td>
                  )}
                  <td className="px-2 py-1">{r.memberStatusAtGrant.join(",")}</td>
                  <td className="px-2 py-1 text-destructive">{r.errorMessage ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Counter(props: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "error";
}) {
  const Icon =
    props.tone === "ok"
      ? CheckCircle2
      : props.tone === "warn"
        ? AlertTriangle
        : XCircle;
  const color =
    props.tone === "ok"
      ? "text-emerald-600"
      : props.tone === "warn"
        ? "text-amber-600"
        : "text-destructive";
  return (
    <div className="rounded border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-4 w-4 ${color}`} /> {props.label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{props.value}</div>
    </div>
  );
}

function ActionPill(props: { action: PerRowReportEntry["memberAction"] }) {
  const tone = props.action.startsWith("ERROR_")
    ? "destructive"
    : props.action === "CREATED" || props.action.startsWith("MERGED_")
      ? "default"
      : "secondary";
  return <Badge variant={tone as "default" | "secondary" | "destructive"}>{props.action}</Badge>;
}
