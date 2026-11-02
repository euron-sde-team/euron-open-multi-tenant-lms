"use client";

import {
  CalendarDays,
  Video,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  BookOpen,
  ShoppingCart,
  Gift,
  Sparkles,
  Play,
  PlayCircle,
  Star,
  Users,
  HelpCircle,
  Package,
  User,
  Pencil,
  BookMarked,
  GraduationCap,
  Loader2,
  Share2,
  Tag,
  Eye,
  EyeOff,
  X,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Globe,
  Facebook,
  Instagram,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatClockDuration, formatNumber, COURSE_DIFFICULTIES } from "@open-mtlms/shared";
import { AccessManagedCta } from "@open-mtlms/core";
import { cn, formatCourseLanguages, decodeHtmlEntities, resolveTemplatePrice } from "../lib/utils";
import { useCourseData, useCourseEdit } from "../context";
import { EditableText, EditableList, EditableThumbnail, EditableMode } from "../components/editable";
import { PreviewVideoModal } from "../components/PreviewVideoModal";
import { CourseSectionWrapper } from "../components/CourseSectionWrapper";
import { CourseRatingsSection } from "../components/CourseRatingsSection";

const SOCIAL_ICON_MAP: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  twitter: Twitter,
  github: Github,
  youtube: Youtube,
  website: Globe,
  facebook: Facebook,
  instagram: Instagram,
};

interface ModernTemplateProps {
  className?: string;
}

interface AIButtonProps {
  sectionKey: "subtitle" | "learningOutcomes" | "curriculum" | "offerings" | "requirements" | "description" | "faqs" | "thumbnails";
  onGenerateWithAI?: (sectionKey: AIButtonProps["sectionKey"]) => void;
}

