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
} from "@open-mtlms/core";
import { Globe } from "lucide-react";
import { useState, useEffect } from "react";

import { useCourseStore } from "@/lib/stores/course-store";

interface LanguageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LanguageModal({ open, onOpenChange }: LanguageModalProps) {
  const { courseData, updateSettings } = useCourseStore();
  const languages = courseData.languages ?? (courseData.language ? [courseData.language] : ["English"]);
  const [value, setValue] = useState(languages.join(", "));

  useEffect(() => {
    if (open) {
      const next = courseData.languages ?? (courseData.language ? [courseData.language] : ["English"]);
      setValue(Array.isArray(next) ? next.join(", ") : String(next));
    }
  }, [open, courseData.languages, courseData.language]);

  const handleSave = () => {
    const parsed = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = parsed.length > 0 ? parsed : ["English"];
    updateSettings({ languages: next });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Course Languages
          </DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Enter one or more languages, separated by commas. These will be shown on the course page.
        </p>
        <div className="space-y-2">
          <Label htmlFor="languages-input">Languages</Label>
          <Input
            id="languages-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. English, Hindi, Spanish"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
