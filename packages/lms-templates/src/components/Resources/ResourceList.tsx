"use client";

import React, { useState } from "react";
import { FolderOpen, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { LMSResource, ResourceType } from "../../types";
import { ResourceItem } from "./ResourceItem";
import { cn } from "../../lib/utils";

interface ResourceListProps {
  /** List of resources */
  resources: LMSResource[];
  /** Section resources (shown separately) */
  sectionResources?: LMSResource[];
  /** Title for the section */
  title?: string;
  /** Called when resource is viewed */
  onView?: (resource: LMSResource) => void;
  /** Called when resource is downloaded */
  onDownload?: (resource: LMSResource) => void;
  /** Display variant */
  variant?: "default" | "compact" | "card";
  /** Show search filter */
  showSearch?: boolean;
  /** Show type filter */
  showTypeFilter?: boolean;
  /** Group by type */
  groupByType?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Additional class name */
  className?: string;
}

// Keyed by string (not ResourceType) so the runtime-only "image" type.
// not yet part of the shared ResourceType union, gets a label too.
const RESOURCE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDFs",
  link: "Links",
  article: "Articles",
  text: "Text",
  github: "GitHub",
  image: "Images",
};

export function ResourceList({
  resources,
  sectionResources,
  title = "Resources",
  onView,
  onDownload,
  variant = "default",
  showSearch = false,
  showTypeFilter = false,
  groupByType = false,
  defaultCollapsed = false,
  className,
}: ResourceListProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ResourceType | "all">("all");

  // Combine and sort resources
  const allResources = [
    ...(sectionResources || []).map((r) => ({ ...r, isSection: true })),
    ...resources.map((r) => ({ ...r, isSection: false })),
  ].sort((a, b) => a.order - b.order);

  // Filter resources
  const filteredResources = allResources.filter((resource) => {
    const matchesSearch =
      !searchQuery ||
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || resource.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Group by type if needed
  const groupedResources = groupByType
    ? filteredResources.reduce(
        (acc, resource) => {
          if (!acc[resource.type]) {
            acc[resource.type] = [];
          }
          acc[resource.type].push(resource);
          return acc;
        },
        {} as Record<string, typeof filteredResources>
      )
    : null;

  // Get available types for filter
  const availableTypes = Array.from(new Set(allResources.map((r) => r.type)));

  if (allResources.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground mt-2">
          No resources available for this lesson
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-left hover:text-primary transition-colors"
        >
          <h3 className="font-semibold">{title}</h3>
          <span className="text-sm text-muted-foreground">
            ({filteredResources.length})
          </span>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Filters */}
      {!isCollapsed && (showSearch || showTypeFilter) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}
          {showTypeFilter && availableTypes.length > 1 && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ResourceType | "all")}
              className="px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {RESOURCE_TYPE_LABELS[type as ResourceType]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Resource List */}
      {!isCollapsed && (
        <div>
          {groupByType && groupedResources ? (
            <div className="space-y-6">
              {Object.entries(groupedResources).map(([type, typeResources]) => (
                <div key={type}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {RESOURCE_TYPE_LABELS[type as ResourceType]}
                </h4>
                  <div
                    className={cn(
                      variant === "card"
                        ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
                        : "divide-y divide-border/40"
                    )}
                  >
                    {typeResources.map((resource) => (
                      <ResourceItem
                        key={resource.id}
                        resource={resource}
                        variant={variant}
                        onView={onView}
                        onDownload={onDownload}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                variant === "card"
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
                  : "divide-y divide-border/40"
              )}
            >
              {/* Section Resources (if any) */}
              {sectionResources && sectionResources.length > 0 && (
                <>
                  <div className="col-span-full">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Section Resources
                    </p>
                  </div>
                  {filteredResources
                    .filter((r) => (r as any).isSection)
                    .map((resource) => (
                      <ResourceItem
                        key={resource.id}
                        resource={resource}
                        variant={variant}
                        onView={onView}
                        onDownload={onDownload}
                      />
                    ))}
                  {resources.length > 0 && (
                    <div className="col-span-full">
                      <p className="text-xs font-medium text-muted-foreground mb-1 mt-3">
                        Lesson Resources
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Lesson Resources */}
              {filteredResources
                .filter((r) => !(r as any).isSection)
                .map((resource) => (
                  <ResourceItem
                    key={resource.id}
                    resource={resource}
                    variant={variant}
                    onView={onView}
                    onDownload={onDownload}
                  />
                ))}
            </div>
          )}

          {filteredResources.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No resources match your search
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ResourceList;
