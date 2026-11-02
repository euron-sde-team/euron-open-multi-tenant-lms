'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { useGetEntitlements } from '@/lib/api/hooks/useEntitlements';
import { useGetSubscription } from '@/lib/api/hooks/useSubscriptions';
import { useGetTenant } from '@/lib/api/hooks/useTenants';
import { tenantStorefrontHost } from '@/lib/brand';

import PageHeader from '@/components/common/PageHeader';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-success',
  TRIALING: 'bg-primary-50 text-primary',
  PAST_DUE: 'bg-amber-50 text-warning',
  CANCELLED: 'bg-red-50 text-error',
  EXPIRED: 'bg-gray-100 text-textSecondary',
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString() : '-';

const fmtMoney = (amount: number | undefined, currency: string) =>
  amount == null
    ? '-'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(Number(amount));

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className='text-xs uppercase tracking-wide text-textSecondary'>
        {label}
      </div>
      <div className='mt-1 text-sm font-medium text-textPrimary'>{value}</div>
    </div>
  );
}

/**
 * Subscription detail. The API addresses a subscription through its tenant,
 * so links into this page carry `?tenant=<tenantId>`.
 */
export default function SubscriptionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subscriptionId = params.id as string;
  const tenantId = searchParams.get('tenant') ?? undefined;

  const { data: subscription, isLoading, error } = useGetSubscription(
    tenantId,
    subscriptionId,
  );
  const { data: tenant } = useGetTenant(tenantId);
  const { data: entitlements } = useGetEntitlements(tenantId, {
    limit: 100,
  });

  if (!tenantId) {
    return (
      <div className='p-8 text-center text-textSecondary'>
        Open a subscription from the{' '}
        <Link href='/subscriptions' className='text-primary hover:underline'>
          subscriptions list
        </Link>
        .
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex justify-center p-12'>
        <Loader2 className='h-6 w-6 animate-spin text-primary' />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className='p-8 text-center text-error'>
        {error?.message ?? 'Subscription not found'}
      </div>
    );
  }

  const linked = (entitlements?.data ?? []).filter(
    (e) => e.source_subscription_id === subscription.id,
  );

  return (
    <div className='p-4 md:p-8'>
      <PageHeader
        title={subscription.plan_name_snapshot}
        description={`Plan ${subscription.plan_code_snapshot} v${subscription.plan_version_snapshot ?? 1}`}
        breadcrumbs={[
          { label: 'Subscriptions', href: '/subscriptions' },
          { label: subscription.plan_name_snapshot },
        ]}
      />

      <section className='mb-6 border-t border-border pt-6 pb-2'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div>
            {tenant ? (
              <Link
                href={`/tenants/${tenant.id}`}
                className='text-lg font-semibold text-primary hover:underline'
              >
                {tenant.name}
              </Link>
            ) : (
              <span className='text-lg font-semibold text-textPrimary'>
                Tenant
              </span>
            )}
            {tenant && (
              <a
                href={`https://${tenant.custom_domain || tenantStorefrontHost(tenant.slug)}`}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-1 flex items-center gap-1 text-xs text-textSecondary hover:underline'
              >
                {tenant.custom_domain || tenantStorefrontHost(tenant.slug)}
                <ExternalLink className='h-3 w-3' />
              </a>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              STATUS_STYLES[subscription.status] ?? STATUS_STYLES.EXPIRED
            }`}
          >
            {subscription.status}
            {subscription.is_trial ? ' (trial)' : ''}
          </span>
        </div>

        <div className='grid grid-cols-2 gap-6 md:grid-cols-4'>
          <Field
            label='Price'
            value={fmtMoney(subscription.price_snapshot, subscription.currency)}
          />
          <Field
            label='Billing cycle'
            value={subscription.billing_cycle.toLowerCase()}
          />
          <Field label='Started' value={fmtDate(subscription.started_at)} />
          <Field
            label='Current period'
            value={`${fmtDate(subscription.current_period_start)} to ${fmtDate(subscription.current_period_end)}`}
          />
          {subscription.original_price != null && (
            <Field
              label='Original price'
              value={fmtMoney(subscription.original_price, subscription.currency)}
            />
          )}
          {subscription.discount_applied != null && (
            <Field
              label='Discount'
              value={fmtMoney(
                subscription.discount_applied,
                subscription.currency,
              )}
            />
          )}
          {subscription.trial_ends_at && (
            <Field label='Trial ends' value={fmtDate(subscription.trial_ends_at)} />
          )}
          {subscription.cancelled_at && (
            <Field
              label='Cancelled'
              value={`${fmtDate(subscription.cancelled_at)}${
                subscription.cancellation_reason
                  ? `: ${subscription.cancellation_reason}`
                  : ''
              }`}
            />
          )}
        </div>
      </section>

      <section className='border-t border-border'>
        <div className='border-b border-border px-6 py-4'>
          <h2 className='text-lg font-semibold text-textPrimary'>
            Entitlements from this subscription
          </h2>
          <p className='text-sm text-textSecondary'>
            Snapshotted when the plan was assigned. Manage overrides on the
            tenant&apos;s Entitlements tab.
          </p>
        </div>
        {linked.length === 0 ? (
          <div className='px-6 py-8 text-center text-sm text-textSecondary'>
            No entitlements are linked to this subscription.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border bg-bgGray text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                  <th className='px-6 py-3'>Product</th>
                  <th className='px-6 py-3'>Feature</th>
                  <th className='px-6 py-3'>Limit</th>
                  <th className='px-6 py-3'>Used</th>
                </tr>
              </thead>
              <tbody>
                {linked.map((e) => (
                  <tr key={e.id} className='border-b border-border last:border-0'>
                    <td className='px-6 py-3 font-mono text-xs text-textPrimary'>
                      {e.product_code}
                    </td>
                    <td className='px-6 py-3 text-textSecondary'>
                      {e.feature_key}
                    </td>
                    <td className='px-6 py-3 text-textPrimary'>
                      {e.is_unlimited ? 'Unlimited' : (e.limit_value ?? 0)}
                    </td>
                    <td className='px-6 py-3 text-textPrimary'>
                      {e.used_value ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
