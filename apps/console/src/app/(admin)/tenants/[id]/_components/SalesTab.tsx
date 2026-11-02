'use client';

import { Loader2, Receipt } from 'lucide-react';
import { useState } from 'react';

import { useGetTenantSalesOrders } from '@/lib/api/hooks';
import { SalesOrdersFilters } from '@/lib/api/types';

import { formatDate, formatMoney, statusBadgeClass } from './format';

const PAGE_SIZE = 20;

const ORDER_TYPES = [
  'COURSE',
  'BOOK',
  'BUNDLE',
  'BATCH',
  'TEST_SERIES',
  'CART',
];

const ORDER_STATUSES = [
  'CREATED',
  'PAYMENT_PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUND_INITIATED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
];

export default function SalesTab({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const [orderType, setOrderType] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [search, setSearch] = useState('');

  const filters: SalesOrdersFilters = {
    page,
    limit: PAGE_SIZE,
    order_type: orderType || undefined,
    status: status || undefined,
    currency: currency || undefined,
    search: search || undefined,
  };
  const { data, isLoading } = useGetTenantSalesOrders(tenantId, filters);
  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const resetPageAnd = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div>
      <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
        Platform Sales
      </h3>

      {/* Filters */}
      <div className='mb-4 flex flex-wrap gap-3'>
        <input
          type='text'
          placeholder='Search order number...'
          value={search}
          onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
          className='h-10 w-64 rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none'
        />
        <select
          value={orderType}
          onChange={(e) => resetPageAnd(() => setOrderType(e.target.value))}
          className='h-10 rounded-lg border border-border bg-surface px-3 text-sm'
        >
          <option value=''>All Types</option>
          {ORDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => resetPageAnd(() => setStatus(e.target.value))}
          className='h-10 rounded-lg border border-border bg-surface px-3 text-sm'
        >
          <option value=''>All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          value={currency}
          onChange={(e) => resetPageAnd(() => setCurrency(e.target.value))}
          className='h-10 rounded-lg border border-border bg-surface px-3 text-sm'
        >
          <option value=''>All Currencies</option>
          <option value='INR'>INR</option>
          <option value='USD'>USD</option>
        </select>
      </div>

      <div className='overflow-x-auto rounded-lg border border-border'>
        {isLoading ? (
          <div className='flex h-40 items-center justify-center'>
            <Loader2 className='h-6 w-6 animate-spin text-primary' />
          </div>
        ) : rows.length === 0 ? (
          <div className='flex h-40 flex-col items-center justify-center text-textSecondary'>
            <Receipt className='h-8 w-8' />
            <p className='mt-2 text-sm'>No orders found</p>
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border bg-bgGray text-xs uppercase text-textSecondary'>
                <th className='px-4 py-2 text-left'>Order</th>
                <th className='px-4 py-2 text-left'>Buyer</th>
                <th className='px-4 py-2 text-left'>Item</th>
                <th className='px-4 py-2 text-right'>Net</th>
                <th className='px-4 py-2 text-right'>Total</th>
                <th className='px-4 py-2 text-right'>Payout</th>
                <th className='px-4 py-2 text-left'>Status</th>
                <th className='px-4 py-2 text-left'>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  className='border-b border-border hover:bg-bgGray'
                >
                  <td className='px-4 py-3'>
                    <div className='font-medium text-textPrimary'>
                      {o.order_number}
                    </div>
                    <div className='text-xs text-textSecondary'>
                      {o.order_type.replace(/_/g, ' ')} •{' '}
                      {o.gateway_provider_name}
                    </div>
                  </td>
                  <td className='px-4 py-3'>
                    <div className='text-textPrimary'>
                      {o.buyer_name || '-'}
                    </div>
                    <div className='text-xs text-textSecondary'>
                      {o.buyer_email || '-'}
                    </div>
                  </td>
                  <td className='px-4 py-3 text-textSecondary'>
                    {o.item_title || '-'}
                  </td>
                  <td className='px-4 py-3 text-right text-textPrimary'>
                    {formatMoney(o.net_amount, o.currency)}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-textPrimary'>
                    {formatMoney(o.total_amount, o.currency)}
                  </td>
                  <td className='px-4 py-3 text-right text-textSecondary'>
                    {formatMoney(o.tenant_payout_amount, o.currency)}
                  </td>
                  <td className='px-4 py-3'>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(o.status)}`}
                    >
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className='px-4 py-3 text-xs text-textSecondary'>
                    {formatDate(o.paid_at || o.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && rows.length > 0 && (
          <div className='flex items-center justify-between border-t border-border p-4'>
            <span className='text-sm text-textSecondary'>
              Page {page} of {Math.max(1, totalPages)} • {data?.total ?? 0}{' '}
              orders
            </span>
            <div className='flex gap-2'>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className='rounded border border-border px-3 py-1 text-sm disabled:opacity-50'
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className='rounded border border-border px-3 py-1 text-sm disabled:opacity-50'
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
