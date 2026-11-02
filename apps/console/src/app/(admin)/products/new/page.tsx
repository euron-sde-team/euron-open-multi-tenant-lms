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
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  useCreateProduct,
  useGetApplications,
  useGetFeatures,
} from '@/lib/api/hooks';
import {
  ConstraintType,
  UsageScopeType,
  UsageWindowType,
} from '@/lib/api/types';
import { decodeHtmlEntities } from '@/lib/utils';

export default function CreateProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedFeatureId = searchParams.get('featureId') || '';

  const [applicationFilter, setApplicationFilter] = useState('');
  const [formData, setFormData] = useState({
    featureId: '',
    code: '',
    title: '',
    constraintType: '' as ConstraintType | '',
    unit: '',
    isHardLimit: true,
    usageScope: 'TENANT' as UsageScopeType,
    usageWindow: 'LIFETIME' as UsageWindowType,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasAutoPopulatedCode, setHasAutoPopulatedCode] = useState(false);

  // Fetch data
  const { data: featuresData, isLoading: featuresLoading } = useGetFeatures();
  const { data: applicationsData } = useGetApplications({ is_active: true });
  const createMutation = useCreateProduct();

  const features = featuresData?.features || [];
  const applications = applicationsData?.applications || [];

  // Filter features by selected application
  const filteredFeatures = useMemo(
    () =>
      features.filter(
        (f) =>
          !f.is_deprecated &&
          (!applicationFilter || f.application_id === applicationFilter),
      ),
    [features, applicationFilter],
  );

  // Auto-select feature from URL param and detect its application
  useEffect(() => {
    if (preselectedFeatureId && features.length > 0 && !formData.featureId) {
      const feature = features.find((f) => f.id === preselectedFeatureId);
      if (feature) {
        setApplicationFilter(feature.application_id);
        setFormData((prev) => ({
          ...prev,
          featureId: feature.id,
          code: `${feature.key}_`,
        }));
        setHasAutoPopulatedCode(true);
      }
    }
  }, [preselectedFeatureId, features, formData.featureId]);

  // When feature changes, auto-populate code (only if user hasn't manually edited)
  const handleFeatureChange = (featureId: string) => {
    const feature = features.find((f) => f.id === featureId);
    const newCode =
      feature && (!formData.code || hasAutoPopulatedCode)
        ? `${feature.key}_`
        : formData.code;

    setFormData((prev) => ({
      ...prev,
      featureId,
      code: newCode,
    }));
    if (feature) setHasAutoPopulatedCode(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.featureId) {
      setError('Please select a feature');
      return;
    }
    if (!formData.code.trim()) {
      setError('Product code is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formData.code)) {
      setError(
        'Code must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
      );
      return;
    }
    if (!formData.constraintType) {
      setError('Please select a constraint type');
      return;
    }

    createMutation.mutate(
      {
        feature_id: formData.featureId,
        code: formData.code,
        title: formData.title.trim() || undefined,
        constraint_type: formData.constraintType as ConstraintType,
        unit: formData.unit.trim() || undefined,
        is_hard_limit: formData.isHardLimit,
        usage_scope: formData.usageScope,
        usage_window: formData.usageWindow,
      },
      {
        onSuccess: () => {
          router.push('/products');
        },
        onError: (err: Error) => {
          if (
            err.message.includes('already exists') ||
            err.message.includes('duplicate')
          ) {
            setError(
              'A product with this code already exists. Please use a different code.',
            );
          } else {
            setError(
              err.message || 'Failed to create product. Please try again.',
            );
          }
        },
      },
    );
  };

  const isSubmitting = createMutation.isLoading;
  const isFeatureSelected = formData.featureId !== '';
  const isCodeValid =
    formData.code.length >= 1 && /^[a-z][a-z0-9_]*$/.test(formData.code);
  const isConstraintSelected = formData.constraintType !== '';
  const isFormValid = isFeatureSelected && isCodeValid && isConstraintSelected;

  // Get selected feature info for display
  const selectedFeature = features.find((f) => f.id === formData.featureId);

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
              Create New Product
            </h1>
            <p className='text-textSecondary'>
              Define how a feature is measured and constrained
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
              disabled={isSubmitting || !isFormValid}
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                <>
                  <Check className='mr-2 h-4 w-4' />
                  Create Product
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
              {/* Application Filter */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Application
                </label>
                <div className='relative'>
                  <select
                    value={applicationFilter}
                    onChange={(e) => {
                      setApplicationFilter(e.target.value);
                      // Reset feature if it no longer matches the app filter
                      if (e.target.value && formData.featureId) {
                        const currentFeature = features.find(
                          (f) => f.id === formData.featureId,
                        );
                        if (
                          currentFeature &&
                          currentFeature.application_id !== e.target.value
                        ) {
                          setFormData((prev) => ({
                            ...prev,
                            featureId: '',
                          }));
                        }
                      }
                    }}
                    className='h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 pr-10 text-sm text-textPrimary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                  >
                    <option value=''>All Applications</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {decodeHtmlEntities(app.name)} ({app.code})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                </div>
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Narrow down the features list by application
                </p>
              </div>

              {/* Feature Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Feature <span className='text-error'>*</span>
                </label>
                <div className='relative'>
                  <select
                    value={formData.featureId}
                    onChange={(e) => handleFeatureChange(e.target.value)}
                    disabled={featuresLoading}
                    className='h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 pr-10 text-sm text-textPrimary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <option value=''>
                      {featuresLoading
                        ? 'Loading features...'
                        : 'Select a feature'}
                    </option>
                    {filteredFeatures.map((feature) => (
                      <option key={feature.id} value={feature.id}>
                        {decodeHtmlEntities(feature.name) || feature.key} (
                        {feature.key})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                </div>
                <p className='mt-1.5 text-xs text-textSecondary'>
                  The feature this product will measure or constrain
                </p>
                {selectedFeature && (
                  <div className='mt-2 rounded bg-primary-50 p-2 text-xs text-primary-700'>
                    <strong>Feature Key:</strong> {selectedFeature.key} |{' '}
                    <strong>Application:</strong>{' '}
                    {decodeHtmlEntities(selectedFeature.application_name)}
                  </div>
                )}
              </div>

              {/* Product Code Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Product Code <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  placeholder='e.g., max_courses'
                  value={formData.code}
                  onChange={(e) => {
                    setHasAutoPopulatedCode(false);
                    setFormData({
                      ...formData,
                      code: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, ''),
                    });
                  }}
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                />
                <div className='mt-1.5 flex items-start'>
                  <Info className='mr-1.5 mt-0.5 h-3 w-3 flex-shrink-0 text-textSecondary' />
                  <p className='text-xs text-textSecondary'>
                    Unique identifier using lowercase letters, numbers, and
                    underscores. Spaces are converted to underscores. Cannot be
                    changed after creation.
                  </p>
                </div>
              </div>

              {/* Product Title Field */}
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

              {/* Constraint Type Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Constraint Type <span className='text-error'>*</span>
                </label>
                <div className='grid grid-cols-3 gap-4'>
                  {/* BOOLEAN */}
                  <button
                    type='button'
                    onClick={() =>
                      setFormData({ ...formData, constraintType: 'BOOLEAN' })
                    }
                    className={`flex flex-col items-center rounded-lg border-2 p-4 transition ${
                      formData.constraintType === 'BOOLEAN'
                        ? 'border-primarySolid bg-primary-50'
                        : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.constraintType === 'BOOLEAN'
                          ? 'bg-primary-100'
                          : 'bg-bgGray'
                      }`}
                    >
                      <ToggleRight
                        className={`h-5 w-5 ${
                          formData.constraintType === 'BOOLEAN'
                            ? 'text-primary-600'
                            : 'text-textSecondary'
                        }`}
                      />
                    </div>
                    <div className='text-sm font-semibold text-textPrimary'>
                      BOOLEAN
                    </div>
                    <div className='mt-1 text-xs text-textSecondary'>
                      On/Off Toggle
                    </div>
                  </button>

                  {/* COUNT */}
                  <button
                    type='button'
                    onClick={() =>
                      setFormData({ ...formData, constraintType: 'COUNT' })
                    }
                    className={`flex flex-col items-center rounded-lg border-2 p-4 transition ${
                      formData.constraintType === 'COUNT'
                        ? 'border-success bg-green-50'
                        : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.constraintType === 'COUNT'
                          ? 'bg-green-100'
                          : 'bg-bgGray'
                      }`}
                    >
                      <Hash
                        className={`h-5 w-5 ${
                          formData.constraintType === 'COUNT'
                            ? 'text-success'
                            : 'text-textSecondary'
                        }`}
                      />
                    </div>
                    <div className='text-sm font-semibold text-textPrimary'>
                      COUNT
                    </div>
                    <div className='mt-1 text-xs text-textSecondary'>
                      Integer Count
                    </div>
                  </button>

                  {/* LIMIT */}
                  <button
                    type='button'
                    onClick={() =>
                      setFormData({ ...formData, constraintType: 'LIMIT' })
                    }
                    className={`flex flex-col items-center rounded-lg border-2 p-4 transition ${
                      formData.constraintType === 'LIMIT'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.constraintType === 'LIMIT'
                          ? 'bg-orange-100'
                          : 'bg-bgGray'
                      }`}
                    >
                      <Gauge
                        className={`h-5 w-5 ${
                          formData.constraintType === 'LIMIT'
                            ? 'text-orange-600'
                            : 'text-textSecondary'
                        }`}
                      />
                    </div>
                    <div className='text-sm font-semibold text-textPrimary'>
                      LIMIT
                    </div>
                    <div className='mt-1 text-xs text-textSecondary'>
                      Numeric Quota
                    </div>
                  </button>
                </div>
                <p className='mt-2 text-xs text-textSecondary'>
                  Constraint type cannot be changed after creation
                </p>
              </div>

              {/* Unit Field (shown for COUNT and LIMIT) */}
              {(formData.constraintType === 'COUNT' ||
                formData.constraintType === 'LIMIT') && (
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
                      formData.constraintType === 'COUNT'
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
                    {formData.constraintType === 'COUNT'
                      ? 'The type of item being counted (e.g., courses, students)'
                      : 'The unit of measurement (e.g., GB, minutes, requests per minute)'}
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
              {formData.usageScope === 'USER' && (
                <div className='flex items-start rounded-lg border border-primary-200 bg-primary-50 p-3'>
                  <Info className='mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600' />
                  <p className='text-xs text-primary-700'>
                    User-scoped products can be linked to courses, books, and
                    bundles. Users gain access to these products through content
                    enrollment.
                  </p>
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Sidebar - 1/3 width */}
        <section className='col-span-1'>
          {/* Quick Tips */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Quick Tips
            </h3>
            <div className='space-y-4'>
              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100'>
                  <Lightbulb className='h-3 w-3 text-primary-600' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Product Codes
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Use descriptive codes like &quot;max_courses&quot; or
                    &quot;storage_limit_gb&quot;
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100'>
                  <Check className='h-3 w-3 text-success' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Constraint Types
                  </div>
                  <div className='text-xs text-textSecondary'>
                    BOOLEAN for toggles, COUNT for quantities, LIMIT for quotas
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
                    Code and constraint type cannot be changed after creation
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Need Help */}
          <div className='rounded-lg border border-primary-200 bg-primary-50 p-6'>
            <div className='flex items-start'>
              <Info className='mt-0.5 h-5 w-5 text-primary-600' />
              <div className='ml-3'>
                <h4 className='mb-2 text-sm font-semibold text-primary-700'>
                  Need Help?
                </h4>
                <p className='mb-3 text-xs text-textPrimary'>
                  Check our documentation for detailed guides on product
                  configuration and constraint types.
                </p>
                <a
                  href='#'
                  className='text-xs font-medium text-primary-600 hover:underline'
                >
                  View Documentation →
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
