'use client';

import {
  BarChart3,
  CheckCircle,
  ChevronRight,
  CircleDot,
  CreditCard,
  DollarSign,
  Droplets,
  Key,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import {
  useGetBillingProviders,
  useGetBillingProvidersAnalytics,
} from '@/lib/api/hooks/useBillingProviders';
import type { BillingProvider } from '@/lib/api/types';
import type { ProviderAnalyticsItem } from '@/lib/api/types';

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function getProviderIcon(name: string) {
  const icon = name.toLowerCase();
  if (icon === 'stripe') return <span className='text-3xl font-bold'>S</span>;
  if (icon === 'paddle') return <Droplets className='h-8 w-8' />;
  if (icon === 'paypal') return <span className='text-3xl font-bold'>P</span>;
  if (icon === 'braintree') return <CircleDot className='h-8 w-8' />;
  return <CreditCard className='h-8 w-8' />;
}

function getProviderGradient(name: string): string {
  const n = name.toLowerCase();
  if (n === 'stripe') return 'from-primary-600 to-purple-600';
  if (n === 'paddle') return 'from-green-500 to-emerald-600';
  if (n === 'paypal') return 'from-primary-500 to-primary-700';
  if (n === 'braintree') return 'from-gray-400 to-gray-600';
  return 'from-gray-500 to-gray-700';
}

function mergeProviderWithAnalytics(
  provider: BillingProvider,
  analyticsItem: ProviderAnalyticsItem | undefined,
) {
  return {
    ...provider,
    subscription_count: analyticsItem?.subscription_count ?? 0,
    platform_earning_this_month:
      analyticsItem?.platform_earning_this_month ?? 0,
    platform_earning_total: analyticsItem?.platform_earning_total ?? 0,
    tenant_earning_this_month: analyticsItem?.tenant_earning_this_month ?? 0,
    webhooks_this_month: analyticsItem?.webhooks_this_month ?? 0,
    success_rate: analyticsItem?.success_rate ?? null,
  };
}

export default function ProvidersPage() {
  const [statusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const {
    data: providersData,
    isLoading: providersLoading,
    error: providersError,
    refetch: refetchProviders,
  } = useGetBillingProviders({
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    page: 1,
    limit: 50,
  });

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useGetBillingProvidersAnalytics();

  const handleSyncAll = useCallback(() => {
    refetchProviders();
    refetchAnalytics();
  }, [refetchProviders, refetchAnalytics]);

  const analyticsMap = new Map(
    analyticsData?.providers?.map((p) => [p.provider_id, p]) ?? [],
  );
  const providers = (providersData?.data ?? []).map((p) =>
    mergeProviderWithAnalytics(p, analyticsMap.get(p.id)),
  );
  const filteredProviders =
    statusFilter === 'all'
      ? providers
      : providers.filter((p) =>
          statusFilter === 'active' ? p.is_active : !p.is_active,
        );

  const overview = analyticsData?.overview;
  const stats = {
    totalProviders: overview?.total_providers ?? 0,
    activeProviders: overview?.active_providers ?? 0,
    webhooksThisMonth: overview?.webhooks_this_month ?? 0,
    processedThisMonth: overview?.platform_earning_this_month ?? 0,
    successRate:
      overview?.success_rate != null
        ? `${(overview.success_rate * 100).toFixed(1)}%`
        : '-',
  };

  const isLoading = providersLoading || analyticsLoading;
  const error = providersError;

  if (error) {
    return (
      <div className='p-8'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-800'>
          <p className='font-semibold'>Failed to load billing providers</p>
          <p className='mt-1 text-sm'>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      {/* Header with Breadcrumb */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='mb-2 flex items-center space-x-3'>
              <Link
                href='/billing'
                className='text-sm text-textSecondary hover:text-primary'
              >
                Billing
              </Link>
              <ChevronRight className='h-3 w-3 text-textSecondary' />
              <span className='text-sm font-semibold text-textPrimary'>
                Providers
              </span>
            </div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Billing Providers
            </h1>
            <p className='text-textSecondary'>
              Manage payment gateways and billing integrations
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button
              type='button'
              onClick={handleSyncAll}
              disabled={isLoading}
              className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Sync All
            </button>
            <Link
              href='/providers/new'
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white hover:bg-primaryHover'
            >
              <Plus className='mr-2 h-4 w-4' />
              Add Provider
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className='mb-8'>
        <div className='grid grid-cols-4 gap-6'>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <CreditCard className='h-5 w-5 text-primary' />
              </div>
              <span className='text-xs font-semibold text-green-600'>
                {stats.activeProviders} Active
              </span>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {isLoading ? '-' : stats.totalProviders}
            </div>
            <div className='text-sm text-textSecondary'>Total Providers</div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <Webhook className='h-5 w-5 text-green-600' />
              </div>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {isLoading ? '-' : stats.webhooksThisMonth.toLocaleString()}
            </div>
            <div className='text-sm text-textSecondary'>
              Webhooks This Month
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <DollarSign className='h-5 w-5 text-purple-600' />
              </div>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {isLoading ? '-' : formatCurrency(stats.processedThisMonth)}
            </div>
            <div className='text-sm text-textSecondary'>
              Platform Earning (This Month)
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <CheckCircle className='h-5 w-5 text-amber-600' />
              </div>
              <span className='text-xs font-semibold text-green-600'>
                {stats.successRate !== '-' ? 'Healthy' : '-'}
              </span>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {stats.successRate}
            </div>
            <div className='text-sm text-textSecondary'>Success Rate</div>
          </div>
        </div>
      </section>

      {/* Provider Cards */}
      <section className='mb-8'>
        {isLoading ? (
          <div className='grid grid-cols-2 gap-6'>
            {[1, 2].map((i) => (
              <div
                key={i}
                className='animate-pulse border-t border-border pt-6 pb-2'
              >
                <div className='mb-4 h-16 w-16 rounded-lg bg-bgGray' />
                <div className='mb-4 h-4 w-32 rounded bg-bgGray' />
                <div className='h-24 rounded bg-bgGray' />
              </div>
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-6'>
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className={`rounded-lg border border-border bg-surface p-6 transition hover:shadow-md ${
                  !provider.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className='mb-6 flex items-start justify-between'>
                  <div className='flex items-center'>
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br ${getProviderGradient(provider.name)} text-white`}
                    >
                      {getProviderIcon(provider.name)}
                    </div>
                    <div className='ml-4'>
                      <div className='mb-1 text-xl font-bold text-textPrimary'>
                        {provider.name}
                      </div>
                      <div className='text-sm text-textSecondary'>
                        Billing provider
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        provider.is_active
                          ? 'bg-green-50 text-green-600'
                          : 'bg-gray-100 text-textSecondary'
                      }`}
                    >
                      {provider.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      type='button'
                      className='flex h-8 w-8 items-center justify-center rounded-lg hover:bg-bgGray'
                    >
                      <MoreVertical className='h-4 w-4 text-textSecondary' />
                    </button>
                  </div>
                </div>

                <div className='mb-6 grid grid-cols-2 gap-4'>
                  <div className='rounded-lg bg-bgGray p-4'>
                    <div className='mb-1 text-xs text-textSecondary'>
                      Subscriptions
                    </div>
                    <div className='text-2xl font-bold text-textPrimary'>
                      {provider.subscription_count?.toLocaleString() ?? 0}
                    </div>
                  </div>
                  <div className='rounded-lg bg-bgGray p-4'>
                    <div className='mb-1 text-xs text-textSecondary'>
                      Platform Earning (MTD)
                    </div>
                    <div className='text-2xl font-bold text-textPrimary'>
                      {formatCurrency(
                        provider.platform_earning_this_month ?? 0,
                      )}
                    </div>
                  </div>
                </div>

                <div className='mb-6 space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-textSecondary'>
                      Webhooks This Month
                    </span>
                    <span className='text-sm text-textPrimary'>
                      {provider.webhooks_this_month?.toLocaleString() ?? 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-textSecondary'>
                      Success Rate
                    </span>
                    <span className='text-sm font-semibold text-green-600'>
                      {provider.success_rate != null
                        ? `${(provider.success_rate * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className='flex items-center space-x-3 border-t border-border pt-6'>
                  <Link
                    href={`/providers/${provider.id}/edit`}
                    className='flex h-10 flex-1 items-center justify-center rounded-full bg-primarySolid text-sm font-semibold text-white hover:bg-primaryHover'
                  >
                    <Settings className='mr-2 h-4 w-4' />
                    Configure
                  </Link>
                  <button
                    type='button'
                    className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
                  >
                    <BarChart3 className='mr-2 h-4 w-4' />
                    Analytics
                  </button>
                  <button
                    type='button'
                    className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
                  >
                    <Key className='mr-2 h-4 w-4' />
                    API Keys
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredProviders.length === 0 && (
          <div className='text-center text-textSecondary border-t border-border pt-12 pb-2'>
            No billing providers found. Add one to get started.
          </div>
        )}
      </section>


      {/* Tenant Earning insight */}
      <section className='mb-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <h2 className='mb-2 text-xl font-semibold text-textPrimary'>
            Tenant Earning
          </h2>
          <p className='text-sm text-textSecondary'>
            Payment processed for tenants (e.g. course sales), coming soon.
            Current value: $0.
          </p>
        </div>
      </section>
    </div>
  );
}
