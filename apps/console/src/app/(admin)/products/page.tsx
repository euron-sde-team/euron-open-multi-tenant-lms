'use client';

import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Gauge,
  Hash,
  Loader2,
  MoreVertical,
  Package,
  Plus,
  RotateCw,
  Search,
  ToggleRight,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useGetFeatures, useGetProducts } from '@/lib/api/hooks';
import { decodeHtmlEntities } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

import { TableLoadingOverlay } from '@/components/common/TableShimmer';

export default function ProductsPage() {
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [constraintFilter, setConstraintFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState(
    searchParams.get('featureId') || '',
  );
  const [hardLimitFilter, setHardLimitFilter] = useState('');

  // Debounce search query to prevent excessive API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch products from API with all filters
  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching: productsFetching,
    error: productsError,
    refetch,
  } = useGetProducts({
    search: debouncedSearch || undefined,
    constraint_type: constraintFilter
      ? (constraintFilter as 'BOOLEAN' | 'COUNT' | 'LIMIT')
      : undefined,
    feature_id: featureFilter || undefined,
    is_hard_limit:
      hardLimitFilter === 'yes'
        ? true
        : hardLimitFilter === 'no'
          ? false
          : undefined,
  });

  // Fetch features for dropdown
  const { data: featuresData } = useGetFeatures();

  const products = productsData?.products || [];
  const totalProducts = productsData?.total || 0;
  const features = featuresData?.features || [];

  // Stats by constraint type
  const booleanCount = products.filter(
    (p) => p.constraint_type === 'BOOLEAN',
  ).length;
  const countCount = products.filter(
    (p) => p.constraint_type === 'COUNT',
  ).length;
  const limitCount = products.filter(
    (p) => p.constraint_type === 'LIMIT',
  ).length;

  // Constraint type badge colors
  const constraintColors: Record<string, { bg: string; text: string }> = {
    BOOLEAN: { bg: 'bg-primary-50', text: 'text-primary-600' },
    COUNT: { bg: 'bg-green-50', text: 'text-success' },
    LIMIT: { bg: 'bg-orange-50', text: 'text-orange-600' },
  };

  // Initial loading state - only show full-page loader when no data exists yet
  if (productsLoading && !productsData) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <Loader2 className='h-12 w-12 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading products...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (productsError) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load products
          </h3>
          <p className='mt-2 text-textSecondary'>{productsError.message}</p>
          <button
            onClick={() => refetch()}
            className='mt-4 rounded-lg bg-primarySolid px-4 py-2 text-sm font-medium text-white hover:bg-primaryHover'
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='mb-2 flex items-center space-x-3'>
              <h1 className='text-3xl font-bold text-textPrimary'>Products</h1>
              <span className='text-sm font-semibold text-primary-600'>
                {totalProducts} Products
              </span>
            </div>
            <p className='text-textSecondary'>
              Define how features are measured and constrained across your
              platform
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary transition hover:bg-bgGray'>
              <Download className='mr-2 h-4 w-4' />
              Export
            </button>
            <Link
              href='/products/new'
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white transition hover:bg-primaryHover'
            >
              <Plus className='mr-2 h-4 w-4' />
              Create Product
            </Link>
          </div>
        </div>
      </section>

      {/* Constraint Type Info Cards */}
      <section className='mb-8 grid grid-cols-3 gap-6'>
        {/* BOOLEAN */}
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center'>
            <div className='flex items-center h-5 w-5'>
              <ToggleRight className='h-5 w-5 text-primary-600' />
            </div>
            <div className='ml-4'>
              <div className='text-lg font-bold text-textPrimary'>BOOLEAN</div>
              <div className='text-sm text-textSecondary'>On/Off Toggle</div>
            </div>
          </div>
          <p className='mb-3 text-sm text-textSecondary'>
            Binary constraint for enabling or disabling features
          </p>
          <div className='rounded bg-bgGray px-3 py-2 font-mono text-xs text-textSecondary'>
            Example: custom_domain_enabled
          </div>
          <div className='mt-4 border-t border-border pt-4'>
            <div className='mb-1 text-xs text-textSecondary'>
              Active Products
            </div>
            <div className='text-2xl font-bold text-textPrimary'>
              {booleanCount}
            </div>
          </div>
        </div>

        {/* COUNT */}
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center'>
            <div className='flex items-center h-5 w-5'>
              <Hash className='h-5 w-5 text-success' />
            </div>
            <div className='ml-4'>
              <div className='text-lg font-bold text-textPrimary'>COUNT</div>
              <div className='text-sm text-textSecondary'>Integer Count</div>
            </div>
          </div>
          <p className='mb-3 text-sm text-textSecondary'>
            Numeric counter for discrete items or resources
          </p>
          <div className='rounded bg-bgGray px-3 py-2 font-mono text-xs text-textSecondary'>
            Example: max_courses = 50
          </div>
          <div className='mt-4 border-t border-border pt-4'>
            <div className='mb-1 text-xs text-textSecondary'>
              Active Products
            </div>
            <div className='text-2xl font-bold text-textPrimary'>
              {countCount}
            </div>
          </div>
        </div>

        {/* LIMIT */}
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center'>
            <div className='flex items-center h-5 w-5'>
              <Gauge className='h-5 w-5 text-orange-600' />
            </div>
            <div className='ml-4'>
              <div className='text-lg font-bold text-textPrimary'>LIMIT</div>
              <div className='text-sm text-textSecondary'>Numeric Quota</div>
            </div>
          </div>
          <p className='mb-3 text-sm text-textSecondary'>
            Measurable quota with units for consumption tracking
          </p>
          <div className='rounded bg-bgGray px-3 py-2 font-mono text-xs text-textSecondary'>
            Example: storage_limit = 100 GB
          </div>
          <div className='mt-4 border-t border-border pt-4'>
            <div className='mb-1 text-xs text-textSecondary'>
              Active Products
            </div>
            <div className='text-2xl font-bold text-textPrimary'>
              {limitCount}
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className='mb-6 border-t border-border pt-4 pb-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
              <input
                type='text'
                placeholder='Search products by code or feature...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='h-10 w-80 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primarySolid focus:outline-none'
              />
            </div>
            <select
              value={constraintFilter}
              onChange={(e) => setConstraintFilter(e.target.value)}
              className='h-10 rounded-lg border border-border bg-bgGray px-4 text-sm font-medium text-textPrimary focus:border-primarySolid focus:outline-none'
            >
              <option value=''>All Constraint Types</option>
              <option value='BOOLEAN'>BOOLEAN</option>
              <option value='COUNT'>COUNT</option>
              <option value='LIMIT'>LIMIT</option>
            </select>
            <select
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              className='h-10 rounded-lg border border-border bg-bgGray px-4 text-sm font-medium text-textPrimary focus:border-primarySolid focus:outline-none'
            >
              <option value=''>All Features</option>
              {features.map((feature) => (
                <option key={feature.id} value={feature.id}>
                  {decodeHtmlEntities(feature.name) || feature.key}
                </option>
              ))}
            </select>
            <select
              value={hardLimitFilter}
              onChange={(e) => setHardLimitFilter(e.target.value)}
              className='h-10 rounded-lg border border-border bg-bgGray px-4 text-sm font-medium text-textPrimary focus:border-primarySolid focus:outline-none'
            >
              <option value=''>Hard Limit: All</option>
              <option value='yes'>Hard Limit: Yes</option>
              <option value='no'>Hard Limit: No</option>
            </select>
          </div>
          <button
            onClick={() => refetch()}
            disabled={productsFetching}
            className='flex h-10 w-10 items-center justify-center rounded-lg border border-border text-textSecondary transition hover:bg-bgGray disabled:opacity-50'
          >
            <RotateCw
              className={`h-4 w-4 ${productsFetching ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </section>

      {/* Table Section */}
      <TableLoadingOverlay isLoading={productsFetching && !!productsData}>
        <section className='overflow-hidden border-t border-border'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Product Code
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Title
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Feature
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Constraint Type
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Unit
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Hard Limit
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Scope
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Usage
                  </th>
                  <th className='px-6 py-4 text-right text-sm font-semibold text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className='px-6 py-12 text-center'>
                      <Package className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No products found
                      </p>
                      <Link
                        href='/products/new'
                        className='mt-4 inline-flex items-center text-sm font-medium text-primarySolid hover:underline'
                      >
                        <Plus className='mr-1 h-4 w-4' />
                        Create your first product
                      </Link>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const colors =
                      constraintColors[product.constraint_type] ||
                      constraintColors.BOOLEAN;
                    return (
                      <tr
                        key={product.id}
                        className='border-b border-border transition hover:bg-bgGray'
                      >
                        <td className='px-6 py-4'>
                          <div className='font-mono text-sm font-semibold text-textPrimary'>
                            {product.code}
                          </div>
                          <div className='mt-0.5 text-xs text-textSecondary'>
                            {product.application_code}
                          </div>
                        </td>
                        <td className='px-6 py-4'>
                          {product.title ? (
                            <span className='text-sm text-textPrimary'>
                              {product.title}
                            </span>
                          ) : (
                            <span className='text-sm text-textSecondary'>
.
                            </span>
                          )}
                        </td>
                        <td className='px-6 py-4'>
                          <div className='text-sm font-semibold text-textPrimary'>
                            {decodeHtmlEntities(product.feature_name) ||
                              product.feature_key}
                          </div>
                          <div className='mt-0.5 font-mono text-xs text-textSecondary'>
                            {product.feature_key}
                          </div>
                        </td>
                        <td className='px-6 py-4'>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}
                          >
                            {product.constraint_type}
                          </span>
                        </td>
                        <td className='px-6 py-4'>
                          {product.unit ? (
                            <span className='text-sm text-textPrimary'>
                              {product.unit}
                            </span>
                          ) : (
                            <span className='text-sm text-textSecondary'>
.
                            </span>
                          )}
                        </td>
                        <td className='px-6 py-4'>
                          {product.is_hard_limit ? (
                            <div className='flex items-center'>
                              <CheckCircle className='mr-2 h-4 w-4 text-success' />
                              <span className='text-sm font-medium text-success'>
                                Yes
                              </span>
                            </div>
                          ) : (
                            <div className='flex items-center'>
                              <XCircle className='mr-2 h-4 w-4 text-textSecondary' />
                              <span className='text-sm font-medium text-textSecondary'>
                                No
                              </span>
                            </div>
                          )}
                        </td>
                        <td className='px-6 py-4'>
                          <div className='flex flex-col gap-1'>
                            <span
                              className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                product.usage_scope === 'USER'
                                  ? 'bg-purple-50 text-purple-600'
                                  : 'bg-gray-100 text-textSecondary'
                              }`}
                            >
                              {product.usage_scope || 'TENANT'}
                            </span>
                            {product.usage_window &&
                              product.usage_window !== 'LIFETIME' && (
                                <span className='text-xs text-textSecondary'>
                                  {product.usage_window}
                                </span>
                              )}
                          </div>
                        </td>
                        <td className='px-6 py-4'>
                          <div className='text-sm font-semibold text-textPrimary'>
                            {product.plan_version_count ?? 0} plan versions
                          </div>
                        </td>
                        <td className='px-6 py-4 text-right'>
                          <div className='flex items-center justify-end space-x-2'>
                            <Link
                              href={`/products/${product.id}/edit`}
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primarySolid'
                            >
                              <Edit className='h-4 w-4' />
                            </Link>
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
          {products.length > 0 && (
            <div className='flex items-center justify-between border-t border-border bg-bgGray px-6 py-4'>
              <div className='text-sm text-textSecondary'>
                Showing {products.length} of {totalProducts} products
              </div>
              <div className='flex items-center space-x-2'>
                <button
                  className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary transition hover:bg-surface disabled:opacity-50'
                  disabled
                  aria-label='Previous page'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                <button className='flex h-9 w-9 items-center justify-center rounded-lg bg-primarySolid font-medium text-white'>
                  1
                </button>
                <button className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary transition hover:bg-surface'>
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
