"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  Input,
  Label,
} from "@open-mtlms/core";
import type { TextStyle } from "@open-mtlms/shared";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, RotateCcw } from "lucide-react";
import { useState } from "react";


// Size lives in its own toolbar button now (TextSizeToolbar); this popover
// handles colour + weight + style + alignment only.
function normalizeHex(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return "";
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return trimmed;
}

interface TextStyleToolbarProps {
  style?: TextStyle;
  onStyleChange?: (style: TextStyle) => void;
  children: React.ReactNode;
}

export function TextStyleToolbar({ style, onStyleChange = () => {}, children }: TextStyleToolbarProps) {
  const s = style ?? {};
  const [lightHex, setLightHex] = useState(s.color ?? "");
  const [darkHex, setDarkHex] = useState(s.colorDark ?? "");

  const displayLight = lightHex.startsWith("#") ? lightHex : lightHex ? `#${lightHex}` : "#000000";
  const displayDark = darkHex.startsWith("#") ? darkHex : darkHex ? `#${darkHex}` : "#e5e7eb";

  const handleColorLight = (hex: string) => {
    const val = normalizeHex(hex);
    setLightHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || val === "") {
      onStyleChange({ ...s, color: val || undefined });
    }
  };

  const handleColorDark = (hex: string) => {
    const val = normalizeHex(hex);
    setDarkHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || val === "") {
      onStyleChange({ ...s, colorDark: val || undefined });
    }
  };

  const handleClear = () => {
    onStyleChange({});
    setLightHex("");
    setDarkHex("");
  };

  const hasAnyStyle = !!(
    s.color ||
    s.colorDark ||
    s.fontSize ||
    s.fontWeight ||
    s.fontStyle ||
    s.textAlign
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] w-72 overflow-y-auto p-4 sm:max-w-[18rem]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Text Style</span>
            {hasAnyStyle && (
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={handleClear}>
                <RotateCcw className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Color (Light)</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={displayLight}
                onChange={(e) => handleColorLight(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <Input
                type="text"
                value={lightHex}
                onChange={(e) => setLightHex(e.target.value)}
                onBlur={(e) => handleColorLight(e.target.value)}
                placeholder="#000000"
                className="flex-1 font-mono text-xs uppercase"
                maxLength={7}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Color (Dark)</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={displayDark}
                onChange={(e) => handleColorDark(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <Input
                type="text"
                value={darkHex}
                onChange={(e) => setDarkHex(e.target.value)}
                onBlur={(e) => handleColorDark(e.target.value)}
                placeholder="#e5e7eb"
                className="flex-1 font-mono text-xs uppercase"
                maxLength={7}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={s.fontWeight === "bold" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onStyleChange({
                  ...s,
                  fontWeight: s.fontWeight === "bold" ? undefined : "bold",
                })
              }
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant={s.fontStyle === "italic" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onStyleChange({
                  ...s,
                  fontStyle: s.fontStyle === "italic" ? undefined : "italic",
                })
              }
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant={s.textAlign === "left" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onStyleChange({
                  ...s,
                  textAlign: s.textAlign === "left" ? undefined : "left",
                })
              }
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={s.textAlign === "center" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onStyleChange({
                  ...s,
                  textAlign: s.textAlign === "center" ? undefined : "center",
                })
              }
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant={s.textAlign === "right" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onStyleChange({
                  ...s,
                  textAlign: s.textAlign === "right" ? undefined : "right",
                })
              }
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
