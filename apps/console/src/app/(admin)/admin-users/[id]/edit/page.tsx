'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Save,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  useAssignRoleToUser,
  useDeactivateAdminUser,
  useGetAdminUser,
  useGetRoles,
  useRevokeRoleFromUser,
  useUpdateAdminUser,
} from '@/lib/api/hooks';

export default function EditAdminUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const { data: user, isLoading, error } = useGetAdminUser(userId);
  const { data: rolesData, isLoading: rolesLoading } = useGetRoles();
  const updateAdminUser = useUpdateAdminUser();
  const deactivateAdminUser = useDeactivateAdminUser();
  const assignRole = useAssignRoleToUser();
  const revokeRole = useRevokeRoleFromUser();

  const [formData, setFormData] = useState({
    name: '',
    avatar_url: '',
    email_verified: false,
  });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const roles = rolesData?.roles || [];

  // Initialize form data when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        avatar_url: user.avatar_url || '',
        email_verified: user.email_verified || false,
      });
      setSelectedRoleIds(user.roles?.map((r) => r.id) || []);
    }
  }, [user]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      // Update basic info
      await updateAdminUser.mutateAsync({
        id: userId,
        data: {
          name: formData.name,
          avatar_url: formData.avatar_url || undefined,
          email_verified: formData.email_verified,
        },
      });

      // Handle role changes
      const currentRoleIds = user?.roles?.map((r) => r.id) || [];
      const rolesToAdd = selectedRoleIds.filter(
        (id) => !currentRoleIds.includes(id),
      );
      const rolesToRemove = currentRoleIds.filter(
        (id) => !selectedRoleIds.includes(id),
      );

      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRole.mutateAsync({ userId, roleId });
      }

      // Remove old roles
      for (const roleId of rolesToRemove) {
        await revokeRole.mutateAsync({ userId, roleId });
      }

      router.push('/admin-users');
    } catch {
      // Error is handled by react-query
    }
  };

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  const handleDeactivate = async () => {
    try {
      await deactivateAdminUser.mutateAsync(userId);
      router.push('/admin-users');
    } catch {
      // Error is handled by react-query
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading user...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load user
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
          <Link
            href='/admin-users'
            className='mt-4 inline-flex items-center text-primary hover:underline'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            Back to Admin Users
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            User not found
          </h3>
          <Link
            href='/admin-users'
            className='mt-4 inline-flex items-center text-primary hover:underline'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            Back to Admin Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <Link
            href='/admin-users'
            className='inline-flex items-center text-sm text-textSecondary hover:text-textPrimary mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            Back to Admin Users
          </Link>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-textPrimary'>
                Edit Admin User
              </h1>
              <p className='text-textSecondary mt-1'>
                Update user information and permissions
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  user.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : user.status === 'SUSPENDED'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {user.status}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Error Alert */}
          {updateAdminUser.error && (
            <div className='mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600'>
              <AlertCircle className='h-5 w-5 flex-shrink-0' />
              <span>{updateAdminUser.error.message}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center gap-2 mb-6'>
              <User className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-textPrimary'>
                Basic Information
              </h2>
            </div>

            <div className='space-y-4'>
              {/* Name */}
              <div>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Full Name <span className='text-red-500'>*</span>
                </label>
                <input
                  id='name'
                  type='text'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder='John Doe'
                  className={`w-full h-11 px-4 rounded-lg border ${
                    errors.name ? 'border-red-500' : 'border-border'
                  } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                />
                {errors.name && (
                  <p className='mt-1 text-sm text-red-500'>{errors.name}</p>
                )}
              </div>

              {/* Email (Read-only) */}
              <div>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Email Address
                </label>
                <input
                  id='email'
                  type='email'
                  value={user.email}
                  disabled
                  className='w-full h-11 px-4 rounded-lg border border-border bg-gray-100 text-textSecondary cursor-not-allowed'
                />
                <p className='mt-1 text-xs text-textSecondary'>
                  Email cannot be changed after account creation.
                </p>
              </div>

              {/* Avatar URL */}
              <div>
                <label
                  htmlFor='avatar_url'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Avatar URL
                </label>
                <input
                  id='avatar_url'
                  type='url'
                  value={formData.avatar_url}
                  onChange={(e) =>
                    setFormData({ ...formData, avatar_url: e.target.value })
                  }
                  placeholder='https://example.com/avatar.jpg'
                  className='w-full h-11 px-4 rounded-lg border border-border bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                />
              </div>

              {/* Email Verified Toggle */}
              <div className='flex items-center justify-between p-4 rounded-lg border border-border'>
                <div>
                  <div className='font-medium text-textPrimary'>
                    Email Verified
                  </div>
                  <div className='text-sm text-textSecondary'>
                    Mark if the user&apos;s email has been verified
                  </div>
                </div>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={formData.email_verified}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email_verified: e.target.checked,
                      })
                    }
                    className='sr-only peer'
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Role Assignment */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center gap-2 mb-6'>
              <Shield className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-textPrimary'>
                Role Assignment
              </h2>
            </div>

            {rolesLoading ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='h-6 w-6 animate-spin text-primary' />
              </div>
            ) : (
              <div className='space-y-3'>
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center p-4 rounded-lg border cursor-pointer transition ${
                      selectedRoleIds.includes(role.id)
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:bg-bgGray'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => handleRoleToggle(role.id)}
                      className='w-4 h-4 text-primary border-border rounded focus:ring-primary'
                    />
                    <div className='ml-3'>
                      <div className='font-medium text-textPrimary'>
                        {role.name}
                        {role.is_system && (
                          <span className='ml-2 text-xs text-purple-700'>
                            System
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <div className='text-sm text-textSecondary'>
                          {role.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
                {roles.length === 0 && (
                  <p className='text-textSecondary text-center py-4'>
                    No roles available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className='bg-white rounded-lg border border-red-200 p-6 mb-6'>
            <div className='flex items-center gap-2 mb-4'>
              <AlertTriangle className='h-5 w-5 text-red-500' />
              <h2 className='text-lg font-semibold text-red-600'>
                Danger Zone
              </h2>
            </div>

            <div className='flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50'>
              <div>
                <div className='font-medium text-textPrimary'>
                  Deactivate User
                </div>
                <div className='text-sm text-textSecondary'>
                  This will prevent the user from accessing the system.
                </div>
              </div>
              <button
                type='button'
                onClick={() => setShowDeleteConfirm(true)}
                className='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition'
              >
                <Trash2 className='h-4 w-4 inline mr-1' />
                Deactivate
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center justify-end gap-3'>
            <Link
              href='/admin-users'
              className='h-11 px-6 flex items-center justify-center rounded-full border border-border text-textPrimary font-medium hover:bg-bgGray transition'
            >
              Cancel
            </Link>
            <button
              type='submit'
              disabled={updateAdminUser.isLoading}
              className='h-11 px-6 flex items-center justify-center rounded-full bg-primarySolid text-white font-medium hover:bg-primaryHover transition disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {updateAdminUser.isLoading ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                <>
                  <Save className='h-4 w-4 mr-2' />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-md w-full mx-4'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center'>
                <AlertTriangle className='h-6 w-6 text-red-600' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-textPrimary'>
                  Deactivate User
                </h3>
                <p className='text-sm text-textSecondary'>
                  This action cannot be undone easily.
                </p>
              </div>
            </div>
            <p className='text-textSecondary mb-6'>
              Are you sure you want to deactivate <strong>{user.name}</strong>?
              They will no longer be able to access the admin system.
            </p>
            <div className='flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className='px-4 py-2 border border-border rounded-lg text-textPrimary hover:bg-bgGray transition'
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivateAdminUser.isLoading}
                className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50'
              >
                {deactivateAdminUser.isLoading ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-1 inline animate-spin' />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
