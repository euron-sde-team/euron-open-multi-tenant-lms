"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@open-mtlms/core";
import type { FooterColumn, LayoutFooter } from "@open-mtlms/shared";
import { GripVertical, Loader2, Plus, Share2, Trash2, Wand2 } from "lucide-react";
import { useCallback, useState } from "react";

import { tenantsApi } from "@/lib/api/tenants";
import { useTenantStore } from "@/lib/stores/tenant-store";

/** Prepend https:// to URLs that look like domains but lack a protocol. */
function normalizeUrl(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return trimmed;
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/.test(trimmed)) return trimmed;
  const slashIdx = trimmed.indexOf("/");
  const domainPart = slashIdx === -1 ? trimmed : trimmed.slice(0, slashIdx);
  if (domainPart.includes(".")) return `https://${trimmed}`;
  return trimmed;
}

const SOCIAL_ACCORDION_VALUE = "social-links";
const WHATSAPP_APP_ACCORDION_VALUE = "whatsapp-app";

const SOCIAL_PLATFORMS = ["twitter", "linkedin", "youtube", "instagram", "github", "facebook"];

interface FooterEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: LayoutFooter;
  onSave: (config: LayoutFooter) => void;
}

function generateId() {
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FooterEditModal({
  open,
  onOpenChange,
  config,
  onSave,
}: FooterEditModalProps) {
  const [localConfig, setLocalConfig] = useState<LayoutFooter>(config);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { selectedTenant } = useTenantStore();
  const tenantId = selectedTenant?.tenant_id;

  const update = useCallback((updates: Partial<LayoutFooter>) => {
    setLocalConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleAddColumn = useCallback(() => {
    const newColumn: FooterColumn = {
      id: generateId(),
      title: "New Column",
      links: [{ label: "Link", href: "/" }],
    };
    update({ columns: [...(localConfig.columns || []), newColumn] });
  }, [localConfig.columns, update]);

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      update({
        columns: (localConfig.columns || []).filter((c) => c.id !== columnId),
      });
    },
    [localConfig.columns, update]
  );

  const handleUpdateColumn = useCallback(
    (columnId: string, colUpdates: Partial<FooterColumn>) => {
      update({
        columns: (localConfig.columns || []).map((c) =>
          c.id === columnId ? { ...c, ...colUpdates } : c
        ),
      });
    },
    [localConfig.columns, update]
  );

  const handleAddLink = useCallback(
    (columnId: string) => {
      handleUpdateColumn(columnId, {
        links: [
          ...(localConfig.columns?.find((c) => c.id === columnId)?.links || []),
          { label: "New Link", href: "/" },
        ],
      });
    },
    [localConfig.columns, handleUpdateColumn]
  );

  const handleDeleteLink = useCallback(
    (columnId: string, linkIndex: number) => {
      const col = localConfig.columns?.find((c) => c.id === columnId);
      if (!col) return;
      const newLinks = col.links.filter((_, i) => i !== linkIndex);
      handleUpdateColumn(columnId, { links: newLinks });
    },
    [localConfig.columns, handleUpdateColumn]
  );

  const handleUpdateLink = useCallback(
    (columnId: string, linkIndex: number, field: "label" | "href", value: string) => {
      const col = localConfig.columns?.find((c) => c.id === columnId);
      if (!col) return;
      const newLinks = [...col.links];
      newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      handleUpdateColumn(columnId, { links: newLinks });
    },
    [localConfig.columns, handleUpdateColumn]
  );

  const handleAddSocialLink = useCallback(() => {
    const socialLinks = localConfig.socialLinks || [];
    update({
      socialLinks: [
        ...socialLinks,
        { platform: "twitter", url: "", icon: "twitter" },
      ],
    });
  }, [localConfig.socialLinks, update]);

  const handleDeleteSocialLink = useCallback(
    (index: number) => {
      const socialLinks = [...(localConfig.socialLinks || [])];
      socialLinks.splice(index, 1);
      update({ socialLinks });
    },
    [localConfig.socialLinks, update]
  );

  const handleUpdateSocialLink = useCallback(
    (index: number, field: "platform" | "url", value: string) => {
      const socialLinks = [...(localConfig.socialLinks || [])];
      socialLinks[index] = { ...socialLinks[index], [field]: value };
      if (field === "platform") socialLinks[index].icon = value;
      update({ socialLinks });
    },
    [localConfig.socialLinks, update]
  );

  const handleAddWhatsAppContact = useCallback(() => {
    const whatsappContacts = localConfig.whatsappContacts || [];
    update({
      whatsappContacts: [
        ...whatsappContacts,
        { number: "", href: "https://wa.me/" },
      ],
    });
  }, [localConfig.whatsappContacts, update]);

  const handleDeleteWhatsAppContact = useCallback(
    (index: number) => {
      const whatsappContacts = [...(localConfig.whatsappContacts || [])];
      whatsappContacts.splice(index, 1);
      update({ whatsappContacts });
    },
    [localConfig.whatsappContacts, update]
  );

  const handleUpdateWhatsAppContact = useCallback(
    (index: number, number: string) => {
      const whatsappContacts = [...(localConfig.whatsappContacts || [])];
      const cleanNumber = number.replace(/\s+/g, "").replace(/^\+/, "");
      whatsappContacts[index] = {
        number: number,
        href: cleanNumber ? `https://wa.me/${cleanNumber}` : "https://wa.me/",
      };
      update({ whatsappContacts });
    },
    [localConfig.whatsappContacts, update]
  );

  const handleUpdateAppDownload = useCallback(
    (field: "enabled" | "appStoreUrl" | "playStoreUrl", value: string | boolean) => {
      const appDownload = {
        ...(localConfig.appDownload || {
          enabled: false,
          appStoreUrl: "https://apps.apple.com/in/app/apple-store/id375380948",
          playStoreUrl: "https://play.google.com/store/games?hl=en_IN",
        }),
      };
      if (field === "enabled") appDownload.enabled = value as boolean;
      else if (field === "appStoreUrl") appDownload.appStoreUrl = value as string;
      else if (field === "playStoreUrl") appDownload.playStoreUrl = value as string;
      update({ appDownload });
    },
    [localConfig.appDownload, update]
  );

  const handleAutoGenerate = useCallback(async () => {
    if (!tenantId) return;
    setIsGenerating(true);
    try {
      const generated = await tenantsApi.generateFooter(tenantId);
      setLocalConfig(generated);
    } catch {
      // Silently fail, user can still edit manually
    } finally {
      setIsGenerating(false);
    }
  }, [tenantId]);

  const handleSave = useCallback(() => {
    const normalized = { ...localConfig };
    if (normalized.socialLinks) {
      normalized.socialLinks = normalized.socialLinks.map((link) => ({
        ...link,
        url: normalizeUrl(link.url),
      }));
    }
    if (normalized.appDownload) {
      normalized.appDownload = {
        ...normalized.appDownload,
        appStoreUrl: normalized.appDownload.appStoreUrl
          ? normalizeUrl(normalized.appDownload.appStoreUrl)
          : normalized.appDownload.appStoreUrl,
        playStoreUrl: normalized.appDownload.playStoreUrl
          ? normalizeUrl(normalized.appDownload.playStoreUrl)
          : normalized.appDownload.playStoreUrl,
      };
    }
    onSave(normalized);
    onOpenChange(false);
  }, [localConfig, onSave, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setLocalConfig(config);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col gap-0 p-0 overflow-hidden" hideCloseButton>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Edit Footer</DialogTitle>
              <p className="text-muted-foreground text-sm">
                Add, edit, or remove links, columns, and social links. Changes apply site-wide.
              </p>
            </div>
            {tenantId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoGenerate}
                disabled={isGenerating}
                className="gap-2 shrink-0"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Auto-Generate
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            {/* Description - shown in brand column */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={localConfig.description || ""}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Empowering learners worldwide with cutting-edge education technology..."
                rows={3}
              />
            </div>

            {/* Copyright */}
            <div className="space-y-2">
              <Label>Copyright</Label>
              <Input
                value={localConfig.copyright}
                onChange={(e) => update({ copyright: e.target.value })}
                placeholder="© 2025 Your Company. All rights reserved."
              />
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                value={localConfig.contactInfo?.email || ""}
                onChange={(e) =>
                  update({
                    contactInfo: { ...(localConfig.contactInfo || {}), email: e.target.value },
                  })
                }
                placeholder="support@example.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={localConfig.contactInfo?.phone || ""}
                onChange={(e) =>
                  update({
                    contactInfo: { ...(localConfig.contactInfo || {}), phone: e.target.value },
                  })
                }
                placeholder="+91 98765 43210"
                type="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={localConfig.contactInfo?.address || ""}
                onChange={(e) =>
                  update({
                    contactInfo: { ...(localConfig.contactInfo || {}), address: e.target.value },
                  })
                }
                placeholder="123 Main St, City, Country"
                rows={2}
              />
            </div>

            {/* Link Columns & Social Links - Single accordion, one open at a time */}
            <div className="space-y-2">
              <Label>Link Columns & Social</Label>
              <Accordion
                type="single"
                value={accordionValue}
                onValueChange={setAccordionValue}
                collapsible
                className="w-full"
              >
                {(localConfig.columns || []).map((col) => (
                  <AccordionItem key={col.id} value={col.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{col.title || "Untitled"}</span>
                        <span className="text-muted-foreground text-xs">
                          ({col.links?.length || 0} links)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pl-6">
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Column Title</Label>
                          <Input
                            value={col.title}
                            onChange={(e) => handleUpdateColumn(col.id, { title: e.target.value })}
                            placeholder="Column title"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive mt-6"
                          onClick={() => handleDeleteColumn(col.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Links</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAddLink(col.id)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add Link
                          </Button>
                        </div>
                        {(col.links || []).map((link, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              value={link.label}
                              onChange={(e) =>
                                handleUpdateLink(col.id, idx, "label", e.target.value)
                              }
                              placeholder="Label"
                              className="flex-1"
                            />
                            <Input
                              value={link.href}
                              onChange={(e) =>
                                handleUpdateLink(col.id, idx, "href", e.target.value)
                              }
                              placeholder="/path"
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-destructive"
                              onClick={() => handleDeleteLink(col.id, idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
                <AccordionItem value={SOCIAL_ACCORDION_VALUE}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Social Links</span>
                      <span className="text-muted-foreground text-xs">
                        ({(localConfig.socialLinks || []).length} links)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Social Links</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddSocialLink}
                        className="gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    {(localConfig.socialLinks || []).map((link, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Select
                          value={link.platform}
                          onValueChange={(v) => handleUpdateSocialLink(idx, "platform", v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SOCIAL_PLATFORMS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={link.url}
                          onChange={(e) => handleUpdateSocialLink(idx, "url", e.target.value)}
                          placeholder="https://..."
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          onClick={() => handleDeleteSocialLink(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value={WHATSAPP_APP_ACCORDION_VALUE}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">WhatsApp & App Download</span>
                      <span className="text-muted-foreground text-xs">
                        ({(localConfig.whatsappContacts || []).length} WhatsApp,{" "}
                        {localConfig.appDownload?.enabled ? "App enabled" : "App disabled"})
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pl-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">WhatsApp Contacts</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddWhatsAppContact}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                      {(localConfig.whatsappContacts || []).map((contact, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            value={contact.number}
                            onChange={(e) => handleUpdateWhatsAppContact(idx, e.target.value)}
                            placeholder="+91 98765 43210"
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive"
                            onClick={() => handleDeleteWhatsAppContact(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="app-download-enabled"
                          checked={localConfig.appDownload?.enabled || false}
                          onCheckedChange={(checked) =>
                            handleUpdateAppDownload("enabled", checked)
                          }
                        />
                        <Label htmlFor="app-download-enabled">Show App Download</Label>
                      </div>
                      {localConfig.appDownload?.enabled && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">App Store URL</Label>
                            <Input
                              value={localConfig.appDownload?.appStoreUrl || ""}
                              onChange={(e) =>
                                handleUpdateAppDownload("appStoreUrl", e.target.value)
                              }
                              placeholder="https://apps.apple.com/..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Play Store URL</Label>
                            <Input
                              value={localConfig.appDownload?.playStoreUrl || ""}
                              onChange={(e) =>
                                handleUpdateAppDownload("playStoreUrl", e.target.value)
                              }
                              placeholder="https://play.google.com/..."
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddColumn}
                className="gap-1 mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Column
              </Button>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Footer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
