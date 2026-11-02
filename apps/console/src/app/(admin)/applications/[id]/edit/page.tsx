'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  History,
  Image,
  Info,
  Lightbulb,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  useDeactivateApplication,
  useGetApplication,
  useUpdateApplication,
} from '@/lib/api/hooks';

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

export default function EditApplicationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Fetch application data from API
  const {
    data: application,
    isLoading,
    error: fetchError,
  } = useGetApplication(id);

  // Mutations
  const updateMutation = useUpdateApplication();
  const deactivateMutation = useDeactivateApplication();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true,
    isPublic: true,
    sortOrder: 0,
  });
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate form when application data loads
  useEffect(() => {
    if (application) {
      setFormData({
        name: application.name,
        code: application.code,
        description: application.description || '',
        isActive: application.is_active,
        isPublic: application.is_public,
        sortOrder: application.sort_order,
      });
      setCharCount(application.description?.length || 0);
    }
  }, [application]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Application name is required');
      return;
    }

    updateMutation.mutate(
      {
        id,
        data: {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          is_active: formData.isActive,
          is_public: formData.isPublic,
          sort_order: formData.sortOrder,
        },
      },
      {
        onSuccess: () => {
          router.push(`/applications/${id}`);
        },
        onError: (err: Error) => {
          setError(
            err.message || 'Failed to update application. Please try again.',
          );
        },
      },
    );
  };

  const handleDelete = () => {
    deactivateMutation.mutate(id, {
      onSuccess: () => {
        router.push('/applications');
      },
      onError: (err: Error) => {
        setError(
          err.message || 'Failed to deactivate application. Please try again.',
        );
        setShowDeleteConfirm(false);
      },
    });
  };

  const isSubmitting = updateMutation.isLoading;
  const isDeleting = deactivateMutation.isLoading;

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setFormData({ ...formData, description: value });
      setCharCount(value.length);
    }
  };

  const validations = {
    name: formData.name.length > 0 && formData.name.length <= 100,
    code: formData.code.length > 0,
    status: true,
    sortOrder: true,
  };

  const isFormValid = validations.name;

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
  if (fetchError) {
    return (
      <div className='flex h-96 items-center justify-center p-8'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load application
          </h3>
          <p className='mt-2 text-textSecondary'>{fetchError.message}</p>
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

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='mb-4 flex items-center'>
          <Link
            href={`/applications/${id}`}
            className='flex items-center text-textSecondary transition hover:text-textPrimary'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            <span className='text-sm font-medium'>Back to Application</span>
          </Link>
        </div>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Edit Application
            </h1>
            <p className='text-textSecondary'>
              Update application details and settings
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href={`/applications/${id}`}
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

      {/* Main Content Grid */}
      <div className='grid grid-cols-3 gap-6'>
        {/* Form Section */}
        <section className='col-span-2'>
          <div className='border-t border-border pt-6 pb-2'>
            <h2 className='mb-6 text-xl font-semibold text-textPrimary'>
              Application Details
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
              {/* Name Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Name <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  placeholder='Enter application name'
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                <p className='mt-2 text-xs text-textSecondary'>
                  Maximum 100 characters
                </p>
              </div>

              {/* Code Field (Read-only for edit) */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Code <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.code}
                  readOnly
                  className='h-11 w-full cursor-not-allowed rounded-lg border border-border bg-bgGray px-4 font-mono text-sm text-textSecondary'
                />
                <p className='mt-2 text-xs text-textSecondary'>
                  Application code cannot be changed after creation
                </p>
              </div>

              {/* Description Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Description
                </label>
                <textarea
                  placeholder='Enter a brief description of the application'
                  maxLength={500}
                  rows={4}
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  className='w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-textPrimary placeholder-textSecondary transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                <div className='mt-2 flex items-center justify-between'>
                  <p className='text-xs text-textSecondary'>
                    Optional. Maximum 500 characters
                  </p>
                  <p className='text-xs text-textSecondary'>{charCount}/500</p>
                </div>
              </div>

              {/* Application Icon */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Application Icon
                </label>
                <div className='cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center transition hover:border-primary'>
                  <div className='flex flex-col items-center'>
                    <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-bgGray'>
                      <Image
                        className='h-8 w-8 text-textSecondary'
                        aria-hidden='true'
                      />
                    </div>
                    <div className='mb-1 text-sm font-medium text-textPrimary'>
                      <span className='text-primary hover:underline'>
                        Click to upload
                      </span>{' '}
                      or drag and drop
                    </div>
                    <p className='text-xs text-textSecondary'>
                      PNG or SVG (max. 512KB, 128x128px recommended)
                    </p>
                  </div>
                  <input type='file' accept='.png,.svg' className='hidden' />
                </div>
              </div>

              {/* Toggle Fields */}
              <div className='grid grid-cols-2 gap-6'>
                {/* Is Active */}
                <div>
                  <label className='mb-3 block text-sm font-semibold text-textPrimary'>
                    Is Active <span className='text-error'>*</span>
                  </label>
                  <div className='flex items-center'>
                    <button
                      type='button'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          isActive: !formData.isActive,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                        formData.isActive ? 'bg-primarySolid' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className='ml-3 text-sm font-medium text-textPrimary'>
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className='mt-2 text-xs text-textSecondary'>
                    Enable this application for use
                  </p>
                </div>

                {/* Is Public */}
                <div>
                  <label className='mb-3 block text-sm font-semibold text-textPrimary'>
                    Is Public <span className='text-error'>*</span>
                  </label>
                  <div className='flex items-center'>
                    <button
                      type='button'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          isPublic: !formData.isPublic,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                        formData.isPublic ? 'bg-primarySolid' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isPublic ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className='ml-3 text-sm font-medium text-textPrimary'>
                      {formData.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <p className='mt-2 text-xs text-textSecondary'>
                    Make this application publicly visible
                  </p>
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
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
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary placeholder-textSecondary transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                <p className='mt-2 text-xs text-textSecondary'>
                  Determines the display order. Default is 0.
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Sidebar Section */}
        <section>
          <div className='space-y-6'>
            {/* Tips Card */}
            <div className='rounded-lg border border-primary-200 bg-primary-50 p-6'>
              <div className='flex items-start'>
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary'>
                  <Lightbulb className='h-5 w-5 text-white' />
                </div>
                <div className='ml-4'>
                  <h3 className='mb-2 text-sm font-semibold text-textPrimary'>
                    Tips for Editing Applications
                  </h3>
                  <ul className='space-y-2 text-xs text-textSecondary'>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Changing status will affect all associated features and
                        plans
                      </span>
                    </li>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Application code is permanent and cannot be modified
                      </span>
                    </li>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>Review tenant impact before making changes</span>
                    </li>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Consider notifying users of significant changes
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Validation Summary */}
            <div className='border-t border-border pt-6 pb-2'>
              <h3 className='mb-4 text-sm font-semibold text-textPrimary'>
                Validation Requirements
              </h3>
              <div className='space-y-3'>
                <div className='flex items-start'>
                  <div
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      validations.name
                        ? 'border-success bg-green-50'
                        : 'border-border'
                    }`}
                  >
                    {validations.name && (
                      <Check className='h-3 w-3 text-success' />
                    )}
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-textPrimary'>Application Name</p>
                    <p className='text-xs text-textSecondary'>
                      Required, max 100 characters
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-success bg-green-50'>
                    <Check className='h-3 w-3 text-success' />
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-textPrimary'>Application Code</p>
                    <p className='text-xs text-textSecondary'>
                      Read-only, cannot be modified
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-success bg-green-50'>
                    <Check className='h-3 w-3 text-success' />
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-textPrimary'>Status Settings</p>
                    <p className='text-xs text-textSecondary'>
                      Active and visibility configured
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-success bg-green-50'>
                    <Check className='h-3 w-3 text-success' />
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-textPrimary'>Sort Order</p>
                    <p className='text-xs text-textSecondary'>Value set</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className='border-t border-border pt-6 pb-2'>
              <h3 className='mb-4 text-sm font-semibold text-textPrimary'>
                Quick Actions
              </h3>
              <div className='space-y-2'>
                <button className='flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-textPrimary transition hover:bg-bgGray'>
                  <Eye className='mr-2 h-4 w-4' />
                  Preview Changes
                </button>
                <button className='flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-textPrimary transition hover:bg-bgGray'>
                  <History className='mr-2 h-4 w-4' />
                  View Change History
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className='flex h-10 w-full items-center justify-center rounded-lg border border-error text-sm font-medium text-error transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Deactivating...
                    </>
                  ) : (
                    <>
                      <Trash2 className='mr-2 h-4 w-4' />
                      Deactivate Application
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                <div className='w-full max-w-md rounded-lg bg-surface p-6 shadow-xl'>
                  <h3 className='text-lg font-semibold text-textPrimary'>
                    Deactivate Application?
                  </h3>
                  <p className='mt-2 text-sm text-textSecondary'>
                    This will deactivate the application and it will no longer
                    be available. This action affects{' '}
                    {application.feature_count} features. Are you sure?
                  </p>
                  <div className='mt-6 flex justify-end space-x-3'>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className='rounded-lg border border-border px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className='flex items-center rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50'
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Deactivating...
                        </>
                      ) : (
                        'Deactivate'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Application Stats */}
            <div className='border-t border-border pt-6 pb-2'>
              <h3 className='mb-4 text-sm font-semibold text-textPrimary'>
                Application Stats
              </h3>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>
                    Total Features
                  </span>
                  <span className='text-sm font-semibold text-textPrimary'>
                    {application.feature_count}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Sort Order</span>
                  <span className='text-sm font-semibold text-textPrimary'>
                    {application.sort_order}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Created</span>
                  <span className='text-sm font-semibold text-textPrimary'>
                    {formatDate(application.created_at)}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>
                    Last Updated
                  </span>
                  <span className='text-sm font-semibold text-textPrimary'>
                    {formatDate(application.updated_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Card */}
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
              <div className='flex items-start'>
                <AlertTriangle className='mr-3 h-5 w-5 flex-shrink-0 text-warning' />
                <div>
                  <h4 className='text-sm font-semibold text-textPrimary'>
                    Impact Warning
                  </h4>
                  <p className='mt-1 text-xs text-textSecondary'>
                    Changes to this application may affect{' '}
                    {application.feature_count} features associated with it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Actions Bar */}
      <section className='mt-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <Info className='mr-3 h-5 w-5 text-primary' />
              <div>
                <p className='text-sm font-medium text-textPrimary'>
                  Review changes before saving
                </p>
                <p className='text-xs text-textSecondary'>
                  Changes will be applied immediately after saving
                </p>
              </div>
            </div>
            <div className='flex items-center space-x-3'>
              <Link
                href={`/applications/${id}`}
                className='flex h-10 items-center rounded-lg border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
              >
                Discard Changes
              </Link>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className='flex h-10 items-center rounded-full bg-primarySolid px-6 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
