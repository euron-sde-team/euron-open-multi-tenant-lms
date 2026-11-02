"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  ContactUsFormContent,
  ContactUsFormField,
  ContactUsFaqItem,
  TextStyle,
} from "@open-mtlms/shared";
import {
  ChevronDown,
  HelpCircle,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";
import { useContactPrefill } from "../useContactPrefill";

/**
 * Decode the HTML entities the backend's input sanitizer leaves in saved text
 * (e.g. an admin-entered subject option "Sales & Marketing" is stored as
 * "Sales &amp; Marketing"). Used only for display in the dropdown so options
 * read naturally. `&amp;` is decoded last to avoid double-decoding.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&");
}

interface ContactUsFormSectionProps {
  section: SectionConfig;
}

export function ContactUsFormSection({ section }: ContactUsFormSectionProps) {
  const { isEditMode, EditableText, updateSectionContent, onContactSubmit } =
    useSectionEditor();
  const content = section.content as ContactUsFormContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const fields = content.fields ?? [];
  const faqs = content.faqs ?? [];
  const stats = content.illustrationStats ?? [];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Live mode: the form is interactive and submits. In the editor it stays a
  // disabled preview so admins can lay it out without firing submissions.
  const isLive = !isEditMode && !!onContactSubmit;
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setFieldValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  // Prefill the matching dynamic fields from the logged-in member. Mirrors the
  // name/email/phone resolution used at submit time. Blank when logged out.
  useContactPrefill(({ name, email, phone }) =>
    setValues((prev) => {
      const next = { ...prev };
      const seed = (value: string, predicate: (f: ContactUsFormField) => boolean) => {
        if (!value) return;
        const field = fields.find(predicate);
        if (field && !next[field.name]) next[field.name] = value;
      };
      seed(email, (f) => f.type === "email" || /email/i.test(f.name + f.label));
      seed(
        phone,
        (f) => f.type === "tel" || /phone|mobile/i.test(f.name + f.label)
      );
      seed(
        name,
        (f) => /name/i.test(f.name + f.label) || f.type === "text"
      );
      return next;
    })
  );

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onContactSubmit) return;
    setFormError(null);

    const findValue = (predicate: (f: ContactUsFormField) => boolean) => {
      const field = fields.find(predicate);
      return field ? (values[field.name] ?? "").trim() : "";
    };

    const email = findValue((f) => f.type === "email");
    const phone = findValue(
      (f) => f.type === "tel" || /phone|mobile/i.test(f.name + f.label)
    );
    const message = findValue(
      (f) => f.type === "textarea" || /message|comment/i.test(f.name + f.label)
    );
    const subject = findValue((f) => /subject|topic/i.test(f.name + f.label));
    const name =
      findValue((f) => /name/i.test(f.name + f.label)) ||
      findValue((f) => f.type === "text") ||
      email ||
      phone;

    if (!name) {
      setFormError("Please enter your name.");
      return;
    }
    if (!message) {
      setFormError("Please enter a message.");
      return;
    }
    if (!email && !phone) {
      setFormError("Please provide an email or phone number.");
      return;
    }

    setSubmitting(true);
    try {
      await onContactSubmit({
        name,
        email: email || undefined,
        phone: phone || undefined,
        subject: subject || undefined,
        message,
        fields: { ...values },
        source: "PAGE",
      });
      setSubmitted(true);
      setValues({});
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not send your message."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleContentUpdate = (key: keyof ContactUsFormContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  // ── Field CRUD ──
  const handleFieldUpdate = (index: number, updates: Partial<ContactUsFormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    handleContentUpdate("fields", newFields);
  };

  const addField = () => {
    handleContentUpdate("fields", [
      ...fields,
      { id: `field-${Date.now()}`, name: `field_${fields.length + 1}`, label: "New Field", type: "text" as const, placeholder: "Enter value...", required: false },
    ]);
  };

  const removeField = (index: number) => {
    if (fields.length <= 1) return;
    handleContentUpdate("fields", fields.filter((_, i) => i !== index));
  };

  // ── FAQ CRUD ──
  const handleFaqUpdate = (index: number, updates: Partial<ContactUsFaqItem>) => {
    const newFaqs = [...faqs];
    newFaqs[index] = { ...newFaqs[index], ...updates };
    handleContentUpdate("faqs", newFaqs);
  };

  const addFaq = () => {
    handleContentUpdate("faqs", [
      ...faqs,
      { id: `faq-${Date.now()}`, question: "New question?", answer: "Answer here..." },
    ]);
  };

  const removeFaq = (index: number) => {
    if (faqs.length <= 1) return;
    handleContentUpdate("faqs", faqs.filter((_, i) => i !== index));
  };

  // ── Stat CRUD ──
  const handleStatUpdate = (index: number, updates: Partial<{ value: string; label: string }>) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], ...updates };
    handleContentUpdate("illustrationStats", newStats);
  };

  const addStat = () => {
    handleContentUpdate("illustrationStats", [
      ...stats,
      { id: `stat-${Date.now()}`, value: "99%", label: "Label" },
    ]);
  };

  const removeStat = (index: number) => {
    if (stats.length <= 1) return;
    handleContentUpdate("illustrationStats", stats.filter((_, i) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-0 pb-14 md:pb-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="container-custom">
        <div className="grid gap-7 lg:grid-cols-[1fr_0.85fr]">
          {/* ── LEFT: Contact Form ── */}
          <div className="rounded-3xl border bg-card p-7 md:p-10">
            <h2 className="text-2xl font-bold">
              <EditableText
                value={content.formHeadline}
                onChange={(v) => handleContentUpdate("formHeadline", v)}
                styleKey="formHeadline"
                style={content.textStyles?.formHeadline}
                onStyleChange={(s) => handleTextStyleChange("formHeadline", s)}
               
              />
            </h2>

            {(content.formDescription || isEditMode) && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                <EditableText
                  value={content.formDescription ?? ""}
                  onChange={(v) => handleContentUpdate("formDescription", v)}
                  multiline
                 
                />
              </p>
            )}

            {/* Form fields */}
            <form onSubmit={handleContactSubmit} noValidate>
            <div className="mt-7 space-y-4">
              {/* Group half-width fields into rows */}
              {(() => {
                const rows: ContactUsFormField[][] = [];
                let currentRow: ContactUsFormField[] = [];
                for (const field of fields) {
                  if (field.halfWidth) {
                    currentRow.push(field);
                    if (currentRow.length === 2) {
                      rows.push(currentRow);
                      currentRow = [];
                    }
                  } else {
                    if (currentRow.length > 0) {
                      rows.push(currentRow);
                      currentRow = [];
                    }
                    rows.push([field]);
                  }
                }
                if (currentRow.length > 0) rows.push(currentRow);
                return rows;
              })().map((row, ri) => (
                <div key={ri} className={cn("grid gap-4", row.length > 1 && "sm:grid-cols-2")}>
                  {row.map((field) => {
                    const fi = fields.findIndex((f) => f.id === field.id);
                    return (
                      <div key={field.id} className="group/field relative">
                        {isEditMode && fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeField(fi)}
                            className="absolute -right-1 -top-1 z-10 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/field:opacity-100"
                            title="Remove field"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        <label className="mb-1.5 block text-xs font-medium tracking-wide">
                          <EditableText
                            value={field.label}
                            onChange={(v) => handleFieldUpdate(fi, { label: v })}
                            as="span"
                           
                          />
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            placeholder={field.placeholder}
                            rows={4}
                            disabled={!isLive}
                            value={isLive ? values[field.name] ?? "" : undefined}
                            onChange={
                              isLive
                                ? (e) => setFieldValue(field.name, e.target.value)
                                : undefined
                            }
                            className={cn(
                              "w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none",
                              isLive
                                ? "bg-background text-foreground focus:ring-2 focus:ring-ring"
                                : "bg-muted/30 text-muted-foreground"
                            )}
                          />
                        ) : field.type === "select" ? (
                          <div className="relative">
                            <select
                              disabled={!isLive}
                              value={isLive ? values[field.name] ?? "" : undefined}
                              onChange={
                                isLive
                                  ? (e) => setFieldValue(field.name, e.target.value)
                                  : undefined
                              }
                              className={cn(
                                "w-full appearance-none rounded-xl border px-4 py-3 text-sm outline-none",
                                isLive
                                  ? "bg-background text-foreground focus:ring-2 focus:ring-ring"
                                  : "cursor-not-allowed bg-muted/30 text-muted-foreground"
                              )}
                            >
                              <option value="">
                                {decodeEntities(field.placeholder ?? "Select...")}
                              </option>
                              {(field.options ?? []).map((opt) => {
                                const text = decodeEntities(opt);
                                return (
                                  <option key={opt} value={text}>
                                    {text}
                                  </option>
                                );
                              })}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        ) : (
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            disabled={!isLive}
                            value={isLive ? values[field.name] ?? "" : undefined}
                            onChange={
                              isLive
                                ? (e) => setFieldValue(field.name, e.target.value)
                                : undefined
                            }
                            className={cn(
                              "w-full rounded-xl border px-4 py-3 text-sm outline-none",
                              isLive
                                ? "bg-background text-foreground focus:ring-2 focus:ring-ring"
                                : "bg-muted/30 text-muted-foreground"
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {isEditMode && (
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={addField}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </div>
              )}
            </div>

            {/* Submit button */}
            <div className="mt-6">
              {isLive && formError && (
                <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}
              {isLive && submitted ? (
                <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center text-sm font-medium text-foreground">
                  Thanks! Your message has been sent.
                </div>
              ) : (
                <button
                  type={isLive ? "submit" : "button"}
                  disabled={!isLive || submitting}
                  className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground disabled:opacity-70"
                >
                  {isEditMode ? (
                    <EditableText
                      value={content.submitText}
                      onChange={(v) => handleContentUpdate("submitText", v)}
                      as="span"
                    />
                  ) : (
                    content.submitText
                  )}
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            </form>
          </div>

          {/* ── RIGHT: Illustration + FAQ ── */}
          <div className="flex flex-col gap-6">
            {/* Illustration card */}
            <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.06] via-accent/[0.04] to-secondary/[0.03] p-7 md:p-8">
              {/* Decorative circles */}
              <div className="pointer-events-none absolute -right-5 -top-5 h-[100px] w-[100px] rounded-full bg-primary/[0.06]" />
              <div className="pointer-events-none absolute -bottom-7 -left-4 h-[80px] w-[80px] rounded-full bg-accent/[0.06]" />

              <div className="relative text-center">
                {(content.illustrationHeadline || isEditMode) && (
                  <h3 className="mb-2 text-lg font-bold">
                    <EditableText
                      value={content.illustrationHeadline ?? ""}
                      onChange={(v) => handleContentUpdate("illustrationHeadline", v)}
                      styleKey="illustrationHeadline"
                      style={content.textStyles?.illustrationHeadline}
                      onStyleChange={(s) => handleTextStyleChange("illustrationHeadline", s)}
                     
                    />
                  </h3>
                )}

                {(content.illustrationDescription || isEditMode) && (
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    <EditableText
                      value={content.illustrationDescription ?? ""}
                      onChange={(v) => handleContentUpdate("illustrationDescription", v)}
                      multiline
                     
                    />
                  </p>
                )}

                {/* Stats row */}
                {(stats.length > 0 || isEditMode) && (
                  <div className="flex flex-wrap justify-center gap-6">
                    {stats.map((stat, i) => (
                      <div key={stat.id} className="group/stat relative text-center">
                        {isEditMode && stats.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStat(i)}
                            className="absolute -right-1 -top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/stat:opacity-100"
                            title="Remove stat"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <div className="text-xl font-bold text-primary">
                          <EditableText
                            value={stat.value}
                            onChange={(v) => handleStatUpdate(i, { value: v })}
                            as="span"
                            placeholder="0"
                          />
                        </div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <EditableText
                            value={stat.label}
                            onChange={(v) => handleStatUpdate(i, { label: v })}
                            as="span"
                            placeholder="Label"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isEditMode && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={addStat}>
                      <Plus className="mr-2 h-3 w-3" />
                      Stat
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* FAQ section */}
            {(faqs.length > 0 || isEditMode) && (
              <div className="flex-1 rounded-3xl border bg-card p-7 md:p-8">
                <h3 className="mb-5 flex items-center gap-2.5 text-xl font-bold">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-secondary/[0.08]">
                    <HelpCircle className="h-4 w-4 text-secondary-foreground/70" />
                  </span>
                  <EditableText
                    value={content.faqHeadline ?? "Quick Answers"}
                    onChange={(v) => handleContentUpdate("faqHeadline", v)}
                    styleKey="faqHeadline"
                    style={content.textStyles?.faqHeadline}
                    onStyleChange={(s) => handleTextStyleChange("faqHeadline", s)}
                    as="span"
                   
                  />
                </h3>

                <div className="space-y-2">
                  {faqs.map((faq, i) => (
                    <div
                      key={faq.id}
                      className={cn(
                        "group/faq relative cursor-pointer rounded-xl px-4 py-3.5 transition-colors",
                        openFaq === i ? "bg-muted/50" : "hover:bg-muted/30",
                      )}
                      onClick={() => !isEditMode && setOpenFaq(openFaq === i ? null : i)}
                    >
                      {isEditMode && faqs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFaq(i); }}
                          className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/faq:opacity-100"
                          title="Remove FAQ"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium leading-snug">
                          <EditableText
                            value={faq.question}
                            onChange={(v) => handleFaqUpdate(i, { question: v })}
                            as="span"
                           
                          />
                        </span>
                        <span
                          className={cn(
                            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs transition-all",
                            openFaq === i
                              ? "rotate-45 bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          +
                        </span>
                      </div>
                      {(openFaq === i || isEditMode) && (
                        <p className={cn(
                          "mt-2 text-[13px] leading-relaxed text-muted-foreground",
                          openFaq !== i && isEditMode && "opacity-50",
                        )}>
                          <EditableText
                            value={faq.answer}
                            onChange={(v) => handleFaqUpdate(i, { answer: v })}
                            multiline
                           
                          />
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {isEditMode && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" size="sm" onClick={addFaq}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add FAQ
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
