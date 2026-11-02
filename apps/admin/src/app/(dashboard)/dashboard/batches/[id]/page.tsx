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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@open-mtlms/core";
import { formatBatchCourseLabel, formatBatchItemType, type ContentPrice } from "@open-mtlms/shared";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BatchAIGenerateModal } from "@/components/batch-editor/BatchAIGenerateModal";
import { BatchItemsPicker } from "@/components/batch-editor/BatchItemsPicker";
import {
  BatchThumbnailPicker,
  type BatchThumbnailValue,
} from "@/components/batch-editor/BatchThumbnailPicker";
import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import { batchesApi, type BatchDetail } from "@/lib/api/batches";
import { getCourseThumbnailUrl } from "@/lib/api/thumbnails";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { legacyToPrices, pricesToLegacy } from "@/lib/utils/price-fields";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

/**
 * Collapses the default shadcn focus ring (which has a 2px background offset)
 * against the input border, so focus reads as a single primary edge instead
 * of a double-border halo. Same helper exists in
 * BatchItemsPicker, kept inlined per file so each surface stays self-contained.
 */
const FOCUS_FIX =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-primary " +
  "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const batchId = params?.id;
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable form fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [enrollmentOpenDate, setEnrollmentOpenDate] = useState("");
  const [enrollmentCloseDate, setEnrollmentCloseDate] = useState("");
  const [durationDays, setDurationDays] = useState<string>("");
  const [validityDays, setValidityDays] = useState<string>("");
  const [lifetime, setLifetime] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [prices, setPrices] = useState<ContentPrice[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [thumbnails, setThumbnails] = useState<BatchThumbnailValue>({
    webKey: null,
    webUrl: null,
    mobileKey: null,
    mobileUrl: null,
  });
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const { selectedTenantId } = useTenantStore();

  const load = useCallback(async () => {
    if (!batchId) return;
    setIsLoading(true);
    try {
      const data = await batchesApi.getBatch(batchId);
      setBatch(data);
      setTitle(data.title);
      setSubtitle(data.subtitle ?? "");
      setDescription(data.description ?? "");
      setStartDate(data.startDate ? data.startDate.slice(0, 10) : "");
      setEndDate(data.endDate ? data.endDate.slice(0, 10) : "");
      setEnrollmentOpenDate(
        data.enrollmentOpenDate ? data.enrollmentOpenDate.slice(0, 10) : ""
      );
      setEnrollmentCloseDate(
        data.enrollmentCloseDate ? data.enrollmentCloseDate.slice(0, 10) : ""
      );
      setDurationDays(
        data.durationDays !== null ? String(data.durationDays) : ""
      );
      setValidityDays(
        data.validityDays !== null && data.validityDays !== undefined
          ? String(data.validityDays)
          : ""
      );
      setLifetime(data.validityDays === null || data.validityDays === undefined);
      setIsFree(data.purchaseMode === "FREE");
      setPrices(
        data.prices?.length
          ? data.prices
          : legacyToPrices(data.priceInr, data.priceUsd, data.discountInr, data.discountUsd)
      );
      setThumbnails({
        webKey: data.webThumbnailKey ?? null,
        webUrl: getCourseThumbnailUrl(data.webThumbnailKey),
        mobileKey: data.mobileThumbnailKey ?? null,
        mobileUrl: getCourseThumbnailUrl(data.mobileThumbnailKey),
      });
      setLearningOutcomes(data.learningOutcomes ?? []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load batch.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [batchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!batchId) return;
    setIsSaving(true);
    try {
      const legacy = pricesToLegacy(prices);
      const updated = await batchesApi.updateBatch(batchId, {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        // Date-only fields: send the raw YYYY-MM-DD that the date input produced.
        // Backend parses as UTC midnight; UI formatters render with { timeZone: "UTC" }.
        start_date: startDate || undefined,
        end_date: endDate || null,
        enrollment_open_date: enrollmentOpenDate || null,
        enrollment_close_date: enrollmentCloseDate || null,
        duration_days: durationDays ? parseInt(durationDays, 10) : null,
        validity_days: lifetime ? null : validityDays ? parseInt(validityDays, 10) : null,
        purchase_mode: isFree ? "FREE" : "PAID",
        price_inr: isFree || legacy.inr == null ? null : String(legacy.inr),
        price_usd: isFree || legacy.usd == null ? null : String(legacy.usd),
        discount_inr: isFree || legacy.discountInr == null ? null : String(legacy.discountInr),
        discount_usd: isFree || legacy.discountUsd == null ? null : String(legacy.discountUsd),
        prices: isFree ? undefined : prices,
        web_thumbnail_key: thumbnails.webKey,
        mobile_thumbnail_key: thumbnails.mobileKey,
        learning_outcomes: learningOutcomes.filter((s) => s.trim().length > 0),
      });
      setBatch(updated);
      toast({ title: "Saved", description: "Batch updated successfully." });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!batchId) return;
    try {
      await batchesApi.removeBatchItem(batchId, itemId);
      await load();
      toast({ title: "Removed", description: "Item removed from batch." });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to remove item.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !batch) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/batches">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{batch.title}</h1>
              <Badge variant={batch.status === "PUBLISHED" ? "default" : "secondary"}>
                {batch.status}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-xs">
              /batches/{batch.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aiAuthoringEnabled && (
            <Button variant="outline" onClick={() => setIsAIOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Content ({batch.items.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Thumbnails</CardTitle>
              <CardDescription>
                Upload one image for desktop/web and another portrait image for
                mobile. Learners see the right one for their device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTenantId ? (
                <BatchThumbnailPicker
                  tenantId={selectedTenantId}
                  batchId={batch.id}
                  value={thumbnails}
                  onChange={setThumbnails}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Select a tenant to upload thumbnails.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What learners will gain</CardTitle>
              <CardDescription>
                Add the key outcomes learners can expect from this batch, these
                show up as bullet points on the public About page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LearningOutcomesEditor
                value={learningOutcomes}
                onChange={setLearningOutcomes}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cohort details</CardTitle>
              <CardDescription>
                Once a learner enrolls, the start date is locked.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  className={FOCUS_FIX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  className={FOCUS_FIX}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className={`border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm ${FOCUS_FIX}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start date</Label>
                <Input
                  id="start-date"
                  type="date"
                  className={FOCUS_FIX}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End date (optional)</Label>
                <Input
                  id="end-date"
                  type="date"
                  className={FOCUS_FIX}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enroll-open">Enrollment opens</Label>
                <Input
                  id="enroll-open"
                  type="date"
                  className={FOCUS_FIX}
                  value={enrollmentOpenDate}
                  onChange={(e) => setEnrollmentOpenDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enroll-close">Enrollment closes</Label>
                <Input
                  id="enroll-close"
                  type="date"
                  className={FOCUS_FIX}
                  value={enrollmentCloseDate}
                  onChange={(e) => setEnrollmentCloseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  className={FOCUS_FIX}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="e.g., 90"
                />
                <p className="text-muted-foreground text-xs">
                  Cohort length. Drives the cohort end date when no explicit
                  end date is set.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                <div className="space-y-0.5">
                  <Label htmlFor="batch-lifetime-access">Lifetime access</Label>
                  <p className="text-muted-foreground text-xs">
                    No validity fallback. If the batch also has no end date or
                    duration, learners keep access forever.
                  </p>
                </div>
                <Switch
                  id="batch-lifetime-access"
                  checked={lifetime}
                  onCheckedChange={setLifetime}
                />
              </div>
              {!lifetime && (
                <div className="space-y-2">
                  <Label htmlFor="validity">Validity (days after enrollment)</Label>
                  <Input
                    id="validity"
                    type="number"
                    className={FOCUS_FIX}
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    placeholder="e.g., 365"
                  />
                  <p className="text-muted-foreground text-xs">
                    Optional fallback. If the batch has no end date or duration,
                    each learner&apos;s child course/book access expires this
                    many days after they enroll.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                <div className="space-y-0.5">
                  <Label htmlFor="free-batch">Free batch</Label>
                  <p className="text-muted-foreground text-xs">
                    Learners can join without payment.
                  </p>
                </div>
                <Switch
                  id="free-batch"
                  checked={isFree}
                  onCheckedChange={(c) => {
                    setIsFree(c);
                    if (c) {
                      setPrices([]);
                    }
                  }}
                />
              </div>
              {!isFree && (
                <div className="sm:col-span-2 space-y-2">
                  <MultiCurrencyPriceEditor
                    value={prices}
                    onChange={setPrices}
                    discountMode="percent"
                  />
                  <p className="text-muted-foreground text-xs">
                    All prices should be inclusive of applicable taxes. No additional
                    taxes will be charged to the buyer.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Content</CardTitle>
                <CardDescription>
                  Add courses and books to this batch. Learners get enrolled into
                  all included courses on purchase.
                </CardDescription>
              </div>
              <Button onClick={() => setIsPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Items
              </Button>
            </CardHeader>
            <CardContent>
              {batch.items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No items yet. Click <span className="font-medium">Add Items</span>{" "}
                  to pick courses and books for this batch.
                </p>
              ) : (
                <ul className="divide-y">
                  {batch.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <div className="font-medium">
                          {item.itemType === "COURSE"
                            ? item.courseTitle ?? "Untitled course"
                            : item.bookTitle ?? "Untitled book"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatBatchItemType(item.itemType)}
                          {item.itemType === "COURSE"
                            ? (() => {
                                const label = formatBatchCourseLabel(
                                  item.courseMode,
                                  item.courseType
                                );
                                return label ? ` · ${label}` : "";
                              })()
                            : ""}
                          {item.courseSlug ? ` · /${item.courseSlug}` : null}
                          {item.bookSlug ? ` · /${item.bookSlug}` : null}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <BatchItemsPicker
            open={isPickerOpen}
            onOpenChange={setIsPickerOpen}
            batch={batch}
            onAdded={load}
          />
        </TabsContent>
      </Tabs>

      {selectedTenantId && (
        <BatchAIGenerateModal
          open={isAIOpen}
          onOpenChange={setIsAIOpen}
          batch={batch}
          tenantId={selectedTenantId}
          onApplied={load}
        />
      )}
    </div>
  );
}

/**
 * Inline editor for the learning_outcomes string array. Keeps a working list
 * of inputs (one per outcome) plus an "Add outcome" button. Empty strings are
 * filtered out at save time in the parent.
 */
function LearningOutcomesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const focusFix =
    "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-primary " +
    "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

  const setAt = (i: number, v: string) => {
    const next = value.slice();
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const add = () => onChange([...value, ""]);

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No outcomes yet. Click <span className="font-medium">Add outcome</span>{" "}
          to start.
        </p>
      )}
      {value.map((outcome, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className={focusFix}
            value={outcome}
            placeholder="e.g., Build production-ready React apps from scratch"
            onChange={(e) => setAt(i, e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive h-9 w-9 flex-shrink-0"
            onClick={() => removeAt(i)}
            title="Remove outcome"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} type="button">
        <Plus className="mr-2 h-3.5 w-3.5" /> Add outcome
      </Button>
    </div>
  );
}
