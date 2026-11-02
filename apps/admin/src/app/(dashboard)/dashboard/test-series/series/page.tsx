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
  SkeletonRows,
  Textarea,
  useToast,
  PartOfBundleBadge,
  cn,
} from "@open-mtlms/core";
import type { ContentPrice } from "@open-mtlms/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SortableCardGrid } from "@/components/ordered-products/sortable-card-grid";
import { useCatalogOrdering } from "@/components/ordered-products/use-catalog-ordering";
import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import { CopyLinkButton } from "@/components/shared/copy-link-button";
import { useTestSeriesAITextField } from "@/components/test-series/use-test-series-ai-fields";
import type {
  TestSeries,
  TestSeriesPricingType,
  TestSeriesVisibility,
} from "@/lib/api/test-series";
import { useTenantWebBaseUrl } from "@/lib/hooks/use-tenant-domain-url";
import {
  useTestSeriesList,
  useCreateTestSeries,
  useDeleteTestSeries,
  usePublishTestSeries,
  useUnpublishTestSeries,
  useTestSeriesEntitlementUsage,
  testSeriesKeys,
} from "@/lib/hooks/use-test-series";
import { pricesToLegacy } from "@/lib/utils/price-fields";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

function StatusBadge({ status }: { status: string }) {
  const variant: "default" | "secondary" | "outline" =
    status === "PUBLISHED" ? "default" : status === "DRAFT" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function formatPriceLabel(
  price: string | null,
  discountPct: string | null,
  currency: "INR" | "USD"
): React.ReactNode {
  if (!price) return null;
  const priceNum = parseFloat(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  const pct = discountPct ? parseFloat(discountPct) : 0;
  const symbol = currency === "INR" ? "₹" : "$";
  const formatNum = (n: number) =>
    currency === "USD" ? n.toFixed(2) : n.toLocaleString("en-IN");
  if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
    const effective = priceNum * (1 - pct / 100);
    return (
      <span>
        {symbol}
        {formatNum(effective)}{" "}
        <span className="text-muted-foreground/70 line-through">
          {symbol}
          {formatNum(priceNum)}
        </span>
      </span>
    );
  }
  return (
    <span>
      {symbol}
      {formatNum(priceNum)}
    </span>
  );
}

export default function TestSeriesListPage() {
  const { toast } = useToast();
  const router = useRouter();
  const tenantWebBaseUrl = useTenantWebBaseUrl();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricing, setPricing] = useState<TestSeriesPricingType>("FREE");
  const [prices, setPrices] = useState<ContentPrice[]>([]);
  const [visibility, setVisibility] = useState<TestSeriesVisibility>("PUBLIC");

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTestSeriesList({ limit: 100 });
  const createMut = useCreateTestSeries();
  const deleteMut = useDeleteTestSeries();
  const publishMut = usePublishTestSeries();
  const unpublishMut = useUnpublishTestSeries();

  // Entitlement usage for `testseries_count`. Backend returns the live
  // PUBLISHED count straight from the table paired with the entitlement
  // limit, so the badge can never lie. Refreshed automatically when the
  // publish / unpublish / delete mutations invalidate the series subtree.
  const { data: usage } = useTestSeriesEntitlementUsage();
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 0;
  const isUnlimited = usage?.isUnlimited ?? true;
  const atCapacity = usage?.atCapacity ?? false;

  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const titleAI = useTestSeriesAITextField((text) => {
    setTitle(text);
    toast({ title: "Title generated" });
  });
  const descriptionAI = useTestSeriesAITextField((text) => {
    setDescription(text);
    toast({ title: "Description generated" });
  });

  const handleGenerateAITitle = async () => {
    if (titleAI.isActive) return;
    try {
      await titleAI.generate({
        kind: "title",
        topic: title.trim() || description.trim() || null,
        category: null,
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
        description: "AI uses the title to generate a matching description.",
        variant: "destructive",
      });
      return;
    }
    try {
      await descriptionAI.generate({
        kind: "description",
        title: title.trim(),
        category: null,
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

  const filtered = useMemo(() => {
    const series = data?.series ?? [];
    if (!search.trim()) return series;
    const q = search.toLowerCase();
    return series.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
    );
  }, [data?.series, search]);

  // Handles come off while searching, see the note in use-catalog-ordering.
  // Invalidate the whole series namespace, not just this list key: every
  // filter combination is its own cache entry, and they all just changed.
  const ordering = useCatalogOrdering({
    entity: "test_series",
    isFiltered: search.trim().length > 0,
    onSaved: () =>
      void queryClient.invalidateQueries({ queryKey: testSeriesKeys.series.all }),
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPricing("FREE");
    setPrices([]);
    setVisibility("PUBLIC");
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const isPaid = pricing === "PAID";
    if (isPaid && !prices.some((p) => p.amount > 0)) {
      toast({
        title: "Price required",
        description: "Paid series must have a price in at least one currency.",
        variant: "destructive",
      });
      return;
    }
    const legacy = pricesToLegacy(prices);
    createMut.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        pricing_type: pricing,
        price_inr: isPaid ? legacy.inr : null,
        price_usd: isPaid ? legacy.usd : null,
        discount_inr: isPaid ? legacy.discountInr : null,
        discount_usd: isPaid ? legacy.discountUsd : null,
        prices: isPaid ? prices : undefined,
        visibility,
      },
      {
        onSuccess: (created) => {
          toast({ title: "Test series created" });
          setCreateOpen(false);
          resetForm();
          if (created?.id) {
            router.push(`/dashboard/test-series/series/${created.id}`);
          }
        },
        onError: (err) => {
          toast({
            title: "Failed to create",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handlePublishToggle = (s: TestSeries) => {
    const action = s.status === "PUBLISHED" ? unpublishMut : publishMut;
    action.mutate(s.id, {
      onSuccess: () => {
        toast({
          title: s.status === "PUBLISHED" ? "Series unpublished" : "Series published",
        });
      },
      onError: (err) => {
        toast({
          title: "Failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: "Series deleted" });
        setDeleteId(null);
      },
      onError: (err) => {
        toast({
          title: "Failed to delete",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to test series
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
          <p className="text-muted-foreground mt-1">
            Bundle tests, set pricing and visibility, and publish to your catalog.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={atCapacity ? "destructive" : "secondary"}>
              Published: {used}
              {isUnlimited ? " / unlimited" : ` / ${limit}`}
            </Badge>
            {atCapacity && (
              <span className="text-destructive text-xs">
                Limit reached. Unpublish a series or upgrade your plan to publish more.
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Series
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search series…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} rowClassName="h-24" />
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load series"}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground">
              {search ? "No matching series" : "No test series yet"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first series
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <SortableCardGrid
          items={filtered}
          getId={(s) => s.id}
          getLabel={(s) => s.title}
          enabled={ordering.canDrag}
          onReorder={ordering.save}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          renderCard={(s) => (
            <Card
              key={s.id}
              className={cn(
                "transition-shadow hover:shadow-md",
                // Reserve a left gutter for the drag handle so it doesn't cover
                // the title's first character on these text-top cards.
                ordering.canDrag && "pl-6"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-base">{s.title}</CardTitle>
                  <StatusBadge status={s.status} />
                </div>
                {s.bundles && s.bundles.length > 0 && (
                  <div className="mt-1">
                    <PartOfBundleBadge bundles={s.bundles} asLink={false} />
                  </div>
                )}
                <CardDescription className="line-clamp-2">
                  {s.description ?? "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span>{s.pricingType}</span>
                  {s.pricingType === "PAID" && (
                    <span className="flex items-center gap-1">
                      {formatPriceLabel(s.priceInr, s.discountInr, "INR")}
                      {s.priceInr && s.priceUsd ? (
                        <span className="text-muted-foreground/60">|</span>
                      ) : null}
                      {formatPriceLabel(s.priceUsd, s.discountUsd, "USD")}
                    </span>
                  )}
                  <span>•</span>
                  <span>{s.visibility}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Link href={`/dashboard/test-series/series/${s.id}`}>
                    <Button variant="outline" size="sm">
                      <Settings className="mr-1 h-3 w-3" />
                      Manage
                    </Button>
                  </Link>
                  <div className="flex gap-1">
                    <Link href={`/dashboard/test-series/series/${s.id}/analytics`}>
                      <Button variant="ghost" size="sm" title="Analytics">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePublishToggle(s)}
                      disabled={
                        publishMut.isPending ||
                        unpublishMut.isPending ||
                        // Block publishing a draft when the tenant is at
                        // capacity. Unpublish is always allowed.
                        (s.status !== "PUBLISHED" && atCapacity)
                      }
                      title={
                        s.status === "PUBLISHED"
                          ? "Unpublish"
                          : atCapacity
                            ? "Publish limit reached"
                            : "Publish"
                      }
                    >
                      {s.status === "PUBLISHED" ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Full-width public share link, published test series only */}
                {s.status === "PUBLISHED" && (
                  <CopyLinkButton
                    display="full"
                    label="Test series"
                    className="mt-3 w-full gap-2"
                    url={tenantWebBaseUrl ? `${tenantWebBaseUrl}/test-series/${s.slug}` : ""}
                  />
                )}
              </CardContent>
            </Card>
          )}
        />
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Test Series</DialogTitle>
            <DialogDescription>
              You can add tests, set pricing, and configure access after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="series-title">Title *</Label>
                {aiAuthoringEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={handleGenerateAITitle}
                    disabled={titleAI.isActive}
                    type="button"
                  >
                    {titleAI.isActive ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    AI
                  </Button>
                )}
              </div>
              <Input
                id="series-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="JEE Main 2026 Mock Series"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="series-description">Description</Label>
                {aiAuthoringEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={handleGenerateAIDescription}
                    disabled={descriptionAI.isActive || !title.trim()}
                    type="button"
                  >
                    {descriptionAI.isActive ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    AI
                  </Button>
                )}
              </div>
              <Textarea
                id="series-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="series-pricing">Pricing</Label>
                <Select
                  value={pricing}
                  onValueChange={(v) => setPricing(v as TestSeriesPricingType)}
                >
                  <SelectTrigger id="series-pricing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="series-visibility">Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as TestSeriesVisibility)}
                >
                  <SelectTrigger id="series-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public (catalog)</SelectItem>
                    <SelectItem value="UNLISTED">Unlisted (link only)</SelectItem>
                    <SelectItem value="PRIVATE">Private (invite only)</SelectItem>
                  </SelectContent>
                </Select>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || createMut.isPending}
            >
              {createMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
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
            <AlertDialogTitle>Delete this test series?</AlertDialogTitle>
            <AlertDialogDescription>
              Active enrollments will lose access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
