'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  value: string | number;
  label: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
}

export default function StatsCard({
  icon: Icon,
  iconColor,
  value,
  label,
  change,
  changeType = 'positive',
  subtitle,
}: StatsCardProps) {
  const changeStyles = {
    positive: 'text-success',
    negative: 'text-error',
    neutral: 'text-textSecondary',
  };

  // A metric as type on a hairline: small label over a large number. No tile.
  // iconBgColor stays in the props for compatibility but no longer paints a box.
  return (
    <div className='border-t border-border pt-3'>
      <div className='flex items-center justify-between gap-2'>
        <p className='flex items-center gap-1.5 text-xs font-medium text-textSecondary'>
          <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
          {label}
        </p>
        {change && (
          <span className={`text-xs font-medium ${changeStyles[changeType]}`}>
            {change}
          </span>
        )}
      </div>
      <div className='mt-1 text-[28px] font-semibold leading-tight tabular-nums tracking-tight text-textPrimary'>
        {value}
      </div>
      {subtitle && (
        <div className='mt-1 text-xs text-textSecondary'>{subtitle}</div>
      )}
    </div>
  );
}
