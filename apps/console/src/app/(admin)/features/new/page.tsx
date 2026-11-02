'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCreateFeature, useGetApplications } from '@/lib/api/hooks';

import NavIconPicker from '@/components/common/NavIconPicker';

export default function CreateFeaturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAppId = searchParams.get('applicationId');

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

  // Fetch applications from API
  const { data: applicationsData, isLoading: applicationsLoading } =
    useGetApplications({ is_active: true });

  // Create feature mutation
  const createMutation = useCreateFeature();

  const applications = applicationsData?.applications || [];

  // Pre-select application when navigating from application detail page
  useEffect(() => {
    if (preselectedAppId && !formData.applicationId) {
      setFormData((prev) => ({ ...prev, applicationId: preselectedAppId }));
    }
  }, [preselectedAppId, formData.applicationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.applicationId) {
      setError('Please select an application');
      return;
    }
    if (!formData.key.trim()) {
      setError('Feature key is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      setError(
        'Key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
      );
      return;
    }

    createMutation.mutate(
      {
        application_id: formData.applicationId,
        key: formData.key,
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
      {
        onSuccess: () => {
          router.push('/features');
        },
        onError: (err: Error) => {
          if (
            err.message.includes('already exists') ||
            err.message.includes('duplicate')
          ) {
            setError(
              'A feature with this key already exists. Please use a different key.',
            );
          } else {
            setError(
              err.message || 'Failed to create feature. Please try again.',
            );
          }
        },
      },
    );
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

  const isSubmitting = createMutation.isLoading;
  const isKeyValid =
    formData.key.length >= 1 && /^[a-z][a-z0-9_]*$/.test(formData.key);
  const isApplicationSelected = formData.applicationId !== '';
  const isFormValid = isKeyValid && isApplicationSelected;

  return (
    <div className='p-8'>
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
              Create New Feature
            </h1>
            <p className='text-textSecondary'>
              Add a new feature to your application catalog
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
                  Create Feature
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
                    className='h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 pr-10 text-sm text-textPrimary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid disabled:cursor-not-allowed disabled:opacity-50'
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
                  Choose the application this feature belongs to
                </p>
              </div>

              {/* Feature Key Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Feature Key <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  placeholder='e.g., advanced_analytics'
                  value={formData.key}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      key: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, ''),
                    })
                  }
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
                />
                <div className='mt-1.5 flex items-start'>
                  <Info className='mr-1.5 mt-0.5 h-3 w-3 flex-shrink-0 text-textSecondary' />
                  <p className='text-xs text-textSecondary'>
                    Unique identifier using lowercase letters, numbers, and
                    underscores. Cannot be changed after creation.
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
                {/* Feature Status Toggle */}
                <div>
                  <label className='mb-3 block text-sm font-semibold text-textPrimary'>
                    Feature Status
                  </label>
                  <div className='flex items-center'>
                    <button
                      type='button'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          isDeprecated: !formData.isDeprecated,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                        formData.isDeprecated ? 'bg-error' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isDeprecated
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className='ml-3 text-sm font-medium text-textPrimary'>
                      Mark as Deprecated
                    </span>
                  </div>
                  <p className='mt-2 text-xs text-textSecondary'>
                    Deprecated features are hidden from new subscriptions
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
                  htmlFor='is-navigable-toggle'
                  className='mb-3 block text-sm font-semibold text-textPrimary'
                >
                  Show in Sidebar
                </label>
                <div className='flex items-center'>
                  <button
                    id='is-navigable-toggle'
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
                      htmlFor='nav-route'
                      className='mb-2 block text-sm font-semibold text-textPrimary'
                    >
                      Route Path <span className='text-error'>*</span>
                    </label>
                    <input
                      id='nav-route'
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
                      htmlFor='nav-label'
                      className='mb-2 block text-sm font-semibold text-textPrimary'
                    >
                      Navigation Label <span className='text-error'>*</span>
                    </label>
                    <input
                      id='nav-label'
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
                      <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                        Nav Sort Order{' '}
                        <span className='text-xs font-normal text-textSecondary'>
                          (Optional)
                        </span>
                      </label>
                      <input
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
          {/* Quick Tips */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Quick Tips
            </h3>
            <div className='space-y-4'>
              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100'>
                  <Lightbulb className='h-3 w-3 text-primary' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Feature Keys
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Use descriptive keys like &quot;sso_authentication&quot; or
                    &quot;api_rate_limiting&quot; for clarity
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100'>
                  <Check className='h-3 w-3 text-success' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Best Practices
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Add clear descriptions to help your team understand feature
                    scope and usage
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100'>
                  <Layers className='h-3 w-3 text-purple-600' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Categories
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Organize features into logical groups for easier plan
                    management
                  </div>
                </div>
              </div>

              <div className='flex items-start'>
                <div className='mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100'>
                  <AlertTriangle className='h-3 w-3 text-warning' />
                </div>
                <div className='ml-3'>
                  <div className='mb-1 text-sm font-medium text-textPrimary'>
                    Immutable Keys
                  </div>
                  <div className='text-xs text-textSecondary'>
                    Feature keys cannot be changed after creation to maintain
                    data integrity
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Need Help */}
          <div className='rounded-lg border border-primary-200 bg-primary-50 p-6'>
            <div className='flex items-start'>
              <Info className='mt-0.5 h-5 w-5 text-primary' />
              <div className='ml-3'>
                <h4 className='mb-2 text-sm font-semibold text-primary'>
                  Need Help?
                </h4>
                <p className='mb-3 text-xs text-textPrimary'>
                  Check our documentation for detailed guides on feature
                  management and best practices.
                </p>
                <a
                  href='#'
                  className='text-xs font-medium text-primary hover:underline'
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
