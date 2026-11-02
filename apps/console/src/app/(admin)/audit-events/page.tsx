'use client';

import {
  AlertTriangle,
  Bot,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ListChecks,
  MapPin,
  Network,
  RotateCcw,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { useAuditLogs } from '@/lib/api/hooks';

const PAGE_SIZE = 25;

// Human-readable labels for audit action codes
const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  ADMIN_USER_CREATED: 'Admin User Created',
  ADMIN_USER_UPDATED: 'Admin User Updated',
  ADMIN_USER_DEACTIVATED: 'Admin User Deactivated',
  ADMIN_USER_REACTIVATED: 'Admin User Reactivated',
  ADMIN_USER_DELETED: 'Admin User Deleted',
  ADMIN_USER_ROLE_ASSIGNED: 'Role Assigned',
  ADMIN_USER_ROLE_REVOKED: 'Role Revoked',
  TENANT_CREATED: 'Tenant Created',
  TENANT_UPDATED: 'Tenant Updated',
  TENANT_SUSPENDED: 'Tenant Suspended',
  TENANT_REACTIVATED: 'Tenant Reactivated',
  TENANT_DELETED: 'Tenant Deleted',
  SUBSCRIPTION_ASSIGNED: 'Subscription Assigned',
  SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
  SUBSCRIPTION_UPGRADED: 'Subscription Upgraded',
  ADDON_GRANTED: 'Add-on Granted',
  ADDON_CANCELLED: 'Add-on Cancelled',
  APPLICATION_GRANTED: 'Application Granted',
  APPLICATION_SUSPENDED: 'Application Suspended',
  APPLICATION_REVOKED: 'Application Revoked',
  APPLICATION_REACTIVATED: 'Application Reactivated',
  ENTITLEMENT_OVERRIDDEN: 'Entitlement Overridden',
};

const CATEGORY_OPTIONS = [
  'ADMIN_USER',
  'ADMIN_ROLE',
  'ADMIN_PERMISSION',
  'AUTH',
  'TENANT',
  'SUBSCRIPTION',
  'ADDON',
  'APPLICATION',
  'ENTITLEMENT',
  'PLAN',
  'PRODUCT',
  'FEATURE',
  'BILLING_PROVIDER',
];

const actionLabel = (action: string) =>
  AUDIT_ACTION_LABELS[action] ??
  action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Map the date-range selector to an ISO `from` timestamp
