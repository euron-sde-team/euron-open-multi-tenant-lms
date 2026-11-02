'use client';

import {
  AlertCircle,
  ArrowLeft,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  Headphones,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useGetApplications } from '@/lib/api/hooks/useApplications';
import { useCreatePlanWithVersion } from '@/lib/api/hooks/usePlans';

export default function CreatePlanPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    planType: 'SINGLE_APP' as 'SINGLE_APP' | 'BUNDLE' | 'ENTERPRISE',
    applicationIds: [] as string[],
    isActive: true,
    isPublic: true,
    sortOrder: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch applications from API
  const { data: applicationsData, isLoading: applicationsLoading } =
    useGetApplications({ is_active: true });
  const applications = applicationsData?.applications || [];

  // Create plan with version mutation
  const createPlanMutation = useCreatePlanWithVersion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Plan name is required');
      return;
    }
    if (!formData.code.trim()) {
      setError('Plan code is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formData.code)) {
      setError(
        'Plan code must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
      );
      return;
    }

    try {
      const result = await createPlanMutation.mutateAsync({
        code: formData.code,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        plan_type: formData.planType,
        sort_order: formData.sortOrder,
        is_public: formData.isPublic,
        application_ids:
          formData.applicationIds.length > 0
            ? formData.applicationIds
            : undefined,
        // Default pricing for first version (will be configured in version edit page)
        price_monthly_inr: 0,
        price_yearly_inr: 0,
        price_monthly_usd: 0,
        price_yearly_usd: 0,
      });

      // Navigate to version edit page to configure pricing and products
      const { plan, version } = result.data;
      router.push(`/plans/${plan.id}/versions/${version.id}/edit`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create plan';
      setError(errorMessage);
    }
  };

  const isSubmitting = createPlanMutation.isLoading;

  const handleApplicationToggle = (appId: string) => {
    setFormData((prev) => ({
      ...prev,
      applicationIds: prev.applicationIds.includes(appId)
        ? prev.applicationIds.filter((id) => id !== appId)
        : [...prev.applicationIds, appId],
    }));
  };

  return (
    <div className='p-8'>
      {/* Breadcrumb */}
      <section className='mb-6'>
        <div className='flex items-center text-sm text-textSecondary mb-4'>
          <Link href='/plans' className='hover:text-primary'>
            Catalog
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <Link href='/plans' className='hover:text-primary'>
            Plans
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <span className='text-textPrimary font-medium'>Create New Plan</span>
        </div>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-textPrimary mb-2'>
              Create New Plan
            </h1>
            <p className='text-textSecondary'>
              Define plan details, applications, and configuration settings
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href='/plans'
              className='h-10 px-5 border border-border rounded-full text-sm font-semibold text-textPrimary hover:bg-bgGray transition flex items-center'
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className='h-10 px-5 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Check className='h-4 w-4 mr-2' />
              )}
              {isSubmitting ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </div>
      </section>

      <div className='grid grid-cols-3 gap-6'>
        {/* Main Form - 2/3 width */}
        <div className='col-span-2'>
          {/* Basic Information */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <Info className='h-5 w-5 text-primary' />
              </div>
              <div className='ml-4'>
                <h2 className='text-xl font-semibold text-textPrimary'>
                  Basic Information
                </h2>
                <p className='text-sm text-textSecondary'>
                  Core plan details and identification
                </p>
              </div>
            </div>

            <div className='space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Plan Name <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  placeholder='e.g., Gold Plan, Enterprise Package'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='w-full h-11 px-4 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                />
                <p className='text-xs text-textSecondary mt-1.5'>
                  Display name shown to customers and in the admin panel
                </p>
              </div>

              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Plan Code <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  placeholder='e.g., gold, enterprise-pkg'
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className='w-full h-11 px-4 bg-surface border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                />
                <p className='text-xs text-textSecondary mt-1.5'>
                  Unique identifier for API integration (lowercase, hyphens
                  allowed). Cannot be changed after creation.
                </p>
              </div>

              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder='Enter marketing description for this plan...'
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none'
                />
                <p className='text-xs text-textSecondary mt-1.5'>
                  Marketing copy displayed on pricing pages and plan selection
                  screens
                </p>
              </div>
            </div>
          </section>

          {/* Plan Type & Applications */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <Layers className='h-5 w-5 text-purple-600' />
              </div>
              <div className='ml-4'>
                <h2 className='text-xl font-semibold text-textPrimary'>
                  Plan Type & Applications
                </h2>
                <p className='text-sm text-textSecondary'>
                  Define the plan structure and included applications
                </p>
              </div>
            </div>

            <div className='space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-3'>
                  Plan Type <span className='text-error'>*</span>
                </label>
                <div className='grid grid-cols-3 gap-3'>
                  <label
                    className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                      formData.planType === 'SINGLE_APP'
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    <input
                      type='radio'
                      name='planType'
                      value='SINGLE_APP'
                      checked={formData.planType === 'SINGLE_APP'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          planType: e.target.value as typeof formData.planType,
                        })
                      }
                      className='w-4 h-4 text-primary'
                    />
                    <div className='ml-3'>
                      <div className='font-semibold text-textPrimary text-sm'>
                        Single App
                      </div>
                      <div className='text-xs text-textSecondary mt-0.5'>
                        One application
                      </div>
                    </div>
                  </label>

                  <label
                    className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                      formData.planType === 'BUNDLE'
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    <input
                      type='radio'
                      name='planType'
                      value='BUNDLE'
                      checked={formData.planType === 'BUNDLE'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          planType: e.target.value as typeof formData.planType,
                        })
                      }
                      className='w-4 h-4 text-primary'
                    />
                    <div className='ml-3'>
                      <div className='font-semibold text-textPrimary text-sm'>
                        Bundle
                      </div>
                      <div className='text-xs text-textSecondary mt-0.5'>
                        Multiple apps
                      </div>
                    </div>
                  </label>

                  <label
                    className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                      formData.planType === 'ENTERPRISE'
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    <input
                      type='radio'
                      name='planType'
                      value='ENTERPRISE'
                      checked={formData.planType === 'ENTERPRISE'}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          planType: 'ENTERPRISE',
                          applicationIds: applications.map((a) => a.id),
                        })
                      }
                      className='w-4 h-4 text-primary'
                    />
                    <div className='ml-3'>
                      <div className='font-semibold text-textPrimary text-sm'>
                        Enterprise
                      </div>
                      <div className='text-xs text-textSecondary mt-0.5'>
                        All apps (auto-selected)
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Select Applications <span className='text-error'>*</span>
                </label>
                <p className='text-xs text-textSecondary mb-3'>
                  Select which applications are included in this plan
                </p>
              </div>

              <div className='border border-border rounded-lg p-4 bg-bgGray'>
                <div className='text-sm font-semibold text-textPrimary mb-3'>
                  Selected Applications ({formData.applicationIds.length})
                </div>
                {formData.applicationIds.length === 0 ? (
                  <div className='text-sm text-textSecondary text-center py-6'>
                    <Layers className='h-8 w-8 mx-auto mb-2 text-textSecondary opacity-30' />
                    No applications selected yet
                  </div>
                ) : (
                  <div className='grid grid-cols-2 gap-2'>
                    {formData.applicationIds.map((appId) => {
                      const app = applications.find((a) => a.id === appId);
                      return app ? (
                        <div
                          key={appId}
                          className='flex items-center justify-between p-2 bg-surface rounded border border-border'
                        >
                          <span className='text-sm font-medium text-textPrimary'>
                            {app.name}
                          </span>
                          <button
                            onClick={() => handleApplicationToggle(appId)}
                            className='text-xs text-error hover:underline'
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className='border border-border rounded-lg p-4 max-h-60 overflow-y-auto'>
                <div className='text-sm font-semibold text-textPrimary mb-3'>
                  Available Applications
                </div>
                {applicationsLoading ? (
                  <div className='flex items-center justify-center py-6'>
                    <Loader2 className='h-6 w-6 animate-spin text-textSecondary' />
                    <span className='ml-2 text-sm text-textSecondary'>
                      Loading applications...
                    </span>
                  </div>
                ) : applications.length === 0 ? (
                  <div className='text-sm text-textSecondary text-center py-6'>
                    No applications available
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {applications.map((app) => (
                      <label
                        key={app.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                          formData.applicationIds.includes(app.id)
                            ? 'border-primary bg-primary-50'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <input
                          type='checkbox'
                          checked={formData.applicationIds.includes(app.id)}
                          onChange={() => handleApplicationToggle(app.id)}
                          className='w-4 h-4 text-primary rounded'
                        />
                        <div className='ml-3'>
                          <div className='text-sm font-medium text-textPrimary'>
                            {app.name}
                          </div>
                          <div className='text-xs text-textSecondary'>
                            {app.code}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Plan Settings */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <Settings className='h-5 w-5 text-success' />
              </div>
              <div className='ml-4'>
                <h2 className='text-xl font-semibold text-textPrimary'>
                  Plan Settings
                </h2>
                <p className='text-sm text-textSecondary'>
                  Configure visibility and display options
                </p>
              </div>
            </div>

            <div className='space-y-5'>
              <div className='flex items-center justify-between p-4 border border-border rounded-lg'>
                <div className='flex-1'>
                  <div className='font-semibold text-textPrimary mb-1'>
                    Is Active
                  </div>
                  <p className='text-sm text-textSecondary'>
                    Enable this plan for new subscriptions and tenant
                    assignments
                  </p>
                </div>
                <label className='relative inline-flex items-center cursor-pointer ml-4'>
                  <input
                    type='checkbox'
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className='sr-only peer'
                  />
                  <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              <div className='flex items-center justify-between p-4 border border-border rounded-lg'>
                <div className='flex-1'>
                  <div className='font-semibold text-textPrimary mb-1'>
                    Is Public
                  </div>
                  <p className='text-sm text-textSecondary'>
                    Display this plan on public pricing pages and self-service
                    portals
                  </p>
                </div>
                <label className='relative inline-flex items-center cursor-pointer ml-4'>
                  <input
                    type='checkbox'
                    checked={formData.isPublic}
                    onChange={(e) =>
                      setFormData({ ...formData, isPublic: e.target.checked })
                    }
                    className='sr-only peer'
                  />
                  <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Sort Order
                </label>
                <input
                  type='number'
                  placeholder='0'
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  className='w-full h-11 px-4 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                />
                <p className='text-xs text-textSecondary mt-1.5'>
                  Display order on pricing pages (lower numbers appear first)
                </p>
              </div>
            </div>
          </section>

          {/* Error Display */}
          {error && (
            <section className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
              <div className='flex items-center'>
                <AlertCircle className='h-5 w-5 text-error mr-2' />
                <span className='text-sm text-error'>{error}</span>
              </div>
            </section>
          )}

          {/* Form Actions */}
          <section className='flex items-center justify-between'>
            <Link
              href='/plans'
              className='h-11 px-6 border border-border rounded-full text-sm font-semibold text-textPrimary hover:bg-bgGray transition flex items-center'
            >
              <ArrowLeft className='h-4 w-4 mr-2' />
              Back to Plans
            </Link>
            <div className='flex items-center space-x-3'>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className='h-11 px-6 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isSubmitting ? (
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <Check className='h-4 w-4 mr-2' />
                )}
                {isSubmitting ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar - 1/3 width */}
        <div className='col-span-1'>
          {/* Quick Tips */}
          <section className='mb-6 sticky top-24 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-4'>
              <div className='w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center'>
                <Lightbulb className='h-4 w-4 text-warning' />
              </div>
              <h3 className='ml-3 font-semibold text-textPrimary'>
                Quick Tips
              </h3>
            </div>

            <div className='space-y-4'>
              <div className='p-3 bg-primary-50 border border-primary-200 rounded-lg'>
                <div className='flex items-start'>
                  <Info className='h-4 w-4 text-primary mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Plan Code Best Practices
                    </div>
                    <p className='text-xs text-textSecondary'>
                      Use lowercase letters, numbers, and hyphens only. Keep it
                      short and descriptive (e.g., &quot;pro&quot;,
                      &quot;enterprise-plus&quot;).
                    </p>
                  </div>
                </div>
              </div>

              <div className='p-3 bg-purple-50 border border-purple-200 rounded-lg'>
                <div className='flex items-start'>
                  <Layers className='h-4 w-4 text-purple-600 mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Plan Types Explained
                    </div>
                    <p className='text-xs text-textSecondary mb-2'>
                      <strong>Single App:</strong> One application access
                    </p>
                    <p className='text-xs text-textSecondary mb-2'>
                      <strong>Bundle:</strong> Multiple selected apps
                    </p>
                    <p className='text-xs text-textSecondary'>
                      <strong>Enterprise:</strong> All applications included
                    </p>
                  </div>
                </div>
              </div>

              <div className='p-3 bg-green-50 border border-green-200 rounded-lg'>
                <div className='flex items-start'>
                  <Eye className='h-4 w-4 text-success mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Public vs Private Plans
                    </div>
                    <p className='text-xs text-textSecondary'>
                      Public plans appear on pricing pages. Private plans are
                      available only through admin assignment or API.
                    </p>
                  </div>
                </div>
              </div>

              <div className='p-3 bg-amber-50 border border-amber-200 rounded-lg'>
                <div className='flex items-start'>
                  <ArrowUpFromLine className='h-4 w-4 text-warning mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Sort Order Tips
                    </div>
                    <p className='text-xs text-textSecondary'>
                      Use increments of 10 (10, 20, 30) to allow easy reordering
                      without changing all plans.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='mt-6 pt-6 border-t border-border'>
              <div className='text-sm font-semibold text-textPrimary mb-3'>
                Need Help?
              </div>
              <a
                href='#'
                className='flex items-center text-sm text-primary hover:underline mb-2'
              >
                <BookOpen className='h-4 w-4 mr-2' />
                View Documentation
              </a>
              <a
                href='#'
                className='flex items-center text-sm text-primary hover:underline'
              >
                <Headphones className='h-4 w-4 mr-2' />
                Contact Support
              </a>
            </div>
          </section>

          {/* Plan Preview */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-4'>
              <div className='w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center'>
                <Eye className='h-4 w-4 text-indigo-600' />
              </div>
              <h3 className='ml-3 font-semibold text-textPrimary'>
                Plan Preview
              </h3>
            </div>

            {formData.name ? (
              <div className='border border-border rounded-lg p-4'>
                <div className='font-semibold text-textPrimary mb-1'>
                  {formData.name}
                </div>
                {formData.code && (
                  <div className='text-xs text-textSecondary font-mono mb-2'>
                    {formData.code}
                  </div>
                )}
                {formData.description && (
                  <p className='text-sm text-textSecondary mb-3'>
                    {formData.description}
                  </p>
                )}
                <div className='flex items-center space-x-2'>
                  <span className='px-2 py-1 bg-primary-100 text-primary text-xs font-medium rounded'>
                    {formData.planType.replace('_', ' ')}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${formData.isActive ? 'bg-green-100 text-success' : 'bg-gray-100 text-textSecondary'}`}
                  >
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${formData.isPublic ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-textSecondary'}`}
                  >
                    {formData.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                {formData.applicationIds.length > 0 && (
                  <div className='mt-3 pt-3 border-t border-border'>
                    <div className='text-xs text-textSecondary mb-2'>
                      {formData.applicationIds.length} Application
                      {formData.applicationIds.length > 1 ? 's' : ''} Selected
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='border-2 border-dashed border-border rounded-lg p-6 text-center'>
                <Layers className='h-10 w-10 mx-auto text-textSecondary opacity-30 mb-3' />
                <div className='text-sm text-textSecondary'>
                  Plan preview will appear here as you fill in the details
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
