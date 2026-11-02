"use client";

import React, { useState, useEffect } from "react";
import { SafeLink, SocialIcon } from "@open-mtlms/core";
import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { LayoutFooter } from "@open-mtlms/shared";
import { Mail, MapPin, Phone } from "lucide-react";
import { userAuthApi } from "@/lib/api/auth";

/** Bare social-platform homepages, filter these out so only real profile URLs are shown */
const SOCIAL_BASE_URLS = new Set([
  "https://twitter.com", "https://twitter.com/",
  "https://www.twitter.com", "https://www.twitter.com/",
  "https://x.com", "https://x.com/",
  "https://www.x.com", "https://www.x.com/",
  "https://linkedin.com", "https://linkedin.com/",
  "https://www.linkedin.com", "https://www.linkedin.com/",
  "https://youtube.com", "https://youtube.com/",
  "https://www.youtube.com", "https://www.youtube.com/",
  "https://instagram.com", "https://instagram.com/",
  "https://www.instagram.com", "https://www.instagram.com/",
  "https://github.com", "https://github.com/",
  "https://www.github.com", "https://www.github.com/",
  "https://facebook.com", "https://facebook.com/",
  "https://www.facebook.com", "https://www.facebook.com/",
]);

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

function isValidSocialUrl(url: string): boolean {
  if (!url) return false;
  const normalized = normalizeUrl(url).toLowerCase();
  return !SOCIAL_BASE_URLS.has(normalized);
}

interface DashboardFooterProps {
  config: LayoutFooter;
  sidebarWidth?: string;
  className?: string;
  headerLogo?: string;
  headerLogoDark?: string;
  headerLogoAlt?: string;
}

