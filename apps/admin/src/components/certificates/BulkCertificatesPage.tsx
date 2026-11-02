"use client";

import {
  CERTIFICATE_PAGE_DIMENSIONS,
  CertificateRenderer,
  ConfigCertificateRenderer,
  useCertificateFonts,
  type CertificateData,
  type CertificateDesign,
} from "@open-mtlms/certificate-templates";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  Award,
  Check,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Loader2,
  Mail,
  MailCheck,
  Send,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import generatePDF, { Margin, Resolution } from "react-to-pdf";
import type { Options } from "react-to-pdf";

import type {
  BulkCertBatchDetail,
  BulkCertItem,
  RecipientSource,
} from "@/lib/api/bulk-certificates";
import type { CertificateTemplateRow } from "@/lib/api/certificate-designer";
import type { CertificateTemplateInfo } from "@/lib/api/certificate-templates";
import { rowToDesign } from "@/lib/certificate-design";
import {
  useBulkCertBatchDetail,
  useBulkCertBatches,
  useCreateBulkCertBatch,
  useCreateBulkCertFromSource,
  useDeleteBulkCertBatch,
  useDownloadCertSample,
  useResolveCertRecipients,
  useSendBulkCertBatch,
} from "@/lib/hooks/use-bulk-certificates";
import { useCertificateDesigns } from "@/lib/hooks/use-certificate-designer";
import { useCertificateTemplates } from "@/lib/hooks/use-certificate-templates";
import { useCourses } from "@/lib/hooks/use-courses";
import { useInfiniteBooks } from "@/lib/hooks/use-infinite-books";
import { useTenantStore } from "@/lib/stores/tenant-store";

const CERT_WIDTH = 1122;
const CERT_HEIGHT = 793;

const PDF_RENDER_ID = "bulk-cert-pdf-render";

const pdfOptions: Options = {
  resolution: Resolution.HIGH,
  page: {
    margin: Margin.NONE,
    format: [297, 210],
    orientation: "landscape",
  },
};

/** Canvas size of a custom design (stock templates are 1122x793). */
function designDims(design: CertificateDesign | null): { width: number; height: number } {
  if (!design) return { width: CERT_WIDTH, height: CERT_HEIGHT };
  return (
    CERTIFICATE_PAGE_DIMENSIONS[design.page.size]?.[design.page.orientation] ?? {
      width: CERT_WIDTH,
      height: CERT_HEIGHT,
    }
  );
}

/** PDF page for a custom design: its own size and orientation. */
function pdfOptionsFor(design: CertificateDesign | null): Options {
  if (!design) return pdfOptions;
  const landscape = design.page.orientation !== "PORTRAIT";
  const [short, long] = design.page.size === "LETTER" ? [215.9, 279.4] : [210, 297];
  return {
    ...pdfOptions,
    page: {
      ...pdfOptions.page,
      format: landscape ? [long, short] : [short, long],
      orientation: landscape ? "landscape" : "portrait",
    },
  };
}

const LOGO_FETCH_TIMEOUT_MS = 8_000;

/**
 * Load a logo URL as a base64 data URL so html2canvas can embed it in the PDF.
 * Resolves `null` on any failure (CORS, timeout, decode error), the caller
 * then blanks that image so the canvas stays untainted and the PDF still
 * generates, just without that one logo bitmap.
 */
function loadLogoAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), LOGO_FETCH_TIMEOUT_MS);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0);
        finish(canvas.toDataURL("image/png"));
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}

function toCertData(
  item: BulkCertItem,
  detail: BulkCertBatchDetail,
): CertificateData {
  return {
    certificateNumber: item.certificateNumber,
    courseTitle: detail.batch.title,
    firstName: item.recipientName,
    lastName: "",
    formattedIssuedAt: item.formattedIssuedAt,
    directorName: detail.directorName,
    directorTitle: detail.directorTitle,
    logoUrl: detail.logoUrl || undefined,
    verifyUrl: item.verifyUrl,
    // Custom designs can show the organization name.
    tenantName: detail.tenantName,
  };
}

function buildPreviewData(
  templateId: string,
  title: string,
  signatoryName: string,
  signatoryTitle: string,
): CertificateData {
  return {
    certificateNumber: "CERT-XXXX-XXXX-XXXX",
    courseTitle: title.trim() || "Program Title",
    firstName: "Recipient Name",
    lastName: "",
    formattedIssuedAt: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    directorName: signatoryName.trim() || "Authorized Signatory",
    directorTitle: signatoryTitle.trim() || "Director",
    verifyUrl: `https://example.com/certificate/CERT-XXXX-XXXX-XXXX`,
    _templateIdForPreview: templateId,
  } as CertificateData & { _templateIdForPreview: string };
}

