"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { formatMoney, type ContentPrice } from "@open-mtlms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import { SlugEditor } from "@/components/shared/slug-editor";
import { AttemptsReport } from "@/components/test-series/AttemptsReport";
import { AttemptsSection } from "@/components/test-series/AttemptsSection";
import { ThumbnailComposer } from "@/components/test-series/ThumbnailComposer";
import {
  useTestSeriesAITextField,
  useTestSeriesAICoverField,
} from "@/components/test-series/use-test-series-ai-fields";
import {
  testSeriesApi,
  testsApi,
  type Test,
  type TestSeries,
  type TestSeriesAccessMode,
  type TestSeriesPricingType,
  type TestSeriesVisibility,
} from "@/lib/api/test-series";
import { uploadApi } from "@/lib/api/upload";
import { THUMBNAILS_BASE_URL } from "@/lib/constants";
import { useDomains } from "@/lib/hooks/use-domains";
import {
  testSeriesKeys,
  useTestSeries,
  useUpdateTestSeries,
  usePublishTestSeries,
  useUnpublishTestSeries,
  useDeleteTestSeries,
  useSeriesTests,
  useAddTestToSeries,
  useRemoveTestFromSeries,
  useTestSeriesEntitlementUsage,
} from "@/lib/hooks/use-test-series";
import { legacyToPrices, pricesToLegacy } from "@/lib/utils/price-fields";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

const VALIDITY_LABELS: Record<string, string> = {
  "30": "1 month",
  "90": "3 months",
  "180": "6 months",
  "365": "1 year",
};
const validityLabel = (mode: string): string =>
  VALIDITY_LABELS[mode] ?? `${mode} days`;

function applyPct(price: number, pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return price;
  return price * (1 - pct / 100);
}

function formatHeaderPrice(series: {
  prices?: ContentPrice[] | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
}): string {
  // Price book wins; legacy INR/USD columns are the fallback for old records.
  const book = series.prices?.length
    ? series.prices
    : legacyToPrices(series.priceInr, series.priceUsd, series.discountInr, series.discountUsd);
  const parts = book
    .filter((p) => p.amount > 0)
    .map((p) => {
      const pct = p.discount ?? 0;
      const eff = applyPct(p.amount, pct);
      return pct > 0 && pct <= 100
        ? `${formatMoney(eff, p.currency)} (was ${formatMoney(p.amount, p.currency)})`
        : formatMoney(p.amount, p.currency);
    });
  if (parts.length === 0) return "Paid";
  return parts.join(" | ");
}

/**
 * True when a reloaded series differs from the previous copy only in its page
 * URL (saving the URL also moves updatedAt). Nothing the settings form edits
 * has changed then.
 */
function isSlugOnlyChange(prev: TestSeries, next: TestSeries): boolean {
  if (prev.id !== next.id || prev.slug === next.slug) return false;
  const withoutSlug = (s: TestSeries) =>
    JSON.stringify({ ...s, slug: null, updatedAt: null });
  return withoutSlug(prev) === withoutSlug(next);
}

