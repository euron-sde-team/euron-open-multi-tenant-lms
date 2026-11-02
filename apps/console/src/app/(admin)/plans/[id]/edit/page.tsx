'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Edit,
  GitBranch,
  Info,
  Layers,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useGetApplications } from '@/lib/api/hooks/useApplications';
import {
  useGetPlan,
  useGetPlanApplications,
  useGetPlanVersions,
  useLinkApplicationToPlan,
  useUnlinkApplicationFromPlan,
  useUpdatePlan,
} from '@/lib/api/hooks/usePlans';
import { PlanType } from '@/lib/api/types';

import ConfirmModal from '@/components/common/ConfirmModal';

export default function EditPlanPage() {
  const params = useParams();
  const planId = params.id as string;

  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [showLinkApp, setShowLinkApp] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlinkModal, setUnlinkModal] = useState<{
    isOpen: boolean;
    appId: string | null;
    appName: string | null;
  }>({ isOpen: false, appId: null, appName: null });

  // Form state for editing
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
    is_public: true,
  });

  // Fetch plan data
  const {
    data: plan,
    isLoading: planLoading,
    refetch: refetchPlan,
  } = useGetPlan(planId);

  // Fetch plan versions
  const {
    data: versionsData,
    isLoading: versionsLoading,
    refetch: refetchVersions,
  } = useGetPlanVersions(planId);
  const versions = versionsData?.versions || [];

  // Fetch plan applications
  const {
    data: planAppsData,
    isLoading: planAppsLoading,
    refetch: refetchPlanApps,
  } = useGetPlanApplications(planId);
  const planApplications = planAppsData?.applications || [];

  // Fetch all applications for linking
  const { data: allAppsData } = useGetApplications({ is_active: true });
  const allApplications = allAppsData?.applications || [];

  // Available applications (not already linked)
  const availableApps = allApplications.filter(
    (app) => !planApplications.some((pa) => pa.application_id === app.id),
  );

  // Mutations
  const updatePlanMutation = useUpdatePlan();
  const linkAppMutation = useLinkApplicationToPlan();
  const unlinkAppMutation = useUnlinkApplicationFromPlan();

  // Initialize form data when plan loads
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        description: plan.description || '',
        sort_order: plan.sort_order,
        is_active: plan.is_active,
        is_public: plan.is_public,
      });
    }
  }, [plan]);

  const handleSave = async () => {
    try {
      await updatePlanMutation.mutateAsync({
        id: planId,
        data: formData,
      });
      setIsEditing(false);
      setError(null);
      refetchPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  };

  const handleLinkApp = async () => {
    if (!selectedAppId) {
      setError('Please select an application');
      return;
    }

    try {
      await linkAppMutation.mutateAsync({
        planId,
        applicationId: selectedAppId,
      });
      setShowLinkApp(false);
      setSelectedAppId('');
      setError(null);
      refetchPlanApps();
      refetchPlan();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to link application',
      );
    }
  };

  const handleUnlinkApp = async () => {
    if (!unlinkModal.appId) return;

    try {
      await unlinkAppMutation.mutateAsync({ planId, appId: unlinkModal.appId });
      setUnlinkModal({ isOpen: false, appId: null, appName: null });
      refetchPlanApps();
      refetchPlan();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to unlink application',
      );
    }
  };

  const openUnlinkModal = (appId: string, appName: string) => {
    setUnlinkModal({ isOpen: true, appId, appName });
  };

  const closeUnlinkModal = () => {
    setUnlinkModal({ isOpen: false, appId: null, appName: null });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPlanTypeLabel = (type: PlanType) => {
    switch (type) {
      case 'SINGLE_APP':
        return 'Single App';
      case 'BUNDLE':
        return 'Bundle';
      case 'ENTERPRISE':
        return 'Enterprise';
      default:
        return type;
    }
  };

  if (planLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <Loader2 className='h-12 w-12 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading plan details...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Plan not found
          </h3>
          <Link
            href='/plans'
            className='mt-4 inline-flex items-center text-sm font-medium text-primarySolid hover:underline'
          >
            Back to Plans
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'versions', label: `Versions (${plan.version_count || 0})` },
    { id: 'applications', label: `Applications (${planApplications.length})` },
  ];

  return (
    <div className='p-8'>
      {/* Breadcrumb */}
      <section className='mb-6'>
        <div className='mb-4 flex items-center text-sm text-textSecondary'>
          <Link href='/plans' className='hover:text-primary'>
            Catalog
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <Link href='/plans' className='hover:text-primary'>
            Plans
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <span className='font-medium text-textPrimary'>{plan.name}</span>
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-3xl font-bold text-textPrimary'>
                {plan.name}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plan.is_active
                    ? 'bg-green-50 text-success'
                    : 'bg-gray-100 text-textSecondary'
                }`}
              >
                {plan.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className='mt-2 text-textSecondary'>
              {plan.description || 'No description'}
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href='/plans'
              className='flex h-10 items-center rounded-full border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back
            </Link>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white transition hover:bg-primaryHover'
              >
                <Edit className='mr-2 h-4 w-4' />
                Edit Plan
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className='flex h-10 items-center rounded-full border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updatePlanMutation.isLoading}
                  className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-50'
                >
                  {updatePlanMutation.isLoading ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Save className='mr-2 h-4 w-4' />
                  )}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-center'>
            <AlertCircle className='mr-2 h-5 w-5 text-error' />
            <span className='text-sm text-error'>{error}</span>
            <button
              onClick={() => setError(null)}
              className='ml-auto text-error hover:text-red-700'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        </section>
      )}

      {/* Tabs */}
      <section className='mb-6'>
        <div className='flex border-b border-border'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-primarySolid text-primarySolid'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className='grid grid-cols-3 gap-6'>
          <div className='col-span-2 space-y-6'>
            {/* Plan Details */}
            <section className='border-t border-border pt-6 pb-2'>
              <div className='mb-6 flex items-center'>
                <div className='flex items-center h-5 w-5'>
                  <Info className='h-5 w-5 text-primary' />
                </div>
                <div className='ml-4'>
                  <h2 className='text-xl font-semibold text-textPrimary'>
                    Plan Details
                  </h2>
                  <p className='text-sm text-textSecondary'>
                    Core plan information
                  </p>
                </div>
              </div>

              {isEditing ? (
                <div className='space-y-4'>
                  <div>
                    <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                      Plan Name
                    </label>
                    <input
                      type='text'
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className='h-11 w-full rounded-lg border border-border px-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    />
                  </div>
                  <div>
                    <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className='w-full rounded-lg border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                        Sort Order
                      </label>
                      <input
                        type='number'
                        value={formData.sort_order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sort_order: parseInt(e.target.value) || 0,
                          })
                        }
                        className='h-11 w-full rounded-lg border border-border px-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                      />
                    </div>
                  </div>
                  <div className='flex items-center space-x-6'>
                    <label className='flex cursor-pointer items-center'>
                      <input
                        type='checkbox'
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_active: e.target.checked,
                          })
                        }
                        className='mr-2 h-4 w-4'
                      />
                      <span className='text-sm text-textPrimary'>Active</span>
                    </label>
                    <label className='flex cursor-pointer items-center'>
                      <input
                        type='checkbox'
                        checked={formData.is_public}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_public: e.target.checked,
                          })
                        }
                        className='mr-2 h-4 w-4'
                      />
                      <span className='text-sm text-textPrimary'>Public</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div className='grid grid-cols-2 gap-6'>
                    <div>
                      <div className='mb-1 text-sm text-textSecondary'>
                        Plan Code
                      </div>
                      <div className='font-mono text-base font-medium text-textPrimary'>
                        {plan.code}
                      </div>
                    </div>
                    <div>
                      <div className='mb-1 text-sm text-textSecondary'>
                        Plan Type
                      </div>
                      <div className='text-base font-medium text-textPrimary'>
                        {getPlanTypeLabel(plan.plan_type)}
                      </div>
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-6'>
                    <div>
                      <div className='mb-1 text-sm text-textSecondary'>
                        Sort Order
                      </div>
                      <div className='text-base font-medium text-textPrimary'>
                        {plan.sort_order}
                      </div>
                    </div>
                    <div>
                      <div className='mb-1 text-sm text-textSecondary'>
                        Visibility
                      </div>
                      <div className='text-base font-medium text-textPrimary'>
                        {plan.is_public ? 'Public' : 'Private'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-sm text-textSecondary'>
                      Description
                    </div>
                    <div className='text-base text-textPrimary'>
                      {plan.description || 'No description'}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Active Version */}
            <section className='border-t border-border pt-6 pb-2'>
              <div className='mb-6 flex items-center justify-between'>
                <div className='flex items-center'>
                  <div className='flex items-center h-5 w-5'>
                    <GitBranch className='h-5 w-5 text-success' />
                  </div>
                  <div className='ml-4'>
                    <h2 className='text-xl font-semibold text-textPrimary'>
                      Active Version
                    </h2>
                    <p className='text-sm text-textSecondary'>
                      Current published version
                    </p>
                  </div>
                </div>
              </div>

              {plan.active_version ? (
                <div
                  className={`rounded-lg border p-4 ${
                    plan.active_version.is_offer
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='flex items-center gap-2'>
                        <span className='font-semibold text-textPrimary'>
                          Version {plan.active_version.version}
                        </span>
                        {plan.active_version.is_offer && (
                          <span className='text-xs font-semibold text-orange-700'>
                            Offer
                          </span>
                        )}
                      </div>
                      {plan.active_version.is_offer &&
                        plan.active_version.offer_name && (
                          <div className='mt-0.5 text-xs text-orange-600'>
                            {plan.active_version.offer_name}
                          </div>
                        )}
                      <div className='mt-1 text-sm text-textSecondary'>
                        {formatCurrency(
                          plan.active_version.price_monthly_usd,
                          'USD',
                        )}
                        /month
                        {' · '}
                        {formatCurrency(
                          plan.active_version.price_yearly_usd,
                          'USD',
                        )}
                        /year
                      </div>
                    </div>
                    <Link
                      href={`/plans/${planId}/versions/${plan.active_version.id}/edit`}
                      className='rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-green-600'
                    >
                      View Version
                    </Link>
                  </div>
                </div>
              ) : (
                <div className='rounded-lg border-2 border-dashed border-border py-8 text-center'>
                  <GitBranch className='mx-auto h-10 w-10 text-textSecondary opacity-30' />
                  <p className='mt-4 text-textSecondary'>
                    No active version published
                  </p>
                  <p className='mt-1 text-sm text-textSecondary'>
                    Create and publish a version to activate this plan
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className='col-span-1 space-y-6'>
            {/* Quick Stats */}
            <section className='border-t border-border pt-6 pb-2'>
              <h3 className='mb-4 font-semibold text-textPrimary'>
                Quick Stats
              </h3>
              <div className='space-y-4'>
                <div className='flex items-center justify-between border-b border-border pb-3'>
                  <span className='text-sm text-textSecondary'>Versions</span>
                  <span className='font-semibold text-textPrimary'>
                    {plan.version_count || 0}
                  </span>
                </div>
                <div className='flex items-center justify-between border-b border-border pb-3'>
                  <span className='text-sm text-textSecondary'>
                    Applications
                  </span>
                  <span className='font-semibold text-textPrimary'>
                    {planApplications.length}
                  </span>
                </div>
                <div className='flex items-center justify-between border-b border-border pb-3'>
                  <span className='text-sm text-textSecondary'>Created</span>
                  <span className='text-sm text-textSecondary'>
                    {formatDate(plan.created_at)}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Updated</span>
                  <span className='text-sm text-textSecondary'>
                    {formatDate(plan.updated_at)}
                  </span>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className='border-t border-border pt-6 pb-2'>
              <h3 className='mb-4 font-semibold text-textPrimary'>
                Quick Actions
              </h3>
              <div className='space-y-3'>
                <Link
                  href={`/plans/${planId}/versions/new`}
                  className='flex w-full items-center justify-center rounded-lg bg-primarySolid px-4 py-3 text-sm font-semibold text-white transition hover:bg-primaryHover'
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Create New Version
                </Link>
                <Link
                  href={`/plan-versions?planId=${planId}`}
                  className='flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                >
                  <GitBranch className='mr-2 h-4 w-4' />
                  View All Versions
                </Link>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'versions' && (
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-semibold text-textPrimary'>
              Plan Versions
            </h2>
            <Link
              href={`/plans/${planId}/versions/new`}
              className='flex h-10 items-center rounded-lg bg-primarySolid px-4 text-sm font-semibold text-white transition hover:bg-primaryHover'
            >
              <Plus className='mr-2 h-4 w-4' />
              Create Version
            </Link>
          </div>

          {/* Versions List */}
          {versionsLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-primarySolid' />
            </div>
          ) : versions.length === 0 ? (
            <div className='rounded-lg border-2 border-dashed border-border py-12 text-center'>
              <GitBranch className='mx-auto h-12 w-12 text-textSecondary opacity-30' />
              <p className='mt-4 text-textSecondary'>No versions yet</p>
              <Link
                href={`/plans/${planId}/versions/new`}
                className='mt-4 inline-block text-sm font-medium text-primarySolid hover:underline'
              >
                Create your first version
              </Link>
            </div>
          ) : (
            <div className='overflow-hidden rounded-lg border border-border'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-border'>
                    <th className='px-6 py-3 text-left text-sm font-semibold text-textSecondary'>
                      Version
                    </th>
                    <th className='px-6 py-3 text-left text-sm font-semibold text-textSecondary'>
                      Status
                    </th>
                    <th className='px-6 py-3 text-left text-sm font-semibold text-textSecondary'>
                      Monthly USD
                    </th>
                    <th className='px-6 py-3 text-left text-sm font-semibold text-textSecondary'>
                      Yearly USD
                    </th>
                    <th className='px-6 py-3 text-left text-sm font-semibold text-textSecondary'>
                      Products
                    </th>
                    <th className='px-6 py-3 text-left text-sm font-semibold text-textSecondary'>
                      Created
                    </th>
                    <th className='px-6 py-3 text-right text-sm font-semibold text-textSecondary'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <tr
                      key={version.id}
                      className='border-b border-border last:border-0'
                    >
                      <td className='px-6 py-4'>
                        <div className='flex items-center gap-2'>
                          <span className='font-semibold text-textPrimary'>
                            v{version.version}
                          </span>
                          {version.is_offer && (
                            <span className='text-xs font-semibold text-orange-700'>
                              Offer
                            </span>
                          )}
                        </div>
                        {version.is_offer && version.offer_name && (
                          <div className='mt-0.5 text-xs text-textSecondary'>
                            {version.offer_name}
                          </div>
                        )}
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            version.is_active
                              ? 'bg-green-50 text-success'
                              : version.retired_at
                                ? 'bg-gray-100 text-textSecondary'
                                : 'bg-amber-50 text-warning'
                          }`}
                        >
                          {version.is_active
                            ? 'Active'
                            : version.retired_at
                              ? 'Retired'
                              : 'Draft'}
                        </span>
                      </td>
                      <td className='px-6 py-4 text-sm text-textPrimary'>
                        {formatCurrency(version.price_monthly_usd, 'USD')}
                      </td>
                      <td className='px-6 py-4 text-sm text-textPrimary'>
                        {formatCurrency(version.price_yearly_usd, 'USD')}
                      </td>
                      <td className='px-6 py-4 text-sm text-textSecondary'>
                        {version.products?.length || 0} products
                      </td>
                      <td className='px-6 py-4 text-sm text-textSecondary'>
                        {formatDate(version.created_at)}
                      </td>
                      <td className='px-6 py-4 text-right'>
                        <Link
                          href={`/plans/${planId}/versions/${version.id}/edit`}
                          className='text-sm font-medium text-primarySolid hover:underline'
                        >
                          {version.is_active || version.retired_at
                            ? 'View'
                            : 'Edit'}
                        </Link>
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
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-semibold text-textPrimary'>
              Linked Applications
            </h2>
            <button
              onClick={() => setShowLinkApp(true)}
              className='flex h-10 items-center rounded-lg bg-primarySolid px-4 text-sm font-semibold text-white transition hover:bg-primaryHover'
            >
              <Plus className='mr-2 h-4 w-4' />
              Link Application
            </button>
          </div>

          {/* Link Application Form */}
          {showLinkApp && (
            <div className='rounded-lg border border-primary bg-primary-50 p-6'>
              <h4 className='mb-4 font-semibold text-textPrimary'>
                Link Application to Plan
              </h4>
              <div className='flex items-end gap-4'>
                <div className='flex-1'>
                  <label className='mb-1 block text-sm text-textSecondary'>
                    Select Application
                  </label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                  >
                    <option value=''>Choose an application...</option>
                    {availableApps.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name} ({app.code})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setShowLinkApp(false);
                    setSelectedAppId('');
                  }}
                  className='h-10 rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkApp}
                  disabled={linkAppMutation.isLoading}
                  className='flex h-10 items-center rounded-lg bg-primarySolid px-4 text-sm font-medium text-white hover:bg-primaryHover disabled:opacity-50'
                >
                  {linkAppMutation.isLoading && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  Link
                </button>
              </div>
            </div>
          )}

          {/* Applications List */}
          {planAppsLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-primarySolid' />
            </div>
          ) : planApplications.length === 0 ? (
            <div className='rounded-lg border-2 border-dashed border-border py-12 text-center'>
              <Layers className='mx-auto h-12 w-12 text-textSecondary opacity-30' />
              <p className='mt-4 text-textSecondary'>
                No applications linked to this plan
              </p>
              <button
                onClick={() => setShowLinkApp(true)}
                className='mt-4 text-sm font-medium text-primarySolid hover:underline'
              >
                Link your first application
              </button>
            </div>
          ) : (
            <div className='grid gap-4'>
              {planApplications.map((pa) => (
                <div
                  key={pa.id}
                  className='flex items-center justify-between border-t border-border pt-4 pb-2'
                >
                  <div className='flex items-center'>
                    <div className='flex items-center h-5 w-5'>
                      <Layers className='h-6 w-6 text-primary' />
                    </div>
                    <div className='ml-4'>
                      <div className='font-semibold text-textPrimary'>
                        {pa.application_name}
                      </div>
                      <div className='text-sm text-textSecondary'>
                        {pa.application_code}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center space-x-3'>
                    <Link
                      href={`/applications/${pa.application_id}`}
                      className='text-sm text-primarySolid hover:underline'
                    >
                      View
                    </Link>
                    <button
                      onClick={() =>
                        openUnlinkModal(pa.application_id, pa.application_name)
                      }
                      className='text-error hover:text-red-700'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unlink Application Confirm Modal */}
      <ConfirmModal
        isOpen={unlinkModal.isOpen}
        onClose={closeUnlinkModal}
        onConfirm={handleUnlinkApp}
        title='Unlink Application'
        message={`Are you sure you want to unlink "${unlinkModal.appName}" from this plan? This will remove the application from this plan.`}
        confirmText='Unlink'
        cancelText='Cancel'
        variant='danger'
        isLoading={unlinkAppMutation.isLoading}
      />
    </div>
  );
}
