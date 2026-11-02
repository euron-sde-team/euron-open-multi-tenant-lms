"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, PricingPageContent, PricingTier, FAQItem } from "@open-mtlms/shared";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface PricingPageSectionProps { section: SectionConfig; }

export function PricingPageSection({ section }: PricingPageSectionProps) {
  const { isEditMode, EditableText, LinkComponent, updateSectionContent } = useSectionEditor();
  const content = section.content as PricingPageContent;
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const handleContentUpdate = (key: keyof PricingPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const tiers = content?.tiers ?? [];
  const faqItems = content?.faqItems ?? [];
  const isMinimal = variant === "minimal";
  const isComparison = variant === "comparison";
  const showFaq = !isMinimal && (faqItems.length > 0 || isEditMode);
  const showCta = !isMinimal && (content?.ctaHeadline || isEditMode);

  // Tier CRUD
  const handleTierUpdate = (index: number, updates: Partial<PricingTier>) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], ...updates };
    handleContentUpdate("tiers", newTiers);
  };

  const addTier = () => {
    const newTier: PricingTier = {
      id: `tier-${Date.now()}`,
      name: "New Plan",
      description: "Plan description",
      price: "$0",
      period: "/month",
      features: ["Feature 1"],
      cta: { text: "Get Started", href: "#", variant: "primary" },
    };
    handleContentUpdate("tiers", [...tiers, newTier]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    handleContentUpdate("tiers", tiers.filter((_, i) => i !== index));
  };

  // Tier feature CRUD
  const handleFeatureUpdate = (tierIndex: number, featureIndex: number, value: string) => {
    const tier = tiers[tierIndex];
    const newFeatures = [...tier.features];
    newFeatures[featureIndex] = value;
    handleTierUpdate(tierIndex, { features: newFeatures });
  };

  const addFeature = (tierIndex: number) => {
    const tier = tiers[tierIndex];
    handleTierUpdate(tierIndex, { features: [...tier.features, "New feature"] });
  };

  const removeFeature = (tierIndex: number, featureIndex: number) => {
    const tier = tiers[tierIndex];
    if (tier.features.length <= 1) return;
    handleTierUpdate(tierIndex, { features: tier.features.filter((_, i) => i !== featureIndex) });
  };

  // FAQ CRUD
  const handleFaqUpdate = (index: number, updates: Partial<FAQItem>) => {
    const newFaqs = [...faqItems];
    newFaqs[index] = { ...newFaqs[index], ...updates };
    handleContentUpdate("faqItems", newFaqs);
  };

  const addFaq = () => {
    const newFaq: FAQItem = {
      id: `faq-${Date.now()}`,
      question: "New question?",
      answer: "Add your answer here...",
    };
    handleContentUpdate("faqItems", [...faqItems, newFaq]);
  };

  const removeFaq = (index: number) => {
    if (faqItems.length <= 1) return;
    handleContentUpdate("faqItems", faqItems.filter((_, i) => i !== index));
  };

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom space-y-20">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <EditableText value={content?.headline ?? "Pricing"} onChange={(v) => handleContentUpdate("headline", v)} as="h1" className="text-4xl font-bold tracking-tight sm:text-5xl" />
          {(content?.subheadline || isEditMode) && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText value={content?.subheadline ?? ""} onChange={(v) => handleContentUpdate("subheadline", v)} />
            </p>
          )}
        </div>

        {/* Pricing Cards */}
        {isComparison ? (
          <div className="mx-auto max-w-5xl overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-4 font-medium text-muted-foreground">Features</th>
                  {tiers.map((t, tierIdx) => (
                    <th key={t.id} className={cn("p-4 text-center", t.highlighted && "bg-primary/5")}>
                      <div className="relative">
                        {isEditMode && tiers.length > 1 && (
                          <button type="button" onClick={() => removeTier(tierIdx)} className="absolute -right-1 -top-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remove tier">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        <p className="text-lg font-bold">
                          <EditableText value={t.name} onChange={(v) => handleTierUpdate(tierIdx, { name: v })} />
                        </p>
                        <p className="mt-1">
                          <span className="text-2xl font-bold">
                            <EditableText value={t.price} onChange={(v) => handleTierUpdate(tierIdx, { price: v })} placeholder="$0" />
                          </span>
                          <span className="text-sm font-normal text-muted-foreground">
                            <EditableText value={t.period ?? ""} onChange={(v) => handleTierUpdate(tierIdx, { period: v })} placeholder="/mo" />
                          </span>
                        </p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(tiers.flatMap((t) => t.features))).map((feature, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-4 text-muted-foreground">{feature}</td>
                    {tiers.map((t) => (
                      <td key={t.id} className={cn("p-4 text-center", t.highlighted && "bg-primary/5")}>
                        {t.features.includes(feature) ? <Check className="mx-auto h-5 w-5 text-primary" /> : <span className="text-muted-foreground/60">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="p-4" />
                  {tiers.map((t, tierIdx) => (
                    <td key={t.id} className={cn("p-4 text-center", t.highlighted && "bg-primary/5")}>
                      {isEditMode ? (
                        <EditableClickable
                          href={t.cta.href}
                          onHrefChange={(href) => handleTierUpdate(tierIdx, { cta: { ...t.cta, href } })}
                          isEditing={isEditMode}
                          slotLabel="CTA Button"
                        >
                          <Button variant={t.highlighted ? "default" : "outline"} className="w-full">
                            <EditableText value={t.cta.text} onChange={(v) => handleTierUpdate(tierIdx, { cta: { ...t.cta, text: v } })} placeholder="Button text..." />
                          </Button>
                        </EditableClickable>
                      ) : (
                        <LinkComponent href={t.cta.href} className="block"><Button variant={t.highlighted ? "default" : "outline"} className="w-full">{t.cta.text}</Button></LinkComponent>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {isEditMode && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={addTier}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tier
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={cn("mx-auto grid max-w-5xl gap-8", tiers.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
              {tiers.map((tier, tierIdx) => (
                <div key={tier.id} className={cn(
                  "group/tier relative flex flex-col rounded-2xl border p-8",
                  tier.highlighted ? "border-primary bg-primary/5 shadow-lg ring-1 ring-primary" : "bg-card"
                )}>
                  {isEditMode && tiers.length > 1 && (
                    <button type="button" onClick={() => removeTier(tierIdx)} className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/tier:opacity-100" title="Remove tier">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {(tier.badge || isEditMode) && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                      <EditableText
                        value={tier.badge ?? ""}
                        onChange={(v) => handleTierUpdate(tierIdx, { badge: v || undefined })}
                       
                      />
                    </span>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold">
                      <EditableText value={tier.name} onChange={(v) => handleTierUpdate(tierIdx, { name: v })} />
                    </h3>
                    {(tier.description || isEditMode) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <EditableText value={tier.description ?? ""} onChange={(v) => handleTierUpdate(tierIdx, { description: v })} />
                      </p>
                    )}
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      <EditableText value={tier.price} onChange={(v) => handleTierUpdate(tierIdx, { price: v })} placeholder="$0" />
                    </span>
                    {(tier.period || isEditMode) && (
                      <span className="text-sm text-muted-foreground">
                        <EditableText value={tier.period ?? ""} onChange={(v) => handleTierUpdate(tierIdx, { period: v })} placeholder="/month" />
                      </span>
                    )}
                  </div>
                  {isEditMode && (
                    <div className="mb-2 flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={tier.highlighted ?? false}
                          onChange={(e) => handleTierUpdate(tierIdx, { highlighted: e.target.checked })}
                          className="rounded"
                        />
                        Highlighted
                      </label>
                    </div>
                  )}
                  <ul className="mb-8 flex-1 space-y-3">
                    {tier.features.map((f, fi) => (
                      <li key={fi} className="group/feat flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="flex-1">
                          <EditableText value={f} onChange={(v) => handleFeatureUpdate(tierIdx, fi, v)} />
                        </span>
                        {isEditMode && tier.features.length > 1 && (
                          <button type="button" onClick={() => removeFeature(tierIdx, fi)} className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/feat:opacity-100" title="Remove feature">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                    {isEditMode && (
                      <li>
                        <button type="button" onClick={() => addFeature(tierIdx)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <Plus className="h-3 w-3" /> Add feature
                        </button>
                      </li>
                    )}
                  </ul>
                  {isEditMode ? (
                    <EditableClickable
                      href={tier.cta.href}
                      onHrefChange={(href) => handleTierUpdate(tierIdx, { cta: { ...tier.cta, href } })}
                      isEditing={isEditMode}
                      slotLabel="CTA Button"
                    >
                      <Button variant={tier.highlighted ? "default" : "outline"} className="w-full" size="lg">
                        <EditableText value={tier.cta.text} onChange={(v) => handleTierUpdate(tierIdx, { cta: { ...tier.cta, text: v } })} placeholder="Button text..." />
                      </Button>
                    </EditableClickable>
                  ) : (
                    <LinkComponent href={tier.cta.href} className="block"><Button variant={tier.highlighted ? "default" : "outline"} className="w-full" size="lg">{tier.cta.text}</Button></LinkComponent>
                  )}
                </div>
              ))}
            </div>
            {isEditMode && (
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={addTier}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Pricing Tier
                </Button>
              </div>
            )}
          </>
        )}

        {/* FAQ */}
        {showFaq && (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold">
              <EditableText value={content?.faqHeadline ?? "FAQ"} onChange={(v) => handleContentUpdate("faqHeadline", v)} />
            </h2>
            <div className="space-y-3">
              {faqItems.map((item, idx) => {
                const isOpen = openFaq === item.id || isEditMode;
                return (
                  <div key={item.id} className="group/faq rounded-lg border">
                    <div className="flex items-center gap-2">
                      <button type="button" className="flex flex-1 items-center justify-between p-4 text-left font-medium" onClick={() => !isEditMode && setOpenFaq(openFaq === item.id ? null : item.id)}>
                        <span className="flex-1">
                          <EditableText value={item.question} onChange={(v) => handleFaqUpdate(idx, { question: v })} />
                        </span>
                        {!isEditMode && (
                          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                        )}
                      </button>
                      {isEditMode && faqItems.length > 1 && (
                        <button type="button" onClick={() => removeFaq(idx)} className="mr-3 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/faq:opacity-100" title="Remove FAQ">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {isOpen && (
                      <div className="border-t px-4 pb-4 pt-2 text-sm text-muted-foreground">
                        <EditableText value={item.answer} onChange={(v) => handleFaqUpdate(idx, { answer: v })} as="p" multiline />
                      </div>
                    )}
                  </div>
                );
              })}
              {isEditMode && (
                <Button variant="outline" size="sm" onClick={addFaq} className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Add FAQ Item
                </Button>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        {showCta && (
          <div className="mx-auto max-w-3xl rounded-2xl bg-muted/50 p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold">
              <EditableText value={content?.ctaHeadline ?? ""} onChange={(v) => handleContentUpdate("ctaHeadline", v)} />
            </h2>
            {(content?.ctaSubheadline || isEditMode) && (
              <p className="mt-2 text-muted-foreground">
                <EditableText value={content?.ctaSubheadline ?? ""} onChange={(v) => handleContentUpdate("ctaSubheadline", v)} />
              </p>
            )}
            {(content?.ctaButton || isEditMode) && (
              <div className="mt-6">
                {isEditMode ? (
                  <EditableClickable
                    href={content?.ctaButton?.href ?? "#"}
                    onHrefChange={(href) => handleContentUpdate("ctaButton", { ...(content?.ctaButton ?? { text: "Get Started", href: "#", variant: "primary" as const }), href })}
                    isEditing={isEditMode}
                    slotLabel="CTA Button"
                  >
                    <Button size="lg">
                      <EditableText
                        value={content?.ctaButton?.text ?? "Get Started"}
                        onChange={(v) => handleContentUpdate("ctaButton", { ...(content?.ctaButton ?? { text: "Get Started", href: "#", variant: "primary" as const }), text: v })}
                        placeholder="Button text..."
                      />
                    </Button>
                  </EditableClickable>
                ) : content?.ctaButton ? (
                  <LinkComponent href={content.ctaButton.href} className="inline-block"><Button size="lg">{content.ctaButton.text}</Button></LinkComponent>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
