"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@open-mtlms/core";
import { Code2, Edit, Eye, EyeOff, LayoutTemplate, Loader2, Plus, Settings, Trash2 } from "lucide-react";
import Link from "next/link";

import { canUseCustomCode, type PageCategory } from "@/lib/data/page-categories";

export interface PageData {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  updatedAt: string;
  renderMode?: "SECTIONS" | "CUSTOM_CODE";
}

interface PageCategoryCardProps {
  category: PageCategory;
  page?: PageData;
  onCreateClick: (category: PageCategory) => void;
  onChooseTemplateClick?: (category: PageCategory) => void;
  /** For home card: opens All Templates modal */
  onAllTemplatesClick?: () => void;
  onDeleteClick: (pageId: string) => void;
  onTogglePublish: (pageId: string, currentStatus: boolean) => void;
  isTogglingPublish?: boolean;
  /** Disable Create button and show spinner (e.g. when creating all blog pages) */
  isCreateLoading?: boolean;
}

/** System pages (login, profile) only get publish/unpublish + delete + optional settings link */
const SYSTEM_PAGE_IDS = new Set(["login", "profile"]);

export function PageCategoryCard({
  category,
  page,
  onCreateClick,
  onChooseTemplateClick,
  onAllTemplatesClick,
  onDeleteClick,
  onTogglePublish,
  isTogglingPublish,
  isCreateLoading = false,
}: PageCategoryCardProps) {
  const Icon = category.icon;
  const hasPage = !!page;
  const isSystemPage = SYSTEM_PAGE_IDS.has(category.id);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card
      className={`group relative overflow-hidden transition-all ${
        hasPage
          ? "border-border"
          : "border-muted-foreground/30 hover:border-primary/50 border-dashed"
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                hasPage ? "bg-primary/10" : "bg-muted"
              }`}
            >
              <Icon className={`h-5 w-5 ${hasPage ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="text-base">{category.name}</CardTitle>
              <CardDescription className="font-mono text-xs">{category.route}</CardDescription>
            </div>
          </div>
          {hasPage && (
            <div className="flex flex-col items-end gap-1">
              <Badge variant={page.isPublished ? "default" : "secondary"}>
                {page.isPublished ? "Published" : "Draft"}
              </Badge>
              {page.renderMode === "CUSTOM_CODE" && (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
                  title="This page is served as custom code, not the template"
                >
                  <Code2 className="h-3 w-3" /> Custom code
                </Badge>
              )}
            </div>
          )}
          {!hasPage && (
            <Badge variant="outline" className="text-muted-foreground">
              Not Created
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 line-clamp-2 text-xs">{category.description}</p>

        {/* Not Created State */}
        {!hasPage && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isCreateLoading}
            onClick={() => (category.id === "home" && onAllTemplatesClick ? onAllTemplatesClick() : onCreateClick(category))}
          >
            {isCreateLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Page
          </Button>
        )}

        {/* Has Page State */}
        {hasPage && (
          <div className="space-y-3">
            <div className="text-muted-foreground text-xs">
              Updated {formatDate(page.updatedAt)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Publish/Unpublish Button */}
              {!page.isPublished ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={isTogglingPublish}
                  onClick={() => onTogglePublish(page.id, page.isPublished)}
                >
                  {isTogglingPublish ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Publish
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={isTogglingPublish}
                  onClick={() => onTogglePublish(page.id, page.isPublished)}
                >
                  {isTogglingPublish ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  Unpublish
                </Button>
              )}

              {/* Edit button, first icon, like every other page card. Hidden for
                  system pages, except Login whose left brand-panel text is editable. */}
              {(category.id === "login" || (!isSystemPage && !category.settingsHref)) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/dashboard/pages/${page.id}/editor`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Edit</TooltipContent>
                </Tooltip>
              )}

              {/* Custom code, turn this page into a full custom HTML/CSS/JS
                  page. Offered only for the fixed content pages (home, about,
                  contact, faq, privacy, terms), not blog or system pages. */}
              {!isSystemPage &&
                !category.settingsHref &&
                canUseCustomCode(category.slug) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/dashboard/pages/${page.id}/custom-code`}>
                        <Code2 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Custom code (HTML/CSS/JS)</TooltipContent>
                </Tooltip>
              )}

              {/* Settings link, only for pages with settingsHref (e.g. login) */}
              {category.settingsHref && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={category.settingsHref}>
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Settings</TooltipContent>
                </Tooltip>
              )}

              {/* All Templates (home only) or Choose Template, hidden for system pages */}
              {!isSystemPage && !category.settingsHref && (
                category.id === "home" && onAllTemplatesClick ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onAllTemplatesClick}
                      >
                        <LayoutTemplate className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">All Templates</TooltipContent>
                  </Tooltip>
                ) : (
                  onChooseTemplateClick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onChooseTemplateClick(category)}
                      title="Choose Template"
                    >
                      <LayoutTemplate className="h-4 w-4" />
                    </Button>
                  )
                )
              )}

              {/* Delete Button */}
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8"
                onClick={() => onDeleteClick(page.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
