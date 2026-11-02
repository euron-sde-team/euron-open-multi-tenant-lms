'use client';

import { ArrowLeft, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useCreateTenant, useSearchGlobalTenantUsers } from '@/lib/api/hooks';
import type { GlobalTenantUserSearchItem } from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function CreateTenantPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    custom_domain: '',
  });

  const [owner_user_id, setOwnerUserId] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedOwnerSearch = useDebounce(ownerSearchQuery, 300);
  const { data: searchResult, isLoading: searchLoading } =
    useSearchGlobalTenantUsers(debouncedOwnerSearch, { limit: 10 });

  const createTenantMutation = useCreateTenant();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        ownerDropdownRef.current &&
        !ownerDropdownRef.current.contains(e.target as Node)
      ) {
        setOwnerDropdownOpen(false);
      }
    };
    if (ownerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ownerDropdownOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    if (name === 'name' && !formData.slug) {
      const slug = value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleSelectOwner = (user: GlobalTenantUserSearchItem) => {
    setSelectedOwner({ id: user.id, email: user.email, name: user.name });
    setOwnerUserId(user.id);
    setOwnerSearchQuery('');
    setOwnerDropdownOpen(false);
    setError(null);
  };

  const handleClearOwner = () => {
    setSelectedOwner(null);
    setOwnerUserId('');
    setOwnerSearchQuery('');
    setOwnerDropdownOpen(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = formData.name.trim();
    const slug = formData.slug.trim().toLowerCase();

    if (!name || !slug) {
      setError('Name and Slug are required.');
      return;
    }
    if (!owner_user_id || !selectedOwner) {
      setError(
        'Please search and select an owner (tenant user) for this organization.',
      );
      return;
    }
    if (!slugRegex.test(slug)) {
      setError(
        'Slug must be lowercase letters, numbers, and hyphens only (e.g. my-tenant).',
      );
      return;
    }

    try {
      const result = await createTenantMutation.mutateAsync({
        name,
        slug,
        custom_domain: formData.custom_domain.trim() || undefined,
        owner_user_id,
      });
      const tenantId = result.data?.id;
      if (tenantId) {
        router.push(`/tenants/${tenantId}`);
      } else {
        router.push('/tenants');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    }
  };

  const searchUsers = searchResult?.data ?? [];
  const showDropdown =
    ownerDropdownOpen &&
    !selectedOwner &&
    (ownerSearchQuery.trim().length >= 2 || searchUsers.length > 0);

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <Link
              href='/tenants'
              className='mr-4 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bgGray'
            >
              <ArrowLeft className='h-5 w-5 text-textPrimary' />
            </Link>
            <div>
              <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
                Create Tenant
              </h1>
              <p className='text-textSecondary'>
                Create a new tenant organization with an owner user
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <Link
              href='/tenants'
              className='rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </Link>
            <button
              type='submit'
              form='create-tenant-form'
              disabled={createTenantMutation.isLoading}
              className='flex items-center rounded-full bg-primarySolid px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-50'
            >
              {createTenantMutation.isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Create Tenant'
              )}
            </button>
          </div>
        </div>
      </section>

      <form
        id='create-tenant-form'
        onSubmit={handleSubmit}
        className='max-w-2xl'
      >
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
                name='name'
                value={formData.name}
                onChange={handleInputChange}
                placeholder='Acme Inc'
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                required
              />
            </div>
            <div>
              <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                Slug <span className='text-error'>*</span>
              </label>
              <input
                type='text'
                name='slug'
                value={formData.slug}
                onChange={handleInputChange}
                placeholder='acme-inc'
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                required
              />
              <p className='mt-1.5 text-xs text-textSecondary'>
                Lowercase letters, numbers, and hyphens only (e.g. my-tenant)
              </p>
            </div>
            <div>
              <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                Custom domain (optional)
              </label>
              <input
                type='text'
                name='custom_domain'
                value={formData.custom_domain}
                onChange={handleInputChange}
                placeholder='app.acme.com'
                className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              />
            </div>
          </div>
        </section>

        <section className='mb-8 border-t border-border pt-6 pb-2'>
          <h2 className='mb-4 text-lg font-semibold text-textPrimary'>Owner</h2>
          <p className='mb-4 text-sm text-textSecondary'>
            Search for an existing tenant user by email or name to set as owner.
            Tenant users are created separately (e.g. from Tenant Users or when
            adding users to a tenant).
          </p>
          <div ref={ownerDropdownRef} className='relative'>
            {selectedOwner ? (
              <div className='flex items-center justify-between rounded-lg border border-border bg-bgGray px-4 py-3'>
                <div>
                  <div className='text-sm font-medium text-textPrimary'>
                    {selectedOwner.name}
                  </div>
                  <div className='text-xs text-textSecondary'>
                    {selectedOwner.email}
                  </div>
                </div>
                <button
                  type='button'
                  onClick={handleClearOwner}
                  className='rounded p-1.5 text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'
                  aria-label='Clear owner'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            ) : (
              <>
                <label className='mb-2 block text-sm font-semibold text-textPrimary'>
                  Search by email or name <span className='text-error'>*</span>
                </label>
                <input
                  type='text'
                  value={ownerSearchQuery}
                  onChange={(e) => {
                    setOwnerSearchQuery(e.target.value);
                    setOwnerDropdownOpen(true);
                  }}
                  onFocus={() => setOwnerDropdownOpen(true)}
                  placeholder='Type at least 2 characters to search...'
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                {showDropdown && (
                  <div className='absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-surface shadow-lg'>
                    {searchLoading ? (
                      <div className='flex items-center justify-center gap-2 px-4 py-6 text-sm text-textSecondary'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Searching...
                      </div>
                    ) : searchUsers.length === 0 ? (
                      <div className='px-4 py-6 text-center text-sm text-textSecondary'>
                        {ownerSearchQuery.trim().length < 2
                          ? 'Type at least 2 characters to search'
                          : 'No users found'}
                      </div>
                    ) : (
                      <div className='p-1'>
                        {searchUsers.map((user) => (
                          <button
                            key={user.id}
                            type='button'
                            onClick={() => handleSelectOwner(user)}
                            className='flex w-full flex-col rounded-md px-3 py-2.5 text-left text-sm text-textPrimary transition-colors hover:bg-bgGray'
                          >
                            <span className='font-medium'>{user.name}</span>
                            <span className='text-xs text-textSecondary'>
                              {user.email}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}
