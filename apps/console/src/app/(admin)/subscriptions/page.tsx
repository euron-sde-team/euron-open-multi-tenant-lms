'use client';

import {
  AlertTriangle,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  HourglassIcon,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useCancelSubscription, useGetAllSubscriptions } from '@/lib/api/hooks';
import type {
  BillingCycle,
  Currency,
  GlobalSubscription,
  SubscriptionStatus,
} from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

export default function SubscriptionsPage() {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('');
  const [billingCycleFilter, setBillingCycleFilter] = useState<
    BillingCycle | ''
  >('');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Cancel modal
  const [cancelModal, setCancelModal] = useState<GlobalSubscription | null>(
    null,
  );
  const [cancelImmediately, setCancelImmediately] = useState(true);
  const [cancelReason, setCancelReason] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);

  // API call with backend-driven filters
  const {
    data: subscriptionsData,
    isLoading,
    error,
  } = useGetAllSubscriptions({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    billing_cycle: billingCycleFilter || undefined,
    currency: currencyFilter || undefined,
    page: currentPage,
    limit: itemsPerPage,
  });

  const cancelSubscriptionMutation = useCancelSubscription();

  const subscriptions = subscriptionsData?.data ?? [];
  const total = subscriptionsData?.total ?? 0;
  const totalPages = subscriptionsData?.totalPages ?? 1;

  // Compute stats from the current (potentially filtered) result set
  // For stats, we show what's in the current dataset
  const stats = {
    active: subscriptions.filter((s) => s.status === 'ACTIVE').length,
    trialing: subscriptions.filter((s) => s.status === 'TRIALING').length,
    pastDue: subscriptions.filter((s) => s.status === 'PAST_DUE').length,
    cancelled: subscriptions.filter((s) => s.status === 'CANCELLED').length,
    expired: subscriptions.filter((s) => s.status === 'EXPIRED').length,
  };

  const clearFilters = () => {
    setStatusFilter('');
    setBillingCycleFilter('');
    setCurrencyFilter('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className='text-xs font-semibold text-success'>
            Active
          </span>
        );
      case 'TRIALING':
        return (
          <span className='text-xs font-semibold text-primary'>
            Trialing
          </span>
        );
      case 'PAST_DUE':
        return (
          <span className='text-xs font-semibold text-warning'>
            Past Due
          </span>
        );
      case 'CANCELLED':
        return (
          <span className='text-xs font-semibold text-error'>
            Cancelled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className='text-xs font-semibold text-textSecondary'>
            Expired
          </span>
        );
      case 'PENDING':
        return (
          <span className='text-xs font-semibold text-warning'>
            Pending
          </span>
        );
      default:
        return (
          <span className='text-xs font-semibold text-textSecondary'>
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'INR' ? '\u20B9' : '$';
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Loading state
  if (isLoading && !subscriptionsData) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
          <p className='text-textSecondary'>Loading subscriptions...</p>
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
            Failed to load subscriptions
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='mb-2 flex items-center space-x-3'>
              <h1 className='text-3xl font-bold text-textPrimary'>
                Subscriptions
              </h1>
              <span className='text-sm font-semibold text-primary'>
                {total} Total
              </span>
            </div>
            <p className='text-textSecondary'>
              Manage subscription records and billing cycles
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'>
              <Download className='mr-2 h-4 w-4' />
              Export
            </button>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className='mb-8'>
        <div className='grid grid-cols-5 gap-6'>
          <button
            type='button'
            onClick={() => {
              setStatusFilter(statusFilter === 'ACTIVE' ? '' : 'ACTIVE');
              setCurrentPage(1);
            }}
            className={`rounded-lg border p-6 text-left transition ${statusFilter === 'ACTIVE' ? 'border-green-300 bg-green-50' : 'border-border bg-surface hover:bg-bgGray'}`}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <CheckCircle className='h-5 w-5 text-success' />
              </div>
            </div>
            <div className='mb-1 text-2xl font-bold text-textPrimary'>
              {stats.active}
            </div>
            <div className='text-sm text-textSecondary'>Active</div>
          </button>

          <button
            type='button'
            onClick={() => {
              setStatusFilter(statusFilter === 'TRIALING' ? '' : 'TRIALING');
              setCurrentPage(1);
            }}
            className={`rounded-lg border p-6 text-left transition ${statusFilter === 'TRIALING' ? 'border-primary-300 bg-primary-50' : 'border-border bg-surface hover:bg-bgGray'}`}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <Clock className='h-5 w-5 text-primary' />
              </div>
            </div>
            <div className='mb-1 text-2xl font-bold text-textPrimary'>
              {stats.trialing}
            </div>
            <div className='text-sm text-textSecondary'>Trialing</div>
          </button>

          <button
            type='button'
            onClick={() => {
              setStatusFilter(statusFilter === 'PAST_DUE' ? '' : 'PAST_DUE');
              setCurrentPage(1);
            }}
            className={`rounded-lg border p-6 text-left transition ${statusFilter === 'PAST_DUE' ? 'border-amber-300 bg-amber-50' : 'border-border bg-surface hover:bg-bgGray'}`}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <AlertTriangle className='h-5 w-5 text-warning' />
              </div>
            </div>
            <div className='mb-1 text-2xl font-bold text-textPrimary'>
              {stats.pastDue}
            </div>
            <div className='text-sm text-textSecondary'>Past Due</div>
          </button>

          <button
            type='button'
            onClick={() => {
              setStatusFilter(statusFilter === 'CANCELLED' ? '' : 'CANCELLED');
              setCurrentPage(1);
            }}
            className={`rounded-lg border p-6 text-left transition ${statusFilter === 'CANCELLED' ? 'border-red-300 bg-red-50' : 'border-border bg-surface hover:bg-bgGray'}`}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <Ban className='h-5 w-5 text-error' />
              </div>
            </div>
            <div className='mb-1 text-2xl font-bold text-textPrimary'>
              {stats.cancelled}
            </div>
            <div className='text-sm text-textSecondary'>Cancelled</div>
          </button>

          <button
            type='button'
            onClick={() => {
              setStatusFilter(statusFilter === 'EXPIRED' ? '' : 'EXPIRED');
              setCurrentPage(1);
            }}
            className={`rounded-lg border p-6 text-left transition ${statusFilter === 'EXPIRED' ? 'border-gray-400 bg-gray-50' : 'border-border bg-surface hover:bg-bgGray'}`}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <HourglassIcon className='h-5 w-5 text-textSecondary' />
              </div>
            </div>
            <div className='mb-1 text-2xl font-bold text-textPrimary'>
              {stats.expired}
            </div>
            <div className='text-sm text-textSecondary'>Expired</div>
          </button>
        </div>
      </section>

      {/* Filters Section */}
      <section className='mb-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-textPrimary'>Filters</h3>
            <button
              onClick={clearFilters}
              className='text-sm font-medium text-primary hover:underline'
            >
              Clear All
            </button>
          </div>

          <div className='grid grid-cols-4 gap-4'>
            <div>
              <label className='mb-2 block text-sm font-medium text-textSecondary'>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter((e.target.value as SubscriptionStatus) || '');
                  setCurrentPage(1);
                }}
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Statuses</option>
                <option value='ACTIVE'>Active</option>
                <option value='TRIALING'>Trialing</option>
                <option value='PAST_DUE'>Past Due</option>
                <option value='CANCELLED'>Cancelled</option>
                <option value='EXPIRED'>Expired</option>
                <option value='PENDING'>Pending</option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-textSecondary'>
                Billing Cycle
              </label>
              <select
                value={billingCycleFilter}
                onChange={(e) => {
                  setBillingCycleFilter((e.target.value as BillingCycle) || '');
                  setCurrentPage(1);
                }}
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Cycles</option>
                <option value='MONTHLY'>Monthly</option>
                <option value='YEARLY'>Yearly</option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-textSecondary'>
                Currency
              </label>
              <select
                value={currencyFilter}
                onChange={(e) => {
                  setCurrencyFilter((e.target.value as Currency) || '');
                  setCurrentPage(1);
                }}
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Currencies</option>
                <option value='USD'>USD</option>
                <option value='INR'>INR</option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-textSecondary'>
                Search
              </label>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Tenant name, plan...'
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className='h-10 w-full rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subscriptions Table */}
      <section className='mb-8'>
        <div className='border-t border-border'>
          {/* Table */}
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Tenant
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Plan
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Status
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Billing
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Current Period
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='py-12 text-center'>
                      <FileText className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No subscriptions found
                      </p>
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className='border-b border-border transition hover:bg-bgGray'
                    >
                      <td className='px-6 py-4'>
                        <div className='flex items-center'>
                          <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 font-bold text-primary'>
                            {sub.tenant_name?.[0]?.toUpperCase() || 'T'}
                          </div>
                          <div className='ml-3'>
                            <Link
                              href={`/tenants/${sub.tenant_id}`}
                              className='font-semibold text-primary hover:underline'
                            >
                              {sub.tenant_name}
                            </Link>
                            <div className='text-xs text-textSecondary'>
                              {sub.tenant_slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <Link
                          href={`/subscriptions/${sub.id}?tenant=${sub.tenant_id}`}
                          className='font-medium text-textPrimary hover:text-primary hover:underline'
                        >
                          {sub.plan_name_snapshot}
                        </Link>
                        <div className='text-xs text-textSecondary'>
                          v{sub.plan_version_snapshot ?? 1} &middot;{' '}
                          {sub.plan_code_snapshot}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        {getStatusBadge(sub.status)}
                      </td>
                      <td className='px-6 py-4'>
                        <div className='font-semibold text-textPrimary'>
                          {formatCurrency(sub.price_snapshot, sub.currency)}
                        </div>
                        <div className='text-xs capitalize text-textSecondary'>
                          {sub.billing_cycle.toLowerCase()} &middot;{' '}
                          {sub.currency}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='text-sm text-textPrimary'>
                          {new Date(
                            sub.current_period_start,
                          ).toLocaleDateString()}{' '}
                          &ndash;{' '}
                          {new Date(
                            sub.current_period_end,
                          ).toLocaleDateString()}
                        </div>
                        {sub.cancelled_at && (
                          <div className='text-xs text-error'>
                            Cancelled{' '}
                            {new Date(sub.cancelled_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex items-center justify-end space-x-2'>
                          <Link
                            href={`/tenants/${sub.tenant_id}`}
                            className='flex h-8 w-8 items-center justify-center rounded transition hover:bg-bgGray'
                            title='View Tenant'
                          >
                            <Eye className='h-4 w-4 text-textSecondary' />
                          </Link>
                          {sub.status !== 'CANCELLED' &&
                            sub.status !== 'EXPIRED' && (
                              <button
                                type='button'
                                onClick={() => {
                                  setCancelModal(sub);
                                  setCancelImmediately(true);
                                  setCancelReason('');
                                }}
                                className='flex h-8 w-8 items-center justify-center rounded transition hover:bg-red-50'
                                title='Cancel Subscription'
                              >
                                <Ban className='h-4 w-4 text-error' />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className='flex items-center justify-between border-t border-border p-6'>
            <div className='flex items-center space-x-4'>
              <span className='text-sm text-textSecondary'>
                Showing {total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                &ndash;{Math.min(currentPage * itemsPerPage, total)} of {total}{' '}
                subscriptions
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className='h-9 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
                aria-label='Next page'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cancel subscription modal */}
      {cancelModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !cancelSubscriptionMutation.isLoading && setCancelModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Cancel Subscription
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Cancel subscription for <strong>{cancelModal.tenant_name}</strong>{' '}
              ({cancelModal.plan_name_snapshot}).
            </p>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  When to cancel
                </label>
                <div className='space-y-2'>
                  <label className='flex items-center gap-2 text-sm text-textPrimary'>
                    <input
                      type='radio'
                      name='cancelTiming'
                      checked={cancelImmediately}
                      onChange={() => setCancelImmediately(true)}
                      disabled={cancelSubscriptionMutation.isLoading}
                    />
                    Cancel immediately
                  </label>
                  <label className='flex items-center gap-2 text-sm text-textPrimary'>
                    <input
                      type='radio'
                      name='cancelTiming'
                      checked={!cancelImmediately}
                      onChange={() => setCancelImmediately(false)}
                      disabled={cancelSubscriptionMutation.isLoading}
                    />
                    Cancel at end of current period (
                    {new Date(
                      cancelModal.current_period_end,
                    ).toLocaleDateString()}
                    )
                  </label>
                </div>
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder='Reason for cancellation...'
                  rows={2}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={cancelSubscriptionMutation.isLoading}
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !cancelSubscriptionMutation.isLoading && setCancelModal(null)
                }
                disabled={cancelSubscriptionMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Keep Active
              </button>
              <button
                type='button'
                onClick={() => {
                  cancelSubscriptionMutation.mutate(
                    {
                      tenantId: cancelModal.tenant_id,
                      subscriptionId: cancelModal.id,
                      data: {
                        cancel_immediately: cancelImmediately,
                        reason: cancelReason || undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        setCancelModal(null);
                        setCancelReason('');
                      },
                    },
                  );
                }}
                disabled={cancelSubscriptionMutation.isLoading}
                className='flex flex-1 items-center justify-center rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50'
              >
                {cancelSubscriptionMutation.isLoading
                  ? 'Cancelling...'
                  : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
