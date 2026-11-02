"use client";

import { Button, useToast } from "@open-mtlms/core";
import { ImageIcon, Loader2, Trash2, Upload, User } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface InstructorPhotoUploaderProps {
  currentImageUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  isUploading?: boolean;
  isDeleting?: boolean;
  shape?: "circle" | "rect";
  size?: number;
  fallbackInitials?: string;
}

export function InstructorPhotoUploader({
  currentImageUrl,
  onUpload,
  onDelete,
  isUploading = false,
  isDeleting = false,
  shape = "circle",
  size = 80,
  fallbackInitials,
}: InstructorPhotoUploaderProps) {
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
  const isCircle = shape === "circle";

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "bg-muted flex shrink-0 items-center justify-center overflow-hidden border",
          isCircle ? "rounded-full" : "rounded-lg"
        )}
        style={{ width: size, height: size }}
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Photo"
            width={size}
            height={size}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : fallbackInitials ? (
          <span className="text-primary font-semibold text-lg">
            {fallbackInitials}
          </span>
        ) : isCircle ? (
          <User className="text-muted-foreground h-8 w-8" />
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
