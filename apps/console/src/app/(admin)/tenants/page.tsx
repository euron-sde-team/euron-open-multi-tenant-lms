'use client';

import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Ban,
  Building2,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns,
  Download,
  Eye,
  Filter,
  Loader2,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  useDeleteTenant,
  useGetPlans,
  useGetTenants,
  useReactivateTenant,
  useSuspendTenant,
} from '@/lib/api/hooks';
import { exportTenants } from '@/lib/api/tenants';
import { TenantStatus } from '@/lib/api/types';
import { tenantStorefrontHost } from '@/lib/brand';
import { useDebounce } from '@/hooks/useDebounce';

import ConfirmModal from '@/components/common/ConfirmModal';
import StatusBadge from '@/components/common/StatusBadge';

const ITEMS_PER_PAGE = 10;

export default function TenantsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [planFilter, setPlanFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(ITEMS_PER_PAGE);
  const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [suspendModal, setSuspendModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [reactivateTarget, setReactivateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const actionsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = actionsRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) {
        setActionsOpenId(null);
        setAnchorRect(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!actionsOpenId) return;
    const handleScroll = () => {
      setActionsOpenId(null);
      setAnchorRect(null);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [actionsOpenId]);

  const {
    data: tenantsData,
    isLoading,
    error,
  } = useGetTenants({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    plan: planFilter || undefined,
    sort: sortOrder,
    page: currentPage,
    limit,
  });

  const { data: plansData } = useGetPlans({ limit: 200 });
  const plans = plansData?.plans ?? [];

  const suspendTenantMutation = useSuspendTenant();
  const reactivateTenantMutation = useReactivateTenant();
  const deleteTenantMutation = useDeleteTenant();

  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      const blob = await exportTenants(
        exportStartDate || undefined,
        exportEndDate || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenants-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const tenants = tenantsData?.data ?? [];
  const total = tenantsData?.total ?? 0;
  const totalPages = tenantsData?.totalPages ?? 1;

  const stats = {
    total,
    active: tenants.filter((t) => t.status === 'ACTIVE').length,
    pending: tenants.filter((t) => t.status === 'PENDING').length,
    suspended: tenants.filter((t) => t.status === 'SUSPENDED').length,
    cancelled: tenants.filter((t) => t.status === 'CANCELLED').length,
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading tenants...</p>
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
            Failed to load tenants
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
        </div>
      </div>
    );
  }

  const handleSuspendSubmit = () => {
    if (!suspendModal || !suspendReason.trim()) return;
    suspendTenantMutation.mutate(
      { id: suspendModal.id, reason: suspendReason.trim() },
      {
        onSuccess: () => {
          setSuspendModal(null);
          setSuspendReason('');
          setActionsOpenId(null);
        },
      },
    );
  };

  const handleReactivateConfirm = () => {
    if (!reactivateTarget) return;
    reactivateTenantMutation.mutate(reactivateTarget.id, {
      onSuccess: () => {
        setReactivateTarget(null);
        setActionsOpenId(null);
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    deleteTenantMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteConfirmText('');
        setActionsOpenId(null);
      },
    });
  };

  const getStatusBadge = (status: string) => (
    <StatusBadge status={status || '-'} />
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-textPrimary mb-2'>
              Tenants Management
            </h1>
            <p className='text-textSecondary'>
              Manage and monitor all customer organizations
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button
              onClick={() => setShowExportModal(true)}
              className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center'
            >
              <Download className='h-4 w-4 mr-2' />
              Export
            </button>
            <Link
              href='/tenants/new'
              className='h-10 px-5 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm transition flex items-center'
            >
              <Plus className='h-4 w-4 mr-2' />
              Add Tenant
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className='mb-8'>
        <div className='grid grid-cols-5 gap-4'>
          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <Building2 className='h-5 w-5 text-primary' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.total}
            </div>
            <div className='text-sm text-textSecondary'>Total Tenants</div>
          </div>

          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <CheckCircle className='h-5 w-5 text-success' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.active}
            </div>
            <div className='text-sm text-textSecondary'>Active</div>
          </div>

          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <Clock className='h-5 w-5 text-warning' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.pending}
            </div>
            <div className='text-sm text-textSecondary'>Pending</div>
          </div>

          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <Ban className='h-5 w-5 text-error' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.suspended}
            </div>
            <div className='text-sm text-textSecondary'>Suspended</div>
          </div>

          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <XCircle className='h-5 w-5 text-textSecondary' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.cancelled}
            </div>
            <div className='text-sm text-textSecondary'>Cancelled</div>
          </div>
        </div>
      </section>

      {/* Tenants Table */}
      <section className='mb-8'>
        <div className='border-t border-border'>
          {/* Filters */}
          <div className='p-6 border-b border-border'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textSecondary' />
                  <input
                    type='text'
                    placeholder='Search by tenant name, domain, owner name, email, or phone...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='h-10 pl-10 pr-4 w-80 bg-bgGray border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                  />
                </div>
                <label className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center cursor-pointer'>
                  <Filter className='h-4 w-4 mr-2' aria-hidden='true' />
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as TenantStatus | '');
                      setCurrentPage(1);
                    }}
                    className='ml-2 bg-transparent border-none focus:outline-none text-sm'
                  >
                    <option value=''>All</option>
                    <option value='ACTIVE'>Active</option>
                    <option value='PENDING'>Pending</option>
                    <option value='SUSPENDED'>Suspended</option>
                    <option value='CANCELLED'>Cancelled</option>
                  </select>
                </label>
                <label className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center cursor-pointer'>
                  <Filter className='h-4 w-4 mr-2' aria-hidden='true' />
                  <span>Plan</span>
                  <select
                    value={planFilter}
                    onChange={(e) => {
                      setPlanFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className='ml-2 bg-transparent border-none focus:outline-none text-sm'
                    aria-label='Filter by active plan'
                  >
                    <option value=''>All Plans</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.code}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center'>
                  <Calendar className='h-4 w-4 mr-2' />
                  <span>Date Range</span>
                </button>
              </div>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => {
                    setSortOrder((prev) =>
                      prev === 'latest' ? 'oldest' : 'latest',
                    );
                    setCurrentPage(1);
                  }}
                  className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center'
                >
                  <ArrowDownWideNarrow className='h-4 w-4 mr-2' />
                  {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
                </button>
                <button className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center'>
                  <Columns className='h-4 w-4 mr-2' />
                  Columns
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    <input
                      type='checkbox'
                      aria-label='Select all tenants'
                      className='w-4 h-4 rounded border-border text-primary focus:ring-primary'
                    />
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Tenant
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Owner
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Status
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Subscription
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Applications
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Users/Members
                  </th>
                  <th className='text-left py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Created
                  </th>
                  <th className='text-right py-4 px-6 text-xs font-semibold text-textSecondary uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className='py-12 text-center'>
                      <Building2 className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No tenants found
                      </p>
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant) => {
                    const ownerName =
                      tenant.owner_name ??
                      tenant.owner?.name ??
                      ([tenant.owner?.first_name, tenant.owner?.last_name]
                        .filter(Boolean)
                        .join(' ') ||
                        null);
                    const ownerEmail =
                      tenant.owner_email ?? tenant.owner?.email ?? null;
                    return (
                      <tr
                        key={tenant.id}
                        className='border-b border-border hover:bg-bgGray transition'
                      >
                        <td className='py-4 px-6'>
                          <input
                            type='checkbox'
                            aria-label={`Select ${tenant.name}`}
                            className='w-4 h-4 rounded border-border text-primary focus:ring-primary'
                          />
                        </td>
                        <td className='py-4 px-6'>
                          <div className='flex items-center'>
                            <div className='w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center font-bold text-white text-sm'>
                              {getInitials(tenant.name)}
                            </div>
                            <div className='ml-3'>
                              <Link
                                href={`/tenants/${tenant.id}`}
                                className='font-semibold text-textPrimary hover:text-primary'
                              >
                                {tenant.name}
                              </Link>
                              <div className='text-xs text-textSecondary'>
                                {tenant.primary_domain ||
                                  tenantStorefrontHost(tenant.slug)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className='py-4 px-6'>
                          <div className='flex items-center'>
                            {ownerName || ownerEmail ? (
                              <>
                                <div className='w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-700'>
                                  {ownerName
                                    ? getInitials(ownerName)
                                    : ((ownerEmail ?? '')[0]?.toUpperCase() ??
                                      '-')}
                                </div>
                                <div className='ml-2'>
                                  <div className='text-sm font-medium text-textPrimary'>
                                    {ownerName ?? '-'}
                                  </div>
                                  <div className='text-xs text-textSecondary'>
                                    {ownerEmail ?? '-'}
                                  </div>
                                  {tenant.owner_phone && (
                                    <div className='text-xs text-textSecondary'>
                                      {tenant.owner_phone}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className='text-sm text-textSecondary'>
.
                              </span>
                            )}
                          </div>
                        </td>
                        <td className='py-4 px-6'>
                          {getStatusBadge(tenant.status ?? '')}
                        </td>
                        <td className='py-4 px-6'>
                          {tenant.active_plan_name ? (
                            <div>
                              <div className='flex items-center gap-2'>
                                <span className='text-sm font-medium text-textPrimary'>
                                  {tenant.active_plan_name}
                                </span>
                                {tenant.active_plan_status === 'TRIALING' && (
                                  <span className='text-primary text-[10px] font-semibold'>
                                    Trial
                                  </span>
                                )}
                              </div>
                              {tenant.active_period_start &&
                                tenant.active_period_end && (
                                  <div className='text-xs text-textSecondary mt-0.5'>
                                    {new Date(
                                      tenant.active_period_start,
                                    ).toLocaleDateString()}{' '}
                                    to{' '}
                                    {new Date(
                                      tenant.active_period_end,
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              {tenant.active_billing_cycle && (
                                <div className='text-xs text-textSecondary capitalize'>
                                  {tenant.active_billing_cycle.toLowerCase()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className='text-sm text-textSecondary'>
                              No plan
                            </div>
                          )}
                        </td>
                        <td className='py-4 px-6'>
                          <span className='text-sm text-textPrimary'>
                            {tenant.applications_count != null
                              ? `${tenant.applications_count} apps`
                              : '-'}
                          </span>
                        </td>
                        <td className='py-4 px-6'>
                          <span className='text-sm text-textPrimary'>
                            {tenant.users_count != null
                              ? tenant.users_count
                              : '-'}
                          </span>
                        </td>
                        <td className='py-4 px-6'>
                          <div className='text-sm text-textPrimary'>
                            {tenant.created_at
                              ? new Date(tenant.created_at).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </td>
                        <td className='py-4 px-6 text-right'>
                          <div
                            className='relative flex justify-end'
                            ref={
                              actionsOpenId === tenant.id ? actionsRef : null
                            }
                          >
                            <button
                              type='button'
                              onClick={(e) => {
                                if (actionsOpenId === tenant.id) {
                                  setActionsOpenId(null);
                                  setAnchorRect(null);
                                } else {
                                  setActionsOpenId(tenant.id);
                                  setAnchorRect(
                                    (
                                      e.currentTarget as HTMLElement
                                    ).getBoundingClientRect(),
                                  );
                                }
                              }}
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'
                              aria-label='Actions'
                            >
                              <MoreVertical className='h-4 w-4' />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className='p-6 border-t border-border'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-4'>
                <div className='text-sm text-textSecondary'>
                  Showing {(currentPage - 1) * limit + 1}-
                  {Math.min(currentPage * limit, total)} of {total} tenants
                </div>
                <select
                  className='h-9 px-3 bg-surface border border-border rounded-lg text-sm text-textPrimary focus:outline-none focus:border-primary'
                  value={limit}
                  disabled
                  aria-label='Items per page'
                >
                  <option>10 per page</option>
                  <option>25 per page</option>
                  <option>50 per page</option>
                  <option>100 per page</option>
                </select>
              </div>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label='Previous page'
                  className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textSecondary hover:bg-bgGray transition disabled:opacity-50'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, i) => i + 1,
                ).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg font-medium text-sm ${
                      currentPage === page
                        ? 'bg-primary text-white'
                        : 'border border-border text-textPrimary hover:bg-bgGray'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {totalPages > 5 && (
                  <>
                    <span className='text-textSecondary px-2'>...</span>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textPrimary hover:bg-bgGray text-sm'
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label='Next page'
                  className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textSecondary hover:bg-bgGray transition disabled:opacity-50'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions dropdown (portal so it is not clipped by table overflow) */}
      {actionsOpenId &&
        anchorRect &&
        typeof document !== 'undefined' &&
        (() => {
          const tenant = tenants.find((t) => t.id === actionsOpenId);
          if (!tenant) return null;
          return createPortal(
            <div
              ref={menuRef}
              className='fixed z-[100] w-48 rounded-lg border border-border bg-surface py-1 shadow-lg'
              style={{
                right: window.innerWidth - anchorRect.right,
                bottom: window.innerHeight - anchorRect.top + 8,
              }}
            >
              <Link
                href={`/tenants/${tenant.id}`}
                className='flex w-full items-center gap-2 px-4 py-2 text-sm text-textPrimary hover:bg-bgGray'
                onClick={() => {
                  setActionsOpenId(null);
                  setAnchorRect(null);
                }}
              >
                <Eye className='h-4 w-4' />
                View
              </Link>
              <Link
                href={`/tenants/${tenant.id}/edit`}
                className='flex w-full items-center gap-2 px-4 py-2 text-sm text-textPrimary hover:bg-bgGray'
                onClick={() => {
                  setActionsOpenId(null);
                  setAnchorRect(null);
                }}
              >
                <Pencil className='h-4 w-4' />
                Edit
              </Link>
              {tenant.status === 'SUSPENDED' ? (
                <button
                  type='button'
                  className='flex w-full items-center gap-2 px-4 py-2 text-sm text-textPrimary hover:bg-bgGray'
                  onClick={() => {
                    setReactivateTarget({
                      id: tenant.id,
                      name: tenant.name,
                    });
                    setActionsOpenId(null);
                    setAnchorRect(null);
                  }}
                >
                  <Play className='h-4 w-4' />
                  Reactivate
                </button>
              ) : (
                <button
                  type='button'
                  className='flex w-full items-center gap-2 px-4 py-2 text-sm text-textPrimary hover:bg-bgGray'
                  onClick={() => {
                    setSuspendModal({
                      id: tenant.id,
                      name: tenant.name,
                    });
                    setSuspendReason('');
                    setActionsOpenId(null);
                    setAnchorRect(null);
                  }}
                >
                  <Pause className='h-4 w-4' />
                  Suspend
                </button>
              )}
              <div className='my-1 border-t border-border' />
              <button
                type='button'
                className='flex w-full items-center gap-2 px-4 py-2 text-sm text-error hover:bg-red-50'
                onClick={() => {
                  setDeleteTarget({
                    id: tenant.id,
                    name: tenant.name,
                  });
                  setDeleteConfirmText('');
                  setActionsOpenId(null);
                  setAnchorRect(null);
                }}
              >
                <Trash2 className='h-4 w-4' />
                Delete
              </button>
            </div>,
            document.body,
          );
        })()}

      {/* Suspend modal */}
      {suspendModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !suspendTenantMutation.isLoading && setSuspendModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-textPrimary'>
                Suspend tenant
              </h3>
              <button
                type='button'
                onClick={() =>
                  !suspendTenantMutation.isLoading && setSuspendModal(null)
                }
                disabled={suspendTenantMutation.isLoading}
                className='rounded-lg p-1 text-textSecondary hover:bg-bgGray hover:text-textPrimary disabled:opacity-50'
                aria-label='Close'
              >
                <X className='h-5 w-5' />
              </button>
            </div>
            <p className='text-sm text-textSecondary mb-3'>
              Suspend <strong>{suspendModal.name}</strong>. Provide a reason
              (required).
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder='Reason for suspension...'
              rows={3}
              className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
              disabled={suspendTenantMutation.isLoading}
            />
            <div className='mt-4 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !suspendTenantMutation.isLoading && setSuspendModal(null)
                }
                disabled={suspendTenantMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleSuspendSubmit}
                disabled={
                  !suspendReason.trim() || suspendTenantMutation.isLoading
                }
                className='flex-1 flex items-center justify-center rounded-lg bg-warning px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50'
              >
                {suspendTenantMutation.isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Suspending...
                  </>
                ) : (
                  'Suspend'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate confirm */}
      <ConfirmModal
        isOpen={!!reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        onConfirm={handleReactivateConfirm}
        title='Reactivate tenant'
        message={
          reactivateTarget
            ? `Reactivate "${reactivateTarget.name}"? The tenant will be able to use the platform again.`
            : ''
        }
        confirmText='Reactivate'
        cancelText='Cancel'
        variant='success'
        isLoading={reactivateTenantMutation.isLoading}
      />

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !deleteTenantMutation.isLoading && setDeleteTarget(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-red-100'>
                  <AlertTriangle className='h-5 w-5 text-error' />
                </div>
                <h3 className='text-lg font-semibold text-textPrimary'>
                  Delete tenant permanently
                </h3>
              </div>
              <button
                type='button'
                onClick={() =>
                  !deleteTenantMutation.isLoading && setDeleteTarget(null)
                }
                disabled={deleteTenantMutation.isLoading}
                className='rounded-lg p-1 text-textSecondary hover:bg-bgGray hover:text-textPrimary disabled:opacity-50'
                aria-label='Close'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='rounded-lg border border-red-200 bg-red-50 p-4 mb-4'>
              <p className='text-sm text-red-800 font-medium mb-2'>
                This action is permanent and cannot be undone.
              </p>
              <p className='text-sm text-red-700'>
                All data associated with <strong>{deleteTarget.name}</strong>{' '}
                will be permanently deleted, including courses, books, members,
                enrollments, payments, subscriptions, entitlements, and all
                related records.
              </p>
            </div>

            <div className='mb-4'>
              <label className='block text-sm font-medium text-textPrimary mb-2'>
                Type <strong>{deleteTarget.name}</strong> to confirm
              </label>
              <input
                type='text'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.name}
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-error focus:ring-1 focus:ring-error'
                disabled={deleteTenantMutation.isLoading}
                autoComplete='off'
              />
            </div>

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !deleteTenantMutation.isLoading && setDeleteTarget(null)
                }
                disabled={deleteTenantMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleDeleteConfirm}
                disabled={
                  deleteConfirmText !== deleteTarget.name ||
                  deleteTenantMutation.isLoading
                }
                className='flex-1 flex items-center justify-center rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50'
              >
                {deleteTenantMutation.isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Deleting...
                  </>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => {
              setShowExportModal(false);
              setExportError('');
            }}
          />
          <div className='relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-lg font-semibold text-textPrimary'>
                Export Tenants
              </h2>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportError('');
                }}
                className='text-textSecondary hover:text-textPrimary transition'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <p className='text-sm text-textSecondary mb-5'>
              Filter by signup date range. Leave both fields empty to export all
              tenants.
            </p>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-textPrimary mb-1.5'>
                  Start Date
                </label>
                <input
                  type='date'
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className='w-full h-10 px-3 border border-border rounded-lg text-sm text-textPrimary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-textPrimary mb-1.5'>
                  End Date
                </label>
                <input
                  type='date'
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  min={exportStartDate || undefined}
                  className='w-full h-10 px-3 border border-border rounded-lg text-sm text-textPrimary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
                />
              </div>
            </div>

            {exportError && (
              <p className='mt-3 text-sm text-red-500'>{exportError}</p>
            )}

            <div className='flex items-center justify-end gap-3 mt-6'>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportError('');
                }}
                className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition'
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className='h-10 px-5 bg-primarySolid hover:bg-primaryHover disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center gap-2'
              >
                {isExporting ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className='h-4 w-4' />
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
