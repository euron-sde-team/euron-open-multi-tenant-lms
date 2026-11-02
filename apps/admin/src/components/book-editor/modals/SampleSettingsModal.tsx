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
  Switch,
} from "@open-mtlms/core";
import { useState, useEffect } from "react";

import type { BookStore } from "@/lib/stores/book-store";

interface SampleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
}

export function SampleSettingsModal({ isOpen, onClose, bookStore }: SampleSettingsModalProps) {
  const [sampleEnabled, setSampleEnabled] = useState(bookStore.bookData.sampleEnabled ?? true);
  const [samplePages, setSamplePages] = useState(
    (bookStore.bookData.samplePages ?? 10).toString()
  );

  useEffect(() => {
    if (isOpen) {
      setSampleEnabled(bookStore.bookData.sampleEnabled ?? true);
      setSamplePages((bookStore.bookData.samplePages ?? 10).toString());
    }
  }, [isOpen, bookStore.bookData]);

  const handleSave = () => {
    const pages = parseInt(samplePages, 10);
    bookStore.updateSettings({
      sampleEnabled,
      samplePages: Number.isNaN(pages) || pages < 1 ? 10 : pages,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sample Preview Settings</DialogTitle>
          <DialogDescription>
            Configure how readers can preview your book before purchasing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Sample */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sample-enabled">Enable Sample Preview</Label>
              <p className="text-xs text-muted-foreground">
                Allow readers to preview pages before buying
              </p>
            </div>
            <Switch
              id="sample-enabled"
              checked={sampleEnabled}
              onCheckedChange={setSampleEnabled}
            />
          </div>

          {/* Number of Pages */}
          {sampleEnabled && (
            <div className="space-y-2">
              <Label htmlFor="sample-pages">Sample size (% of the book)</Label>
              <Input
                id="sample-pages"
                type="number"
                min="1"
                max="100"
                value={samplePages}
                onChange={(e) => setSamplePages(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                How much of the book readers can preview, as a percentage (1-100).
                Default: 10%. A percentage rather than a page count because EPUBs
                reflow, their page count depends on the reader&apos;s font size.
              </p>
            </div>
          )}

          {/* Preview Info */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Preview Behavior</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>The sample starts at the beginning of the book</li>
              <li>Readers get the first {samplePages || 10}%, pages for a PDF, chapters for an EPUB</li>
              <li>Only that portion is sent to the browser; the rest never leaves the server</li>
            </ul>
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
