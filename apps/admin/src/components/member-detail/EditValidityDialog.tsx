"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import { CalendarClock, Infinity as InfinityIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function toDateInputValue(value: Date | null): string {
  if (!value) return "";
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatHumanDate(value: Date | null): string {
  if (!value) return "Lifetime (no expiry)";
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

export interface EditValidityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  currentValidTill: string | null;
  isSaving: boolean;
  onSave: (validTill: string | null) => void;
}

/**
 * Validity editor used for course enrollments and book access. Returns an
 * ISO date string at midnight UTC, or null for lifetime (no expiry).
 */
export function EditValidityDialog({
  open,
  onOpenChange,
  title,
  description,
  currentValidTill,
  isSaving,
  onSave,
}: EditValidityDialogProps) {
  const initial = useMemo<Date | null>(
    () => (currentValidTill ? new Date(currentValidTill) : null),
    [currentValidTill],
  );

  const [lifetime, setLifetime] = useState<boolean>(initial === null);
  const [dateValue, setDateValue] = useState<string>(toDateInputValue(initial));

  useEffect(() => {
    if (open) {
      setLifetime(initial === null);
      setDateValue(toDateInputValue(initial));
    }
  }, [open, initial]);

  const applyPreset = (months: number) => {
    const base = new Date();
    setLifetime(false);
    setDateValue(toDateInputValue(addMonths(base, months)));
  };

  const applyLifetime = () => {
    setLifetime(true);
    setDateValue("");
  };

  const previewDate = lifetime || !dateValue ? null : new Date(dateValue);

  const handleSave = () => {
    if (lifetime) {
      onSave(null);
      return;
    }
    if (!dateValue) {
      return;
    }
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return;
    onSave(parsed.toISOString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            Current:{" "}
            <span className="font-medium text-foreground">
              {formatHumanDate(initial)}
            </span>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Quick presets
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(1)}
              >
                +1 month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(3)}
              >
                +3 months
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(6)}
              >
                +6 months
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(12)}
              >
                +1 year
              </Button>
              <Button
                type="button"
                variant={lifetime ? "default" : "outline"}
                size="sm"
                onClick={applyLifetime}
              >
                <InfinityIcon className="mr-1 h-3.5 w-3.5" />
                Lifetime
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="valid-till-date">Or pick a date</Label>
            <Input
              id="valid-till-date"
              type="date"
              value={dateValue}
              disabled={lifetime}
              onChange={(e) => {
                setLifetime(false);
                setDateValue(e.target.value);
              }}
              className="mt-1"
            />
          </div>

          <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Will be set to:{" "}
            <span className="font-medium text-foreground">
              {formatHumanDate(previewDate)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (!lifetime && !dateValue)}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save validity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
