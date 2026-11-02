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
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { Edit, FolderTree, ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { FeatureGate } from "@/components/feature-gate/FeatureGate";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import { uploadApi } from "@/lib/api/upload";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/lib/hooks/use-categories";
import { getProductUsage, useEntitlements } from "@/lib/hooks/use-entitlements";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { Category } from "@/lib/types/category";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const { selectedTenantId, selectedTenant } = useTenantStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [iconUploading, setIconUploading] = useState(false);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const [formParentId, setFormParentId] = useState<string>("none");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);

  const { data, isLoading, error } = useCategories(selectedTenantId || undefined);
  const { data: entitlements } = useEntitlements(selectedTenantId || undefined);
  const usage = getProductUsage(entitlements, "categories_count");
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const filteredCategories = useMemo(() => {
    if (!data?.categories) return [];
    if (!searchQuery.trim()) return data.categories;
    const q = searchQuery.toLowerCase();
    return data.categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [data?.categories, searchQuery]);

  // For parent dropdown, only show top-level (no parent) categories
  const parentOptions = useMemo(() => {
    if (!data?.categories) return [];
    return data.categories.filter((c) => !c.parentId);
  }, [data?.categories]);

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormIconUrl("");
    setFormParentId("none");
    setFormSortOrder("0");
    setFormIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDescription(cat.description || "");
    setFormIconUrl(cat.iconUrl || "");
    setFormParentId(cat.parentId || "none");
    setFormSortOrder(String(cat.sortOrder));
    setFormIsActive(cat.isActive);
  };

  const handleCreate = () => {
    if (!formName.trim()) return;
    const slug = formSlug.trim() || generateSlug(formName);
    createCategory.mutate(
      {
        name: formName.trim(),
        slug,
        description: formDescription.trim() || null,
        icon_url: formIconUrl.trim() || null,
        parent_id: formParentId === "none" ? null : formParentId,
        sort_order: parseInt(formSortOrder, 10) || 0,
        is_active: formIsActive,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
          toast({ title: "Success", description: "Category created successfully." });
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingCategory || !formName.trim()) return;
    const slug = formSlug.trim() || generateSlug(formName);
    updateCategory.mutate(
      {
        categoryId: editingCategory.id,
        data: {
          name: formName.trim(),
          slug,
          description: formDescription.trim() || null,
          icon_url: formIconUrl.trim() || null,
          parent_id: formParentId === "none" ? null : formParentId,
          sort_order: parseInt(formSortOrder, 10) || 0,
          is_active: formIsActive,
        },
      },
      {
        onSuccess: () => {
          setEditingCategory(null);
          toast({ title: "Success", description: "Category updated successfully." });
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteCategory.mutate(deleteId, {
      onSuccess: () => {
        setDeleteId(null);
        toast({ title: "Success", description: "Category deleted successfully." });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete category.",
          variant: "destructive",
        });
      },
    });
  };

  const handleToggleActive = (cat: Category) => {
    updateCategory.mutate(
      { categoryId: cat.id, data: { is_active: !cat.isActive } },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: cat.isActive ? "Category deactivated." : "Category activated.",
          });
        },
      }
    );
  };

  // Helper to find parent name
  const parentName = (parentId: string | null) => {
    if (!parentId || !data?.categories) return null;
    const p = data.categories.find((c) => c.id === parentId);
    return p?.name ?? null;
  };

  // Auto-generate slug from name in create mode
  const autoSlug = formName && !formSlug ? generateSlug(formName) : formSlug;

  /* ---- Category form fields shared between create/edit ---- */
  const formFields = (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g., Programming"
        />
      </div>
      <div className="space-y-2">
        <Label>Slug</Label>
        <Input
          value={formSlug}
          onChange={(e) => setFormSlug(e.target.value)}
          placeholder={autoSlug || "auto-generated-from-name"}
        />
        {autoSlug && !formSlug && (
          <p className="text-muted-foreground font-mono text-xs">{autoSlug}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Icon</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={iconUploading}
                onClick={() => iconFileInputRef.current?.click()}
              >
                {iconUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Upload Icon
              </Button>
              {formIconUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFormIconUrl("")}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
            <input
              ref={iconFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !selectedTenantId) return;
                setIconUploading(true);
                try {
                  const result = await uploadApi.uploadCategoryIcon(file, {
                    type: "category_icon",
                    tenantId: selectedTenantId,
                  });
                  setFormIconUrl(result.key);
                  toast({
                    title: "Icon uploaded",
                    description: "Category icon uploaded successfully.",
                  });
                } catch (err) {
                  toast({
                    title: "Upload failed",
                    description: err instanceof Error ? err.message : "Failed to upload",
                    variant: "destructive",
                  });
                } finally {
                  setIconUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </div>
          {formIconUrl && (
            <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
              <img
                src={resolveThumbnailForDisplay(formIconUrl) ?? ""}
                alt="Icon preview"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Parent Category</Label>
          <Select value={formParentId} onValueChange={setFormParentId}>
            <SelectTrigger>
              <SelectValue placeholder="None (top-level)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (top-level)</SelectItem>
              {parentOptions
                .filter((p) => p.id !== editingCategory?.id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input
            type="number"
            value={formSortOrder}
            onChange={(e) => setFormSortOrder(e.target.value)}
            min="0"
          />
        </div>
      </div>
    </div>
  );

  return (
    <FeatureGate featureKeys={["categories"]}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground">
            Organize courses and books into categories for{" "}
            {selectedTenant?.tenant_name || "your tenant"}
          </p>
          {selectedTenantId && (
            <p className="text-muted-foreground mt-1 text-sm">
              {usage.used} / {usage.isUnlimited ? "Unlimited" : usage.limit} categories used
            </p>
          )}
        </div>
        <Button
          onClick={openCreate}
          disabled={!selectedTenantId || !usage.allowedToAddOne}
          title={!usage.allowedToAddOne ? "Category limit reached. Upgrade your plan." : undefined}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Category
        </Button>
      </div>

      {!selectedTenantId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderTree className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              Please select a tenant to manage categories.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedTenantId && (
        <div className="space-y-6">
          {/* Search + Stats */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-muted-foreground text-sm">
              <strong>{filteredCategories.length}</strong> categor
              {filteredCategories.length !== 1 ? "ies" : "y"}
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
                <p className="text-destructive">Failed to load categories</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && filteredCategories.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b text-left text-xs font-medium uppercase tracking-wider">
                    <th className="w-12 px-4 py-3">Icon</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Slug</th>
                    <th className="hidden px-4 py-3 md:table-cell">Parent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      className="hover:bg-muted/30 border-b transition-colors last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="bg-muted flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
                          {cat.iconUrl ? (
                            <img
                              src={resolveThumbnailForDisplay(cat.iconUrl) ?? ""}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FolderTree className="text-muted-foreground h-4 w-4" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-sm font-medium">{cat.name}</span>
                          {cat.description && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <code className="text-muted-foreground text-xs">{cat.slug}</code>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-muted-foreground text-sm">
                          {parentName(cat.parentId) || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleActive(cat)} className="cursor-pointer">
                          <Badge variant={cat.isActive ? "default" : "secondary"}>
                            {cat.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(cat)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={() => setDeleteId(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && !error && filteredCategories.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderTree className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "No categories found" : "No categories yet"}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Create your first category to organize your content"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={openCreate}
                    disabled={!usage.allowedToAddOne}
                    title={
                      !usage.allowedToAddOne
                        ? "Category limit reached. Upgrade your plan."
                        : undefined
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Category
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Add a new category to organize your courses and books.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createCategory.isPending || !formName.trim()}>
              {createCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category details.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateCategory.isPending || !formName.trim()}>
              {updateCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will remove the category and unlink it from all associated courses
              and books.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </FeatureGate>
  );
}
