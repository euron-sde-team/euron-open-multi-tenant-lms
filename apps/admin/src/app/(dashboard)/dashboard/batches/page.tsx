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
  Switch,
  useToast,
} from "@open-mtlms/core";
import type { ContentPrice } from "@open-mtlms/shared";
import {
  CalendarDays,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FeatureGate } from "@/components/feature-gate/FeatureGate";
import { SortableCardGrid } from "@/components/ordered-products/sortable-card-grid";
import { useCatalogOrdering } from "@/components/ordered-products/use-catalog-ordering";
import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import { CopyLinkButton } from "@/components/shared/copy-link-button";
import { TenantSelector } from "@/components/tenant-selector";
import { batchesApi, type Batch } from "@/lib/api/batches";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import {
  useEntitlements,
  getProductUsage,
} from "@/lib/hooks/use-entitlements";
import { useTenantWebBaseUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { pricesToLegacy } from "@/lib/utils/price-fields";
import { generateSlug } from "@/lib/utils/slug";

/**
 * Collapses the default shadcn focus ring (which has a 2px background offset)
 * against the input border, so focus reads as a single primary edge instead
 * of a double-border halo.
 */
const FOCUS_FIX =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-primary " +
  "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

interface BatchListItem {
  id: string;
  title: string;
  slug: string;
  /**
   * Pre-resolved thumbnail URL for the card. Falls back through the four
   * places a tenant might have attached an image: legacy `thumbnail_url`,
   * the modern `web_thumbnail_key` upload, the mobile portrait variant,
   * and finally `cover_image_url`. The first one with content wins so
   * the admin card never renders a blank tile when *any* thumbnail
   * exists in storage.
   */
  thumbnailDisplayUrl?: string;
  isPublished: boolean;
  status: string;
  purchaseMode: string;
  itemCount: number;
  totalEnrollments: number;
  startDate: string;
  endDate: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  updatedAt: string;
}

function apiBatchToListItem(b: Batch): BatchListItem {
  // Same priority the web app uses: web (landscape) → legacy single →
  // mobile (portrait) → cover. `resolveThumbnailForDisplay` accepts both
  // S3 keys and full URLs, so it works whether the column is a key or
  // a fully-qualified URL.
  const thumbnailDisplayUrl =
    resolveThumbnailForDisplay(b.thumbnailUrl) ??
    resolveThumbnailForDisplay(b.webThumbnailKey) ??
    resolveThumbnailForDisplay(b.mobileThumbnailKey) ??
    resolveThumbnailForDisplay(b.coverImageUrl) ??
    undefined;

  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    thumbnailDisplayUrl,
    isPublished: b.status === "PUBLISHED",
    status: b.status,
    purchaseMode: b.purchaseMode ?? "PAID",
    itemCount: b.itemCount,
    totalEnrollments: b.totalEnrollments,
    startDate: b.startDate,
    endDate: b.endDate,
    priceInr: b.priceInr,
    priceUsd: b.priceUsd,
    updatedAt: b.updatedAt,
  };
}

