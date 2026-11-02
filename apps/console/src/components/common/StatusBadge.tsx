'use client';

type StatusType =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'suspended'
  | 'cancelled'
  | 'paid'
  | 'overdue'
  | 'trial'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

interface StatusBadgeProps {
  status: StatusType | string;
  showDot?: boolean;
}

// Flat status label: a coloured dot followed by the word. No filled chip.
const dotStyles: Record<string, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-gray-400',
  pending: 'bg-amber-500',
  suspended: 'bg-red-500',
  cancelled: 'bg-gray-400',
  paid: 'bg-emerald-500',
  overdue: 'bg-red-500',
  trial: 'bg-primary-500',
  trialing: 'bg-primary-500',
  past_due: 'bg-amber-500',
  expired: 'bg-gray-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-primary-500',
};

export default function StatusBadge({
  status,
  showDot = true,
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const dot = dotStyles[normalizedStatus] || 'bg-gray-400';
  const label = normalizedStatus.replace(/_/g, ' ');

  return (
    <span className='inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-textPrimary'>
      {showDot && (
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      )}
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}
