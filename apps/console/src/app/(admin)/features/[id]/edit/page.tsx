'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  History,
  Lightbulb,
  Loader2,
  Navigation,
  Package,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useGetApplications } from '@/lib/api/hooks/useApplications';
import {
  useDeprecateFeature,
  useGetFeature,
  useUpdateFeature,
} from '@/lib/api/hooks/useFeatures';

import NavIconPicker from '@/components/common/NavIconPicker';

export default function EditFeaturePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    applicationId: '',
    key: '',
    name: '',
    description: '',
    category: '',
    isDeprecated: false,
    sortOrder: 0,
    isNavigable: false,
    navRoute: '',
    navLabel: '',
    navIcon: '',
    navSortOrder: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [showDeprecateConfirm, setShowDeprecateConfirm] = useState(false);

  // Fetch feature data from API
  const {
    data: feature,
    isLoading: featureLoading,
    isError: featureError,
  } = useGetFeature(id);

  // Fetch applications for dropdown
  const { data: applicationsData, isLoading: applicationsLoading } =
    useGetApplications({ is_active: true });

  // Mutations
  const updateMutation = useUpdateFeature();
  const deprecateMutation = useDeprecateFeature();

  const applications = applicationsData?.applications || [];

  // Populate form when feature data loads
  useEffect(() => {
    if (feature) {
      setFormData({
        applicationId: feature.application_id || '',
        key: feature.key || '',
        name: feature.name || '',
        description: feature.description || '',
        category: feature.category || '',
        isDeprecated: feature.is_deprecated || false,
        sortOrder: feature.sort_order || 0,
        isNavigable: feature.is_navigable || false,
        navRoute: feature.nav_route || '',
        navLabel: feature.nav_label || '',
        navIcon: feature.nav_icon || '',
        navSortOrder: feature.nav_sort_order || 0,
      });
    }
  }, [feature]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.applicationId) {
      setError('Please select an application');
      return;
    }

    updateMutation.mutate(
      {
        id,
        data: {
          name: formData.name.trim() || undefined,
          description: formData.description.trim() || undefined,
          category: formData.category || undefined,
          sort_order: formData.sortOrder,
          is_navigable: formData.isNavigable,
          nav_route: formData.navRoute.trim() || undefined,
          nav_label: formData.navLabel.trim() || undefined,
          nav_icon: formData.navIcon || undefined,
          nav_sort_order: formData.navSortOrder,
        },
      },
      {
        onSuccess: () => {
          router.push('/features');
        },
        onError: (err: Error) => {
          setError(
            err.message || 'Failed to update feature. Please try again.',
          );
        },
      },
    );
  };

  const handleDeprecate = () => {
    deprecateMutation.mutate(id, {
      onSuccess: () => {
        router.push('/features');
      },
      onError: (err: Error) => {
        setError(
          err.message || 'Failed to deprecate feature. Please try again.',
        );
        setShowDeprecateConfirm(false);
      },
    });
  };

  const categories = [
    'Learning & Courses',
    'Assessment & Grading',
    'Student Management',
    'Content & Media',
    'Communication',
    'Analytics & Reporting',
    'User Management',
    'Security & Compliance',
    'Integration & APIs',
    'Storage & Files',
    'Automation & Workflows',
    'Billing & Payments',
  ];

  const isSubmitting = updateMutation.isLoading;
  const isDeprecating = deprecateMutation.isLoading;

  // Loading state
  if (featureLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='mx-auto mb-4 h-8 w-8 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading feature...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (featureError || !feature) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='mx-auto mb-4 h-12 w-12 text-error' />
          <h2 className='mb-2 text-xl font-semibold text-textPrimary'>
            Feature not found
          </h2>
          <p className='mb-4 text-textSecondary'>
            The feature you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <Link href='/features' className='text-primarySolid hover:underline'>
            Return to Features
          </Link>
        </div>
      </div>
    );
  }

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

  return (
    <div className='p-8'>
      {/* Deprecate Confirmation Modal */}
      {showDeprecateConfirm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl'>
            <div className='mb-4 flex items-center'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-amber-100'>
                <AlertTriangle className='h-5 w-5 text-warning' />
              </div>
              <h3 className='ml-3 text-lg font-semibold text-textPrimary'>
                Deprecate Feature
              </h3>
            </div>
            <p className='mb-2 text-sm text-textSecondary'>
              Are you sure you want to deprecate{' '}
              <span className='font-semibold text-textPrimary'>
                {feature.name || feature.key}
              </span>
              ?
            </p>
            <p className='mb-6 text-sm text-textSecondary'>
              This feature is used by{' '}
              <span className='font-semibold'>{feature.product_count}</span>{' '}
              product(s). Deprecating will hide it from new subscriptions.
            </p>
            <div className='flex justify-end space-x-3'>
              <button
                onClick={() => setShowDeprecateConfirm(false)}
                disabled={isDeprecating}
                className='rounded-lg border border-border px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                onClick={handleDeprecate}
                disabled={isDeprecating}
                className='flex items-center rounded-lg bg-warning px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50'
              >
                {isDeprecating ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Deprecating...
                  </>
                ) : (
                  'Deprecate Feature'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <section className='mb-8'>
        <div className='mb-2 flex items-center'>
          <Link
            href='/features'
            className='flex items-center text-sm font-medium text-textSecondary hover:text-primary'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Features
          </Link>
        </div>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Edit Feature
            </h1>
            <p className='text-textSecondary'>
              Modify feature settings for{' '}
              <span className='font-medium'>{feature.name || feature.key}</span>
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href='/features'
              className='flex h-10 items-center rounded-lg border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
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
              Feature Details
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
              {/* Application Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Application <span className='text-error'>*</span>
                </label>
                <div className='relative'>
                  <select
                    value={formData.applicationId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        applicationId: e.target.value,
                      })
                    }
                    disabled={applicationsLoading}
                    className='h-11 w-full appearance-none rounded-lg border border-border bg-bgGray px-4 pr-10 text-sm text-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid disabled:cursor-not-allowed'
                  >
                    <option value=''>
                      {applicationsLoading
                        ? 'Loading applications...'
                        : 'Select an application'}
                    </option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                </div>
                <p className='mt-1.5 text-xs text-textSecondary'>
                  The application this feature belongs to (cannot be changed)
                </p>
              </div>

              {/* Feature Key Field - Read Only */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Feature Key <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.key}
                  disabled
                  className='h-11 w-full cursor-not-allowed rounded-lg border border-border bg-bgGray px-4 text-sm text-textSecondary'
                />
                <div className='mt-1.5 flex items-start'>
                  <AlertTriangle className='mr-1.5 mt-0.5 h-3 w-3 flex-shrink-0 text-warning' />
                  <p className='text-xs text-textSecondary'>
                    Feature keys cannot be changed after creation to maintain
                    data integrity.
                  </p>
                </div>
              </div>

              {/* Display Name Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Display Name{' '}
                  <span className='text-xs font-normal text-textSecondary'>
                    (Optional)
                  </span>
                </label>
                <input
                  type='text'
                  placeholder='e.g., Advanced Analytics'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                />
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Human-readable name for this feature
                </p>
              </div>

              {/* Description Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Description{' '}
                  <span className='text-xs font-normal text-textSecondary'>
                    (Optional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  placeholder='Describe what this feature does and its benefits...'
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                />
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Detailed description of the feature&apos;s functionality
                </p>
              </div>

              {/* Category Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Category{' '}
                  <span className='text-xs font-normal text-textSecondary'>
                    (Optional)
                  </span>
                </label>
                <div className='relative'>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className='h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 pr-10 text-sm text-textPrimary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                  >
                    <option value=''>Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                </div>
                <p className='mt-1.5 text-xs text-textSecondary'>
                  Group features by category for better organization
                </p>
              </div>

              {/* Toggle and Sort Order Row */}
              <div className='grid grid-cols-2 gap-6'>
                {/* Feature Status Display */}
                <div>
                  <label className='mb-3 block text-sm font-semibold text-textPrimary'>
                    Feature Status
                  </label>
                  <div className='flex items-center'>
                    {feature.is_deprecated ? (
                      <span className='text-sm font-semibold text-warning'>
                        Deprecated
                      </span>
                    ) : (
                      <span className='text-sm font-semibold text-success'>
                        Active
                      </span>
                    )}
                  </div>
                  <p className='mt-2 text-xs text-textSecondary'>
                    Use the deprecate action to change status
                  </p>
                </div>

                {/* Sort Order */}
                <div>
                  <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                    Sort Order{' '}
                    <span className='text-xs font-normal text-textSecondary'>
                      (Optional)
                    </span>
                  </label>
                  <input
                    type='number'
                    placeholder='0'
                    min={0}
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sortOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                  />
                  <p className='mt-1.5 text-xs text-textSecondary'>
                    Display order in feature lists (lower numbers appear first)
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* User Navigation Section */}
          <div className='mt-6 border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center'>
              <Navigation className='mr-2 h-5 w-5 text-primarySolid' />
              <h2 className='text-xl font-semibold text-textPrimary'>
                User Navigation
              </h2>
            </div>
            <p className='mb-6 text-sm text-textSecondary'>
              Configure how this feature appears in the tenant&apos;s sidebar
              navigation. When enabled, tenants with this feature will see it as
              a menu item.
            </p>

            <div className='space-y-6'>
              {/* Is Navigable Toggle */}
              <div>
                <label
                  htmlFor='edit-is-navigable-toggle'
                  className='mb-3 block text-sm font-semibold text-textPrimary'
                >
                  Show in Sidebar
                </label>
                <div className='flex items-center'>
                  <button
                    id='edit-is-navigable-toggle'
                    type='button'
                    onClick={() =>
                      setFormData({
                        ...formData,
                        isNavigable: !formData.isNavigable,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                      formData.isNavigable ? 'bg-primarySolid' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isNavigable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className='ml-3 text-sm font-medium text-textPrimary'>
                    {formData.isNavigable
                      ? 'Visible in sidebar'
                      : 'Not shown in sidebar'}
                  </span>
                </div>
                <p className='mt-2 text-xs text-textSecondary'>
                  When enabled, entitled tenants will see this feature in their
                  sidebar navigation
                </p>
              </div>

              {/* Nav fields (shown only when navigable) */}
              {formData.isNavigable && (
                <>
                  {/* Nav Route */}
                  <div>
                    <label
                      htmlFor='edit-nav-route'
                      className='mb-2 block text-sm font-semibold text-textPrimary'
                    >
                      Route Path <span className='text-error'>*</span>
                    </label>
                    <input
                      id='edit-nav-route'
                      type='text'
                      placeholder='e.g., /self-paced'
                      value={formData.navRoute}
                      onChange={(e) =>
                        setFormData({ ...formData, navRoute: e.target.value })
                      }
                      className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                    />
                    <p className='mt-1.5 text-xs text-textSecondary'>
                      The URL path for this navigation item (must start with /)
                    </p>
                  </div>

                  {/* Nav Label */}
                  <div>
                    <label
                      htmlFor='edit-nav-label'
                      className='mb-2 block text-sm font-semibold text-textPrimary'
                    >
                      Navigation Label <span className='text-error'>*</span>
                    </label>
                    <input
                      id='edit-nav-label'
                      type='text'
                      placeholder='e.g., Self Paced Courses'
                      value={formData.navLabel}
                      onChange={(e) =>
                        setFormData({ ...formData, navLabel: e.target.value })
                      }
                      className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                    />
                    <p className='mt-1.5 text-xs text-textSecondary'>
                      The label displayed in the sidebar menu
                    </p>
                  </div>

                  {/* Nav Icon and Nav Sort Order Row */}
                  <div className='grid grid-cols-2 gap-6'>
                    {/* Nav Icon */}
                    <div>
                      <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                        Icon{' '}
                        <span className='text-xs font-normal text-textSecondary'>
                          (Optional)
                        </span>
                      </label>
                      <NavIconPicker
                        value={formData.navIcon}
                        onChange={(icon) =>
                          setFormData({ ...formData, navIcon: icon })
                        }
                      />
                      <p className='mt-1.5 text-xs text-textSecondary'>
                        Icon displayed in the sidebar menu item
                      </p>
                    </div>

                    {/* Nav Sort Order */}
                    <div>
                      <label
                        htmlFor='edit-nav-sort-order'
                        className='mb-2 block text-sm font-semibold text-textPrimary'
                      >
                        Nav Sort Order{' '}
                        <span className='text-xs font-normal text-textSecondary'>
                          (Optional)
                        </span>
                      </label>
                      <input
                        id='edit-nav-sort-order'
                        type='number'
                        placeholder='0'
                        min={0}
                        value={formData.navSortOrder}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            navSortOrder: Number.parseInt(e.target.value) || 0,
                          })
                        }
                        className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                      />
                      <p className='mt-1.5 text-xs text-textSecondary'>
                        Order in the sidebar (lower numbers appear first)
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Sidebar - 1/3 width */}
        <section className='col-span-1'>
          {/* Quick Tips for Editing */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Tips for Editing
            </h3>
            <div className='space-y-4'>
              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100'>
                  <Lightbulb className='h-3 w-3 text-primary' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Display Name
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Update the display name to better reflect the feature&apos;s
                    purpose
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100'>
                  <Check className='h-3 w-3 text-success' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Description
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Keep descriptions clear and up-to-date for better team
                    understanding
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100'>
                  <AlertTriangle className='h-3 w-3 text-warning' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Deprecation
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Consider impact on existing subscriptions before deprecating
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Quick Actions
            </h3>
            <div className='space-y-3'>
              <button className='flex w-full items-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-textPrimary transition hover:bg-bgGray'>
                <History className='mr-3 h-4 w-4 text-textSecondary' />
                View Change History
              </button>
              {!feature.is_deprecated && (
                <button
                  onClick={() => setShowDeprecateConfirm(true)}
                  className='flex w-full items-center rounded-lg border border-warning px-4 py-3 text-sm font-medium text-warning transition hover:bg-amber-50'
                >
                  <Trash2 className='mr-3 h-4 w-4' />
                  Deprecate Feature
                </button>
              )}
            </div>
          </div>

          {/* Feature Stats */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Feature Stats
            </h3>
            <div className='space-y-3'>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>
                  Products Using
                </span>
                <Link
                  href={`/products?featureId=${id}`}
                  className='flex items-center text-sm font-semibold text-primarySolid hover:underline'
                >
                  {feature.product_count}
                  <ExternalLink className='ml-1 h-3 w-3' />
                </Link>
              </div>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Created</span>
                <span className='text-sm font-semibold text-textSecondary'>
                  {formatDate(feature.created_at)}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-textSecondary'>Last Updated</span>
                <span className='text-sm font-semibold text-textSecondary'>
                  {formatDate(feature.updated_at)}
                </span>
              </div>
            </div>
            {/* View Products Button */}
            <Link
              href={`/products?featureId=${id}`}
              className='mt-4 flex w-full items-center justify-center rounded-lg border border-border bg-bgGray px-4 py-2 text-sm font-medium text-textPrimary transition hover:bg-gray-100'
            >
              <Package className='mr-2 h-4 w-4' />
              View Products
            </Link>
          </div>

          {/* Impact Warning */}
          {feature.product_count > 0 && (
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-6'>
              <div className='flex items-start'>
                <AlertTriangle className='mt-0.5 h-5 w-5 text-warning' />
                <div className='ml-3'>
                  <h4 className='mb-2 text-sm font-semibold text-warning'>
                    Impact Warning
                  </h4>
                  <p className='mb-3 text-xs text-textPrimary'>
                    Changes to this feature may affect {feature.product_count}{' '}
                    product(s) currently using it.
                  </p>
                  <Link
                    href={`/features/${id}`}
                    className='text-xs font-medium text-warning hover:underline'
                  >
                    View Feature Details →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
