"use client";

import { Input, Label, Switch, Textarea } from "@open-mtlms/core";
import type { TenantLayout } from "@open-mtlms/shared";
import { getTenantOrgImageUrl } from "@open-mtlms/shared/constants";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { DynamicStringList } from "@/components/settings/organisation/DynamicStringList";
import { OrgImageUploader } from "@/components/settings/organisation/OrgImageUploader";
import type { TenantOrgDetails } from "@/lib/api/tenant-org";
import { tenantsApi } from "@/lib/api/tenants";
import {
  useOrgDetails,
  useUploadOrgLogo,
  useUploadFavicon,
  useUploadFounderPhoto,
  useDeleteOrgLogo,
  useDeleteOrgFavicon,
  useDeleteOrgFounderPhoto,
} from "@/lib/hooks/use-tenant-org";
import { useTenantStore } from "@/lib/stores/tenant-store";

import type { BusinessInfo } from "./types";

interface StepBusinessInfoProps {
  businessInfo: BusinessInfo;
  onBusinessInfoChange: (info: BusinessInfo) => void;
  useAI: boolean;
  onToggleAI: (enabled: boolean) => void;
}

const R = <span className="text-destructive">*</span>;

export function StepBusinessInfo({
  businessInfo,
  onBusinessInfoChange,
  useAI,
  onToggleAI,
}: StepBusinessInfoProps) {
  const { data: orgDetails, isLoading } = useOrgDetails();
  const { selectedTenantId } = useTenantStore();
  const uploadLogo = useUploadOrgLogo();
  const uploadFavicon = useUploadFavicon();
  const uploadFounderPhoto = useUploadFounderPhoto();
  const deleteLogo = useDeleteOrgLogo();
  const deleteFaviconMut = useDeleteOrgFavicon();
  const deleteFounderPhotoMut = useDeleteOrgFounderPhoto();
  const hasPrePopulated = useRef(false);

  // Sync org logo to tenant layout header so header/footer picks it up
  const syncLogoToLayout = useCallback(async (updatedOrg: TenantOrgDetails) => {
    if (!selectedTenantId) return;
    try {
      const layout = await tenantsApi.getLayout(selectedTenantId);
      const logoUrl = getTenantOrgImageUrl(updatedOrg.logoLightKey) || getTenantOrgImageUrl(updatedOrg.logoDarkKey) || "";
      const logoDarkUrl = getTenantOrgImageUrl(updatedOrg.logoDarkKey) || "";
      const headerPatch = { logo: logoUrl, logoDark: logoDarkUrl };
      if (layout) {
        await tenantsApi.updateLayout(selectedTenantId, {
          ...layout,
          header: { ...layout.header, ...headerPatch },
        });
      } else {
        // No layout stored yet, create one from defaults with the logo
        const { getDefaultTenantLayout } = await import("@open-mtlms/ui-config");
        const defaultLayout = getDefaultTenantLayout(selectedTenantId) as TenantLayout;
        await tenantsApi.updateLayout(selectedTenantId, {
          ...defaultLayout,
          id: `layout-${selectedTenantId}`,
          tenantId: selectedTenantId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          header: { ...defaultLayout.header, ...headerPatch },
        });
      }
    } catch {
      // Layout sync is best-effort
    }
  }, [selectedTenantId]);

  // Pre-populate from existing org details (only once)
  useEffect(() => {
    if (!orgDetails || hasPrePopulated.current) return;
    hasPrePopulated.current = true;

    const addr = orgDetails.address;
    const social = orgDetails.socialLinks;

    onBusinessInfoChange({
      ...businessInfo,
      tagline: businessInfo.tagline || orgDetails.tagline || "",
      description: businessInfo.description || orgDetails.description || "",
      contactEmail: businessInfo.contactEmail || orgDetails.contactEmail || "",
      supportEmail: businessInfo.supportEmail || orgDetails.supportEmail || "",
      phoneNumbers: businessInfo.phoneNumbers.length ? businessInfo.phoneNumbers : (orgDetails.phoneNumbers ?? []),
      whatsappNumbers: businessInfo.whatsappNumbers.length ? businessInfo.whatsappNumbers : (orgDetails.whatsappNumbers ?? []),
      address: {
        line1: businessInfo.address.line1 || addr?.line1 || "",
        line2: businessInfo.address.line2 || addr?.line2 || "",
        city: businessInfo.address.city || addr?.city || "",
        state: businessInfo.address.state || addr?.state || "",
        country: businessInfo.address.country || addr?.country || "",
        postalCode: businessInfo.address.postalCode || addr?.postalCode || "",
      },
      founderName: businessInfo.founderName || orgDetails.founderName || "",
      founderTitle: businessInfo.founderTitle || orgDetails.founderTitle || "",
      founderBio: businessInfo.founderBio || orgDetails.founderBio || "",
      socialLinks: {
        website: businessInfo.socialLinks.website || social?.website || "",
        linkedin: businessInfo.socialLinks.linkedin || social?.linkedin || "",
        twitter: businessInfo.socialLinks.twitter || social?.twitter || "",
        facebook: businessInfo.socialLinks.facebook || social?.facebook || "",
        instagram: businessInfo.socialLinks.instagram || social?.instagram || "",
        youtube: businessInfo.socialLinks.youtube || social?.youtube || "",
      },
      legalEntityName: businessInfo.legalEntityName || orgDetails.legalEntityName || "",
      registrationNumber: businessInfo.registrationNumber || orgDetails.registrationNumber || "",
      yearEstablished: businessInfo.yearEstablished || orgDetails.yearEstablished?.toString() || "",
      industry: businessInfo.industry || orgDetails.industry || "",
    });
  }, [orgDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof BusinessInfo>(field: K, value: BusinessInfo[K]) => {
    onBusinessInfoChange({ ...businessInfo, [field]: value });
  };

  const updateAddress = (field: keyof BusinessInfo["address"], value: string) => {
    onBusinessInfoChange({
      ...businessInfo,
      address: { ...businessInfo.address, [field]: value },
    });
  };

  const updateSocial = (field: keyof BusinessInfo["socialLinks"], value: string) => {
    onBusinessInfoChange({
      ...businessInfo,
      socialLinks: { ...businessInfo.socialLinks, [field]: value },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-bold">Tell Us About Your Business</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This information will be saved to your organisation settings and used across all your pages.
        </p>
      </div>

      {/* AI Toggle */}
      <div className="bg-muted/50 flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
            <Sparkles className="text-primary h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">AI-Powered Content</p>
            <p className="text-muted-foreground text-xs">
              {useAI
                ? "AI will generate text and images for all pages based on your info."
                : "Pages will use default template content. Edit them later."}
            </p>
          </div>
        </div>
        <Switch checked={useAI} onCheckedChange={onToggleAI} />
      </div>

      {/* ── Branding ─────────────────────────────────────────── */}
      <Section title="Branding" description="Upload your organisation logos and favicon. Images save instantly.">
        <OrgImageUploader
          label="Logo (Light)"
          description="Used on light backgrounds (navbar, headers), max 5MB"
          currentImageUrl={getTenantOrgImageUrl(orgDetails?.logoLightKey)}
          onUpload={async (file) => { const result = await uploadLogo.mutateAsync({ slot: "light", file }); await syncLogoToLayout(result); }}
          onDelete={async () => { const result = await deleteLogo.mutateAsync("light"); await syncLogoToLayout(result); }}
          isUploading={uploadLogo.isPending}
          isDeleting={deleteLogo.isPending}
        />
        <OrgImageUploader
          label="Logo (Dark)"
          description="Used on dark backgrounds, max 5MB"
          currentImageUrl={getTenantOrgImageUrl(orgDetails?.logoDarkKey)}
          onUpload={async (file) => { const result = await uploadLogo.mutateAsync({ slot: "dark", file }); await syncLogoToLayout(result); }}
          onDelete={async () => { const result = await deleteLogo.mutateAsync("dark"); await syncLogoToLayout(result); }}
          isUploading={uploadLogo.isPending}
          isDeleting={deleteLogo.isPending}
        />
        <OrgImageUploader
          label="Favicon"
          description="Only .ico files supported, max 5MB. Shown in browser tabs"
          currentImageUrl={getTenantOrgImageUrl(orgDetails?.faviconKey)}
          accept=".ico,image/x-icon"
          allowedExtensions={[".ico"]}
          onUpload={async (file) => { await uploadFavicon.mutateAsync(file); }}
          onDelete={async () => { await deleteFaviconMut.mutateAsync(); }}
          isUploading={uploadFavicon.isPending}
          isDeleting={deleteFaviconMut.isPending}
        />
      </Section>

      {/* ── Basic Information ─────────────────────────────────── */}
      <Section title="Basic Information" description="Tagline and description for your organisation.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Business Name {R}</Label>
            <Input
              value={businessInfo.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g., Acme Learning"
            />
          </div>
          <div className="space-y-2">
            <Label>Tagline {R}</Label>
            <Input
              value={businessInfo.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="e.g., Learn smarter, grow faster"
              maxLength={200}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description {R}</Label>
          <Textarea
            value={businessInfo.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe your business in 2-3 sentences."
            rows={3}
            maxLength={5000}
          />
        </div>
      </Section>

      {/* ── Contact Information ──────────────────────────────── */}
      <Section title="Contact Information" description="Email addresses and phone numbers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Email {R}</Label>
            <Input
              type="email"
              value={businessInfo.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              placeholder="contact@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Support Email {R}</Label>
            <Input
              type="email"
              value={businessInfo.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
              placeholder="support@example.com"
            />
          </div>
        </div>
        <DynamicStringList
          label="Phone Numbers"
          placeholder="+91 98765 43210"
          values={businessInfo.phoneNumbers}
          onChange={(v) => update("phoneNumbers", v)}
        />
        <DynamicStringList
          label="WhatsApp Numbers"
          placeholder="+91 98765 43210"
          values={businessInfo.whatsappNumbers}
          onChange={(v) => update("whatsappNumbers", v)}
        />
      </Section>

      {/* ── Address ──────────────────────────────────────────── */}
      <Section title="Address" description="Physical address of your organisation.">
        <div className="space-y-2">
          <Label>Address Line 1 {R}</Label>
          <Input
            value={businessInfo.address.line1}
            onChange={(e) => updateAddress("line1", e.target.value)}
            placeholder="Street address"
          />
        </div>
        <div className="space-y-2">
          <Label>Address Line 2</Label>
          <Input
            value={businessInfo.address.line2}
            onChange={(e) => updateAddress("line2", e.target.value)}
            placeholder="Suite, floor, etc."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>City {R}</Label>
            <Input
              value={businessInfo.address.city}
              onChange={(e) => updateAddress("city", e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label>State / Province {R}</Label>
            <Input
              value={businessInfo.address.state}
              onChange={(e) => updateAddress("state", e.target.value)}
              placeholder="State"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Country {R}</Label>
            <Input
              value={businessInfo.address.country}
              onChange={(e) => updateAddress("country", e.target.value)}
              placeholder="Country"
            />
          </div>
          <div className="space-y-2">
            <Label>Postal Code {R}</Label>
            <Input
              value={businessInfo.address.postalCode}
              onChange={(e) => updateAddress("postalCode", e.target.value)}
              placeholder="Postal code"
            />
          </div>
        </div>
      </Section>

      {/* ── Founder ──────────────────────────────────────────── */}
      <Section title="Founder" description="Information about the organisation founder.">
        <OrgImageUploader
          label="Founder Photo"
          currentImageUrl={getTenantOrgImageUrl(orgDetails?.founderPhotoKey)}
          onUpload={async (file) => { await uploadFounderPhoto.mutateAsync(file); }}
          onDelete={async () => { await deleteFounderPhotoMut.mutateAsync(); }}
          isUploading={uploadFounderPhoto.isPending}
          isDeleting={deleteFounderPhotoMut.isPending}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name {R}</Label>
            <Input
              value={businessInfo.founderName}
              onChange={(e) => update("founderName", e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Title {R}</Label>
            <Input
              value={businessInfo.founderTitle}
              onChange={(e) => update("founderTitle", e.target.value)}
              placeholder="e.g. CEO & Founder"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Bio {R}</Label>
          <Textarea
            value={businessInfo.founderBio}
            onChange={(e) => update("founderBio", e.target.value)}
            placeholder="Short bio..."
            rows={3}
          />
        </div>
      </Section>

      {/* ── Social Links ─────────────────────────────────────── */}
      <Section title="Social Links" description="Your organisation's web presence.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Website {R}</Label>
            <Input
              value={businessInfo.socialLinks.website}
              onChange={(e) => updateSocial("website", e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>LinkedIn</Label>
            <Input
              value={businessInfo.socialLinks.linkedin}
              onChange={(e) => updateSocial("linkedin", e.target.value)}
              placeholder="https://linkedin.com/company/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Twitter / X</Label>
            <Input
              value={businessInfo.socialLinks.twitter}
              onChange={(e) => updateSocial("twitter", e.target.value)}
              placeholder="https://x.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Facebook</Label>
            <Input
              value={businessInfo.socialLinks.facebook}
              onChange={(e) => updateSocial("facebook", e.target.value)}
              placeholder="https://facebook.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Instagram</Label>
            <Input
              value={businessInfo.socialLinks.instagram}
              onChange={(e) => updateSocial("instagram", e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>YouTube</Label>
            <Input
              value={businessInfo.socialLinks.youtube}
              onChange={(e) => updateSocial("youtube", e.target.value)}
              placeholder="https://youtube.com/@..."
            />
          </div>
        </div>
      </Section>

      {/* ── Legal & Business ─────────────────────────────────── */}
      <Section title="Legal & Business" description="Legal entity details and business information.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Legal Entity Name {R}</Label>
            <Input
              value={businessInfo.legalEntityName}
              onChange={(e) => update("legalEntityName", e.target.value)}
              placeholder="Registered company name"
            />
          </div>
          <div className="space-y-2">
            <Label>Registration Number</Label>
            <Input
              value={businessInfo.registrationNumber}
              onChange={(e) => update("registrationNumber", e.target.value)}
              placeholder="GST/Tax ID (optional)"
            />
          </div>
          <div className="space-y-2">
            <Label>Year Established {R}</Label>
            <Input
              type="number"
              value={businessInfo.yearEstablished}
              onChange={(e) => update("yearEstablished", e.target.value)}
              placeholder="e.g. 2020"
              min={1800}
              max={new Date().getFullYear()}
            />
          </div>
          <div className="space-y-2">
            <Label>Industry {R}</Label>
            <Input
              value={businessInfo.industry}
              onChange={(e) => update("industry", e.target.value)}
              placeholder="e.g. Education, Technology"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {children}
    </div>
  );
}
