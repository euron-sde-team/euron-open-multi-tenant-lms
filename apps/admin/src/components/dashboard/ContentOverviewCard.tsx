"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { BookOpen, GraduationCap, Package, FolderOpen, Users } from "lucide-react";

import type { ContentOverview } from "../../lib/types/dashboard";

interface ContentOverviewCardProps {
  content: ContentOverview;
}

interface ContentRow {
  icon: React.ElementType;
  label: string;
  published: number;
  draft: number;
  total: number;
}

export function ContentOverviewCard({ content }: ContentOverviewCardProps) {
  const rows: ContentRow[] = [
    {
      icon: GraduationCap,
      label: "Courses",
      published: content.published_courses,
      draft: content.draft_courses,
      total: content.total_courses,
    },
    {
      icon: BookOpen,
      label: "Books",
      published: content.published_books,
      draft: content.draft_books,
      total: content.total_books,
    },
    {
      icon: Package,
      label: "Bundles",
      published: content.published_bundles,
      draft: content.total_bundles - content.published_bundles,
      total: content.total_bundles,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Overview</CardTitle>
        <CardDescription>Your published and draft content</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-4 items-center justify-center">
                  <row.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.published} published · {row.draft} draft
                  </p>
                </div>
              </div>
              <span className="text-lg font-semibold">{row.total}</span>
            </div>
          ))}

          <div className="border-t pt-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {content.total_categories} Categories
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {content.total_instructors} Instructors
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
