"use client";

import { cn } from "@open-mtlms/core";
import { LMS_TEMPLATE_CONFIGS, type LMSTemplateId } from "@open-mtlms/shared";
import { Check } from "lucide-react";

interface TemplateSelectorProps {
  selectedTemplate: LMSTemplateId;
  onSelect: (templateId: LMSTemplateId) => void;
  className?: string;
}

export function TemplateSelector({
  selectedTemplate,
  onSelect,
  className,
}: TemplateSelectorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-lg font-semibold">LMS Template</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template for your course player
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LMS_TEMPLATE_CONFIGS.map((template) => {
          const isSelected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              className={cn(
                "relative flex flex-col p-4 rounded-lg border-2 text-left transition-all",
                "hover:border-primary/50 hover:shadow-md",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-muted bg-card"
              )}
            >
              {/* Selected Check */}
              {isSelected && (
                <div className="absolute top-3 right-3 p-1 rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {/* Template Preview Placeholder */}
              <div className="h-24 mb-3 rounded-md bg-muted flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground/50">
                  {template.name.charAt(0)}
                </span>
              </div>

              {/* Info */}
              <h4 className="font-semibold">{template.name}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>

              {/* Features */}
              <ul className="mt-3 space-y-1">
                {template.features.slice(0, 3).map((feature, index) => (
                  <li
                    key={index}
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TemplateSelector;
