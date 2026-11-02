"use client";

import { cn, Input, Label, Switch } from "@open-mtlms/core";
import type { LMSSettings } from "@open-mtlms/shared";

interface LMSSettingsPanelProps {
  settings: LMSSettings;
  onChange: (settings: LMSSettings) => void;
  className?: string;
}

export function LMSSettingsPanel({
  settings,
  onChange,
  className,
}: LMSSettingsPanelProps) {
  const handleToggle = (key: keyof LMSSettings) => {
    onChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  return (
    <div className={cn("space-y-6 p-4 border rounded-lg bg-card", className)}>
      <div>
        <h3 className="font-semibold">LMS Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure features for your course player
        </p>
      </div>

      <div className="space-y-4">
        {/* Progress Tracking */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enableProgress">Progress Tracking</Label>
            <p className="text-xs text-muted-foreground">
              Show the overall progress bar and per-lesson mark-complete controls
            </p>
          </div>
          <Switch
            id="enableProgress"
            checked={settings.enableProgress}
            onCheckedChange={() => handleToggle("enableProgress")}
          />
        </div>

        {/* Course Ratings */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enableRatings">Course Reviews</Label>
            <p className="text-xs text-muted-foreground">
              Allow learners to rate and review the course
            </p>
          </div>
          <Switch
            id="enableRatings"
            checked={settings.enableRatings}
            onCheckedChange={() => handleToggle("enableRatings")}
          />
        </div>

        {/* Certificate */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enableCertificate">Completion Certificate</Label>
            <p className="text-xs text-muted-foreground">
              Award certificate when course is completed
            </p>
          </div>
          <Switch
            id="enableCertificate"
            checked={settings.enableCertificate}
            onCheckedChange={() => handleToggle("enableCertificate")}
          />
        </div>

        {/* Auto-play */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="autoPlayNext">Auto-play Next Lesson</Label>
            <p className="text-xs text-muted-foreground">
              Automatically start the next lesson when one ends
            </p>
          </div>
          <Switch
            id="autoPlayNext"
            checked={settings.autoPlayNext}
            onCheckedChange={() => handleToggle("autoPlayNext")}
          />
        </div>

        {/* Sequential */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="requireSequential">Require Sequential Progress</Label>
            <p className="text-xs text-muted-foreground">
              Lock each lesson, quiz, and assignment until the previous one is marked complete. The first item is always unlocked.
            </p>
          </div>
          <Switch
            id="requireSequential"
            checked={settings.requireSequential}
            onCheckedChange={() => handleToggle("requireSequential")}
          />
        </div>

        {/* Required watch percent */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="requiredWatchPercent">Required Watch %</Label>
            <p className="text-xs text-muted-foreground">
              Percent of a video a learner must watch before it counts as
              complete. Applies to every video in this course.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Input
              id="requiredWatchPercent"
              type="number"
              min={1}
              max={100}
              className="w-20"
              value={settings.requiredWatchPercent ?? 90}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const clamped = Number.isFinite(raw)
                  ? Math.min(100, Math.max(1, Math.round(raw)))
                  : 90;
                onChange({ ...settings, requiredWatchPercent: clamped });
              }}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LMSSettingsPanel;
