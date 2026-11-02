"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  AboutUsMissionContent,
  AboutUsMissionBlock,
  TextStyle,
} from "@open-mtlms/shared";
import { Target, Users, Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface AboutUsMissionSectionProps {
  section: SectionConfig;
}

export function AboutUsMissionSection({ section }: AboutUsMissionSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutUsMissionContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  // When no custom bg, section is dark (bg-foreground) → text must be light (text-background).
  // When custom bg, section is transparent → text must use standard foreground colors.
  const isDark = !hasCustomBg;

  const blocks = content.blocks ?? [];

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleBlockUpdate = (index: number, updates: Partial<AboutUsMissionBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    updateSectionContent(section.id, { blocks: newBlocks });
  };

  const addBlock = () => {
    const newBlock: AboutUsMissionBlock = {
      id: `block-${Date.now()}`,
      label: "New Section",
      title: "Your title here",
      description: "Describe this section...",
    };
    updateSectionContent(section.id, { blocks: [...blocks, newBlock] });
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    updateSectionContent(section.id, { blocks: blocks.filter((_, i) => i !== index) });
  };

  return (
    <section
      className={cn(
        "py-16 md:py-20",
        isDark ? "bg-foreground text-background" : "bg-transparent",
      )}
    >
      <div className="container-custom">
        <div className="grid gap-8 md:grid-cols-2">
          {blocks.map((block, i) => (
            <div
              key={block.id}
              className={cn(
                "group/block relative rounded-2xl p-8",
                isDark
                  ? "border border-background/[0.06] bg-background/[0.06]"
                  : "border bg-card",
              )}
            >
              {isEditMode && blocks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  className={cn(
                    "absolute right-3 top-3 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover/block:opacity-100",
                    isDark ? "text-background/50" : "text-muted-foreground",
                  )}
                  title="Remove block"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Label */}
              <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                {i === 0 ? (
                  <Target className="h-3.5 w-3.5" />
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
                <EditableText
                  value={block.label}
                  onChange={(v) => handleBlockUpdate(i, { label: v })}
                  as="span"
                 
                />
              </div>

              {/* Title */}
              <h3 className={cn(
                "mb-3 text-2xl font-bold leading-snug",
                isDark ? "text-background" : "text-foreground",
              )}>
                <EditableText
                  value={block.title}
                  onChange={(v) => handleBlockUpdate(i, { title: v })}
                  styleKey={`block-${i}-title`}
                  style={content.textStyles?.[`block-${i}-title`]}
                  onStyleChange={(s) => handleTextStyleChange(`block-${i}-title`, s)}
                 
                />
              </h3>

              {/* Description */}
              <p className={cn(
                "text-sm leading-relaxed",
                isDark ? "text-background/60" : "text-muted-foreground",
              )}>
                <EditableText
                  value={block.description}
                  onChange={(v) => handleBlockUpdate(i, { description: v })}
                  styleKey={`block-${i}-desc`}
                  style={content.textStyles?.[`block-${i}-desc`]}
                  onStyleChange={(s) => handleTextStyleChange(`block-${i}-desc`, s)}
                  multiline
                 
                />
              </p>
            </div>
          ))}
        </div>

        {isEditMode && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={addBlock}>
              <Plus className="mr-2 h-4 w-4" />
              Add Block
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
