"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { testimonialsApi } from "@/lib/api/testimonials";
import type { TestimonialItem } from "@/lib/api/testimonials";
import { useInfiniteTestimonials } from "@/lib/hooks/use-infinite-testimonials";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { TestimonialCard } from "@/components/testimonials/story-card";
import { StoryDialog } from "@/components/testimonials/story-dialog";
import { AvailableRoutesProvider } from "@open-mtlms/core";
import type {
  AvailableRoutesResponse,
  TenantLayout,
  ThemeConfig,
} from "@open-mtlms/shared";
import {
  ImagePlus,
  Linkedin,
  Loader2,
  LogIn,
  MessageSquareQuote,
  PenLine,
  RefreshCw,
  Twitter,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface TestimonialsClientProps {
  layout: TenantLayout | null;
  theme: ThemeConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
  initialHost: string;
}

// ---------------------------------------------------------------------------
// Star Rating (readonly display only)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Story grid
// ---------------------------------------------------------------------------
//
// A plain responsive grid, not a masonry. The cards are a fixed height by
// construction (fixed proof panel, clamped quote, author pinned with mt-auto),
// so rows line up and the wall reads as structured. This also drops the old
// measure-then-redistribute pass, which meant the layout could only settle
// after paint.

const GRID_CLASS =
  "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8";

// ---------------------------------------------------------------------------
// Image Upload Helper
// ---------------------------------------------------------------------------

function ImageUploadField({
  imageUrl,
  onImageChange,
  disabled,
}: {
  imageUrl: string;
  onImageChange: (url: string) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      onImageChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setPreviewUrl(null);
    onImageChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentPreview = previewUrl || (imageUrl && !imageUrl.startsWith("data:") ? imageUrl : null);

  return (
    <div className="space-y-2">
      <Label>Photo (optional)</Label>
      {currentPreview || previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl || imageUrl}
            alt="Preview"
            className="h-20 w-20 rounded-lg border object-cover"
          />
          <button
            type="button"
            onClick={clearImage}
            disabled={disabled}
            className="bg-destructive text-destructive-foreground absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="border-input bg-background hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
          >
            <ImagePlus className="h-4 w-4" />
            Upload
          </button>
          <Input
            placeholder="or paste image URL"
            value={imageUrl.startsWith("data:") ? "" : imageUrl}
            onChange={(e) => {
              setPreviewUrl(null);
              onImageChange(e.target.value);
            }}
            disabled={disabled}
            className="flex-1"
          />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit Dialog
// ---------------------------------------------------------------------------

function SubmitTestimonialDialog() {
  const { isAuthenticated, member } = useUserAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(member?.name ?? "");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");

  // Sync name when store hydrates (persist is async)
  useEffect(() => {
    if (member?.name && !name) {
      setName(member.name);
    }
  }, [member?.name]);

  const resetForm = useCallback(() => {
    setName(member?.name ?? "");
    setText("");
    setImageUrl("");
    setSocialTwitter("");
    setSocialLinkedin("");
  }, [member?.name]);

  const canSubmit = (name.trim() || text.trim()) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const socialLinks: Record<string, string> = {};
      if (socialTwitter.trim()) socialLinks.twitter = socialTwitter.trim();
      if (socialLinkedin.trim()) socialLinks.linkedin = socialLinkedin.trim();

      await testimonialsApi.submit({
        name: name.trim() || undefined,
        text: text.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        social_links:
          Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
      });

      toast({
        title: "Thank you!",
        description:
          "Your testimonial has been submitted for review.",
      });
      resetForm();
      setOpen(false);
    } catch (err) {
      toast({
        title: "Submission failed",
        description:
          err instanceof Error ? err.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Button
        onClick={() => router.push("/login")}
        size="lg"
        className="fixed bottom-6 right-6 z-50 gap-2 rounded-full shadow-lg"
      >
        <LogIn className="h-4 w-4" />
        Share Your Experience
      </Button>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 z-50 gap-2 rounded-full shadow-lg"
          >
            <PenLine className="h-4 w-4" />
            Share Your Experience
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Share Your Experience</DialogTitle>
          <DialogDescription>
            Tell us about your experience. Your testimonial will be reviewed
            before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="testimonial-name">Your Name</Label>
            <Input
              id="testimonial-name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="testimonial-text">Your Testimonial</Label>
            <textarea
              id="testimonial-text"
              placeholder="Share your thoughts and experience..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
              rows={4}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <ImageUploadField
            imageUrl={imageUrl}
            onImageChange={setImageUrl}
            disabled={submitting}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label
                htmlFor="testimonial-twitter"
                className="flex items-center gap-1.5"
              >
                <Twitter className="h-3.5 w-3.5" /> Twitter
              </Label>
              <Input
                id="testimonial-twitter"
                placeholder="https://twitter.com/..."
                value={socialTwitter}
                onChange={(e) => setSocialTwitter(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="testimonial-linkedin"
                className="flex items-center gap-1.5"
              >
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </Label>
              <Input
                id="testimonial-linkedin"
                placeholder="https://linkedin.com/in/..."
                value={socialLinkedin}
                onChange={(e) => setSocialLinkedin(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

function StoryGridSkeleton() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-card ring-border/70 overflow-hidden rounded-2xl ring-1"
        >
          <div className="bg-muted h-52 p-3 sm:h-56">
            <div className="bg-muted-foreground/10 h-full w-full animate-pulse rounded-xl" />
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <div className="bg-muted-foreground/10 h-3 w-full animate-pulse rounded" />
            <div className="bg-muted-foreground/10 h-3 w-11/12 animate-pulse rounded" />
            <div className="bg-muted-foreground/10 h-3 w-8/12 animate-pulse rounded" />
            <div className="flex items-center gap-3 pt-4">
              <div className="bg-muted-foreground/10 h-10 w-10 animate-pulse rounded-full" />
              <div className="bg-muted-foreground/10 h-3 w-28 animate-pulse rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TestimonialsContent({
  layout,
  theme,
  initialHost,
}: Omit<TestimonialsClientProps, "availableRoutes">) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState(initialHost);
  const [openStory, setOpenStory] = useState<TestimonialItem | null>(null);

  useEffect(() => {
    setHost(window.location.host);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteTestimonials(host);

  const testimonials = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.testimonials);
  }, [data?.pages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "120px", threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme ?? undefined}>
      <div className="container-custom section-padding">
        {/* Header */}
        <div className="mb-12 text-center sm:mb-16">
          <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            What People Are Saying
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-base sm:text-lg">
            Real stories from our community members about their experience.
          </p>
        </div>

        {/* Error state */}
        {isError && (
          <div className="border-destructive/50 bg-destructive/10 mb-8 flex flex-col items-center justify-center rounded-lg border py-12">
            <p className="text-destructive text-center text-sm sm:text-base">
              {error instanceof Error
                ? error.message
                : "Failed to load testimonials. Please try again."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="border-input bg-background hover:bg-muted mt-4 flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* The wall sits on a muted band so the cards lift off the page even
            when a tenant has --card and --background set to the same value. */}
        {(isLoading || (!isError && testimonials.length > 0)) && (
          <div className="bg-muted/40 rounded-3xl p-5 sm:p-8">
            {isLoading ? (
              <StoryGridSkeleton />
            ) : (
              <div className={GRID_CLASS}>
                {testimonials.map((testimonial) => (
                  <TestimonialCard
                    key={testimonial.id}
                    testimonial={testimonial}
                    onOpen={() => setOpenStory(testimonial)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && testimonials.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
            <div className="bg-muted mb-5 flex h-16 w-16 items-center justify-center rounded-full">
              <MessageSquareQuote className="text-muted-foreground h-8 w-8" />
            </div>
            <p className="text-foreground mb-2 text-center text-lg font-semibold">
              No testimonials yet
            </p>
            <p className="text-muted-foreground mb-6 max-w-sm text-center text-sm">
              Be the first to share your experience and help others make
              informed decisions.
            </p>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div
          ref={loadMoreRef}
          className="flex min-h-[60px] items-center justify-center py-6"
        >
          {isFetchingNextPage && (
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          )}
        </div>
      </div>
      <StoryDialog
        testimonial={openStory}
        open={openStory !== null}
        onOpenChange={(next) => !next && setOpenStory(null)}
      />
      <SubmitTestimonialDialog />
    </LayoutWrapper>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function TestimonialsClient(props: TestimonialsClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <TestimonialsContent {...rest} />
    </AvailableRoutesProvider>
  );
}
