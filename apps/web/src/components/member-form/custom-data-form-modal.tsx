"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@open-mtlms/core";
import { getErrorMessage } from "@open-mtlms/shared";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { memberFormApi, type MemberForm, type MemberFormField } from "@/lib/api/member-form";

interface Props {
  open: boolean;
  form: MemberForm;
  /** Called after a successful submit so the guard can close + refetch. */
  onCompleted: () => void;
  /** Only used in OPTIONAL mode. Undefined in MANDATORY mode (no dismiss). */
  onDismiss?: () => void;
  /** Logout action shown only in MANDATORY mode. */
  onLogout: () => void;
}

type FieldValue = string | string[] | boolean;

function isEmpty(value: FieldValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false; // boolean false is a valid answer
}

export function CustomDataFormModal({
  open,
  form,
  onCompleted,
  onDismiss,
  onLogout,
}: Props) {
  const isMandatory = form.mode === "MANDATORY";
  const fields = [...form.fields].sort((a, b) => a.order - b.order);

  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    for (const field of fields) {
      if (field.required && isEmpty(values[field.name])) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await memberFormApi.submit(form.id, values);
      onCompleted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // MANDATORY: never closes by outside interaction. OPTIONAL: closing
        // (X / overlay / escape) counts as a dismissal and starts the cooldown.
        if (!next && !isMandatory) onDismiss?.();
      }}
    >
      <DialogContent
        // Mobile: leave a 1rem gutter on each side instead of touching the
        // screen edges. Tablet/desktop: standard centred dialog capped at lg.
        className="flex max-h-[90vh] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        hideCloseButton={isMandatory}
        onInteractOutside={(e) => {
          if (isMandatory) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-1.5 border-b px-5 py-4 text-left sm:px-6 sm:py-5">
          <DialogTitle className="text-base font-semibold text-foreground sm:text-lg">
            {form.title}
          </DialogTitle>
          {form.description && (
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {form.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable body, grows to fill the space between the fixed header
              and footer, scrolling within the dialog's 90vh cap. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.name]}
                  onChange={(v) => setValue(field.name, v)}
                  disabled={submitting}
                />
              ))}
            </div>
          </div>

          {/* Sticky footer, separated from the scrolling body. */}
          <div className="flex items-center justify-between gap-3 border-t bg-background px-5 py-4 sm:px-6">
            {isMandatory ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                disabled={submitting}
                className="text-muted-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                disabled={submitting}
                className="text-muted-foreground"
              >
                Maybe later
              </Button>
            )}
            <Button type="submit" disabled={submitting} className="min-w-[7rem]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const INPUT_TYPES: Record<string, string> = {
  text: "text",
  email: "email",
  phone: "tel",
  number: "number",
  url: "url",
  date: "date",
};

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: {
  field: MemberFormField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
}) {
  // Honour the admin's "Half width" toggle on tablet/desktop; everything stacks
  // to a single column on mobile. Textareas always take the full row.
  const spanFull = field.type === "textarea" || !field.halfWidth;
  const wrapperClass = cn("space-y-2", spanFull && "sm:col-span-2");

  const labelNode = (
    <Label className="text-sm font-medium text-foreground">
      {field.label}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );

  const help = field.helpText ? (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {field.helpText}
    </p>
  ) : null;

  if (field.type === "textarea") {
    return (
      <div className={wrapperClass}>
        {labelNode}
        <Textarea
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
          className="resize-none"
        />
        {help}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={wrapperClass}>
        {labelNode}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            ((value as string) ?? "") === "" && "text-muted-foreground"
          )}
        >
          <option value="">{field.placeholder ?? "Select..."}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} className="text-foreground">
              {opt}
            </option>
          ))}
        </select>
        {help}
      </div>
    );
  }

  if (field.type === "radio") {
    const current = (value as string) ?? "";
    return (
      <div className={wrapperClass}>
        {labelNode}
        <div className="space-y-1">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/60"
            >
              <input
                type="radio"
                name={field.name}
                value={opt}
                checked={current === opt}
                onChange={() => onChange(opt)}
                disabled={disabled}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {help}
      </div>
    );
  }

  if (field.type === "multiselect") {
    const current = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      if (current.includes(opt)) onChange(current.filter((o) => o !== opt));
      else onChange([...current, opt]);
    };
    return (
      <div className={wrapperClass}>
        {labelNode}
        <div className="space-y-1">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/60"
            >
              <input
                type="checkbox"
                checked={current.includes(opt)}
                onChange={() => toggle(opt)}
                disabled={disabled}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {help}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className={wrapperClass}>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>
            {field.label}
            {field.required && <span className="ml-0.5 text-destructive">*</span>}
          </span>
        </label>
        {help}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {labelNode}
      <Input
        type={INPUT_TYPES[field.type] ?? "text"}
        value={(value as string) ?? ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {help}
    </div>
  );
}
