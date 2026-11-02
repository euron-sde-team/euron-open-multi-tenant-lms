'use client';

import axios from 'axios';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Globe,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pause,
  Pen,
  Phone,
  Play,
  Search,
  Shield,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useCancelSubscription,
  useCancelTenantAddon,
  useCreateAdminEntitlement,
  useCreateSubscription,
  useGetApplications,
  useGetAvailableAddons,
  useGetEntitlements,
  useGetPlans,
  useGetPlanVersions,
  useGetProducts,
  useGetSubscriptions,
  useGetTenant,
  useGetTenantAddons,
  useGetTenantApplications,
  useGetTenantAuditLogs,
  useGetTenantMembers,
  useGetTenantUsers,
  useGrantAddonToTenant,
  useGrantApplicationToTenant,
  useOverrideEntitlement,
  useReactivateTenant,
  useReconcileUsage,
  useResetEntitlementUsage,
  useRevokeAdminEntitlement,
  useSuspendTenant,
  useUpdateEntitlementUsage,
  useUpdateTenantApplication,
} from '@/lib/api/hooks';
import { exportTenantStaffMembers } from '@/lib/api/tenants';
import type {
  AddonSource,
  BillingCycle,
  CancelSubscriptionRequest,
  CreateSubscriptionRequest,
  Currency,
  EntitlementConflict,
  GrantApplicationRequest,
  MembershipStatus,
  TenantAppSource,
  TenantAppStatus,
  TenantMemberStatus,
} from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

import ConfirmModal from '@/components/common/ConfirmModal';
import StatusBadge from '@/components/common/StatusBadge';

import OfferingsTab from './_components/OfferingsTab';
import RevenueTab from './_components/RevenueTab';
import SalesTab from './_components/SalesTab';

