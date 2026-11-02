"use client";

import { createBookRecommendation } from "@open-mtlms/book-templates";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  cn,
} from "@open-mtlms/core";
import { ChevronDown, GripVertical, Library, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { booksApi, type Book } from "@/lib/api/books";
import { useBookStore } from "@/lib/stores/book-store";

interface BookRecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookRecommendationModal({ open, onOpenChange }: BookRecommendationModalProps) {
  const { bookData, addRecommendation, removeRecommendation, reorderRecommendations } =
    useBookStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  const recommendations = bookData.recommendations || [];
  const currentBookId = bookData.id ?? "";

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await booksApi.getBooks(1, 200);
      setBooks(res.books || []);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchBooks();
  }, [open, fetchBooks]);

  const availableBooks = books.filter(
    (b) => b.id !== currentBookId && !recommendations.some((r) => r.bookId === b.id)
  );

  const handleAddBook = (book: Book) => {
    addRecommendation(
      createBookRecommendation(
        book.id,
        book.title,
        book.slug,
        book.thumbnailUrl || undefined,
        recommendations.length
      )
    );
    setPickerOpen(false);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) reorderRecommendations(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index < recommendations.length - 1) reorderRecommendations(index, index + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Book Recommendations
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Recommend related books to readers viewing this book
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-2">
          {/* Add book picker */}
          <div className="relative" ref={pickerRef}>
            <Label className="mb-2 block">Add recommended book</Label>
            <Button
              variant="outline"
              className="w-full justify-between border-dashed"
              onClick={() => setPickerOpen(!pickerOpen)}
              disabled={loading || availableBooks.length === 0}
            >
              <span>
                {loading
                  ? "Loading books..."
                  : availableBooks.length === 0
                    ? "No more books to add"
                    : "Select a book to recommend"}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", pickerOpen && "rotate-180")}
              />
            </Button>
            {pickerOpen && availableBooks.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg z-10">
                {availableBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted transition-colors"
                    onClick={() => handleAddBook(book)}
                  >
                    {book.thumbnailUrl ? (
                      <img
                        src={book.thumbnailUrl}
                        alt=""
                        className="h-12 w-16 rounded object-cover flex-shrink-0 aspect-[3/4]"
                      />
                    ) : (
                      <div className="h-12 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0 aspect-[3/4]">
                        <Library className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{book.slug}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations list - compact grid like course recommendations */}
          <div className="space-y-2">
            <Label>Recommended books ({recommendations.length})</Label>
            {recommendations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground rounded-lg border border-dashed">
                <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recommendations yet</p>
                <p className="text-sm">Add books to show as recommendations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, index) => (
                  <div
                    key={rec.id}
                    className="group flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <span className="text-xs">↑</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === recommendations.length - 1}
                      >
                        <span className="text-xs">↓</span>
                      </Button>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {rec.thumbnailUrl ? (
                      <img
                        src={rec.thumbnailUrl}
                        alt=""
                        className="h-14 w-[94px] rounded object-cover flex-shrink-0"
                        style={{ aspectRatio: "2/3" }}
                      />
                    ) : (
                      <div className="h-14 w-[94px] rounded bg-muted flex items-center justify-center flex-shrink-0" style={{ aspectRatio: "2/3" }}>
                        <Library className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{rec.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{rec.slug}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => removeRecommendation(rec.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {recommendations.length} recommendation{recommendations.length !== 1 ? "s" : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
