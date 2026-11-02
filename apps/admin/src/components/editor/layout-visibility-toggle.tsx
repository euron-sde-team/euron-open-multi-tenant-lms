"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Label,
  Switch,
} from "@open-mtlms/core";
import { Bell, Eye, EyeOff, Layout, PanelBottom, PanelLeft, PanelTop } from "lucide-react";
import React from "react";

import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface LayoutVisibilityToggleProps {
  className?: string;
}

/**
 * LayoutVisibilityToggle - Shows on non-home pages
 * Allows users to hide/show layout elements for the current page only
 */
export function LayoutVisibilityToggle({ className }: LayoutVisibilityToggleProps) {
  const { tenantLayout, pageConfig, toggleLayoutElementVisibility } = useEditorStore();

  // If no layout is configured, don't show the toggle
  if (!tenantLayout) return null;

  const overrides = pageConfig.layoutOverrides || {};

  // Count how many elements are hidden
  const hiddenCount = [
    overrides.hideHeader,
    overrides.hideFooter,
    overrides.hideSidebar,
    overrides.hideTopBar,
  ].filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Layout className="h-4 w-4" />
          <span>Layout</span>
          {hiddenCount > 0 && (
            <span className="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-xs">
              {hiddenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Layout Visibility</h4>
            <p className="text-muted-foreground text-xs">
              Hide or show layout elements on this page only.
            </p>
          </div>

          <div className="space-y-3">
            {/* Header Toggle */}
            {tenantLayout.header.enabled && (
              <LayoutElementToggle
                icon={PanelTop}
                label="Header"
                isHidden={overrides.hideHeader ?? false}
                onToggle={() => toggleLayoutElementVisibility("hideHeader")}
              />
            )}

            {/* Top Bar Toggle */}
            {tenantLayout.topBar.enabled && (
              <LayoutElementToggle
                icon={Bell}
                label="Top Bar"
                isHidden={overrides.hideTopBar ?? false}
                onToggle={() => toggleLayoutElementVisibility("hideTopBar")}
              />
            )}

            {/* Sidebar Toggle */}
            {tenantLayout.sidebar.enabled && (
              <LayoutElementToggle
                icon={PanelLeft}
                label="Sidebar"
                isHidden={overrides.hideSidebar ?? false}
                onToggle={() => toggleLayoutElementVisibility("hideSidebar")}
              />
            )}

            {/* Footer Toggle */}
            {tenantLayout.footer.enabled && (
              <LayoutElementToggle
                icon={PanelBottom}
                label="Footer"
                isHidden={overrides.hideFooter ?? false}
                onToggle={() => toggleLayoutElementVisibility("hideFooter")}
              />
            )}
          </div>

          <div className="border-t pt-3">
            <p className="text-muted-foreground text-xs">
              <strong>Note:</strong> To edit the layout content, go to the Home page.
            </p>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface LayoutElementToggleProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isHidden: boolean;
  onToggle: () => void;
}

function LayoutElementToggle({ icon: Icon, label, isHidden, onToggle }: LayoutElementToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isHidden && "text-muted-foreground")} />
        <Label
          className={cn("text-sm font-normal", isHidden && "text-muted-foreground line-through")}
        >
          {label}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        {isHidden ? (
          <EyeOff className="text-muted-foreground h-3 w-3" />
        ) : (
          <Eye className="text-muted-foreground h-3 w-3" />
        )}
        <Switch
          checked={!isHidden}
          onCheckedChange={onToggle}
          aria-label={`${isHidden ? "Show" : "Hide"} ${label}`}
        />
      </div>
    </div>
  );
}

/**
 * Compact version for toolbar
 */
export function LayoutVisibilityButton({ className }: { className?: string }) {
  const { tenantLayout, pageConfig, toggleLayoutElementVisibility } = useEditorStore();

  if (!tenantLayout) return null;

  const overrides = pageConfig.layoutOverrides || {};
  const hiddenCount = [
    overrides.hideHeader,
    overrides.hideFooter,
    overrides.hideSidebar,
    overrides.hideTopBar,
  ].filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          title="Layout visibility"
        >
          <Layout className="h-4 w-4" />
          {hiddenCount > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
              {hiddenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-4" align="end">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Page Layout</h4>

          {tenantLayout.header.enabled && (
            <LayoutElementToggle
              icon={PanelTop}
              label="Header"
              isHidden={overrides.hideHeader ?? false}
              onToggle={() => toggleLayoutElementVisibility("hideHeader")}
            />
          )}

          {tenantLayout.topBar.enabled && (
            <LayoutElementToggle
              icon={Bell}
              label="Top Bar"
              isHidden={overrides.hideTopBar ?? false}
              onToggle={() => toggleLayoutElementVisibility("hideTopBar")}
            />
          )}

          {tenantLayout.sidebar.enabled && (
            <LayoutElementToggle
              icon={PanelLeft}
              label="Sidebar"
              isHidden={overrides.hideSidebar ?? false}
              onToggle={() => toggleLayoutElementVisibility("hideSidebar")}
            />
          )}

          {tenantLayout.footer.enabled && (
            <LayoutElementToggle
              icon={PanelBottom}
              label="Footer"
              isHidden={overrides.hideFooter ?? false}
              onToggle={() => toggleLayoutElementVisibility("hideFooter")}
            />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
