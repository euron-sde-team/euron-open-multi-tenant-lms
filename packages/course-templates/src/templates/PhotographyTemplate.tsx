"use client";

import {
  CalendarDays,
  Clock,
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
  User,
  Pencil,
  BookMarked,
  GraduationCap,
  Loader2,
  Share2,
  Award,
  ArrowRight,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Globe,
  Facebook,
  Instagram,
} from "lucide-react";
import { useState } from "react";
import { formatNumber, COURSE_DIFFICULTIES } from "@open-mtlms/shared";
import { AccessManagedCta } from "@open-mtlms/core";
import { cn, formatCourseLanguages, decodeHtmlEntities, resolveTemplatePrice } from "../lib/utils";
import { useCourseData, useCourseEdit } from "../context";
import {
  EditableText,
  EditableList,
  EditableThumbnail,
  EditableMode,
} from "../components/editable";
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

interface PhotographyTemplateProps {
  className?: string;
}

interface AIButtonProps {
  sectionKey:
    | "subtitle"
    | "learningOutcomes"
    | "curriculum"
    | "offerings"
    | "requirements"
    | "description"
    | "faqs"
    | "thumbnails";
  onGenerateWithAI?: (sectionKey: AIButtonProps["sectionKey"]) => void;
}

function AIButton({ sectionKey, onGenerateWithAI }: AIButtonProps) {
  if (!onGenerateWithAI) return null;
  return (
    <button
      type="button"
      onClick={() => onGenerateWithAI(sectionKey)}
      className="inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wider transition-all"
      style={{
        border: "3px solid hsl(var(--foreground))",
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
      }}
      title="Generate with AI"
    >
      <Sparkles
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: "hsl(var(--primary))" }}
      />
      <span>AI</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Neo-Brutalist / Photography Template                               */
/* ------------------------------------------------------------------ */

