'use client';

import {
  Activity,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Moon,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useGetTenantAnalytics } from '@/lib/api/hooks/useTenantAnalytics';
import {
  type TenantActivityStatus,
  type TenantAnalyticsFilters,
  downloadTenantAnalyticsXlsx,
} from '@/lib/api/tenantAnalytics';
import { useDebounce } from '@/hooks/useDebounce';

import PageHeader from '@/components/common/PageHeader';
import StatsCard from '@/components/common/StatsCard';

const PER_PAGE = 25;

const STATUS_BADGE: Record<
  TenantActivityStatus,
  { bg: string; text: string; label: string }
> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Active' },
  dormant: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Dormant' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
};

const STATUS_OPTIONS: { value: TenantActivityStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS: {
  value: NonNullable<TenantAnalyticsFilters['sort']>;
  label: string;
}[] = [
  { value: 'recent_activity', label: 'Recent activity' },
  { value: 'courses', label: 'Most courses' },
  { value: 'members', label: 'Most members' },
  { value: 'created', label: 'Newest' },
  { value: 'name', label: 'Name' },
];

export default function TenantAnalyticsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantActivityStatus | ''>('');
  const [sort, setSort] =
    useState<NonNullable<TenantAnalyticsFilters['sort']>>('recent_activity');
  const [page, setPage] = useState(1);
  const [planCode, setPlanCode] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const filters = {
    search: debouncedSearch || undefined,
    status: status || undefined,
    sort,
    planCode: planCode || undefined,
  };

  const { data, isLoading, isFetching, error } = useGetTenantAnalytics({
    page,
    limit: PER_PAGE,
    ...filters,
  });

  const rows = data?.data ?? [];
  const o = data?.overview;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadTenantAnalyticsXlsx(filters);
    } catch {
      /* ignore */
    } finally {
      setIsExporting(false);
    }
  };

  const fmt = (iso: string | null) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        dateStyle: 'medium',
      });
    } catch {
      return iso;
    }
  };

  if (error) {
    return (
      <div className='p-8'>
        <PageHeader
          title='Tenant Analytics'
          description='Tenant activity & usage'
        />
        <p className='mt-6 text-error'>Failed to load: {error.message}</p>
      </div>
    );
  }

  return (
    <div className='p-8'>
      <PageHeader
        title='Tenant Analytics'
        description='Understand which tenants are active, dormant, or inactive, and drill into their usage to drive business actions.'
        actions={[
          {
            label: isExporting ? 'Exporting…' : 'Export report',
            icon: FileSpreadsheet,
            variant: 'secondary',
            onClick: handleExport,
          },
        ]}
      />

      {/* Stat cards */}
      <section className='mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6'>
        <StatsCard
          icon={Building2}
          iconBgColor='bg-primary-50'
          iconColor='text-primary-600'
          value={o?.totalTenants ?? '-'}
          label='Total Tenants'
        />
        <StatsCard
          icon={CheckCircle2}
          iconBgColor='bg-green-50'
          iconColor='text-green-600'
          value={o?.activeTenants ?? '-'}
          label={`Active (≤${o?.inactiveDays ?? 30}d)`}
        />
        <StatsCard
          icon={Moon}
          iconBgColor='bg-amber-50'
          iconColor='text-amber-600'
          value={o?.dormantTenants ?? '-'}
          label='Dormant'
        />
        <StatsCard
          icon={XCircle}
          iconBgColor='bg-gray-100'
          iconColor='text-gray-500'
          value={o?.inactiveTenants ?? '-'}
          label='Inactive'
        />
        <StatsCard
          icon={CreditCard}
          iconBgColor='bg-purple-50'
          iconColor='text-purple-600'
          value={o?.activeSubscriptions ?? '-'}
          label='Active Subscriptions'
        />
        <StatsCard
          icon={Users}
          iconBgColor='bg-rose-50'
          iconColor='text-rose-600'
          value={o?.totalMembers ?? '-'}
          label='Total Members'
        />
      </section>

      {/* Trend + recent activity */}
      <section className='mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <div className='lg:col-span-2 border-t border-border pt-5 pb-2'>
          <h2 className='mb-4 text-sm font-semibold text-textPrimary'>
            Tenant signups (by month)
          </h2>
          <div className='h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={o?.signupsByMonth ?? []}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis dataKey='month' tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey='count' fill='#6366f1' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className='border-t border-border pt-5 pb-2'>
          <h2 className='mb-4 flex items-center gap-2 text-sm font-semibold text-textPrimary'>
            <Activity className='h-4 w-4' /> Recent activity
          </h2>
          <ul className='space-y-3'>
            {(o?.recentActivity ?? []).slice(0, 8).map((a, i) => (
              <li key={i} className='text-sm'>
                <span className='font-medium text-textPrimary'>
                  {a.tenantName}
                </span>
                <span className='text-textSecondary'>, {a.detail}</span>
                <span className='block text-xs text-textSecondary'>
                  {fmt(a.at)}
                </span>
              </li>
            ))}
            {(!o || o.recentActivity.length === 0) && (
              <li className='text-sm text-textSecondary'>No recent activity</li>
            )}
          </ul>
        </div>
      </section>

      {/* Filters */}
      <section className='mb-4 flex flex-wrap items-end gap-3'>
        <div className='relative max-w-md flex-1'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
          <input
            type='text'
            placeholder='Search tenants by name or slug…'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className='h-10 w-full rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TenantActivityStatus | '');
            setPage(1);
          }}
          className='h-10 rounded-lg border border-border bg-bgGray px-3 text-sm'
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(
              e.target.value as NonNullable<TenantAnalyticsFilters['sort']>,
            );
            setPage(1);
          }}
          className='h-10 rounded-lg border border-border bg-bgGray px-3 text-sm'
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          type='text'
          placeholder='Plan (e.g. free, growth, scale)'
          value={planCode}
          onChange={(e) => {
            setPlanCode(e.target.value);
            setPage(1);
          }}
          className='h-10 w-48 rounded-lg border border-border bg-bgGray px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
        />
        {(isFetching || isLoading) && (
          <span className='text-sm text-textSecondary'>Updating…</span>
        )}
      </section>

      {/* Report table */}
      <section className='overflow-hidden border-t border-border'>
        <div className='border-b border-border px-6 py-4'>
          <h2 className='text-lg font-semibold text-textPrimary'>
            Tenant report{' '}
            <span className='text-sm font-normal text-textSecondary'>
              ({total.toLocaleString()} tenants)
            </span>
          </h2>
        </div>
        <div
          className={`overflow-x-auto ${isFetching && rows.length > 0 ? 'opacity-70' : ''}`}
        >
          <table className='w-full min-w-[1280px]'>
            <thead>
              <tr className='border-b border-border bg-bgGray text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                <th className='px-6 py-3'>Tenant</th>
                <th className='px-6 py-3'>Contact</th>
                <th className='px-6 py-3'>Platform URL</th>
                <th className='px-6 py-3'>Custom URL</th>
                <th className='px-6 py-3'>Status</th>
                <th className='px-6 py-3'>Plan</th>
                <th className='px-6 py-3'>Members</th>
                <th className='px-6 py-3'>Courses</th>
                <th className='px-6 py-3'>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className='py-16 text-center text-textSecondary'
                  >
                    {isLoading ? 'Loading…' : 'No tenants match your filters'}
                  </td>
                </tr>
              ) : (
                rows.map((t) => {
                  const badge = STATUS_BADGE[t.activityStatus];
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/tenants/analytics/${t.id}`)}
                      className='cursor-pointer border-b border-border last:border-0 hover:bg-bgGray'
                    >
                      <td className='px-6 py-4'>
                        <div className='font-semibold text-textPrimary'>
                          {t.name}
                        </div>
                        <div className='text-xs text-textSecondary'>
                          {t.slug}
                        </div>
                      </td>
                      <td className='px-6 py-4 text-sm'>
                        <div className='text-textPrimary'>
                          {t.ownerEmail ?? '-'}
                        </div>
                        <div className='text-xs text-textSecondary'>
                          {t.ownerPhone ?? '-'}
                        </div>
                      </td>
                      <td className='px-6 py-4 text-sm'>
                        <a
                          href={t.platformUrl}
                          target='_blank'
                          rel='noreferrer'
                          onClick={(e) => e.stopPropagation()}
                          className='text-primarySolid hover:underline'
                        >
                          {t.platformUrl.replace(/^https?:\/\//, '')}
                        </a>
                      </td>
                      <td className='px-6 py-4 text-sm'>
                        {t.customUrl ? (
                          <a
                            href={t.customUrl}
                            target='_blank'
                            rel='noreferrer'
                            onClick={(e) => e.stopPropagation()}
                            className='text-primarySolid hover:underline'
                          >
                            {t.customUrl.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className='text-textSecondary'>-</span>
                        )}
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className='px-6 py-4 text-sm text-textSecondary'>
                        {t.plan ?? '-'}
                      </td>
                      <td className='px-6 py-4 text-sm text-textPrimary'>
                        {t.memberCount.toLocaleString()}
                      </td>
                      <td className='px-6 py-4 text-sm text-textPrimary'>
                        {t.courseCount.toLocaleString()}
                      </td>
                      <td className='px-6 py-4 text-sm text-textSecondary'>
                        {fmt(t.lastActivityAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className='flex items-center justify-between border-t border-border px-6 py-4 text-sm'>
            <span className='text-textSecondary'>
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <div className='flex gap-2'>
              <button
                type='button'
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className='rounded-lg border border-border px-3 py-2 font-medium text-textPrimary hover:bg-bgGray disabled:opacity-40'
              >
                Previous
              </button>
              <button
                type='button'
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className='rounded-lg border border-border px-3 py-2 font-medium text-textPrimary hover:bg-bgGray disabled:opacity-40'
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
