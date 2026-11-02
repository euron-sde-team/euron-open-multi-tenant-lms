'use client';

import { Loader2 } from 'lucide-react';

import { useGetTenantRevenueSummary } from '@/lib/api/hooks';
import { RevenueCurrencyBlock } from '@/lib/api/types';

import { formatMoney } from './format';

function CurrencyCard({ block }: { block: RevenueCurrencyBlock }) {
  const c = block.currency;
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Gross', value: formatMoney(block.gross_total, c) },
    { label: 'Discounts', value: formatMoney(block.discount_total, c) },
    {
      label: 'Net revenue',
      value: formatMoney(block.net_total, c),
      strong: true,
    },
    { label: 'Tax', value: formatMoney(block.tax_total, c) },
    { label: 'Platform fee', value: formatMoney(block.platform_fee_total, c) },
    {
      label: 'Tenant payout',
      value: formatMoney(block.tenant_payout_total, c),
      strong: true,
    },
  ];
  return (
    <div className='border-t border-border pt-5 pb-2'>
      <div className='mb-3 flex items-center justify-between'>
        <h4 className='text-lg font-semibold text-textPrimary'>{c}</h4>
        <span className='text-xs text-textSecondary'>
          {block.paid_order_count} paid order
          {block.paid_order_count === 1 ? '' : 's'}
        </span>
      </div>
      <div className='space-y-2'>
        {rows.map((r) => (
          <div
            key={r.label}
            className='flex items-center justify-between text-sm'
          >
            <span className='text-textSecondary'>{r.label}</span>
            <span
              className={
                r.strong ? 'font-semibold text-textPrimary' : 'text-textPrimary'
              }
            >
              {r.value}
            </span>
          </div>
        ))}
        <div className='mt-2 flex items-center justify-between border-t border-border pt-2 text-sm'>
          <span className='text-textSecondary'>
            Refunds ({block.refunded_order_count})
          </span>
          <span className='font-medium text-error'>
            {formatMoney(block.refunded_amount, c)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RevenueTab({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useGetTenantRevenueSummary(tenantId);

  if (isLoading) {
    return (
      <div className='flex h-40 items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-primary' />
      </div>
    );
  }
  if (!data) return null;

  const blocks = data.by_currency;

  return (
    <div>
      <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
        Net Revenue
      </h3>

      {blocks.length === 0 ? (
        <p className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
          No realised revenue yet.
        </p>
      ) : (
        <div className='mb-6 grid grid-cols-2 gap-4'>
          {blocks.map((b) => (
            <CurrencyCard key={b.currency} block={b} />
          ))}
        </div>
      )}

      {/* Breakdown by order type */}
      {data.by_order_type.length > 0 && (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border bg-bgGray text-xs uppercase text-textSecondary'>
                <th className='px-4 py-2 text-left'>Order Type</th>
                <th className='px-4 py-2 text-left'>Currency</th>
                <th className='px-4 py-2 text-right'>Orders</th>
                <th className='px-4 py-2 text-right'>Net</th>
                <th className='px-4 py-2 text-right'>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.by_order_type.map((r) => (
                <tr
                  key={`${r.currency}-${r.order_type}`}
                  className='border-b border-border'
                >
                  <td className='px-4 py-3 text-textPrimary'>
                    {r.order_type.replace(/_/g, ' ')}
                  </td>
                  <td className='px-4 py-3 text-textSecondary'>{r.currency}</td>
                  <td className='px-4 py-3 text-right'>{r.order_count}</td>
                  <td className='px-4 py-3 text-right text-textPrimary'>
                    {formatMoney(r.net_total, r.currency)}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-textPrimary'>
                    {formatMoney(r.total_amount, r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
