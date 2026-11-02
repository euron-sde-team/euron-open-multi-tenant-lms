'use client';

import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  Grid3x3,
  Layers,
  LayoutDashboard,
  Package,
  Puzzle,
  Shield,
  UserCog,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useState } from 'react';

import { UserContext } from '@/context/UserContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  /**
   * If set, the item is shown to a non-privileged user only when they hold
   * this permission. Privileged users (SUPERADMIN/ADMIN) always see it.
   */
  requiredPermission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/activity-feed', label: 'Activity Feed', icon: Activity },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        href: '/applications',
        label: 'Applications',
        icon: Grid3x3,
        requiredPermission: 'applications.view',
      },
      {
        href: '/features',
        label: 'Features',
        icon: Puzzle,
        requiredPermission: 'features.view',
      },
      {
        href: '/products',
        label: 'Products',
        icon: Package,
        requiredPermission: 'applications.view',
      },
    ],
  },
  {
    title: 'Catalog',
    items: [
      {
        href: '/plans',
        label: 'Plans',
        icon: FileText,
        requiredPermission: 'plans.view',
      },
      {
        href: '/plan-versions',
        label: 'Plan Versions',
        icon: Layers,
        requiredPermission: 'plans.view',
      },
      {
        href: '/add-ons',
        label: 'Add-ons',
        icon: Gift,
        requiredPermission: 'addons.view',
      },
    ],
  },
  {
    title: 'Tenants',
    items: [
      {
        href: '/tenants',
        label: 'All Tenants',
        icon: Building2,
        requiredPermission: 'tenants.view',
      },
      {
        href: '/tenants/analytics',
        label: 'Tenant Analytics',
        icon: BarChart3,
        requiredPermission: 'tenants.view',
      },
      {
        href: '/members',
        label: 'Tenant Staff Members',
        icon: UserPlus,
        requiredPermission: 'tenant_users.view',
      },
      {
        href: '/tenant-roles',
        label: 'Tenant Role Management',
        icon: Shield,
        requiredPermission: 'tenant_users.manage',
      },
    ],
  },
  {
    title: 'Billing',
    items: [
      {
        href: '/subscriptions',
        label: 'Subscriptions',
        icon: CreditCard,
        requiredPermission: 'subscriptions.view',
      },
      {
        href: '/providers',
        label: 'Providers',
        icon: CreditCard,
        requiredPermission: 'billing.view',
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        href: '/admin-users',
        label: 'Admin Users',
        icon: UserCog,
        requiredPermission: 'admin_users.view',
      },
      {
        href: '/roles-permissions',
        label: 'Roles & Permissions',
        icon: Shield,
        requiredPermission: 'admin_roles.view',
      },
      {
        href: '/audit-events',
        label: 'Audit Logs',
        icon: ClipboardList,
        requiredPermission: 'system.view_logs',
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { hasRole, hasPermission } = useContext(UserContext);
  // SUPERADMIN/ADMIN see everything. Any other (scoped) user sees only the
  // items they explicitly hold a permission for.
  const privileged = hasRole('SUPERADMIN') || hasRole('ADMIN');
  const canShow = (item: NavItem): boolean => {
    if (privileged) return true;
    return item.requiredPermission
      ? hasPermission(item.requiredPermission)
      : false;
  };
  const visibleSections = navSections
    .map((s) => ({
      ...s,
      items: s.items.filter(canShow),
    }))
    .filter((s) => s.items.length > 0);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(navSections.map((s) => s.title)),
  );

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className='fixed bottom-0 left-0 top-16 z-40 hidden w-60 overflow-y-auto border-r border-border bg-surface lg:block'>
      <nav className='py-6'>
        {visibleSections.map((section) => {
          const isExpanded = expandedSections.has(section.title);

          return (
            <div key={section.title} className='mb-6 px-4'>
              <button
                onClick={() => toggleSection(section.title)}
                className='mb-3 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-textSecondary'
              >
                <span>{section.title}</span>
                {isExpanded ? (
                  <ChevronDown className='h-3 w-3' />
                ) : (
                  <ChevronRight className='h-3 w-3' />
                )}
              </button>

              {isExpanded && (
                <div className='space-y-1'>
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? 'bg-primary-50 font-medium text-primary'
                            : 'text-textPrimary hover:bg-bgGray'
                        }`}
                      >
                        <Icon className='h-5 w-5' />
                        <span className='ml-3 flex-1'>{item.label}</span>
                        {item.badge ? (
                          <span
                            className='ml-auto text-xs font-semibold text-textSecondary'
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
