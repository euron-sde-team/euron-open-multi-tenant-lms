'use client';

import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';

type AlertVariant = 'success' | 'error' | 'warning' | 'default';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: AlertVariant;
}

const variantConfig: Record<
  AlertVariant,
  {
    icon: typeof AlertTriangle;
    iconBg: string;
    iconColor: string;
    buttonBg: string;
    buttonHover: string;
  }
> = {
  error: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-error',
    buttonBg: 'bg-error',
    buttonHover: 'hover:bg-red-600',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-warning',
    buttonBg: 'bg-warning',
    buttonHover: 'hover:bg-amber-600',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-success',
    buttonBg: 'bg-success',
    buttonHover: 'hover:bg-green-600',
  },
  default: {
    icon: Info,
    iconBg: 'bg-primary-100',
    iconColor: 'text-primarySolid',
    buttonBg: 'bg-primarySolid',
    buttonHover: 'hover:bg-primaryHover',
  },
};

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK',
  variant = 'default',
}: AlertModalProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
      aria-labelledby='alert-modal-title'
    >
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 transition-opacity'
        onClick={handleBackdropClick}
        aria-hidden='true'
      />

      {/* Modal */}
      <div className='relative z-10 w-full max-w-md transform rounded-xl bg-surface p-6 shadow-xl transition-all animate-in fade-in zoom-in-95 duration-200'>
        {/* Close button */}
        <button
          onClick={onClose}
          className='absolute right-4 top-4 rounded-lg p-1 text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'
          aria-label='Close modal'
        >
          <X className='h-5 w-5' />
        </button>

        {/* Content */}
        <div className='flex flex-col items-center text-center'>
          {/* Icon */}
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full',
              config.iconBg,
            )}
          >
            <Icon className={cn('h-7 w-7', config.iconColor)} />
          </div>

          {/* Title */}
          <h3
            id='alert-modal-title'
            className='mt-4 text-lg font-semibold text-textPrimary'
          >
            {title}
          </h3>

          {/* Message */}
          <p className='mt-2 text-sm text-textSecondary'>{message}</p>

          {/* Action */}
          <div className='mt-6 w-full'>
            <button
              onClick={onClose}
              className={cn(
                'w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition',
                config.buttonBg,
                config.buttonHover,
              )}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
