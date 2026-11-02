'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useUpdateTenantUser } from '@/lib/api/hooks/useTenantUsers';
import { GlobalMember, UpdateTenantUserRequest } from '@/lib/api/types';

import SideDrawer from '@/components/common/SideDrawer';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

interface EditTenantUserDrawerProps {
  target: GlobalMember | null;
  onClose: () => void;
}

export default function EditTenantUserDrawer({
  target,
  onClose,
}: EditTenantUserDrawerProps) {
  const updateMutation = useUpdateTenantUser();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const initialEmail = target?.email ?? '';
  const initialPhone = target?.phone ?? '';

  useEffect(() => {
    if (target) {
      setEmail(initialEmail);
      setPhone(initialPhone);
      setError(null);
    }
  }, [target, initialEmail, initialPhone]);

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  const emailChanged = target
    ? trimmedEmail !== (target.email ?? '').toLowerCase()
    : false;
  const phoneChanged = target ? trimmedPhone !== (target.phone ?? '') : false;
  const isDirty = emailChanged || phoneChanged;

  const payload = useMemo<UpdateTenantUserRequest>(() => {
    const body: UpdateTenantUserRequest = {};
    if (emailChanged) body.email = trimmedEmail;
    if (phoneChanged) body.phone = trimmedPhone === '' ? null : trimmedPhone;
    return body;
  }, [emailChanged, phoneChanged, trimmedEmail, trimmedPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setError(null);

    if (emailChanged && !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (
      phoneChanged &&
      trimmedPhone !== '' &&
      !PHONE_REGEX.test(trimmedPhone)
    ) {
      setError('Phone must be 7–15 digits and may start with +.');
      return;
    }
    if (!isDirty) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        tenantId: target.tenant_id,
        userId: target.id,
        data: payload,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    }
  };

  const description = target
    ? `${target.name}${target.tenant_name ? ` · ${target.tenant_name}` : ''}`
    : undefined;

  return (
    <SideDrawer
      isOpen={!!target}
      onClose={onClose}
      title='Edit contact info'
      description={description}
      width='md'
    >
      <form onSubmit={handleSubmit} className='flex h-full flex-col'>
        <div className='flex-1 space-y-5'>
          {error && (
            <div className='rounded-lg border border-error/30 bg-red-50 px-4 py-3 text-sm text-error'>
              {error}
            </div>
          )}

          <div>
            <label className='mb-2 block text-sm font-semibold text-textPrimary'>
              Email
            </label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='user@example.com'
              className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
            {emailChanged && (
              <p className='mt-1.5 text-xs text-textSecondary'>
                Changing the email will mark it as unverified.
              </p>
            )}
          </div>

          <div>
            <label className='mb-2 block text-sm font-semibold text-textPrimary'>
              Phone
            </label>
            <input
              type='tel'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='+15555550100'
              className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
            <p className='mt-1.5 text-xs text-textSecondary'>
              Leave empty to clear. Changing the phone will mark it as
              unverified.
            </p>
          </div>
        </div>

        <div className='mt-6 flex items-center justify-end gap-3 border-t border-border pt-4'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={!isDirty || updateMutation.isLoading}
            className='flex items-center rounded-full bg-primarySolid px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-50'
          >
            {updateMutation.isLoading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
