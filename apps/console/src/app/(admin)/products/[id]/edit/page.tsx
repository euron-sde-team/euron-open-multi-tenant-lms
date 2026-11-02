'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Gauge,
  Hash,
  Info,
  Lightbulb,
  Loader2,
  ToggleRight,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useGetProduct, useUpdateProduct } from '@/lib/api/hooks/useProducts';
import type { UsageScopeType, UsageWindowType } from '@/lib/api/types';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    title: '',
    unit: '',
    isHardLimit: true,
    usageScope: 'TENANT' as UsageScopeType,
    usageWindow: 'LIFETIME' as UsageWindowType,
  });
  const [error, setError] = useState<string | null>(null);
  const [scopeChangeAcknowledged, setScopeChangeAcknowledged] = useState(false);

  // Fetch product data from API
  const {
    data: product,
    isLoading: productLoading,
    isError: productError,
  } = useGetProduct(id);

  // Update mutation
  const updateMutation = useUpdateProduct();

  // Populate form when product data loads
  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title || '',
        unit: product.unit || '',
        isHardLimit: product.is_hard_limit,
        usageScope: product.usage_scope || 'TENANT',
        usageWindow: product.usage_window || 'LIFETIME',
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    updateMutation.mutate(
      {
        id,
        data: {
          title: formData.title.trim() || undefined,
          unit: formData.unit.trim() || undefined,
          is_hard_limit: formData.isHardLimit,
          usage_scope: formData.usageScope,
          usage_window: formData.usageWindow,
        },
      },
      {
        onSuccess: () => {
          router.push('/products');
        },
        onError: (err: Error) => {
          setError(
            err.message || 'Failed to update product. Please try again.',
          );
        },
      },
    );
  };

  const isSubmitting = updateMutation.isLoading;

  // Detect if scope or window has been changed from the original product values
  const hasScopeChanged =
    !!product &&
    (formData.usageScope !== (product.usage_scope || 'TENANT') ||
      formData.usageWindow !== (product.usage_window || 'LIFETIME'));
  const needsAcknowledgment = hasScopeChanged && !scopeChangeAcknowledged;

  // Format date for display
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state
  if (productLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='mx-auto mb-4 h-8 w-8 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading product...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (productError || !product) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='mx-auto mb-4 h-12 w-12 text-error' />
          <h2 className='mb-2 text-xl font-semibold text-textPrimary'>
            Product not found
          </h2>
          <p className='mb-4 text-textSecondary'>
            The product you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <Link href='/products' className='text-primarySolid hover:underline'>
            Return to Products
          </Link>
        </div>
      </div>
    );
  }

  // Constraint type icon and colors
  const constraintConfig = {
    BOOLEAN: {
      icon: ToggleRight,
      bg: 'bg-primary-100',
      text: 'text-primary-600',
      label: 'On/Off Toggle',
    },
    COUNT: {
      icon: Hash,
      bg: 'bg-green-100',
      text: 'text-success',
      label: 'Integer Count',
    },
    LIMIT: {
      icon: Gauge,
      bg: 'bg-orange-100',
      text: 'text-orange-600',
      label: 'Numeric Quota',
    },
  };

  const currentConstraint =
    constraintConfig[product.constraint_type] || constraintConfig.BOOLEAN;
  const ConstraintIcon = currentConstraint.icon;

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <div className='mb-2 flex items-center'>
          <Link
            href='/products'
            className='flex items-center text-sm font-medium text-textSecondary hover:text-primarySolid'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Products
          </Link>
        </div>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Edit Product
            </h1>
            <p className='text-textSecondary'>
              Modify settings for{' '}
              <span className='font-mono font-medium'>{product.code}</span>
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href='/products'
              className='flex h-10 items-center rounded-lg border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || needsAcknowledgment}
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                <>
                  <Check className='mr-2 h-4 w-4' />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className='grid grid-cols-3 gap-6'>
        {/* Form Section - 2/3 width */}
        <section className='col-span-2'>
          <div className='border-t border-border pt-6 pb-2'>
            <h2 className='mb-6 text-xl font-semibold text-textPrimary'>
              Product Details
            </h2>

            {/* Error Alert */}
            {error && (
              <div className='mb-6 flex items-start rounded-lg border border-red-200 bg-red-50 p-4'>
                <AlertCircle className='mr-3 h-5 w-5 flex-shrink-0 text-error' />
                <div>
                  <h4 className='text-sm font-semibold text-error'>Error</h4>
                  <p className='mt-1 text-sm text-red-700'>{error}</p>
                </div>
              </div>
            )}

            <form className='space-y-6'>
              {/* Feature (readonly) */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Feature
                </label>
                <div className='h-11 w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textSecondary'>
                  {product.feature_name || product.feature_key}
                </div>
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Feature cannot be changed after creation
                </p>
              </div>

              {/* Product Code (readonly) */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Product Code
                </label>
                <div className='h-11 w-full rounded-lg border border-border bg-bgGray px-4 py-3 font-mono text-sm text-textSecondary'>
                  {product.code}
                </div>
                <div className='mt-1.5 flex items-start'>
                  <AlertTriangle className='mr-1.5 mt-0.5 h-3 w-3 flex-shrink-0 text-warning' />
                  <p className='text-xs text-textSecondary'>
                    Product code cannot be changed after creation to maintain
                    data integrity.
                  </p>
                </div>
              </div>

              {/* Constraint Type (readonly) */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Constraint Type
                </label>
                <div className='flex items-center rounded-lg border border-border bg-bgGray px-4 py-3'>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentConstraint.bg}`}
                  >
                    <ConstraintIcon
                      className={`h-4 w-4 ${currentConstraint.text}`}
                    />
                  </div>
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary'>
                      {product.constraint_type}
                    </div>
                    <div className='text-xs text-textSecondary'>
                      {currentConstraint.label}
                    </div>
                  </div>
                </div>
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Constraint type cannot be changed after creation
                </p>
              </div>

              {/* Product Title (editable) */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Product Title{' '}
                  <span className='text-xs font-normal text-textSecondary'>
                    (Optional)
                  </span>
                </label>
                <input
                  type='text'
                  placeholder='e.g., Self-Paced Courses'
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                />
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Human-readable name shown on pricing pages. Falls back to
                  product code if not set.
                </p>
              </div>

              {/* Unit (editable for COUNT and LIMIT) */}
              {(product.constraint_type === 'COUNT' ||
                product.constraint_type === 'LIMIT') && (
                <div>
                  <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                    Unit{' '}
                    <span className='text-xs font-normal text-textSecondary'>
                      (Optional)
                    </span>
                  </label>
                  <input
                    type='text'
                    placeholder={
                      product.constraint_type === 'COUNT'
                        ? 'e.g., course, student, user'
                        : 'e.g., GB, MB, minutes, requests'
                    }
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                  />
                  <p className='mt-1.5 text-xs text-textSecondary'>
                    {product.constraint_type === 'COUNT'
                      ? 'The type of item being counted'
                      : 'The unit of measurement'}
                  </p>
                </div>
              )}

              {/* Hard Limit Toggle */}
              <div>
                <label className='mb-3 block text-sm font-semibold text-textPrimary'>
                  Enforcement Mode
                </label>
                <div className='flex items-center'>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData({
                        ...formData,
                        isHardLimit: !formData.isHardLimit,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                      formData.isHardLimit ? 'bg-primarySolid' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isHardLimit ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className='ml-3 text-sm font-medium text-textPrimary'>
                    {formData.isHardLimit ? 'Hard Limit' : 'Soft Limit'}
                  </span>
                </div>
                <p className='mt-2 text-xs text-textSecondary'>
                  {formData.isHardLimit
                    ? 'Hard limit: Blocks actions when the limit is reached'
                    : 'Soft limit: Shows warning but allows the action to proceed'}
                </p>
              </div>

              {/* Usage Scope & Window */}
              <div className='grid grid-cols-2 gap-4'>
                {/* Usage Scope */}
                <div>
                  <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                    Usage Scope
                  </label>
                  <div className='relative'>
                    <select
                      value={formData.usageScope}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          usageScope: e.target.value as UsageScopeType,
                        })
                      }
                      className='h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 pr-10 text-sm text-textPrimary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                    >
                      <option value='TENANT'>Tenant</option>
                      <option value='USER'>User</option>
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                  </div>
                  <p className='mt-1.5 text-xs text-textSecondary'>
                    {formData.usageScope === 'TENANT'
                      ? 'Usage tracked at the tenant level (shared pool)'
                      : 'Usage tracked per individual user'}
                  </p>
                </div>

                {/* Usage Window */}
                <div>
                  <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                    Usage Window
                  </label>
                  <div className='relative'>
                    <select
                      value={formData.usageWindow}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          usageWindow: e.target.value as UsageWindowType,
                        })
                      }
                      className='h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 pr-10 text-sm text-textPrimary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                    >
                      <option value='LIFETIME'>Lifetime</option>
                      <option value='DAILY'>Daily</option>
                      <option value='MONTHLY'>Monthly</option>
                      <option value='YEARLY'>Yearly</option>
                    </select>
                    <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                  </div>
                  <p className='mt-1.5 text-xs text-textSecondary'>
                    {formData.usageWindow === 'LIFETIME'
                      ? 'Counter never resets'
                      : formData.usageWindow === 'DAILY'
                        ? 'Counter resets each day'
                        : formData.usageWindow === 'MONTHLY'
                          ? 'Counter resets each month'
                          : 'Counter resets each year'}
                  </p>
                </div>
              </div>
              {hasScopeChanged ? (
                <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
                  <div className='flex items-start'>
                    <AlertTriangle className='mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-warning' />
                    <div>
                      <p className='text-sm font-semibold text-warning'>
                        Usage tracking will be reset
                      </p>
                      <p className='mt-1 text-xs text-textPrimary'>
                        Changing the usage scope or window will cause existing
                        usage counters to become orphaned. All tenants using
                        this product will effectively start with fresh counters.
                        Historical usage data is preserved for audit but will no
                        longer be queried.
                      </p>
                      <label className='mt-3 flex cursor-pointer items-center'>
                        <input
                          type='checkbox'
                          checked={scopeChangeAcknowledged}
                          onChange={(e) =>
                            setScopeChangeAcknowledged(e.target.checked)
                          }
                          className='h-4 w-4 rounded border-amber-300 text-warning focus:ring-warning'
                        />
                        <span className='ml-2 text-xs font-medium text-textPrimary'>
                          I understand this will reset usage tracking for this
                          product
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                formData.usageScope === 'USER' && (
                  <div className='flex items-start rounded-lg border border-primary-200 bg-primary-50 p-3'>
                    <Info className='mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600' />
                    <p className='text-xs text-primary-700'>
                      User-scoped products can be linked to courses, books, and
                      bundles. Users gain access to these products through
                      content enrollment.
                    </p>
                  </div>
                )
              )}
            </form>
          </div>
        </section>

        {/* Sidebar - 1/3 width */}
        <section className='col-span-1'>
          {/* Tips for Editing */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Tips for Editing
            </h3>
            <div className='space-y-4'>
              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100'>
                  <Lightbulb className='h-3 w-3 text-primary-600' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Unit Changes
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Changing units affects how values are displayed but not
                    existing data
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100'>
                  <Check className='h-3 w-3 text-success' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Enforcement Mode
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Switch between hard and soft limits based on business needs
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100'>
                  <AlertTriangle className='h-3 w-3 text-warning' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Immutable Fields
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Code, feature, and constraint type are locked after creation
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Stats */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Product Stats
            </h3>
            <div className='space-y-3'>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>
                  Plan Versions Using
                </span>
                <span className='text-sm font-semibold text-textPrimary'>
                  {product.plan_version_count ?? 0}
                </span>
              </div>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Application</span>
                <span className='text-sm font-semibold text-textSecondary'>
                  {product.application_code}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-textSecondary'>Created</span>
                <span className='text-sm font-semibold text-textSecondary'>
                  {formatDate(product.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Impact Warning */}
          {(product.plan_version_count ?? 0) > 0 && (
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-6'>
              <div className='flex items-start'>
                <AlertTriangle className='mt-0.5 h-5 w-5 text-warning' />
                <div className='ml-3'>
                  <h4 className='mb-2 text-sm font-semibold text-warning'>
                    Impact Warning
                  </h4>
                  <p className='mb-3 text-xs text-textPrimary'>
                    Changes to this product may affect{' '}
                    {product.plan_version_count} plan version(s) currently using
                    it.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
