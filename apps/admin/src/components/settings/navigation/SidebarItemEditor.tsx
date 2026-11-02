"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "@open-mtlms/core";
import type { SidebarBadgeVariant, SidebarNavItem } from "@open-mtlms/shared";
import { useState } from "react";

import { IconPicker, NavIcon } from "./IconPicker";

interface SidebarItemEditorProps {
  item: SidebarNavItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: SidebarNavItem) => void;
}

export function SidebarItemEditor({
  item,
  open,
  onOpenChange,
  onSave,
}: SidebarItemEditorProps) {
  const [label, setLabel] = useState(item.label);
  const [icon, setIcon] = useState(item.icon ?? "");
  const [href, setHref] = useState(item.href);
  const [isExternal, setIsExternal] = useState(item.isExternal ?? false);
  const [badgeText, setBadgeText] = useState(item.badge?.text ?? "");
  const [badgeVariant, setBadgeVariant] = useState<SidebarBadgeVariant>(item.badge?.variant ?? "new");
  const [showIconPicker, setShowIconPicker] = useState(false);

  const isLinkLocked = item.itemType === "system" || item.itemType === "entitlement";
  const isCustom = item.itemType === "custom";

  const handleSave = () => {
    const updated: SidebarNavItem = {
      ...item,
      label,
      icon: icon || undefined,
      href: isLinkLocked ? item.href : href,
      isExternal: isCustom ? isExternal : item.isExternal,
      badge: badgeText
        ? { text: badgeText, variant: badgeVariant }
        : undefined,
    };
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Navigation Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Item title"
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-full justify-start gap-2"
            >
              {icon ? (
                <>
                  <NavIcon name={icon} className="h-4 w-4 shrink-0" />
                  <span className="capitalize">{icon.replace(/-/g, " ")}</span>
                </>
              ) : (
                "Choose icon..."
              )}
            </Button>
            {showIconPicker && (
              <div className="rounded-md border p-2">
                <IconPicker value={icon} onChange={(name) => { setIcon(name); setShowIconPicker(false); }} />
              </div>
            )}
          </div>

          {/* Link */}
          <div className="space-y-2">
            <Label>Link</Label>
            <Input
              value={isLinkLocked ? item.href : href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/path or https://..."
              disabled={isLinkLocked}
            />
            {isLinkLocked && (
              <p className="text-muted-foreground text-xs">
                Links for system items cannot be changed.
              </p>
            )}
          </div>

          {/* External link toggle (custom only) */}
          {isCustom && (
            <div className="flex items-center justify-between">
              <Label>Open in new tab</Label>
              <Switch checked={isExternal} onCheckedChange={setIsExternal} />
            </div>
          )}

          {/* Badge */}
          <div className="space-y-2">
            <Label>Badge (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="Badge text"
                className="flex-1"
              />
              <select
                value={badgeVariant}
                onChange={(e) => setBadgeVariant(e.target.value as SidebarBadgeVariant)}
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              >
                <option value="new">New</option>
                <option value="free">Free</option>
                <option value="popular">Popular</option>
                <option value="beta">Beta</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