const dateRangeToFrom = (range: string): string | undefined => {
  const now = Date.now();
  switch (range) {
    case 'last24':
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case 'last7':
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'last30':
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'last90':
      return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
};

export default function AuditEventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('last30');
  const [page, setPage] = useState(1);
  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);

  const { data, isLoading, error } = useAuditLogs({
    search: searchQuery || undefined,
    category: categoryFilter || undefined,
    action: actionFilter || undefined,
    from: dateRangeToFrom(dateFilter),
    page,
    limit: PAGE_SIZE,
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const toggleEventDetails = (eventId: string) => {
    setExpandedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId],
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setActionFilter('');
    setDateFilter('last30');
    setPage(1);
  };

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <h1 className='mb-2 text-3xl font-bold text-textPrimary'>Audit Logs</h1>
        <p className='text-textSecondary'>
          DB-backed trail of every Core Admin action
        </p>
      </section>

      {/* Filters Section */}
      <section className='mb-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='grid grid-cols-5 gap-4'>
            <div>
              <label className='mb-2 block text-sm font-medium text-textPrimary'>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none'
              >
                <option value=''>All Categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-textPrimary'>
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none'
              >
                <option value=''>All Actions</option>
                {Object.keys(AUDIT_ACTION_LABELS).map((a) => (
                  <option key={a} value={a}>
                    {AUDIT_ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-textPrimary'>
                Search
              </label>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Summary, actor, resource...'
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className='h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                />
              </div>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-textPrimary'>
                Date Range
              </label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none'
              >
                <option value='last24'>Last 24 hours</option>
                <option value='last7'>Last 7 days</option>
                <option value='last30'>Last 30 days</option>
                <option value='last90'>Last 90 days</option>
                <option value='all'>All time</option>
              </select>
            </div>

            <div className='flex items-end'>
              <button
                onClick={clearFilters}
                className='flex h-10 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-textSecondary hover:bg-bgGray'
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Clear
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Activity List */}
      <section className='mb-8'>
        <div className='border-t border-border'>
          <div className='border-b border-border p-6'>
            <h2 className='mb-1 text-xl font-semibold text-textPrimary'>
              Audit Events
            </h2>
            <p className='text-sm text-textSecondary'>
              {total.toLocaleString()} event{total === 1 ? '' : 's'}
            </p>
          </div>

          {isLoading ? (
            <div className='flex h-48 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent' />
            </div>
          ) : error ? (
            <div className='flex h-48 flex-col items-center justify-center text-center'>
              <AlertTriangle className='h-10 w-10 text-amber-500' />
              <p className='mt-3 text-textSecondary'>{error.message}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className='flex h-48 flex-col items-center justify-center text-center'>
              <ListChecks className='h-10 w-10 text-textSecondary' />
              <p className='mt-3 text-textSecondary'>No audit events found</p>
            </div>
          ) : (
            <div className='divide-y divide-border'>
              {entries.map((entry) => {
                const isExpanded = expandedEvents.includes(entry.id);
                const metaEntries = entry.metadata
                  ? Object.entries(entry.metadata)
                  : [];
                return (
                  <div
                    key={entry.id}
                    className='p-6 transition hover:bg-bgGray'
                  >
                    <div className='flex items-start'>
                      <div className='flex flex-shrink-0 items-center h-5 w-5'>
                        <ListChecks className='h-4 w-4 text-primary' />
                      </div>
                      <div className='ml-4 flex-1'>
                        <div className='mb-2 flex items-start justify-between'>
                          <div className='flex-1'>
                            <div className='mb-1 flex items-center space-x-2'>
                              <span className='font-semibold text-textPrimary'>
                                {actionLabel(entry.action)}
                              </span>
                              <span className='rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary'>
                                {entry.category.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className='text-sm text-textPrimary'>
                              {entry.summary}
                            </p>
                          </div>
                          <span className='ml-4 flex-shrink-0 text-xs text-textSecondary'>
                            {formatRelative(entry.created_at)}
                          </span>
                        </div>
                        <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-textSecondary'>
                          <div className='flex items-center'>
                            {entry.is_system ? (
                              <Bot className='mr-1.5 h-3 w-3' />
                            ) : (
                              <Users className='mr-1.5 h-3 w-3' />
                            )}
                            <span>
                              {entry.is_system
                                ? 'System'
                                : (entry.actor_name ??
                                  entry.actor_email ??
                                  'Unknown')}
                            </span>
                          </div>
                          {entry.resource_label && (
                            <div className='flex items-center'>
                              <Building2 className='mr-1.5 h-3 w-3' />
                              <span>{entry.resource_label}</span>
                            </div>
                          )}
                          {entry.ip_address && (
                            <div className='flex items-center'>
                              <Network className='mr-1.5 h-3 w-3' />
                              <span>{entry.ip_address}</span>
                            </div>
                          )}
                          {(entry.city || entry.country) && (
                            <div className='flex items-center'>
                              <MapPin className='mr-1.5 h-3 w-3' />
                              <span>
                                {[entry.city, entry.region, entry.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          {entry.device && (
                            <div className='flex items-center'>
                              <Smartphone className='mr-1.5 h-3 w-3' />
                              <span>
                                {[entry.device, entry.os, entry.browser]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className='mt-3 border-t border-border pt-3'>
                            <div className='grid grid-cols-2 gap-3 text-sm'>
                              {entry.actor_email && (
                                <div>
                                  <span className='text-textSecondary'>
                                    Actor email:
                                  </span>
                                  <span className='ml-2 text-textPrimary'>
                                    {entry.actor_email}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className='text-textSecondary'>
                                  Time:
                                </span>
                                <span className='ml-2 text-textPrimary'>
                                  {new Date(entry.created_at).toLocaleString()}
                                </span>
                              </div>
                              {entry.user_agent && (
                                <div className='col-span-2'>
                                  <span className='text-textSecondary'>
                                    User agent:
                                  </span>
                                  <span className='ml-2 font-mono text-xs text-textPrimary'>
                                    {entry.user_agent}
                                  </span>
                                </div>
                              )}
                              {metaEntries.map(([key, value]) => (
                                <div key={key} className='col-span-2'>
                                  <span className='text-textSecondary'>
                                    {key}:
                                  </span>
                                  <span className='ml-2 font-mono text-xs text-textPrimary'>
                                    {typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleEventDetails(entry.id)}
                        className='ml-4 flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-bgGray'
                        aria-label='Toggle details'
                      >
                        {isExpanded ? (
                          <ChevronUp className='h-4 w-4' />
                        ) : (
                          <ChevronDown className='h-4 w-4' />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && entries.length > 0 && (
            <div className='border-t border-border p-6'>
              <div className='flex items-center justify-between'>
                <div className='text-sm text-textSecondary'>
                  Showing {(page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, total)} of{' '}
                  {total.toLocaleString()} events
                </div>
                <div className='flex items-center space-x-2'>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
                    aria-label='Previous page'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </button>
                  <span className='px-2 text-sm text-textPrimary'>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
                    aria-label='Next page'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
