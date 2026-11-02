"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, ContactPageContent } from "@open-mtlms/shared";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { useSectionEditor } from "../SectionEditorContext";
import { useContactPrefill } from "../useContactPrefill";

interface ContactPageSectionProps { section: SectionConfig; }

export function ContactPageSection({ section }: ContactPageSectionProps) {
  const { isEditMode, EditableText, updateSectionContent, onContactSubmit } =
    useSectionEditor();
  const content = section.content as ContactPageContent;
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", company: "", message: "" });

  // Prefill name/email/phone from the logged-in member (blank when logged out).
  useContactPrefill(({ name, email, phone }) =>
    setFormData((d) => ({
      ...d,
      name: d.name || name,
      email: d.email || email,
      phone: d.phone || phone,
    }))
  );

  const handleContentUpdate = (key: keyof ContactPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleFieldsUpdate = (field: keyof ContactPageContent["formFields"], value: boolean) => {
    handleContentUpdate("formFields", { ...fields, [field]: value });
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

  const fields = content?.formFields ?? { name: true, email: true, phone: false, company: false, message: true };
  const info = content?.contactInfo;
  const isWithInfo = variant === "with-info";
  const isCentered = variant === "centered";
  const isMinimal = variant === "minimal";

  const contactInfoBlock = (!isMinimal && (info?.email || info?.phone || info?.address || info?.hours || isEditMode)) && (
    <div className="space-y-6">
      {(info?.email || isEditMode) && (
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="font-medium">Email</p>
            <div className="text-sm text-muted-foreground">
              <EditableText
                value={info?.email ?? ""}
                onChange={(v) => handleContentUpdate("contactInfo", { ...info, email: v })}
                placeholder="Add email..."
              />
            </div>
          </div>
        </div>
      )}
      {(info?.phone || isEditMode) && (
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="font-medium">Phone</p>
            <div className="text-sm text-muted-foreground">
              <EditableText
                value={info?.phone ?? ""}
                onChange={(v) => handleContentUpdate("contactInfo", { ...info, phone: v })}
                placeholder="Add phone..."
              />
            </div>
          </div>
        </div>
      )}
      {(info?.address || isEditMode) && (
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><MapPin className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="font-medium">Address</p>
            <div className="text-sm text-muted-foreground">
              <EditableText
                value={info?.address ?? ""}
                onChange={(v) => handleContentUpdate("contactInfo", { ...info, address: v })}
                placeholder="Add address..."
              />
            </div>
          </div>
        </div>
      )}
      {(info?.hours || isEditMode) && (
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="font-medium">Hours</p>
            <div className="text-sm text-muted-foreground">
              <EditableText
                value={info?.hours ?? ""}
                onChange={(v) => handleContentUpdate("contactInfo", { ...info, hours: v })}
                placeholder="Add hours..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const formBlock = (
    <div className={cn(isCentered && "mx-auto max-w-lg rounded-2xl border bg-card p-8 shadow-sm")}>
      {/* Compact field toggles in edit mode */}
      {isEditMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Fields:</span>
          {(["name", "email", "phone", "company", "message"] as const).map((field) => (
            <label key={field} className="flex items-center gap-1.5">
              <Switch checked={fields[field]} onCheckedChange={(v) => handleFieldsUpdate(field, v)} />
              <span className="text-xs capitalize">{field}</span>
            </label>
          ))}
        </div>
      )}

      {submitted ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-8 text-center">
          <p className="text-lg font-medium">
            <EditableText
              value={content?.successMessage ?? "Thanks! We'll be in touch."}
              onChange={(v) => handleContentUpdate("successMessage", v)}
              placeholder="Success message..."
            />
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          {fields.name && (
            <div className="space-y-2"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={formData.name} onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))} placeholder="Your name" required disabled={isEditMode} /></div>
          )}
          {fields.email && (
            <div className="space-y-2"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" value={formData.email} onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))} placeholder="you@example.com" required disabled={isEditMode} /></div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.phone && (<div className="space-y-2"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" type="tel" value={formData.phone} onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))} placeholder="+1 (555) 000-0000" disabled={isEditMode} /></div>)}
            {fields.company && (<div className="space-y-2"><Label htmlFor="c-company">Company</Label><Input id="c-company" value={formData.company} onChange={(e) => setFormData((d) => ({ ...d, company: e.target.value }))} placeholder="Your company" disabled={isEditMode} /></div>)}
          </div>
          {fields.message && (
            <div className="space-y-2"><Label htmlFor="c-message">Message</Label><Textarea id="c-message" value={formData.message} onChange={(e) => setFormData((d) => ({ ...d, message: e.target.value }))} placeholder="How can we help?" rows={5} required disabled={isEditMode} className="min-h-[120px]" /></div>
          )}
          <Button type={isEditMode ? "button" : "submit"} size="lg" className="w-full" disabled={submitting}>
            <EditableText
              value={content?.submitText ?? "Send Message"}
              onChange={(v) => handleContentUpdate("submitText", v)}
              placeholder="Button text..."
            />
          </Button>
        </form>
      )}
    </div>
  );

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <EditableText value={content?.headline ?? "Contact Us"} onChange={(v) => handleContentUpdate("headline", v)} as="h1" className="text-4xl font-bold tracking-tight sm:text-5xl" />
          {(content?.subheadline || isEditMode) && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText value={content?.subheadline ?? ""} onChange={(v) => handleContentUpdate("subheadline", v)} />
            </p>
          )}
        </div>

        {isWithInfo ? (
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-5">
            <div className="lg:col-span-2">{contactInfoBlock}</div>
            <div className="lg:col-span-3">{formBlock}</div>
          </div>
        ) : isCentered ? (
          <div className="mx-auto max-w-5xl space-y-12">
            {formBlock}
            {contactInfoBlock && (<div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">{contactInfoBlock}</div>)}
          </div>
        ) : (
          <div className="mx-auto max-w-lg">{formBlock}</div>
        )}

        {(content?.mapEmbed || isEditMode) && !isMinimal && (
          <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl">
            {isEditMode && (
              <div className="mb-2">
                <EditableText
                  value={content?.mapEmbed ?? ""}
                  onChange={(v) => handleContentUpdate("mapEmbed", v)}
                  as="span"
                  className="text-xs text-muted-foreground"
                  placeholder="Paste Google Maps embed URL..."
                />
              </div>
            )}
            {content?.mapEmbed && (
              <iframe src={content.mapEmbed} className="h-[300px] w-full border-0" allowFullScreen loading="lazy" title="Location map" />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
