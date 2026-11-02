'use client';

import {
  Briefcase,
  Check,
  Loader2,
  Mail,
  Plus,
  Shield,
  User,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import {
  useGetStaffMemberDetails,
  useUpdateStaffMember,
} from '@/lib/api/hooks/useStaff';
import { useGetTenantRoles } from '@/lib/api/hooks/useTenants';
import {
  useAssignRoleToTenantUser,
  useRevokeRoleFromTenantUser,
} from '@/lib/api/hooks/useTenantUsers';
import {
  GlobalStaffMemberDetailsResponse,
  UpdateTenantUserRequest,
} from '@/lib/api/types';

import SideDrawer from '@/components/common/SideDrawer';
import StatusBadge from '@/components/common/StatusBadge';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

interface MemberDetailsDrawerProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MemberDetailsDrawer({
  userId,
  isOpen,
  onClose,
}: MemberDetailsDrawerProps) {
  const { data: user, isLoading: isLoadingUser } =
    useGetStaffMemberDetails(userId);

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title='Staff Member Details'
      description='View and manage staff member roles across tenants'
      width='lg'
    >
      {isLoadingUser ? (
        <div className='flex h-64 items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      ) : user ? (
        <div className='space-y-8'>
          {/* User Profile Header */}
          <div className='flex items-center gap-4'>
            <div className='relative h-16 w-16 overflow-hidden rounded-full bg-bgGray'>
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name}
                  fill
                  className='object-cover'
                />
              ) : (
                <div className='flex h-full w-full items-center justify-center text-textSecondary'>
                  <User className='h-8 w-8' />
                </div>
              )}
            </div>
            <div>
              <h3 className='text-xl font-semibold text-textPrimary'>
                {user.name}
              </h3>
              <p className='text-sm text-textSecondary'>{user.email}</p>
              <div className='mt-2 flex items-center gap-2'>
                <StatusBadge status={user.status} />
                <span className='text-xs text-textSecondary'>
                  ID: {user.id}
                </span>
              </div>
            </div>
          </div>

          <EditContactInfo user={user} />

          <div className='border-t border-border pt-6'>
            <h4 className='mb-4 flex items-center gap-2 text-md font-semibold text-textPrimary'>
              <Briefcase className='h-4 w-4' />
              Tenant Memberships ({user.memberships.length})
            </h4>

            {user.memberships.length === 0 ? (
              <p className='text-sm text-textSecondary'>
                This user is not a member of any tenants.
              </p>
            ) : (
              <div className='space-y-4'>
                {user.memberships.map((membership) => (
                  <MembershipCard
                    key={membership.id}
                    userId={user.id}
                    membership={membership}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className='py-8 text-center text-textSecondary'>
          User not found
        </div>
      )}
    </SideDrawer>
  );
}

function MembershipCard({
  userId,
  membership,
}: {
  userId: string;
  membership: GlobalStaffMemberDetailsResponse['memberships'][0];
}) {
  const [isAddingRole, setIsAddingRole] = useState(false);

  const assignRoleMutation = useAssignRoleToTenantUser();
  const revokeRoleMutation = useRevokeRoleFromTenantUser();

  const handleRemoveRole = async (roleId: string) => {
    if (confirm('Are you sure you want to remove this role?')) {
      try {
        await revokeRoleMutation.mutateAsync({
          tenantId: membership.tenant_id,
          userId,
          roleId,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to remove role:', error);
        alert('Failed to remove role');
      }
    }
  };

  const handleAssignRole = async (roleId: string) => {
    try {
      await assignRoleMutation.mutateAsync({
        tenantId: membership.tenant_id,
        userId,
        roleId,
      });
      setIsAddingRole(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to assign role:', error);
      alert('Failed to assign role');
    }
  };

  const isPending =
    assignRoleMutation.isLoading || revokeRoleMutation.isLoading;

  return (
    <div className='rounded-lg border border-border bg-bgGray/30 p-4 transition-all hover:bg-bgGray/50'>
      <div className='mb-3 flex items-start justify-between'>
        <div>
          <h5 className='font-semibold text-textPrimary'>
            {membership.tenant_name}
          </h5>
          <div className='flex items-center gap-2 text-xs text-textSecondary'>
            <span>{membership.tenant_slug}</span>
            <span>•</span>
            <span>
              Joined{' '}
              {new Date(membership.joined_at || new Date()).toLocaleDateString(
                'en-US',
                { month: 'short', day: 'numeric', year: 'numeric' },
              )}
            </span>
          </div>
        </div>
        <StatusBadge status={membership.status} showDot={false} />
      </div>

      <div className='space-y-2'>
        <label className='text-xs font-medium uppercase tracking-wider text-textSecondary'>
          Roles
        </label>
        <div className='flex flex-wrap gap-2'>
          {membership.roles.map((role) => (
            <div
              key={role.id}
              className='flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-textPrimary shadow-sm'
            >
              <Shield className='h-3 w-3 text-primary' />
              {role.name}
              <button
                onClick={() => handleRemoveRole(role.id)}
                disabled={isPending}
                className='ml-1 rounded-full p-0.5 text-textSecondary hover:bg-red-50 hover:text-red-600 disabled:opacity-50'
                title='Remove role'
              >
                <X className='h-3 w-3' />
              </button>
            </div>
          ))}

          {isAddingRole ? (
            <AddRoleSelect
              tenantId={membership.tenant_id}
              currentRoleIds={membership.roles.map((r) => r.id)}
              onSelect={handleAssignRole}
              onCancel={() => setIsAddingRole(false)}
              isLoading={isPending}
            />
          ) : (
            <button
              onClick={() => setIsAddingRole(true)}
              className='flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs font-medium text-textSecondary hover:border-primary hover:text-primary'
            >
              <Plus className='h-3 w-3' />
              Add Role
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddRoleSelect({
  currentRoleIds,
  onSelect,
  onCancel,
  isLoading: isSubmitting,
}: {
  tenantId: string;
  currentRoleIds: string[];
  onSelect: (roleId: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { data: roles, isLoading: isLoadingRoles } = useGetTenantRoles();
  const [selectedRole, setSelectedRole] = useState('');

  const availableRoles =
    roles?.filter((r) => !currentRoleIds.includes(r.id)) || [];

  if (isLoadingRoles) {
    return (
      <div className='flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-xs text-textSecondary'>
        <Loader2 className='h-3 w-3 animate-spin' />
        Loading roles...
      </div>
    );
  }

  const handleConfirm = () => {
    if (selectedRole) {
      onSelect(selectedRole);
    }
  };

  return (
    <div className='flex items-center gap-2'>
      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        disabled={isSubmitting}
        className='h-7 rounded-md border border-border bg-white px-2 py-0 text-xs text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50'
        autoFocus
      >
        <option value=''>Select role...</option>
        {availableRoles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleConfirm}
        disabled={!selectedRole || isSubmitting}
        className='rounded-md bg-primary/10 p-1 text-primary hover:bg-primary/20 disabled:opacity-50'
      >
        {isSubmitting ? (
          <Loader2 className='h-3 w-3 animate-spin' />
        ) : (
          <Check className='h-3 w-3' />
        )}
      </button>

      <button
        onClick={onCancel}
        disabled={isSubmitting}
        className='rounded-md hover:bg-bgGray p-1 text-textSecondary'
      >
        <X className='h-3 w-3' />
      </button>
    </div>
  );
}

function EditContactInfo({ user }: { user: GlobalStaffMemberDetailsResponse }) {
  const updateMutation = useUpdateStaffMember();
  const initialEmail = user.email ?? '';
  const initialPhone = user.phone ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(initialEmail);
    setPhone(initialPhone);
    setError(null);
    setSuccessMessage(null);
  }, [user.id, initialEmail, initialPhone]);

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  const emailChanged = trimmedEmail !== initialEmail.toLowerCase();
  const phoneChanged = trimmedPhone !== initialPhone;
  const isDirty = emailChanged || phoneChanged;

  const payload = useMemo<UpdateTenantUserRequest>(() => {
    const body: UpdateTenantUserRequest = {};
    if (emailChanged) body.email = trimmedEmail;
    if (phoneChanged) body.phone = trimmedPhone === '' ? null : trimmedPhone;
    return body;
  }, [emailChanged, phoneChanged, trimmedEmail, trimmedPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

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
    if (!isDirty) return;

    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        data: payload,
      });
      setSuccessMessage('Contact info updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className='border-t border-border pt-6'>
      <h4 className='mb-4 flex items-center gap-2 text-md font-semibold text-textPrimary'>
        <Mail className='h-4 w-4' />
        Edit contact info
      </h4>

      {error && (
        <div className='mb-4 rounded-lg border border-error/30 bg-red-50 px-4 py-3 text-sm text-error'>
          {error}
        </div>
      )}

      {successMessage && !error && (
        <div className='mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700'>
          {successMessage}
        </div>
      )}

      <div className='space-y-4'>
        <div>
          <label className='mb-2 block text-sm font-semibold text-textPrimary'>
            Email
          </label>
          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={updateMutation.isLoading}
            placeholder='user@example.com'
            className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60'
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
            disabled={updateMutation.isLoading}
            placeholder='+15555550100'
            className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60'
          />
          <p className='mt-1.5 text-xs text-textSecondary'>
            Leave empty to clear. Changing the phone will mark it as unverified.
          </p>
        </div>
      </div>

      <div className='mt-5 flex items-center justify-end'>
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
  );
}
