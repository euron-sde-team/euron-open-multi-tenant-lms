"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@open-mtlms/core";
import {
  Building2,
  CreditCard,
  ExternalLink,
  Globe,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickLink {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const QUICK_LINKS: QuickLink[] = [
  {
    id: "organisation",
    label: "Organisation details",
    description: "Logo, contact info, social links",
    href: "/dashboard/settings/organisation",
    icon: Building2,
  },
  {
    id: "domains",
    label: "Domains",
    description: "Connect a custom domain",
    href: "/dashboard/settings/domains",
    icon: Globe,
  },
  {
    id: "authentication",
    label: "Authentication",
    description: "Login methods & SSO",
    href: "/dashboard/settings/authentication",
    icon: ShieldCheck,
  },
  {
    id: "admins",
    label: "Admins",
    description: "Invite & manage your team",
    href: "/dashboard/team",
    icon: UserCog,
  },
  {
    id: "plans",
    label: "Plans",
    description: "Upgrade or change your plan",
    href: "/dashboard/plans",
    icon: Sparkles,
  },
  {
    id: "payments",
    label: "Payments",
    description: "Connect a payment gateway",
    href: "/dashboard/payment",
    icon: CreditCard,
  },
];

/**
 * Dashboard quick-access grid. Every link opens in a NEW tab so a tenant
 * jumping into Plans / Settings / Domains keeps the dashboard open in the
 * background, they can flip back without losing scroll position or having
 * to re-navigate after a config change.
 */
export function QuickAccessCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick access</CardTitle>
        <CardDescription>
          Jump to common settings, opens in a new tab
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <QuickLinkTile key={link.id} link={link} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinkTile({ link }: { link: QuickLink }) {
  const Icon = link.icon;
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-3 border-t border-border/60 py-3 transition-colors",
      )}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:text-primary">
          <span className="truncate">{link.label}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {link.description}
        </div>
      </div>
    </a>
  );
}
