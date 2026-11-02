'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useGetTenant, useUpdateTenant } from '@/lib/api/hooks';

export default function EditTenantPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const [error, setError] = useState<string | null>(null);

  const { data: tenant, isLoading, error: fetchError } = useGetTenant(tenantId);
  const updateTenantMutation = useUpdateTenant();

  const [formData, setFormData] = useState({
    name: '',
    custom_domain: '',
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name ?? '',
        custom_domain: tenant.custom_domain ?? '',
      });
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = formData.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    try {
      await updateTenantMutation.mutateAsync({
        id: tenantId,
        data: {
          name,
          custom_domain: formData.custom_domain.trim() || undefined,
        },
      });
      router.push(`/tenants/${tenantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant');
    }
  };

  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center p-8'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
          <p className='text-textSecondary'>Loading tenant...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !tenant) {
    return (
      <div className='p-8'>
        <div className='text-center'>
          <p className='text-textSecondary'>
            {fetchError?.message ?? 'Tenant not found'}
          </p>
          <Link
            href='/tenants'
            className='mt-4 inline-block text-sm font-medium text-primary hover:underline'
          >
            Back to tenants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <Link
              href={`/tenants/${tenantId}`}
              className='mr-4 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bgGray'
            >
              <ArrowLeft className='h-5 w-5 text-textPrimary' />
            </Link>
            <div>
              <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
                Edit Tenant
              </h1>
              <p className='text-textSecondary'>
                Update tenant name and custom domain
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <Link
              href={`/tenants/${tenantId}`}
              className='rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </Link>
            <button
              type='submit'
              form='edit-tenant-form'
              disabled={updateTenantMutation.isLoading}
              className='flex items-center rounded-full bg-primarySolid px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-50'
            >
              {updateTenantMutation.isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </section>

      <form id='edit-tenant-form' onSubmit={handleSubmit} className='max-w-2xl'>
        {error && (
          <div className='mb-6 rounded-lg border border-error/30 bg-red-50 px-4 py-3 text-sm text-error'>
            {error}
          </div>
        )}

        <section className='mb-8 border-t border-border pt-6 pb-2'>
          <h2 className='mb-4 text-lg font-semibold text-textPrimary'>
            Tenant details
          </h2>
          <div className='space-y-4'>
            <div>
              <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                Name <span className='text-error'>*</span>
              </label>
              <input
                type='text'
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder='Acme Inc'
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                required
              />
            </div>
            <div>
              <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                Slug (read-only)
              </label>
              <input
                type='text'
                value={tenant.slug}
                readOnly
                disabled
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textSecondary'
              />
              <p className='mt-1.5 text-xs text-textSecondary'>
                Slug cannot be changed after creation
              </p>
            </div>
            <div>
              <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                Custom domain (optional)
              </label>
              <input
                type='text'
                value={formData.custom_domain}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    custom_domain: e.target.value,
                  }))
                }
                placeholder='app.acme.com'
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              />
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
