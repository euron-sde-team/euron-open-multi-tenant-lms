'use client';

import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Layers,
  MinusCircle,
  Plus,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useGetPlans } from '@/lib/api/hooks';
import { Plan as ApiPlan } from '@/lib/api/types';

// Color classes for gradients
const colorClasses: Record<
  string,
  { gradient: string; lightText: string; buttonBg: string; buttonHover: string }
> = {
  blue: {
    gradient: 'from-primary-500 to-primary-600',
    lightText: 'text-primary-100',
    buttonBg: 'bg-primarySolid',
    buttonHover: 'hover:bg-primaryHover',
  },
  purple: {
    gradient: 'from-purple-500 to-purple-600',
    lightText: 'text-purple-100',
    buttonBg: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-700',
  },
  green: {
    gradient: 'from-green-500 to-green-600',
    lightText: 'text-green-100',
    buttonBg: 'bg-success',
    buttonHover: 'hover:bg-green-700',
  },
  indigo: {
    gradient: 'from-indigo-500 to-indigo-600',
    lightText: 'text-indigo-100',
    buttonBg: 'bg-indigo-600',
    buttonHover: 'hover:bg-indigo-700',
  },
  orange: {
    gradient: 'from-orange-500 to-orange-600',
    lightText: 'text-orange-100',
    buttonBg: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-700',
  },
  teal: {
    gradient: 'from-teal-500 to-teal-600',
    lightText: 'text-teal-100',
    buttonBg: 'bg-teal-600',
    buttonHover: 'hover:bg-teal-700',
  },
  pink: {
    gradient: 'from-pink-500 to-pink-600',
    lightText: 'text-pink-100',
    buttonBg: 'bg-pink-600',
    buttonHover: 'hover:bg-pink-700',
  },
  gray: {
    gradient: 'from-gray-500 to-gray-600',
    lightText: 'text-gray-200',
    buttonBg: 'bg-gray-400',
    buttonHover: '',
  },
  cyan: {
    gradient: 'from-cyan-500 to-cyan-600',
    lightText: 'text-cyan-100',
    buttonBg: 'bg-cyan-600',
    buttonHover: 'hover:bg-cyan-700',
  },
};

