'use client';

import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Package,
  Search,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useGetActivityFeed } from '@/lib/api/hooks';
import type { ActivityKind } from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

const kindConfig: Record<
  ActivityKind,
  { icon: typeof Activity; bg: string; text: string; label: string }
> = {
  application: {
    icon: Layers,
    bg: 'bg-primary-100',
    text: 'text-primary',
    label: 'Application',
  },
  addon: {
    icon: Package,
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    label: 'Add-on',
  },
  usage: {
    icon: Zap,
    bg: 'bg-amber-100',
    text: 'text-warning',
    label: 'Usage',
  },
};

export default function ActivityFeedPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ActivityKind | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    data: feedData,
    isLoading,
    error,
  } = useGetActivityFeed({
    kind: kindFilter || undefined,
    search: debouncedSearch || undefined,
    page: currentPage,
    limit: itemsPerPage,
  });

  const entries = feedData?.data ?? [];
  const total = feedData?.total ?? 0;
  const totalPages = feedData?.totalPages ?? 1;

  // Loading state
  if (isLoading && !feedData) {
    return (
      <div className='p-8'>
        <div className='mb-8'>
          <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
            Activity Log
          </h1>
          <p className='text-textSecondary'>
            Track all system activities and changes across tenants
          </p>
        </div>
        <div className='animate-pulse space-y-4'>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className='flex items-start border-t border-border pt-6 pb-2'
            >
              <div className='h-10 w-10 rounded-lg bg-bgGray' />
              <div className='ml-4 flex-1 space-y-2'>
                <div className='h-4 w-3/4 rounded bg-bgGray' />
                <div className='h-3 w-1/2 rounded bg-bgGray' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load activity feed
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
        </div>
      </div>
    );
  }

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Activity Log
            </h1>
            <p className='text-textSecondary'>
              Track all system activities and changes across tenants
            </p>
          </div>
          <span className='text-sm font-semibold text-primary'>
            {total} events
          </span>
        </div>
      </section>

      {/* Filters */}
      <section className='mb-6 flex flex-wrap items-center gap-3'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
          <input
            type='text'
            placeholder='Search by tenant name...'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className='h-10 w-full rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => {
            setKindFilter((e.target.value as ActivityKind) || '');
            setCurrentPage(1);
          }}
          className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
        >
          <option value=''>All Types</option>
          <option value='application'>Application Events</option>
          <option value='addon'>Add-on Events</option>
          <option value='usage'>Usage Events</option>
        </select>
      </section>

      {/* Activity Timeline */}
      <section className='border-t border-border'>
        <div className='border-b border-border p-6'>
          <h2 className='text-lg font-semibold text-textPrimary'>
            Recent Activity
          </h2>
          <p className='text-sm text-textSecondary'>
            Application, add-on, and usage events across all tenants
          </p>
        </div>

        {entries.length === 0 ? (
          <div className='py-12 text-center'>
            <Activity className='mx-auto h-12 w-12 text-textSecondary' />
            <p className='mt-4 text-textSecondary'>No activity found</p>
          </div>
        ) : (
          <div className='divide-y divide-border'>
            {entries.map((entry) => {
              const config = kindConfig[entry.kind];
              const Icon = config.icon;

              return (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  className='flex items-start p-6 transition hover:bg-bgGray'
                >
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${config.text}`} />
                  </div>

                  {/* Content */}
                  <div className='ml-4 flex-1'>
                    <p className='text-sm text-textPrimary'>
                      {entry.description}
                    </p>
                    <div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-textSecondary'>
                      <Link
                        href={`/tenants/${entry.tenant_id}`}
                        className='font-medium text-primary hover:underline'
                      >
                        {entry.tenant_name}
                      </Link>
                      <span>&middot;</span>
                      <span>{formatTimeAgo(entry.created_at)}</span>
                      {entry.reason && (
                        <>
                          <span>&middot;</span>
                          <span
                            className='max-w-xs truncate'
                            title={entry.reason}
                          >
                            {entry.reason}
                          </span>
                        </>
                      )}
                      {entry.is_system && (
                        <span className='rounded bg-bgGray px-1.5 py-0.5 text-[10px] font-semibold uppercase text-textSecondary'>
                          System
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Kind badge */}
                  <div className='ml-4 flex flex-col items-end gap-1'>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}
                    >
                      {config.label}
                    </span>
                    <span className='text-[10px] font-medium text-textSecondary'>
                      {entry.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className='flex items-center justify-between border-t border-border p-6'>
          <div className='flex items-center space-x-4'>
            <span className='text-sm text-textSecondary'>
              Showing {total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
              &ndash;{Math.min(currentPage * itemsPerPage, total)} of {total}{' '}
              events
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className='h-9 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-primary focus:outline-none'
            >
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
          <div className='flex items-center space-x-2'>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
              aria-label='Previous page'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>
            <span className='px-3 text-sm text-textSecondary'>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
              aria-label='Next page'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
