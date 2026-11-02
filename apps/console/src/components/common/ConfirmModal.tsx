'use client';

import {
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';

type ModalVariant = 'danger' | 'warning' | 'success' | 'default';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
  isLoading?: boolean;
}

const variantConfig: Record<
  ModalVariant,
  {
    icon: typeof AlertTriangle;
    iconBg: string;
    iconColor: string;
    confirmBg: string;
    confirmHover: string;
  }
> = {
  danger: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-error',
    confirmBg: 'bg-error',
    confirmHover: 'hover:bg-red-600',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-warning',
    confirmBg: 'bg-warning',
    confirmHover: 'hover:bg-amber-600',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-success',
    confirmBg: 'bg-success',
    confirmHover: 'hover:bg-green-600',
  },
  default: {
    icon: Info,
    iconBg: 'bg-primary-100',
    iconColor: 'text-primarySolid',
    confirmBg: 'bg-primarySolid',
    confirmHover: 'hover:bg-primaryHover',
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
      aria-labelledby='modal-title'
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
          disabled={isLoading}
          className='absolute right-4 top-4 rounded-lg p-1 text-textSecondary transition hover:bg-bgGray hover:text-textPrimary disabled:opacity-50'
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
            id='modal-title'
            className='mt-4 text-lg font-semibold text-textPrimary'
          >
            {title}
          </h3>

          {/* Message */}
          <p className='mt-2 text-sm text-textSecondary'>{message}</p>

          {/* Actions */}
          <div className='mt-6 flex w-full gap-3'>
            <button
              onClick={onClose}
              disabled={isLoading}
              className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray disabled:opacity-50'
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                'flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50',
                config.confirmBg,
                config.confirmHover,
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