/**
 * Renders a native-size (1122x793) certificate scaled down with a CSS transform,
 * so the thumbnail is pixel-identical to the recipient-facing certificate.
 */
function ScaledCertificate({
  templateId,
  data,
  scale,
}: {
  templateId: string;
  data: CertificateData;
  scale: number;
}) {
  return (
    <div
      className="relative"
      style={{ width: CERT_WIDTH * scale, height: CERT_HEIGHT * scale }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: CERT_WIDTH,
          height: CERT_HEIGHT,
        }}
      >
        <CertificateRenderer templateId={templateId} data={data} />
      </div>
    </div>
  );
}

/** A custom design scaled to `width`, pixel identical to the issued one. */
function ScaledDesignCertificate({
  design,
  data,
  width,
}: {
  design: CertificateDesign;
  data: CertificateData;
  width: number;
}) {
  const dims = designDims(design);
  const scale = width / dims.width;
  return (
    <div className="relative" style={{ width: dims.width * scale, height: dims.height * scale }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: dims.width,
          height: dims.height,
        }}
      >
        <ConfigCertificateRenderer design={design} data={data} />
      </div>
    </div>
  );
}

/** The academy's own designs (Settings > Certificates > Designer). */
function DesignPicker({
  designs,
  selectedId,
  onSelect,
  previewData,
}: {
  designs: CertificateTemplateRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  previewData: CertificateData;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {designs.map((row) => {
        const isSelected = selectedId === row.id;
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className={`relative flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 text-left transition-all ${
              isSelected
                ? "border-primary ring-primary/20 ring-2"
                : "border-border hover:border-primary/40"
            }`}
          >
            {isSelected && (
              <div className="bg-primary absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <div className="flex justify-center overflow-hidden bg-white">
              <ScaledDesignCertificate design={rowToDesign(row)} data={previewData} width={200} />
            </div>
            <div className="border-t px-2 py-1.5">
              <p className="truncate text-xs font-medium">{row.name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  previewData,
}: {
  templates: CertificateTemplateInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  previewData: CertificateData;
}) {
  const thumbWidth = 200;
  const scale = thumbWidth / CERT_WIDTH;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {templates.map((template) => {
        const isSelected = selectedId === template.id;
        const disabled = !template.available;
        return (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(template.id)}
            className={`relative flex flex-col overflow-hidden rounded-lg border-2 text-left transition-all ${
              isSelected
                ? "border-primary ring-primary/20 ring-2"
                : "border-border hover:border-primary/40"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            {isSelected && (
              <div className="bg-primary absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <div className="aspect-[297/210] overflow-hidden bg-white">
              <ScaledCertificate
                templateId={template.id}
                data={previewData}
                scale={scale}
              />
            </div>
            <div className="border-t px-2 py-1.5">
              <p className="truncate text-xs font-medium">{template.name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const SELECT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const SOURCE_TYPES = [
  { key: "course", label: "Course enrollees", icon: Award },
  { key: "book", label: "Book buyers", icon: FileSpreadsheet },
  { key: "emails", label: "Paste emails", icon: Mail },
] as const;

/**
 * Pick a recipient source, a content audience or a pasted email list, and
 * generate certificates for everyone in it (auto-mapped to learner accounts by
 * email). Mirrors the spreadsheet flow but without a file.
 */
function GroupRecipientPicker({
  onGenerate,
  generating,
}: {
  onGenerate: (source: RecipientSource) => void;
  generating: boolean;
}) {
  const { toast } = useToast();
  const tenantId = useTenantStore((s) => s.selectedTenantId);
  const resolve = useResolveCertRecipients();

  const [sourceType, setSourceType] =
    useState<(typeof SOURCE_TYPES)[number]["key"]>("course");
  const [courseId, setCourseId] = useState("");
  const [bookId, setBookId] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [preview, setPreview] = useState<number | null>(null);

  const { data: coursesData } = useCourses(tenantId ?? undefined, 1, 100);
  const { data: booksData } = useInfiniteBooks(tenantId ?? null, "all");

  const courses = coursesData?.courses ?? [];
  const books = useMemo(
    () => booksData?.pages.flatMap((p) => p.books) ?? [],
    [booksData],
  );

  const buildSource = useCallback((): RecipientSource | null => {
    if (sourceType === "course")
      return courseId ? { type: "course", id: courseId } : null;
    if (sourceType === "book")
      return bookId ? { type: "book", id: bookId } : null;
    const contacts = emailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ name: email, email }));
    return contacts.length ? { type: "emails", contacts } : null;
  }, [sourceType, courseId, bookId, emailsText]);

  const hasSelection = buildSource() !== null;

  // Clear a stale preview whenever the selection changes.
  useEffect(() => {
    setPreview(null);
  }, [sourceType, courseId, bookId, emailsText]);

  const handlePreview = useCallback(async () => {
    const source = buildSource();
    if (!source) return;
    try {
      const res = await resolve.mutateAsync(source);
      setPreview(res.count);
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [buildSource, resolve, toast]);

  const handleGenerate = useCallback(() => {
    const source = buildSource();
    if (!source) {
      toast({
        title: "Select recipients",
        description: "Choose a source or paste at least one email.",
        variant: "destructive",
      });
      return;
    }
    onGenerate(source);
  }, [buildSource, onGenerate, toast]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOURCE_TYPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSourceType(s.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
              sourceType === s.key
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40",
            )}
          >
            <s.icon className="h-4 w-4 shrink-0" /> {s.label}
          </button>
        ))}
      </div>

      {sourceType === "course" && (
        <select
          className={SELECT_CLASS}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}
      {sourceType === "book" && (
        <select
          className={SELECT_CLASS}
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
        >
          <option value="">Select a book…</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      )}
      {sourceType === "emails" && (
        <textarea
          className={cn(SELECT_CLASS, "min-h-[120px] resize-y")}
          placeholder="Paste emails, one per line, or comma separated"
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={!hasSelection || resolve.isPending}
        >
          {resolve.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Users className="mr-2 h-4 w-4" />
          )}
          Preview recipients
        </Button>
        {preview !== null && (
          <span className="text-muted-foreground text-sm">
            {preview} recipient{preview === 1 ? "" : "s"} with an email
          </span>
        )}
        <div className="flex-1" />
        <Button onClick={handleGenerate} disabled={!hasSelection || generating}>
          {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate certificates
        </Button>
      </div>
    </div>
  );
}

function CreateBatchForm({
  onCreated,
}: {
  onCreated: (batchId: string) => void;
}) {
  const { toast } = useToast();
  const { data: templatesData, isLoading: templatesLoading } =
    useCertificateTemplates();
  const downloadSample = useDownloadCertSample();
  const createBatch = useCreateBulkCertBatch();
  const createFromSource = useCreateBulkCertFromSource();

  const [mode, setMode] = useState<"upload" | "group">("upload");
  const [title, setTitle] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryTitle, setSignatoryTitle] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  // One of the academy's custom designs; takes the place of a stock template.
  const [designId, setDesignId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const { data: designsData } = useCertificateDesigns();
  const designs = useMemo(() => designsData ?? [], [designsData]);
  const tenantName = useTenantStore((s) => s.selectedTenant?.tenant_name);

  const templates = useMemo(
    () => templatesData?.templates ?? [],
    [templatesData?.templates],
  );

  const effectiveTemplateId = templateId ?? templates[0]?.id ?? null;

  const previewData = useMemo(
    () =>
      buildPreviewData(
        effectiveTemplateId ?? "",
        title,
        signatoryName,
        signatoryTitle,
      ),
    [effectiveTemplateId, title, signatoryName, signatoryTitle],
  );

  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Enter a program or certificate title.",
        variant: "destructive",
      });
      return;
    }
    if (!designId && !effectiveTemplateId) {
      toast({
        title: "Template required",
        description: "Select a certificate template.",
        variant: "destructive",
      });
      return;
    }
    if (!file) {
      toast({
        title: "File required",
        description: "Upload a CSV or XLSX of recipients.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await createBatch.mutateAsync({
        file,
        title: title.trim(),
        templateId: designId ? null : effectiveTemplateId,
        certificateTemplateId: designId,
        signatoryName: signatoryName.trim() || null,
        signatoryTitle: signatoryTitle.trim() || null,
      });
      toast({
        title: "Certificates generated",
        description: `${result.items.length} certificate${
          result.items.length === 1 ? "" : "s"
        } created.`,
      });
      onCreated(result.batch.id);
    } catch (err) {
      toast({
        title: "Could not generate certificates",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [
    title,
    effectiveTemplateId,
    designId,
    file,
    signatoryName,
    signatoryTitle,
    createBatch,
    onCreated,
    toast,
  ]);

  const handleGenerateFromSource = useCallback(
    async (source: RecipientSource) => {
      if (!title.trim()) {
        toast({
          title: "Title required",
          description: "Enter a program or certificate title.",
          variant: "destructive",
        });
        return;
      }
      if (!designId && !effectiveTemplateId) {
        toast({
          title: "Template required",
          description: "Select a certificate template.",
          variant: "destructive",
        });
        return;
      }
      try {
        const result = await createFromSource.mutateAsync({
          title: title.trim(),
          templateId: designId ? null : effectiveTemplateId,
          certificateTemplateId: designId,
          signatoryName: signatoryName.trim() || null,
          signatoryTitle: signatoryTitle.trim() || null,
          source,
        });
        toast({
          title: "Certificates generated",
          description: `${result.items.length} certificate${
            result.items.length === 1 ? "" : "s"
          } created.`,
        });
        onCreated(result.batch.id);
      } catch (err) {
        toast({
          title: "Could not generate certificates",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [
      title,
      effectiveTemplateId,
      designId,
      signatoryName,
      signatoryTitle,
      createFromSource,
      onCreated,
      toast,
    ],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificate details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="cert-title">Program title *</Label>
            <Input
              id="cert-title"
              placeholder="e.g. Full Stack Web Development"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Printed on every certificate in this batch.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signatory-name">Signatory name</Label>
            <Input
              id="signatory-name"
              placeholder="Defaults to your organization founder"
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signatory-title">Signatory title</Label>
            <Input
              id="signatory-title"
              placeholder="e.g. Director"
              value={signatoryTitle}
              onChange={(e) => setSignatoryTitle(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a template</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {designs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Your designs
                  </p>
                  <DesignPicker
                    designs={designs}
                    selectedId={designId}
                    onSelect={(id) => {
                      setDesignId(id);
                      setTemplateId(null);
                    }}
                    previewData={{ ...previewData, tenantName }}
                  />
                </div>
              )}
              <div className="space-y-2">
                {designs.length > 0 && (
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Templates
                  </p>
                )}
                <TemplatePicker
                  templates={templates}
                  selectedId={designId ? null : effectiveTemplateId}
                  onSelect={(id) => {
                    setTemplateId(id);
                    setDesignId(null);
                  }}
                  previewData={previewData}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                mode === "upload"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <Upload className="h-4 w-4" /> Upload spreadsheet
            </button>
            <button
              type="button"
              onClick={() => setMode("group")}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                mode === "group"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <Users className="h-4 w-4" /> From a group
            </button>
          </div>

          {mode === "group" ? (
            <GroupRecipientPicker
              onGenerate={handleGenerateFromSource}
              generating={createFromSource.isPending}
            />
          ) : (
            <>
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" /> File format
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Columns:{" "}
                <code className="font-mono text-xs">name</code>,{" "}
                <code className="font-mono text-xs">issue_date</code>,{" "}
                <code className="font-mono text-xs">email</code>.
              </li>
              <li>
                <strong>name</strong> is required.{" "}
                <strong>issue_date</strong> and <strong>email</strong> are
                optional. Add <strong>email</strong> to deliver the certificate
                and link it to the learner&apos;s account.
              </li>
              <li>
                Dates accept formats like{" "}
                <code className="font-mono text-xs">2026-01-15</code> or{" "}
                <code className="font-mono text-xs">15/01/2026</code>.
              </li>
            </ul>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center"
          >
            <Upload className="text-muted-foreground h-8 w-8" />
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
              <p className="text-muted-foreground mt-2 text-sm">
                Selected: <span className="font-mono">{file.name}</span> (
                {Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSample.mutate("csv")}
              disabled={downloadSample.isPending}
            >
              <Download className="mr-2 h-4 w-4" /> Sample CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSample.mutate("xlsx")}
              disabled={downloadSample.isPending}
            >
              <Download className="mr-2 h-4 w-4" /> Sample XLSX
            </Button>
            <div className="flex-1" />
            <Button
              onClick={handleSubmit}
              disabled={createBatch.isPending || !file || !title.trim()}
            >
              {createBatch.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate certificates
            </Button>
          </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BatchList({
  onOpen,
}: {
  onOpen: (batchId: string) => void;
}) {
  const { toast } = useToast();
  const { data, isLoading } = useBulkCertBatches();
  const deleteBatch = useDeleteBulkCertBatch();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const batches = data?.batches ?? [];

  const handleDelete = useCallback(
    async (batchId: string) => {
      try {
        await deleteBatch.mutateAsync(batchId);
        toast({ title: "Batch deleted" });
      } catch (err) {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setConfirmId(null);
      }
    },
    [deleteBatch, toast],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Award className="text-muted-foreground h-10 w-10" />
          <p className="text-sm font-medium">No certificate batches yet</p>
          <p className="text-muted-foreground text-sm">
            Create a batch to issue certificates to your recipients.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(b.id)}
                      className="hover:text-primary text-left font-medium hover:underline"
                    >
                      {b.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{b.totalCount}</Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(b.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpen(b.id)}
                      >
                        View
                      </Button>
                      {confirmId === b.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteBatch.isPending}
                            onClick={() => handleDelete(b.id)}
                          >
                            {deleteBatch.isPending && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Confirm
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmId(b.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function BatchDetail({
  batchId,
  onBack,
}: {
  batchId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const { data: detail, isLoading } = useBulkCertBatchDetail(batchId);
  const sendBatch = useSendBulkCertBatch();
  const [pdfData, setPdfData] = useState<CertificateData | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    try {
      const res = await sendBatch.mutateAsync(batchId);
      const parts = [`${res.sent} sent`];
      if (res.failed) parts.push(`${res.failed} failed`);
      if (res.skipped) parts.push(`${res.skipped} skipped (no email)`);
      toast({ title: "Certificates emailed", description: parts.join(" · ") });
    } catch (err) {
      toast({
        title: "Could not send",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [sendBatch, batchId, toast]);

  const downloadCertificate = useCallback(
    async (item: BulkCertItem) => {
      if (!detail) return;
      const certData = toCertData(item, detail);
      setPdfData(certData);
      setDownloadingId(item.id);

      // Let the offscreen certificate render (and fonts settle) before capture.
      await new Promise((r) => setTimeout(r, 150));

      const container = document.getElementById(PDF_RENDER_ID);
      const logoImgs = container
        ? Array.from(
            container.querySelectorAll<HTMLImageElement>("img[data-logo]"),
          )
        : [];
      const swaps: Array<{ img: HTMLImageElement; originalSrc: string }> = [];
      let bgSwap: { el: HTMLElement; original: string } | null = null;

      try {
        // Convert each logo to base64 so html2canvas can embed it. If a logo
        // can't be loaded cross-origin, blank its src so it doesn't taint the
        // canvas (the PDF still generates, just without that logo).
        const base64Results = await Promise.all(
          logoImgs.map((img) => loadLogoAsBase64(img.src)),
        );
        base64Results.forEach((b64, idx) => {
          const img = logoImgs[idx];
          if (!img) return;
          swaps.push({ img, originalSrc: img.src });
          img.src = b64 ?? "";
        });

        // A custom design's background is a CSS image: embed it the same way.
        const bgEl = container?.querySelector<HTMLElement>("[data-certificate-background]");
        const bgUrl = bgEl?.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
        if (bgEl && bgUrl && !bgUrl.startsWith("data:")) {
          const b64 = await loadLogoAsBase64(bgUrl);
          bgSwap = { el: bgEl, original: bgEl.style.backgroundImage };
          bgEl.style.backgroundImage = b64 ? `url("${b64}")` : "none";
        }

        if (swaps.length > 0 || bgSwap) {
          await new Promise((r) => setTimeout(r, 50));
        }

        const doc = await generatePDF(
          () => document.getElementById(PDF_RENDER_ID),
          { ...pdfOptionsFor(detail.design), method: "build" },
        );
        for (let i = doc.getNumberOfPages(); i > 1; i--) {
          doc.deletePage(i);
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const anchorEl = container?.querySelector<HTMLElement>(
          "[data-pdf-verify='1']",
        );
        if (anchorEl && container) {
          const anchorRect = anchorEl.getBoundingClientRect();
          const contRect = container.getBoundingClientRect();
          if (contRect.width > 0 && contRect.height > 0) {
            const xMm =
              ((anchorRect.left - contRect.left) / contRect.width) * pageWidth;
            const yMm =
              ((anchorRect.top - contRect.top) / contRect.height) * pageHeight;
            const wMm = (anchorRect.width / contRect.width) * pageWidth;
            const hMm = (anchorRect.height / contRect.height) * pageHeight;
            doc.link(xMm, yMm, wMm, hMm, { url: certData.verifyUrl });
          } else {
            doc.link(10, pageHeight - 12, pageWidth * 0.5, 8, {
              url: certData.verifyUrl,
            });
          }
        } else {
          doc.link(10, pageHeight - 12, pageWidth * 0.5, 8, {
            url: certData.verifyUrl,
          });
        }

        doc.save(`${item.recipientName}_${detail.batch.title}_certificate.pdf`);
        toast({ title: "Downloaded", description: "Certificate saved as PDF." });
      } catch {
        toast({
          title: "Error",
          description: "Failed to generate PDF.",
          variant: "destructive",
        });
      } finally {
        swaps.forEach(({ img, originalSrc }) => {
          img.src = originalSrc;
        });
        if (bgSwap) bgSwap.el.style.backgroundImage = bgSwap.original;
        setPdfData(null);
        setDownloadingId(null);
      }
    },
    [detail, toast],
  );

  if (isLoading || !detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to batches
        </Button>
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  const previewItem = detail.items[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">{detail.batch.title}</h2>
            <p className="text-muted-foreground text-sm">
              {detail.batch.totalCount} certificate
              {detail.batch.totalCount === 1 ? "" : "s"} · Signed by{" "}
              {detail.directorName}, {detail.directorTitle}
            </p>
          </div>
        </div>
        <Button onClick={handleSend} disabled={sendBatch.isPending}>
          {sendBatch.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Email certificates
        </Button>
      </div>

      {previewItem && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center rounded-b-xl bg-gradient-to-br from-gray-50 to-gray-100 py-6 dark:from-gray-900 dark:to-gray-800">
            {detail.design ? (
              <ScaledDesignCertificate
                design={detail.design}
                data={toCertData(previewItem, detail)}
                width={560}
              />
            ) : (
              <ScaledCertificate
                templateId={detail.templateId}
                data={toCertData(previewItem, detail)}
                scale={560 / CERT_WIDTH}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Certificate #</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {item.recipientName}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {item.email ? (
                        <span className="flex items-center gap-1.5">
                          {item.email}
                          {item.mappedMemberId && (
                            <Badge variant="secondary" className="text-[10px]">
                              Linked
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {item.certificateNumber}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {item.formattedIssuedAt}
                    </td>
                    <td className="px-4 py-3">
                      {item.emailedAt ? (
                        <Badge variant="secondary" className="gap-1">
                          <MailCheck className="h-3 w-3" /> Sent
                        </Badge>
                      ) : item.email ? (
                        <span className="text-muted-foreground text-xs">
                          Not sent
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">
                          No email
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={item.verifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Verify
                          </Button>
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === item.id}
                          onClick={() => downloadCertificate(item)}
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Offscreen native-size certificate used as the PDF capture target. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -100000,
          top: 0,
          width: designDims(detail.design).width,
          height: designDims(detail.design).height,
          pointerEvents: "none",
        }}
      >
        {pdfData && (
          <div id={PDF_RENDER_ID} style={{ width: designDims(detail.design).width }}>
            {detail.design ? (
              <ConfigCertificateRenderer design={detail.design} data={pdfData} />
            ) : (
              <CertificateRenderer
                templateId={detail.templateId}
                data={pdfData}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type View =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; batchId: string };

export function BulkCertificatesPage() {
  useCertificateFonts();
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "detail") {
    return (
      <BatchDetail
        batchId={view.batchId}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView({ mode: "list" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to batches
          </Button>
          <h1 className="text-2xl font-bold">New certificate batch</h1>
        </div>
        <CreateBatchForm
          onCreated={(batchId) => setView({ mode: "detail", batchId })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Award className="h-6 w-6" /> Certificates
          </h1>
          <p className="text-muted-foreground text-sm">
            Issue certificates in bulk to your recipients from a spreadsheet.
          </p>
        </div>
        <Button onClick={() => setView({ mode: "create" })}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> New batch
        </Button>
      </div>
      <BatchList onOpen={(batchId) => setView({ mode: "detail", batchId })} />
    </div>
  );
}
