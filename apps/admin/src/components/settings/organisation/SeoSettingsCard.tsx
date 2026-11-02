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
  useToast,
} from "@open-mtlms/core";
import type { TenantLayout } from "@open-mtlms/shared";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { tenantsApi } from "@/lib/api/tenants";

// Must match the validation in apps/web layout.tsx (only valid IDs are injected).
const GA4_RE = /^G-[A-Z0-9]{4,20}$/i;
const GTM_RE = /^GTM-[A-Z0-9]{4,12}$/i;
const META_PIXEL_RE = /^\d{6,20}$/;

/**
 * Self-contained SEO/analytics settings. Reads + writes the per-tenant
 * `layout.seo` JSON via the existing layout endpoint (no schema change). Kept
 * isolated from the larger org-settings form so it can't affect it.
 */
export function SeoSettingsCard({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const [ga4, setGa4] = useState("");
  const [gtm, setGtm] = useState("");
  const [metaPixel, setMetaPixel] = useState("");
  const [verification, setVerification] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    setLoading(true);
    tenantsApi
      .getLayout(tenantId)
      .then((layout) => {
        if (!active) return;
        setGa4(layout?.seo?.ga4MeasurementId ?? "");
        setGtm(layout?.seo?.gtmContainerId ?? "");
        setMetaPixel(layout?.seo?.metaPixelId ?? "");
        setVerification(layout?.seo?.googleSiteVerificationToken ?? "");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const ga4Trim = ga4.trim();
  const ga4Invalid = ga4Trim.length > 0 && !GA4_RE.test(ga4Trim);
  const gtmTrim = gtm.trim();
  const gtmInvalid = gtmTrim.length > 0 && !GTM_RE.test(gtmTrim);
  const metaPixelTrim = metaPixel.trim();
  const metaPixelInvalid =
    metaPixelTrim.length > 0 && !META_PIXEL_RE.test(metaPixelTrim);
  const anyInvalid = ga4Invalid || gtmInvalid || metaPixelInvalid;

  const save = async () => {
    if (!tenantId || anyInvalid) return;
    setSaving(true);
    try {
      let layout = await tenantsApi.getLayout(tenantId);
      if (!layout) {
        const { getDefaultTenantLayout } = await import("@open-mtlms/ui-config");
        layout = {
          ...(getDefaultTenantLayout(tenantId) as TenantLayout),
          id: `layout-${tenantId}`,
          tenantId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      await tenantsApi.updateLayout(tenantId, {
        ...layout,
        seo: {
          ...layout.seo,
          ga4MeasurementId: ga4Trim || undefined,
          gtmContainerId: gtmTrim || undefined,
          metaPixelId: metaPixelTrim || undefined,
          googleSiteVerificationToken: verification.trim() || undefined,
        },
      });
      toast({
        title: "SEO settings saved",
        description: "Changes go live on your site within a minute.",
      });
    } catch {
      toast({ title: "Could not save SEO settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO &amp; Analytics</CardTitle>
        <CardDescription>
          Connect Google Analytics, Google Tag Manager and the Meta Pixel, and
          verify your site with Google Search Console. Your sitemap, robots.txt
          and AI (llms.txt) indexing are already enabled automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ga4">Google Analytics 4 Measurement ID</Label>
          <Input
            id="ga4"
            placeholder="G-XXXXXXXXXX"
            value={ga4}
            onChange={(e) => setGa4(e.target.value)}
            disabled={loading || saving}
          />
          {ga4Invalid ? (
            <p className="text-xs text-destructive">
              Should look like G-XXXXXXXXXX.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              From Google Analytics → Admin → Data Streams.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gtm">Google Tag Manager container ID</Label>
          <Input
            id="gtm"
            placeholder="GTM-XXXXXXX"
            value={gtm}
            onChange={(e) => setGtm(e.target.value)}
            disabled={loading || saving}
          />
          {gtmInvalid ? (
            <p className="text-xs text-destructive">
              Should look like GTM-XXXXXXX.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              From Google Tag Manager → your container (top bar).
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="metaPixel">Meta Pixel ID</Label>
          <Input
            id="metaPixel"
            placeholder="1234567890123456"
            value={metaPixel}
            onChange={(e) => setMetaPixel(e.target.value)}
            disabled={loading || saving}
          />
          {metaPixelInvalid ? (
            <p className="text-xs text-destructive">
              Should be the numeric Pixel ID (digits only).
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              From Meta Events Manager → Data Sources → your Pixel.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gsc">Google site-verification token</Label>
          <Input
            id="gsc"
            placeholder="content value of the google-site-verification meta tag"
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            disabled={loading || saving}
          />
          <p className="text-xs text-muted-foreground">
            From Search Console → Settings → Ownership verification → HTML tag.
          </p>
        </div>
        <Button onClick={save} disabled={loading || saving || anyInvalid || !tenantId}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save SEO settings
        </Button>
      </CardContent>
    </Card>
  );
}
