"use client";

import { Award, Building2, Coins, CreditCard, Globe, GraduationCap, KeyRound, ListOrdered, Package, PanelLeft, Receipt, ScrollText, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * Each card declares the permission(s) that make it usable. A card renders only
 * if the viewer holds ANY of them (owner/admin bypass via hasFullAccess). This
 * stops a restricted staffer from seeing a grid of admin surfaces they can't use.
 */
type AdminCard = {
  title: string;
  description: string;
  icon: typeof Building2;
  href: string;
  color: string;
  permissions: string[];
};

/**
 * Cards are grouped into logical sections so related settings sit together and
 * the page reads top-to-bottom instead of as one long undifferentiated grid.
 * A group renders only when the viewer can see at least one of its cards.
 */
const groups: { title: string; subtitle: string; cards: AdminCard[] }[] = [
  {
    title: "Organization",
    subtitle: "Your org profile, people, and audit trail.",
    cards: [
      {
        title: "Organisation",
        description: "Name, logo, branding, contact info, and social links.",
        icon: Building2,
        href: "/dashboard/settings/organisation",
        color: "bg-blue-50 text-blue-600",
        permissions: ["settings.organization"],
      },
      {
        title: "Team",
        description: "Staff members, roles, permissions, and invitations.",
        icon: Users,
        href: "/dashboard/team",
        color: "bg-indigo-50 text-indigo-600",
        permissions: ["roles.view", "staff.view"],
      },
      {
        // Sits next to Team on purpose: same audience, same question, who has
        // access, and what did they do with it.
        title: "Activity Log",
        description: "Who did what and when, including blocked attempts.",
        icon: ScrollText,
        href: "/dashboard/activity",
        color: "bg-slate-100 text-slate-600",
        permissions: ["audit.view"],
      },
    ],
  },
  {
    title: "Site & Domains",
    subtitle: "Your website address, sign in, and menus.",
    cards: [
      {
        title: "Domains",
        description: "Custom domains, SSL, and DNS configuration.",
        icon: Globe,
        href: "/dashboard/settings/domains",
        color: "bg-emerald-50 text-emerald-600",
        permissions: ["settings.domains"],
      },
      {
        title: "Authentication",
        description: "Login methods, OAuth providers, and SSO setup.",
        icon: KeyRound,
        href: "/dashboard/settings/authentication",
        color: "bg-rose-50 text-rose-600",
        permissions: ["settings.auth"],
      },
      {
        title: "Navigation",
        description: "Sidebar items, custom links, and ordering.",
        icon: PanelLeft,
        href: "/dashboard/settings/navigation",
        color: "bg-cyan-50 text-cyan-600",
        permissions: ["settings.navigation"],
      },
    ],
  },
  {
    title: "Billing & Payments",
    subtitle: "Plans, gateways, taxes, and currencies.",
    cards: [
      {
        title: "Plans",
        description: "Subscription plans, pricing, and features.",
        icon: Package,
        href: "/dashboard/plans",
        color: "bg-purple-50 text-purple-600",
        permissions: ["billing.manage"],
      },
      {
        title: "Payments",
        description: "Payment gateways and credentials.",
        icon: CreditCard,
        href: "/dashboard/payment",
        color: "bg-amber-50 text-amber-600",
        permissions: ["gateway.configure"],
      },
      {
        title: "Billing & Tax",
        description: "Tax configuration, invoices, and billing details.",
        icon: Receipt,
        href: "/dashboard/settings/billing",
        color: "bg-orange-50 text-orange-600",
        permissions: ["settings.organization"],
      },
      {
        title: "Currencies",
        description: "Selling currencies, country mapping, and default currency.",
        icon: Coins,
        href: "/dashboard/settings/currencies",
        color: "bg-teal-50 text-teal-600",
        permissions: ["settings.currencies"],
      },
    ],
  },
  {
    title: "Learner Experience",
    subtitle: "What learners can see, access, and earn.",
    cards: [
      {
        title: "Storefront access",
        description: "Access managed mode: hide pricing and show only content admins assign.",
        icon: ShieldCheck,
        href: "/dashboard/settings/storefront",
        color: "bg-violet-50 text-violet-600",
        permissions: ["settings.organization"],
      },
      {
        title: "Course access",
        description: "Show only enrolled courses and hide the public catalog from learners.",
        icon: GraduationCap,
        href: "/dashboard/settings/course-access",
        color: "bg-blue-50 text-blue-600",
        permissions: ["settings.organization"],
      },
      {
        title: "Course progression",
        description: "Sequential courses: make learners finish one before the next.",
        icon: ListOrdered,
        href: "/dashboard/settings/courses",
        color: "bg-violet-50 text-violet-600",
        permissions: ["settings.organization", "courses.update"],
      },
      {
        title: "Certificates",
        description: "Certificate design and learner certificate access.",
        icon: Award,
        href: "/dashboard/settings/certificates",
        color: "bg-green-50 text-green-600",
        permissions: ["certificates.manage", "settings.organization"],
      },
    ],
  },
];

export default function SettingsAdminPage() {
  const router = useRouter();
  const { isOwner, roles, permissions } = useAuthStore();

  // Owner and the `admin` role see everything; otherwise a card shows only if
  // the viewer holds at least one of its permissions.
  const hasFullAccess = isOwner || roles.includes("admin");
  const permSet = new Set(permissions);
  const canSee = (card: AdminCard) =>
    hasFullAccess || card.permissions.some((p) => permSet.has(p));

  // Drop cards the viewer can't use, then drop any group left empty.
  const visibleGroups = groups
    .map((group) => ({ ...group, cards: group.cards.filter(canSee) }))
    .filter((group) => group.cards.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings &amp; Administration</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your organization settings and configuration.
        </p>
      </div>

      <div className="space-y-10">
        {visibleGroups.map((group) => (
          <section key={group.title}>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h2>
              <p className="text-muted-foreground/80 mt-0.5 text-xs">{group.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => router.push(card.href)}
                    className="border-border hover:border-primary/30 flex items-start gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:bg-zinc-900"
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${card.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{card.title}</h3>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
