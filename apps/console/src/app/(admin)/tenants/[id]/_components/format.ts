/** Format a byte count into a human-readable size string. */
export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

/** Format a money amount with a currency symbol (INR / USD aware). */
export const formatMoney = (
  amount: number | null | undefined,
  currency = 'INR',
): string => {
  if (amount === null || amount === undefined) return '-';
  const symbol = currency === 'USD' ? '$' : '₹';
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

/** Format an ISO date string as a short local date. */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString();
};

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'bg-green-50 text-success',
  ACTIVE: 'bg-green-50 text-success',
  PAID: 'bg-green-50 text-success',
  DRAFT: 'bg-gray-100 text-textSecondary',
  ARCHIVED: 'bg-gray-100 text-textSecondary',
  SUSPENDED: 'bg-amber-50 text-warning',
  PAYMENT_PENDING: 'bg-amber-50 text-warning',
  CREATED: 'bg-primary-50 text-primary',
  FAILED: 'bg-red-50 text-error',
  EXPIRED: 'bg-red-50 text-error',
  REFUNDED: 'bg-red-50 text-error',
  PARTIALLY_REFUNDED: 'bg-red-50 text-error',
  REFUND_INITIATED: 'bg-amber-50 text-warning',
};

export const statusBadgeClass = (status: string): string =>
  STATUS_STYLES[status?.toUpperCase()] ?? 'bg-gray-100 text-textSecondary';
