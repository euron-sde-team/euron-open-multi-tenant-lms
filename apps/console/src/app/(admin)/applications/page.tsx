'use client';

import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  ClipboardList,
  Database,
  Download,
  Edit,
  FileText,
  Globe,
  GraduationCap,
  Grid3x3,
  Handshake,
  Headset,
  LayoutGrid,
  List,
  Lock,
  Mail,
  MessageSquare,
  MoreVertical,
  Package,
  Plus,
  Puzzle,
  Search,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useGetApplications, useUpdateApplication } from '@/lib/api/hooks';
import { Application } from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

import PageHeader from '@/components/common/PageHeader';
import StatsCard from '@/components/common/StatsCard';
import { TableLoadingOverlay } from '@/components/common/TableShimmer';

// Icon mapping for different application types
const appIconComponents: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'graduation-cap': GraduationCap,
  'users-gear': Users,
  handshake: Handshake,
  clipboard: ClipboardList,
  'chart-line': BarChart3,
  box: Package,
  envelope: Mail,
  headset: Headset,
  'file-invoice': FileText,
  'calendar-days': Calendar,
  database: Database,
  comments: MessageSquare,
};

// Gradient colors for different apps
const appGradients = [
  'from-primary-500 to-primary-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-red-500 to-red-600',
  'from-indigo-500 to-indigo-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
  'from-yellow-500 to-yellow-600',
  'from-cyan-500 to-cyan-600',
  'from-gray-500 to-gray-600',
  'from-lime-500 to-lime-600',
];

