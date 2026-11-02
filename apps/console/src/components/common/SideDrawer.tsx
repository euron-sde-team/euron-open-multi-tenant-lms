'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const widthConfig = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

export default function SideDrawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  width = 'md',
}: SideDrawerProps) {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex justify-end'
      role='dialog'
      aria-modal='true'
      aria-labelledby='drawer-title'
    >
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 transition-opacity backdrop-blur-sm'
        onClick={handleBackdropClick}
        aria-hidden='true'
      />

      {/* Drawer */}
      <div
        className={cn(
          'relative z-10 h-full w-full bg-surface shadow-2xl transition-transform duration-300 ease-in-out',
          widthConfig[width],
          // Animation classes could be added here if using tailwind-animate
          'animate-in slide-in-from-right duration-300',
        )}
      >
        <div className='flex h-full flex-col'>
          {/* Header */}
          <div className='flex items-start justify-between border-b border-border px-6 py-4'>
            <div>
              <h2
                id='drawer-title'
                className='text-lg font-semibold text-textPrimary'
              >
                {title}
              </h2>
              {description && (
                <p className='mt-1 text-sm text-textSecondary'>{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className='rounded-lg p-2 text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'
              aria-label='Close drawer'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          {/* Content */}
          <div className='flex-1 overflow-y-auto p-6'>{children}</div>
        </div>
      </div>
    </div>
  );
}
