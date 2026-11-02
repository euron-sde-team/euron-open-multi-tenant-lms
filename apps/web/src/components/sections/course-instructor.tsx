"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { CourseInstructorContent, SectionConfig } from "@open-mtlms/shared";
import { GraduationCap } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { SafeLink, SocialIcon } from "@open-mtlms/core";

import { Button } from "@/components/ui/button";
import { cn, decodeHtmlEntities } from "@/lib/utils";

interface CourseInstructorSectionProps {
  section: SectionConfig;
}

// Default content for instructor when not provided
const defaultContent: CourseInstructorContent = {
  headline: "Meet Your Instructor",
  instructors: [],
};

const BIO_SLICE_LENGTH = 300;

export function CourseInstructorSection({ section }: CourseInstructorSectionProps) {
  const rawContent = section.content as CourseInstructorContent | undefined;
  const content: CourseInstructorContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;

  const instructors = content.instructors || [];
  const hasCustomBg = hasCustomSectionBackground(section);
  const headline = instructors.length > 1 ? "Meet Your Instructors" : "Meet Your Instructor";

  const [expandedBios, setExpandedBios] = useState<Record<string, boolean>>({});

  const toggleBio = (id: string) => {
    setExpandedBios((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section
      className={cn(
        "section-padding",
        hasCustomBg ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            {headline}
          </h2>
        </div>

        {/* Instructor Cards */}
        <div className="space-y-6">
          {instructors.map((instructor) => {
            const bioText = decodeHtmlEntities(instructor.bio) || "";
            const isLongBio = bioText.length > BIO_SLICE_LENGTH;
            const isExpanded = expandedBios[instructor.id];
            const displayBio = isLongBio && !isExpanded
              ? bioText.slice(0, BIO_SLICE_LENGTH) + "..."
              : bioText;

            return (
              <div
                key={instructor.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                {/* Subtle hover overlay */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  {/* Avatar with badge */}
                  <div className="relative shrink-0">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl shadow-inner sm:h-32 sm:w-32">
                      {instructor.avatar ? (
                        <Image
                          src={instructor.avatar}
                          alt={`${instructor.name}'s profile`}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-3xl font-bold text-muted-foreground">
                          {instructor.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    {/* Graduation cap badge */}
                    <div className="absolute -bottom-2 -right-2 rounded-full bg-primary p-1.5 text-primary-foreground shadow-sm">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                    {/* Name & Role */}
                    <div>
                      <h3 className="text-xl font-bold text-foreground sm:text-2xl">
                        {decodeHtmlEntities(instructor.name)}
                      </h3>
                      <p className="text-base font-medium text-foreground/60">
                        {decodeHtmlEntities(instructor.role)}
                      </p>
                    </div>

                    {/* Bio with expand/collapse */}
                    {bioText && (
                      <div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {displayBio}
                        </p>
                        {isLongBio && (
                          <button
                            onClick={() => toggleBio(instructor.id)}
                            className="mt-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Social Links */}
                    {instructor.socialLinks && instructor.socialLinks.length > 0 && (
                      <div className="flex justify-center gap-2 sm:justify-start">
                        {instructor.socialLinks.map((social) => {
                          return (
                            <Button
                              key={social.platform}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                              asChild
                            >
                              <SafeLink href={social.url} openInNewTab>
                                <SocialIcon platform={social.platform} className="h-4 w-4" />
                              </SafeLink>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