export function PhotographyTemplate({ className }: PhotographyTemplateProps) {
  const { courseData, instructors, categories, accessManaged, supportEmail, onPreviewPlay } = useCourseData();
  const { isEditMode, callbacks, setActiveModal } = useCourseEdit();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());
  const [expandedBios, setExpandedBios] = useState<Set<string>>(new Set());
  const [expandedExpDetails, setExpandedExpDetails] = useState<Set<string>>(new Set());
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Category
  const categoryIds = courseData.categoryIds || [];
  const lastCategory =
    categoryIds.length > 0
      ? categories.find((c) => c.id === categoryIds[categoryIds.length - 1])
      : null;
  const categoryName = lastCategory?.name || "Course";

  // Pricing, pre-resolved multi-currency priceParts win; legacy INR/USD math
  // (driven by callbacks.preferredCurrency) is the fallback.
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


  // Syllabus helpers
  const toggleSyllabusSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(faqId)) next.delete(faqId);
      else next.add(faqId);
      return next;
    });
  };

  const toggleBio = (id: string) => {
    setExpandedBios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
  const allExpanded =
    allSectionIds.length > 0 &&
    allSectionIds.every((id) => expandedSections.has(id));
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
      0,
    ) || 0;

  /* ---- shared brutal style helpers ---- */
  const brutalBorder = {
    border: "3px solid hsl(var(--foreground))",
  };
  const brutalShadow = {
    boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
  };
  const brutalCard = {
    ...brutalBorder,
    ...brutalShadow,
    backgroundColor: "hsl(var(--card))",
  };
  const accentBg = {
    backgroundColor: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
  };

  return (
    <div
      className={cn("min-h-screen font-sans antialiased", className)}
      style={{
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
      }}
    >
      {/* ============================================================ */}
      {/*  HERO SECTION                                                 */}
      {/* ============================================================ */}
      <section className="relative flex min-h-[500px] items-center justify-center overflow-hidden sm:min-h-[600px] lg:min-h-[700px]">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          {courseData.webThumbnailUrl || courseData.mobileThumbnailUrl ? (
            <img
              className="h-full w-full object-cover"
              src={courseData.webThumbnailUrl || courseData.mobileThumbnailUrl}
              alt={courseData.title || "Course hero"}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ backgroundColor: "hsl(var(--muted))" }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.75))",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm font-bold uppercase tracking-widest text-white/70">
                Home
              </span>
              <ChevronRight className="h-3 w-3 text-white/50" />
              {isEditMode ? (
                <button
                  onClick={() => setActiveModal("category")}
                  className="flex items-center gap-1 text-sm font-bold uppercase tracking-widest text-white/70 hover:text-white"
                >
                  {categoryName}
                  <Pencil className="h-3 w-3 opacity-50" />
                </button>
              ) : (
                <span className="text-sm font-bold uppercase tracking-widest text-white/70">
                  {categoryName}
                </span>
              )}
            </div>

            {/* Title */}
            <EditableText
              value={courseData.title || ""}
              onChange={(title) => callbacks.onEditTitle?.(title)}
              as="h1"
              className="text-4xl font-black uppercase leading-[0.95] tracking-tighter text-white sm:text-5xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display, serif)" }}
              placeholder="Enter course title..."
            />

            {/* Subtitle */}
            <div className="mx-auto flex max-w-3xl items-center justify-center gap-2">
              <EditableText
                value={courseData.subTitle || ""}
                onChange={(subTitle) => callbacks.onEditSubtitle?.(subTitle)}
                as="p"
                className="text-lg font-medium text-white/90 sm:text-xl lg:text-2xl"
                placeholder="Add a compelling subtitle..."
              />
              {isEditMode && (
                <AIButton
                  sectionKey="subtitle"
                  onGenerateWithAI={callbacks.onGenerateWithAI}
                />
              )}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 pt-6">
              {callbacks.hasAccess && !isEditMode ? (
                <button
                  className="px-6 py-3 text-base font-bold uppercase tracking-wider transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] sm:px-8 sm:py-4 sm:text-lg"
                  style={{
                    ...accentBg,
                    border: "3px solid hsl(var(--foreground))",
                    boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                  }}
                  onClick={callbacks.onContinueLearning}
                >
                  <GraduationCap className="mr-2 inline-block h-5 w-5" />
                  Continue Learning
                </button>
              ) : (
                <>
                  {accessManagedActive ? (
                    <AccessManagedCta
                      hasAccess={false}
                      supportEmail={supportEmail}
                      contactSubject={courseData.title}
                      size="lg"
                    />
                  ) : (
                  <button
                    className="px-6 py-3 text-base font-bold uppercase tracking-wider transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] disabled:opacity-70 disabled:cursor-not-allowed sm:px-8 sm:py-4 sm:text-lg"
                    style={{
                      ...accentBg,
                      border: "3px solid hsl(var(--foreground))",
                      boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                    }}
                    onClick={!isEditMode ? callbacks.onBuyNow : undefined}
                    disabled={callbacks.isEnrollingFree || callbacks.isPurchaseDisabled}
                  >
                    {callbacks.isEnrollingFree ? (
                      <>
                        <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      <>
                        {courseData.purchaseMode === "FREE"
                          ? "Enroll Now"
                          : "Enroll Now"}
                        <ArrowRight className="ml-2 inline-block h-5 w-5" />
                      </>
                    )}
                  </button>
                  )}
                  {courseData.previewUrl && !isEditMode && (
                    <button
                      className="flex items-center gap-2 px-6 py-3 text-base font-bold uppercase tracking-wider text-white transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] sm:px-8 sm:py-4 sm:text-lg"
                      style={{
                        border: "3px solid #FFFFFF",
                        boxShadow: "6px 6px 0px 0px rgba(255,255,255,0.3)",
                        backgroundColor: "transparent",
                      }}
                      onClick={() => setShowPreviewModal(true)}
                    >
                      <Play className="h-5 w-5" /> Watch Preview
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-8 pt-8 sm:gap-12">
              {courseData.rating != null && courseData.rating > 0 && (
                <div className="text-white">
                  <p className="text-4xl font-black tabular-nums sm:text-5xl">
                    {courseData.rating.toFixed(1)}
                  </p>
                  <p className="mt-1 text-sm font-medium uppercase tracking-widest text-white/70">
                    Rating
                  </p>
                </div>
              )}
              {courseData.ratingTotalCount != null &&
                courseData.ratingTotalCount > 0 && (
                  <div className="text-white">
                    <p className="text-4xl font-black tabular-nums sm:text-5xl">
                      {formatNumber(courseData.ratingTotalCount)}
                    </p>
                    <p className="mt-1 text-sm font-medium uppercase tracking-widest text-white/70">
                      Reviews
                    </p>
                  </div>
                )}
              {courseData.sections && courseData.sections.length > 0 && (
                <div className="text-white">
                  <p className="text-4xl font-black tabular-nums sm:text-5xl">
                    {totalLectures}
                  </p>
                  <p className="mt-1 text-sm font-medium uppercase tracking-widest text-white/70">
                    Lectures
                  </p>
                </div>
              )}
            </div>
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

      {/* ============================================================ */}
      {/*  ABOUT / INSTRUCTOR SECTION (Top-level, like mockup)          */}
      {/* ============================================================ */}
      <CourseSectionWrapper
        sectionKey="instructor"
        className="py-16 sm:py-24"
        style={{ backgroundColor: "transparent", border: "none" }}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Instructor Image */}
            <div className="relative">
              {instructors.length > 0 && instructors[0].avatar ? (
                <div
                  className="h-[300px] overflow-hidden sm:h-[400px] lg:h-[600px]"
                  style={brutalCard}
                >
                  <img
                    src={instructors[0].avatar}
                    alt={instructors[0].name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="flex h-[300px] items-center justify-center sm:h-[400px] lg:h-[600px]"
                  style={{
                    ...brutalCard,
                    backgroundColor: "hsl(var(--muted))",
                  }}
                >
                  <User
                    className="h-24 w-24"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                </div>
              )}
            </div>

            {/* Instructor Details */}
            <div className="space-y-6">
              <h2
                className="text-4xl font-black uppercase tracking-tighter sm:text-5xl lg:text-6xl"
                style={{
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-display, serif)",
                }}
              >
                <EditableText
                  value={
                    courseData.sectionHeadlineInstructor ??
                    "Learn from\nthe Best"
                  }
                  onChange={(v) =>
                    callbacks.onEditSectionLabels?.({
                      sectionHeadlineInstructor: v,
                    })
                  }
                  as="span"
                  className="inline"
                  placeholder="Section heading..."
                />
              </h2>

              {instructors.length > 0 ? (
                <>
                  {instructors.map((instructor) => {
                    const bioExpanded = expandedBios.has(instructor.id);
                    const bio = decodeHtmlEntities(instructor.bio) || "";
                    const shouldTruncate = bio.length > 200;
                    const displayBio =
                      shouldTruncate && !bioExpanded
                        ? bio.slice(0, 200) + "..."
                        : bio;
                    return (
                      <div key={instructor.id} className="space-y-4">
                        <div>
                          <h4
                            className="text-2xl font-bold"
                            style={{ color: "hsl(var(--foreground))" }}
                          >
                            {decodeHtmlEntities(instructor.name)}
                          </h4>
                          <p
                            className="text-base font-medium"
                            style={{
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            {decodeHtmlEntities(instructor.role)}{" "}
                            {instructor.company &&
                              `at ${decodeHtmlEntities(instructor.company)}`}
                          </p>
                        </div>
                        {bio && (
                          <div>
                            <p
                              className="text-lg leading-relaxed"
                              style={{
                                color: "hsl(var(--foreground) / 0.8)",
                              }}
                            >
                              {displayBio}
                            </p>
                            {shouldTruncate && (
                              <button
                                type="button"
                                onClick={() => toggleBio(instructor.id)}
                                className="mt-2 text-sm font-bold uppercase tracking-wider"
                                style={{
                                  color: "hsl(var(--primary))",
                                }}
                              >
                                {bioExpanded ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        )}
                        {/* Stats row */}
                        <div className="flex flex-wrap gap-4">
                          {instructor.rating && (
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                              {instructor.rating} rating
                            </span>
                          )}
                          {instructor.students && (
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              <Users className="h-4 w-4" />
                              {formatNumber(instructor.students)} students
                            </span>
                          )}
                          {instructor.courses && (
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              <BookOpen className="h-4 w-4" />
                              {instructor.courses} courses
                            </span>
                          )}
                        </div>
                        {((instructor.experiences && instructor.experiences.length > 0) || (instructor.socialLinks && instructor.socialLinks.length > 0)) && (
                          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
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
                                          <span className="text-xs font-bold uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.company.charAt(0)}</span>
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "hsl(var(--foreground) / 0.85)" }}>{exp.company}</span>
                                          {exp.years > 0 && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>&middot; {exp.years} yr{exp.years !== 1 ? "s" : ""}</span>}
                                        </div>
                                        {details && (
                                          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                                            {displayDetail}
                                            {shouldTruncateDetail && (
                                              <button type="button" onClick={() => toggleExpDetail(detailKey)} className="ml-1 font-medium" style={{ color: "hsl(var(--primary))" }}>
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
                </>
              ) : (
                <div
                  className="py-8 text-center"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <User className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No instructors assigned</p>
                </div>
              )}

              {isEditMode && (
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors"
                  style={brutalBorder}
                  onClick={() => setActiveModal("mentor")}
                >
                  <Pencil className="h-4 w-4" />
                  {instructors.length > 0
                    ? "Edit Instructors"
                    : "Add Instructor"}
                </button>
              )}

              {/* Award / Certified cards */}
              <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
                <div className="p-4 sm:p-5" style={brutalCard}>
                  <Award
                    className="mb-3 h-8 w-8"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  <h4
                    className="text-lg font-bold"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    Award Winning
                  </h4>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    Expert-led, industry-recognized courses
                  </p>
                </div>
                <div className="p-4 sm:p-5" style={brutalCard}>
                  <GraduationCap
                    className="mb-3 h-8 w-8"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  <h4
                    className="text-lg font-bold"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    Certified
                  </h4>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    Accredited courses with certificates
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CourseSectionWrapper>

      {/* ============================================================ */}
      {/*  META INFO BAR (Mode, Language, Duration, Difficulty)          */}
      {/* ============================================================ */}
      <div
        className="border-y py-6"
        style={{ borderColor: "hsl(var(--foreground))" }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-6 px-4 sm:gap-10 lg:px-8">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            <EditableMode
              value={courseData.mode}
              style={{ color: "hsl(var(--foreground))" }}
            />
          </span>
          {isEditMode && callbacks.onEditLanguages ? (
            <button
              type="button"
              onClick={() => callbacks.onEditLanguages?.()}
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider hover:opacity-80"
            >
              🌐 {formatCourseLanguages(courseData.languages, courseData.language)}
              <Pencil className="h-3 w-3 opacity-50" />
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              🌐{" "}
              {formatCourseLanguages(courseData.languages, courseData.language)}
            </span>
          )}
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            <Clock className="h-4 w-4" />
            <EditableText
              value={courseData.duration || ""}
              onChange={(duration) => callbacks.onEditDuration?.(duration)}
              className="inline"
              placeholder="Duration"
            />
          </span>
          {(isEditMode ||
            (courseData.difficulty && courseData.difficulty !== "NONE")) && (
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <GraduationCap className="h-4 w-4" />
              {isEditMode && callbacks.onEditDifficulty ? (
                <select
                  value={courseData.difficulty ?? "NONE"}
                  onChange={(e) =>
                    callbacks.onEditDifficulty?.(
                      e.target.value as typeof courseData.difficulty,
                    )
                  }
                  className="border bg-transparent px-2 py-0.5 text-sm font-bold uppercase"
                  style={{
                    borderColor: "hsl(var(--foreground))",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {COURSE_DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span>
                  {COURSE_DIFFICULTIES.find(
                    (d) => d.value === courseData.difficulty,
                  )?.label ?? courseData.difficulty}
                </span>
              )}
            </span>
          )}
          {(courseData.validityDays == null || courseData.validityDays > 0) && (
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <CalendarDays className="h-4 w-4" />
              {courseData.validityDays == null
                ? "Lifetime access"
                : `${courseData.validityDays} days access`}
            </span>
          )}
          {((courseData.rating != null && courseData.rating > 0) ||
            (isEditMode && callbacks.onEditRating)) && (
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              {isEditMode && callbacks.onEditRating ? (
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={
                    ((
                      courseData as {
                        adminRatingOverride?: number;
                      }
                    ).adminRatingOverride ??
                      courseData.rating) ??
                    ""
                  }
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const count =
                      (
                        courseData as {
                          adminRatingCountOverride?: number;
                        }
                      ).adminRatingCountOverride ??
                      courseData.ratingTotalCount;
                    if (!Number.isNaN(v)) callbacks.onEditRating?.(v, count);
                  }}
                  className="w-14 border bg-transparent px-1 py-0.5 text-sm font-bold"
                  style={{
                    borderColor: "hsl(var(--foreground))",
                    color: "hsl(var(--foreground))",
                  }}
                />
              ) : (
                <span>{(courseData.rating ?? 0).toFixed(1)}</span>
              )}
            </span>
          )}
        </div>
      </div>


      {/* ============================================================ */}
      {/*  MAIN CONTENT GRID                                            */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row">
          {/* ---- LEFT COLUMN ---- */}
          <div className="min-w-0 flex-1 space-y-16">
            {/* LEARNING OUTCOMES */}
            <CourseSectionWrapper
              sectionKey="learningOutcomes"
              className="p-5 sm:p-8"
              style={brutalCard}
              headerActions={
                isEditMode && (
                  <AIButton
                    sectionKey="learningOutcomes"
                    onGenerateWithAI={callbacks.onGenerateWithAI}
                  />
                )
              }
            >
              <h2
                className="mb-6 text-3xl font-black uppercase tracking-tighter"
                style={{
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-display, serif)",
                }}
              >
                <CheckCircle2
                  className="mr-2 inline-block h-6 w-6"
                  style={{ color: "hsl(var(--primary))" }}
                />
                <EditableText
                  value={
                    courseData.sectionHeadlineLearningOutcomes ??
                    "What You'll Learn"
                  }
                  onChange={(v) =>
                    callbacks.onEditSectionLabels?.({
                      sectionHeadlineLearningOutcomes: v,
                    })
                  }
                  as="span"
                  className="inline"
                  placeholder="Section heading..."
                />
              </h2>
              <EditableList
                items={courseData.learningOutcomes || []}
                onChange={(items) =>
                  callbacks.onEditLearningOutcomes?.(items)
                }
                icon={
                  <CheckCircle2
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                }
                placeholder="Add learning outcome..."
                addLabel="Add Learning Outcome"
                emptyMessage="Click to add what students will learn"
                itemClassName="text-base font-medium"
              />
            </CourseSectionWrapper>

            {/* COURSE CONTENT / SYLLABUS */}
            <CourseSectionWrapper
              sectionKey="curriculum"
              style={{ backgroundColor: "transparent", border: "none" }}
            >
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2
                  className="text-2xl font-black uppercase tracking-tighter sm:text-3xl"
                  style={{
                    color: "hsl(var(--foreground))",
                    fontFamily: "var(--font-display, serif)",
                  }}
                >
                  <BookOpen
                    className="mr-2 inline-block h-6 w-6"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  <EditableText
                    value={
                      courseData.sectionHeadlineCourseContent ??
                      "Course Content"
                    }
                    onChange={(v) =>
                      callbacks.onEditSectionLabels?.({
                        sectionHeadlineCourseContent: v,
                      })
                    }
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className="text-sm font-bold"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {courseData.sections?.length || 0} sections &bull;{" "}
                    {totalLectures} lectures
                  </span>
                  {(courseData.sections?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllSections}
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      {allExpanded ? "Collapse all" : "Expand all"}
                    </button>
                  )}
                  {isEditMode && (
                    <AIButton
                      sectionKey="curriculum"
                      onGenerateWithAI={callbacks.onGenerateWithAI}
                    />
                  )}
                </div>
              </div>

              {isEditMode && (
                <div className="mb-4">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors"
                    style={brutalBorder}
                    onClick={() => setActiveModal("syllabus")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Syllabus
                  </button>
                </div>
              )}

              <div style={brutalBorder}>
                {!courseData.sections || courseData.sections.length === 0 ? (
                  <div
                    className="p-8 text-center"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p className="font-bold uppercase">
                      No course content added yet
                    </p>
                    {isEditMode && (
                      <button
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                        style={brutalBorder}
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
                        className="border-b-[3px] last:border-b-0"
                        style={{
                          borderColor: "hsl(var(--foreground))",
                          backgroundColor: isExpanded
                            ? "hsl(var(--muted) / 0.3)"
                            : "hsl(var(--card))",
                        }}
                      >
                        <button
                          className="flex w-full items-center gap-4 p-5 text-left transition-colors"
                          onClick={() => toggleSyllabusSection(section.id)}
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-black"
                            style={accentBg}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-base font-bold uppercase"
                              style={{
                                color: "hsl(var(--foreground))",
                              }}
                            >
                              {decodeHtmlEntities(section.title)}
                            </p>
                            <p
                              className="mt-0.5 text-xs font-medium"
                              style={{
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              {lectureCount} lectures
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-5 w-5 shrink-0" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="space-y-2 px-4 pb-4 pl-12 sm:px-5 sm:pb-5 sm:pl-[4.5rem]">
                            {norm.modules.map((module) => (
                              <div key={module.id}>
                                {norm.modules.length > 1 && (
                                  <p
                                    className="mb-1.5 text-xs font-bold uppercase tracking-widest"
                                    style={{
                                      color:
                                        "hsl(var(--muted-foreground))",
                                    }}
                                  >
                                    {decodeHtmlEntities(module.title)}
                                  </p>
                                )}
                                {module.lectures.map((lecture) => {
                                  const preview = lecture.previewVideo;
                                  const canPlay = Boolean(
                                    preview?.videoKey && onPreviewPlay
                                  );
                                  return (
                                    <div
                                      key={lecture.id}
                                      className="flex items-center gap-3 py-1.5"
                                    >
                                      <Play
                                        className="h-3 w-3 shrink-0"
                                        style={{
                                          color: "hsl(var(--primary))",
                                        }}
                                      />
                                      <span
                                        className="flex-1 text-sm"
                                        style={{
                                          color:
                                            "hsl(var(--muted-foreground))",
                                        }}
                                      >
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
                                            backgroundColor:
                                              "hsl(var(--primary) / 0.1)",
                                          }}
                                        >
                                          <PlayCircle className="h-3 w-3" />
                                          Preview
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
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

            {/* OFFERINGS / WHAT YOU GET */}
            <CourseSectionWrapper
              sectionKey="offerings"
              style={{ backgroundColor: "transparent", border: "none" }}
            >
              <div className="mb-8 flex items-center justify-between">
                <h2
                  className="text-3xl font-black uppercase tracking-tighter"
                  style={{
                    color: "hsl(var(--foreground))",
                    fontFamily: "var(--font-display, serif)",
                  }}
                >
                  <EditableText
                    value={
                      courseData.sectionHeadlineOfferings ?? "What You Get"
                    }
                    onChange={(v) =>
                      callbacks.onEditSectionLabels?.({
                        sectionHeadlineOfferings: v,
                      })
                    }
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    <AIButton
                      sectionKey="offerings"
                      onGenerateWithAI={callbacks.onGenerateWithAI}
                    />
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                      style={brutalBorder}
                      onClick={() => setActiveModal("offerings")}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {!courseData.offerings ||
                courseData.offerings.length === 0 ? (
                  <p
                    className="col-span-full text-sm font-bold uppercase"
                    style={{
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {isEditMode
                      ? "Click Edit to add course offerings"
                      : "Course offerings not specified"}
                  </p>
                ) : (
                  courseData.offerings.map((offering) => (
                    <div
                      key={offering.id}
                      className="p-6 text-center transition-all hover:translate-y-[-8px]"
                      style={brutalCard}
                    >
                      <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center"
                        style={{
                          ...brutalBorder,
                          backgroundColor: "hsl(var(--muted))",
                        }}
                      >
                        <Video
                          className="h-7 w-7"
                          style={{
                            color: "hsl(var(--primary))",
                          }}
                        />
                      </div>
                      <p
                        className="text-sm font-bold uppercase"
                        style={{
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {offering.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CourseSectionWrapper>

            {/* REQUIREMENTS */}
            <CourseSectionWrapper
              sectionKey="requirements"
              className="p-5 sm:p-8"
              style={brutalCard}
              headerActions={
                isEditMode && (
                  <AIButton
                    sectionKey="requirements"
                    onGenerateWithAI={callbacks.onGenerateWithAI}
                  />
                )
              }
            >
              <h2
                className="mb-6 text-3xl font-black uppercase tracking-tighter"
                style={{
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-display, serif)",
                }}
              >
                <EditableText
                  value={
                    courseData.sectionHeadlineRequirements ?? "Requirements"
                  }
                  onChange={(v) =>
                    callbacks.onEditSectionLabels?.({
                      sectionHeadlineRequirements: v,
                    })
                  }
                  as="span"
                  className="inline"
                  placeholder="Section heading..."
                />
              </h2>
              <EditableList
                items={courseData.prerequisites || []}
                onChange={(items) =>
                  callbacks.onEditPrerequisites?.(items)
                }
                icon={
                  <ChevronRight
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                }
                placeholder="Add prerequisite..."
                addLabel="Add Requirement"
                emptyMessage="No prerequisites - suitable for beginners"
                itemClassName="text-base font-medium"
              />
            </CourseSectionWrapper>

            {/* DESCRIPTION */}
            <CourseSectionWrapper
              sectionKey="description"
              className="p-5 sm:p-8"
              style={brutalCard}
              headerActions={
                isEditMode && (
                  <AIButton
                    sectionKey="description"
                    onGenerateWithAI={callbacks.onGenerateWithAI}
                  />
                )
              }
            >
              <h2
                className="mb-6 text-3xl font-black uppercase tracking-tighter"
                style={{
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-display, serif)",
                }}
              >
                <EditableText
                  value={
                    courseData.sectionHeadlineDescription ?? "Description"
                  }
                  onChange={(v) =>
                    callbacks.onEditSectionLabels?.({
                      sectionHeadlineDescription: v,
                    })
                  }
                  as="span"
                  className="inline"
                  placeholder="Section heading..."
                />
              </h2>
              <EditableText
                value={courseData.description || ""}
                onChange={(description) =>
                  callbacks.onEditDescription?.(description)
                }
                as="div"
                className="whitespace-pre-wrap text-base leading-relaxed"
                style={{
                  color: "hsl(var(--foreground) / 0.75)",
                }}
                placeholder="Add a detailed course description..."
                multiline
              />
            </CourseSectionWrapper>

            {/* FAQ */}
            <CourseSectionWrapper
              sectionKey="faq"
              style={{ backgroundColor: "transparent", border: "none" }}
            >
              <div className="mb-8 flex items-center justify-between">
                <h2
                  className="text-3xl font-black uppercase tracking-tighter"
                  style={{
                    color: "hsl(var(--foreground))",
                    fontFamily: "var(--font-display, serif)",
                  }}
                >
                  <HelpCircle
                    className="mr-2 inline-block h-6 w-6"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                  <EditableText
                    value={courseData.sectionHeadlineFaq ?? "FAQ"}
                    onChange={(v) =>
                      callbacks.onEditSectionLabels?.({
                        sectionHeadlineFaq: v,
                      })
                    }
                    as="span"
                    className="inline"
                    placeholder="Section heading..."
                  />
                </h2>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    <AIButton
                      sectionKey="faqs"
                      onGenerateWithAI={callbacks.onGenerateWithAI}
                    />
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                      style={brutalBorder}
                      onClick={() => setActiveModal("faq")}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {!courseData.faqs || courseData.faqs.length === 0 ? (
                <div
                  className="p-8 text-center"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <HelpCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="font-bold uppercase">No FAQs added yet</p>
                  {isEditMode && (
                    <button
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                      style={brutalBorder}
                      onClick={() => setActiveModal("faq")}
                    >
                      Add FAQs
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {courseData.faqs.map((faq, index) => {
                    const isOpen =
                      expandedFAQs.has(faq.id) ||
                      (expandedFAQs.size === 0 && index === 0);
                    return (
                      <div key={faq.id} style={brutalCard}>
                        <button
                          type="button"
                          onClick={() => toggleFAQ(faq.id)}
                          className="flex w-full items-center justify-between p-4 text-left sm:p-6"
                        >
                          <h4
                            className="pr-4 text-lg font-bold"
                            style={{
                              color: "hsl(var(--foreground))",
                            }}
                          >
                            {faq.question}
                          </h4>
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 shrink-0 transition-transform duration-200",
                              !isOpen && "-rotate-90",
                            )}
                          />
                        </button>
                        {isOpen && (
                          <div
                            className="border-t-[3px] px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4"
                            style={{
                              borderColor: "hsl(var(--foreground))",
                            }}
                          >
                            <p
                              className="text-base leading-relaxed"
                              style={{
                                color:
                                  "hsl(var(--muted-foreground))",
                              }}
                            >
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

            {/* RATINGS */}
            <CourseRatingsSection />

            {/* RECOMMENDATIONS */}
            {(courseData.recommendations?.length ?? 0) > 0 ||
            (isEditMode && callbacks.onEditRecommendations) ? (
              <CourseSectionWrapper
                sectionKey="recommendations"
                style={{ backgroundColor: "transparent", border: "none" }}
              >
                <div className="mb-8 flex items-center justify-between">
                  <h2
                    className="text-3xl font-black uppercase tracking-tighter"
                    style={{
                      color: "hsl(var(--foreground))",
                      fontFamily: "var(--font-display, serif)",
                    }}
                  >
                    <BookMarked
                      className="mr-2 inline-block h-6 w-6"
                      style={{ color: "hsl(var(--primary))" }}
                    />
                    <EditableText
                      value={
                        courseData.sectionHeadlineRecommendations ??
                        "You May Also Like"
                      }
                      onChange={(v) =>
                        callbacks.onEditSectionLabels?.({
                          sectionHeadlineRecommendations: v,
                        })
                      }
                      as="span"
                      className="inline"
                      placeholder="Section heading..."
                    />
                  </h2>
                  {isEditMode && callbacks.onEditRecommendations && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                      style={brutalBorder}
                      onClick={() => callbacks.onEditRecommendations?.()}
                    >
                      <Pencil className="h-4 w-4" />
                      {courseData.recommendations?.length ? "Edit" : "Add"}
                    </button>
                  )}
                </div>
                {(courseData.recommendations?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {courseData.recommendations!.map((rec) => (
                      <a
                        key={rec.id}
                        href={`/courses/${rec.slug}`}
                        className="block overflow-hidden transition-all hover:translate-y-[-8px]"
                        style={brutalCard}
                      >
                        <div
                          className="aspect-video overflow-hidden"
                          style={{
                            backgroundColor: "hsl(var(--muted))",
                          }}
                        >
                          {rec.thumbnailUrl ? (
                            <img
                              src={rec.thumbnailUrl}
                              alt={rec.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <BookOpen
                                className="h-12 w-12 opacity-50"
                                style={{
                                  color:
                                    "hsl(var(--muted-foreground))",
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <p
                            className="line-clamp-2 text-sm font-bold uppercase"
                            style={{
                              color: "hsl(var(--foreground))",
                            }}
                          >
                            {rec.title}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div
                    className="p-8 text-center"
                    style={{
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    <BookMarked className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p className="font-bold uppercase">
                      No course recommendations yet
                    </p>
                    {isEditMode && callbacks.onEditRecommendations && (
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                        style={brutalBorder}
                        onClick={() =>
                          callbacks.onEditRecommendations?.()
                        }
                      >
                        Add Recommendations
                      </button>
                    )}
                  </div>
                )}
              </CourseSectionWrapper>
            ) : null}
          </div>

          {/* ---- RIGHT COLUMN: Sticky Pricing Card ---- */}
          <div className="lg:w-[400px]">
            <div className="sticky top-24 overflow-hidden" style={brutalCard}>
              {/* Thumbnail in card */}
              <div
                className="relative border-b-[3px]"
                style={{ borderColor: "hsl(var(--foreground))" }}
              >
                <EditableThumbnail
                  src={courseData.webThumbnailUrl || ""}
                  fallbackSrc={courseData.mobileThumbnailUrl || ""}
                  alt={courseData.title || "Course thumbnail"}
                  aspectRatio="video"
                  placeholder="Click to add thumbnail"
                  showVideoIcon
                />
                {courseData.previewUrl && !isEditMode && (
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
                    aria-label="Play course preview video"
                  >
                    <div
                      className="flex h-14 w-14 items-center justify-center"
                      style={{
                        ...accentBg,
                        border: "3px solid hsl(var(--foreground))",
                      }}
                    >
                      <Play className="h-7 w-7 ml-0.5" />
                    </div>
                  </button>
                )}
              </div>

              {/* Price Section */}
              <div className="p-6">
                {isEditMode && (
                  <button
                    className="mb-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
                    style={brutalBorder}
                    onClick={() => setActiveModal("pricing")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Pricing
                  </button>
                )}

                {callbacks.hasAccess && !isEditMode ? (
                  <div className="text-center">
                    <div
                      className="flex items-center justify-center gap-2 text-xl font-black uppercase"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      <CheckCircle2 className="h-7 w-7" />
                      You have access
                    </div>
                    <p
                      className="mt-2 text-sm font-medium"
                      style={{
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      Continue where you left off
                    </p>
                  </div>
                ) : accessManagedActive ? null : courseData.purchaseMode === "FREE" ? (
                  <div className="text-center">
                    <div
                      className="text-5xl font-black uppercase"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      FREE
                    </div>
                    <p
                      className="mt-2 text-sm font-medium"
                      style={{
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      Enroll now and start learning
                    </p>
                  </div>
                ) : priceUnavailable ? (
                  <div className="text-center">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    >
                      Not available for purchase
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-4xl font-black"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        {primarySymbol}
                        {formatNumber(finalPrice, priceLocale)}
                      </span>
                      {primaryDiscount > 0 && (
                        <>
                          <span
                            className="text-lg line-through"
                            style={{
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            {primarySymbol}
                            {formatNumber(primaryPrice, priceLocale)}
                          </span>
                          <span
                            className="px-3 py-1 text-sm font-black uppercase"
                            style={{
                              ...accentBg,
                              ...brutalBorder,
                            }}
                          >
                            {savingLabel}
                          </span>
                        </>
                      )}
                    </div>
                    {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                      <p
                        className="mt-2 text-sm font-bold uppercase"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {/* CTA Buttons */}
                {callbacks.hasAccess && !isEditMode ? (
                  <button
                    className="mt-6 w-full py-4 text-lg font-black uppercase tracking-wider transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    style={{
                      ...accentBg,
                      ...brutalBorder,
                      boxShadow:
                        "4px 4px 0px 0px hsl(var(--foreground))",
                    }}
                    onClick={callbacks.onContinueLearning}
                  >
                    Continue Learning
                  </button>
                ) : accessManagedActive ? (
                  <AccessManagedCta
                    hasAccess={false}
                    supportEmail={supportEmail}
                    contactSubject={courseData.title}
                    fullWidth
                    className="mt-6"
                  />
                ) : priceUnavailable && !isEditMode ? null : (
                  <>
                    <button
                      className="mt-6 w-full py-4 text-lg font-black uppercase tracking-wider transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] disabled:opacity-70 disabled:cursor-not-allowed"
                      style={{
                        ...accentBg,
                        ...brutalBorder,
                        boxShadow:
                          "4px 4px 0px 0px hsl(var(--foreground))",
                      }}
                      onClick={!isEditMode ? callbacks.onBuyNow : undefined}
                      disabled={callbacks.isEnrollingFree || callbacks.isPurchaseDisabled}
                    >
                      {callbacks.isEnrollingFree ? (
                        <>
                          <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
                          Enrolling...
                        </>
                      ) : (
                        <>
                          {courseData.purchaseMode === "FREE" ? (
                            "Enroll Now - Free"
                          ) : (
                            <>
                              <ShoppingCart className="mr-2 inline-block h-5 w-5" />
                              Buy Now
                            </>
                          )}
                        </>
                      )}
                    </button>

                    {courseData.purchaseMode === "PAID" && (
                      <button
                        className="mt-3 w-full py-4 text-lg font-bold uppercase tracking-wider transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{
                          ...brutalBorder,
                          backgroundColor: "hsl(var(--background))",
                          color: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
                          boxShadow:
                            "4px 4px 0px 0px hsl(var(--foreground))",
                        }}
                        onClick={
                          !isEditMode ? (callbacks.isInCart ? callbacks.onRemoveFromCart : callbacks.onAddToCart) : undefined
                        }
                        disabled={callbacks.isPurchaseDisabled}
                      >
                        {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                      </button>
                    )}
                  </>
                )}

                {!isEditMode && callbacks.onShare && (
                  <button
                    className="mt-3 w-full flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wider transition-colors"
                    style={{
                      ...brutalBorder,
                      backgroundColor: "hsl(var(--background))",
                      color: "hsl(var(--foreground))",
                    }}
                    onClick={callbacks.onShare}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                )}
              </div>

              {/* Coupon */}
              {courseData.purchaseMode === "PAID" &&
                !priceUnavailable &&
                !accessManagedActive &&
                !(callbacks.hasAccess && !isEditMode) && (
                  <div
                    className="border-t-[3px] p-4"
                    style={{
                      borderColor: "hsl(var(--foreground))",
                    }}
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        className="flex-1 px-3 py-2 text-sm font-bold uppercase"
                        style={{
                          ...brutalBorder,
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <button
                        className="px-4 py-2 text-sm font-bold uppercase"
                        style={{
                          ...brutalBorder,
                          backgroundColor: "hsl(var(--muted))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}

              {/* Guarantee */}
              {!(callbacks.hasAccess && !isEditMode) && !accessManagedActive && (
                <div
                  className="border-t-[3px] p-4 text-center"
                  style={{
                    borderColor: "hsl(var(--foreground))",
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Gift
                      className="h-4 w-4"
                      style={{ color: "hsl(var(--primary))" }}
                    />
                    <EditableText
                      value={
                        courseData.pricingGuaranteeText ??
                        "Get Instant Access"
                      }
                      onChange={(v) =>
                        callbacks.onEditSectionLabels?.({
                          pricingGuaranteeText: v,
                        })
                      }
                      as="span"
                      className="text-sm font-bold uppercase tracking-wider"
                      style={{
                        color: "hsl(var(--muted-foreground))",
                      }}
                      placeholder="Guarantee text..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  CTA SECTION                                                  */}
      {/* ============================================================ */}
      <section
        className="border-t-[3px] py-16 sm:py-24"
        style={{
          borderColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--muted))",
        }}
      >
        <div className="mx-auto max-w-[1440px] px-4 text-center sm:px-6 lg:px-8">
          <h2
            className="text-5xl font-black uppercase tracking-tighter sm:text-6xl lg:text-7xl"
            style={{
              color: "hsl(var(--foreground))",
              fontFamily: "var(--font-display, serif)",
            }}
          >
            Start Your
            <br />
            Journey Today
          </h2>
          <p
            className="mx-auto mt-6 max-w-3xl text-xl font-medium"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Join and transform your passion into a profession
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {callbacks.hasAccess && !isEditMode ? (
              <button
                className="px-10 py-5 text-xl font-black uppercase tracking-wider transition-all hover:translate-x-[-4px] hover:translate-y-[-4px]"
                style={{
                  ...accentBg,
                  ...brutalBorder,
                  ...brutalShadow,
                }}
                onClick={callbacks.onContinueLearning}
              >
                Continue Learning <ArrowRight className="ml-2 inline-block h-5 w-5" />
              </button>
            ) : accessManagedActive ? (
              <AccessManagedCta
                hasAccess={false}
                supportEmail={supportEmail}
                contactSubject={courseData.title}
                size="lg"
              />
            ) : (
              <>
                <button
                  className="px-10 py-5 text-xl font-black uppercase tracking-wider transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    ...accentBg,
                    ...brutalBorder,
                    ...brutalShadow,
                  }}
                  onClick={!isEditMode ? callbacks.onBuyNow : undefined}
                  disabled={callbacks.isEnrollingFree || callbacks.isPurchaseDisabled}
                >
                  {callbacks.isEnrollingFree
                    ? "Enrolling..."
                    : courseData.purchaseMode === "FREE"
                      ? "Enroll Now"
                      : "Enroll Now"}{" "}
                  <ArrowRight className="ml-2 inline-block h-5 w-5" />
                </button>
                {courseData.purchaseMode === "PAID" && (
                  <button
                    className="px-10 py-5 text-xl font-bold uppercase tracking-wider transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      ...brutalBorder,
                      ...brutalShadow,
                      backgroundColor: "hsl(var(--background))",
                      color: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
                    }}
                    onClick={!isEditMode ? (callbacks.isInCart ? callbacks.onRemoveFromCart : callbacks.onAddToCart) : undefined}
                    disabled={callbacks.isPurchaseDisabled}
                  >
                    {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                  </button>
                )}
              </>
            )}
          </div>
          {!accessManagedActive && (
            <p
              className="mt-8 text-sm font-bold uppercase tracking-wider"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <Gift className="mr-2 inline-block h-4 w-4" />
              30-Day Money-Back Guarantee &bull; No Risk
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
