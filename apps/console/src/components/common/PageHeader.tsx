'use client';

import { ChevronRight, LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface ActionButton {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ActionButton[];
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <section className='mb-8'>
      <div className='flex items-center justify-between'>
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className='mb-2 flex items-center space-x-3'>
              {breadcrumbs.map((crumb, index) => (
                <span key={index} className='flex items-center'>
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className='text-sm text-textSecondary hover:text-primary'
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className='text-sm font-semibold text-textPrimary'>
                      {crumb.label}
                    </span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <ChevronRight className='ml-3 h-3 w-3 text-textSecondary' />
                  )}
                </span>
              ))}
            </div>
          )}
          <h1 className='mb-2 text-3xl font-bold text-textPrimary'>{title}</h1>
          {description && <p className='text-textSecondary'>{description}</p>}
        </div>
        {actions && actions.length > 0 && (
          <div className='flex items-center space-x-3'>
            {actions.map((action, index) => {
              const Icon = action.icon;
              const buttonClasses =
                action.variant === 'primary'
                  ? 'flex h-10 items-center px-5 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm transition'
                  : 'flex h-10 items-center px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition';

              if (action.href) {
                return (
                  <Link
                    key={index}
                    href={action.href}
                    className={buttonClasses}
                  >
                    {Icon && <Icon className='mr-2 h-4 w-4' />}
                    {action.label}
                  </Link>
                );
              }

              return (
                <button
                  key={index}
                  type='button'
                  disabled={action.disabled}
                  onClick={action.onClick}
                  className={`${buttonClasses} disabled:pointer-events-none disabled:opacity-50`}
                >
                  {Icon && <Icon className='mr-2 h-4 w-4' />}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
