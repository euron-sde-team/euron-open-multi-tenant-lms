"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import type { TenantLayout } from "@open-mtlms/shared";
import { getTenantOrgImageUrl } from "@open-mtlms/shared/constants";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

import { DynamicStringList } from "@/components/settings/organisation/DynamicStringList";
import { OrgImageUploader } from "@/components/settings/organisation/OrgImageUploader";
import { SeoSettingsCard } from "@/components/settings/organisation/SeoSettingsCard";
import type { TenantOrgAddress, TenantOrgSocialLinks, TenantOrgDetails, UpdateTenantOrgRequest } from "@/lib/api/tenant-org";
import { tenantsApi } from "@/lib/api/tenants";
import { useUpdateOrgName } from "@/lib/hooks/use-organization";
import {
  useOrgDetails,
  useUpdateOrgDetails,
  useUploadOrgLogo,
  useUploadFavicon,
  useUploadFounderPhoto,
  useDeleteOrgLogo,
  useDeleteOrgFavicon,
  useDeleteOrgFounderPhoto,
} from "@/lib/hooks/use-tenant-org";
import { useTenantStore } from "@/lib/stores/tenant-store";

export default function OrganisationSettingsPage() {
  const { data: orgDetails, isLoading } = useOrgDetails();
  const updateOrg = useUpdateOrgDetails();
  const updateOrgName = useUpdateOrgName();
  const uploadLogo = useUploadOrgLogo();
  const uploadFavicon = useUploadFavicon();
  const uploadFounderPhoto = useUploadFounderPhoto();
  const deleteLogo = useDeleteOrgLogo();
  const deleteFavicon = useDeleteOrgFavicon();
  const deleteFounderPhoto = useDeleteOrgFounderPhoto();
  const { toast } = useToast();
  const { selectedTenantId, selectedTenant } = useTenantStore();

  // Organisation Name
  const [orgName, setOrgName] = useState("");
  const [orgNameDirty, setOrgNameDirty] = useState(false);
  const isOwner = selectedTenant?.is_owner ?? false;

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
      // Layout sync is best-effort, don't block the user
    }
  }, [selectedTenantId]);

  // Basic Info
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [basicDirty, setBasicDirty] = useState(false);

  // Contact
  const [contactEmail, setContactEmail] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [whatsappNumbers, setWhatsappNumbers] = useState<string[]>([]);
  const [contactDirty, setContactDirty] = useState(false);

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressDirty, setAddressDirty] = useState(false);

  // Founder
  const [founderName, setFounderName] = useState("");
  const [founderTitle, setFounderTitle] = useState("");
  const [founderBio, setFounderBio] = useState("");
  const [founderDirty, setFounderDirty] = useState(false);

  // Social Links
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [socialDirty, setSocialDirty] = useState(false);

  // Community Links
  const [whatsappLink, setWhatsappLink] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [discordLink, setDiscordLink] = useState("");
  const [communityDirty, setCommunityDirty] = useState(false);

  // Mobile Apps
  const [androidAppUrl, setAndroidAppUrl] = useState("");
  const [iosAppUrl, setIosAppUrl] = useState("");
  const [appsDirty, setAppsDirty] = useState(false);

  // Legal
  const [legalEntityName, setLegalEntityName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [industry, setIndustry] = useState("");
  const [legalDirty, setLegalDirty] = useState(false);

  useEffect(() => {
    if (selectedTenant) {
      setOrgName(selectedTenant.tenant_name ?? "");
      setOrgNameDirty(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (!orgDetails) return;
    setTagline(orgDetails.tagline ?? "");
    setDescription(orgDetails.description ?? "");
    setContactEmail(orgDetails.contactEmail ?? "");
    setSupportEmail(orgDetails.supportEmail ?? "");
    setPhoneNumbers(orgDetails.phoneNumbers ?? []);
    setWhatsappNumbers(orgDetails.whatsappNumbers ?? []);
    const addr = orgDetails.address as TenantOrgAddress | null;
    setAddressLine1(addr?.line1 ?? "");
    setAddressLine2(addr?.line2 ?? "");
    setCity(addr?.city ?? "");
    setState(addr?.state ?? "");
    setCountry(addr?.country ?? "");
    setPostalCode(addr?.postalCode ?? "");
    setFounderName(orgDetails.founderName ?? "");
    setFounderTitle(orgDetails.founderTitle ?? "");
    setFounderBio(orgDetails.founderBio ?? "");
    const social = orgDetails.socialLinks as TenantOrgSocialLinks | null;
    setWebsite(social?.website ?? "");
    setLinkedin(social?.linkedin ?? "");
    setTwitter(social?.twitter ?? "");
    setFacebook(social?.facebook ?? "");
    setInstagram(social?.instagram ?? "");
    setYoutube(social?.youtube ?? "");
    setWhatsappLink(social?.whatsapp ?? "");
    setTelegramLink(social?.telegram ?? "");
    setDiscordLink(social?.discord ?? "");
    setAndroidAppUrl(orgDetails.androidAppUrl ?? "");
    setIosAppUrl(orgDetails.iosAppUrl ?? "");
    setLegalEntityName(orgDetails.legalEntityName ?? "");
    setRegistrationNumber(orgDetails.registrationNumber ?? "");
    setYearEstablished(orgDetails.yearEstablished?.toString() ?? "");
    setIndustry(orgDetails.industry ?? "");

    setBasicDirty(false);
    setContactDirty(false);
    setAddressDirty(false);
    setFounderDirty(false);
    setSocialDirty(false);
    setCommunityDirty(false);
    setAppsDirty(false);
    setLegalDirty(false);
  }, [orgDetails]);

  const saveSection = useCallback(
    (data: UpdateTenantOrgRequest, resetDirty: () => void) => {
      updateOrg.mutate(data, {
        onSuccess: () => {
          resetDirty();
          toast({ title: "Saved", description: "Organisation details updated." });
        },
        onError: (err) => {
          toast({
            title: "Save Failed",
            description: err.message || "Failed to save changes.",
            variant: "destructive",
          });
        },
      });
    },
    [updateOrg, toast]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Organisation</h1>
        <p className="text-muted-foreground">
          Manage your organisation details, branding, and contact information.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Organisation Name ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organisation Name</CardTitle>
            <CardDescription>
              {isOwner
                ? "Update your organisation name. This will also update the slug used for subdomains."
                : "Only the organisation owner can change the name."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value);
                  setOrgNameDirty(true);
                }}
                placeholder="Organisation name"
                disabled={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Slug</Label>
              <Input
                value={selectedTenant?.tenant_slug ?? ""}
                disabled
                className="text-muted-foreground"
              />
            </div>
            {isOwner && (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    updateOrgName.mutate(orgName, {
                      onSuccess: (data) => {
                        setOrgNameDirty(false);
                        toast({
                          title: "Name Updated",
                          description: `Organisation renamed. New slug: ${data.slug}. If the slug changed, remove the old subdomain from the Domains page and redeploy.`,
                        });
                      },
                      onError: (err) => {
                        toast({
                          title: "Update Failed",
                          description: err.message || "Failed to update organisation name.",
                          variant: "destructive",
                        });
                      },
                    });
                  }}
                  disabled={!orgNameDirty || !orgName.trim() || orgName.trim().length < 2 || updateOrgName.isPending}
                  size="sm"
                >
                  {updateOrgName.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Branding ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branding</CardTitle>
            <CardDescription>
              Upload your organisation logos and favicon. Images save instantly on upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              onDelete={async () => { await deleteFavicon.mutateAsync(); }}
              isUploading={uploadFavicon.isPending}
              isDeleting={deleteFavicon.isPending}
            />
          </CardContent>
        </Card>

        {/* ── Basic Information ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <CardDescription>
              Tagline and description for your organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input
                value={tagline}
                onChange={(e) => { setTagline(e.target.value); setBasicDirty(true); }}
                placeholder="A short tagline for your organisation"
                maxLength={200}
              />
              <p className="text-muted-foreground text-xs">{tagline.length}/200</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setBasicDirty(true); }}
                placeholder="Describe your organisation..."
                rows={4}
                maxLength={5000}
              />
              <p className="text-muted-foreground text-xs">{description.length}/5000</p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveSection(
                    { tagline: tagline || null, description: description || null },
                    () => setBasicDirty(false)
                  )
                }
                disabled={!basicDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Contact Information ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
            <CardDescription>
              Email addresses and phone numbers for your organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => { setContactEmail(e.target.value); setContactDirty(true); }}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => { setSupportEmail(e.target.value); setContactDirty(true); }}
                  placeholder="support@example.com"
                />
              </div>
            </div>
            <DynamicStringList
              label="Phone Numbers"
              placeholder="+91 98765 43210"
              values={phoneNumbers}
              onChange={(v) => { setPhoneNumbers(v); setContactDirty(true); }}
            />
            <DynamicStringList
              label="WhatsApp Numbers"
              placeholder="+91 98765 43210"
              values={whatsappNumbers}
              onChange={(v) => { setWhatsappNumbers(v); setContactDirty(true); }}
            />
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveSection(
                    {
                      contact_email: contactEmail || null,
                      support_email: supportEmail || null,
                      phone_numbers: phoneNumbers.filter(Boolean).length ? phoneNumbers.filter(Boolean) : null,
                      whatsapp_numbers: whatsappNumbers.filter(Boolean).length ? whatsappNumbers.filter(Boolean) : null,
                    },
                    () => setContactDirty(false)
                  )
                }
                disabled={!contactDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Address ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Address</CardTitle>
            <CardDescription>
              Physical address of your organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input
                value={addressLine1}
                onChange={(e) => { setAddressLine1(e.target.value); setAddressDirty(true); }}
                placeholder="Street address"
              />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input
                value={addressLine2}
                onChange={(e) => { setAddressLine2(e.target.value); setAddressDirty(true); }}
                placeholder="Suite, floor, etc."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setAddressDirty(true); }}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>State / Province</Label>
                <Input
                  value={state}
                  onChange={(e) => { setState(e.target.value); setAddressDirty(true); }}
                  placeholder="State"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setAddressDirty(true); }}
                  placeholder="Country"
                />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input
                  value={postalCode}
                  onChange={(e) => { setPostalCode(e.target.value); setAddressDirty(true); }}
                  placeholder="Postal code"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  const hasAddress = addressLine1 || city || state || country;
                  saveSection(
                    {
                      address: hasAddress
                        ? {
                            line1: addressLine1 || undefined,
                            line2: addressLine2 || undefined,
                            city: city || undefined,
                            state: state || undefined,
                            country: country || undefined,
                            postalCode: postalCode || undefined,
                          }
                        : null,
                    },
                    () => setAddressDirty(false)
                  );
                }}
                disabled={!addressDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Founder ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Founder</CardTitle>
            <CardDescription>
              Information about the organisation founder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OrgImageUploader
              label="Founder Photo"
              currentImageUrl={getTenantOrgImageUrl(orgDetails?.founderPhotoKey)}
              onUpload={async (file) => { await uploadFounderPhoto.mutateAsync(file); }}
              onDelete={async () => { await deleteFounderPhoto.mutateAsync(); }}
              isUploading={uploadFounderPhoto.isPending}
              isDeleting={deleteFounderPhoto.isPending}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={founderName}
                  onChange={(e) => { setFounderName(e.target.value); setFounderDirty(true); }}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={founderTitle}
                  onChange={(e) => { setFounderTitle(e.target.value); setFounderDirty(true); }}
                  placeholder="e.g. CEO & Founder"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                value={founderBio}
                onChange={(e) => { setFounderBio(e.target.value); setFounderDirty(true); }}
                placeholder="Short bio..."
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveSection(
                    {
                      founder_name: founderName || null,
                      founder_title: founderTitle || null,
                      founder_bio: founderBio || null,
                    },
                    () => setFounderDirty(false)
                  )
                }
                disabled={!founderDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Social Links ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Social Links</CardTitle>
            <CardDescription>
              Your organisation&apos;s web presence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={website}
                  onChange={(e) => { setWebsite(e.target.value); setSocialDirty(true); }}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input
                  value={linkedin}
                  onChange={(e) => { setLinkedin(e.target.value); setSocialDirty(true); }}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Twitter / X</Label>
                <Input
                  value={twitter}
                  onChange={(e) => { setTwitter(e.target.value); setSocialDirty(true); }}
                  placeholder="https://x.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input
                  value={facebook}
                  onChange={(e) => { setFacebook(e.target.value); setSocialDirty(true); }}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={instagram}
                  onChange={(e) => { setInstagram(e.target.value); setSocialDirty(true); }}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <Input
                  value={youtube}
                  onChange={(e) => { setYoutube(e.target.value); setSocialDirty(true); }}
                  placeholder="https://youtube.com/@..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  const hasSocial = website || linkedin || twitter || facebook || instagram || youtube || whatsappLink || telegramLink || discordLink;
                  saveSection(
                    {
                      social_links: hasSocial
                        ? {
                            website: website || undefined,
                            linkedin: linkedin || undefined,
                            twitter: twitter || undefined,
                            facebook: facebook || undefined,
                            instagram: instagram || undefined,
                            youtube: youtube || undefined,
                            whatsapp: whatsappLink || undefined,
                            telegram: telegramLink || undefined,
                            discord: discordLink || undefined,
                          }
                        : null,
                    },
                    () => setSocialDirty(false)
                  );
                }}
                disabled={!socialDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Community Links ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Community Links</CardTitle>
            <CardDescription>
              Links to your community channels. Shown in the learner site footer (Connect With Us) and as floating icons on the home page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={whatsappLink}
                  onChange={(e) => { setWhatsappLink(e.target.value); setCommunityDirty(true); }}
                  placeholder="https://chat.whatsapp.com/... or https://wa.me/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Telegram</Label>
                <Input
                  value={telegramLink}
                  onChange={(e) => { setTelegramLink(e.target.value); setCommunityDirty(true); }}
                  placeholder="https://t.me/channelname"
                />
              </div>
              <div className="space-y-2">
                <Label>Discord</Label>
                <Input
                  value={discordLink}
                  onChange={(e) => { setDiscordLink(e.target.value); setCommunityDirty(true); }}
                  placeholder="https://discord.gg/invitecode"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  const hasSocial = website || linkedin || twitter || facebook || instagram || youtube || whatsappLink || telegramLink || discordLink;
                  saveSection(
                    {
                      social_links: hasSocial
                        ? {
                            website: website || undefined,
                            linkedin: linkedin || undefined,
                            twitter: twitter || undefined,
                            facebook: facebook || undefined,
                            instagram: instagram || undefined,
                            youtube: youtube || undefined,
                            whatsapp: whatsappLink || undefined,
                            telegram: telegramLink || undefined,
                            discord: discordLink || undefined,
                          }
                        : null,
                    },
                    () => setCommunityDirty(false)
                  );
                }}
                disabled={!communityDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Mobile Apps ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mobile Apps</CardTitle>
            <CardDescription>
              Optional. If your academy has a mobile app, add its store links here and
              they appear as download buttons in the footer of every email we send your
              learners. Leave a field empty to remove that link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Google Play Store Link</Label>
                <Input
                  value={androidAppUrl}
                  onChange={(e) => { setAndroidAppUrl(e.target.value); setAppsDirty(true); }}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                />
              </div>
              <div className="space-y-2">
                <Label>Apple App Store Link</Label>
                <Input
                  value={iosAppUrl}
                  onChange={(e) => { setIosAppUrl(e.target.value); setAppsDirty(true); }}
                  placeholder="https://apps.apple.com/app/id..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveSection(
                    {
                      // Empty string is meaningful here: it clears the stored link.
                      // Sending null would leave the old one in place.
                      android_app_url: androidAppUrl.trim(),
                      ios_app_url: iosAppUrl.trim(),
                    },
                    () => setAppsDirty(false)
                  )
                }
                disabled={!appsDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Legal & Business ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legal &amp; Business</CardTitle>
            <CardDescription>
              Legal entity details and business information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Legal Entity Name</Label>
                <Input
                  value={legalEntityName}
                  onChange={(e) => { setLegalEntityName(e.target.value); setLegalDirty(true); }}
                  placeholder="Registered company name"
                />
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input
                  value={registrationNumber}
                  onChange={(e) => { setRegistrationNumber(e.target.value); setLegalDirty(true); }}
                  placeholder="GST/Tax ID (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label>Year Established</Label>
                <Input
                  type="number"
                  value={yearEstablished}
                  onChange={(e) => { setYearEstablished(e.target.value); setLegalDirty(true); }}
                  placeholder="e.g. 2020"
                  min={1800}
                  max={new Date().getFullYear()}
                />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  value={industry}
                  onChange={(e) => { setIndustry(e.target.value); setLegalDirty(true); }}
                  placeholder="e.g. Education, Technology"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveSection(
                    {
                      legal_entity_name: legalEntityName || null,
                      registration_number: registrationNumber || null,
                      year_established: yearEstablished ? parseInt(yearEstablished, 10) : null,
                      industry: industry || null,
                    },
                    () => setLegalDirty(false)
                  )
                }
                disabled={!legalDirty || updateOrg.isPending}
                size="sm"
              >
                {updateOrg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <SeoSettingsCard tenantId={selectedTenantId} />
      </div>
    </div>
  );
}
