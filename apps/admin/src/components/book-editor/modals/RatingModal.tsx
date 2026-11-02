"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import { useState, useEffect } from "react";

import type { BookStore } from "@/lib/stores/book-store";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
}

export function RatingModal({ isOpen, onClose, bookStore }: RatingModalProps) {
  const [rating, setRating] = useState(
    (bookStore.bookData.rating ?? 0).toString()
  );
  const [ratingCount, setRatingCount] = useState(
    (bookStore.bookData.ratingTotalCount ?? 0).toString()
  );

  useEffect(() => {
    if (isOpen) {
      setRating((bookStore.bookData.rating ?? 0).toString());
      setRatingCount((bookStore.bookData.ratingTotalCount ?? 0).toString());
    }
  }, [isOpen, bookStore.bookData]);

  const handleSave = () => {
    const r = parseFloat(rating);
    const count = parseInt(ratingCount, 10);
    bookStore.updateRating(
      Number.isNaN(r) ? 0 : Math.min(5, Math.max(0, r)),
      Number.isNaN(count) || count < 0 ? 0 : count
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Rating</DialogTitle>
          <DialogDescription>
            Set the display rating and total rating count for this book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="book-rating">Rating (0-5)</Label>
            <Input
              id="book-rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Average rating displayed on the book page (0-5).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-rating-count">Total Ratings</Label>
            <Input
              id="book-rating-count"
              type="number"
              min="0"
              value={ratingCount}
              onChange={(e) => setRatingCount(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Number of ratings to display (e.g. &quot;1,234 ratings&quot;).
            </p>
          </div>
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
