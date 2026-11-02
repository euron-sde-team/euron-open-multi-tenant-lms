'use client';

import { FileText, Grid3x3, LayoutDashboard, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/applications', icon: Grid3x3, label: 'Applications' },
  { href: '/plans', icon: FileText, label: 'Plans' },
  { href: '/tenants', icon: Users, label: 'Tenants' },
  { href: '/admin-users', icon: UserCog, label: 'Admins' },
];

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className='fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm lg:hidden'>
      <div className='flex items-center justify-around px-2 py-2'>
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className='group flex flex-1 flex-col items-center py-2'
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  active ? 'bg-primary-100' : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`text-lg transition-colors ${
                    active
                      ? 'text-primary-600'
                      : 'text-gray-500 group-hover:text-gray-700'
                  }`}
                />
              </div>
              <span
                className={`mt-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary-600' : 'text-gray-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
