"use client";

import { Button, SafeLink, SocialIcon } from "@open-mtlms/core";
import type { LayoutFooter } from "@open-mtlms/shared";
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { FooterEditModal } from "./footer-edit-modal";

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
  headerLogoAlt?: string;
  isEditing?: boolean;
  onFooterUpdate?: (updates: Partial<LayoutFooter>) => void;
}

function FooterLogo({
  effectiveLogo,
  effectiveLogoAlt,
  logoError,
  setLogoError,
  isEditing = false,
  className,
}: {
  effectiveLogo: string;
  effectiveLogoAlt: string;
  logoError: boolean;
  setLogoError: (v: boolean) => void;
  isEditing?: boolean;
  className?: string;
}) {
  const logoImage = effectiveLogo && !logoError ? (
    <Image
      src={effectiveLogo}
      alt={effectiveLogoAlt || "Logo"}
      width={120}
      height={30}
      className="h-7 w-auto object-contain dark:invert sm:h-8"
      onError={() => setLogoError(true)}
      unoptimized
    />
  ) : (
    effectiveLogoAlt ? (
      <span className="text-lg font-bold text-foreground sm:text-xl">{effectiveLogoAlt}</span>
    ) : null
  );

  if (isEditing) {
    return (
      <Link
        href="/dashboard/settings/organisation"
        className={cn("group relative flex items-center gap-2 rounded-md", className)}
        title="Edit logo in Organisation Settings"
      >
        {logoImage}
        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1 text-xs text-white">
            <Pencil className="h-3 w-3" />
            <span>Edit</span>
          </div>
        </div>
      </Link>
    );
  }

  return <div className={cn("flex items-center gap-2", className)}>{logoImage}</div>;
}

function FooterComprehensive({
  config,
  effectiveLogo,
  effectiveLogoAlt,
  logoError,
  setLogoError,
  isEditing = false,
}: {
  config: LayoutFooter;
  effectiveLogo: string;
  effectiveLogoAlt: string;
  logoError: boolean;
  setLogoError: (v: boolean) => void;
  isEditing?: boolean;
}) {
  const columns = config.columns || [];
  const socialLinks = (config.socialLinks || []).filter((link) => isValidSocialUrl(link.url));
  const contactInfo = config.contactInfo;
  const whatsappContacts = config.whatsappContacts || [];
  const appDownload = config.appDownload;
  const hasSocial = socialLinks.length > 0;
  const hasConnect = hasSocial || whatsappContacts.length > 0 || appDownload?.enabled;

  // Total sections = brand(1) + link columns + connect column (if any)
  const totalSections = 1 + columns.length + (hasConnect ? 1 : 0);

  return (
    <div className={cn(
      "grid gap-x-6 gap-y-8 grid-cols-2 sm:grid-cols-3",
      totalSections <= 4 && "lg:grid-cols-4",
      totalSections >= 5 && "lg:grid-cols-5",
    )}>
      {/* Brand column */}
      <div className="col-span-2 sm:col-span-1 flex flex-col space-y-4">
        <FooterLogo effectiveLogo={effectiveLogo} effectiveLogoAlt={effectiveLogoAlt} logoError={logoError} setLogoError={setLogoError} isEditing={isEditing} />
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
            {hasSocial && (
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
            )}
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
  headerLogoAlt,
  isEditing = false,
  onFooterUpdate,
}: DashboardFooterProps) {
  const [logoError, setLogoError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const shouldUseHeaderLogo = config.useHeaderLogo !== false;
  const effectiveLogo = shouldUseHeaderLogo && headerLogo ? headerLogo : config.logo;
  const effectiveLogoAlt = shouldUseHeaderLogo && headerLogoAlt ? headerLogoAlt : config.logoAlt;

  useEffect(() => {
    setLogoError(false);
  }, [effectiveLogo]);

  const handleSave = useCallback(
    (newConfig: LayoutFooter) => {
      onFooterUpdate?.(newConfig);
    },
    [onFooterUpdate]
  );

  if (!config.enabled) return null;

  const footerContentProps = {
    config,
    effectiveLogo,
    effectiveLogoAlt,
    logoError,
    setLogoError,
    isEditing,
  };

  return (
    <>
      <footer
        className={cn(
          "border-t bg-muted/30 relative overflow-x-hidden",
          isEditing && "ring-2 ring-primary/20 ring-inset",
          className
        )}
        style={{ marginLeft: sidebarWidth }}
        role="contentinfo"
      >
        {isEditing && (
          <div className="absolute top-3 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={(e) => {
                e.preventDefault();
                setModalOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit Footer
            </Button>
          </div>
        )}

        <div className="mx-auto max-w-7xl min-w-0 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <FooterComprehensive {...footerContentProps} />

          {config.copyright && (
            <div className="mt-8 border-t border-border pt-6 sm:mt-12 sm:pt-8">
              <p className="text-muted-foreground text-center text-xs sm:text-sm">
                {config.copyright}
              </p>
            </div>
          )}
        </div>
      </footer>

      <FooterEditModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        config={config}
        onSave={handleSave}
      />
    </>
  );
}
