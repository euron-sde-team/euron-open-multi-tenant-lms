'use client';

import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit,
  Grid3x3,
  Package,
  Plus,
  Puzzle,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useGetApplications, useGetFeatures } from '@/lib/api/hooks';
import { decodeHtmlEntities } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

import PageHeader from '@/components/common/PageHeader';
import { TableLoadingOverlay } from '@/components/common/TableShimmer';

// Category color mapping
const categoryColors: Record<string, { bg: string; text: string }> = {
  'Learning & Courses': { bg: 'bg-primary-50', text: 'text-primary-600' },
  'Assessment & Grading': { bg: 'bg-green-50', text: 'text-green-600' },
  'Student Management': { bg: 'bg-purple-50', text: 'text-purple-600' },
  'Content & Media': { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  Communication: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  'Analytics & Reporting': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'User Management': { bg: 'bg-violet-50', text: 'text-violet-600' },
  'Security & Compliance': { bg: 'bg-red-50', text: 'text-red-600' },
  'Integration & APIs': { bg: 'bg-orange-50', text: 'text-orange-600' },
  'Storage & Files': { bg: 'bg-amber-50', text: 'text-amber-600' },
  'Automation & Workflows': { bg: 'bg-pink-50', text: 'text-pink-600' },
  'Billing & Payments': { bg: 'bg-teal-50', text: 'text-teal-600' },
};

export default function FeaturesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Debounce search query to prevent excessive API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch features using react-query
  const {
    data: featuresData,
    isLoading: featuresLoading,
    isFetching: featuresFetching,
    error: featuresError,
  } = useGetFeatures({
    search: debouncedSearch || undefined,
    application_id: applicationFilter || undefined,
    category: categoryFilter || undefined,
    is_deprecated:
      statusFilter === 'deprecated'
        ? true
        : statusFilter === 'active'
          ? false
          : undefined,
  });

  // Fetch applications for filter dropdown
  const { data: applicationsData } = useGetApplications();

  const features = featuresData?.features || [];
  const applications = applicationsData?.applications || [];

  // Stats calculations from API
  const totalFeatures = featuresData?.total || features.length;
  const activeFeatures = features.filter((f) => !f.is_deprecated).length;
  const deprecatedFeatures = features.filter((f) => f.is_deprecated).length;
  const totalApplications = applications.length;
  const derivedProducts = features.reduce(
    (sum, f) => sum + (f.product_count || 0),
    0,
  );

  // Loading state
  // Initial loading state - only show full-page loader when no data exists yet
  if (featuresLoading && !featuresData) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primarySolid border-t-transparent'></div>
          <p className='text-textSecondary'>Loading features...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (featuresError) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load features
          </h3>
          <p className='mt-2 text-textSecondary'>{featuresError.message}</p>
        </div>
      </div>
    );
  }

  const categories = Array.from(
    new Set(
      features.map((f) => f.category).filter((c): c is string => Boolean(c)),
    ),
  );

  const copyToClipboard = async (key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(key);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = key;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Calculate active percentage
  const activePercentage =
    totalFeatures > 0
      ? ((activeFeatures / totalFeatures) * 100).toFixed(1)
      : '0';

  return (
    <div className='p-8'>
      <PageHeader
        title='Features Management'
        description='Manage capabilities and features across applications'
        actions={[
          { label: 'Export', icon: Download, variant: 'secondary' },
          {
            label: 'Create Feature',
            icon: Plus,
            variant: 'primary',
            href: '/features/new',
          },
        ]}
      />

      {/* Stats Grid */}
      <section className='mb-8 grid grid-cols-4 gap-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <Puzzle className='h-5 w-5 text-primary' />
            </div>
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {totalFeatures}
          </div>
          <div className='text-sm text-textSecondary'>Total Features</div>
        </div>

        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <CheckCircle className='h-5 w-5 text-success' />
            </div>
            <span className='text-xs font-semibold text-success'>
              {activePercentage}%
            </span>
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {activeFeatures}
          </div>
          <div className='text-sm text-textSecondary'>Active Features</div>
        </div>

        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <Grid3x3 className='h-5 w-5 text-purple-600' />
            </div>
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {totalApplications}
          </div>
          <div className='text-sm text-textSecondary'>Applications</div>
        </div>

        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <Package className='h-5 w-5 text-warning' />
            </div>
            {deprecatedFeatures > 0 && (
              <span className='text-xs font-semibold text-warning'>
                {deprecatedFeatures} deprecated
              </span>
            )}
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {derivedProducts}
          </div>
          <div className='text-sm text-textSecondary'>Derived Products</div>
        </div>
      </section>

      {/* Filters Section */}
      <section className='mb-6 border-t border-border pt-6 pb-2'>
        <div className='flex items-center justify-between'>
          <div className='flex flex-1 items-center space-x-3'>
            <div className='relative max-w-md flex-1'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
              <input
                type='text'
                placeholder='Search features by name, key, or category...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='h-10 w-full rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primarySolid focus:outline-none'
              />
            </div>
            <select
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
              className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primarySolid focus:outline-none'
            >
              <option value=''>All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primarySolid focus:outline-none'
            >
              <option value=''>All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {decodeHtmlEntities(cat)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primarySolid focus:outline-none'
            >
              <option value=''>All Status</option>
              <option value='active'>Active</option>
              <option value='deprecated'>Deprecated</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <TableLoadingOverlay isLoading={featuresFetching && !!featuresData}>
        <section className='border-t border-border'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    <div className='flex items-center'>Application</div>
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    <div className='flex items-center'>Feature Key</div>
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    <div className='flex items-center'>Name</div>
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    <div className='flex items-center'>Category</div>
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    <div className='flex items-center'>Products</div>
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    <div className='flex items-center'>Status</div>
                  </th>
                  <th className='px-6 py-4 text-right text-sm font-semibold text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='px-6 py-12 text-center'>
                      <Puzzle className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No features found
                      </p>
                      <Link
                        href='/features/new'
                        className='mt-4 inline-flex items-center text-sm font-medium text-primarySolid hover:underline'
                      >
                        <Plus className='mr-1 h-4 w-4' />
                        Create your first feature
                      </Link>
                    </td>
                  </tr>
                ) : (
                  features.map((feature) => {
                    const decodedCategory = decodeHtmlEntities(
                      feature.category,
                    );
                    const catColor = categoryColors[decodedCategory] || {
                      bg: 'bg-gray-50',
                      text: 'text-gray-600',
                    };

                    return (
                      <tr
                        key={feature.id}
                        className='border-b border-border transition hover:bg-bgGray'
                      >
                        <td className='px-6 py-4'>
                          <div className='flex items-center'>
                            <div className='flex flex-shrink-0 items-center h-5 w-5'>
                              <Package className='h-5 w-5 text-primary' />
                            </div>
                            <div className='ml-3'>
                              <div className='font-semibold text-textPrimary'>
                                {decodeHtmlEntities(feature.application_name) ||
                                  'Global'}
                              </div>
                              <div className='font-mono text-xs text-textSecondary'>
                                {feature.application_code || 'Platform Feature'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className='px-6 py-4'>
                          <div className='flex items-center'>
                            <code className='rounded bg-gray-100 px-2 py-1 font-mono text-xs text-textPrimary'>
                              {feature.key}
                            </code>
                            <button
                              onClick={() => copyToClipboard(feature.key)}
                              className={`ml-2 transition-colors ${copiedKey === feature.key ? 'text-success' : 'text-textSecondary hover:text-primarySolid'}`}
                              title={
                                copiedKey === feature.key
                                  ? 'Copied!'
                                  : 'Copy key'
                              }
                            >
                              {copiedKey === feature.key ? (
                                <Check className='h-3 w-3' />
                              ) : (
                                <Copy className='h-3 w-3' />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className='px-6 py-4'>
                          <Link
                            href={`/features/${feature.id}`}
                            className='font-medium text-textPrimary hover:text-primarySolid'
                          >
                            {decodeHtmlEntities(feature.name) || feature.key}
                          </Link>
                        </td>
                        <td className='px-6 py-4'>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${catColor.bg} ${catColor.text}`}
                          >
                            {decodedCategory || 'Uncategorized'}
                          </span>
                        </td>
                        <td className='px-6 py-4'>
                          <div className='flex items-center'>
                            <span className='text-sm font-semibold text-textPrimary'>
                              {feature.product_count || 0}
                            </span>
                          </div>
                        </td>
                        <td className='px-6 py-4'>
                          {feature.is_deprecated ? (
                            <span className='text-xs font-semibold text-textSecondary'>
                              Deprecated
                            </span>
                          ) : (
                            <span className='text-xs font-semibold text-success'>
                              Active
                            </span>
                          )}
                        </td>
                        <td className='px-6 py-4 text-right'>
                          <div className='flex items-center justify-end space-x-2'>
                            <Link
                              href={`/products?featureId=${feature.id}`}
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primarySolid'
                              title='View Products'
                            >
                              <Package className='h-4 w-4' />
                            </Link>
                            <Link
                              href={`/features/${feature.id}/edit`}
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primarySolid'
                              title='Edit'
                            >
                              <Edit className='h-4 w-4' />
                            </Link>
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
          {features.length > 0 && (
            <div className='flex items-center justify-between border-t border-border px-6 py-4'>
              <div className='text-sm text-textSecondary'>
                Showing {features.length} of {totalFeatures} features
              </div>
              <div className='flex items-center space-x-2'>
                <button
                  className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:opacity-50'
                  disabled
                  aria-label='Previous page'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                <button className='flex h-9 w-9 items-center justify-center rounded-lg bg-primarySolid font-medium text-white'>
                  1
                </button>
                <button className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray'>
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            </div>
          )}
        </section>
      </TableLoadingOverlay>
    </div>
  );
}
