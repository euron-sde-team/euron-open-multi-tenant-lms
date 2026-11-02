'use client';

import {
  AlertTriangle,
  Building2,
  CreditCard,
  Grid3x3,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useGetDashboardStats } from '@/lib/api/hooks';

import StatusBadge from '@/components/common/StatusBadge';

const SUB_STATUSES = [
  'ALL',
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
];

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useGetDashboardStats();
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');

  // Loading state
  if (isLoading) {
    return (
      <div className='min-h-screen bg-surface p-8'>
        <section className='mb-8'>
          <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
            Dashboard Overview
          </h1>
          <p className='text-textSecondary'>
            Monitor your platform performance and key metrics
          </p>
        </section>
        <div className='grid grid-cols-3 gap-6 mb-8'>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className='animate-pulse border-t border-border pt-6 pb-2'
            >
              <div className='mb-4 h-12 w-12 rounded-lg bg-bgGray' />
              <div className='mb-2 h-8 w-20 rounded bg-bgGray' />
              <div className='h-4 w-28 rounded bg-bgGray' />
            </div>
          ))}
        </div>
        <div className='grid grid-cols-3 gap-6 mb-8'>
          <div className='col-span-2 animate-pulse border-t border-border pt-6 pb-2'>
            <div className='mb-4 h-6 w-48 rounded bg-bgGray' />
            <div className='space-y-4'>
              {[...Array(4)].map((_, i) => (
                <div key={i} className='h-10 rounded bg-bgGray' />
              ))}
            </div>
          </div>
          <div className='animate-pulse border-t border-border pt-6 pb-2'>
            <div className='mb-4 h-6 w-32 rounded bg-bgGray' />
            <div className='space-y-4'>
              {[...Array(4)].map((_, i) => (
                <div key={i} className='h-8 rounded bg-bgGray' />
              ))}
            </div>
          </div>
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
            Failed to load dashboard
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Pivot the { plan_name, status, count } rows into a per-plan distribution,
  // filtered by the selected subscription status.
  const distRows =
    subStatusFilter === 'ALL'
      ? stats.plan_distribution
      : stats.plan_distribution.filter((p) => p.status === subStatusFilter);
  const planMap = new Map<string, number>();
  for (const r of distRows) {
    planMap.set(r.plan_name, (planMap.get(r.plan_name) ?? 0) + r.count);
  }
  const planDistribution = Array.from(planMap.entries())
    .map(([plan_name, count]) => ({ plan_name, count }))
    .sort((a, b) => b.count - a.count);
  const totalSubsInView =
    planDistribution.reduce((acc, p) => acc + p.count, 0) || 1;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };


  return (
    <div className='min-h-screen bg-surface p-8'>
      {/* Header */}
      <section className='mb-8'>
        <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
          Dashboard Overview
        </h1>
        <p className='text-textSecondary'>
          Monitor your platform performance and key metrics
        </p>
      </section>

      {/* Key Metrics Cards */}
      <section className='mb-8'>
        <div className='grid grid-cols-3 gap-6'>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-2 flex items-center justify-between'>
              <div className='flex h-5 w-5 items-center'>
                <Building2 className='h-5 w-5 text-primary' />
              </div>
            </div>
            <div className='mb-1 text-[28px] font-semibold leading-tight tabular-nums tracking-tight text-textPrimary'>
              {stats.tenants.total}
            </div>
            <div className='text-sm text-textSecondary'>Total Tenants</div>
            <div className='mt-1 text-xs text-textSecondary'>
              {stats.tenants.active} active, {stats.tenants.suspended} suspended
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-2 flex items-center justify-between'>
              <div className='flex h-5 w-5 items-center'>
                <CreditCard className='h-5 w-5 text-success' />
              </div>
            </div>
            <div className='mb-1 text-[28px] font-semibold leading-tight tabular-nums tracking-tight text-textPrimary'>
              {stats.subscriptions.active + stats.subscriptions.trialing}
            </div>
            <div className='text-sm text-textSecondary'>
              Active Subscriptions
            </div>
            <div className='mt-1 text-xs text-textSecondary'>
              {stats.subscriptions.trialing} trialing,{' '}
              {stats.subscriptions.total} total
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-2 flex items-center justify-between'>
              <div className='flex h-5 w-5 items-center'>
                <Grid3x3 className='h-5 w-5 text-warning' />
              </div>
            </div>
            <div className='mb-1 text-[28px] font-semibold leading-tight tabular-nums tracking-tight text-textPrimary'>
              {stats.applications.total}
            </div>
            <div className='text-sm text-textSecondary'>Applications</div>
            <div className='mt-1 text-xs text-textSecondary'>
              {stats.applications.active_assignments} active tenant assignments
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Distribution + Tenant Status */}
      <div className='mb-8 grid grid-cols-3 gap-6'>
        {/* Subscription Distribution by Plan */}
        <section className='col-span-2'>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Subscription Distribution
              </h2>
              <Link
                href='/subscriptions'
                className='text-sm font-medium text-primary hover:underline'
              >
                View All
              </Link>
            </div>
            <div className='mb-6 flex flex-wrap gap-x-5 gap-y-2'>
              {SUB_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubStatusFilter(s)}
                  className={`text-xs font-medium transition ${
                    subStatusFilter === s
                      ? 'text-primary-700 underline decoration-2 underline-offset-[6px]'
                      : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            {planDistribution.length === 0 ? (
              <p className='py-8 text-center text-textSecondary'>
                No subscriptions for this status.
              </p>
            ) : (
              <div className='space-y-4'>
                {planDistribution.map((plan) => {
                  const percentage = (
                    (plan.count / totalSubsInView) *
                    100
                  ).toFixed(1);
                  return (
                    <div key={plan.plan_name}>
                      <div className='mb-2 flex items-center justify-between'>
                        <div className='flex items-center'>
                          <Layers className='mr-2 h-4 w-4 text-primary' />
                          <span className='font-semibold text-textPrimary'>
                            {plan.plan_name}
                          </span>
                        </div>
                        <span className='text-sm font-semibold text-textPrimary'>
                          {plan.count} subscriptions ({percentage}%)
                        </span>
                      </div>
                      <div className='h-2 w-full rounded-full bg-bgGray'>
                        <div
                          className='h-2 rounded-full bg-primary'
                          style={{
                            width: `${(plan.count / totalSubsInView) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className='mt-6 grid grid-cols-3 gap-4 border-t border-border pt-6'>
              <div>
                <div className='mb-1 text-sm text-textSecondary'>Plans</div>
                <div className='text-xl font-bold text-textPrimary'>
                  {planDistribution.length}
                </div>
              </div>
              <div>
                <div className='mb-1 text-sm text-textSecondary'>
                  Subscriptions
                </div>
                <div className='text-xl font-bold text-textPrimary'>
                  {planDistribution.reduce((acc, p) => acc + p.count, 0)}
                </div>
              </div>
              <div>
                <div className='mb-1 text-sm text-textSecondary'>
                  Avg Revenue / Sub
                </div>
                <div className='text-xl font-bold text-textPrimary'>
                  {formatCurrency(
                    stats.mrr /
                      (stats.subscriptions.active +
                        stats.subscriptions.trialing || 1),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tenant Status Breakdown */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Tenant Status
              </h2>
              <Link
                href='/tenants'
                className='text-sm font-medium text-primary hover:underline'
              >
                View All
              </Link>
            </div>
            <div className='space-y-4'>
              {[
                {
                  label: 'Active',
                  value: stats.tenants.active,
                  color: 'bg-success',
                },
                {
                  label: 'Pending',
                  value: stats.tenants.pending,
                  color: 'bg-warning',
                },
                {
                  label: 'Suspended',
                  value: stats.tenants.suspended,
                  color: 'bg-amber-500',
                },
                {
                  label: 'Cancelled',
                  value: stats.tenants.cancelled,
                  color: 'bg-error',
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='text-sm text-textSecondary'>
                      {item.label}
                    </span>
                    <span className='text-sm font-semibold text-textPrimary'>
                      {item.value}
                    </span>
                  </div>
                  <div className='h-2 w-full rounded-full bg-bgGray'>
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{
                        width: `${stats.tenants.total > 0 ? (item.value / stats.tenants.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className='mt-6 border-t border-border pt-6'>
              <div className='mb-1 text-sm text-textSecondary'>
                Subscription Stats
              </div>
              <div className='mt-2 space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Past Due</span>
                  <span className='text-sm font-semibold text-warning'>
                    {stats.subscriptions.past_due}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Cancelled</span>
                  <span className='text-sm font-semibold text-error'>
                    {stats.subscriptions.cancelled}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Expired</span>
                  <span className='text-sm font-semibold text-textSecondary'>
                    {stats.subscriptions.expired}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Recent Tenants + Recent Subscriptions */}
      <div className='mb-8 grid grid-cols-2 gap-6'>
        {/* Recent Tenants */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Recent Tenants
              </h2>
              <Link
                href='/tenants'
                className='text-sm font-medium text-primary hover:underline'
              >
                View All
              </Link>
            </div>
            {stats.recent_tenants.length === 0 ? (
              <p className='py-8 text-center text-textSecondary'>
                No tenants yet.
              </p>
            ) : (
              <div className='divide-y divide-border'>
                {stats.recent_tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className='flex items-center justify-between py-3'
                  >
                    <div className='flex items-center'>
                      <div className='flex h-8 w-8 items-center justify-center rounded-full bg-bgGray text-sm font-semibold text-textSecondary'>
                        {tenant.name[0]?.toUpperCase() || 'T'}
                      </div>
                      <div className='ml-3'>
                        <Link
                          href={`/tenants/${tenant.id}`}
                          className='font-medium text-textPrimary hover:underline'
                        >
                          {tenant.name}
                        </Link>
                        <div className='text-xs text-textSecondary'>
                          {tenant.slug}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-3'>
                      <StatusBadge status={tenant.status} />
                      <span className='text-xs text-textSecondary'>
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Subscriptions */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Recent Subscriptions
              </h2>
              <Link
                href='/subscriptions'
                className='text-sm font-medium text-primary hover:underline'
              >
                View All
              </Link>
            </div>
            {stats.recent_subscriptions.length === 0 ? (
              <p className='py-8 text-center text-textSecondary'>
                No subscriptions yet.
              </p>
            ) : (
              <div className='divide-y divide-border'>
                {stats.recent_subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className='flex items-center justify-between py-3'
                  >
                    <div className='flex items-center'>
                      <div className='flex h-8 w-8 items-center justify-center rounded-full bg-bgGray text-sm font-semibold text-textSecondary'>
                        {sub.tenant_name[0]?.toUpperCase() || 'T'}
                      </div>
                      <div className='ml-3'>
                        <Link
                          href={`/tenants/${sub.tenant_id}`}
                          className='font-medium text-textPrimary hover:underline'
                        >
                          {sub.tenant_name}
                        </Link>
                        <div className='text-xs text-textSecondary'>
                          {sub.plan_name} &middot;{' '}
                          {sub.billing_cycle.toLowerCase()}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-3'>
                      <StatusBadge status={sub.status} />
                      <span className='text-sm font-semibold text-textPrimary'>
                        {sub.currency === 'INR' ? '\u20B9' : '$'}
                        {sub.price.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
