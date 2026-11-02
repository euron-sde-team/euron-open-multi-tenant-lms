"use client";

import type { BookAuthor } from "@open-mtlms/book-templates";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { Check, User } from "lucide-react";
import { useState, useEffect } from "react";

import type { BookStore } from "@/lib/stores/book-store";

interface AuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
  availableAuthors: BookAuthor[];
}

export function AuthorModal({ isOpen, onClose, bookStore, availableAuthors }: AuthorModalProps) {
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedAuthors(bookStore.bookData.authorIds || []);
    }
  }, [isOpen, bookStore.bookData.authorIds]);

  const handleToggleAuthor = (authorId: string) => {
    setSelectedAuthors((prev) =>
      prev.includes(authorId)
        ? prev.filter((id) => id !== authorId)
        : [...prev, authorId]
    );
  };

  const handleSave = () => {
    bookStore.setAuthors(selectedAuthors);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Authors</DialogTitle>
          <DialogDescription>
            Choose the authors for this book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
          {availableAuthors.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No authors available. Please add authors first.
            </p>
          ) : (
            availableAuthors.map((author) => {
              const isSelected = selectedAuthors.includes(author.id);
              return (
              <div
                key={author.id}
                className={`flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => handleToggleAuthor(author.id)}
              >
                <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? "bg-primary border-primary" : "border-input"
                }`}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                </div>
                <div className="flex items-start gap-3 flex-1">
                  {author.avatar ? (
                    <img
                      src={author.avatar}
                      alt={author.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{author.name}</p>
                    {author.role && (
                      <p className="text-sm text-muted-foreground">
                        {author.role} {author.company && `at ${author.company}`}
                      </p>
                    )}
                    {author.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {author.bio}
                      </p>
                    )}
                  </div>
                </div>
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