function AIButton({ sectionKey, onGenerateWithAI }: AIButtonProps) {
  if (!onGenerateWithAI) return null;
  return (
    <button
      type="button"
      onClick={() => onGenerateWithAI(sectionKey)}
      className="inline-flex h-7 min-h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none hover:bg-muted/50 transition-colors border"
      style={{ borderColor: "hsl(var(--border))" }}
      title={`Generate with AI`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
      <span>AI</span>
    </button>
  );
}

/** Lightweight inline coupon input for template packages (no external dependency). */
function InlineCouponInput({
  onValidate,
  onApply,
}: {
  onValidate?: (code: string) => Promise<import("../types").CouponValidationResult>;
  onApply?: (result: import("../types").CouponValidationResult) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!code.trim() || !onValidate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onValidate(code.trim());
      onApply?.(result);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(
        axiosErr?.response?.data?.error?.message ||
        axiosErr?.response?.data?.message ||
        (err instanceof Error ? err.message : "Failed to validate coupon")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div
        className="flex overflow-hidden rounded-md border"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
          placeholder="Coupon code"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm font-mono uppercase outline-none placeholder:font-sans placeholder:normal-case"
          style={{ color: "hsl(var(--card-foreground))" }}
          disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="shrink-0 border-l px-3 py-2 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-40"
          style={{
            borderColor: "hsl(var(--border))",
            backgroundColor: "hsl(var(--muted))",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "hsl(0 84% 60%)" }}>{error}</p>}
    </div>
  );
}

export function ModernTemplate({ className }: ModernTemplateProps) {
  const { courseData, instructors, categories, accessManaged, supportEmail, onPreviewPlay } = useCourseData();

  /**
   * Playable samples, per section and in total.
   *
   * Sections start collapsed, so without this a visitor would have to open one
   * before discovering that anything is watchable for free. Surfacing the count
   * up front is the point of the whole feature: it is what tells someone who
   * has not signed up that they can try before buying.
   */
  const previewCounts = useMemo(() => {
    const bySection = new Map<string, number>();
    let total = 0;
    for (const section of courseData.sections ?? []) {
      let n = 0;
      for (const module of section.modules ?? []) {
        for (const lecture of module.lectures ?? []) {
          if (lecture.previewVideo?.videoKey) n += 1;
        }
      }
      bySection.set(section.id, n);
      total += n;
    }
    return { bySection, total };
  }, [courseData.sections]);
  const { isEditMode, callbacks, setActiveModal } = useCourseEdit();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());
  const [expandedBios, setExpandedBios] = useState<Set<string>>(new Set());
  const [expandedExpDetails, setExpandedExpDetails] = useState<Set<string>>(new Set());
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Get category name
  const categoryIds = courseData.categoryIds || [];
  const lastCategory = categoryIds.length > 0
    ? categories.find((c) => c.id === categoryIds[categoryIds.length - 1])
    : null;
  const categoryName = lastCategory?.name || "Course";

  // Pricing calculation, pre-resolved multi-currency priceParts win; legacy
  // INR/USD math (driven by callbacks.preferredCurrency) is the fallback.
  const isUSD = callbacks.preferredCurrency === "USD";
  const priceDisplay = resolveTemplatePrice(callbacks.priceParts, {
    isUSD,
    priceInr: courseData.webPriceINR || 0,
    priceUsd: courseData.webPriceUSD || 0,
    discountInr: courseData.webDiscount || 0,
    discountUsd: courseData.mobileDiscount ?? courseData.webDiscount ?? 0,
  });
  const {
    symbol: primarySymbol,
    finalPrice,
    originalPrice: primaryPrice,
    discountPct: primaryDiscount,
    savingLabel,
    locale: priceLocale,
  } = priceDisplay;
  const priceUnavailable =
    priceDisplay.unavailable && courseData.purchaseMode === "PAID" && !callbacks.hasAccess;
  // Access-managed storefront (never active in the admin editor): hide all
  // price text and self-serve purchase CTAs; non-owners get Contact Support.
  const accessManagedActive = accessManaged && !isEditMode;


  const toggleSyllabusSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(faqId)) {
        next.delete(faqId);
      } else {
        next.add(faqId);
      }
      return next;
    });
  };

  const toggleBio = (id: string) => {
    setExpandedBios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpDetail = (key: string) => {
    setExpandedExpDetails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const allSectionIds = courseData.sections?.map((s) => s.id) || [];
  const allExpanded = allSectionIds.length > 0 && allSectionIds.every((id) => expandedSections.has(id));
  const toggleAllSections = () => {
    setExpandedSections(allExpanded ? new Set() : new Set(allSectionIds));
  };

  const totalLectures =
    courseData.sections?.reduce(
      (acc, s) =>
        acc +
        (s.modules?.reduce((mAcc, m) => mAcc + m.lectures.length, 0) ??
          s.subtopics?.length ??
          0),
      0
    ) || 0;

  return (
    <div className={cn("min-h-screen", className)} style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      {/* Hero Section */}
      <section
        className="relative mb-1 flex flex-col-reverse gap-1 rounded-2xl p-1 sm:mb-4 sm:gap-3 md:p-6 lg:flex-row lg:items-start lg:rounded-2xl mx-auto max-w-7xl px-4 lg:border pt-6 mt-4 lg:mt-8"
        style={{
          background: `linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--muted)), hsl(var(--card)))`,
          borderColor: "hsl(var(--border))",
        }}
      >
        {/* Left Content */}
        <div className="w-full p-3 lg:w-1/2 lg:flex lg:flex-col lg:justify-center">
          {/* Breadcrumb */}
          <div className="hidden items-center gap-1 pb-2 lg:flex">
            <span
              className="text-sm font-medium cursor-pointer hover:opacity-80"
              style={{ color: "hsl(var(--primary))" }}
            >
              Home
            </span>
            <ChevronRight className="h-3 w-3 opacity-80" style={{ color: "hsl(var(--primary))" }} />
            {isEditMode ? (
              <button
                onClick={() => setActiveModal("category")}
                className="text-sm font-medium flex items-center gap-1 hover:opacity-80"
                style={{ color: "hsl(var(--primary))" }}
              >
                {categoryName}
                <Pencil className="h-3 w-3 opacity-50" />
              </button>
            ) : (
              <span className="text-sm font-medium" style={{ color: "hsl(var(--primary))" }}>
                {categoryName}
              </span>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col items-center justify-center lg:items-start lg:text-left">
            <EditableText
              value={courseData.title || ""}
              onChange={(title) => callbacks.onEditTitle?.(title)}
              as="h1"
              className="pb-2 text-xl font-bold sm:pb-4 md:text-3xl md:leading-tight lg:self-start"
              style={{ color: "hsl(var(--foreground))" }}
              placeholder="Enter course title..."
            />

            {/* Subtitle */}
            <div className="flex items-center gap-2 w-full lg:self-start">
              <EditableText
                value={courseData.subTitle || ""}
                onChange={(subTitle) => callbacks.onEditSubtitle?.(subTitle)}
                as="p"
                className="text-sm md:text-lg flex-1"
                style={{ color: "hsl(var(--muted-foreground))" }}
                placeholder="Add a compelling subtitle..."
              />
              {isEditMode && (
                <AIButton sectionKey="subtitle" onGenerateWithAI={callbacks.onGenerateWithAI} />
              )}
            </div>

            {/* Meta: Mode, Language, Duration */}
            <div className="mt-2 flex flex-col flex-nowrap self-start md:gap-3">
              <span
                className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
                style={{ color: "hsl(var(--foreground))" }}
              >
                <EditableMode value={courseData.mode} style={{ color: "hsl(var(--foreground))" }} />
              </span>
              {isEditMode && callbacks.onEditLanguages ? (
                <button
                  type="button"
                  onClick={() => callbacks.onEditLanguages?.()}
                  className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap cursor-pointer hover:opacity-80 rounded-md px-1 -mx-1"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  <span
                    className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    🌐
                  </span>
                  {formatCourseLanguages(courseData.languages, courseData.language)}
                  <Pencil className="ml-1 h-3.5 w-3.5 opacity-70" />
                </button>
              ) : (
                <span
                  className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  <span
                    className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    🌐
                  </span>
                  {formatCourseLanguages(courseData.languages, courseData.language)}
                </span>
              )}
              <span
                className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
                style={{ color: "hsl(var(--foreground))" }}
              >
                <span
                  className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  ⏱️
                </span>
                <EditableText
                  value={courseData.duration || ""}
                  onChange={(duration) => callbacks.onEditDuration?.(duration)}
                  className="inline"
                  style={{ color: "hsl(var(--foreground))" }}
                  placeholder="Duration"
                />
              </span>
              {(isEditMode || (courseData.difficulty && courseData.difficulty !== "NONE")) && (
                <span
                  className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  <span
                    className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  {isEditMode && callbacks.onEditDifficulty ? (
                    <select
                      value={courseData.difficulty ?? "NONE"}
                      onChange={(e) => callbacks.onEditDifficulty?.(e.target.value as typeof courseData.difficulty)}
                      className="rounded px-2 py-0.5 text-sm border bg-transparent min-w-[120px]"
                      style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                    >
                      {COURSE_DIFFICULTIES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      {COURSE_DIFFICULTIES.find((d) => d.value === courseData.difficulty)?.label ?? courseData.difficulty}
                    </span>
                  )}
                </span>
              )}
              {(courseData.validityDays == null || courseData.validityDays > 0) && (
                <span
                  className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  <span
                    className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  {courseData.validityDays == null
                    ? "Lifetime access"
                    : `Access valid for ${courseData.validityDays} days`}
                </span>
              )}
              {(() => {
                const ratingVisible = courseData.sectionVisibility?.heroRating !== false;
                const hasRating = courseData.rating != null && courseData.rating > 0;
                const canEditRating = isEditMode && !!callbacks.onEditRating;
                // Learner/preview view: render only when there is a rating AND admin hasn't hidden it
                if (!canEditRating && (!hasRating || !ratingVisible)) return null;
                return (
                <span
                  className={cn(
                    "mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap gap-1",
                    canEditRating && !ratingVisible && "opacity-40"
                  )}
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 shrink-0" />
                  {canEditRating ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.1}
                        value={((courseData as { adminRatingOverride?: number }).adminRatingOverride ?? courseData.rating) ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const count = (courseData as { adminRatingCountOverride?: number }).adminRatingCountOverride ?? courseData.ratingTotalCount;
                          if (!Number.isNaN(v)) callbacks.onEditRating?.(v, count);
                        }}
                        className="w-14 rounded px-1 py-0.5 text-sm border bg-transparent"
                        style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                      />
                      <span className="flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                        (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={((courseData as { adminRatingCountOverride?: number }).adminRatingCountOverride ?? courseData.ratingTotalCount) ?? ""}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value, 10);
                            const count = Number.isNaN(raw) ? 0 : Math.max(0, raw);
                            const currentRating =
                              (courseData as { adminRatingOverride?: number }).adminRatingOverride ?? courseData.rating;
                            const rating = Number.isFinite(currentRating as number) ? (currentRating as number) : 5;
                            callbacks.onEditRating?.(rating, count);
                          }}
                          className="w-16 rounded px-1 py-0.5 text-sm border bg-transparent"
                          style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                          placeholder="0"
                        />
                        ratings)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{(courseData.rating ?? 0).toFixed(1)}</span>
                      {courseData.ratingTotalCount != null && courseData.ratingTotalCount > 0 && (
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>
                          ({courseData.ratingTotalCount} ratings)
                        </span>
                      )}
                    </>
                  )}
                  {canEditRating && callbacks.onToggleSectionVisibility && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        callbacks.onToggleSectionVisibility?.("heroRating");
                      }}
                      className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                      title={ratingVisible ? "Hide rating from learners" : "Show rating to learners"}
                      aria-label={ratingVisible ? "Hide rating from learners" : "Show rating to learners"}
                    >
                      {ratingVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right - Thumbnail */}
        <div className="relative w-full lg:w-1/2">
          <div
            className="relative w-full overflow-hidden rounded-2xl shadow-md border"
            style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
          >
            <EditableThumbnail
              src={courseData.webThumbnailUrl || ""}
              fallbackSrc={courseData.mobileThumbnailUrl || ""}
              alt={courseData.title || "Course thumbnail"}
              aspectRatio="auto"
              placeholder="Click to add thumbnail"
              showVideoIcon
              className="rounded-2xl"
            />
            {courseData.previewUrl && !isEditMode && (
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 cursor-pointer transition-colors hover:bg-black/40"
                aria-label="Play course preview video"
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
                  style={{ backgroundColor: "hsl(var(--card))" }}
                >
                  <Play className="h-8 w-8 ml-0.5" style={{ color: "hsl(var(--primary))" }} />
                </div>
                <span className="mt-2 text-sm font-semibold text-white">
                  Preview this course
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Preview Video Modal */}
      {courseData.previewUrl && !isEditMode && (
        <PreviewVideoModal
          open={showPreviewModal}
          previewUrl={courseData.previewUrl}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {/* Main Content Grid */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Main Content */}
          <div className="flex-1 min-w-0 space-y-12">
            {/* What You'll Learn */}
            <CourseSectionWrapper
              sectionKey="learningOutcomes"
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
              headerActions={isEditMode && <AIButton sectionKey="learningOutcomes" onGenerateWithAI={callbacks.onGenerateWithAI} />}
            >
              <div className="mb-6">
                <h2
                  className="text-xl font-bold flex items-center gap-2"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <EditableText
                    value={courseData.sectionHeadlineLearningOutcomes ?? "What You'll Learn"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineLearningOutcomes: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
              </div>
              <div className="space-y-2">
                <EditableList
                  items={courseData.learningOutcomes || []}
                  onChange={(items) => callbacks.onEditLearningOutcomes?.(items)}
                  icon={<CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                  placeholder="Add learning outcome..."
                  addLabel="Add Learning Outcome"
                  emptyMessage="Click to add what students will learn"
                  itemClassName="text-sm"
                />
              </div>
            </CourseSectionWrapper>

            {/* Course Content / Syllabus */}
            <CourseSectionWrapper
              sectionKey="curriculum"
              style={{ backgroundColor: "transparent", border: "none" }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xl font-bold flex items-center gap-2"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <BookOpen className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <EditableText
                    value={courseData.sectionHeadlineCourseContent ?? "Course Content"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineCourseContent: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                <div className="flex items-center gap-3">
                  <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {courseData.sections?.length || 0} sections &bull; {totalLectures} lectures
                  </div>
                  {previewCounts.total > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        color: "hsl(var(--primary))",
                        backgroundColor: "hsl(var(--primary) / 0.12)",
                      }}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      {previewCounts.total} free{" "}
                      {previewCounts.total === 1 ? "preview" : "previews"}
                    </span>
                  )}
                  {(courseData.sections?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllSections}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    >
                      {allExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      {allExpanded ? "Collapse all" : "Expand all"}
                    </button>
                  )}
                  {isEditMode && <AIButton sectionKey="curriculum" onGenerateWithAI={callbacks.onGenerateWithAI} />}
                </div>
              </div>

              {isEditMode && (
                <div className="mb-4 flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                    style={{ borderColor: "hsl(var(--border))" }}
                    onClick={() => setActiveModal("syllabus")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Syllabus
                  </button>
                </div>
              )}

              <div>
                {!courseData.sections || courseData.sections.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No course content added yet</p>
                    {isEditMode && (
                      <button
                        className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                        style={{ borderColor: "hsl(var(--border))" }}
                        onClick={() => setActiveModal("syllabus")}
                      >
                        Add Course Content
                      </button>
                    )}
                  </div>
                ) : (
                  courseData.sections.map((section, index) => {
                    const norm =
                      section.modules && section.modules.length > 0
                        ? section
                        : section.subtopics
                          ? {
                              ...section,
                              modules: [
                                {
                                  id: `mod-${section.id}`,
                                  title: "Content",
                                  order: 0,
                                  lectures: section.subtopics,
                                },
                              ],
                            }
                          : { ...section, modules: [] };
                    const lectureCount = norm.modules.reduce(
                      (acc, m) => acc + m.lectures.length,
                      0,
                    );
                    const isExpanded = expandedSections.has(section.id);
                    return (
                      <div
                        key={section.id}
                        className="border-b last:border-b-0"
                        style={{ borderColor: "hsl(var(--border))" }}
                      >
                        <button
                          className="w-full flex items-center gap-3 py-4 text-left"
                          onClick={() => toggleSyllabusSection(section.id)}
                        >
                          <span
                            className="text-xs font-bold shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
                            style={{ color: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary) / 0.08)" }}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                              {decodeHtmlEntities(section.title)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                              {lectureCount} lectures
                              {(previewCounts.bySection.get(section.id) ?? 0) > 0 && (
                                  <>
                                    {" "}
                                    &bull;{" "}
                                    {/* "preview", not "free to watch": what is
                                        attached is a sample, which may be a
                                        short clip rather than the whole
                                        lecture. Promising a free lecture and
                                        delivering two minutes is worse than
                                        promising nothing. */}
                                    <span
                                      className="font-semibold"
                                      style={{ color: "hsl(var(--primary))" }}
                                    >
                                      {previewCounts.bySection.get(section.id)}{" "}
                                      {previewCounts.bySection.get(section.id) === 1
                                        ? "preview"
                                        : "previews"}
                                    </span>
                                  </>
                                )}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="pb-4 pl-9 space-y-3">
                            {norm.modules.map((module) => (
                              <div key={module.id}>
                                {norm.modules.length > 1 && (
                                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                                    {decodeHtmlEntities(module.title)}
                                  </p>
                                )}
                                <div>
                                  {module.lectures.map((lecture) => {
                                    const preview = lecture.previewVideo;
                                    // Playable only once a video is attached.
                                    // In the editor there is nothing to play,
                                    // so onPreviewPlay is absent and the
                                    // control stays hidden.
                                    const canPlay = Boolean(
                                      preview?.videoKey && onPreviewPlay
                                    );
                                    // Stored as a count of seconds; a reader
                                    // wants a clock.
                                    const duration = formatClockDuration(
                                      lecture.duration
                                    );
                                    return (
                                      <div
                                        key={lecture.id}
                                        className="flex items-center gap-2.5 py-1.5"
                                      >
                                        <Play className="h-3 w-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                                        <span className="min-w-0 flex-1 break-words text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                                          {decodeHtmlEntities(lecture.title)}
                                        </span>
                                        {canPlay && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onPreviewPlay?.({
                                                videoKey: preview!.videoKey,
                                                title:
                                                  preview!.title ||
                                                  decodeHtmlEntities(lecture.title),
                                              })
                                            }
                                            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                                            style={{
                                              color: "hsl(var(--primary))",
                                              backgroundColor: "hsl(var(--primary) / 0.1)",
                                            }}
                                          >
                                            <PlayCircle className="h-3 w-3" />
                                            Preview
                                          </button>
                                        )}
                                        {duration && (
                                          <span className="shrink-0 text-xs tabular-nums" style={{ color: "hsl(var(--muted-foreground))" }}>
                                            {duration}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CourseSectionWrapper>

            {/* Course Includes */}
            <CourseSectionWrapper
              sectionKey="offerings"
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xl font-bold flex items-center gap-2"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <Package className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <EditableText
                    value={courseData.sectionHeadlineOfferings ?? "This Course Includes"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineOfferings: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    <AIButton sectionKey="offerings" onGenerateWithAI={callbacks.onGenerateWithAI} />
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => setActiveModal("offerings")}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!courseData.offerings || courseData.offerings.length === 0 ? (
                  <p className="text-sm col-span-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {isEditMode ? "Click Edit to add course offerings" : "Course offerings not specified"}
                  </p>
                ) : (
                  courseData.offerings.map((offering) => (
                    <div key={offering.id} className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                      >
                        <Video className="h-5 w-5" />
                      </div>
                      <span className="text-sm" style={{ color: "hsl(var(--card-foreground))" }}>
                        {offering.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CourseSectionWrapper>

            {/* Requirements */}
            <CourseSectionWrapper
              sectionKey="requirements"
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
              headerActions={isEditMode && <AIButton sectionKey="requirements" onGenerateWithAI={callbacks.onGenerateWithAI} />}
            >
              <div className="mb-6">
                <h2
                  className="text-xl font-bold"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <EditableText
                    value={courseData.sectionHeadlineRequirements ?? "Requirements"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineRequirements: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
              </div>
              <EditableList
                items={courseData.prerequisites || []}
                onChange={(items) => callbacks.onEditPrerequisites?.(items)}
                icon={<ChevronRight className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />}
                placeholder="Add prerequisite..."
                addLabel="Add Requirement"
                emptyMessage="No prerequisites - suitable for beginners"
                itemClassName="text-sm"
              />
            </CourseSectionWrapper>

            {/* Description */}
            <CourseSectionWrapper
              sectionKey="description"
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
              headerActions={isEditMode && <AIButton sectionKey="description" onGenerateWithAI={callbacks.onGenerateWithAI} />}
            >
              <div className="mb-6">
                <h2
                  className="text-xl font-bold"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <EditableText
                    value={courseData.sectionHeadlineDescription ?? "Description"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineDescription: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
              </div>
              <EditableText
                value={courseData.description || ""}
                onChange={(description) => callbacks.onEditDescription?.(description)}
                as="div"
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "hsl(var(--foreground) / 0.75)" }}
                placeholder="Add a detailed course description..."
                multiline
              />
            </CourseSectionWrapper>

            {/* Instructors */}
            {(isEditMode || instructors.length > 0) && (
            <CourseSectionWrapper
              sectionKey="instructor"
              className="py-8"
              style={{
                backgroundColor: "transparent",
                border: "none",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xl font-bold flex items-center gap-2"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <GraduationCap className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <EditableText
                    value={courseData.sectionHeadlineInstructor ?? "Meet Your Instructors"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineInstructor: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                {isEditMode && (
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => setActiveModal("mentor")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </div>
              {instructors.length === 0 ? (
                <div className="text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No instructors assigned</p>
                  {isEditMode && (
                    <button
                      className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                      style={{ borderColor: "hsl(var(--border))" }}
                      onClick={() => setActiveModal("mentor")}
                    >
                      Add Instructor
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
                  {instructors.map((instructor) => {
                    const bioExpanded = expandedBios.has(instructor.id);
                    const bio = decodeHtmlEntities(instructor.bio) || "";
                    const shouldTruncate = bio.length > 150;
                    const displayBio = shouldTruncate && !bioExpanded ? bio.slice(0, 150) + "..." : bio;
                    return (
                      <div
                        key={instructor.id}
                        className="py-5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative flex-shrink-0">
                            {instructor.avatar ? (
                              <img
                                src={instructor.avatar}
                                alt={instructor.name}
                                className="h-24 w-24 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="h-24 w-24 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: "hsl(var(--muted))" }}
                              >
                                <User className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
                              </div>
                            )}
                            <div
                              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full"
                              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                            >
                              <GraduationCap className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
                              {decodeHtmlEntities(instructor.name)}
                            </h4>
                            <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground) / 0.6)" }}>
                              {decodeHtmlEntities(instructor.role)} {instructor.company && `at ${decodeHtmlEntities(instructor.company)}`}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                              {instructor.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                  <span className="font-medium">{instructor.rating}</span> rating
                                </span>
                              )}
                              {instructor.students && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {formatNumber(instructor.students)} students
                                </span>
                              )}
                              {instructor.courses && (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-3.5 w-3.5" />
                                  {instructor.courses} courses
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {bio && (
                          <div className="mt-4">
                            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--foreground) / 0.7)" }}>
                              {displayBio}
                            </p>
                            {shouldTruncate && (
                              <button
                                type="button"
                                onClick={() => toggleBio(instructor.id)}
                                className="mt-2 rounded-full px-4 py-1 text-xs font-medium transition-colors"
                                style={{
                                  backgroundColor: "hsl(var(--primary) / 0.1)",
                                  color: "hsl(var(--primary))",
                                }}
                              >
                                {bioExpanded ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        )}
                        {((instructor.experiences && instructor.experiences.length > 0) || (instructor.socialLinks && instructor.socialLinks.length > 0)) && (
                          <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-3">
                            {instructor.experiences && instructor.experiences.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {instructor.experiences.map((exp, idx) => {
                                  const detailKey = `${instructor.id}-${idx}`;
                                  const details = exp.details || "";
                                  const shouldTruncateDetail = details.length > 100;
                                  const isDetailExpanded = expandedExpDetails.has(detailKey);
                                  const displayDetail = shouldTruncateDetail && !isDetailExpanded ? details.slice(0, 100) + "..." : details;
                                  return (
                                    <div key={idx} className="flex items-start gap-2.5">
                                      {exp.companyLogo ? (
                                        <img src={exp.companyLogo} alt={exp.company} className="h-8 w-8 rounded object-contain flex-shrink-0 mt-0.5" style={{ backgroundColor: "hsl(var(--muted))", padding: "2px" }} />
                                      ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded flex-shrink-0 mt-0.5" style={{ backgroundColor: "hsl(var(--muted))" }}>
                                          <span className="text-xs font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.company.charAt(0)}</span>
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm font-medium" style={{ color: "hsl(var(--foreground) / 0.85)" }}>{exp.company}</span>
                                          {exp.years > 0 && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>&middot; {exp.years} yr{exp.years !== 1 ? "s" : ""}</span>}
                                        </div>
                                        {details && (
                                          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                                            {displayDetail}
                                            {shouldTruncateDetail && (
                                              <button
                                                type="button"
                                                onClick={() => toggleExpDetail(detailKey)}
                                                className="ml-1 font-medium"
                                                style={{ color: "hsl(var(--primary))" }}
                                              >
                                                {isDetailExpanded ? "Show less" : "Show more"}
                                              </button>
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {instructor.socialLinks && instructor.socialLinks.length > 0 && (
                              <div className="flex items-center gap-1">
                                {instructor.socialLinks.map((link) => {
                                  const Icon = SOCIAL_ICON_MAP[link.platform];
                                  if (!Icon || !link.url.startsWith("http")) return null;
                                  return (
                                    <a
                                      key={link.platform}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-md p-1.5 transition-colors hover:bg-muted"
                                      style={{ color: "hsl(var(--muted-foreground))" }}
                                      title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CourseSectionWrapper>
            )}

            {/* FAQ */}
            <CourseSectionWrapper
              sectionKey="faq"
              className="py-8"
              style={{
                backgroundColor: "transparent",
                border: "none",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xl font-bold flex items-center gap-2"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <HelpCircle className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <EditableText
                    value={courseData.sectionHeadlineFaq ?? "Frequently Asked Questions"}
                    onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineFaq: v })}
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    <AIButton sectionKey="faqs" onGenerateWithAI={callbacks.onGenerateWithAI} />
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => setActiveModal("faq")}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                )}
              </div>
              {!courseData.faqs || courseData.faqs.length === 0 ? (
                <div className="text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No FAQs added yet</p>
                  {isEditMode && (
                    <button
                      className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                      style={{ borderColor: "hsl(var(--border))" }}
                      onClick={() => setActiveModal("faq")}
                    >
                      Add FAQs
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {courseData.faqs.map((faq, index) => {
                    const isOpen = expandedFAQs.has(faq.id) || (expandedFAQs.size === 0 && index === 0);
                    return (
                      <div
                        key={faq.id}
                        className={cn(
                          "border-b last:border-b-0 transition-colors",
                          isOpen && "rounded-lg"
                        )}
                        style={{
                          borderColor: "hsl(var(--border))",
                          backgroundColor: isOpen ? "hsl(var(--muted) / 0.2)" : "transparent",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFAQ(faq.id)}
                          className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-muted/30"
                        >
                          <h4 className="font-medium pr-2" style={{ color: "hsl(var(--foreground))" }}>
                            {faq.question}
                          </h4>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-200",
                              !isOpen && "-rotate-90"
                            )}
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--foreground) / 0.7)" }}>
                              {faq.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CourseSectionWrapper>

            {/* Course Ratings (before recommendations; Udemy-style) */}
            <CourseRatingsSection />

            {/* Course Recommendations */}
            {(courseData.recommendations?.length ?? 0) > 0 || (isEditMode && callbacks.onEditRecommendations) ? (
              <CourseSectionWrapper
                sectionKey="recommendations"
                className="py-8"
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2
                    className="text-xl font-bold flex items-center gap-2"
                    style={{ color: "hsl(var(--card-foreground))" }}
                  >
                    <BookMarked className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                    <EditableText
                      value={courseData.sectionHeadlineRecommendations ?? "You May Also Like"}
                      onChange={(v) => callbacks.onEditSectionLabels?.({ sectionHeadlineRecommendations: v })}
                      as="span"
                      className="inline"
                      placeholder="Section heading..."
                    />
                  </h2>
                  {isEditMode && callbacks.onEditRecommendations && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => callbacks.onEditRecommendations?.()}
                    >
                      <Pencil className="h-4 w-4" />
                      {courseData.recommendations?.length ? "Edit" : "Add"}
                    </button>
                  )}
                </div>
                {(courseData.recommendations?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {courseData.recommendations!.map((rec) => (
                    <a
                      key={rec.id}
                      href={`/courses/${rec.slug}`}
                      className="block rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                      style={{ backgroundColor: "hsl(var(--card))" }}
                    >
                      <div className="aspect-video relative overflow-hidden rounded-t-lg" style={{ backgroundColor: "hsl(var(--muted))" }}>
                        {rec.thumbnailUrl ? (
                          <img
                            src={rec.thumbnailUrl}
                            alt={rec.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="h-12 w-12 opacity-50" style={{ color: "hsl(var(--muted-foreground))" }} />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-sm line-clamp-2" style={{ color: "hsl(var(--foreground))" }}>
                          {rec.title}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
                ) : (
                  <div className="text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <BookMarked className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No course recommendations yet</p>
                    {isEditMode && callbacks.onEditRecommendations && (
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                        style={{ borderColor: "hsl(var(--border))" }}
                        onClick={() => callbacks.onEditRecommendations?.()}
                      >
                        Add Recommendations
                      </button>
                    )}
                  </div>
                )}
              </CourseSectionWrapper>
            ) : null}
          </div>

          {/* Right Column - Sticky Pricing Card */}
          <div className="lg:w-[380px]">
            <div
              className="sticky top-24 rounded-xl border shadow-lg overflow-hidden"
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            >
              {/* Price Header */}
              <div className="p-6">
                {isEditMode && (
                  <button
                    className="mb-4 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => setActiveModal("pricing")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Pricing
                  </button>
                )}

                {callbacks.hasAccess && !isEditMode ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-lg font-semibold" style={{ color: "hsl(var(--primary))" }}>
                      <CheckCircle2 className="h-6 w-6" />
                      You have access
                    </div>
                    <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Continue where you left off
                    </p>
                  </div>
                ) : accessManagedActive ? null : courseData.purchaseMode === "FREE" ? (
                  <div className="text-center">
                    <div className="text-4xl font-bold" style={{ color: "hsl(var(--primary))" }}>
                      FREE
                    </div>
                    <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Enroll now and start learning
                    </p>
                  </div>
                ) : callbacks.appliedCoupon ? (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                        {callbacks.appliedCoupon.currency === "USD" ? "$" : "₹"}
                        {formatNumber(callbacks.appliedCoupon.net_amount, callbacks.appliedCoupon.currency === "USD" ? "en-US" : "en-IN")}
                      </span>
                      <span className="text-lg line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {callbacks.appliedCoupon.currency === "USD" ? "$" : "₹"}
                        {formatNumber(callbacks.appliedCoupon.original_amount, callbacks.appliedCoupon.currency === "USD" ? "en-US" : "en-IN")}
                      </span>
                    </div>
                    <div
                      className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "hsl(142 71% 45% / 0.12)", color: "hsl(142 71% 35%)" }}
                    >
                      <Tag className="h-3 w-3" />
                      Coupon applied
                    </div>
                  </div>
                ) : priceUnavailable ? (
                  <div className="text-center">
                    <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Not available for purchase
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                        {primarySymbol}{formatNumber(finalPrice, priceLocale)}
                      </span>
                      {primaryDiscount > 0 && (
                        <>
                          <span className="text-lg line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {primarySymbol}{formatNumber(primaryPrice, priceLocale)}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-sm font-medium"
                            style={{
                              backgroundColor: "hsl(var(--primary))",
                              color: "hsl(var(--primary-foreground))",
                            }}
                          >
                            {savingLabel}
                          </span>
                        </>
                      )}
                    </div>
                    {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                      <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {/* CTA Buttons */}
                {callbacks.hasAccess && !isEditMode ? (
                  <button
                    className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-colors hover:opacity-90 active:opacity-95"
                    style={{
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                    onClick={callbacks.onContinueLearning}
                  >
                    <GraduationCap className="h-5 w-5" />
                    Continue Learning
                  </button>
                ) : accessManagedActive ? (
                  <AccessManagedCta
                    hasAccess={false}
                    supportEmail={supportEmail}
                    contactSubject={courseData.title}
                    fullWidth
                    className="mt-4"
                  />
                ) : priceUnavailable && !isEditMode ? null : (
                  <>
                    <button
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-colors hover:opacity-90 active:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                      }}
                      onClick={!isEditMode ? callbacks.onBuyNow : undefined}
                      disabled={callbacks.isEnrollingFree || callbacks.isPurchaseDisabled}
                    >
                      {callbacks.isEnrollingFree ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Enrolling...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5" />
                          {courseData.purchaseMode === "FREE" ? "Enroll Now - Free" : "Buy Now"}
                        </>
                      )}
                    </button>

                    {courseData.purchaseMode === "PAID" && (
                      <button
                        className="mt-2 w-full rounded-lg border px-4 py-3 font-semibold transition-colors hover:bg-muted/50 active:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{
                          borderColor: "hsl(var(--border))",
                          color: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--card-foreground))",
                        }}
                        onClick={!isEditMode ? (callbacks.isInCart ? callbacks.onRemoveFromCart : callbacks.onAddToCart) : undefined}
                        disabled={callbacks.isPurchaseDisabled}
                      >
                        {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                      </button>
                    )}
                  </>
                )}

                {!isEditMode && callbacks.onShare && (
                  <button
                    className="mt-2 w-full rounded-lg border px-4 py-3 font-semibold transition-colors hover:bg-muted/50 active:opacity-90 flex items-center justify-center gap-2"
                    style={{
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--card-foreground))",
                    }}
                    onClick={callbacks.onShare}
                  >
                    <Share2 className="h-5 w-5" />
                    Share
                  </button>
                )}
              </div>

              {/* Coupon Section, hidden when user already has access or in edit mode */}
              {courseData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && !(callbacks.hasAccess && !isEditMode) && !isEditMode && (callbacks.couponSlot || callbacks.onValidateCoupon) && (
                <div className="border-t p-4" style={{ borderColor: "hsl(var(--border))" }}>
                  {callbacks.couponSlot ? (
                    callbacks.couponSlot
                  ) : callbacks.appliedCoupon ? (
                    <div
                      className="flex items-center justify-between rounded-md px-3 py-2"
                      style={{ backgroundColor: "hsl(142 71% 45% / 0.08)", border: "1px solid hsl(142 71% 45% / 0.2)" }}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" style={{ color: "hsl(142 71% 35%)" }} />
                        <span className="font-mono text-sm font-medium">{callbacks.appliedCoupon.code}</span>
                        <span className="text-sm" style={{ color: "hsl(142 71% 35%)" }}>
                          {callbacks.appliedCoupon.discount_type === "PERCENTAGE"
                            ? `${callbacks.appliedCoupon.discount_value}% off`
                            : `${callbacks.appliedCoupon.currency === "USD" ? "$" : "₹"}${callbacks.appliedCoupon.discount_amount} off`}
                        </span>
                      </div>
                      <button type="button" onClick={callbacks.onCouponRemoved} className="rounded p-1 hover:opacity-70">
                        <X className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                      </button>
                    </div>
                  ) : (
                    <InlineCouponInput onValidate={callbacks.onValidateCoupon} onApply={callbacks.onCouponApplied} />
                  )}
                </div>
              )}

              {/* Guarantee, hidden when user already has access or storefront is access-managed */}
              {!(callbacks.hasAccess && !isEditMode) && !accessManagedActive && (
                <div className="border-t p-4 text-center" style={{ borderColor: "hsl(var(--border))" }}>
                  <div className="flex items-center justify-center gap-2">
                    <Gift className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                    <EditableText
                      value={courseData.pricingGuaranteeText ?? "Get Instant Access"}
                      onChange={(v) => callbacks.onEditSectionLabels?.({ pricingGuaranteeText: v })}
                      as="span"
                      className="text-sm"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                      placeholder="Guarantee text..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