/** Derive plan version status for display (matches plan-versions page and plans/[id]/edit). */
function getPlanVersionStatus(version: {
  is_active?: boolean;
  retired_at?: string | null;
}): 'Active' | 'Draft' | 'Retired' {
  if (version.is_active) return 'Active';
  if (version.retired_at) return 'Retired';
  return 'Draft';
}

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [reactivateConfirm, setReactivateConfirm] = useState(false);
  const [assignPlanModal, setAssignPlanModal] = useState(false);
  const [assignPlanForm, setAssignPlanForm] = useState<{
    planId: string;
    planVersionId: string;
    billing_cycle: BillingCycle;
    currency: Currency;
    is_trial: boolean;
    trial_ends_at: string;
    valid_from: string;
    valid_to: string;
  }>({
    planId: '',
    planVersionId: '',
    billing_cycle: 'MONTHLY',
    currency: 'USD',
    is_trial: false,
    trial_ends_at: '',
    valid_from: '',
    valid_to: '',
  });
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [pendingAssignPayload, setPendingAssignPayload] = useState<{
    tenantId: string;
    data: CreateSubscriptionRequest;
  } | null>(null);
  const [limitConflicts, setLimitConflicts] = useState<EntitlementConflict[]>(
    [],
  );
  const [limitConflictOpen, setLimitConflictOpen] = useState(false);

  const { data: tenant, isLoading, error, refetch } = useGetTenant(tenantId);
  const suspendTenantMutation = useSuspendTenant();
  const reactivateTenantMutation = useReactivateTenant();
  const { data: subscriptionsData } = useGetSubscriptions(tenantId);
  const { data: plansData } = useGetPlans({ limit: 200 });
  const { data: planVersionsData } = useGetPlanVersions(
    assignPlanForm.planId || undefined,
    { limit: 100 },
  );
  const createSubscriptionMutation = useCreateSubscription();
  // No pagination on the entitlements panel, fetch all in one page
  const { data: entitlementsData } = useGetEntitlements(tenantId, {
    is_active: true,
    limit: 500,
  });
  const overrideEntitlementMutation = useOverrideEntitlement();
  const resetEntitlementUsageMutation = useResetEntitlementUsage();
  const updateEntitlementUsageMutation = useUpdateEntitlementUsage();
  const reconcileUsageMutation = useReconcileUsage();
  const createAdminEntitlementMutation = useCreateAdminEntitlement();
  const revokeAdminEntitlementMutation = useRevokeAdminEntitlement();
  const { data: allProductsData } = useGetProducts({ limit: 500 });
  const allProducts = allProductsData?.products ?? [];
  const { data: tenantAddonsData } = useGetTenantAddons(tenantId);
  const { data: availableAddonsData } = useGetAvailableAddons({ limit: 200 });
  const grantAddonMutation = useGrantAddonToTenant();
  const cancelTenantAddonMutation = useCancelTenantAddon();
  const { data: allApplicationsData } = useGetApplications({ limit: 200 });
  const grantAppMutation = useGrantApplicationToTenant();
  const updateTenantAppMutation = useUpdateTenantApplication();

  const subscriptions = subscriptionsData?.data ?? [];
  const plans = plansData?.plans ?? [];
  const planVersions = planVersionsData?.versions ?? [];
  const entitlements = entitlementsData?.data ?? [];
  const tenantAddons = tenantAddonsData?.data ?? [];
  const availableAddons = availableAddonsData?.addons ?? [];
  const allApplications = allApplicationsData?.applications ?? [];

  const [overrideModal, setOverrideModal] = useState<{
    id: string;
    feature_key: string;
    limit_value: number | null;
  } | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    new_limit_value: '',
    reason: '',
  });
  const [resetModal, setResetModal] = useState<{
    id: string;
    feature_key: string;
  } | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [updateUsageModal, setUpdateUsageModal] = useState<{
    id: string;
    feature_key: string;
    used_value: number;
  } | null>(null);
  const [updateUsageForm, setUpdateUsageForm] = useState({
    new_used_value: '',
    reason: '',
  });
  const [grantEntitlementModal, setGrantEntitlementModal] = useState(false);
  const [grantEntitlementForm, setGrantEntitlementForm] = useState({
    product_id: '',
    limit_value: '',
    is_unlimited: false,
    reason: '',
  });
  const [revokeModal, setRevokeModal] = useState<{
    id: string;
    feature_key: string;
  } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [grantAddonModal, setGrantAddonModal] = useState(false);
  const [grantAddonForm, setGrantAddonForm] = useState<{
    addon_id: string;
    source: AddonSource;
    custom_grant_value: string;
    reason: string;
    expires_at: string;
  }>({
    addon_id: '',
    source: 'ADMIN_FREE',
    custom_grant_value: '',
    reason: '',
    expires_at: '',
  });
  const [cancelAddonModal, setCancelAddonModal] = useState<{
    id: string;
    addon_name: string;
  } | null>(null);
  const [cancelAddonReason, setCancelAddonReason] = useState('');

  // Cancel subscription modal
  const [cancelSubModal, setCancelSubModal] = useState<{
    id: string;
    plan_name: string;
  } | null>(null);
  const [cancelSubForm, setCancelSubForm] = useState<{
    reason: string;
    cancel_immediately: boolean;
  }>({ reason: '', cancel_immediately: true });
  const cancelSubscriptionMutation = useCancelSubscription();

  // Grant application modal
  const [grantAppModal, setGrantAppModal] = useState(false);
  const [grantAppForm, setGrantAppForm] = useState<{
    application_id: string;
    source: GrantApplicationRequest['source'];
    reason: string;
    trial_ends_at: string;
  }>({
    application_id: '',
    source: 'ADMIN_GRANT',
    reason: '',
    trial_ends_at: '',
  });

  // Applications tab
  const [appsSearchQuery, setAppsSearchQuery] = useState('');
  const [appsStatusFilter, setAppsStatusFilter] = useState<
    TenantAppStatus | ''
  >('');
  const [appsSourceFilter, setAppsSourceFilter] = useState<
    TenantAppSource | ''
  >('');
  const [appsPage, setAppsPage] = useState(1);
  const [appsLimit, setAppsLimit] = useState(10);
  const debouncedAppsSearch = useDebounce(appsSearchQuery, 300);
  const { data: appsData, isLoading: appsLoading } = useGetTenantApplications(
    tenantId,
    {
      search: debouncedAppsSearch || undefined,
      status: appsStatusFilter || undefined,
      source: appsSourceFilter || undefined,
      page: appsPage,
      limit: appsLimit,
    },
  );
  const applications = appsData?.data ?? [];
  const appsTotal = appsData?.total ?? 0;
  const appsTotalPages = appsData?.totalPages ?? 1;

  // Users tab (staff members)
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState<
    MembershipStatus | ''
  >('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit, setUsersLimit] = useState(10);
  const debouncedUsersSearch = useDebounce(usersSearchQuery, 300);
  const { data: usersData, isLoading: usersLoading } = useGetTenantUsers(
    tenantId,
    {
      search: debouncedUsersSearch || undefined,
      status: usersStatusFilter || undefined,
      page: usersPage,
      limit: usersLimit,
    },
  );
  const tenantUsers = usersData?.data ?? [];
  const usersTotal = usersData?.total ?? 0;
  const usersTotalPages = usersData?.totalPages ?? 1;

  // Members tab (end-users)
  const [membersSearchQuery, setMembersSearchQuery] = useState('');
  const [membersStatusFilter, setMembersStatusFilter] = useState<
    TenantMemberStatus | ''
  >('');
  const [membersPage, setMembersPage] = useState(1);
  const [membersLimit, setMembersLimit] = useState(10);
  const debouncedMembersSearch = useDebounce(membersSearchQuery, 300);
  const { data: membersData, isLoading: membersLoading } = useGetTenantMembers(
    tenantId,
    {
      search: debouncedMembersSearch || undefined,
      status: membersStatusFilter || undefined,
      page: membersPage,
      limit: membersLimit,
    },
  );
  const members = membersData?.data ?? [];
  const membersTotal = membersData?.total ?? 0;
  const membersTotalPages = membersData?.totalPages ?? 1;

  // Audit Log tab
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(10);
  const { data: auditData, isLoading: auditLoading } = useGetTenantAuditLogs(
    tenantId,
    { page: auditPage, limit: auditLimit },
  );
  const auditLogs = auditData?.data ?? [];
  const auditTotal = auditData?.total ?? 0;
  const auditTotalPages = auditData?.totalPages ?? 1;

  // Staff export
  const [showStaffExportModal, setShowStaffExportModal] = useState(false);
  const [staffExportStartDate, setStaffExportStartDate] = useState('');
  const [staffExportEndDate, setStaffExportEndDate] = useState('');
  const [isExportingStaff, setIsExportingStaff] = useState(false);
  const [staffExportError, setStaffExportError] = useState('');

  const handleStaffExport = async () => {
    setIsExportingStaff(true);
    setStaffExportError('');
    try {
      const blob = await exportTenantStaffMembers(
        tenantId as string,
        staffExportStartDate || undefined,
        staffExportEndDate || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff-members-${tenantId}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowStaffExportModal(false);
      setStaffExportStartDate('');
      setStaffExportEndDate('');
    } catch {
      setStaffExportError('Export failed. Please try again.');
    } finally {
      setIsExportingStaff(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center p-8'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
          <p className='text-textSecondary'>Loading tenant...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className='flex h-96 items-center justify-center p-8'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load tenant
          </h3>
          <p className='mt-2 text-textSecondary'>
            {error?.message ?? 'Tenant not found'}
          </p>
          <button
            type='button'
            onClick={() => refetch()}
            className='mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getStatusBadge = (status: string) => (
    <StatusBadge status={status || '-'} />
  );

  const ownerName =
    tenant.owner?.name ??
    [tenant.owner?.first_name, tenant.owner?.last_name]
      .filter(Boolean)
      .join(' ') ??
    '';
  const ownerEmail = tenant.owner?.email ?? '';
  const planName = tenant.active_subscription?.plan_name_snapshot ?? 'No plan';
  const createdDate = tenant.created_at
    ? new Date(tenant.created_at).toLocaleDateString()
    : 'N/A';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'applications', label: 'Applications' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'entitlements', label: 'Entitlements' },
    { id: 'offerings', label: 'Offerings' },
    { id: 'sales', label: 'Sales' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'members', label: 'Members' },
    { id: 'users', label: 'Users' },
    { id: 'audit', label: 'Audit Log' },
  ];

  // Placeholder recent activity (real data can be wired when API available)
  const recentActivity = [
    {
      type: 'subscription',
      title: 'Subscription',
      detail: tenant.active_subscription
        ? `${planName} • ${tenant.active_subscription.status ?? 'Active'}`
        : 'No active plan',
      time: createdDate,
      icon: DollarSign,
      bgColor: 'bg-primary-100',
      iconColor: 'text-primary',
    },
    {
      type: 'owner',
      title: 'Account Owner',
      detail: ownerName || ownerEmail || '-',
      time: ownerEmail,
      icon: UserPlus,
      bgColor: 'bg-green-100',
      iconColor: 'text-success',
    },
  ];

  return (
    <div className='p-8'>
      {/* Breadcrumb */}
      <section className='mb-6'>
        <div className='flex items-center text-sm text-textSecondary'>
          <Link href='/tenants' className='hover:text-primary'>
            Tenants
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <span className='text-textPrimary font-medium'>{tenant.name}</span>
        </div>
      </section>

      {/* Tenant Header */}
      <section className='mb-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-6 flex items-start justify-between'>
            <div className='flex items-start'>
              <div className='flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 font-bold text-2xl text-white'>
                {getInitials(tenant.name)}
              </div>
              <div className='ml-5'>
                <div className='mb-2 flex items-center'>
                  <h1 className='text-3xl font-bold text-textPrimary'>
                    {tenant.name}
                  </h1>
                  <span className='ml-4'>
                    {getStatusBadge(tenant.status ?? '')}
                  </span>
                </div>
                <div className='mb-3 flex items-center space-x-4 text-sm text-textSecondary'>
                  <div className='flex items-center'>
                    <Link2 className='mr-2 h-4 w-4' />
                    <span className='font-mono'>{tenant.slug}</span>
                  </div>
                  {tenant.custom_domain && (
                    <div className='flex items-center'>
                      <Globe className='mr-2 h-4 w-4' />
                      <a
                        href={`https://${tenant.custom_domain}`}
                        className='text-primary hover:underline'
                      >
                        {tenant.custom_domain}
                      </a>
                    </div>
                  )}
                  <div className='flex items-center'>
                    <Calendar className='mr-2 h-4 w-4' />
                    <span>Created {createdDate}</span>
                  </div>
                </div>
                {(ownerName || ownerEmail) && (
                  <div className='flex items-center space-x-6'>
                    <div>
                      <div className='mb-1 text-xs text-textSecondary'>
                        Account Owner
                      </div>
                      <div className='flex items-center'>
                        <div className='mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium'>
                          {ownerName
                            ? getInitials(ownerName)
                            : (ownerEmail[0]?.toUpperCase() ?? '-')}
                        </div>
                        <span className='font-medium text-textPrimary'>
                          {ownerName || '-'}
                        </span>
                        {ownerEmail && (
                          <a
                            href={`mailto:${ownerEmail}`}
                            className='ml-2 text-sm text-primary hover:underline'
                          >
                            {ownerEmail}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='flex items-center space-x-3'>
              {tenant.status === 'SUSPENDED' ? (
                <button
                  type='button'
                  onClick={() => setReactivateConfirm(true)}
                  disabled={reactivateTenantMutation.isLoading}
                  className='flex h-10 items-center rounded-lg border border-success px-4 text-sm font-medium text-success hover:bg-green-50'
                >
                  <Play className='mr-2 h-4 w-4' />
                  Reactivate
                </button>
              ) : (
                <button
                  type='button'
                  onClick={() => setSuspendModal(true)}
                  disabled={suspendTenantMutation.isLoading}
                  className='flex h-10 items-center rounded-lg border border-warning px-4 text-sm font-medium text-warning hover:bg-amber-50'
                >
                  <Pause className='mr-2 h-4 w-4' />
                  Suspend
                </button>
              )}
              <Link
                href={`/tenants/${tenant.id}/edit`}
                className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white hover:bg-primaryHover'
              >
                <Pen className='mr-2 h-4 w-4' />
                Edit Tenant
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className='grid grid-cols-4 gap-6 border-t border-border pt-6'>
            <div>
              <div className='mb-2 text-sm text-textSecondary'>
                Current Plan
              </div>
              <div className='text-xl font-bold text-textPrimary'>
                {planName}
              </div>
              <div className='mt-1 text-xs text-textSecondary'>
                {tenant.active_subscription?.price_snapshot != null
                  ? `${tenant.active_subscription.currency ?? ''} ${tenant.active_subscription.price_snapshot}/mo`
                  : '-'}
              </div>
            </div>
            <div>
              <div className='mb-2 text-sm text-textSecondary'>
                Subscriptions
              </div>
              <div className='text-xl font-bold text-textPrimary'>
                {tenant.subscription_count ?? 0}
              </div>
              <div className='mt-1 text-xs text-textSecondary'>total</div>
            </div>
            <div>
              <div className='mb-2 text-sm text-textSecondary'>
                Users / Members
              </div>
              <div className='text-xl font-bold text-textPrimary'>
                {tenant.users_count ?? '-'}
              </div>
              <div className='mt-1 text-xs text-textSecondary'>-</div>
            </div>
            <div>
              <div className='mb-2 text-sm text-textSecondary'>
                Applications
              </div>
              <div className='text-xl font-bold text-textPrimary'>
                {tenant.applications_count ?? '-'}
              </div>
              <div className='mt-1 text-xs text-textSecondary'>-</div>
            </div>
          </div>
        </div>
      </section>

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
              !suspendTenantMutation.isLoading && setSuspendModal(false)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Suspend tenant
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Suspend <strong>{tenant.name}</strong>. Provide a reason
              (required).
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder='Reason for suspension...'
              rows={3}
              className='mb-4 w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              disabled={suspendTenantMutation.isLoading}
            />
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !suspendTenantMutation.isLoading && setSuspendModal(false)
                }
                disabled={suspendTenantMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!suspendReason.trim()) return;
                  suspendTenantMutation.mutate(
                    { id: tenant.id, reason: suspendReason.trim() },
                    {
                      onSuccess: () => {
                        setSuspendModal(false);
                        setSuspendReason('');
                      },
                    },
                  );
                }}
                disabled={
                  !suspendReason.trim() || suspendTenantMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-warning px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50'
              >
                {suspendTenantMutation.isLoading ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate confirm */}
      <ConfirmModal
        isOpen={reactivateConfirm}
        onClose={() => setReactivateConfirm(false)}
        onConfirm={() => {
          reactivateTenantMutation.mutate(tenant.id, {
            onSuccess: () => setReactivateConfirm(false),
          });
        }}
        title='Reactivate tenant'
        message={`Reactivate "${tenant.name}"? The tenant will be able to use the platform again.`}
        confirmText='Reactivate'
        cancelText='Cancel'
        variant='success'
        isLoading={reactivateTenantMutation.isLoading}
      />

      {/* Assign plan modal */}
      {assignPlanModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !createSubscriptionMutation.isLoading && setAssignPlanModal(false)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Assign plan
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Plan
                </label>
                <select
                  value={assignPlanForm.planId}
                  onChange={(e) =>
                    setAssignPlanForm((prev) => ({
                      ...prev,
                      planId: e.target.value,
                      planVersionId: '',
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                >
                  <option value=''>Select plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Plan version
                </label>
                <select
                  value={assignPlanForm.planVersionId}
                  onChange={(e) =>
                    setAssignPlanForm((prev) => ({
                      ...prev,
                      planVersionId: e.target.value,
                    }))
                  }
                  disabled={!assignPlanForm.planId}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50'
                >
                  <option value=''>Select version</option>
                  {planVersions.map((pv) => (
                    <option key={pv.id} value={pv.id}>
                      v{pv.version} ({getPlanVersionStatus(pv)})
                    </option>
                  ))}
                </select>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Billing cycle
                  </label>
                  <select
                    value={assignPlanForm.billing_cycle}
                    onChange={(e) =>
                      setAssignPlanForm((prev) => ({
                        ...prev,
                        billing_cycle: e.target.value as BillingCycle,
                      }))
                    }
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  >
                    <option value='MONTHLY'>Monthly</option>
                    <option value='YEARLY'>Yearly</option>
                  </select>
                </div>
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Currency
                  </label>
                  <select
                    value={assignPlanForm.currency}
                    onChange={(e) =>
                      setAssignPlanForm((prev) => ({
                        ...prev,
                        currency: e.target.value as Currency,
                      }))
                    }
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  >
                    <option value='USD'>USD</option>
                    <option value='INR'>INR</option>
                  </select>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  id='assign-plan-trial'
                  checked={assignPlanForm.is_trial}
                  onChange={(e) =>
                    setAssignPlanForm((prev) => ({
                      ...prev,
                      is_trial: e.target.checked,
                    }))
                  }
                  className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                />
                <label
                  htmlFor='assign-plan-trial'
                  className='text-sm font-medium text-textPrimary'
                >
                  Trial
                </label>
              </div>
              {assignPlanForm.is_trial && (
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Trial ends at
                  </label>
                  <input
                    type='date'
                    value={assignPlanForm.trial_ends_at}
                    onChange={(e) =>
                      setAssignPlanForm((prev) => ({
                        ...prev,
                        trial_ends_at: e.target.value,
                      }))
                    }
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  />
                </div>
              )}
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Valid from
                  </label>
                  <input
                    type='date'
                    value={assignPlanForm.valid_from}
                    onChange={(e) =>
                      setAssignPlanForm((prev) => ({
                        ...prev,
                        valid_from: e.target.value,
                      }))
                    }
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  />
                </div>
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Valid to
                  </label>
                  <input
                    type='date'
                    value={assignPlanForm.valid_to}
                    min={assignPlanForm.valid_from || undefined}
                    onChange={(e) =>
                      setAssignPlanForm((prev) => ({
                        ...prev,
                        valid_to: e.target.value,
                      }))
                    }
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  />
                </div>
              </div>
              <p className='text-xs text-textSecondary'>
                Leave the validity range empty to derive the period from the
                billing cycle.
              </p>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !createSubscriptionMutation.isLoading &&
                  setAssignPlanModal(false)
                }
                disabled={createSubscriptionMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!assignPlanForm.planVersionId) return;
                  const data: CreateSubscriptionRequest = {
                    plan_version_id: assignPlanForm.planVersionId,
                    billing_cycle: assignPlanForm.billing_cycle,
                    currency: assignPlanForm.currency,
                    is_trial: assignPlanForm.is_trial || undefined,
                    trial_ends_at: assignPlanForm.is_trial
                      ? assignPlanForm.trial_ends_at || undefined
                      : undefined,
                    valid_from: assignPlanForm.valid_from || undefined,
                    valid_to: assignPlanForm.valid_to || undefined,
                  };
                  createSubscriptionMutation.mutate(
                    { tenantId: tenant.id, data },
                    {
                      onSuccess: () => {
                        setAssignPlanModal(false);
                        setReplaceConfirmOpen(false);
                        setPendingAssignPayload(null);
                        setAssignPlanForm({
                          planId: '',
                          planVersionId: '',
                          billing_cycle: 'MONTHLY',
                          currency: 'USD',
                          is_trial: false,
                          trial_ends_at: '',
                          valid_from: '',
                          valid_to: '',
                        });
                      },
                      onError: (err) => {
                        if (
                          axios.isAxiosError(err) &&
                          err.response?.status === 409
                        ) {
                          const errorData = err.response.data?.error;
                          if (
                            errorData?.code === 'ENTITLEMENT_LIMIT_EXCEEDED'
                          ) {
                            // Usage exceeds new plan limits, show conflict modal
                            setPendingAssignPayload({
                              tenantId: tenant.id,
                              data,
                            });
                            setLimitConflicts(errorData.conflicts ?? []);
                            setLimitConflictOpen(true);
                          } else {
                            // Tenant already has active subscription, show replace confirm
                            setPendingAssignPayload({
                              tenantId: tenant.id,
                              data,
                            });
                            setReplaceConfirmOpen(true);
                          }
                        }
                      },
                    },
                  );
                }}
                disabled={
                  !assignPlanForm.planVersionId ||
                  createSubscriptionMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {createSubscriptionMutation.isLoading
                  ? 'Assigning...'
                  : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace existing subscription confirm */}
      <ConfirmModal
        isOpen={replaceConfirmOpen}
        onClose={() => {
          setReplaceConfirmOpen(false);
          setPendingAssignPayload(null);
        }}
        onConfirm={() => {
          if (!pendingAssignPayload) return;
          createSubscriptionMutation.mutate(
            {
              tenantId: pendingAssignPayload.tenantId,
              data: {
                ...pendingAssignPayload.data,
                replace_existing: true,
              },
            },
            {
              onSuccess: () => {
                setReplaceConfirmOpen(false);
                setPendingAssignPayload(null);
                setAssignPlanModal(false);
                setAssignPlanForm({
                  planId: '',
                  planVersionId: '',
                  billing_cycle: 'MONTHLY',
                  currency: 'USD',
                  is_trial: false,
                  trial_ends_at: '',
                  valid_from: '',
                  valid_to: '',
                });
              },
              onError: (err) => {
                if (axios.isAxiosError(err) && err.response?.status === 409) {
                  const errorData = err.response.data?.error;
                  if (errorData?.code === 'ENTITLEMENT_LIMIT_EXCEEDED') {
                    setReplaceConfirmOpen(false);
                    setPendingAssignPayload({
                      tenantId: pendingAssignPayload.tenantId,
                      data: {
                        ...pendingAssignPayload.data,
                        replace_existing: true,
                      },
                    });
                    setLimitConflicts(errorData.conflicts ?? []);
                    setLimitConflictOpen(true);
                  }
                }
              },
            },
          );
        }}
        title='Replace existing subscription?'
        message='This tenant already has an active subscription. Replacing will cancel it immediately and assign the new plan. App access and entitlements will switch to the new plan. Billing implications may apply when we add billing.'
        confirmText='Replace'
        cancelText='Cancel'
        variant='warning'
        isLoading={createSubscriptionMutation.isLoading}
      />

      {/* Entitlement limit conflict modal */}
      {limitConflictOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !createSubscriptionMutation.isLoading &&
              setLimitConflictOpen(false)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl'>
            <div className='mb-4 flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-red-100'>
                <AlertTriangle className='h-5 w-5 text-error' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-textPrimary'>
                  Usage exceeds new plan limits
                </h3>
                <p className='text-sm text-textSecondary'>
                  The following entitlements have usage that exceeds the new
                  plan&apos;s limits. Forcing will carry over existing usage
                  as-is (no new resources can be created until usage is within
                  limits).
                </p>
              </div>
            </div>

            <div className='mb-4 max-h-64 overflow-auto rounded-lg border border-border'>
              <table className='w-full text-left text-sm'>
                <thead className='sticky top-0 border-b border-border bg-bgGray'>
                  <tr>
                    <th className='px-3 py-2 font-semibold text-textSecondary'>
                      Feature
                    </th>
                    <th className='px-3 py-2 text-right font-semibold text-textSecondary'>
                      Used
                    </th>
                    <th className='px-3 py-2 text-right font-semibold text-textSecondary'>
                      New limit
                    </th>
                    <th className='px-3 py-2 text-right font-semibold text-textSecondary'>
                      Over by
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {limitConflicts.map((c) => (
                    <tr
                      key={c.feature_key}
                      className='border-b border-border last:border-0'
                    >
                      <td className='px-3 py-2'>
                        <span className='font-medium text-textPrimary'>
                          {c.feature_key}
                        </span>
                        <span className='ml-1 text-xs text-textSecondary'>
                          ({c.product_code})
                        </span>
                        {c.dropped && (
                          <span className='ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-error'>
                            Dropped
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-2 text-right font-medium text-textPrimary'>
                        {c.current_used}
                      </td>
                      <td className='px-3 py-2 text-right text-textSecondary'>
                        {c.dropped ? '-' : c.new_limit}
                      </td>
                      <td className='px-3 py-2 text-right font-medium text-error'>
                        +
                        {c.dropped
                          ? c.current_used
                          : c.current_used - c.new_limit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => {
                  setLimitConflictOpen(false);
                  setLimitConflicts([]);
                  setPendingAssignPayload(null);
                }}
                disabled={createSubscriptionMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!pendingAssignPayload) return;
                  createSubscriptionMutation.mutate(
                    {
                      tenantId: pendingAssignPayload.tenantId,
                      data: {
                        ...pendingAssignPayload.data,
                        force: true,
                      },
                    },
                    {
                      onSuccess: () => {
                        setLimitConflictOpen(false);
                        setLimitConflicts([]);
                        setPendingAssignPayload(null);
                        setAssignPlanModal(false);
                        setAssignPlanForm({
                          planId: '',
                          planVersionId: '',
                          billing_cycle: 'MONTHLY',
                          currency: 'USD',
                          is_trial: false,
                          trial_ends_at: '',
                          valid_from: '',
                          valid_to: '',
                        });
                      },
                    },
                  );
                }}
                disabled={createSubscriptionMutation.isLoading}
                className='flex flex-1 items-center justify-center rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50'
              >
                {createSubscriptionMutation.isLoading
                  ? 'Forcing...'
                  : 'Force assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override entitlement modal */}
      {overrideModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !overrideEntitlementMutation.isLoading && setOverrideModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Override limit
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Set a new limit for <strong>{overrideModal.feature_key}</strong>.
              Current limit: {overrideModal.limit_value ?? '-'}
            </p>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  New limit value
                </label>
                <input
                  type='number'
                  min={0}
                  value={overrideForm.new_limit_value}
                  onChange={(e) =>
                    setOverrideForm((prev) => ({
                      ...prev,
                      new_limit_value: e.target.value,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={overrideEntitlementMutation.isLoading}
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason <span className='text-error'>*</span>
                </label>
                <textarea
                  value={overrideForm.reason}
                  onChange={(e) =>
                    setOverrideForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder='Reason for override...'
                  rows={3}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={overrideEntitlementMutation.isLoading}
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !overrideEntitlementMutation.isLoading &&
                  setOverrideModal(null)
                }
                disabled={overrideEntitlementMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  const newLimit = Number(overrideForm.new_limit_value);
                  if (
                    Number.isNaN(newLimit) ||
                    newLimit < 0 ||
                    !overrideForm.reason.trim()
                  )
                    return;
                  overrideEntitlementMutation.mutate(
                    {
                      tenantId: tenant.id,
                      entitlementId: overrideModal.id,
                      data: {
                        new_limit_value: newLimit,
                        reason: overrideForm.reason.trim(),
                      },
                    },
                    {
                      onSuccess: () => {
                        setOverrideModal(null);
                        setOverrideForm({ new_limit_value: '', reason: '' });
                      },
                    },
                  );
                }}
                disabled={
                  !overrideForm.reason.trim() ||
                  overrideEntitlementMutation.isLoading ||
                  Number.isNaN(Number(overrideForm.new_limit_value)) ||
                  Number(overrideForm.new_limit_value) < 0
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {overrideEntitlementMutation.isLoading
                  ? 'Saving...'
                  : 'Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset usage modal */}
      {resetModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !resetEntitlementUsageMutation.isLoading && setResetModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Reset usage
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Reset usage for <strong>{resetModal.feature_key}</strong>. This
              will set current usage back to zero.
            </p>
            <div>
              <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                Reason <span className='text-error'>*</span>
              </label>
              <textarea
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder='Reason for reset...'
                rows={3}
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={resetEntitlementUsageMutation.isLoading}
              />
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !resetEntitlementUsageMutation.isLoading &&
                  setResetModal(null)
                }
                disabled={resetEntitlementUsageMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!resetReason.trim()) return;
                  resetEntitlementUsageMutation.mutate(
                    {
                      tenantId: tenant.id,
                      entitlementId: resetModal.id,
                      data: { reason: resetReason.trim() },
                    },
                    {
                      onSuccess: () => {
                        setResetModal(null);
                        setResetReason('');
                      },
                    },
                  );
                }}
                disabled={
                  !resetReason.trim() || resetEntitlementUsageMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {resetEntitlementUsageMutation.isLoading
                  ? 'Resetting...'
                  : 'Reset usage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update usage modal */}
      {updateUsageModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !updateEntitlementUsageMutation.isLoading &&
              setUpdateUsageModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Update usage
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Set a new usage value for{' '}
              <strong>{updateUsageModal.feature_key}</strong>. Current usage:{' '}
              {updateUsageModal.used_value}
            </p>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  New used value
                </label>
                <input
                  type='number'
                  min={0}
                  value={updateUsageForm.new_used_value}
                  onChange={(e) =>
                    setUpdateUsageForm((prev) => ({
                      ...prev,
                      new_used_value: e.target.value,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={updateEntitlementUsageMutation.isLoading}
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason <span className='text-error'>*</span>
                </label>
                <textarea
                  value={updateUsageForm.reason}
                  onChange={(e) =>
                    setUpdateUsageForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder='Reason for updating usage...'
                  rows={3}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={updateEntitlementUsageMutation.isLoading}
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !updateEntitlementUsageMutation.isLoading &&
                  setUpdateUsageModal(null)
                }
                disabled={updateEntitlementUsageMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  const newUsed = Number(updateUsageForm.new_used_value);
                  if (
                    Number.isNaN(newUsed) ||
                    newUsed < 0 ||
                    !updateUsageForm.reason.trim()
                  )
                    return;
                  updateEntitlementUsageMutation.mutate(
                    {
                      tenantId: tenant.id,
                      entitlementId: updateUsageModal.id,
                      data: {
                        new_used_value: newUsed,
                        reason: updateUsageForm.reason.trim(),
                      },
                    },
                    {
                      onSuccess: () => {
                        setUpdateUsageModal(null);
                        setUpdateUsageForm({ new_used_value: '', reason: '' });
                      },
                    },
                  );
                }}
                disabled={
                  !updateUsageForm.reason.trim() ||
                  updateEntitlementUsageMutation.isLoading ||
                  Number.isNaN(Number(updateUsageForm.new_used_value)) ||
                  Number(updateUsageForm.new_used_value) < 0
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {updateEntitlementUsageMutation.isLoading
                  ? 'Saving...'
                  : 'Update usage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign admin entitlement modal */}
      {grantEntitlementModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !createAdminEntitlementMutation.isLoading &&
              setGrantEntitlementModal(false)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Assign entitlement
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Grant a standalone ADMIN-sourced entitlement for a product that
              isn&apos;t in the tenant&apos;s current plan.
            </p>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Product <span className='text-error'>*</span>
                </label>
                <select
                  value={grantEntitlementForm.product_id}
                  onChange={(e) =>
                    setGrantEntitlementForm((prev) => ({
                      ...prev,
                      product_id: e.target.value,
                      limit_value:
                        allProducts.find(
                          (p: { id: string; constraint_type: string }) =>
                            p.id === e.target.value,
                        )?.constraint_type === 'BOOLEAN'
                          ? '1'
                          : prev.limit_value,
                      is_unlimited: false,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={createAdminEntitlementMutation.isLoading}
                >
                  <option value=''>Select a product...</option>
                  {allProducts.map(
                    (p: {
                      id: string;
                      code: string;
                      constraint_type: string;
                      title?: string | null;
                    }) => (
                      <option key={p.id} value={p.id}>
                        {p.code} [{p.constraint_type}]
                        {p.title ? `, ${p.title}` : ''}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {(() => {
                const selectedProduct = allProducts.find(
                  (p: { id: string }) =>
                    p.id === grantEntitlementForm.product_id,
                ) as
                  | {
                      id: string;
                      constraint_type: string;
                      unit?: string | null;
                      code: string;
                    }
                  | undefined;
                if (!selectedProduct) return null;
                const cType = selectedProduct.constraint_type;
                const unit = selectedProduct.unit;

                if (cType === 'BOOLEAN') {
                  return (
                    <div className='rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800'>
                      This is a <strong>boolean</strong> feature. It will be{' '}
                      <strong>enabled</strong> for this tenant.
                    </div>
                  );
                }

                return (
                  <>
                    <div className='rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800'>
                      {cType === 'COUNT'
                        ? `This is a count-based product${unit ? ` (${unit})` : ''}. Set the maximum allowed count.`
                        : `This is a limit-based product${unit ? ` (${unit})` : ''}. Set the maximum usage limit.`}
                    </div>
                    <div className='flex items-center gap-3'>
                      <label className='flex items-center gap-2 text-sm font-medium text-textPrimary'>
                        <input
                          type='checkbox'
                          checked={grantEntitlementForm.is_unlimited}
                          onChange={(e) =>
                            setGrantEntitlementForm((prev) => ({
                              ...prev,
                              is_unlimited: e.target.checked,
                            }))
                          }
                          className='rounded border-border'
                          disabled={createAdminEntitlementMutation.isLoading}
                        />
                        Unlimited
                      </label>
                    </div>
                    {!grantEntitlementForm.is_unlimited && (
                      <div>
                        <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                          {cType === 'COUNT' ? 'Max count' : 'Limit value'}
                          {unit ? ` (${unit})` : ''}{' '}
                          <span className='text-error'>*</span>
                        </label>
                        <input
                          type='number'
                          min={0}
                          value={grantEntitlementForm.limit_value}
                          onChange={(e) =>
                            setGrantEntitlementForm((prev) => ({
                              ...prev,
                              limit_value: e.target.value,
                            }))
                          }
                          placeholder={
                            cType === 'COUNT' ? 'e.g. 10' : 'e.g. 50'
                          }
                          className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                          disabled={createAdminEntitlementMutation.isLoading}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason <span className='text-error'>*</span>
                </label>
                <textarea
                  value={grantEntitlementForm.reason}
                  onChange={(e) =>
                    setGrantEntitlementForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder='Reason for granting this entitlement (min 10 chars)...'
                  rows={3}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={createAdminEntitlementMutation.isLoading}
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !createAdminEntitlementMutation.isLoading &&
                  setGrantEntitlementModal(false)
                }
                disabled={createAdminEntitlementMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  const selectedProduct = allProducts.find(
                    (p: { id: string }) =>
                      p.id === grantEntitlementForm.product_id,
                  );
                  const isBool = selectedProduct?.constraint_type === 'BOOLEAN';
                  const limitValue = isBool
                    ? 1
                    : grantEntitlementForm.is_unlimited
                      ? 0
                      : Number(grantEntitlementForm.limit_value);
                  if (
                    !grantEntitlementForm.product_id ||
                    grantEntitlementForm.reason.trim().length < 10
                  )
                    return;
                  if (
                    !isBool &&
                    !grantEntitlementForm.is_unlimited &&
                    (Number.isNaN(limitValue) || limitValue < 0)
                  )
                    return;
                  createAdminEntitlementMutation.mutate(
                    {
                      tenantId: tenant.id,
                      data: {
                        product_id: grantEntitlementForm.product_id,
                        limit_value: limitValue,
                        is_unlimited: grantEntitlementForm.is_unlimited,
                        reason: grantEntitlementForm.reason.trim(),
                      },
                    },
                    {
                      onSuccess: (response) => {
                        setGrantEntitlementModal(false);
                        setGrantEntitlementForm({
                          product_id: '',
                          limit_value: '',
                          is_unlimited: false,
                          reason: '',
                        });
                        const warnings = (
                          response as { data?: { warnings?: string[] } }
                        )?.data?.warnings;
                        if (warnings && warnings.length > 0) {
                          alert(
                            `Entitlement created with warnings:\n\n${warnings.join('\n')}`,
                          );
                        }
                      },
                      onError: (
                        err: Error & {
                          response?: { data?: { message?: string } };
                        },
                      ) => {
                        alert(
                          err.response?.data?.message ||
                            err.message ||
                            'Failed to create entitlement',
                        );
                      },
                    },
                  );
                }}
                disabled={
                  !grantEntitlementForm.product_id ||
                  grantEntitlementForm.reason.trim().length < 10 ||
                  createAdminEntitlementMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {createAdminEntitlementMutation.isLoading
                  ? 'Creating...'
                  : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke admin entitlement modal */}
      {revokeModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !revokeAdminEntitlementMutation.isLoading && setRevokeModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Revoke admin entitlement
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Are you sure you want to revoke the admin-granted entitlement for{' '}
              <strong>{revokeModal.feature_key}</strong>? This will deactivate
              the entitlement. Usage counters and existing resources will not be
              affected.
            </p>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason <span className='text-error'>*</span>
                </label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder='Reason for revoking this entitlement (min 10 chars)...'
                  rows={3}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={revokeAdminEntitlementMutation.isLoading}
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !revokeAdminEntitlementMutation.isLoading &&
                  setRevokeModal(null)
                }
                disabled={revokeAdminEntitlementMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (revokeReason.trim().length < 10) return;
                  revokeAdminEntitlementMutation.mutate(
                    {
                      tenantId: tenant.id,
                      entitlementId: revokeModal.id,
                      data: { reason: revokeReason.trim() },
                    },
                    {
                      onSuccess: () => {
                        setRevokeModal(null);
                        setRevokeReason('');
                      },
                      onError: (
                        err: Error & {
                          response?: { data?: { message?: string } };
                        },
                      ) => {
                        alert(
                          err.response?.data?.message ||
                            err.message ||
                            'Failed to revoke entitlement',
                        );
                      },
                    },
                  );
                }}
                disabled={
                  revokeReason.trim().length < 10 ||
                  revokeAdminEntitlementMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50'
              >
                {revokeAdminEntitlementMutation.isLoading
                  ? 'Revoking...'
                  : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant application modal */}
      {grantAppModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !grantAppMutation.isLoading && setGrantAppModal(false)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Assign Application
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Application <span className='text-error'>*</span>
                </label>
                <select
                  value={grantAppForm.application_id}
                  onChange={(e) =>
                    setGrantAppForm((prev) => ({
                      ...prev,
                      application_id: e.target.value,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={grantAppMutation.isLoading}
                >
                  <option value=''>Select an application...</option>
                  {allApplications
                    .filter((a) => a.is_active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Source <span className='text-error'>*</span>
                </label>
                <select
                  value={grantAppForm.source}
                  onChange={(e) =>
                    setGrantAppForm((prev) => ({
                      ...prev,
                      source: e.target
                        .value as GrantApplicationRequest['source'],
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={grantAppMutation.isLoading}
                >
                  <option value='ADMIN_GRANT'>Admin Grant</option>
                  <option value='ADMIN_TRIAL'>Admin Trial</option>
                  <option value='PROMO'>Promo</option>
                </select>
              </div>
              {grantAppForm.source === 'ADMIN_TRIAL' && (
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Trial ends at
                  </label>
                  <input
                    type='date'
                    value={grantAppForm.trial_ends_at}
                    onChange={(e) =>
                      setGrantAppForm((prev) => ({
                        ...prev,
                        trial_ends_at: e.target.value,
                      }))
                    }
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    disabled={grantAppMutation.isLoading}
                  />
                </div>
              )}
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason
                </label>
                <textarea
                  value={grantAppForm.reason}
                  onChange={(e) =>
                    setGrantAppForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder='Reason for assigning this application...'
                  rows={2}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  disabled={grantAppMutation.isLoading}
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !grantAppMutation.isLoading && setGrantAppModal(false)
                }
                disabled={grantAppMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!grantAppForm.application_id) return;
                  grantAppMutation.mutate(
                    {
                      tenantId: tenant.id,
                      data: {
                        application_id: grantAppForm.application_id,
                        source: grantAppForm.source,
                        reason: grantAppForm.reason || undefined,
                        trial_ends_at:
                          grantAppForm.source === 'ADMIN_TRIAL' &&
                          grantAppForm.trial_ends_at
                            ? new Date(grantAppForm.trial_ends_at).toISOString()
                            : undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        setGrantAppModal(false);
                        setGrantAppForm({
                          application_id: '',
                          source: 'ADMIN_GRANT',
                          reason: '',
                          trial_ends_at: '',
                        });
                      },
                    },
                  );
                }}
                disabled={
                  !grantAppForm.application_id || grantAppMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {grantAppMutation.isLoading ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant add-on modal */}
      {grantAddonModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !grantAddonMutation.isLoading && setGrantAddonModal(false)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Grant add-on
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Add-on
                </label>
                <select
                  value={grantAddonForm.addon_id}
                  onChange={(e) =>
                    setGrantAddonForm((prev) => ({
                      ...prev,
                      addon_id: e.target.value,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                >
                  <option value=''>Select add-on</option>
                  {availableAddons.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Source
                </label>
                <select
                  value={grantAddonForm.source}
                  onChange={(e) =>
                    setGrantAddonForm((prev) => ({
                      ...prev,
                      source: e.target.value as AddonSource,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                >
                  <option value='ADMIN_FREE'>Admin (free)</option>
                  <option value='ADMIN_PAID'>Admin (paid)</option>
                  <option value='PURCHASED'>Purchased</option>
                </select>
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Custom grant value (optional)
                </label>
                <input
                  type='number'
                  min={0}
                  value={grantAddonForm.custom_grant_value}
                  onChange={(e) =>
                    setGrantAddonForm((prev) => ({
                      ...prev,
                      custom_grant_value: e.target.value,
                    }))
                  }
                  placeholder='0'
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Reason
                  {grantAddonForm.source === 'ADMIN_FREE'
                    ? ' *'
                    : ' (optional)'}
                </label>
                <textarea
                  value={grantAddonForm.reason}
                  onChange={(e) =>
                    setGrantAddonForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder='Reason for granting...'
                  rows={2}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                  Expires at (optional)
                </label>
                <input
                  type='date'
                  value={grantAddonForm.expires_at}
                  onChange={(e) =>
                    setGrantAddonForm((prev) => ({
                      ...prev,
                      expires_at: e.target.value,
                    }))
                  }
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !grantAddonMutation.isLoading && setGrantAddonModal(false)
                }
                disabled={grantAddonMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!grantAddonForm.addon_id) return;
                  if (
                    grantAddonForm.source === 'ADMIN_FREE' &&
                    !grantAddonForm.reason.trim()
                  )
                    return;
                  grantAddonMutation.mutate(
                    {
                      tenantId: tenant.id,
                      data: {
                        addon_id: grantAddonForm.addon_id,
                        source: grantAddonForm.source,
                        custom_grant_value: grantAddonForm.custom_grant_value
                          ? Number(grantAddonForm.custom_grant_value)
                          : undefined,
                        reason: grantAddonForm.reason.trim() || undefined,
                        expires_at: grantAddonForm.expires_at || undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        setGrantAddonModal(false);
                        setGrantAddonForm({
                          addon_id: '',
                          source: 'ADMIN_FREE',
                          custom_grant_value: '',
                          reason: '',
                          expires_at: '',
                        });
                      },
                    },
                  );
                }}
                disabled={
                  !grantAddonForm.addon_id ||
                  grantAddonMutation.isLoading ||
                  (grantAddonForm.source === 'ADMIN_FREE' &&
                    !grantAddonForm.reason.trim())
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
              >
                {grantAddonMutation.isLoading ? 'Granting...' : 'Grant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel addon modal */}
      {cancelAddonModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !cancelTenantAddonMutation.isLoading && setCancelAddonModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Cancel add-on
            </h3>
            <p className='mb-3 text-sm text-textSecondary'>
              Cancel <strong>{cancelAddonModal.addon_name}</strong> for this
              tenant. Provide a reason.
            </p>
            <div>
              <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                Reason <span className='text-error'>*</span>
              </label>
              <textarea
                value={cancelAddonReason}
                onChange={(e) => setCancelAddonReason(e.target.value)}
                placeholder='Reason for cancellation...'
                rows={3}
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={cancelTenantAddonMutation.isLoading}
              />
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !cancelTenantAddonMutation.isLoading &&
                  setCancelAddonModal(null)
                }
                disabled={cancelTenantAddonMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!cancelAddonReason.trim()) return;
                  cancelTenantAddonMutation.mutate(
                    {
                      tenantId: tenant.id,
                      addonId: cancelAddonModal.id,
                      data: { reason: cancelAddonReason.trim() },
                    },
                    {
                      onSuccess: () => {
                        setCancelAddonModal(null);
                        setCancelAddonReason('');
                      },
                    },
                  );
                }}
                disabled={
                  !cancelAddonReason.trim() ||
                  cancelTenantAddonMutation.isLoading
                }
                className='flex flex-1 items-center justify-center rounded-lg bg-warning px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50'
              >
                {cancelTenantAddonMutation.isLoading
                  ? 'Cancelling...'
                  : 'Cancel add-on'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel subscription modal */}
      {cancelSubModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
        >
          <div
            className='fixed inset-0 bg-black/50'
            onClick={() =>
              !cancelSubscriptionMutation.isLoading && setCancelSubModal(null)
            }
            aria-hidden='true'
          />
          <div className='relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Cancel subscription
            </h3>
            <p className='mb-4 text-sm text-textSecondary'>
              Cancel <strong>{cancelSubModal.plan_name}</strong> for this
              tenant. Entitlements will be archived and the tenant will be
              suspended.
            </p>
            <div className='mb-4'>
              <label className='mb-1 block text-sm font-medium text-textPrimary'>
                Reason (optional)
              </label>
              <textarea
                value={cancelSubForm.reason}
                onChange={(e) =>
                  setCancelSubForm((f) => ({ ...f, reason: e.target.value }))
                }
                placeholder='Reason for cancellation...'
                rows={3}
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={cancelSubscriptionMutation.isLoading}
              />
            </div>
            <div className='mb-5 flex items-center gap-2'>
              <input
                id='cancel-immediately'
                type='checkbox'
                checked={cancelSubForm.cancel_immediately}
                onChange={(e) =>
                  setCancelSubForm((f) => ({
                    ...f,
                    cancel_immediately: e.target.checked,
                  }))
                }
                disabled={cancelSubscriptionMutation.isLoading}
                className='h-4 w-4 rounded border-border text-primary'
              />
              <label
                htmlFor='cancel-immediately'
                className='text-sm text-textPrimary'
              >
                Cancel immediately (uncheck to cancel at period end)
              </label>
            </div>
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() =>
                  !cancelSubscriptionMutation.isLoading &&
                  setCancelSubModal(null)
                }
                disabled={cancelSubscriptionMutation.isLoading}
                className='flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Keep subscription
              </button>
              <button
                type='button'
                onClick={() => {
                  const data: CancelSubscriptionRequest = {
                    reason: cancelSubForm.reason.trim() || undefined,
                    cancel_immediately: cancelSubForm.cancel_immediately,
                  };
                  cancelSubscriptionMutation.mutate(
                    {
                      tenantId: tenant.id,
                      subscriptionId: cancelSubModal.id,
                      data,
                    },
                    {
                      onSuccess: () => {
                        setCancelSubModal(null);
                        setCancelSubForm({
                          reason: '',
                          cancel_immediately: true,
                        });
                      },
                    },
                  );
                }}
                disabled={cancelSubscriptionMutation.isLoading}
                className='flex flex-1 items-center justify-center rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50'
              >
                {cancelSubscriptionMutation.isLoading
                  ? 'Cancelling...'
                  : 'Cancel subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <section>
        <div className='border-t border-border'>
          {/* Tab Navigation */}
          <div className='border-b border-border px-6'>
            <div className='flex items-center space-x-8'>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 border-b-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className='p-6'>
            {activeTab === 'overview' && (
              <div>
                {/* Basic Info & Subscription Summary */}
                <div className='mb-6 grid grid-cols-2 gap-6'>
                  {/* Basic Information */}
                  <div>
                    <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                      Basic Information
                    </h3>
                    <div className='space-y-4'>
                      <div className='flex items-center justify-between border-b border-border py-3'>
                        <span className='text-sm text-textSecondary'>
                          Tenant ID
                        </span>
                        <span className='text-sm font-mono text-textPrimary'>
                          {tenant.id}
                        </span>
                      </div>
                      <div className='flex items-center justify-between border-b border-border py-3'>
                        <span className='text-sm text-textSecondary'>Slug</span>
                        <span className='text-sm font-mono text-textPrimary'>
                          {tenant.slug}
                        </span>
                      </div>
                      <div className='flex items-center justify-between border-b border-border py-3'>
                        <span className='text-sm text-textSecondary'>
                          Custom Domain
                        </span>
                        {tenant.custom_domain ? (
                          <a
                            href={`https://${tenant.custom_domain}`}
                            className='text-sm text-primary hover:underline'
                          >
                            {tenant.custom_domain}
                          </a>
                        ) : (
                          <span className='text-sm text-textSecondary'>
                            Not configured
                          </span>
                        )}
                      </div>
                      <div className='flex items-center justify-between border-b border-border py-3'>
                        <span className='text-sm text-textSecondary'>
                          Status
                        </span>
                        {getStatusBadge(tenant.status ?? '')}
                      </div>
                      <div className='flex items-center justify-between py-3'>
                        <span className='text-sm text-textSecondary'>
                          Created
                        </span>
                        <span className='text-sm text-textPrimary'>
                          {createdDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Summary */}
                  <div>
                    <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                      Subscription Summary
                    </h3>
                    {tenant.active_subscription ? (
                      <>
                        <div className='mb-4 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 p-5'>
                          <div className='mb-3 flex items-center justify-between'>
                            <div className='text-sm font-medium text-primary'>
                              Current Plan
                            </div>
                            <span className='text-xs font-semibold text-primary'>
                              {tenant.active_subscription.status ?? 'Active'}
                            </span>
                          </div>
                          <div className='mb-1 text-2xl font-bold text-textPrimary'>
                            {planName}
                          </div>
                          <div className='mb-4 text-sm text-textSecondary'>
                            {tenant.active_subscription.price_snapshot !=
                              null && tenant.active_subscription.currency
                              ? `${tenant.active_subscription.currency} ${tenant.active_subscription.price_snapshot}/mo`
                              : '-'}
                          </div>
                          <div className='grid grid-cols-2 gap-4'>
                            <div>
                              <div className='mb-1 text-xs text-textSecondary'>
                                Billing Cycle
                              </div>
                              <div className='text-sm font-semibold text-textPrimary'>
                                {tenant.active_subscription.billing_cycle ??
                                  '-'}
                              </div>
                            </div>
                            <div>
                              <div className='mb-1 text-xs text-textSecondary'>
                                Current Period End
                              </div>
                              <div className='text-sm font-semibold text-textPrimary'>
                                {tenant.active_subscription.current_period_end
                                  ? new Date(
                                      tenant.active_subscription
                                        .current_period_end,
                                    ).toLocaleDateString()
                                  : '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className='rounded-lg border border-border bg-bgGray p-5'>
                        <div className='text-sm text-textSecondary'>
                          No active subscription. Assign a plan from the
                          Subscription tab.
                        </div>
                      </div>
                    )}
                    <div className='mt-3 space-y-3'>
                      <div className='flex items-center justify-between'>
                        <span className='text-sm text-textSecondary'>
                          Total subscriptions
                        </span>
                        <span className='text-sm font-medium text-textPrimary'>
                          {tenant.subscription_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Domains */}
                {tenant.domains && tenant.domains.length > 0 && (
                  <div className='mb-6'>
                    <h3 className='text-lg font-semibold text-textPrimary mb-4'>
                      Domains
                    </h3>
                    <div className='overflow-x-auto rounded-lg border border-border'>
                      <table className='w-full'>
                        <thead>
                          <tr className='bg-bgGray border-b border-border'>
                            <th className='px-4 py-2.5 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Domain
                            </th>
                            <th className='px-4 py-2.5 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Type
                            </th>
                            <th className='px-4 py-2.5 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Status
                            </th>
                            <th className='px-4 py-2.5 text-left text-xs font-semibold uppercase text-textSecondary'>
                              SSL
                            </th>
                            <th className='px-4 py-2.5 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Primary
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenant.domains.map((d) => (
                            <tr
                              key={d.id}
                              className='border-b border-border last:border-0 hover:bg-bgGray'
                            >
                              <td className='px-4 py-3'>
                                <a
                                  href={`https://${d.domain_name}`}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-sm text-primary hover:underline'
                                >
                                  {d.domain_name}
                                </a>
                              </td>
                              <td className='px-4 py-3'>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    d.domain_type === 'SUBDOMAIN'
                                      ? 'bg-primary-50 text-primary-600'
                                      : 'bg-purple-50 text-purple-600'
                                  }`}
                                >
                                  {d.domain_type}
                                </span>
                              </td>
                              <td className='px-4 py-3'>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    d.status === 'VERIFIED'
                                      ? 'bg-green-50 text-success'
                                      : d.status === 'PENDING_VERIFICATION'
                                        ? 'bg-amber-50 text-warning'
                                        : d.status === 'FAILED'
                                          ? 'bg-red-50 text-red-600'
                                          : 'bg-gray-100 text-textSecondary'
                                  }`}
                                >
                                  {d.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className='px-4 py-3 text-sm'>
                                {d.ssl_active ? (
                                  <span className='text-success font-medium'>
                                    Active
                                  </span>
                                ) : (
                                  <span className='text-textSecondary'>-</span>
                                )}
                              </td>
                              <td className='px-4 py-3'>
                                {d.is_primary && (
                                  <span className='text-xs font-semibold text-primary'>
                                    Primary
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Activity & Contact Info */}
                <div className='grid grid-cols-2 gap-6'>
                  {/* Recent Activity */}
                  <div>
                    <h3 className='text-lg font-semibold text-textPrimary mb-4'>
                      Recent Activity
                    </h3>
                    <div className='space-y-4'>
                      {recentActivity.map((activity, index) => {
                        const IconComponent = activity.icon;
                        return (
                          <div key={index} className='flex items-start'>
                            <div
                              className={`w-8 h-8 ${activity.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}
                            >
                              <IconComponent
                                className={`h-4 w-4 ${activity.iconColor}`}
                              />
                            </div>
                            <div className='ml-3 flex-1'>
                              <div className='text-sm font-medium text-textPrimary'>
                                {activity.title}
                              </div>
                              <div className='text-xs text-textSecondary mt-0.5'>
                                {activity.detail}
                              </div>
                              <div className='text-xs text-textSecondary mt-1'>
                                {activity.time}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Owner Information */}
                  <div>
                    <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                      Owner Information
                    </h3>
                    <div className='rounded-lg bg-bgGray p-4 space-y-4'>
                      {/* Owner header */}
                      <div className='flex items-center'>
                        <div className='mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium'>
                          {ownerName
                            ? getInitials(ownerName)
                            : (ownerEmail[0]?.toUpperCase() ?? '-')}
                        </div>
                        <div>
                          <div className='font-medium text-textPrimary'>
                            {ownerName || '-'}
                            {tenant.owner?.designation && (
                              <span className='ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary'>
                                {tenant.owner.designation}
                              </span>
                            )}
                          </div>
                          <div className='text-xs text-textSecondary'>
                            Account owner
                            {tenant.owner?.status &&
                              tenant.owner.status !== 'ACTIVE' && (
                                <span className='ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-warning'>
                                  {tenant.owner.status}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>

                      {/* Owner details grid */}
                      <div className='grid grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                        {/* Email */}
                        <div className='flex items-center'>
                          <Mail className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Email
                            </div>
                            {ownerEmail ? (
                              <a
                                href={`mailto:${ownerEmail}`}
                                className='text-primary hover:underline'
                              >
                                {ownerEmail}
                              </a>
                            ) : (
                              <span className='text-textSecondary'>-</span>
                            )}
                            {tenant.owner?.email_verified && (
                              <CheckCircle2 className='ml-1 inline h-3.5 w-3.5 text-success' />
                            )}
                          </div>
                        </div>

                        {/* Phone */}
                        <div className='flex items-center'>
                          <Phone className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Phone
                            </div>
                            <span className='text-textPrimary'>
                              {tenant.owner?.phone || '-'}
                            </span>
                            {tenant.owner?.phone_verified ? (
                              <CheckCircle2 className='ml-1 inline h-3.5 w-3.5 text-success' />
                            ) : tenant.owner?.phone ? (
                              <XCircle className='ml-1 inline h-3.5 w-3.5 text-warning' />
                            ) : null}
                          </div>
                        </div>

                        {/* Location */}
                        <div className='flex items-center'>
                          <MapPin className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Location
                            </div>
                            <span className='text-textPrimary'>
                              {[
                                tenant.owner?.signup_city,
                                tenant.owner?.signup_country,
                              ]
                                .filter(Boolean)
                                .join(', ') || '-'}
                            </span>
                          </div>
                        </div>

                        {/* Timezone */}
                        <div className='flex items-center'>
                          <Clock className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Timezone
                            </div>
                            <span className='text-textPrimary'>
                              {tenant.owner?.timezone || '-'}
                            </span>
                          </div>
                        </div>

                        {/* Signup IP */}
                        <div className='flex items-center'>
                          <Globe className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Signup IP
                            </div>
                            <span className='font-mono text-xs text-textPrimary'>
                              {tenant.owner?.signup_ip || '-'}
                            </span>
                          </div>
                        </div>

                        {/* Last Login IP */}
                        <div className='flex items-center'>
                          <Shield className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Last Login IP
                            </div>
                            <span className='font-mono text-xs text-textPrimary'>
                              {tenant.owner?.last_login_ip || '-'}
                            </span>
                          </div>
                        </div>

                        {/* Last Login At */}
                        <div className='flex items-center'>
                          <Calendar className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Last Login
                            </div>
                            <span className='text-textPrimary'>
                              {tenant.owner?.last_login_at
                                ? new Date(
                                    tenant.owner.last_login_at,
                                  ).toLocaleString()
                                : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Login Count */}
                        <div className='flex items-center'>
                          <BarChart3 className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Login Count
                            </div>
                            <span className='text-textPrimary'>
                              {tenant.owner?.login_count ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Signup Referrer */}
                        <div className='flex items-center'>
                          <Link2 className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Signup Referrer
                            </div>
                            <span className='text-textPrimary truncate max-w-[200px] block'>
                              {tenant.owner?.signup_referrer || '-'}
                            </span>
                          </div>
                        </div>

                        {/* Account Created */}
                        <div className='flex items-center'>
                          <Calendar className='mr-2 h-4 w-4 text-textSecondary flex-shrink-0' />
                          <div>
                            <div className='text-xs text-textSecondary'>
                              Account Created
                            </div>
                            <span className='text-textPrimary'>
                              {tenant.owner?.created_at
                                ? new Date(
                                    tenant.owner.created_at,
                                  ).toLocaleDateString()
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div>
                <div className='mb-4 flex items-center justify-between'>
                  <h3 className='text-lg font-semibold text-textPrimary'>
                    Subscriptions
                  </h3>
                  <button
                    type='button'
                    onClick={() => {
                      setAssignPlanForm({
                        planId: '',
                        planVersionId: '',
                        billing_cycle: 'MONTHLY',
                        currency: 'USD',
                        is_trial: false,
                        trial_ends_at: '',
                        valid_from: '',
                        valid_to: '',
                      });
                      setAssignPlanModal(true);
                    }}
                    className='rounded-full bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover'
                  >
                    Assign plan
                  </button>
                </div>
                {subscriptions.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No subscriptions. Assign a plan to get started.
                  </div>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b border-border'>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Plan
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Billing / Currency
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Price / Status
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Period
                          </th>
                          <th className='px-6 py-3 text-right text-xs font-semibold uppercase text-textSecondary'>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((sub) => (
                          <tr
                            key={sub.id}
                            className='border-b border-border hover:bg-bgGray'
                          >
                            <td className='px-6 py-4 font-medium text-textPrimary'>
                              {sub.plan_name_snapshot ?? sub.plan_name ?? '-'}
                            </td>
                            <td className='px-6 py-4 text-sm text-textSecondary'>
                              {sub.billing_cycle} / {sub.currency}
                            </td>
                            <td className='px-6 py-4 text-sm'>
                              <span className='font-medium text-textPrimary'>
                                {sub.currency}{' '}
                                {sub.price_snapshot ?? sub.price ?? '-'}
                              </span>
                              <span className='ml-2 text-xs font-semibold text-success'>
                                {sub.status}
                              </span>
                            </td>
                            <td className='px-6 py-4 text-sm text-textSecondary'>
                              {sub.current_period_start
                                ? new Date(
                                    sub.current_period_start,
                                  ).toLocaleDateString()
                                : '-'}{' '}
                              –{' '}
                              {sub.current_period_end
                                ? new Date(
                                    sub.current_period_end,
                                  ).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className='px-6 py-4 text-right text-sm'>
                              {(sub.status === 'ACTIVE' ||
                                sub.status === 'TRIALING' ||
                                sub.status === 'PAST_DUE') && (
                                <button
                                  type='button'
                                  onClick={() => {
                                    setCancelSubModal({
                                      id: sub.id,
                                      plan_name:
                                        sub.plan_name_snapshot ??
                                        sub.plan_name ??
                                        'this plan',
                                    });
                                    setCancelSubForm({
                                      reason: '',
                                      cancel_immediately: true,
                                    });
                                  }}
                                  className='rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50'
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'entitlements' && (
              <div>
                <div className='mb-4 flex items-center justify-between'>
                  <h3 className='text-lg font-semibold text-textPrimary'>
                    Entitlements
                  </h3>
                  <div className='flex gap-2'>
                    <button
                      type='button'
                      onClick={() =>
                        reconcileUsageMutation.mutate(
                          { tenantId },
                          {
                            onSuccess: () => {
                              alert('Usage reconciled successfully');
                            },
                            onError: (err) => {
                              alert(`Reconciliation failed: ${err.message}`);
                            },
                          },
                        )
                      }
                      disabled={reconcileUsageMutation.isLoading}
                      className='rounded border border-border px-3 py-1.5 text-xs font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                    >
                      {reconcileUsageMutation.isLoading
                        ? 'Reconciling...'
                        : 'Reconcile Usage'}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setGrantEntitlementForm({
                          product_id: '',
                          limit_value: '',
                          is_unlimited: false,
                          reason: '',
                        });
                        setGrantEntitlementModal(true);
                      }}
                      className='rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700'
                    >
                      Assign entitlement
                    </button>
                  </div>
                </div>
                {entitlements.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No entitlements. Assign a plan or add-on to see
                    entitlements.
                  </div>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b border-border'>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Feature / Product
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Limit
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Used
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Source
                          </th>
                          <th className='px-6 py-3 text-right text-xs font-semibold uppercase text-textSecondary'>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entitlements.map((ent) => (
                          <tr
                            key={ent.id}
                            className='border-b border-border hover:bg-bgGray'
                          >
                            <td className='px-6 py-4'>
                              <span className='font-medium text-textPrimary'>
                                {ent.feature_key}
                              </span>
                              {ent.product_code && (
                                <span className='ml-2 text-sm text-textSecondary'>
                                  ({ent.product_code})
                                </span>
                              )}
                            </td>
                            <td className='px-6 py-4 text-sm text-textPrimary'>
                              {ent.is_unlimited
                                ? 'Unlimited'
                                : (ent.limit_value ?? '-')}
                            </td>
                            <td className='px-6 py-4 text-sm text-textPrimary'>
                              {ent.used_value ?? ent.current_usage ?? '-'}
                            </td>
                            <td className='px-6 py-4 text-sm'>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  ent.source === 'ADMIN'
                                    ? 'bg-amber-100 text-amber-800'
                                    : ent.source === 'ADDON'
                                      ? 'bg-purple-100 text-purple-800'
                                      : ent.source === 'PROMO'
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'bg-primary-100 text-primary-800'
                                }`}
                              >
                                {ent.source ?? '-'}
                              </span>
                            </td>
                            <td className='px-6 py-4 text-right'>
                              <div className='flex justify-end gap-2'>
                                <button
                                  type='button'
                                  onClick={() => {
                                    setOverrideModal({
                                      id: ent.id,
                                      feature_key: ent.feature_key,
                                      limit_value: ent.limit_value,
                                    });
                                    setOverrideForm({
                                      new_limit_value: String(
                                        ent.limit_value ?? '',
                                      ),
                                      reason: '',
                                    });
                                  }}
                                  className='rounded border border-border px-3 py-1.5 text-xs font-medium text-textPrimary hover:bg-bgGray'
                                >
                                  Override
                                </button>
                                <button
                                  type='button'
                                  onClick={() => {
                                    setResetModal({
                                      id: ent.id,
                                      feature_key: ent.feature_key,
                                    });
                                    setResetReason('');
                                  }}
                                  className='rounded border border-border px-3 py-1.5 text-xs font-medium text-textPrimary hover:bg-bgGray'
                                >
                                  Reset usage
                                </button>
                                <button
                                  type='button'
                                  onClick={() => {
                                    setUpdateUsageModal({
                                      id: ent.id,
                                      feature_key: ent.feature_key,
                                      used_value:
                                        ent.used_value ??
                                        ent.current_usage ??
                                        0,
                                    });
                                    setUpdateUsageForm({
                                      new_used_value: String(
                                        ent.used_value ??
                                          ent.current_usage ??
                                          '',
                                      ),
                                      reason: '',
                                    });
                                  }}
                                  className='rounded border border-border px-3 py-1.5 text-xs font-medium text-textPrimary hover:bg-bgGray'
                                >
                                  Update usage
                                </button>
                                {ent.source === 'ADMIN' && (
                                  <button
                                    type='button'
                                    onClick={() => {
                                      setRevokeModal({
                                        id: ent.id,
                                        feature_key: ent.feature_key,
                                      });
                                      setRevokeReason('');
                                    }}
                                    className='rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50'
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'addons' && (
              <div>
                <div className='mb-4 flex items-center justify-between'>
                  <h3 className='text-lg font-semibold text-textPrimary'>
                    Tenant Add-ons
                  </h3>
                  <button
                    type='button'
                    onClick={() => {
                      setGrantAddonForm({
                        addon_id: '',
                        source: 'ADMIN_FREE',
                        custom_grant_value: '',
                        reason: '',
                        expires_at: '',
                      });
                      setGrantAddonModal(true);
                    }}
                    className='rounded-full bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover'
                  >
                    Grant add-on
                  </button>
                </div>
                {tenantAddons.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No add-ons granted. Grant an add-on from the catalog.
                  </div>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b border-border'>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Add-on / Product
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Source
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Grant value / Status
                          </th>
                          <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                            Expires
                          </th>
                          <th className='px-6 py-3 text-right text-xs font-semibold uppercase text-textSecondary'>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantAddons.map((ta) => (
                          <tr
                            key={ta.id}
                            className='border-b border-border hover:bg-bgGray'
                          >
                            <td className='px-6 py-4'>
                              <span className='font-medium text-textPrimary'>
                                {ta.addon_name ??
                                  (ta as { addon?: { name?: string } }).addon
                                    ?.name ??
                                  '-'}
                              </span>
                              {(ta.product_code ||
                                (ta as { addon?: { product_code?: string } })
                                  .addon?.product_code) && (
                                <span className='ml-2 text-sm text-textSecondary'>
                                  (
                                  {ta.product_code ??
                                    (
                                      ta as {
                                        addon?: { product_code?: string };
                                      }
                                    ).addon?.product_code}
                                  )
                                </span>
                              )}
                            </td>
                            <td className='px-6 py-4 text-sm text-textSecondary'>
                              {ta.source}
                            </td>
                            <td className='px-6 py-4 text-sm'>
                              <span className='font-medium text-textPrimary'>
                                {ta.grant_value}
                              </span>
                              <span className='ml-2 text-xs font-semibold text-success'>
                                {ta.status}
                              </span>
                            </td>
                            <td className='px-6 py-4 text-sm text-textSecondary'>
                              {ta.expires_at
                                ? new Date(ta.expires_at).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className='px-6 py-4 text-right'>
                              {ta.status === 'ACTIVE' && (
                                <button
                                  type='button'
                                  onClick={() => {
                                    setCancelAddonModal({
                                      id: ta.id,
                                      addon_name:
                                        ta.addon_name ??
                                        (ta as { addon?: { name?: string } })
                                          .addon?.name ??
                                        'Add-on',
                                    });
                                    setCancelAddonReason('');
                                  }}
                                  className='rounded border border-border px-3 py-1.5 text-xs font-medium text-textPrimary hover:bg-bgGray'
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div>
                <div className='mb-4 flex items-center justify-between'>
                  <h3 className='text-lg font-semibold text-textPrimary'>
                    Tenant Applications
                  </h3>
                  <button
                    type='button'
                    onClick={() => {
                      setGrantAppForm({
                        application_id: '',
                        source: 'ADMIN_GRANT',
                        reason: '',
                        trial_ends_at: '',
                      });
                      setGrantAppModal(true);
                    }}
                    className='rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover'
                  >
                    Assign Application
                  </button>
                </div>
                <div className='mb-4 flex flex-wrap items-center gap-3'>
                  <div className='relative flex-1 min-w-[200px] max-w-sm'>
                    <input
                      type='text'
                      placeholder='Search by name or code...'
                      value={appsSearchQuery}
                      onChange={(e) => {
                        setAppsSearchQuery(e.target.value);
                        setAppsPage(1);
                      }}
                      className='w-full rounded-lg border border-border bg-white px-3 py-2 pl-9 text-sm text-textPrimary placeholder:text-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    />
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                  </div>
                  <select
                    value={appsStatusFilter}
                    onChange={(e) => {
                      setAppsStatusFilter(
                        (e.target.value as TenantAppStatus) || '',
                      );
                      setAppsPage(1);
                    }}
                    className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none'
                  >
                    <option value=''>All statuses</option>
                    <option value='ACTIVE'>Active</option>
                    <option value='TRIALING'>Trialing</option>
                    <option value='SUSPENDED'>Suspended</option>
                    <option value='CANCELLED'>Cancelled</option>
                  </select>
                  <select
                    value={appsSourceFilter}
                    onChange={(e) => {
                      setAppsSourceFilter(
                        (e.target.value as TenantAppSource) || '',
                      );
                      setAppsPage(1);
                    }}
                    className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none'
                  >
                    <option value=''>All sources</option>
                    <option value='SUBSCRIPTION'>Subscription</option>
                    <option value='ADMIN_TRIAL'>Admin trial</option>
                    <option value='ADMIN_GRANT'>Admin grant</option>
                    <option value='PROMO'>Promo</option>
                  </select>
                </div>
                {appsLoading ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center'>
                    <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
                    <p className='mt-2 text-sm text-textSecondary'>
                      Loading applications...
                    </p>
                  </div>
                ) : applications.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No applications found.
                  </div>
                ) : (
                  <>
                    <div className='overflow-x-auto'>
                      <table className='w-full'>
                        <thead>
                          <tr className='border-b border-border'>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Application
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Status
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Source
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Activated
                            </th>
                            <th className='px-6 py-3 text-right text-xs font-semibold uppercase text-textSecondary'>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((app) => (
                            <tr
                              key={app.id}
                              className='border-b border-border hover:bg-bgGray'
                            >
                              <td className='px-6 py-4'>
                                <span className='font-medium text-textPrimary'>
                                  {app.application_name ?? app.application_code}
                                </span>
                                {app.application_code && (
                                  <span className='ml-2 text-sm text-textSecondary'>
                                    ({app.application_code})
                                  </span>
                                )}
                              </td>
                              <td className='px-6 py-4'>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    app.status === 'ACTIVE'
                                      ? 'bg-green-50 text-success'
                                      : app.status === 'SUSPENDED'
                                        ? 'bg-amber-50 text-warning'
                                        : app.status === 'CANCELLED'
                                          ? 'bg-red-50 text-destructive'
                                          : 'bg-primary-50 text-primary'
                                  }`}
                                >
                                  {app.status}
                                </span>
                              </td>
                              <td className='px-6 py-4 text-sm text-textSecondary'>
                                {app.source}
                              </td>
                              <td className='px-6 py-4 text-sm text-textSecondary'>
                                {app.activated_at
                                  ? new Date(
                                      app.activated_at,
                                    ).toLocaleDateString()
                                  : '-'}
                              </td>
                              <td className='px-6 py-4 text-right'>
                                <div className='flex justify-end gap-2'>
                                  {(app.status === 'ACTIVE' ||
                                    app.status === 'TRIALING') && (
                                    <button
                                      type='button'
                                      onClick={() =>
                                        updateTenantAppMutation.mutate({
                                          tenantId: tenant.id,
                                          tenantAppId: app.id,
                                          data: {
                                            status: 'SUSPENDED',
                                            reason: 'Admin action',
                                          },
                                        })
                                      }
                                      disabled={
                                        updateTenantAppMutation.isLoading
                                      }
                                      className='rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50'
                                    >
                                      Suspend
                                    </button>
                                  )}
                                  {app.status === 'SUSPENDED' && (
                                    <button
                                      type='button'
                                      onClick={() =>
                                        updateTenantAppMutation.mutate({
                                          tenantId: tenant.id,
                                          tenantAppId: app.id,
                                          data: {
                                            status: 'ACTIVE',
                                            reason: 'Admin reactivation',
                                          },
                                        })
                                      }
                                      disabled={
                                        updateTenantAppMutation.isLoading
                                      }
                                      className='rounded border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50'
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                  {app.status === 'CANCELLED' && (
                                    <button
                                      type='button'
                                      onClick={() =>
                                        updateTenantAppMutation.mutate({
                                          tenantId: tenant.id,
                                          tenantAppId: app.id,
                                          data: {
                                            status: 'ACTIVE',
                                            reason: 'Admin reactivation',
                                          },
                                        })
                                      }
                                      disabled={
                                        updateTenantAppMutation.isLoading
                                      }
                                      className='rounded border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50'
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                  {app.status !== 'CANCELLED' && (
                                    <button
                                      type='button'
                                      onClick={() =>
                                        updateTenantAppMutation.mutate({
                                          tenantId: tenant.id,
                                          tenantAppId: app.id,
                                          data: {
                                            status: 'CANCELLED',
                                            reason: 'Admin cancellation',
                                          },
                                        })
                                      }
                                      disabled={
                                        updateTenantAppMutation.isLoading
                                      }
                                      className='rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className='mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4'>
                      <div className='text-sm text-textSecondary'>
                        Showing{' '}
                        {appsTotal === 0 ? 0 : (appsPage - 1) * appsLimit + 1}–
                        {Math.min(appsPage * appsLimit, appsTotal)} of{' '}
                        {appsTotal}
                      </div>
                      <div className='flex items-center gap-2'>
                        <select
                          value={appsLimit}
                          onChange={(e) => {
                            setAppsLimit(Number(e.target.value));
                            setAppsPage(1);
                          }}
                          className='rounded border border-border bg-white px-2 py-1 text-sm text-textPrimary'
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <button
                          type='button'
                          onClick={() => setAppsPage((p) => Math.max(1, p - 1))}
                          disabled={appsPage <= 1}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Previous
                        </button>
                        <span className='text-sm text-textSecondary'>
                          Page {appsPage} of {appsTotalPages}
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setAppsPage((p) => Math.min(appsTotalPages, p + 1))
                          }
                          disabled={appsPage >= appsTotalPages}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                  Tenant Users
                </h3>
                <p className='mb-4 text-sm text-textSecondary'>
                  End-users in this tenant.
                </p>
                <div className='mb-4 flex flex-wrap items-center gap-3'>
                  <div className='relative flex-1 min-w-[200px] max-w-sm'>
                    <input
                      type='text'
                      placeholder='Search by name, email, or phone...'
                      value={membersSearchQuery}
                      onChange={(e) => {
                        setMembersSearchQuery(e.target.value);
                        setMembersPage(1);
                      }}
                      className='w-full rounded-lg border border-border bg-white px-3 py-2 pl-9 text-sm text-textPrimary placeholder:text-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    />
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                  </div>
                  <select
                    value={membersStatusFilter}
                    onChange={(e) => {
                      setMembersStatusFilter(
                        (e.target.value as TenantMemberStatus) || '',
                      );
                      setMembersPage(1);
                    }}
                    className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none'
                  >
                    <option value=''>All statuses</option>
                    <option value='ACTIVE'>Active</option>
                    <option value='SUSPENDED'>Suspended</option>
                    <option value='DEACTIVATED'>Deactivated</option>
                  </select>
                </div>
                {membersLoading ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center'>
                    <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
                    <p className='mt-2 text-sm text-textSecondary'>
                      Loading members...
                    </p>
                  </div>
                ) : members.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No members found.
                  </div>
                ) : (
                  <>
                    <div className='overflow-x-auto'>
                      <table className='w-full'>
                        <thead>
                          <tr className='border-b border-border'>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Member
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Status
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Joined
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((m) => (
                            <tr
                              key={m.id}
                              className='border-b border-border hover:bg-bgGray'
                            >
                              <td className='px-6 py-4'>
                                <span className='font-medium text-textPrimary'>
                                  {m.name ?? '-'}
                                </span>
                                <span className='ml-2 text-sm text-textSecondary'>
                                  {m.email ?? '-'}
                                </span>
                              </td>
                              <td className='px-6 py-4'>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    m.status === 'ACTIVE'
                                      ? 'bg-green-50 text-success'
                                      : m.status === 'SUSPENDED'
                                        ? 'bg-amber-50 text-warning'
                                        : m.status === 'DEACTIVATED'
                                          ? 'bg-gray-100 text-textSecondary'
                                          : 'bg-gray-100 text-textSecondary'
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </td>
                              <td className='px-6 py-4 text-sm text-textSecondary'>
                                {m.joined_at
                                  ? new Date(m.joined_at).toLocaleDateString()
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className='mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4'>
                      <div className='text-sm text-textSecondary'>
                        Showing{' '}
                        {membersTotal === 0
                          ? 0
                          : (membersPage - 1) * membersLimit + 1}
                        –{Math.min(membersPage * membersLimit, membersTotal)} of{' '}
                        {membersTotal}
                      </div>
                      <div className='flex items-center gap-2'>
                        <select
                          value={membersLimit}
                          onChange={(e) => {
                            setMembersLimit(Number(e.target.value));
                            setMembersPage(1);
                          }}
                          className='rounded border border-border bg-white px-2 py-1 text-sm text-textPrimary'
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            setMembersPage((p) => Math.max(1, p - 1))
                          }
                          disabled={membersPage <= 1}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Previous
                        </button>
                        <span className='text-sm text-textSecondary'>
                          Page {membersPage} of {membersTotalPages}
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setMembersPage((p) =>
                              Math.min(membersTotalPages, p + 1),
                            )
                          }
                          disabled={membersPage >= membersTotalPages}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <div>
                <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                  Tenant Members
                </h3>
                <p className='mb-4 text-sm text-textSecondary'>
                  Staff members with access to this tenant.
                </p>
                <div className='mb-4 flex flex-wrap items-center gap-3'>
                  <div className='relative flex-1 min-w-[200px] max-w-sm'>
                    <input
                      type='text'
                      placeholder='Search by name, email, or phone...'
                      value={usersSearchQuery}
                      onChange={(e) => {
                        setUsersSearchQuery(e.target.value);
                        setUsersPage(1);
                      }}
                      className='w-full rounded-lg border border-border bg-white px-3 py-2 pl-9 text-sm text-textPrimary placeholder:text-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    />
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                  </div>
                  <select
                    value={usersStatusFilter}
                    onChange={(e) => {
                      setUsersStatusFilter(
                        (e.target.value as MembershipStatus) || '',
                      );
                      setUsersPage(1);
                    }}
                    className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none'
                  >
                    <option value=''>All statuses</option>
                    <option value='ACTIVE'>Active</option>
                    <option value='SUSPENDED'>Suspended</option>
                    <option value='INVITED'>Invited</option>
                  </select>
                  <button
                    onClick={() => setShowStaffExportModal(true)}
                    className='flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray transition'
                  >
                    <Download className='h-4 w-4' />
                    Export
                  </button>
                </div>
                {usersLoading ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center'>
                    <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
                    <p className='mt-2 text-sm text-textSecondary'>
                      Loading users...
                    </p>
                  </div>
                ) : tenantUsers.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No users found.
                  </div>
                ) : (
                  <>
                    <div className='overflow-x-auto'>
                      <table className='w-full'>
                        <thead>
                          <tr className='border-b border-border'>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              User
                            </th>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Phone
                            </th>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Location
                            </th>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Status
                            </th>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Roles
                            </th>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Joined
                            </th>
                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Last Login
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenantUsers.map((u) => (
                            <tr
                              key={u.id}
                              className='border-b border-border hover:bg-bgGray'
                            >
                              <td className='px-4 py-4'>
                                <div className='font-medium text-textPrimary'>
                                  {u.name ?? '-'}
                                  {u.designation && (
                                    <span className='ml-1.5 text-xs font-normal text-textSecondary'>
                                      ({u.designation})
                                    </span>
                                  )}
                                </div>
                                <div className='text-sm text-textSecondary'>
                                  {u.email}
                                </div>
                              </td>
                              <td className='px-4 py-4 text-sm'>
                                {u.phone ? (
                                  <span className='text-textPrimary'>
                                    {u.phone}
                                    {u.phone_verified ? (
                                      <CheckCircle2 className='ml-1 inline h-3.5 w-3.5 text-success' />
                                    ) : (
                                      <XCircle className='ml-1 inline h-3.5 w-3.5 text-warning' />
                                    )}
                                  </span>
                                ) : (
                                  <span className='text-textSecondary'>-</span>
                                )}
                              </td>
                              <td className='px-4 py-4 text-sm text-textSecondary'>
                                {[u.signup_city, u.signup_country]
                                  .filter(Boolean)
                                  .join(', ') || '-'}
                              </td>
                              <td className='px-4 py-4'>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    u.membership_status === 'ACTIVE'
                                      ? 'bg-green-50 text-success'
                                      : u.membership_status === 'SUSPENDED'
                                        ? 'bg-amber-50 text-warning'
                                        : 'bg-primary-50 text-primary'
                                  }`}
                                >
                                  {u.membership_status}
                                </span>
                              </td>
                              <td className='px-4 py-4 text-sm text-textSecondary'>
                                {u.roles?.length
                                  ? u.roles.map((r) => r.name).join(', ')
                                  : '-'}
                              </td>
                              <td className='px-4 py-4 text-sm text-textSecondary'>
                                {u.joined_at
                                  ? new Date(u.joined_at).toLocaleDateString()
                                  : '-'}
                              </td>
                              <td className='px-4 py-4 text-sm text-textSecondary'>
                                {u.last_login_at
                                  ? new Date(
                                      u.last_login_at,
                                    ).toLocaleDateString()
                                  : '-'}
                                {u.login_count ? (
                                  <span className='ml-1 text-xs text-textSecondary'>
                                    ({u.login_count}x)
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className='mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4'>
                      <div className='text-sm text-textSecondary'>
                        Showing{' '}
                        {usersTotal === 0
                          ? 0
                          : (usersPage - 1) * usersLimit + 1}
                        –{Math.min(usersPage * usersLimit, usersTotal)} of{' '}
                        {usersTotal}
                      </div>
                      <div className='flex items-center gap-2'>
                        <select
                          value={usersLimit}
                          onChange={(e) => {
                            setUsersLimit(Number(e.target.value));
                            setUsersPage(1);
                          }}
                          className='rounded border border-border bg-white px-2 py-1 text-sm text-textPrimary'
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            setUsersPage((p) => Math.max(1, p - 1))
                          }
                          disabled={usersPage <= 1}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Previous
                        </button>
                        <span className='text-sm text-textSecondary'>
                          Page {usersPage} of {usersTotalPages}
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setUsersPage((p) =>
                              Math.min(usersTotalPages, p + 1),
                            )
                          }
                          disabled={usersPage >= usersTotalPages}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                  Audit Log
                </h3>
                <p className='mb-4 text-sm text-textSecondary'>
                  Application and add-on events for this tenant.
                </p>
                {auditLoading ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center'>
                    <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
                    <p className='mt-2 text-sm text-textSecondary'>
                      Loading audit log...
                    </p>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className='rounded-lg border border-border bg-bgGray py-12 text-center text-textSecondary'>
                    No audit log entries.
                  </div>
                ) : (
                  <>
                    <div className='overflow-x-auto'>
                      <table className='w-full'>
                        <thead>
                          <tr className='border-b border-border'>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Date
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Type
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Event
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Description / Reason
                            </th>
                            <th className='px-6 py-3 text-left text-xs font-semibold uppercase text-textSecondary'>
                              Actor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((entry) => (
                            <tr
                              key={entry.id}
                              className='border-b border-border hover:bg-bgGray'
                            >
                              <td className='px-6 py-4 text-sm text-textSecondary'>
                                {entry.created_at
                                  ? new Date(entry.created_at).toLocaleString()
                                  : '-'}
                              </td>
                              <td className='px-6 py-4 text-sm text-textPrimary'>
                                {entry.kind === 'application'
                                  ? 'Application'
                                  : 'Add-on'}
                              </td>
                              <td className='px-6 py-4 text-sm text-textPrimary'>
                                {entry.event_type}
                              </td>
                              <td className='px-6 py-4 text-sm text-textSecondary'>
                                {entry.description ?? entry.reason ?? '-'}
                              </td>
                              <td className='px-6 py-4 text-sm text-textSecondary'>
                                {entry.is_system
                                  ? 'System'
                                  : (entry.admin_id ?? '-')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className='mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4'>
                      <div className='text-sm text-textSecondary'>
                        Showing{' '}
                        {auditTotal === 0
                          ? 0
                          : (auditPage - 1) * auditLimit + 1}
                        –{Math.min(auditPage * auditLimit, auditTotal)} of{' '}
                        {auditTotal}
                      </div>
                      <div className='flex items-center gap-2'>
                        <select
                          value={auditLimit}
                          onChange={(e) => {
                            setAuditLimit(Number(e.target.value));
                            setAuditPage(1);
                          }}
                          className='rounded border border-border bg-white px-2 py-1 text-sm text-textPrimary'
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            setAuditPage((p) => Math.max(1, p - 1))
                          }
                          disabled={auditPage <= 1}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Previous
                        </button>
                        <span className='text-sm text-textSecondary'>
                          Page {auditPage} of {auditTotalPages}
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setAuditPage((p) =>
                              Math.min(auditTotalPages, p + 1),
                            )
                          }
                          disabled={auditPage >= auditTotalPages}
                          className='rounded border border-border bg-white px-3 py-1 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'offerings' && <OfferingsTab tenantId={tenantId} />}

            {activeTab === 'sales' && <SalesTab tenantId={tenantId} />}

            {activeTab === 'revenue' && <RevenueTab tenantId={tenantId} />}

            {activeTab !== 'overview' &&
              activeTab !== 'subscription' &&
              activeTab !== 'entitlements' &&
              activeTab !== 'addons' &&
              activeTab !== 'applications' &&
              activeTab !== 'offerings' &&
              activeTab !== 'sales' &&
              activeTab !== 'revenue' &&
              activeTab !== 'users' &&
              activeTab !== 'members' &&
              activeTab !== 'audit' && (
                <div className='py-12 text-center'>
                  <div className='text-textSecondary'>
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab
                    content coming soon...
                  </div>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Staff Export Modal */}
      {showStaffExportModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => {
              setShowStaffExportModal(false);
              setStaffExportError('');
            }}
          />
          <div className='relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-lg font-semibold text-textPrimary'>
                Export Tenant Staff Members
              </h2>
              <button
                onClick={() => {
                  setShowStaffExportModal(false);
                  setStaffExportError('');
                }}
                className='text-textSecondary hover:text-textPrimary transition'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <p className='text-sm text-textSecondary mb-5'>
              Filter by signup date range. Leave both fields empty to export all
              staff members in this tenant.
            </p>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-textPrimary mb-1.5'>
                  Start Date
                </label>
                <input
                  type='date'
                  value={staffExportStartDate}
                  onChange={(e) => setStaffExportStartDate(e.target.value)}
                  className='w-full h-10 px-3 border border-border rounded-lg text-sm text-textPrimary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-textPrimary mb-1.5'>
                  End Date
                </label>
                <input
                  type='date'
                  value={staffExportEndDate}
                  onChange={(e) => setStaffExportEndDate(e.target.value)}
                  min={staffExportStartDate || undefined}
                  className='w-full h-10 px-3 border border-border rounded-lg text-sm text-textPrimary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
                />
              </div>
            </div>

            {staffExportError && (
              <p className='mt-3 text-sm text-red-500'>{staffExportError}</p>
            )}

            <div className='flex items-center justify-end gap-3 mt-6'>
              <button
                onClick={() => {
                  setShowStaffExportModal(false);
                  setStaffExportError('');
                }}
                className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition'
              >
                Cancel
              </button>
              <button
                onClick={handleStaffExport}
                disabled={isExportingStaff}
                className='h-10 px-5 bg-primarySolid hover:bg-primaryHover disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center gap-2'
              >
                {isExportingStaff ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Exporting...
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
