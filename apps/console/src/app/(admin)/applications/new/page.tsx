'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Code,
  Copy,
  Eye,
  FileInput,
  Image,
  Info,
  Lightbulb,
  Loader2,
  Monitor,
  Save,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useCreateApplication } from '@/lib/api/hooks';

export default function NewApplicationPage() {
  const router = useRouter();
  const createMutation = useCreateApplication();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Application name is required');
      return;
    }
    if (!formData.code.trim()) {
      setError('Application code is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formData.code)) {
      setError(
        'Code must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
      );
      return;
    }

    createMutation.mutate(
      {
        code: formData.code,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        is_public: formData.isPublic,
        sort_order: formData.sortOrder,
      },
      {
        onSuccess: () => {
          router.push('/applications');
        },
        onError: (err: Error) => {
          // Handle specific error cases
          if (
            err.message.includes('already exists') ||
            err.message.includes('duplicate')
          ) {
            setError(
              'An application with this code already exists. Please use a different code.',
            );
          } else {
            setError(
              err.message || 'Failed to create application. Please try again.',
            );
          }
        },
      },
    );
  };

  const isSubmitting = createMutation.isLoading;

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
    code: formData.code.length > 0 && /^[a-z][a-z0-9_]*$/.test(formData.code),
    status: true,
    sortOrder: true,
  };

  const isFormValid = validations.name && validations.code;

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='mb-4 flex items-center'>
          <Link
            href='/applications'
            className='flex items-center text-textSecondary transition hover:text-textPrimary'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            <span className='text-sm font-medium'>Back to Applications</span>
          </Link>
        </div>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Create New Application
            </h1>
            <p className='text-textSecondary'>
              Add a new application to your platform
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href='/applications'
              className='h-10 rounded-lg border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray flex items-center'
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
                  Create Application
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

              {/* Code Field */}
              <div>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Code <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  placeholder='application_code'
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toLowerCase(),
                    })
                  }
                  className='h-11 w-full rounded-lg border border-border bg-surface px-4 font-mono text-sm text-textPrimary placeholder-textSecondary transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                <p className='mt-2 text-xs text-textSecondary'>
                  Must start with a lowercase letter. Only lowercase letters,
                  numbers, and underscores allowed. Must be unique.
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
                    Tips for Creating Applications
                  </h3>
                  <ul className='space-y-2 text-xs text-textSecondary'>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Use descriptive names that clearly identify the
                        application
                      </span>
                    </li>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Application codes cannot be changed after creation
                      </span>
                    </li>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Upload a recognizable icon for better user experience
                      </span>
                    </li>
                    <li className='flex items-start'>
                      <span className='mr-2 mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary' />
                      <span>
                        Set appropriate sort order for display priority
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
                  <div
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      validations.code
                        ? 'border-success bg-green-50'
                        : 'border-border'
                    }`}
                  >
                    {validations.code && (
                      <Check className='h-3 w-3 text-success' />
                    )}
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-textPrimary'>Application Code</p>
                    <p className='text-xs text-textSecondary'>
                      Required, unique, lowercase
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
                      Active and Public enabled
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-success bg-green-50'>
                    <Check className='h-3 w-3 text-success' />
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-textPrimary'>Sort Order</p>
                    <p className='text-xs text-textSecondary'>
                      Default value set
                    </p>
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
                  Preview Application
                </button>
                <button className='flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-textPrimary transition hover:bg-bgGray'>
                  <Copy className='mr-2 h-4 w-4' />
                  Duplicate Existing
                </button>
                <button className='flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-textPrimary transition hover:bg-bgGray'>
                  <FileInput className='mr-2 h-4 w-4' />
                  Import from Template
                </button>
              </div>
            </div>

            {/* Recently Created */}
            <div className='border-t border-border pt-6 pb-2'>
              <h3 className='mb-4 text-sm font-semibold text-textPrimary'>
                Recently Created
              </h3>
              <div className='space-y-3'>
                <div className='flex items-center'>
                  <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-primary-100'>
                    <Smartphone className='h-4 w-4 text-primary' />
                  </div>
                  <div className='ml-3 flex-1'>
                    <p className='text-sm font-medium text-textPrimary'>
                      Mobile App
                    </p>
                    <p className='text-xs text-textSecondary'>2 hours ago</p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-purple-100'>
                    <Monitor className='h-4 w-4 text-purple-600' />
                  </div>
                  <div className='ml-3 flex-1'>
                    <p className='text-sm font-medium text-textPrimary'>
                      Web Dashboard
                    </p>
                    <p className='text-xs text-textSecondary'>1 day ago</p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-green-100'>
                    <Code className='h-4 w-4 text-success' />
                  </div>
                  <div className='ml-3 flex-1'>
                    <p className='text-sm font-medium text-textPrimary'>
                      API Gateway
                    </p>
                    <p className='text-xs text-textSecondary'>3 days ago</p>
                  </div>
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
                  All required fields must be completed
                </p>
                <p className='text-xs text-textSecondary'>
                  Fields marked with <span className='text-error'>*</span> are
                  mandatory
                </p>
              </div>
            </div>
            <div className='flex items-center space-x-3'>
              <button
                disabled={isSubmitting}
                className='flex h-10 items-center rounded-lg border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray disabled:cursor-not-allowed disabled:opacity-50'
              >
                <Save className='mr-2 h-4 w-4' />
                Save as Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className='flex h-10 items-center rounded-full bg-primarySolid px-6 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className='mr-2 h-4 w-4' />
                    Create Application
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
