"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from "@open-mtlms/core";
import { Check, FolderTree, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useCategories } from "@/lib/hooks/use-categories";
import { useCourseStore } from "@/lib/stores/course-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

/** Display shape for a category in the grid (id, name, slug, icon) */
function toDisplayCategory(c: { id: string; name: string; slug: string; iconUrl?: string | null }) {
  const url: string | undefined = c.iconUrl != null ? c.iconUrl : undefined;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: url ? (
      <img src={url} alt="" className="h-6 w-6 object-contain" />
    ) : (
      <FolderTree className="h-6 w-6 text-muted-foreground" />
    ),
  };
}

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryModal({ open, onOpenChange }: CategoryModalProps) {
  const { courseData, addCategory, removeCategory } = useCourseStore();
  const { selectedTenantId } = useTenantStore();
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(
    selectedTenantId ?? undefined
  );
  const [searchQuery, setSearchQuery] = useState("");

  const categoryIds = courseData.categoryIds || [];
  const categories = categoriesData?.categories ?? [];
  const displayCategories = useMemo(
    () => categories.map(toDisplayCategory),
    [categories]
  );
  const selectedCategories = useMemo(
    () => displayCategories.filter((c) => categoryIds.includes(c.id)),
    [displayCategories, categoryIds]
  );

  const filteredCategories = useMemo(
    () =>
      displayCategories.filter((category) =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [displayCategories, searchQuery]
  );

  const toggleCategory = (categoryId: string) => {
    if (categoryIds.includes(categoryId)) {
      removeCategory(categoryId);
    } else {
      addCategory(categoryId);
    }
  };

  // Get the last selected category for breadcrumb preview
  const lastCategory = selectedCategories.length > 0 
    ? selectedCategories[selectedCategories.length - 1] 
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Select Categories
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose categories for your course. The last selected category will be shown in the breadcrumb.
          </p>
        </DialogHeader>

        {/* Breadcrumb Preview */}
        {lastCategory && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Breadcrumb Preview:</p>
            <p className="text-foreground">
              Home &rsaquo; <span className="font-medium">{lastCategory.name}</span>
            </p>
          </div>
        )}

        {/* Selected Categories */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-4 border-b">
            {selectedCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-2 text-secondary-foreground"
              >
                <span className="flex items-center justify-center shrink-0">{category.icon}</span>
                <span className="text-sm font-medium">{category.name}</span>
                <button
                  type="button"
                  onClick={() => removeCategory(category.id)}
                  className="hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="pl-9"
          />
        </div>

        {/* Categories Grid */}
        {categoriesLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-8">
            <p>Loading categories...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto grid grid-cols-2 sm:grid-cols-3 gap-3 py-4">
            {filteredCategories.map((category) => {
              const isSelected = categoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    "hover:border-primary/50 hover:bg-muted/50",
                    isSelected && "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => toggleCategory(category.id)}
                >
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}

                  <span className="flex items-center justify-center shrink-0 text-2xl">{category.icon}</span>
                  <span className="text-sm font-medium flex-1 truncate">{category.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {!categoriesLoading && filteredCategories.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>No categories found matching &quot;{searchQuery}&quot;</p>
          </div>
        )}

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedCategories.length} categor{selectedCategories.length !== 1 ? "ies" : "y"} selected
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