export default function ApplicationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);

  // Debounce search query to prevent excessive API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch applications using react-query
  const {
    data: applicationsData,
    isLoading,
    isFetching,
    error,
  } = useGetApplications({
    search: debouncedSearch || undefined,
    is_active:
      statusFilter === 'active'
        ? true
        : statusFilter === 'inactive'
          ? false
          : undefined,
  });

  // Update mutation for toggling status
  const updateMutation = useUpdateApplication();

  // Handle status toggle
  const handleToggleStatus = (app: Application) => {
    setTogglingAppId(app.id);
    updateMutation.mutate(
      {
        id: app.id,
        data: { is_active: !app.is_active },
      },
      {
        onSettled: () => {
          setTogglingAppId(null);
        },
      },
    );
  };

  const applications = applicationsData?.applications || [];

  const stats = {
    total: applicationsData?.total || applications.length,
    active: applications.filter((a) => a.is_active).length,
    totalFeatures: applications.reduce(
      (sum, a) => sum + (a.feature_count || 0),
      0,
    ),
    totalTenants: 0, // tenants_count not available in API
  };

  // Calculate feature distribution
  const featureDistribution = {
    high: applications.filter(
      (a) => (a.feature_count || 0) >= 20 && (a.feature_count || 0) <= 30,
    ).length,
    medium: applications.filter(
      (a) => (a.feature_count || 0) >= 15 && (a.feature_count || 0) < 20,
    ).length,
    low: applications.filter(
      (a) => (a.feature_count || 0) >= 10 && (a.feature_count || 0) < 15,
    ).length,
  };

  // Tenant adoption not available in API - using placeholder
  const tenantAdoption = {
    high: 0,
    medium: 0,
    low: applications.length,
  };

  // Initial loading state - only show full-page loader when no data exists yet
  if (isLoading && !applicationsData) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading applications...</p>
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
            Failed to load applications
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
        </div>
      </div>
    );
  }

  const getAppIcon = (index: number) => {
    const icons = Object.values(appIconComponents);
    return icons[index % icons.length];
  };

  const getAppGradient = (index: number) => {
    return appGradients[index % appGradients.length];
  };

  return (
    <div className='p-8'>
      <PageHeader
        title='Applications'
        description='Manage your software offerings and their features'
        actions={[
          { label: 'Export', icon: Download, variant: 'secondary' },
          {
            label: 'Add Application',
            icon: Plus,
            variant: 'primary',
            href: '/applications/new',
          },
        ]}
      />

      {/* Stats Grid */}
      <section className='mb-8 grid grid-cols-4 gap-6'>
        <StatsCard
          icon={Grid3x3}
          iconBgColor='bg-primary-100'
          iconColor='text-primary'
          value={stats.total}
          label='Total Applications'
          change='+3 this month'
          changeType='positive'
        />
        <StatsCard
          icon={CheckCircle}
          iconBgColor='bg-green-100'
          iconColor='text-success'
          value={stats.active}
          label='Active Applications'
          change='91.7%'
          changeType='positive'
        />
        <StatsCard
          icon={Puzzle}
          iconBgColor='bg-purple-100'
          iconColor='text-purple-600'
          value={stats.totalFeatures}
          label='Total Features'
          change='Avg 18.4'
          changeType='neutral'
        />
        <StatsCard
          icon={Building2}
          iconBgColor='bg-amber-100'
          iconColor='text-warning'
          value={stats.totalTenants}
          label='Active Tenants'
          change='+12.8%'
          changeType='positive'
        />
      </section>

      {/* Table Section */}
      <TableLoadingOverlay isLoading={isFetching && !!applicationsData}>
        <section className='border-t border-border pt-6 pb-2'>
          {/* Filters */}
          <div className='mb-6 flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Search applications...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='h-10 w-80 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                <option value=''>All Status</option>
                <option value='active'>Active</option>
                <option value='inactive'>Inactive</option>
              </select>
            </div>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => setViewMode('list')}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm ${
                  viewMode === 'list'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-border text-textSecondary hover:bg-bgGray'
                }`}
              >
                <List className='h-4 w-4' />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm ${
                  viewMode === 'grid'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-border text-textSecondary hover:bg-bgGray'
                }`}
              >
                <LayoutGrid className='h-4 w-4' />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th
                    className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'
                    style={{ width: '25%' }}
                  >
                    Application
                  </th>
                  <th
                    className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'
                    style={{ width: '30%' }}
                  >
                    Description
                  </th>
                  <th
                    className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'
                    style={{ width: '10%' }}
                  >
                    Features
                  </th>
                  <th
                    className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'
                    style={{ width: '10%' }}
                  >
                    Status
                  </th>
                  <th
                    className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'
                    style={{ width: '10%' }}
                  >
                    Tenants
                  </th>
                  <th
                    className='px-4 py-3 text-right text-sm font-semibold text-textSecondary'
                    style={{ width: '15%' }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='px-4 py-12 text-center'>
                      <Grid3x3 className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No applications found
                      </p>
                    </td>
                  </tr>
                ) : (
                  applications.map((app, index) => {
                    const IconComponent = getAppIcon(index);
                    const gradient = getAppGradient(index);
                    return (
                      <tr
                        key={app.id}
                        className='border-b border-border transition hover:bg-bgGray'
                      >
                        <td className='px-4 py-4'>
                          <div className='flex items-center'>
                            <div
                              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}
                            >
                              <IconComponent className='h-4 w-4 text-white' />
                            </div>
                            <div className='ml-3'>
                              <Link
                                href={`/applications/${app.id}`}
                                className='font-semibold text-textPrimary hover:text-primary'
                              >
                                {app.name}
                              </Link>
                              <div className='text-xs text-textSecondary font-mono'>
                                {app.code}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className='px-4 py-4'>
                          <p className='line-clamp-2 text-sm text-textPrimary'>
                            {app.description || 'No description'}
                          </p>
                        </td>
                        <td className='px-4 py-4'>
                          <span className='text-sm font-semibold text-textPrimary'>
                            {app.feature_count || 0}
                          </span>
                        </td>
                        <td className='px-4 py-4'>
                          <div className='flex flex-col space-y-1'>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                app.is_active
                                  ? 'bg-green-50 text-success'
                                  : 'bg-gray-100 text-textSecondary'
                              }`}
                            >
                              {app.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className='flex items-center text-xs text-textSecondary'>
                              {app.is_public ? (
                                <>
                                  <Globe className='mr-1 h-2.5 w-2.5' />
                                  Public
                                </>
                              ) : (
                                <>
                                  <Lock className='mr-1 h-2.5 w-2.5' />
                                  Private
                                </>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className='px-4 py-4'>
                          <span className='text-sm text-textSecondary'>-</span>
                        </td>
                        <td className='px-4 py-4'>
                          <div className='flex items-center justify-end space-x-2'>
                            <Link
                              href={`/applications/${app.id}/edit`}
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primary-500'
                              title='Edit'
                            >
                              <Edit className='h-4 w-4' />
                            </Link>
                            <Link
                              href={`/features?applicationId=${app.id}`}
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primary-500'
                              title='View Features'
                            >
                              <Puzzle className='h-4 w-4' />
                            </Link>
                            <button
                              onClick={() => handleToggleStatus(app)}
                              disabled={togglingAppId === app.id}
                              className={`flex h-8 w-8 items-center justify-center rounded transition ${
                                app.is_active
                                  ? 'text-success hover:bg-green-50'
                                  : 'text-textSecondary hover:bg-bgGray'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                              title={app.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {togglingAppId === app.id ? (
                                <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                              ) : app.is_active ? (
                                <ToggleRight className='h-5 w-5' />
                              ) : (
                                <ToggleLeft className='h-5 w-5' />
                              )}
                            </button>
                            <button className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'>
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
          <div className='mt-6 flex items-center justify-between border-t border-border pt-6'>
            <div className='text-sm text-textSecondary'>
              Showing 1-{applications.length} of {stats.total} applications
            </div>
            <div className='flex items-center space-x-2'>
              <button
                className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
                disabled
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 19l-7-7 7-7'
                  />
                </svg>
              </button>
              <button className='flex h-9 w-9 items-center justify-center rounded-lg bg-primarySolid font-medium text-white'>
                1
              </button>
              <button className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray'>
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 5l7 7-7 7'
                  />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </TableLoadingOverlay>

      {/* Insights Section */}
      <section className='mb-8 grid grid-cols-2 gap-6'>
        {/* Feature Distribution */}
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-6 flex items-center justify-between'>
            <h2 className='text-xl font-semibold text-textPrimary'>
              Feature Distribution
            </h2>
            <button className='text-sm font-medium text-primary hover:underline'>
              View All
            </button>
          </div>
          <div className='space-y-4'>
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textPrimary'>20-30 Features</span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {featureDistribution.high} apps (
                  {((featureDistribution.high / stats.total) * 100).toFixed(1)}
                  %)
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-bgGray'>
                <div
                  className='h-2 rounded-full bg-primary'
                  style={{
                    width: `${(featureDistribution.high / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textPrimary'>15-20 Features</span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {featureDistribution.medium} apps (
                  {((featureDistribution.medium / stats.total) * 100).toFixed(
                    1,
                  )}
                  %)
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-bgGray'>
                <div
                  className='h-2 rounded-full bg-purple-600'
                  style={{
                    width: `${(featureDistribution.medium / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textPrimary'>10-15 Features</span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {featureDistribution.low} apps (
                  {((featureDistribution.low / stats.total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-bgGray'>
                <div
                  className='h-2 rounded-full bg-green-600'
                  style={{
                    width: `${(featureDistribution.low / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Adoption */}
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-6 flex items-center justify-between'>
            <h2 className='text-xl font-semibold text-textPrimary'>
              Tenant Adoption
            </h2>
            <button className='text-sm font-medium text-primary hover:underline'>
              Full Report
            </button>
          </div>
          <div className='space-y-4'>
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textPrimary'>
                  High Adoption (100+)
                </span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {tenantAdoption.high} apps
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-bgGray'>
                <div
                  className='h-2 rounded-full bg-success'
                  style={{
                    width: `${(tenantAdoption.high / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textPrimary'>
                  Medium Adoption (50-100)
                </span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {tenantAdoption.medium} apps
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-bgGray'>
                <div
                  className='h-2 rounded-full bg-primary'
                  style={{
                    width: `${(tenantAdoption.medium / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textPrimary'>
                  Low Adoption (0-50)
                </span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {tenantAdoption.low} apps
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-bgGray'>
                <div
                  className='h-2 rounded-full bg-warning'
                  style={{
                    width: `${(tenantAdoption.low / stats.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
