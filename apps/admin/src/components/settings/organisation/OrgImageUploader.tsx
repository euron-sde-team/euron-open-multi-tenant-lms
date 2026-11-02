"use client";

import { Button, useToast } from "@open-mtlms/core";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

interface OrgImageUploaderProps {
  label: string;
  description?: string;
  currentImageUrl: string | null;
  accept?: string;
  /** JS-level extension check (e.g. [".ico"]). Browser `accept` can be bypassed. */
  allowedExtensions?: string[];
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  isUploading?: boolean;
  isDeleting?: boolean;
}

export function OrgImageUploader({
  label,
  description,
  currentImageUrl,
  accept = "image/*",
  allowedExtensions,
  onUpload,
  onDelete,
  isUploading = false,
  isDeleting = false,
}: OrgImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (allowedExtensions?.length) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        toast({
          title: "Invalid file type",
          description: `Only ${allowedExtensions.join(", ")} files are supported.`,
          variant: "destructive",
        });
        return;
      }
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      await onUpload(file);
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
    } catch {
      toast({
        title: "Delete failed",
        description: "Failed to delete image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const displayUrl = previewUrl || currentImageUrl;
  const isBusy = isUploading || isDeleting;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
      <div className="flex items-center gap-4">
        <div className="bg-muted flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={label}
              width={80}
              height={80}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : (
            <ImageIcon className="text-muted-foreground h-8 w-8" />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            {isUploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {currentImageUrl ? "Replace" : "Upload"}
          </Button>
          {currentImageUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {isDeleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
