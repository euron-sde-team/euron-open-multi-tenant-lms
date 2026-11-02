"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, ContactFormContent } from "@open-mtlms/shared";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { useSectionEditor } from "../SectionEditorContext";
import { useContactPrefill } from "../useContactPrefill";

interface ContactFormSectionProps {
  section: SectionConfig;
}

export function ContactFormSection({ section }: ContactFormSectionProps) {
  const { isEditMode, EditableText, updateSectionContent, onContactSubmit } =
    useSectionEditor();
  const content = section.content as ContactFormContent;
  const variant = section.variant;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  // Prefill name/email/phone from the logged-in member (blank when logged out).
  useContactPrefill(({ name, email, phone }) =>
    setFormData((d) => ({
      ...d,
      name: d.name || name,
      email: d.email || email,
      phone: d.phone || phone,
    }))
  );

  const fields = content?.fields ?? {
    name: true,
    email: true,
    phone: false,
    company: false,
    message: true,
  };

  const handleContentUpdate = (key: keyof ContactFormContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleFieldsUpdate = (field: keyof ContactFormContent["fields"], value: boolean) => {
    handleContentUpdate("fields", { ...fields, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode || !onContactSubmit) return;
    setFormError(null);

    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const message = formData.message.trim();

    if (!name) return setFormError("Please enter your name.");
    if (!message) return setFormError("Please enter a message.");
    if (!email && !phone)
      return setFormError("Please provide an email or phone number.");

    setSubmitting(true);
    try {
      await onContactSubmit({
        name,
        email: email || undefined,
        phone: phone || undefined,
        message,
        fields: { ...formData },
        source: "PAGE",
      });
      setSubmitted(true);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not send your message.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isSplit = variant === "split";
  const hasContactInfo = variant === "with-info";
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      id="contact-form"
      className={cn(
        "section-padding",
        hasCustomBg ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="container-custom">
        <div
          className={cn(
            "mx-auto max-w-4xl",
            isSplit && "grid gap-12 lg:grid-cols-2 lg:items-start"
          )}
        >
          {/* Content / Contact Info (for split and with-info variants) */}
          {(isSplit || hasContactInfo) && (
            <div className="flex flex-col">
              <EditableText
                value={content?.headline ?? "Get in Touch"}
                onChange={(value) => handleContentUpdate("headline", value)}
                as="h2"
                className="text-3xl font-bold tracking-tight sm:text-4xl"
              />
              {content?.subheadline && (
                <p className="mt-4 text-lg text-muted-foreground">
                  <EditableText
                    value={content.subheadline}
                    onChange={(value) => handleContentUpdate("subheadline", value)}
                  />
                </p>
              )}
              {hasContactInfo && (
                <div className="mt-8 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="mt-1">{content?.contactInfo?.email ?? "support@example.com"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="mt-1">{content?.contactInfo?.phone ?? "+1 (555) 123-4567"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Office</p>
                    <p className="mt-1">{content?.contactInfo?.address ?? "123 Business Ave, City, Country"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hours</p>
                    <p className="mt-1">{content?.contactInfo?.hours ?? "Mon–Fri 9am–6pm (your timezone)"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <div className={cn(!isSplit && !hasContactInfo && "mx-auto max-w-2xl")}>
            {(!isSplit && !hasContactInfo) && (
              <div className="text-center">
                <EditableText
                  value={content?.headline ?? "Get in Touch"}
                  onChange={(value) => handleContentUpdate("headline", value)}
                  as="h2"
                  className="text-3xl font-bold tracking-tight sm:text-4xl"
                />
                {content?.subheadline && (
                  <p className="mt-4 text-lg text-muted-foreground">
                    <EditableText
                      value={content.subheadline}
                      onChange={(value) => handleContentUpdate("subheadline", value)}
                    />
                  </p>
                )}
              </div>
            )}

            {/* Form field toggles (edit mode) */}
            {isEditMode && (
              <div className="mb-6 rounded-lg border border-dashed p-4">
                <p className="mb-3 text-sm font-medium">Form fields</p>
                <div className="flex flex-wrap gap-4">
                  {(["name", "email", "phone", "company", "message"] as const).map((field) => (
                    <label key={field} className="flex items-center gap-2">
                      <Switch
                        checked={fields[field]}
                        onCheckedChange={(v) => handleFieldsUpdate(field, v)}
                      />
                      <span className="text-sm capitalize">{field}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Submit button text</Label>
                    <Input
                      value={content?.submitText ?? "Send Message"}
                      onChange={(e) => handleContentUpdate("submitText", e.target.value)}
                      placeholder="Send Message"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Success message</Label>
                    <Textarea
                      value={content?.successMessage ?? ""}
                      onChange={(e) => handleContentUpdate("successMessage", e.target.value)}
                      placeholder="Thanks for reaching out! We'll get back to you within 24 hours."
                      rows={2}
                    />
                  </div>
                  {hasContactInfo && (
                    <>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs">Contact info (with-info variant)</Label>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Email</Label>
                        <Input
                          value={content?.contactInfo?.email ?? ""}
                          onChange={(e) =>
                            handleContentUpdate("contactInfo", {
                              ...content?.contactInfo,
                              email: e.target.value || undefined,
                            })
                          }
                          placeholder="support@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          value={content?.contactInfo?.phone ?? ""}
                          onChange={(e) =>
                            handleContentUpdate("contactInfo", {
                              ...content?.contactInfo,
                              phone: e.target.value || undefined,
                            })
                          }
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs">Address</Label>
                        <Input
                          value={content?.contactInfo?.address ?? ""}
                          onChange={(e) =>
                            handleContentUpdate("contactInfo", {
                              ...content?.contactInfo,
                              address: e.target.value || undefined,
                            })
                          }
                          placeholder="123 Business Ave, City, Country"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs">Hours</Label>
                        <Input
                          value={content?.contactInfo?.hours ?? ""}
                          onChange={(e) =>
                            handleContentUpdate("contactInfo", {
                              ...content?.contactInfo,
                              hours: e.target.value || undefined,
                            })
                          }
                          placeholder="Mon–Fri 9am–6pm (your timezone)"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {submitted ? (
              <div className="border-primary/20 bg-primary/5 mt-8 rounded-lg border p-8 text-center">
                <p className="text-lg font-medium">
                  {content?.successMessage ?? "Thanks for reaching out! We'll get back to you soon."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                {formError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {formError}
                  </div>
                )}
                <div className="grid gap-6 sm:grid-cols-2">
                  {fields.name && (
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Name</Label>
                      <Input
                        id="contact-name"
                        value={formData.name}
                        onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Your name"
                        required
                        disabled={isEditMode}
                      />
                    </div>
                  )}
                  {fields.email && (
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                        placeholder="you@example.com"
                        required
                        disabled={isEditMode}
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  {fields.phone && (
                    <div className="space-y-2">
                      <Label htmlFor="contact-phone">Phone</Label>
                      <Input
                        id="contact-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                        placeholder="+1 (555) 000-0000"
                        disabled={isEditMode}
                      />
                    </div>
                  )}
                  {fields.company && (
                    <div className="space-y-2">
                      <Label htmlFor="contact-company">Company</Label>
                      <Input
                        id="contact-company"
                        value={formData.company}
                        onChange={(e) => setFormData((d) => ({ ...d, company: e.target.value }))}
                        placeholder="Your company"
                        disabled={isEditMode}
                      />
                    </div>
                  )}
                </div>
                {fields.message && (
                  <div className="space-y-2">
                    <Label htmlFor="contact-message">Message</Label>
                    <Textarea
                      id="contact-message"
                      value={formData.message}
                      onChange={(e) => setFormData((d) => ({ ...d, message: e.target.value }))}
                      placeholder="How can we help?"
                      rows={5}
                      required
                      disabled={isEditMode}
                      className="min-h-[120px]"
                    />
                  </div>
                )}
                {!isEditMode && (
                  <Button type="submit" size="lg" disabled={submitting}>
                    {content?.submitText ?? "Send Message"}
                  </Button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
