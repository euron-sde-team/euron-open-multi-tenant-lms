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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@open-mtlms/core";
import type { AvailableRoutesResponse } from "@open-mtlms/shared";
import { useMemo, useState } from "react";

import { IconPicker, NavIcon } from "./IconPicker";

function isExternalUrl(url: string): boolean {
  const t = url.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

interface AddCustomLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { label: string; href: string; icon?: string; isExternal?: boolean }) => void;
  availableRoutes?: AvailableRoutesResponse | null;
}

export function AddCustomLinkDialog({
  open,
  onOpenChange,
  onAdd,
  availableRoutes,
}: AddCustomLinkDialogProps) {
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [icon, setIcon] = useState("link");
  const [isExternal, setIsExternal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const availablePaths = useMemo(() => {
    if (!availableRoutes) return [];
    const seen = new Set<string>();
    const paths: { path: string; label: string }[] = [];
    for (const r of [...(availableRoutes.system ?? []), ...(availableRoutes.internal ?? [])]) {
      if (!seen.has(r.path)) {
        seen.add(r.path);
        paths.push({ path: r.path, label: r.label });
      }
    }
    return paths.sort((a, b) => a.path.localeCompare(b.path));
  }, [availableRoutes]);

  const reset = () => {
    setLabel("");
    setHref("");
    setIcon("link");
    setIsExternal(false);
    setShowIconPicker(false);
  };

  const handleAdd = () => {
    onAdd({
      label: label.trim(),
      href: href.trim(),
      icon: icon || undefined,
      isExternal: isExternal || undefined,
    });
    reset();
    onOpenChange(false);
  };

  const isValidExternal = (): boolean => {
    const u = href.trim();
    return u.length > 0 && isExternalUrl(u);
  };

  const isValidInternal = (): boolean => {
    const p = href.trim();
    if (p.length === 0) return false;
    return availablePaths.some((r) => r.path === p);
  };

  const isValid =
    label.trim().length > 0 &&
    (isExternal ? isValidExternal() : isValidInternal());

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Link</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Link"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>External URL</Label>
            <Switch
              checked={isExternal}
              onCheckedChange={(v) => {
                setIsExternal(v);
                setHref("");
              }}
            />
          </div>

          {isExternal ? (
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={href}
                onChange={(e) => setHref(e.target.value)}
                placeholder="https://example.com"
              />
              {href.trim().length > 0 && !isExternalUrl(href) && (
                <p className="text-destructive text-xs">
                  External URLs must start with http:// or https://
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Internal Page</Label>
              <Select
                value={href || ""}
                onValueChange={(v) => {
                  setHref(v);
                  const r = availablePaths.find((p) => p.path === v);
                  if (r && !label.trim()) setLabel(r.label);
                }}
                disabled={availablePaths.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an available page..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePaths.map((r) => (
                    <SelectItem key={r.path} value={r.path}>
                      {r.label} ({r.path})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availablePaths.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  No internal pages available. Enable features or add pages first.
                </p>
              )}
            </div>
          )}

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
                <IconPicker
                  value={icon}
                  onChange={(name) => {
                    setIcon(name);
                    setShowIconPicker(false);
                  }}
                />
              </div>
            )}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!isValid}>
            Add Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