export default function PlansPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const plansPerPage = 9;

  // Fetch plans using react-query, all filters are backend-driven
  const {
    data: plansData,
    isLoading,
    error,
  } = useGetPlans({
    search: searchQuery || undefined,
    plan_type: typeFilter as 'SINGLE_APP' | 'BUNDLE' | 'ENTERPRISE' | undefined,
    has_active_version:
      statusFilter === 'active'
        ? true
        : statusFilter === 'inactive'
          ? false
          : undefined,
  });

  const plans = plansData?.plans || [];

  // Pagination
  const totalPages = Math.ceil(plans.length / plansPerPage);
  const paginatedPlans = plans.slice(
    (currentPage - 1) * plansPerPage,
    currentPage * plansPerPage,
  );

  // Stats, a plan is "active" only if it has a published active_version
  const stats = {
    total: plansData?.total || plans.length,
    active: plans.filter((p) => p.active_version !== null).length,
    inactive: plans.filter((p) => p.active_version === null).length,
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading plans...</p>
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
            Failed to load plans
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
        </div>
      </div>
    );
  }

  const renderPlanCard = (plan: ApiPlan) => {
    const IconComponent = Layers;
    const hasActiveVersion = plan.active_version !== null;
    const colorTheme = !hasActiveVersion
      ? 'gray'
      : plan.plan_type === 'ENTERPRISE'
        ? 'purple'
        : plan.plan_type === 'BUNDLE'
          ? 'green'
          : 'blue';
    const colors = colorClasses[colorTheme] || colorClasses.blue;
    const status = hasActiveVersion ? 'Active' : 'Inactive';

    return (
      <div
        key={plan.id}
        className={`rounded-lg border ${hasActiveVersion ? 'border-border hover:border-primary' : 'border-border'} bg-surface overflow-hidden transition hover:shadow-lg ${!hasActiveVersion ? 'opacity-70' : ''}`}
      >
        {/* Gradient Header */}
        <div className={`bg-gradient-to-br ${colors.gradient} p-6 text-white`}>
          <div className='flex items-start justify-between mb-4'>
            <div>
              <div className='flex items-center space-x-2 mb-2'>
                <span className='text-white text-xs font-semibold'>
                  {plan.plan_type?.replace('_', ' ') || 'SINGLE APP'}
                </span>
                <span
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full ${hasActiveVersion ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}
                >
                  {status}
                </span>
              </div>
              <h3 className='text-2xl font-bold'>{plan.name}</h3>
              <p className={`text-sm ${colors.lightText} mt-1`}>{plan.code}</p>
              <span className='mt-1 inline-flex items-center rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white'>
                Sort #{plan.sort_order}
              </span>
            </div>
            <div className='w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center'>
              <IconComponent className='h-6 w-6' />
            </div>
          </div>
          <div className='flex items-baseline'>
            <span className='text-4xl font-bold'>
              $
              {(
                (plan.active_version?.price_monthly_usd ??
                  plan.latest_version?.price_monthly_usd) ||
                0
              ).toLocaleString()}
            </span>
            <span className={`text-lg ml-2 ${colors.lightText}`}>/month</span>
            {!plan.active_version && plan.latest_version && (
              <span className='ml-2 text-xs'>
                Draft
              </span>
            )}
            {(plan.active_version?.is_offer ||
              (!plan.active_version && plan.latest_version?.is_offer)) && (
              <span className='ml-2 text-xs text-white font-semibold'>
                Offer
              </span>
            )}
          </div>
          {(plan.active_version?.is_offer ||
            (!plan.active_version && plan.latest_version?.is_offer)) &&
            (plan.active_version?.offer_name ||
              plan.latest_version?.offer_name) && (
              <p
                className={`text-sm ${colors.lightText} mt-1 truncate`}
                title={
                  plan.active_version?.offer_name ||
                  plan.latest_version?.offer_name ||
                  ''
                }
              >
                {plan.active_version?.offer_name ||
                  plan.latest_version?.offer_name}
              </p>
            )}
        </div>

        {/* Card Body */}
        <div className='p-6'>
          <div className='grid grid-cols-2 gap-4 mb-6'>
            <div>
              <div className='text-xs text-textSecondary mb-1'>
                Active Version
              </div>
              <div
                className={`text-sm font-semibold ${plan.active_version ? 'text-textPrimary' : 'text-textSecondary'}`}
              >
                {plan.active_version?.version || 'Not published'}
              </div>
            </div>
            <div>
              <div className='text-xs text-textSecondary mb-1'>Versions</div>
              <div className='text-sm font-semibold text-textPrimary'>
                {plan.version_count || 0} versions
              </div>
            </div>
          </div>

          <div className='mb-6'>
            <div className='text-xs text-textSecondary mb-2'>Plan Details</div>
            <div className='text-sm text-textPrimary'>
              {plan.description || 'No description available'}
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <Link
              href={`/plans/${plan.id}/edit`}
              className={`flex-1 h-10 ${colors.buttonBg} ${colors.buttonHover} text-white font-semibold rounded-lg text-sm transition flex items-center justify-center`}
            >
              Edit Plan
            </Link>
            <Link
              href={`/plan-versions?planId=${plan.id}`}
              className='w-10 h-10 border border-border text-textSecondary hover:bg-primary-50 hover:text-primarySolid hover:border-primarySolid rounded-lg transition flex items-center justify-center'
              title='View Versions'
            >
              <GitBranch className='h-4 w-4' />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-textPrimary mb-2'>
              Plans Management
            </h1>
            <p className='text-textSecondary'>
              Manage commercial plan templates and pricing structures
            </p>
          </div>
          <Link
            href='/plans/new'
            className='h-10 px-5 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm transition flex items-center'
          >
            <Plus className='h-4 w-4 mr-2' />
            Create Plan
          </Link>
        </div>
      </section>

      {/* Filters */}
      <section className='mb-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='flex items-center space-x-4'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textSecondary' />
              <input
                type='text'
                placeholder='Search plans by name or code...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='h-10 pl-10 pr-4 w-80 bg-bgGray border border-border rounded-lg text-sm focus:outline-none focus:border-primary'
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label='Filter by plan type'
              className='h-10 px-4 bg-surface border border-border rounded-lg text-sm font-medium text-textPrimary focus:outline-none focus:border-primary'
            >
              <option value=''>All Types</option>
              <option value='SINGLE_APP'>Single App</option>
              <option value='BUNDLE'>Bundle</option>
              <option value='ENTERPRISE'>Enterprise</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label='Filter by status'
              className='h-10 px-4 bg-surface border border-border rounded-lg text-sm font-medium text-textPrimary focus:outline-none focus:border-primary'
            >
              <option value=''>All Status</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className='mb-8'>
        <div className='grid grid-cols-3 gap-4'>
          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <Layers className='h-5 w-5 text-primary' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.total}
            </div>
            <div className='text-sm text-textSecondary'>Total Plans</div>
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
            <div className='text-sm text-textSecondary'>Active Plans</div>
          </div>

          <div className='border-t border-border pt-5 pb-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center h-5 w-5'>
                <MinusCircle className='h-5 w-5 text-textSecondary' />
              </div>
            </div>
            <div className='text-2xl font-bold text-textPrimary mb-1'>
              {stats.inactive}
            </div>
            <div className='text-sm text-textSecondary'>Inactive Plans</div>
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className='mb-8'>
        <div className='grid grid-cols-3 gap-6'>
          {paginatedPlans.map((plan) => renderPlanCard(plan))}
        </div>
      </section>

      {/* Pagination */}
      <section className='flex items-center justify-between'>
        <div className='text-sm text-textSecondary'>
          Showing {paginatedPlans.length} of {plans.length} plans
        </div>
        <div className='flex items-center space-x-2'>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textSecondary hover:bg-bgGray disabled:opacity-50'
            aria-label='Previous page'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg font-medium ${
                page === currentPage
                  ? 'bg-primarySolid text-white'
                  : 'border border-border text-textPrimary hover:bg-bgGray'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textSecondary hover:bg-bgGray disabled:opacity-50'
            aria-label='Next page'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </section>
    </div>
  );
}