export default function BatchesPage() {
  const { toast } = useToast();
  const tenantWebBaseUrl = useTenantWebBaseUrl();
  const router = useRouter();
  const { selectedTenantId, selectedTenant } = useTenantStore();

  const { data: entitlements } = useEntitlements(selectedTenantId || undefined);
  const usage = getProductUsage(entitlements, "batches_count");

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [newPrices, setNewPrices] = useState<ContentPrice[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchesData, setBatchesData] = useState<BatchListItem[]>([]);

  const loadBatches = useCallback(async () => {
    if (!selectedTenantId) {
      setBatchesData([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await batchesApi.getBatches(1, 100);
      setBatchesData(response.batches.map(apiBatchToListItem));
    } catch (err) {
      console.error("Failed to load batches:", err);
      setError("Failed to load batches. Please try again.");
      setBatchesData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return batchesData;
    const q = searchQuery.toLowerCase();
    return batchesData.filter(
      (b) => b.title.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q)
    );
  }, [batchesData, searchQuery]);

  // Handles come off while searching, see the note in use-catalog-ordering.
  const ordering = useCatalogOrdering({
    entity: "batches",
    isFiltered: searchQuery.trim().length > 0,
    onSaved: loadBatches,
  });

  const stats = useMemo(
    () => ({
      total: batchesData.length,
      published: batchesData.filter((b) => b.isPublished).length,
      draft: batchesData.filter((b) => !b.isPublished).length,
    }),
    [batchesData]
  );

  const slugPreview = useMemo(
    () => (newTitle.trim() ? generateSlug(newTitle) : ""),
    [newTitle]
  );

  const handleCreate = async () => {
    if (!selectedTenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant first.",
        variant: "destructive",
      });
      return;
    }
    if (!newTitle.trim()) {
      toast({
        title: "Error",
        description: "Title is required.",
        variant: "destructive",
      });
      return;
    }
    if (!newStartDate) {
      toast({
        title: "Error",
        description: "Start date is required.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const legacy = pricesToLegacy(newPrices);
      const created = await batchesApi.createBatch({
        title: newTitle.trim(),
        slug: generateSlug(newTitle),
        // Send the raw `YYYY-MM-DD` from the date input, no Date constructor in between.
        // Backend parses it as UTC midnight; display formatters use { timeZone: "UTC" }.
        start_date: newStartDate,
        end_date: newEndDate || null,
        purchase_mode: isFree ? "FREE" : "PAID",
        price_inr: isFree || legacy.inr == null ? null : String(legacy.inr),
        price_usd: isFree || legacy.usd == null ? null : String(legacy.usd),
        discount_inr: isFree || legacy.discountInr == null ? null : String(legacy.discountInr),
        discount_usd: isFree || legacy.discountUsd == null ? null : String(legacy.discountUsd),
        prices: isFree ? undefined : newPrices,
      });
      setIsCreateOpen(false);
      setNewTitle("");
      setNewStartDate("");
      setNewEndDate("");
      setIsFree(false);
      setNewPrices([]);
      toast({
        title: "Success",
        description: "Batch created. Redirecting…",
      });
      router.push(`/dashboard/batches/${created.id}`);
    } catch (err) {
      console.error("Failed to create batch:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to create batch.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await batchesApi.deleteBatch(deleteId);
      setBatchesData((prev) => prev.filter((b) => b.id !== deleteId));
      setDeleteId(null);
      toast({ title: "Success", description: "Batch deleted." });
    } catch (err) {
      console.error("Failed to delete batch:", err);
      toast({
        title: "Error",
        description: "Failed to delete batch.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async (id: string, currentlyPublished: boolean) => {
    setTogglingId(id);
    try {
      const updated = await batchesApi.togglePublish(id, !currentlyPublished);
      setBatchesData((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                isPublished: updated.status === "PUBLISHED",
                status: updated.status,
              }
            : b
        )
      );
      toast({
        title: "Success",
        description: currentlyPublished ? "Batch unpublished." : "Batch published.",
      });
    } catch (err) {
      console.error("Failed to toggle publish:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to update publish status.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  // Cohort dates (start_date, end_date, enrollment_*_date) are date-only values.
  // They round-trip through the API as UTC midnight ISO strings, so format them in UTC
  // to avoid one-day shifts in non-UTC timezones.
  const formatDateOnly = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  // updatedAt is an instant, show in the viewer's local tz (no `timeZone` override).
  const formatTimestamp = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatPrice = (b: BatchListItem) => {
    if (b.purchaseMode === "FREE") return "Free";
    if (b.priceInr) return `₹${b.priceInr}`;
    if (b.priceUsd) return `$${b.priceUsd}`;
    // Paid batch with no prices configured, invalid state, surface visibly.
    return "-";
  };

  return (
    <FeatureGate featureKeys={["batches"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Batches</h1>
            <p className="text-muted-foreground">
              Cohort offerings for {selectedTenant?.tenant_name || "your tenant"}
            </p>
            {selectedTenantId && (
              <p className="text-muted-foreground mt-1 text-sm">
                {usage.used} /{" "}
                {usage.isUnlimited ? "Unlimited" : usage.limit} batches used
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TenantSelector />
            <Button
              onClick={() => setIsCreateOpen(true)}
              disabled={!selectedTenantId || !usage.allowedToAddOne}
              title={
                !usage.allowedToAddOne
                  ? "Batch limit reached. Upgrade your plan."
                  : undefined
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Create Batch
            </Button>
          </div>
        </div>

        {!selectedTenantId && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="text-muted-foreground/50 mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-center">
                Please select a tenant to view and manage batches.
              </p>
            </CardContent>
          </Card>
        )}

        {selectedTenantId && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-9 ${FOCUS_FIX}`}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                  <span><strong>{stats.total}</strong> Total</span>
                  <span><strong>{stats.published}</strong> Published</span>
                  <span><strong>{stats.draft}</strong> Draft</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadBatches}
                  disabled={isLoading}
                  title="Refresh"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
              </div>
            )}

            {error && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-destructive">{error}</p>
                  <Button variant="outline" className="mt-4" onClick={loadBatches}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isLoading && !error && filtered.length > 0 && (
              <SortableCardGrid
                items={filtered}
                getId={(b) => b.id}
                getLabel={(b) => b.title}
                enabled={ordering.canDrag}
                onReorder={ordering.save}
                className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                renderCard={(b) => (
                  <Card key={b.id} className="group relative border-t-0">
                    <div className="bg-muted relative aspect-[16/9] overflow-hidden rounded-lg">
                      {b.thumbnailDisplayUrl && (
                        <img
                          src={b.thumbnailDisplayUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="sm" variant="secondary" asChild>
                          <Link href={`/dashboard/batches/${b.id}`}>
                            <Edit className="mr-1 h-3 w-3" /> Edit
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <CardHeader className="py-1.5 pb-0.5">
                      <CardTitle className="line-clamp-1 text-base">
                        {b.title}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        /batches/{b.slug}
                      </CardDescription>
                    </CardHeader>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
                        <Badge variant={b.isPublished ? "default" : "secondary"}>
                          {b.isPublished ? "Published" : "Draft"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {b.itemCount} items · {b.totalEnrollments} enrolled
                        </span>
                    </div>
                    <CardContent className="pt-0 pb-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatPrice(b)}
                          </span>
                          <span className="text-muted-foreground">
                            Starts {formatDateOnly(b.startDate)}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Updated {formatTimestamp(b.updatedAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          {!b.isPublished ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => handleTogglePublish(b.id, b.isPublished)}
                              disabled={togglingId === b.id}
                            >
                              {togglingId === b.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              Publish
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => handleTogglePublish(b.id, b.isPublished)}
                              disabled={togglingId === b.id}
                            >
                              {togglingId === b.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                              Unpublish
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Edit Batch"
                          >
                            <Link href={`/dashboard/batches/${b.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={() => setDeleteId(b.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Full-width public share link, published batches only */}
                        {b.isPublished && (
                          <CopyLinkButton
                            display="full"
                            label="Batch"
                            url={tenantWebBaseUrl ? `${tenantWebBaseUrl}/batches/${b.slug}` : ""}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              />
            )}

            {!isLoading && !error && filtered.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarDays className="text-muted-foreground/50 mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-medium">
                    {searchQuery ? "No batches found" : "No batches yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {searchQuery
                      ? "Try adjusting your search"
                      : "Get started by creating your first batch"}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={() => setIsCreateOpen(true)}
                      disabled={!usage.allowedToAddOne}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Create Batch
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
              <DialogDescription>
                A batch is a fixed-start cohort grouping courses and books.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="batch-title">Batch Title</Label>
                <Input
                  id="batch-title"
                  className={FOCUS_FIX}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., JEE 2026 Cohort"
                />
                {slugPreview && (
                  <p className="text-muted-foreground font-mono text-xs">
                    /batches/{slugPreview}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="batch-start">Start Date</Label>
                  <Input
                    id="batch-start"
                    type="date"
                    className={FOCUS_FIX}
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-end">End Date (optional)</Label>
                  <Input
                    id="batch-end"
                    type="date"
                    className={FOCUS_FIX}
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
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
                      setNewPrices([]);
                    }
                  }}
                />
              </div>

              {!isFree && (
                <>
                  <MultiCurrencyPriceEditor
                    value={newPrices}
                    onChange={setNewPrices}
                    discountMode="percent"
                  />
                  <p className="text-muted-foreground text-xs">
                    All prices should be inclusive of applicable taxes. No
                    additional taxes will be charged to the buyer.
                  </p>
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewTitle("");
                  setNewStartDate("");
                  setNewEndDate("");
                  setIsFree(false);
                  setNewPrices([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  isCreating || !newTitle.trim() || !newStartDate
                }
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Batch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Batch</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The courses and books in the batch
                will not be deleted, only the batch grouping itself.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FeatureGate>
  );
}
