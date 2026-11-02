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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@open-mtlms/core";
import type { ImageSource, MediaImage } from "@open-mtlms/shared";
import {
  ImageIcon,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { uploadApi } from "@/lib/api/upload";
import { usePageImageGeneration } from "@/lib/hooks/use-page-image-generation";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

interface ImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: MediaImage) => void;
  currentImage?: string;
  currentAlt?: string;
  /** When set, locks the aspect ratio selector to this value */
  lockedAspectRatio?: string;
  /** Shown as a recommendation note in the upload tab */
  recommendedAspectRatio?: string;
  /** Section context passed to AI for contextual image generation */
  sectionContext?: {
    sectionType?: string;
    headline?: string;
    description?: string;
    badge?: string;
  };
}

export function ImagePicker({
  open,
  onOpenChange,
  onSelect,
  currentImage = "",
  currentAlt = "",
  lockedAspectRatio,
  recommendedAspectRatio,
  sectionContext,
}: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<string>("upload");
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const [selectedImage, setSelectedImage] = useState<MediaImage | null>(null);
  const [urlInput, setUrlInput] = useState(currentImage);
  const [altText, setAltText] = useState(currentAlt);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // AI Generate state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSubTab, setAiSubTab] = useState<"generate" | "edit">("generate");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const imageGen = usePageImageGeneration();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute the Tailwind aspect ratio class for generated image previews
  const generatedImageAspectClass = (() => {
    const map: Record<string, string> = {
      "1:1": "aspect-square",
      "16:9": "aspect-video",
      "9:16": "aspect-[9/16]",
      "4:3": "aspect-[4/3]",
      "3:4": "aspect-[3/4]",
      "2:3": "aspect-[2/3]",
      "3:2": "aspect-[3/2]",
    };
    return map[aspectRatio] || "aspect-square";
  })();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUrlInput(currentImage);
      setAltText(currentAlt);
      setSelectedImage(null);
      setUrlError(null);
      setIsUploading(false);
      setAiPrompt("");
      setAiError(null);
      setAiSubTab("generate");
      setAspectRatio(lockedAspectRatio || "1:1");
      setGeneratedImages([]);
      setActiveTab("upload");
      imageGen.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentImage, currentAlt, lockedAspectRatio]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUrlError("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUrlError("Image size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    setUrlError(null);

    try {
      const result = await uploadApi.uploadFile(file, "page-images");
      setSelectedImage({
        src: result.url,
        alt: file.name.replace(/\.[^/.]+$/, ""),
        source: "upload" as ImageSource,
      });
      setAltText(file.name.replace(/\.[^/.]+$/, ""));
    } catch (error) {
      console.error("Upload failed:", error);
      setUrlError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
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
        source: "url" as ImageSource,
      });
      setUrlError(null);
    } catch {
      setUrlError("Please enter a valid URL");
    }
  };

  // When polling completes, pick up the result
  useEffect(() => {
    if (imageGen.state === "completed" && imageGen.result) {
      setGeneratedImages((prev) => [imageGen.result!.url, ...prev]);
      setSelectedImage({
        src: imageGen.result.url,
        alt: aiPrompt.trim().slice(0, 100),
        source: "url" as ImageSource,
      });
      setAltText(aiPrompt.trim().slice(0, 100));
      imageGen.reset();
    } else if (imageGen.state === "failed" && imageGen.error) {
      setAiError(imageGen.error);
      imageGen.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageGen.state, imageGen.result, imageGen.error]);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiError(null);

    await imageGen.submit({
      prompt: aiPrompt.trim(),
      aspectRatio,
      sectionContext,
    });
  };

  // Handle final selection
  const handleConfirm = () => {
    if (selectedImage) {
      onSelect({
        ...selectedImage,
        alt: altText || selectedImage.alt,
      });
      onOpenChange(false);
    } else if (activeTab === "url" && urlInput) {
      try {
        new URL(urlInput);
        onSelect({
          src: urlInput,
          alt: altText || "Image",
          source: "url" as ImageSource,
        });
        onOpenChange(false);
      } catch {
        setUrlError("Please enter a valid URL");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
          <DialogDescription className="sr-only">
            Upload an image or enter a URL to select an image for your content.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 p-1">
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 px-4 py-2.5"
            >
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </TabsTrigger>
            {aiAuthoringEnabled && (
              <TabsTrigger
                value="ai"
                className="flex items-center gap-2 px-4 py-2.5"
              >
                <Sparkles className="h-4 w-4" />
                <span>AI Generate</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />

            {isUploading ? (
              <div className="flex min-h-[250px] flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/50">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="mb-1 text-sm font-medium">Uploading image...</p>
                <p className="text-xs text-muted-foreground">Please wait</p>
              </div>
            ) : selectedImage?.source === "upload" ? (
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
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
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
                className="flex min-h-[250px] flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50"
              >
                <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-1 text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF, WebP up to 10MB
                </p>
                {recommendedAspectRatio && (
                  <p className="mt-1 text-xs text-primary/80">
                    Recommended: {recommendedAspectRatio} aspect ratio for best results
                  </p>
                )}
              </div>
            )}

            {urlError && activeTab === "upload" && (
              <p className="mt-2 text-sm text-destructive">{urlError}</p>
            )}
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
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
              {selectedImage?.source === "url" && activeTab === "url" ? (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={selectedImage.src}
                    alt={selectedImage.alt}
                    fill
                    className="object-contain"
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
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                  <LinkIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Enter an image URL and click Load
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* AI Generate Tab */}
          <TabsContent value="ai" className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Sub-tabs: Generate / Edit */}
            <div className="mb-4 flex gap-1 border-b">
              <button
                onClick={() => setAiSubTab("generate")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  aiSubTab === "generate"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </button>
              <button
                onClick={() => setAiSubTab("edit")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  aiSubTab === "edit"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>

            {aiSubTab === "generate" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-prompt">Image Description</Label>
                  <Textarea
                    id="ai-prompt"
                    value={aiPrompt}
                    onChange={(e) => {
                      setAiPrompt(e.target.value);
                      setAiError(null);
                    }}
                    placeholder="A serene landscape with mountains and a lake at sunset..."
                    rows={3}
                    className="resize-none"
                    disabled={imageGen.isActive}
                  />
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  {lockedAspectRatio ? (
                    <p className="text-xs text-muted-foreground">
                      Locked to <span className="font-medium text-primary">{lockedAspectRatio}</span> for this section
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      {[
                        { value: "1:1", label: "Square (1:1)" },
                        { value: "16:9", label: "Wide (16:9)" },
                        { value: "9:16", label: "Portrait (9:16)" },
                        { value: "4:3", label: "Standard (4:3)" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setAspectRatio(option.value)}
                          disabled={imageGen.isActive}
                          className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                            aspectRatio === option.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAiGenerate}
                  disabled={
                    !aiPrompt.trim() || imageGen.isActive
                  }
                  className="w-full gap-2"
                >
                  {imageGen.isActive ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>

                {aiError && (
                  <p className="text-sm text-destructive">{aiError}</p>
                )}

                {/* Generated Images Grid */}
                {generatedImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {generatedImages.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedImage({
                            src: imgUrl,
                            alt: aiPrompt.trim().slice(0, 100),
                            source: "url" as ImageSource,
                          });
                          setAltText(aiPrompt.trim().slice(0, 100));
                        }}
                        className={`relative ${generatedImageAspectClass} overflow-hidden rounded-lg border-2 transition-all ${
                          selectedImage?.src === imgUrl
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                      >
                        <Image
                          src={imgUrl}
                          alt={`Generated ${idx + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  !imageGen.isActive && (
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                      <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No images generated yet
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Enter a prompt above to get started
                      </p>
                    </div>
                  )
                )}

                {imageGen.isActive && (
                  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30">
                    <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium">
                      Generating your image...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This may take a few seconds
                    </p>
                  </div>
                )}
              </div>
            )}

            {aiSubTab === "edit" && (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                <Pencil className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  Image editing coming soon
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Generate an image first, then edit it here
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Alt Text Input (always visible when image selected) */}
        {(selectedImage || (activeTab === "url" && urlInput)) && (
          <div className="mt-4 space-y-2 border-t pt-4">
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
