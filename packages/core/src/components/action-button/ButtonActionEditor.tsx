"use client";

/**
 * ButtonActionEditor
 *
 * Admin UI component for configuring a button's action. Renders a dropdown
 * to select the action type, then shows the corresponding parameter fields.
 *
 * Usage in admin:
 *   <ButtonActionEditor
 *     value={button.action}
 *     onChange={(newAction) => updateButton({ ...button, action: newAction })}
 *   />
 */

import * as React from "react";
import type {
  ButtonActionConfig,
  ButtonActionType,
  ActionParamFieldMeta,
} from "@open-mtlms/shared";
import {
  BUTTON_ACTION_META,
  BUTTON_ACTION_TYPES,
  ACTION_CATEGORY_LABELS,
} from "@open-mtlms/shared";
import {
  getDefaultActionParams,
} from "@open-mtlms/shared";

// ============================================================================
// Props
// ============================================================================

interface ButtonActionEditorProps {
  /** Current action config value */
  value: ButtonActionConfig;
  /** Called when the action config changes */
  onChange: (config: ButtonActionConfig) => void;
  /** Restrict which action types are shown */
  allowedActionTypes?: ButtonActionType[];
  /** Whether to show the action type selector */
  showTypeSelector?: boolean;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

function ButtonActionEditor({
  value,
  onChange,
  allowedActionTypes,
  showTypeSelector = true,
  className,
}: ButtonActionEditorProps) {
  const availableTypes = allowedActionTypes ?? BUTTON_ACTION_TYPES;

  // Group actions by category
  const groupedActions = React.useMemo(() => {
    const groups: Record<string, ButtonActionType[]> = {};
    for (const type of availableTypes) {
      const meta = BUTTON_ACTION_META[type];
      if (!groups[meta.category]) {
        groups[meta.category] = [];
      }
      groups[meta.category].push(type);
    }
    return groups;
  }, [availableTypes]);

  const currentMeta = BUTTON_ACTION_META[value.type];

  // Handle action type change
  const handleTypeChange = React.useCallback(
    (newType: ButtonActionType) => {
      const defaultConfig = getDefaultActionParams(newType);
      onChange(defaultConfig);
    },
    [onChange]
  );

  // Handle individual param field change
  const handleParamChange = React.useCallback(
    (key: string, fieldValue: unknown) => {
      const updatedParams = { ...value.params, [key]: fieldValue };
      onChange({ ...value, params: updatedParams } as ButtonActionConfig);
    },
    [value, onChange]
  );

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {/* Action Type Selector */}
      {showTypeSelector && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Button Action
          </label>
          <select
            value={value.type}
            onChange={(e) => handleTypeChange(e.target.value as ButtonActionType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {Object.entries(groupedActions).map(([category, types]) => (
              <optgroup
                key={category}
                label={ACTION_CATEGORY_LABELS[category as keyof typeof ACTION_CATEGORY_LABELS] ?? category}
              >
                {types.map((type) => {
                  const meta = BUTTON_ACTION_META[type];
                  return (
                    <option key={type} value={type}>
                      {meta.label}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {currentMeta.description}
          </p>
        </div>
      )}

      {/* Parameter Fields */}
      {currentMeta.fields.length > 0 && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Parameters
          </p>
          {currentMeta.fields.map((field) => (
            <ParamField
              key={field.key}
              field={field}
              value={(value.params as Record<string, unknown>)[field.key]}
              onChange={(val) => handleParamChange(field.key, val)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ParamField, renders a single parameter input
// ============================================================================

interface ParamFieldProps {
  field: ActionParamFieldMeta;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ParamField({ field, value, onChange }: ParamFieldProps) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </label>
          <input
            type={field.type === "url" ? "url" : "text"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(value as boolean) ?? (field.defaultValue as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            id={`param-${field.key}`}
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor={`param-${field.key}`} className="text-sm text-foreground">
            {field.label}
          </label>
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </label>
          <select
            value={(value as string) ?? (field.defaultValue as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </label>
          <input
            type="number"
            value={(value as number) ?? (field.defaultValue as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={field.placeholder}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case "json":
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </label>
          <textarea
            value={
              typeof value === "string"
                ? value
                : value
                  ? JSON.stringify(value, null, 2)
                  : ""
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Keep raw string while user is typing
                onChange(e.target.value);
              }
            }}
            placeholder={field.placeholder}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ============================================================================
// Export
// ============================================================================

export { ButtonActionEditor };
export type { ButtonActionEditorProps };
