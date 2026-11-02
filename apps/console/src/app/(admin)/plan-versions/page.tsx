'use client';

import {
  ChevronRight,
  ExternalLink,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useGetPlans, useGetPlanVersions } from '@/lib/api/hooks/usePlans';
import { PlanVersion } from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

import { EntitlementSyncModal } from '@/components/plans/EntitlementSyncModal';

export default function PlanVersionsPage() {
  const searchParams = useSearchParams();
  const initialPlanId = searchParams.get('planId') || '';

  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Version whose products get backfilled onto tenants already on this plan.
  const [syncVersion, setSyncVersion] = useState<PlanVersion | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch all plans for the dropdown
  const { data: plansData, isLoading: plansLoading } = useGetPlans();
  const plans = plansData?.plans || [];

  // Fetch versions for the selected plan
  const {
    data: versionsData,
    isLoading: versionsLoading,
    refetch: refetchVersions,
    isFetching: versionsFetching,
  } = useGetPlanVersions(selectedPlanId || undefined);
  const versions = versionsData?.versions || [];

  // Get the selected plan object
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Filter versions based on search and status
  const filteredVersions = versions.filter((version) => {
    // Status filter
    if (statusFilter === 'active' && !version.is_active) return false;
    if (statusFilter === 'draft' && (version.is_active || version.retired_at))
      return false;
    if (statusFilter === 'retired' && !version.retired_at) return false;

    // Search filter (search by version number)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      const versionStr = `v${version.version}`.toLowerCase();
      if (!versionStr.includes(searchLower)) return false;
    }

    return true;
  });

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

  const getStatusBadge = (version: PlanVersion) => {
    if (version.is_active) {
      return (
        <span className='text-xs font-semibold text-success'>
          Active
        </span>
      );
    }
    if (version.retired_at) {
      return (
        <span className='text-xs font-semibold text-textSecondary'>
          Retired
        </span>
      );
    }
    return (
      <span className='text-xs font-semibold text-warning'>
        Draft
      </span>
    );
  };

  // Stats
  const totalVersions = versions.length;
  const activeVersions = versions.filter((v) => v.is_active).length;
  const draftVersions = versions.filter(
    (v) => !v.is_active && !v.retired_at,
  ).length;
  const retiredVersions = versions.filter((v) => v.retired_at).length;
  const offerVersions = versions.filter((v) => v.is_offer).length;

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <div className='mb-4 flex items-center text-sm text-textSecondary'>
          <Link href='/plans' className='hover:text-primary'>
            Catalog
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <Link href='/plans' className='hover:text-primary'>
            Plans
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <span className='font-medium text-textPrimary'>Plan Versions</span>
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Plan Versions
            </h1>
            <p className='text-textSecondary'>
              {selectedPlan
                ? `Viewing versions for ${selectedPlan.name}`
                : 'Select a plan to view its versions'}
            </p>
          </div>
          {selectedPlanId && (
            <Link
              href={`/plans/${selectedPlanId}/versions/new`}
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white transition hover:bg-primaryHover'
            >
              <Plus className='mr-2 h-4 w-4' />
              Create New Version
            </Link>
          )}
        </div>
      </section>

      {/* Stats Cards */}
      {selectedPlanId && (
        <section className='mb-6 grid grid-cols-5 gap-4'>
          <div className='border-t border-border pt-4 pb-2'>
            <div className='text-sm text-textSecondary'>Total Versions</div>
            <div className='mt-1 text-2xl font-bold text-textPrimary'>
              {totalVersions}
            </div>
          </div>
          <div className='rounded-lg border border-green-200 bg-green-50 p-4'>
            <div className='text-sm text-success'>Active</div>
            <div className='mt-1 text-2xl font-bold text-success'>
              {activeVersions}
            </div>
          </div>
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
            <div className='text-sm text-warning'>Draft</div>
            <div className='mt-1 text-2xl font-bold text-warning'>
              {draftVersions}
            </div>
          </div>
          <div className='rounded-lg border border-orange-200 bg-orange-50 p-4'>
            <div className='text-sm text-orange-600'>Offers</div>
            <div className='mt-1 text-2xl font-bold text-orange-600'>
              {offerVersions}
            </div>
          </div>
          <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
            <div className='text-sm text-textSecondary'>Retired</div>
            <div className='mt-1 text-2xl font-bold text-textSecondary'>
              {retiredVersions}
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className='mb-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              {/* Plan Select */}
              <div>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className='h-10 w-64 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
                  disabled={plansLoading}
                >
                  <option value=''>Select a plan...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.code})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlanId && (
                <>
                  {/* Search */}
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                    <input
                      type='text'
                      placeholder='Search versions...'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className='h-10 w-60 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
                  >
                    <option value=''>All Status</option>
                    <option value='active'>Active</option>
                    <option value='draft'>Draft</option>
                    <option value='retired'>Retired</option>
                  </select>
                </>
              )}
            </div>

            {selectedPlanId && (
              <button
                onClick={() => refetchVersions()}
                disabled={versionsFetching}
                className='flex h-10 w-10 items-center justify-center rounded-lg border border-border text-textSecondary transition hover:bg-bgGray disabled:opacity-50'
              >
                <RefreshCw
                  className={`h-4 w-4 ${versionsFetching ? 'animate-spin' : ''}`}
                />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      {!selectedPlanId ? (
        <div className='rounded-lg border-2 border-dashed border-border py-16 text-center'>
          <Layers className='mx-auto h-16 w-16 text-textSecondary opacity-30' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Select a Plan
          </h3>
          <p className='mt-2 text-textSecondary'>
            Choose a plan from the dropdown above to view its versions
          </p>
        </div>
      ) : versionsLoading ? (
        <div className='flex items-center justify-center py-16'>
          <div className='flex flex-col items-center gap-4'>
            <Loader2 className='h-12 w-12 animate-spin text-primarySolid' />
            <p className='text-textSecondary'>Loading versions...</p>
          </div>
        </div>
      ) : filteredVersions.length === 0 ? (
        <div className='rounded-lg border-2 border-dashed border-border py-16 text-center'>
          <GitBranch className='mx-auto h-16 w-16 text-textSecondary opacity-30' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            {versions.length === 0 ? 'No Versions Yet' : 'No Matching Versions'}
          </h3>
          <p className='mt-2 text-textSecondary'>
            {versions.length === 0
              ? 'Create the first version for this plan'
              : 'Try adjusting your filters'}
          </p>
          {versions.length === 0 && (
            <Link
              href={`/plans/${selectedPlanId}/edit`}
              className='mt-4 inline-flex items-center text-sm font-medium text-primarySolid hover:underline'
            >
              <Plus className='mr-1 h-4 w-4' />
              Create First Version
            </Link>
          )}
        </div>
      ) : (
        <div className='overflow-hidden border-t border-border'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-border'>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Version
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Status
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Monthly Price
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Yearly Price
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Products
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Created
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                  Published
                </th>
                <th className='px-6 py-4 text-right text-sm font-semibold text-textSecondary'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVersions.map((version) => (
                <tr
                  key={version.id}
                  className='border-b border-border last:border-0 hover:bg-bgGray/50'
                >
                  <td className='px-6 py-4'>
                    <div className='flex items-center'>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          version.is_offer ? 'bg-orange-100' : 'bg-primary-100'
                        }`}
                      >
                        <GitBranch
                          className={`h-5 w-5 ${
                            version.is_offer
                              ? 'text-orange-600'
                              : 'text-primary'
                          }`}
                        />
                      </div>
                      <div className='ml-3'>
                        <div className='flex items-center gap-2'>
                          <span className='font-semibold text-textPrimary'>
                            Version {version.version}
                          </span>
                          {version.is_offer && (
                            <span className='text-xs font-semibold text-orange-700'>
                              Offer
                            </span>
                          )}
                        </div>
                        <div className='text-xs text-textSecondary'>
                          {version.is_offer && version.offer_name
                            ? version.offer_name
                            : selectedPlan?.code}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='flex flex-col gap-1'>
                      {getStatusBadge(version)}
                      {version.is_offer &&
                        (version.offer_valid_from ||
                          version.offer_valid_to) && (
                          <div className='text-xs text-textSecondary'>
                            {version.offer_valid_from
                              ? formatDate(version.offer_valid_from)
                              : '?'}
                            {' - '}
                            {version.offer_valid_to
                              ? formatDate(version.offer_valid_to)
                              : '?'}
                          </div>
                        )}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='font-medium text-textPrimary'>
                      {formatCurrency(version.price_monthly_usd, 'USD')}
                    </div>
                    <div className='text-xs text-textSecondary'>
                      {formatCurrency(version.price_monthly_inr, 'INR')}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='font-medium text-textPrimary'>
                      {formatCurrency(version.price_yearly_usd, 'USD')}
                    </div>
                    <div className='text-xs text-textSecondary'>
                      {formatCurrency(version.price_yearly_inr, 'INR')}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <span className='rounded-lg bg-primary-50 px-2.5 py-1 text-sm font-medium text-primary'>
                      {version.products?.length || 0} products
                    </span>
                  </td>
                  <td className='px-6 py-4 text-sm text-textSecondary'>
                    {formatDate(version.created_at)}
                  </td>
                  <td className='px-6 py-4 text-sm text-textSecondary'>
                    {formatDate(version.published_at)}
                  </td>
                  <td className='px-6 py-4 text-right'>
                    <div className='inline-flex items-center gap-2'>
                      {version.published_at && (
                        <button
                          onClick={() => setSyncVersion(version)}
                          className='inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-textPrimary transition hover:bg-bgGray'
                          title="Grant this version's products to tenants already on the plan"
                        >
                          <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
                          Sync
                        </button>
                      )}
                      <Link
                        href={`/plans/${selectedPlanId}/versions/${version.id}/edit`}
                        className='inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-textPrimary transition hover:bg-bgGray'
                      >
                        {version.is_active || version.retired_at
                          ? 'View'
                          : 'Edit'}
                        <ExternalLink className='ml-1.5 h-3.5 w-3.5' />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Plan Info */}
      {selectedPlan && (
        <section className='mt-6'>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary'>
                  <Layers className='h-6 w-6 text-white' />
                </div>
                <div className='ml-4'>
                  <h3 className='font-semibold text-textPrimary'>
                    {selectedPlan.name}
                  </h3>
                  <p className='text-sm text-textSecondary'>
                    {selectedPlan.code} · {selectedPlan.plan_type}
                    {selectedPlan.is_public ? ' · Public' : ' · Private'}
                  </p>
                </div>
              </div>
              <Link
                href={`/plans/${selectedPlanId}/edit`}
                className='flex items-center text-sm font-medium text-primarySolid hover:underline'
              >
                Manage Plan
                <ExternalLink className='ml-1 h-4 w-4' />
              </Link>
            </div>
          </div>
        </section>
      )}

      {syncVersion && (
        <EntitlementSyncModal
          planId={selectedPlanId}
          sourceVersionId={syncVersion.id}
          planName={selectedPlan?.name}
          versionNumber={syncVersion.version}
          onClose={() => setSyncVersion(null)}
        />
      )}
    </div>
  );
}
