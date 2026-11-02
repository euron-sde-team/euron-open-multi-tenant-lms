"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@open-mtlms/core";
import { Upload, Link as LinkIcon, X } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

interface ImagePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (src: string, alt: string) => void;
  currentImage?: string;
  currentAlt?: string;
}

export function ImagePickerModal({
  open,
  onOpenChange,
  onSelect,
  currentImage = "",
  currentAlt = "",
}: ImagePickerModalProps) {
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [urlInput, setUrlInput] = useState(currentImage);
  const [altText, setAltText] = useState(currentAlt);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUrlInput(currentImage);
      setAltText(currentAlt);
      setSelectedImage(null);
      setUrlError(null);
      setActiveTab("upload");
    }
  }, [open, currentImage, currentAlt]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setUrlError("Please select an image file");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUrlError("Image size must be less than 10MB");
        return;
      }

      // Create a data URL for storage
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setSelectedImage({
          src: dataUrl,
          alt: file.name.replace(/\.[^/.]+$/, ""),
        });
        setAltText(file.name.replace(/\.[^/.]+$/, ""));
        setUrlError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle URL input
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setUrlError("Please enter an image URL");
      return;
    }

    try {
      new URL(urlInput);
      setSelectedImage({
        src: urlInput,
        alt: altText || "Image",
      });
      setUrlError(null);
    } catch {
      setUrlError("Please enter a valid URL");
    }
  };

  // Handle final selection
  const handleConfirm = () => {
    if (selectedImage) {
      onSelect(selectedImage.src, altText || selectedImage.alt);
      onOpenChange(false);
    } else if (activeTab === "url" && urlInput) {
      try {
        new URL(urlInput);
        onSelect(urlInput, altText || "Image");
        onOpenChange(false);
      } catch {
        setUrlError("Please enter a valid URL");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2 h-auto p-1">
            <TabsTrigger value="upload" className="flex items-center gap-2 py-2.5 px-4">
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2 py-2.5 px-4">
              <LinkIcon className="h-4 w-4" />
              <span>URL</span>
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="flex-1 flex flex-col mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedImage && activeTab === "upload" ? (
              <div className="space-y-4">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={selectedImage.src}
                    alt={selectedImage.alt}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Different Image
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors min-h-[250px]"
              >
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-1">Click to upload</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP up to 10MB</p>
              </div>
            )}

            {urlError && activeTab === "upload" && (
              <p className="text-sm text-destructive mt-2">{urlError}</p>
            )}
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="flex-1 flex flex-col mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="image-url"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        setUrlError(null);
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUrlSubmit();
                        }
                      }}
                    />
                  </div>
                  <Button onClick={handleUrlSubmit} variant="secondary">
                    Load
                  </Button>
                </div>
                {urlError && activeTab === "url" && (
                  <p className="text-sm text-destructive">{urlError}</p>
                )}
              </div>

              {/* URL Preview */}
              {selectedImage && activeTab === "url" ? (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={selectedImage.src}
                    alt={selectedImage.alt}
                    fill
                    className="object-contain"
                    unoptimized
                    onError={() => {
                      setSelectedImage(null);
                      setUrlError("Failed to load image from URL");
                    }}
                  />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setUrlInput("");
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg min-h-[200px]">
                  <LinkIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Enter an image URL and click Load
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Alt Text Input */}
        {(selectedImage || (activeTab === "url" && urlInput)) && (
          <div className="space-y-2 mt-4 pt-4 border-t">
            <Label htmlFor="alt-text">Alt Text (for accessibility)</Label>
            <Input
              id="alt-text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image..."
            />
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedImage && !(activeTab === "url" && urlInput)}
          >
            Select Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