/** Comprehensive footer: brand + link columns + connect in a single adaptive grid */
function FooterComprehensive({
  config,
  effectiveLogo,
  effectiveLogoAlt,
  logoError,
  setLogoError,
}: {
  config: LayoutFooter;
  effectiveLogo: string;
  effectiveLogoAlt: string;
  logoError: boolean;
  setLogoError: (v: boolean) => void;
}) {
  const columns = config.columns || [];
  const socialLinks = (config.socialLinks || []).filter((link) => isValidSocialUrl(link.url));
  const contactInfo = config.contactInfo;
  const whatsappContacts = config.whatsappContacts || [];
  const appDownload = config.appDownload;
  const hasConnect =
    socialLinks.length > 0 || whatsappContacts.length > 0 || !!appDownload;

  const totalSections = 1 + columns.length + 1;

  return (
    <div className={cn(
      "grid gap-x-6 gap-y-8 grid-cols-2 sm:grid-cols-3",
      totalSections <= 4 && "lg:grid-cols-4",
      totalSections >= 5 && "lg:grid-cols-5",
    )}>
      {/* Brand column */}
      <div className="col-span-2 sm:col-span-1 flex flex-col space-y-4">
        <div className="flex items-center gap-2">
          {effectiveLogo && !logoError ? (
            <Image
              src={effectiveLogo}
              alt={effectiveLogoAlt || "Logo"}
              width={120}
              height={30}
              className="h-7 w-auto object-contain sm:h-8"
              onError={() => setLogoError(true)}
              unoptimized
            />
          ) : (
            effectiveLogoAlt && (
              <span className="text-lg font-bold text-foreground sm:text-xl">{effectiveLogoAlt}</span>
            )
          )}
        </div>
        {config.description && (
          <p className="text-muted-foreground text-sm">{config.description}</p>
        )}
        {contactInfo && (
          <div className="flex flex-col space-y-2">
            {contactInfo.email && (
              <div className="flex items-center gap-2">
                <Mail className="text-primary h-4 w-4 flex-shrink-0" />
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="text-muted-foreground hover:text-primary text-sm transition-colors break-all"
                >
                  {contactInfo.email}
                </a>
              </div>
            )}
            {contactInfo.phone && (
              <div className="flex items-center gap-2">
                <Phone className="text-primary h-4 w-4 flex-shrink-0" />
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="text-muted-foreground hover:text-primary text-sm transition-colors"
                >
                  {contactInfo.phone}
                </a>
              </div>
            )}
            {contactInfo.address && (
              <div className="flex items-start gap-2">
                <MapPin className="text-primary h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm">{contactInfo.address}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link columns */}
      {columns.map((col, colIdx) => (
        <nav key={col.id || colIdx} aria-label={col.title}>
          {col.title && (
            <h3 className="text-foreground mb-3 text-sm font-semibold">{col.title}</h3>
          )}
          <ul className="flex flex-col gap-2">
            {col.links.map((link, linkIndex) => (
              <li key={linkIndex}>
                <SafeLink
                  href={link.href}
                  className="text-muted-foreground hover:text-primary text-sm transition-colors"
                >
                  {link.label}
                </SafeLink>
              </li>
            ))}
          </ul>
        </nav>
      ))}

      {/* Connect column */}
      {hasConnect && (
        <div className="col-span-2 sm:col-span-1">
          <h3 className="text-foreground mb-4 text-sm font-bold">Connect With Us</h3>
          <div className="flex flex-col space-y-5">
            <div className="grid grid-cols-3 gap-2.5 w-fit">
              {socialLinks.map((link, index) => (
                <SafeLink
                  key={index}
                  href={normalizeUrl(link.url)}
                  openInNewTab
                  className="group"
                  aria-label={link.platform}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10 transition-colors group-hover:bg-foreground/20">
                    <SocialIcon
                      platform={link.platform}
                      className="h-[18px] w-[18px] text-foreground transition-colors"
                    />
                  </div>
                </SafeLink>
              ))}
            </div>
            {whatsappContacts.length > 0 && (
              <div className="flex flex-col gap-3">
                {whatsappContacts.map((contact, idx) => (
                  <a
                    key={idx}
                    href={contact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-foreground/10 hover:bg-foreground/15 flex items-center justify-center gap-2 rounded-full px-5 py-2.5 transition"
                  >
                    <svg className="h-5 w-5 text-foreground flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span className="text-foreground text-sm font-semibold">{contact.number}</span>
                  </a>
                ))}
              </div>
            )}
            {appDownload?.enabled && (
              <div className="space-y-2">
                <p className="text-foreground text-sm font-semibold">Download App</p>
                <div className="grid grid-cols-2 gap-3 w-fit">
                  {appDownload.appStoreUrl && (
                    <SafeLink href={normalizeUrl(appDownload.appStoreUrl)} className="transition-transform hover:scale-105" openInNewTab>
                      <Image src="/icons/footer/appstore.png" alt="App Store" width={140} height={42} className="h-11 w-[140px] object-contain" />
                    </SafeLink>
                  )}
                  {appDownload.playStoreUrl && (
                    <SafeLink href={normalizeUrl(appDownload.playStoreUrl)} openInNewTab className="transition-transform hover:scale-105">
                      <Image src="/icons/footer/play-store.svg" alt="Play Store" width={140} height={42} className="h-11 w-[140px] object-contain" />
                    </SafeLink>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardFooter({
  config,
  sidebarWidth = "0px",
  className,
  headerLogo,
  headerLogoDark,
  headerLogoAlt,
}: DashboardFooterProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [orgAppLinks, setOrgAppLinks] = useState<{ android: string | null; ios: string | null } | null>(null);


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    userAuthApi
      .getTenantInfo()
      .then((info) => {
        setTenantName(info.name);
        setOrgAppLinks({ android: info.androidAppUrl || null, ios: info.iosAppUrl || null });
      })
      .catch(() => setTenantName(null));
  }, [mounted]);

  const shouldUseHeaderLogo = config.useHeaderLogo !== false;
  const lightLogo = shouldUseHeaderLogo && headerLogo ? headerLogo : config.logo;
  const darkLogo = shouldUseHeaderLogo && headerLogoDark ? headerLogoDark : (config.logoDark || lightLogo);
  const effectiveLogo = resolvedTheme === "dark" && darkLogo ? darkLogo : lightLogo;
  const effectiveLogoAlt = shouldUseHeaderLogo && headerLogoAlt ? headerLogoAlt : config.logoAlt;

  useEffect(() => {
    setLogoError(false);
  }, [effectiveLogo]);

  // Same reasoning as the header: the footer's links, contact details and
  // legal pages are identical on server and client, and a page whose footer
  // exists only after hydration has no outbound links for a crawler to follow.
  // The two client-only values, the resolved theme's logo variant and the
  // tenant name fetched after mount, already fall back gracefully.
  if (!config.enabled) return null;

  // Store links set in admin Organisation → Mobile Apps take precedence over the
  // footer editor's App Download block, and show without having to enable it there.
  const hasOrgAppLinks = !!(orgAppLinks?.android || orgAppLinks?.ios);
  const effectiveConfig: LayoutFooter = hasOrgAppLinks
    ? {
        ...config,
        appDownload: {
          enabled: true,
          playStoreUrl: orgAppLinks?.android ?? undefined,
          appStoreUrl: orgAppLinks?.ios ?? undefined,
        },
      }
    : config;

  const footerContentProps = {
    config: effectiveConfig,
    effectiveLogo,
    effectiveLogoAlt,
    logoError,
    setLogoError,
  };

  return (
    <footer
      className={cn("border-t bg-muted/30 overflow-x-hidden", className)}
      style={{ marginLeft: sidebarWidth }}
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl min-w-0 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <FooterComprehensive {...footerContentProps} />

        <div className="mt-8 border-t border-border pt-6 sm:mt-12 sm:pt-8">
          <p className="text-muted-foreground text-center text-xs sm:text-sm">
            {tenantName
              ? `© ${new Date().getFullYear()} ${tenantName}. All rights reserved.`
              : config.copyright || `© ${new Date().getFullYear()}. All rights reserved.`}
          </p>
        </div>
      </div>
    </footer>
  );
}
