'use client';

import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Code,
  Edit,
  Globe,
  Info,
  Layers,
  MoreVertical,
  Plus,
  Puzzle,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useGetApplication,
  useGetFeaturesByApplication,
} from '@/lib/api/hooks';

import StatusBadge from '@/components/common/StatusBadge';

type TabType = 'overview' | 'features' | 'plans' | 'tenants' | 'addons';

// Helper function to format date
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Color palette for features based on index
const featureColors = [
  'blue',
  'purple',
  'green',
  'amber',
  'indigo',
  'red',
  'pink',
  'teal',
  'orange',
  'cyan',
];

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [featureSearch, setFeatureSearch] = useState('');
  const [featureFilter, setFeatureFilter] = useState('');

  // Fetch application data from API
  const { data: application, isLoading, error } = useGetApplication(id);

  // Fetch features for this application
  const { data: featuresData, isLoading: featuresLoading } =
    useGetFeaturesByApplication(id);

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center p-8'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading application...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='flex h-96 items-center justify-center p-8'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load application
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
          <Link
            href='/applications'
            className='mt-4 inline-block text-primary hover:underline'
          >
            Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  // Not found state
  if (!application) {
    return (
      <div className='p-8'>
        <div className='border-t border-border py-8 text-center'>
          <p className='text-textSecondary'>Application not found</p>
          <Link
            href='/applications'
            className='mt-4 inline-block text-primary hover:underline'
          >
            Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  const tabs: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'features', label: 'Features', icon: Puzzle },
    { id: 'plans', label: 'Plans', icon: Layers },
    { id: 'tenants', label: 'Tenants', icon: Building2 },
    { id: 'addons', label: 'Add-ons', icon: Plus },
  ];

  // Get features from API data
  const features = featuresData?.features || [];

  const filteredFeatures = features.filter((f) => {
    const matchesSearch = f.name
      .toLowerCase()
      .includes(featureSearch.toLowerCase());
    // Map API is_deprecated to status
    const featureStatus = f.is_deprecated ? 'deprecated' : 'active';
    const matchesFilter = !featureFilter || featureStatus === featureFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className='p-8'>
      {/* Breadcrumb */}
      <section className='mb-6'>
        <div className='flex items-center text-sm text-textSecondary'>
          <Link href='/applications' className='hover:text-primary'>
            Applications
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <span className='font-medium text-textPrimary'>
            {application.name}
          </span>
        </div>
      </section>

      {/* Header Card */}
      <section className='mb-8'>
        <div className='border-t border-border pt-8 pb-2'>
          <div className='mb-6 flex items-start justify-between'>
            <div className='flex items-start'>
              <div className='flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600'>
                <Briefcase className='h-10 w-10 text-white' />
              </div>
              <div className='ml-6'>
                <div className='mb-2 flex items-center'>
                  <h1 className='text-3xl font-bold text-textPrimary'>
                    {application.name}
                  </h1>
                  <span className='ml-3'>
                    <StatusBadge
                      status={application.is_active ? 'active' : 'inactive'}
                    />
                  </span>
                </div>
                <p className='mb-3 text-textSecondary'>
                  {application.description || 'No description provided'}
                </p>
                <div className='flex items-center space-x-6 text-sm'>
                  <div className='flex items-center text-textSecondary'>
                    <Code className='mr-2 h-4 w-4 text-primary' />
                    <span className='font-medium'>App ID:</span>
                    <span className='ml-1 font-mono'>{application.code}</span>
                  </div>
                  <div className='flex items-center text-textSecondary'>
                    <Calendar className='mr-2 h-4 w-4 text-primary' />
                    <span>Created: {formatDate(application.created_at)}</span>
                  </div>
                  <div className='flex items-center text-textSecondary'>
                    <Clock className='mr-2 h-4 w-4 text-primary' />
                    <span>
                      Last Updated: {formatDate(application.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className='flex items-center space-x-3'>
              <Link
                href={`/applications/${id}/edit`}
                className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Link>
              <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'>
                <MoreVertical className='h-4 w-4' />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className='grid grid-cols-4 gap-6'>
            <div className='rounded-lg bg-bgGray p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textSecondary'>Status</span>
                <Info className='h-4 w-4 text-primary' />
              </div>
              <div className='text-2xl font-bold text-textPrimary'>
                {application.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div className='rounded-lg bg-bgGray p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textSecondary'>Visibility</span>
                <Globe className='h-4 w-4 text-success' />
              </div>
              <div className='text-2xl font-bold text-textPrimary'>
                {application.is_public ? 'Public' : 'Private'}
              </div>
            </div>

            <div className='rounded-lg bg-bgGray p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textSecondary'>Features</span>
                <Puzzle className='h-4 w-4 text-green-600' />
              </div>
              <div className='text-2xl font-bold text-textPrimary'>
                {application.feature_count}
              </div>
            </div>

            <div className='rounded-lg bg-bgGray p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm text-textSecondary'>Sort Order</span>
                <Layers className='h-4 w-4 text-amber-600' />
              </div>
              <div className='text-2xl font-bold text-textPrimary'>
                {application.sort_order}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabbed Content */}
      <section>
        <div className='border-t border-border'>
          {/* Tab Headers */}
          <div className='border-b border-border px-6'>
            <div className='flex items-center space-x-8'>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center border-b-2 px-4 py-4 text-sm font-semibold transition ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    <Icon className='mr-2 h-4 w-4' />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className='p-6'>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <div className='grid grid-cols-2 gap-6'>
                  <div className='rounded-lg border border-border p-6'>
                    <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                      Application
                    </h3>
                    <div className='space-y-4'>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          ID
                        </label>
                        <div className='mt-1 rounded bg-bgGray px-3 py-2 font-mono text-sm text-textPrimary'>
                          {application.id}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Name
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {application.name}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Code
                        </label>
                        <div className='mt-1 rounded bg-bgGray px-3 py-2 font-mono text-sm text-textPrimary'>
                          {application.code}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Description
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {application.description || '-'}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Icon URL
                        </label>
                        <div className='mt-1 break-all text-sm text-textPrimary'>
                          {application.icon_url || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className='rounded-lg border border-border p-6'>
                    <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
                      Settings
                    </h3>
                    <div className='space-y-4'>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Status
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {application.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Visibility
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {application.is_public ? 'Public' : 'Private'}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Sort Order
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {application.sort_order}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Feature Count
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {application.feature_count}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Created At
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {formatDate(application.created_at)}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-textSecondary'>
                          Updated At
                        </label>
                        <div className='mt-1 text-textPrimary'>
                          {formatDate(application.updated_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (
              <div>
                <div className='mb-6 flex items-center justify-between'>
                  <div>
                    <h3 className='text-xl font-semibold text-textPrimary'>
                      Application Features
                    </h3>
                    <p className='mt-1 text-sm text-textSecondary'>
                      {featuresLoading
                        ? 'Loading features...'
                        : `${features.length} features in this application`}
                    </p>
                  </div>
                  <Link
                    href={`/features/new?applicationId=${id}`}
                    className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white hover:bg-primaryHover'
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Add Feature
                  </Link>
                </div>

                <div className='mb-6 flex items-center space-x-3'>
                  <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                    <input
                      type='text'
                      placeholder='Search features...'
                      value={featureSearch}
                      onChange={(e) => setFeatureSearch(e.target.value)}
                      className='h-10 w-full rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                    />
                  </div>
                  <select
                    value={featureFilter}
                    onChange={(e) => setFeatureFilter(e.target.value)}
                    className='h-10 rounded-lg border border-border bg-surface px-4 text-sm'
                  >
                    <option value=''>All Features</option>
                    <option value='active'>Active</option>
                    <option value='deprecated'>Deprecated</option>
                  </select>
                </div>

                {featuresLoading ? (
                  <div className='flex h-48 items-center justify-center'>
                    <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
                  </div>
                ) : filteredFeatures.length === 0 ? (
                  <div className='flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border'>
                    <Puzzle className='h-12 w-12 text-textSecondary' />
                    <p className='mt-4 text-textSecondary'>No features found</p>
                    <Link
                      href={`/features/new?applicationId=${id}`}
                      className='mt-2 text-sm font-medium text-primary hover:underline'
                    >
                      Add your first feature
                    </Link>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    {filteredFeatures.map((feature, index) => {
                      const FeatureIcon = Puzzle;
                      const featureColor =
                        featureColors[index % featureColors.length];
                      const colorClasses: Record<string, string> = {
                        blue: 'bg-primary-100 text-primary',
                        purple: 'bg-purple-100 text-purple-600',
                        green: 'bg-green-100 text-success',
                        amber: 'bg-amber-100 text-warning',
                        indigo: 'bg-indigo-100 text-indigo-600',
                        red: 'bg-red-100 text-error',
                        pink: 'bg-pink-100 text-pink-600',
                        teal: 'bg-teal-100 text-teal-600',
                        orange: 'bg-orange-100 text-orange-600',
                        cyan: 'bg-cyan-100 text-cyan-600',
                      };
                      const isDeprecated = feature.is_deprecated;
                      return (
                        <div
                          key={feature.id}
                          className='rounded-lg border border-border p-4 transition hover:border-primary'
                        >
                          <div className='flex items-start justify-between'>
                            <div className='flex flex-1 items-start'>
                              <div
                                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${colorClasses[featureColor]}`}
                              >
                                <FeatureIcon className='h-6 w-6' />
                              </div>
                              <div className='ml-4 flex-1'>
                                <div className='mb-2 flex items-center'>
                                  <h4 className='font-semibold text-textPrimary'>
                                    {feature.name}
                                  </h4>
                                  <span
                                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      isDeprecated
                                        ? 'bg-gray-100 text-textSecondary'
                                        : 'bg-green-50 text-success'
                                    }`}
                                  >
                                    {isDeprecated ? 'Deprecated' : 'Active'}
                                  </span>
                                </div>
                                <p className='mb-3 text-sm text-textSecondary'>
                                  {feature.description || 'No description'}
                                </p>
                                <div className='flex items-center space-x-4 text-xs text-textSecondary'>
                                  <span>
                                    <Puzzle className='mr-1 inline h-3 w-3' />
                                    {feature.product_count || 0} products
                                  </span>
                                  {feature.category && (
                                    <span>
                                      <Layers className='mr-1 inline h-3 w-3' />
                                      {feature.category}
                                    </span>
                                  )}
                                  <span>
                                    <Code className='mr-1 inline h-3 w-3' />
                                    {feature.key}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button className='ml-4 text-textSecondary hover:text-textPrimary'>
                              <MoreVertical className='h-4 w-4' />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Plans Tab */}
            {activeTab === 'plans' && (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center'>
                <Layers className='h-12 w-12 text-textSecondary' />
                <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
                  Plans
                </h3>
                <p className='mt-1 text-sm text-textSecondary'>
                  Not available yet (API integration pending).
                </p>
              </div>
            )}

            {/* Tenants Tab */}
            {activeTab === 'tenants' && (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center'>
                <Building2 className='h-12 w-12 text-textSecondary' />
                <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
                  Tenants
                </h3>
                <p className='mt-1 text-sm text-textSecondary'>
                  Not available yet (API integration pending).
                </p>
              </div>
            )}

            {/* Add-ons Tab */}
            {activeTab === 'addons' && (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center'>
                <Plus className='h-12 w-12 text-textSecondary' />
                <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
                  Add-ons
                </h3>
                <p className='mt-1 text-sm text-textSecondary'>
                  Not available yet (API integration pending).
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