export default function SeriesBuilderPage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params?.seriesId ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: series, isLoading } = useTestSeries(seriesId);
  const { data: seriesTests, refetch: refetchSeriesTests } = useSeriesTests(seriesId);
  const { data: domains } = useDomains();

  const updateMut = useUpdateTestSeries();
  // Its own instance so saving the page URL does not spin "Save settings".
  const updateSlugMut = useUpdateTestSeries();
  const publishMut = usePublishTestSeries();
  const unpublishMut = useUnpublishTestSeries();
  const deleteMut = useDeleteTestSeries();
  const addTestMut = useAddTestToSeries();
  const removeTestMut = useRemoveTestFromSeries();

  // testseries_count entitlement: live count from the table paired with
  // the entitlement limit so the badge always matches reality.
  const { data: usage } = useTestSeriesEntitlementUsage();
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 0;
  const isUnlimited = usage?.isUnlimited ?? true;
  const atCapacity = usage?.atCapacity ?? false;

  // Settings form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricing, setPricing] = useState<TestSeriesPricingType>("FREE");
  const [prices, setPrices] = useState<ContentPrice[]>([]);
  const [visibility, setVisibility] = useState<TestSeriesVisibility>("PUBLIC");
  const [accessMode, setAccessMode] = useState<TestSeriesAccessMode>("OPEN");
  // Validity: a preset duration ("30"|"90"|"180"|"365"), "LIFETIME", or "DATE"
  // (an absolute end date). Legacy custom day-counts are kept as the raw number.
  const [validityMode, setValidityMode] = useState("LIFETIME");
  const [validityDate, setValidityDate] = useState("");
  const [category, setCategory] = useState("");
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Background-worker AI helpers (title / description / cover)
  const titleAI = useTestSeriesAITextField((text) => {
    setTitle(text);
    toast({ title: "Title generated. Click Save settings to apply." });
  });
  const descriptionAI = useTestSeriesAITextField((text) => {
    setDescription(text);
    toast({
      title: "Description generated. Click Save settings to apply.",
    });
  });
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const coverAI = useTestSeriesAICoverField((key) => {
    setCoverImageKey(key);
    toast({ title: "AI cover generated. Click Save settings to apply." });
  });
  const isGeneratingThumbnail = coverAI.isActive || uploadingCover;

  // Dialogs
  const [tab, setTab] = useState("setup");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeTestId, setRemoveTestId] = useState<string | null>(null);

  // Fill the form from the server copy. Saving the page URL reloads the series
  // too, and that reload alone must not reset the form and drop edits not yet
  // saved (say, a title fixed just before regenerating the URL from it).
  const filledFromRef = useRef<TestSeries | null>(null);

  useEffect(() => {
    if (!series) return;
    const previous = filledFromRef.current;
    filledFromRef.current = series;
    if (previous && isSlugOnlyChange(previous, series)) return;
    setTitle(series.title);
    setDescription(series.description ?? "");
    setPricing(series.pricingType);
    setPrices(
      series.prices?.length
        ? series.prices
        : legacyToPrices(series.priceInr, series.priceUsd, series.discountInr, series.discountUsd)
    );
    setVisibility(series.visibility);
    setAccessMode(series.accessMode);
    if (series.endDate) {
      setValidityMode("DATE");
      setValidityDate(series.endDate.slice(0, 10));
    } else if (series.validityDays) {
      setValidityMode(String(series.validityDays));
      setValidityDate("");
    } else {
      setValidityMode("LIFETIME");
      setValidityDate("");
    }
    setCategory(series.category ?? "");
    setCoverImageKey(series.coverImageKey ?? null);
  }, [series]);

  const handleGenerateAIThumbnail = async () => {
    if (coverAI.isActive) return;
    if (!title.trim()) {
      toast({
        title: "Set a title first",
        description: "The AI uses the test series title to render the cover.",
        variant: "destructive",
      });
      return;
    }
    try {
      await coverAI.generate({
        kind: "cover",
        title: title.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
      });
    } catch (err) {
      toast({
        title: "Failed to start generation",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAITitle = async () => {
    if (titleAI.isActive) return;
    try {
      await titleAI.generate({
        kind: "title",
        topic: title.trim() || description.trim() || null,
        category: category.trim() || null,
      });
    } catch (err) {
      toast({
        title: "Failed to start generation",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAIDescription = async () => {
    if (descriptionAI.isActive) return;
    if (!title.trim()) {
      toast({
        title: "Set a title first",
        description: "The AI uses the title to write a matching description.",
        variant: "destructive",
      });
      return;
    }
    try {
      await descriptionAI.generate({
        kind: "description",
        title: title.trim(),
        category: category.trim() || null,
        extraContext: description.trim() || null,
      });
    } catch (err) {
      toast({
        title: "Failed to start generation",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" });
      return;
    }
    setUploadingCover(true);
    try {
      const result = await uploadApi.uploadFile(file, "test-series-thumbnails");
      setCoverImageKey(result.key);
      toast({ title: "Cover uploaded, click Save settings to apply" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveSettings = () => {
    if (!series) return;
    if (validityMode === "DATE" && !validityDate) {
      toast({ title: "Pick an access end date", variant: "destructive" });
      return;
    }
    const isPaid = pricing === "PAID";
    const legacy = pricesToLegacy(prices);
    const validityDays =
      validityMode === "DATE" || validityMode === "LIFETIME"
        ? null
        : parseInt(validityMode, 10);
    const endDate =
      validityMode === "DATE" && validityDate
        ? new Date(validityDate).toISOString()
        : null;
    updateMut.mutate(
      {
        seriesId,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          pricing_type: pricing,
          price_inr: isPaid ? legacy.inr : null,
          price_usd: isPaid ? legacy.usd : null,
          discount_inr: isPaid ? legacy.discountInr : null,
          discount_usd: isPaid ? legacy.discountUsd : null,
          prices: isPaid ? prices : undefined,
          visibility,
          access_mode: accessMode,
          validity_days: validityDays,
          end_date: endDate,
          category: category.trim() || null,
          cover_image_key: coverImageKey,
        },
      },
      {
        onSuccess: () => toast({ title: "Series saved" }),
        onError: (err) =>
          toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  // The page URL saves on its own, apart from Save settings. Resolve with the
  // slug the server stored: it adds a short code when another test series in
  // this tenant already uses the one asked for. SlugEditor shows the toasts.
  const handleSaveSlug = async (slug: string) => {
    const saved = await updateSlugMut.mutateAsync({ seriesId, data: { slug } });
    return saved.slug;
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: testSeriesKeys.series.tests(seriesId) });

  const handleReorderTests = async (fromIdx: number, dir: -1 | 1) => {
    if (!seriesTests) return;
    const toIdx = fromIdx + dir;
    if (toIdx < 0 || toIdx >= seriesTests.length) return;
    const next = [...seriesTests].sort((a, b) => a.orderIndex - b.orderIndex);
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    try {
      await testSeriesApi.reorderTests(seriesId, next.map((t) => t.testId));
      refresh();
    } catch (err) {
      toast({
        title: "Reorder failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleToggleFreePreview = async (
    testId: string,
    currentValue: boolean,
    orderIndex: number
  ) => {
    try {
      await testSeriesApi.addTest(seriesId, {
        test_id: testId,
        order_index: orderIndex,
        is_free_preview: !currentValue,
      });
      refresh();
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTest = () => {
    if (!removeTestId) return;
    removeTestMut.mutate(
      { seriesId, testId: removeTestId },
      {
        onSuccess: () => {
          toast({ title: "Removed from series" });
          setRemoveTestId(null);
          refresh();
        },
      }
    );
  };

  if (isLoading || !series) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isPublished = series.status === "PUBLISHED";
  const primaryHost =
    domains?.find((d) => d.isPrimary)?.domainName ??
    domains?.[0]?.domainName ??
    null;
  const studentUrl = primaryHost
    ? `https://${primaryHost}/test-series/${series.slug}`
    : null;
  const copyStudentLink = () => {
    if (!studentUrl) return;
    navigator.clipboard.writeText(studentUrl);
    toast({ title: "Student link copied" });
  };
  const sortedTests = (seriesTests ?? [])
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series/series"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to series
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{series.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={isPublished ? "default" : "secondary"}>{series.status}</Badge>
            <span className="text-muted-foreground">
              {series.pricingType === "FREE"
                ? "Free"
                : formatHeaderPrice(series)}{" "}
              · {series.visibility} ·{" "}
              {series.accessMode === "SEQUENTIAL" ? "Sequential" : "Open"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={atCapacity ? "destructive" : "secondary"}>
            {used}
            {isUnlimited ? " / unlimited" : ` / ${limit}`} published
          </Badge>
          {isPublished && studentUrl && (
            <>
              <Button asChild variant="outline" title="Open the student-facing page">
                <a href={studentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  View
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={copyStudentLink}
                title={`Copy the shareable student link${
                  series.visibility === "UNLISTED" ? " (this series is unlisted, share via link)" : ""
                }`}
              >
                <Copy className="mr-1 h-4 w-4" />
                Copy link
              </Button>
            </>
          )}
          {isPublished ? (
            <Button
              variant="outline"
              onClick={() => unpublishMut.mutate(seriesId)}
              disabled={unpublishMut.isPending}
            >
              <EyeOff className="mr-1 h-4 w-4" />
              Unpublish
            </Button>
          ) : (
            <Button
              onClick={() => publishMut.mutate(seriesId)}
              disabled={publishMut.isPending || atCapacity}
              title={atCapacity ? "Publish limit reached" : undefined}
            >
              {publishMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Eye className="mr-1 h-4 w-4" />
              Publish
            </Button>
          )}
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Analytics, a compact strip stays on top of both tabs; the full
          batch-wise report lives under "Attempts & answers". */}
      <SeriesAnalyticsStrip seriesId={seriesId} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="setup">Series setup</TabsTrigger>
          <TabsTrigger value="attempts">Attempts &amp; answers</TabsTrigger>
        </TabsList>

        <TabsContent value="attempts" className="mt-0">
          <SeriesAttemptsReportCard seriesId={seriesId} seriesTitle={series?.title} />
        </TabsContent>

        <TabsContent value="setup" className="mt-0 space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Cover image</Label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverFileChange}
            />
            {coverImageKey ? (
              <div className="relative w-full max-w-md overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${THUMBNAILS_BASE_URL}/${coverImageKey}`}
                  alt="Cover"
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="absolute right-2 top-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isGeneratingThumbnail}
                  >
                    {uploadingCover ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Replace"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setCoverImageKey(null)}
                    disabled={isGeneratingThumbnail}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => coverInputRef.current?.click()}
                disabled={isGeneratingThumbnail}
              >
                {uploadingCover && !coverAI.isActive ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {coverImageKey ? "Upload different" : "Upload cover"}
                  </>
                )}
              </Button>
              {aiAuthoringEnabled && (
                <Button
                  variant="outline"
                  onClick={handleGenerateAIThumbnail}
                  disabled={isGeneratingThumbnail || !title.trim()}
                >
                  {coverAI.isActive ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {coverAI.isUploading ? "Uploading…" : "Generating…"}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate with AI
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setComposerOpen(true)}
                disabled={isGeneratingThumbnail}
              >
                <Palette className="mr-2 h-4 w-4" />
                Design thumbnail
              </Button>
            </div>
            <ThumbnailComposer
              open={composerOpen}
              onOpenChange={setComposerOpen}
              onSave={(key) => {
                setCoverImageKey(key);
                toast({
                  title: "Thumbnail designed. Click Save settings to apply.",
                });
              }}
            />
            <p className="text-muted-foreground text-xs">
              Shown on the catalog and series page (16:9 banner). AI generation
              uses the title{category.trim() ? " and category" : ""}.
              click Save settings after to persist.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Title</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleGenerateAITitle}
                disabled={titleAI.isActive}
              >
                {titleAI.isActive ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                AI
              </Button>
            </div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <SlugEditor
            basePath="/test-series/"
            value={series.slug}
            title={title}
            noun="test series"
            onSave={handleSaveSlug}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleGenerateAIDescription}
                disabled={descriptionAI.isActive || !title.trim()}
              >
                {descriptionAI.isActive ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                AI
              </Button>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Pricing</Label>
              <Select value={pricing} onValueChange={(v) => setPricing(v as TestSeriesPricingType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as TestSeriesVisibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="UNLISTED">Unlisted</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {visibility === "PUBLIC"
                  ? "Listed in the catalog and anyone can open it."
                  : visibility === "UNLISTED"
                    ? "Hidden from the catalog, only people with the direct link can open it."
                    : "Invite-only, not listed and the link won't open it; only learners you grant access to can see it."}
              </p>
            </div>
          </div>
          {pricing === "PAID" && (
            <div className="space-y-3">
              <MultiCurrencyPriceEditor
                value={prices}
                onChange={setPrices}
                discountMode="percent"
              />
              <p className="text-muted-foreground text-xs">
                Discounts are percentages from 0 to 100. Effective price = price * (1 - discount/100).
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Access mode</Label>
              <Select value={accessMode} onValueChange={(v) => setAccessMode(v as TestSeriesAccessMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open (any test)</SelectItem>
                  <SelectItem value="SEQUENTIAL">Sequential (unlock in order)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Validity</Label>
              <Select value={validityMode} onValueChange={setValidityMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!["LIFETIME", "30", "90", "180", "365", "DATE"].includes(
                    validityMode,
                  ) && (
                    <SelectItem value={validityMode}>
                      {validityMode} days (current)
                    </SelectItem>
                  )}
                  <SelectItem value="LIFETIME">Lifetime</SelectItem>
                  <SelectItem value="30">1 month</SelectItem>
                  <SelectItem value="90">3 months</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="DATE">Specific date…</SelectItem>
                </SelectContent>
              </Select>
              {validityMode === "DATE" && (
                <Input
                  type="date"
                  value={validityDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setValidityDate(e.target.value)}
                />
              )}
              <p className="text-muted-foreground text-xs">
                {validityMode === "DATE"
                  ? "All learners lose access on this date, no matter when they enrolled."
                  : validityMode === "LIFETIME"
                    ? "Learners keep access forever, no expiry."
                    : `Each learner keeps access for ${validityLabel(validityMode)} from the day they enrol.`}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. JEE Main 2026"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={updateMut.isPending}>
              {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-1 h-4 w-4" />
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tests in series */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tests in series</h2>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add test
        </Button>
      </div>
      {sortedTests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No tests yet. Add at least one to publish.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedTests.map((row, idx) => (
            <SeriesTestRow
              key={row.id}
              testId={row.testId}
              orderIndex={row.orderIndex}
              isFreePreview={row.isFreePreview}
              isFirst={idx === 0}
              isLast={idx === sortedTests.length - 1}
              onUp={() => handleReorderTests(idx, -1)}
              onDown={() => handleReorderTests(idx, 1)}
              onTogglePreview={() =>
                handleToggleFreePreview(row.testId, row.isFreePreview, row.orderIndex)
              }
              onRemove={() => setRemoveTestId(row.testId)}
            />
          ))}
        </div>
      )}

      {/* Coupons used to live here in their own per-series table. They now use
          the tenant-wide coupon system, which can scope a code to this series
          (or to everything) and reports redemptions in coupon analytics. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coupons</CardTitle>
          <CardDescription>
            Discount codes are managed centrally. Create one scoped to this test
            series, or one that applies to everything you sell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/coupons">
            <Button variant="outline" size="sm">
              <Ticket className="mr-2 h-4 w-4" />
              Manage coupons
            </Button>
          </Link>
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      {/* Test picker modal */}
      {pickerOpen && (
        <TestPickerModal
          existingTestIds={new Set(sortedTests.map((t) => t.testId))}
          onClose={() => setPickerOpen(false)}
          onAdd={async (testIds) => {
            try {
              for (const tid of testIds) {
                await addTestMut.mutateAsync({
                  seriesId,
                  data: { test_id: tid, order_index: sortedTests.length },
                });
              }
              toast({ title: `Added ${testIds.length} test${testIds.length === 1 ? "" : "s"}` });
              setPickerOpen(false);
              refetchSeriesTests();
            } catch (err) {
              toast({
                title: "Add failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
              });
            }
          }}
        />
      )}

      <AlertDialog open={!!removeTestId} onOpenChange={(o) => !o && setRemoveTestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove test from series?</AlertDialogTitle>
            <AlertDialogDescription>
              The test stays in your library; it&apos;s only unlinked from this series.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveTest}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this series?</AlertDialogTitle>
            <AlertDialogDescription>
              Active enrollments will lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMut.mutate(seriesId, {
                  onSuccess: () => {
                    toast({ title: "Series deleted" });
                    window.location.href = "/dashboard/test-series/series";
                  },
                })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----- Series Test Row -----

function SeriesTestRow({
  testId,
  isFreePreview,
  isFirst,
  isLast,
  onUp,
  onDown,
  onTogglePreview,
  onRemove,
}: {
  testId: string;
  orderIndex: number;
  isFreePreview: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
  onTogglePreview: () => void;
  onRemove: () => void;
}) {
  const [test, setTest] = useState<Test | null>(null);

  useEffect(() => {
    let cancelled = false;
    testsApi.get(testId).then((t) => {
      if (!cancelled) setTest(t);
    });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={onUp}
              disabled={isFirst}
              aria-label="Move up"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDown}
              disabled={isLast}
              aria-label="Move down"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>
          <div className="min-w-0">
            {test ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-foreground font-medium">{test.name}</p>
                  <Badge variant={test.status === "PUBLISHED" ? "default" : "secondary"}>
                    {test.status}
                  </Badge>
                  {isFreePreview && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                      Free preview
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {test.durationMin} min · {test.totalMarks} marks
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Loading…</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={isFreePreview ? "default" : "outline"}
            onClick={onTogglePreview}
            title="Toggle free preview"
          >
            <Star className={`h-3 w-3 ${isFreePreview ? "fill-current" : ""}`} />
          </Button>
          <Link href={`/dashboard/test-series/tests/${testId}`}>
            <Button size="sm" variant="outline">Open</Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="text-destructive h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Test Picker -----

function TestPickerModal({
  existingTestIds,
  onClose,
  onAdd,
}: {
  existingTestIds: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    testsApi.list({ status: "PUBLISHED", limit: 100 })
      .then((res) => setTests(res.tests))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eligible = useMemo(
    () => tests.filter((t) => !existingTestIds.has(t.id)),
    [tests, existingTestIds]
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add tests to series</DialogTitle>
          <DialogDescription>
            Only published tests can be added. Tests already in this series are hidden.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : eligible.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No published tests available.
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {eligible.map((t) => {
              const checked = selected.has(t.id);
              return (
                <li
                  key={t.id}
                  className="bg-muted/20 flex items-center gap-2 rounded-md p-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground line-clamp-1 text-sm font-medium">{t.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {t.durationMin} min · {t.totalMarks} marks
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onAdd(Array.from(selected))}
            disabled={selected.size === 0}
          >
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/** Compact analytics strip shown in the page header (top), not buried below. */
function SeriesAnalyticsStrip({ seriesId }: { seriesId: string }) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["series-attempts-report", seriesId],
    queryFn: () => testsApi.listSeriesAttempts(seriesId),
    enabled: !!seriesId,
  });
  const a = attempts ?? [];
  const submitted = a.filter((x) => x.submittedAt);
  const scaled = submitted.filter((x) => x.scaledScore != null);
  const avgScaled = scaled.length
    ? Math.round(scaled.reduce((s, x) => s + (x.scaledScore ?? 0), 0) / scaled.length)
    : null;
  const pcts = submitted.filter((x) => x.percentage != null);
  const avgPct = pcts.length
    ? Math.round(pcts.reduce((s, x) => s + Number(x.percentage ?? 0), 0) / pcts.length)
    : null;
  const flagged = a.filter((x) => x.flagCount > 0 || x.tabSwitchCount > 0).length;
  const subRate = a.length ? Math.round((submitted.length / a.length) * 100) : 0;

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Attempts", value: String(a.length) },
    { label: "Submitted", value: String(submitted.length), hint: `${subRate}% completion` },
    { label: "Avg scaled", value: avgScaled != null ? String(avgScaled) : "-", hint: "out of 1600" },
    { label: "Avg score", value: avgPct != null ? `${avgPct}%` : "-" },
    { label: "Flagged", value: String(flagged), hint: "proctoring" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label} className="p-0">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {isLoading ? "…" : s.value}
            </p>
            {s.hint && <p className="text-muted-foreground mt-0.5 text-[11px]">{s.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SeriesAttemptsReportCard({
  seriesId,
  seriesTitle,
}: {
  seriesId: string;
  seriesTitle?: string | null;
}) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["series-attempts-report", seriesId],
    queryFn: () => testsApi.listSeriesAttempts(seriesId),
    enabled: !!seriesId,
  });

  return (
    <AttemptsSection
      count={attempts?.length ?? 0}
      loading={isLoading}
      collapsible={false}
      description={
        <>
          Every learner attempt across all tests in this series: name, email,
          phone, score, percentile, rank, time and proctoring. Use Review on any
          row to read that learner&apos;s answers question by question, or
          Download CSV for the full export.
        </>
      }
    >
      <AttemptsReport
        attempts={attempts ?? []}
        loading={isLoading}
        showTest
        filename={`series-attempts-${(seriesTitle || seriesId)
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()}`}
      />
    </AttemptsSection>
  );
}
