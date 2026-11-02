"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@open-mtlms/core";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import type { BookStore } from "@/lib/stores/book-store";

interface ThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookStore: BookStore;
  onUpload?: (file: File) => Promise<string | undefined>;
}

export function ThumbnailModal({ isOpen, onClose, bookStore, onUpload }: ThumbnailModalProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Use the new schema field, fallback to legacy
      setThumbnailUrl(
        bookStore.bookData.thumbnailUrl || 
        bookStore.bookData.webThumbnailUrl || 
        ""
      );
    }
  }, [isOpen, bookStore.bookData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;

    setIsUploading(true);
    try {
      const url = await onUpload(file);
      if (url) {
        setThumbnailUrl(url);
      }
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = () => {
    bookStore.updateMedia({
      thumbnailUrl,
      // Also update legacy fields for backward compatibility
      webThumbnailUrl: thumbnailUrl,
      mobileThumbnailUrl: thumbnailUrl,
    } as Parameters<typeof bookStore.updateMedia>[0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Book Cover</DialogTitle>
          <DialogDescription>
            Upload a cover image for your book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Upload Section */}
          <div className="space-y-2">
            <Label>Upload Cover Image</Label>
            <div 
              className="rounded-lg border border-dashed p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mx-auto h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF, WebP up to 10MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading || !onUpload}
            />
          </div>

          {/* Preview */}
          {thumbnailUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex justify-center">
                <img
                  src={resolveThumbnailForDisplay(thumbnailUrl) ?? ""}
                  alt="Cover preview"
                  className="h-48 w-auto rounded-lg object-cover border shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUploading}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
