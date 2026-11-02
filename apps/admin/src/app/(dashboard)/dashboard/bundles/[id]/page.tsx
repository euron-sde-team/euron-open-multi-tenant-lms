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
  Separator,
  Switch,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import type { ContentPrice } from "@open-mtlms/shared";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ClipboardList,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import { booksApi, type Book } from "@/lib/api/books";
import {
  bundlesApi,
  type BundleDetail,
  type UpdateBundleRequest,
} from "@/lib/api/bundles";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { testSeriesApi, type TestSeries } from "@/lib/api/test-series";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import { uploadApi } from "@/lib/api/upload";
import { useCourseAIGeneration } from "@/lib/hooks/useCourseAIGeneration";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { LMSCourse } from "@/lib/types/course-lms";
import { legacyToPrices, pricesToLegacy } from "@/lib/utils/price-fields";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

export default function BundleDetailPage() {
  const { toast } = useToast();
  const params = useParams();
  const bundleId = (params?.id ?? "") as string;
  const { selectedTenantId } = useTenantStore();

  // Bundle state
  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFreeBundle, setIsFreeBundle] = useState(true);
  const [prices, setPrices] = useState<ContentPrice[]>([]);
  const [validityDays, setValidityDays] = useState("");
  const [lifetime, setLifetime] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  // Add item state
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [addItemType, setAddItemType] = useState<
    "COURSE" | "BOOK" | "TEST_SERIES"
  >("COURSE");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<LMSCourse[]>([]);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [availableTestSeries, setAvailableTestSeries] = useState<TestSeries[]>(
    []
  );
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Delete item state
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Thumbnail upload state
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // AI thumbnail generation
  const thumbnailAI = useCourseAIGeneration();
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const isGeneratingThumbnail = thumbnailAI.isActive;

  // Load bundle (full load - resets form state)
  const loadBundle = useCallback(async () => {
    if (!bundleId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await bundlesApi.getBundle(bundleId);
      setBundle(data);
      // Populate form
      setTitle(data.title);
      setSlug(data.slug);
      setSubtitle(data.subtitle || "");
      setDescription(data.description || "");
      setIsFreeBundle(data.purchaseMode === "FREE");
      setPrices(
        data.prices?.length
          ? data.prices
          : legacyToPrices(data.priceInr, data.priceUsd, null, null)
      );
      setValidityDays(data.validityDays?.toString() || "");
      setLifetime(data.validityDays === null);
      setThumbnailUrl(data.thumbnailUrl || "");
      setPreviewUrl(data.previewUrl || "");
    } catch (err) {
      console.error("Failed to load bundle:", err);
      setError("Failed to load bundle. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [bundleId]);

  // Refresh only bundle data (items) - does NOT reset form state or show loading
  const refreshBundleItems = useCallback(async () => {
    if (!bundleId) return;
    try {
      const data = await bundlesApi.getBundle(bundleId);
      setBundle(data);
    } catch (err) {
      console.error("Failed to refresh bundle items:", err);
    }
  }, [bundleId]);

  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  // Load available courses and books for add item dialog
  const loadAvailableItems = useCallback(async () => {
    if (!selectedTenantId) return;

    setIsLoadingItems(true);
    try {
      const [coursesRes, booksRes, testSeriesRes] = await Promise.all([
        coursesLmsApi.getCourses({ page: 1, limit: 100 }),
        booksApi.getBooks(1, 100),
        testSeriesApi.list({ page: 1, limit: 100 }),
      ]);
      setAvailableCourses(coursesRes.courses);
      setAvailableBooks(booksRes.books);
      setAvailableTestSeries(testSeriesRes.series);
    } catch (err) {
      console.error("Failed to load items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (isAddItemDialogOpen) {
      loadAvailableItems();
    }
  }, [isAddItemDialogOpen, loadAvailableItems]);

  // Save bundle
  const handleSave = async () => {
    if (!bundle) return;

    setIsSaving(true);

    try {
      const legacy = pricesToLegacy(prices);
      const updateData: UpdateBundleRequest = {
        title,
        slug,
        subtitle: subtitle || null,
        description: description || null,
        purchase_mode: isFreeBundle ? "FREE" : "PAID",
        price_inr: isFreeBundle || legacy.inr == null ? null : String(legacy.inr),
        price_usd: isFreeBundle || legacy.usd == null ? null : String(legacy.usd),
        discount_inr: null,
        discount_usd: null,
        prices: isFreeBundle ? undefined : prices,
        validity_days: lifetime ? null : validityDays ? parseInt(validityDays, 10) : 365,
        thumbnail_url: thumbnailUrl || null,
        preview_url: previewUrl || null,
      };

      const updated = await bundlesApi.updateBundle(bundle.id, updateData);
      setBundle(updated);

      toast({
        title: "Success",
        description: "Bundle saved successfully.",
      });
    } catch (err) {
      console.error("Failed to save bundle:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save bundle. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle publish
  const handleTogglePublish = async () => {
    if (!bundle) return;

    setIsToggling(true);

    try {
      const isPublished = bundle.status === "PUBLISHED";
      const updated = await bundlesApi.togglePublish(bundle.id, !isPublished);
      setBundle(updated);

      toast({
        title: "Success",
        description: isPublished
          ? "Bundle unpublished."
          : "Bundle published successfully.",
      });
    } catch (err) {
      console.error("Failed to toggle publish:", err);
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
      setIsToggling(false);
    }
  };

  // Handle thumbnail upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTenantId) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingThumbnail(true);

    try {
      const result = await uploadApi.uploadBundleThumbnail(file, {
        type: "bundle_thumbnail",
        tenantId: selectedTenantId,
        bundleId: bundle?.id ?? null,
      });

      setThumbnailUrl(result.key);
      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully",
      });
    } catch (err) {
      console.error("Failed to upload thumbnail:", err);
      toast({
        title: "Error",
        description: "Failed to upload thumbnail. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingThumbnail(false);
      // Reset input
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = "";
      }
    }
  };

  // AI thumbnail generation
  const handleGenerateThumbnail = useCallback(async () => {
    if (thumbnailAI.isActive) return;

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please set a bundle title before generating a thumbnail",
        variant: "destructive",
      });
      return;
    }

    await thumbnailAI.submit({
      courseTitle: title.trim(),
      sections: ["thumbnails"],
      extraContext: `This is a BUNDLE (collection of courses and books): NOT a single course. Design the thumbnail as a wide BANNER/HERO image suitable for a panoramic banner display (21:9 aspect ratio). Use a panoramic, cinematic composition. Place the title large and centered. Keep important content in the center 60% of the image horizontally, as edges may be cropped. Use bold, sweeping gradients and wide visual elements. Do NOT place text or important elements near the left/right edges. The subtitle is: "${subtitle.trim() || "A curated learning bundle"}"`,
      courseMetadata: {
        subTitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
      },
    });
  }, [thumbnailAI, title, subtitle, description, toast]);

  // Handle AI thumbnail generation completion
  useEffect(() => {
    if (thumbnailAI.state === "completed" && thumbnailAI.result) {
      const dataUrl = thumbnailAI.result.webThumbnailDataUrl || thumbnailAI.result.mobileThumbnailDataUrl;
      if (dataUrl && selectedTenantId) {
        // Upload the AI-generated data URL as a file
        const [header, data] = dataUrl.split(",");
        const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], "ai-thumbnail.jpg", { type: mime });

        setIsUploadingThumbnail(true);
        uploadApi
          .uploadBundleThumbnail(file, {
            type: "bundle_thumbnail",
            tenantId: selectedTenantId,
            bundleId: bundle?.id ?? null,
          })
          .then((result) => {
            setThumbnailUrl(result.key);
            toast({
              title: "Success",
              description: "AI thumbnail generated and uploaded!",
            });
          })
          .catch(() => {
            toast({
              title: "Error",
              description: "Failed to upload AI-generated thumbnail.",
              variant: "destructive",
            });
          })
          .finally(() => setIsUploadingThumbnail(false));
      } else {
        toast({
          title: "Error",
          description: "No thumbnail was generated. Please try again.",
          variant: "destructive",
        });
      }
    } else if (thumbnailAI.state === "failed") {
      toast({
        title: "Generation failed",
        description: thumbnailAI.error ?? "Failed to generate thumbnail",
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbnailAI.state]);

  // Add items to bundle (supports multiple selection)
  const handleAddItems = async () => {
    if (!bundle || selectedItemIds.length === 0) return;

    setIsAddingItem(true);

    try {
      // Add items sequentially
      for (const itemId of selectedItemIds) {
        await bundlesApi.addBundleItem(bundle.id, {
          item_type: addItemType,
          course_id: addItemType === "COURSE" ? itemId : null,
          book_id: addItemType === "BOOK" ? itemId : null,
          test_series_id: addItemType === "TEST_SERIES" ? itemId : null,
        });
      }

      // Refresh only bundle items - preserves form state (Details, Pricing) and active tab
      await refreshBundleItems();
      setIsAddItemDialogOpen(false);
      setSelectedItemIds([]);

      toast({
        title: "Success",
        description: `${selectedItemIds.length} ${itemTypeNoun} added to bundle.`,
      });
    } catch (err) {
      console.error("Failed to add items:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add items. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAddingItem(false);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Select all items
  const selectAllItems = () => {
    setSelectedItemIds(getPickerItems().map((item) => item.id));
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItemIds([]);
  };

  // Remove item from bundle
  const handleRemoveItem = async () => {
    if (!bundle || !deleteItemId) return;

    setIsDeletingItem(true);

    try {
      await bundlesApi.removeBundleItem(bundle.id, deleteItemId);

      // Update local state
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((item) => item.id !== deleteItemId),
              itemCount: prev.itemCount - 1,
            }
          : null
      );
      setDeleteItemId(null);

      toast({
        title: "Success",
        description: "Item removed from bundle.",
      });
    } catch (err) {
      console.error("Failed to remove item:", err);
      toast({
        title: "Error",
        description: "Failed to remove item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Get items not yet in bundle
  const getAvailableCourses = () => {
    if (!bundle) return availableCourses;
    const bundleCourseIds = new Set(
      bundle.items.filter((i) => i.itemType === "COURSE").map((i) => i.courseId)
    );
    return availableCourses.filter((c) => !bundleCourseIds.has(c.id));
  };

  const getAvailableBooks = () => {
    if (!bundle) return availableBooks;
    const bundleBookIds = new Set(
      bundle.items.filter((i) => i.itemType === "BOOK").map((i) => i.bookId)
    );
    return availableBooks.filter((b) => !bundleBookIds.has(b.id));
  };

  const getAvailableTestSeries = () => {
    if (!bundle) return availableTestSeries;
    const bundleTestSeriesIds = new Set(
      bundle.items
        .filter((i) => i.itemType === "TEST_SERIES")
        .map((i) => i.testSeriesId)
    );
    return availableTestSeries.filter((t) => !bundleTestSeriesIds.has(t.id));
  };

  // Unified picker rows for the active item type, avoids duplicated markup per type
  const getPickerItems = (): {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
  }[] => {
    if (addItemType === "COURSE") {
      return getAvailableCourses().map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        thumbnailUrl: resolveThumbnailForDisplay(
          c.thumbnailKey ?? c.thumbnailUrl
        ),
      }));
    }
    if (addItemType === "BOOK") {
      return getAvailableBooks().map((b) => ({
        id: b.id,
        title: b.title,
        slug: b.slug,
        thumbnailUrl: resolveThumbnailForDisplay(b.thumbnailUrl),
      }));
    }
    return getAvailableTestSeries().map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      thumbnailUrl: resolveThumbnailForDisplay(t.coverImageKey),
    }));
  };

  const itemTypeNoun =
    addItemType === "COURSE"
      ? "course(s)"
      : addItemType === "BOOK"
        ? "book(s)"
        : "test series";
  const itemTypeLabelPlural =
    addItemType === "COURSE"
      ? "Courses"
      : addItemType === "BOOK"
        ? "Books"
        : "Test Series";

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !bundle) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/bundles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bundles
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{error || "Bundle not found"}</p>
            <Button variant="outline" className="mt-4" onClick={loadBundle}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPublished = bundle.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/bundles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{bundle.title}</h1>
              <Badge variant={isPublished ? "default" : "secondary"}>
                {isPublished ? "Published" : "Draft"}
              </Badge>
              <Badge variant="outline">{bundle.items.length} items</Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              /bundles/{bundle.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTogglePublish} disabled={isToggling}>
            {isToggling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isPublished ? (
              <EyeOff className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
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

      {/* Top row: Basic Info | Pricing | Media - same row on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Basic Information */}
        <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Configure the bundle title, slug, and description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Bundle title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="bundle-slug"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="A brief subtitle for the bundle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what's included in this bundle..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

        {/* Pricing & Validity */}
        <Card>
            <CardHeader>
              <CardTitle>Pricing & Validity</CardTitle>
              <CardDescription>
                Set price, discounts, and access duration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Free bundle toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-free-bundle">Free bundle</Label>
                  <p className="text-muted-foreground text-xs">
                    When enabled, the bundle will be free for learners.
                  </p>
                </div>
                <Switch
                  id="edit-free-bundle"
                  checked={isFreeBundle}
                  onCheckedChange={(checked) => {
                    setIsFreeBundle(checked);
                    if (checked) {
                      setPrices([]);
                    }
                  }}
                />
              </div>

              {!isFreeBundle && (
                <MultiCurrencyPriceEditor
                  value={prices}
                  onChange={setPrices}
                  discountMode="percent"
                />
              )}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-lifetime-access">Lifetime access</Label>
                  <p className="text-muted-foreground text-xs">
                    Learners keep access forever, with no expiry.
                  </p>
                </div>
                <Switch
                  id="edit-lifetime-access"
                  checked={lifetime}
                  onCheckedChange={setLifetime}
                />
              </div>
              {!lifetime && (
                <div className="space-y-2">
                  <Label htmlFor="validityDays">Validity (Days)</Label>
                  <Input
                    id="validityDays"
                    type="number"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    placeholder="365"
                  />
                  <p className="text-muted-foreground text-xs">
                    Access is valid for this many days after purchase. Default: 365.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Media */}
        <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Media</CardTitle>
                  <CardDescription>
                    Thumbnail and preview images.
                  </CardDescription>
                </div>
                {aiAuthoringEnabled && (
                  <button
                    type="button"
                    onClick={handleGenerateThumbnail}
                    disabled={isGeneratingThumbnail || isUploadingThumbnail}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: "hsl(var(--border))" }}
                    title="Generate thumbnail with AI"
                  >
                    {isGeneratingThumbnail ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(var(--primary))" }} />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--primary))" }} />
                        AI
                      </>
                    )}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
                disabled={isUploadingThumbnail}
              />
              {thumbnailUrl ? (
                <div className="relative">
                  <img
                    src={resolveThumbnailForDisplay(thumbnailUrl) ?? ""}
                    alt="Bundle thumbnail"
                    className="max-h-40 max-w-64 rounded-lg object-cover"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={isUploadingThumbnail}
                    >
                      {isUploadingThumbnail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Replace
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setThumbnailUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !isUploadingThumbnail && thumbnailInputRef.current?.click()}
                  className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50"
                >
                  {isUploadingThumbnail ? (
                    <>
                      <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, GIF, WebP up to 10MB
                      </p>
                    </>
                  )}
                </div>
              )}
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="previewUrl">Preview URL</Label>
                <Input
                  id="previewUrl"
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Bundle Items - full width below */}
      <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bundle Items</CardTitle>
                <CardDescription>
                  Courses, books, and test series included in this bundle.
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddItemDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {bundle.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="text-muted-foreground/50 mb-4 h-12 w-12" />
                  <p className="text-muted-foreground mb-4">
                    No items in this bundle yet.
                  </p>
                  <Button onClick={() => setIsAddItemDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {bundle.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-lg border p-3"
                    >
                      <div className="text-muted-foreground">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="bg-muted h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                        {(() => {
                          const url =
                            item.itemType === "COURSE"
                              ? resolveThumbnailForDisplay(item.courseThumbnailKey)
                              : item.itemType === "BOOK"
                                ? resolveThumbnailForDisplay(item.bookThumbnailUrl)
                                : resolveThumbnailForDisplay(
                                    item.testSeriesCoverImageKey
                                  );
                          return url ? (
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null;
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.itemType === "COURSE" ? (
                              <>
                                <Video className="mr-1 h-3 w-3" />
                                Course
                              </>
                            ) : item.itemType === "BOOK" ? (
                              <>
                                <BookOpen className="mr-1 h-3 w-3" />
                                Book
                              </>
                            ) : (
                              <>
                                <ClipboardList className="mr-1 h-3 w-3" />
                                Test Series
                              </>
                            )}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            #{index + 1}
                          </span>
                        </div>
                        <p className="font-medium truncate">
                          {item.itemType === "COURSE"
                            ? item.courseTitle
                            : item.itemType === "BOOK"
                              ? item.bookTitle
                              : item.testSeriesTitle}
                        </p>
                        <p className="text-muted-foreground font-mono text-xs truncate">
                          {item.itemType === "COURSE"
                            ? `/courses/${item.courseSlug}`
                            : item.itemType === "BOOK"
                              ? `/books/${item.bookSlug}`
                              : `/test-series/${item.testSeriesSlug}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive flex-shrink-0"
                        onClick={() => setDeleteItemId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Items to Bundle</DialogTitle>
            <DialogDescription>
              Select courses, books, or test series to add to this bundle. You
              can select multiple items at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select
                value={addItemType}
                onValueChange={(v) => {
                  setAddItemType(v as "COURSE" | "BOOK" | "TEST_SERIES");
                  setSelectedItemIds([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COURSE">Course</SelectItem>
                  <SelectItem value="BOOK">Book</SelectItem>
                  <SelectItem value="TEST_SERIES">Test Series</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select {itemTypeLabelPlural}</Label>
                {!isLoadingItems && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllItems}
                      className="h-auto px-2 py-1 text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllItems}
                      className="h-auto px-2 py-1 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {getPickerItems().length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No {itemTypeLabelPlural.toLowerCase()} available to add
                    </p>
                  ) : (
                    getPickerItems().map((pickerItem) => (
                      <div
                        key={pickerItem.id}
                        onClick={() => toggleItemSelection(pickerItem.id)}
                        className={`flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted ${
                          selectedItemIds.includes(pickerItem.id)
                            ? "bg-primary/10 ring-1 ring-primary"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                            selectedItemIds.includes(pickerItem.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {selectedItemIds.includes(pickerItem.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                        <div className="bg-muted h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                          {pickerItem.thumbnailUrl ? (
                            <img
                              src={pickerItem.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {pickerItem.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pickerItem.slug}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {selectedItemIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedItemIds.length} {itemTypeNoun} selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddItemDialogOpen(false);
                setSelectedItemIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItems}
              disabled={isAddingItem || selectedItemIds.length === 0}
            >
              {isAddingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {selectedItemIds.length > 0 ? `${selectedItemIds.length} Item${selectedItemIds.length > 1 ? "s" : ""}` : "Items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog
        open={!!deleteItemId}
        onOpenChange={(open) => !open && setDeleteItemId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this item from the bundle? The
              underlying course, book, or test series itself will not be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingItem}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingItem}
            >
              {isDeletingItem && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
