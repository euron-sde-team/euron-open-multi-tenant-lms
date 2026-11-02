"use client";

import type { BookCategory } from "@open-mtlms/book-templates";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { Check } from "lucide-react";
import { useState, useEffect } from "react";

import type { BookStore } from "@/lib/stores/book-store";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
  availableCategories: BookCategory[];
}

export function CategoryModal({ isOpen, onClose, bookStore, availableCategories }: CategoryModalProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategories(bookStore.bookData.categoryIds || []);
    }
  }, [isOpen, bookStore.bookData.categoryIds]);

  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = () => {
    bookStore.setCategories(selectedCategories);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Categories</DialogTitle>
          <DialogDescription>
            Choose the categories for this book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
          {availableCategories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No categories available. Please add categories first.
            </p>
          ) : (
            availableCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <div
                  key={category.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => handleToggleCategory(category.id)}
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-primary border-primary" : "border-input"
                  }`}>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </div>
                  <span className="font-medium">{category.name}</span>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
