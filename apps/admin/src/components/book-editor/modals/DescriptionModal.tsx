"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@open-mtlms/core";
import { useState, useEffect } from "react";

import type { BookStore } from "@/lib/stores/book-store";

interface DescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
}

export function DescriptionModal({ isOpen, onClose, bookStore }: DescriptionModalProps) {
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDescription(bookStore.bookData.description || "");
    }
  }, [isOpen, bookStore.bookData.description]);

  const handleSave = () => {
    bookStore.updateBasicInfo({ description });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book Description</DialogTitle>
          <DialogDescription>
            Write a compelling description for your book. HTML is supported.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter book description..."
            className="min-h-[300px] font-mono text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tip: You can use HTML tags like &lt;p&gt;, &lt;h3&gt;, &lt;ul&gt;, &lt;li&gt; for formatting.
          </p>
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
