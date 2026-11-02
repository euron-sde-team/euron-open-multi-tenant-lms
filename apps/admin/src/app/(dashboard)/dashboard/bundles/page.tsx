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
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Package,
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
import { bundlesApi, type Bundle } from "@/lib/api/bundles";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import {
  useEntitlements,
  getProductUsage,
} from "@/lib/hooks/use-entitlements";
import { useTenantWebBaseUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { pricesToLegacy } from "@/lib/utils/price-fields";
import { generateSlug } from "@/lib/utils/slug";

// Bundle data structure for list display
interface BundleListItem {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  status: string;
  purchaseMode: string;
  itemCount: number;
  priceInr: string | null;
  priceUsd: string | null;
  validityDays: number | null;
  updatedAt: string;
}

// Convert API Bundle to BundleListItem
function apiBundleToListItem(bundle: Bundle): BundleListItem {
  return {
    id: bundle.id,
    title: bundle.title,
    slug: bundle.slug,
    thumbnailUrl: bundle.thumbnailUrl || undefined,
    isPublished: bundle.status === "PUBLISHED",
    status: bundle.status,
    purchaseMode: bundle.purchaseMode ?? "PAID",
    itemCount: bundle.itemCount,
    priceInr: bundle.priceInr,
    priceUsd: bundle.priceUsd,
    validityDays: bundle.validityDays,
    updatedAt: bundle.updatedAt,
  };
}

export default function BundlesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { selectedTenantId, selectedTenant } = useTenantStore();
  const tenantWebBaseUrl = useTenantWebBaseUrl();

  const { data: entitlements } = useEntitlements(selectedTenantId || undefined);
  const usage = getProductUsage(entitlements, "bundles_count");

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBundleTitle, setNewBundleTitle] = useState("");
  const [isFreeBundle, setIsFreeBundle] = useState(true);
  const [newBundlePrices, setNewBundlePrices] = useState<ContentPrice[]>([]);
  const [deleteBundleId, setDeleteBundleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bundlesData, setBundlesData] = useState<BundleListItem[]>([]);


  // Load bundles from API
  const loadBundles = useCallback(async () => {
    if (!selectedTenantId) {
      setBundlesData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await bundlesApi.getBundles(1, 100);
      const bundles = response.bundles.map(apiBundleToListItem);
      setBundlesData(bundles);
    } catch (err) {
      console.error("Failed to load bundles:", err);
      setError("Failed to load bundles. Please try again.");
      setBundlesData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenantId]);

  // Load bundles when tenant changes
  useEffect(() => {
    loadBundles();
  }, [loadBundles]);

  // Filter bundles by search query
  const filteredBundles = useMemo(() => {
    if (!bundlesData) return [];
    if (!searchQuery.trim()) return bundlesData;

    const query = searchQuery.toLowerCase();
    return bundlesData.filter(
      (bundle) =>
        bundle.title.toLowerCase().includes(query) ||
        bundle.slug.toLowerCase().includes(query)
    );
  }, [bundlesData, searchQuery]);

  // Handles come off while searching, see the note in use-catalog-ordering.
  const ordering = useCatalogOrdering({
    entity: "bundles",
    isFiltered: searchQuery.trim().length > 0,
    onSaved: loadBundles,
  });

  // Compute stats
  const stats = useMemo(() => {
    const bundles = bundlesData || [];
    return {
      total: bundles.length,
      published: bundles.filter((b) => b.isPublished).length,
      draft: bundles.filter((b) => !b.isPublished).length,
    };
  }, [bundlesData]);

  // Generate slug preview from title
  const slugPreview = useMemo(() => {
    if (!newBundleTitle.trim()) return "";
    return generateSlug(newBundleTitle);
  }, [newBundleTitle]);

  // Handle create bundle
  const handleCreateBundle = async () => {
    if (!selectedTenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant first.",
        variant: "destructive",
      });
      return;
    }

    if (!newBundleTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a bundle title.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const legacy = pricesToLegacy(newBundlePrices);
      const newBundle = await bundlesApi.createBundle({
        title: newBundleTitle.trim(),
        slug: generateSlug(newBundleTitle),
        purchase_mode: isFreeBundle ? "FREE" : "PAID",
        price_inr: isFreeBundle || legacy.inr == null ? null : String(legacy.inr),
        price_usd: isFreeBundle || legacy.usd == null ? null : String(legacy.usd),
        discount_inr: null,
        discount_usd: null,
        prices: isFreeBundle ? undefined : newBundlePrices,
      });

      setIsCreateDialogOpen(false);
      setNewBundleTitle("");
      setIsFreeBundle(true);
      setNewBundlePrices([]);

      toast({
        title: "Success",
        description: "Bundle created successfully. Redirecting to editor...",
      });

      // Navigate to the editor
      router.push(`/dashboard/bundles/${newBundle.id}`);
    } catch (err) {
      console.error("Failed to create bundle:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create bundle. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete bundle
  const handleDeleteBundle = async () => {
    if (!deleteBundleId) return;

    setIsDeleting(true);

    try {
      await bundlesApi.deleteBundle(deleteBundleId);

      // Update local state
      setBundlesData((prev) => prev.filter((b) => b.id !== deleteBundleId));
      setDeleteBundleId(null);

      toast({
        title: "Success",
        description: "Bundle deleted successfully.",
      });
    } catch (err) {
      console.error("Failed to delete bundle:", err);
      toast({
        title: "Error",
        description: "Failed to delete bundle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle toggle publish
  const handleTogglePublish = async (bundleId: string, currentStatus: boolean) => {
    setIsToggling(bundleId);

    try {
      const updatedBundle = await bundlesApi.togglePublish(bundleId, !currentStatus);

      // Update local state
      setBundlesData((prev) =>
        prev.map((b) =>
          b.id === bundleId
            ? {
                ...b,
                isPublished: updatedBundle.status === "PUBLISHED",
                status: updatedBundle.status,
              }
            : b
        )
      );

      toast({
        title: "Success",
        description: currentStatus
          ? "Bundle unpublished."
          : "Bundle published successfully.",
      });
    } catch (err) {
      console.error("Failed to toggle publish status:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to update publish status. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsToggling(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format price
  const formatPrice = (bundle: BundleListItem) => {
    if (bundle.purchaseMode === "FREE") return "Free";
    if (bundle.priceInr) return `₹${bundle.priceInr}`;
    if (bundle.priceUsd) return `$${bundle.priceUsd}`;
    return "Free";
  };

  return (
    <FeatureGate featureKeys={["bundles"]}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bundles</h1>
          <p className="text-muted-foreground">
            Manage course and book bundles for{" "}
            {selectedTenant?.tenant_name || "your tenant"}
          </p>
          {selectedTenantId && (
            <p className="text-muted-foreground mt-1 text-sm">
              {usage.used} / {usage.isUnlimited ? "Unlimited" : usage.limit} bundles used
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TenantSelector />
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={!selectedTenantId || !usage.allowedToAddOne}
            title={
              !usage.allowedToAddOne
                ? "Bundle limit reached. Upgrade your plan."
                : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Bundle
          </Button>
        </div>
      </div>

      {/* No Tenant Selected */}
      {!selectedTenantId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              Please select a tenant to view and manage bundles.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {selectedTenantId && (
        <div className="space-y-6">
          {/* Search and Stats */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search bundles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span>
                  <strong>{stats.total}</strong> Total
                </span>
                <span>
                  <strong>{stats.published}</strong> Published
                </span>
                <span>
                  <strong>{stats.draft}</strong> Draft
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadBundles}
                disabled={isLoading}
                title="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={loadBundles}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bundles Grid */}
          {!isLoading && !error && filteredBundles.length > 0 && (
            <SortableCardGrid
              items={filteredBundles}
              getId={(bundle) => bundle.id}
              getLabel={(bundle) => bundle.title}
              enabled={ordering.canDrag}
              onReorder={ordering.save}
              className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              renderCard={(bundle) => (
                <Card key={bundle.id} className="group relative border-t-0">
                  {/* Thumbnail */}
                  <div className="bg-muted relative aspect-[1/1] overflow-hidden rounded-lg">
                    {(() => {
                      const url = resolveThumbnailForDisplay(bundle.thumbnailUrl);
                      return url ? (
                        <img
                          src={url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null;
                    })()}
                    {/* Hover Actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/dashboard/bundles/${bundle.id}`}>
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <CardHeader className="py-1.5 pb-0.5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="line-clamp-1 text-base">
                          {bundle.title}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          /bundles/{bundle.slug}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
                      <Badge
                        variant={bundle.isPublished ? "default" : "secondary"}
                      >
                        {bundle.isPublished ? "Published" : "Draft"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {bundle.itemCount} items
                      </span>
                  </div>

                  <CardContent className="pt-0 pb-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {formatPrice(bundle)}
                        </span>
                        {bundle.validityDays && (
                          <span className="text-muted-foreground">
                            {bundle.validityDays} days
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Updated {formatDate(bundle.updatedAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Publish/Unpublish Button */}
                        {!bundle.isPublished ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() =>
                              handleTogglePublish(bundle.id, bundle.isPublished)
                            }
                            disabled={isToggling === bundle.id}
                          >
                            {isToggling === bundle.id ? (
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
                            onClick={() =>
                              handleTogglePublish(bundle.id, bundle.isPublished)
                            }
                            disabled={isToggling === bundle.id}
                          >
                            {isToggling === bundle.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                            Unpublish
                          </Button>
                        )}

                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                          title="Edit Bundle"
                        >
                          <Link href={`/dashboard/bundles/${bundle.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => setDeleteBundleId(bundle.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Full-width public share link, published bundles only */}
                      {bundle.isPublished && (
                        <CopyLinkButton
                          display="full"
                          label="Bundle"
                          url={tenantWebBaseUrl ? `${tenantWebBaseUrl}/bundles/${bundle.slug}` : ""}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredBundles.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "No bundles found" : "No bundles yet"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by creating your first bundle"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    disabled={!usage.allowedToAddOne}
                    title={
                      !usage.allowedToAddOne
                        ? "Bundle limit reached. Upgrade your plan."
                        : undefined
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Bundle
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Bundle Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Bundle</DialogTitle>
            <DialogDescription>
              Enter a title and set pricing. You can add courses, books, and other
              details in the editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="bundle-title">Bundle Title</Label>
              <Input
                id="bundle-title"
                value={newBundleTitle}
                onChange={(e) => setNewBundleTitle(e.target.value)}
                placeholder="e.g., Full Stack Developer Bundle"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBundleTitle.trim()) {
                    handleCreateBundle();
                  }
                }}
              />
              {slugPreview && (
                <p className="text-muted-foreground font-mono text-xs">
                  /bundles/{slugPreview}
                </p>
              )}
            </div>

            {/* Free bundle toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="free-bundle">Free bundle</Label>
                <p className="text-muted-foreground text-xs">
                  When enabled, the bundle will be free for learners.
                </p>
              </div>
              <Switch
                id="free-bundle"
                checked={isFreeBundle}
                onCheckedChange={(checked) => {
                  setIsFreeBundle(checked);
                  if (checked) {
                    setNewBundlePrices([]);
                  }
                }}
              />
            </div>

            {/* Price fields - shown when not free */}
            {!isFreeBundle && (
              <>
                <MultiCurrencyPriceEditor
                  value={newBundlePrices}
                  onChange={setNewBundlePrices}
                  discountMode="percent"
                />
                <p className="text-muted-foreground text-xs">
                  All prices should be inclusive of applicable taxes. No additional taxes will be charged to the buyer.
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewBundleTitle("");
                setIsFreeBundle(true);
                setNewBundlePrices([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBundle}
              disabled={isCreating || !newBundleTitle.trim()}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Bundle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteBundleId}
        onOpenChange={(open) => !open && setDeleteBundleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bundle? This action cannot be
              undone. The courses and books in the bundle will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBundle}
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
