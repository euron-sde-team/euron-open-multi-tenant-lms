'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Loader2,
  MoreVertical,
  Save,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  useAssignPermissionToRole,
  useDeleteRole,
  useGetPermissionCategories,
  useGetPermissions,
  useGetRole,
  useRevokePermissionFromRole,
  useUpdateRole,
} from '@/lib/api/hooks';

export default function RoleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params.id as string;

  const { data: role, isLoading, error } = useGetRole(roleId);
  const { data: permissionsData, isLoading: permissionsLoading } =
    useGetPermissions();
  const { data: categoriesData } = useGetPermissionCategories();

  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const assignPermission = useAssignPermissionToRole();
  const revokePermission = useRevokePermissionFromRole();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [pendingPermission, setPendingPermission] = useState<string | null>(
    null,
  );

  const permissions = permissionsData?.permissions || [];
  const categories = categoriesData?.categories || [];

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, typeof permissions> = {};
    permissions.forEach((permission) => {
      const category = permission.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(permission);
    });
    return grouped;
  }, [permissions]);

  // Get unique categories from permissions if categoriesData is empty
  const allCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    return Object.keys(permissionsByCategory).sort();
  }, [categories, permissionsByCategory]);

  // Get current role permission IDs
  const rolePermissionIds = useMemo(() => {
    return role?.permissions?.map((p) => p.id) || [];
  }, [role?.permissions]);

  // Initialize form data when role loads
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || '',
        description: role.description || '',
      });
      // Expand all categories that have permissions assigned
      const categoriesWithPermissions = allCategories.filter((cat) => {
        const categoryPermissions = permissionsByCategory[cat] || [];
        return categoryPermissions.some((p) =>
          rolePermissionIds.includes(p.id),
        );
      });
      setExpandedCategories(categoriesWithPermissions);
    }
  }, [role, allCategories, permissionsByCategory, rolePermissionIds]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Role name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await updateRole.mutateAsync({
        id: roleId,
        data: {
          name: formData.name,
          description: formData.description || undefined,
        },
      });
    } catch {
      // Error is handled by react-query
    }
  };

  const handlePermissionToggle = async (permissionId: string) => {
    if (!role) return;

    setPendingPermission(permissionId);
    try {
      if (rolePermissionIds.includes(permissionId)) {
        await revokePermission.mutateAsync({ roleId, permissionId });
      } else {
        await assignPermission.mutateAsync({ roleId, permissionId });
      }
    } catch {
      // Error is handled by react-query
    } finally {
      setPendingPermission(null);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const handleDelete = async () => {
    try {
      await deleteRole.mutateAsync(roleId);
      router.push('/roles-permissions');
    } catch {
      // Error is handled by react-query
    }
  };

  const formatCategoryName = (category: string) => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getCategorySelectionState = (category: string) => {
    const categoryPermissions = permissionsByCategory[category] || [];
    const categoryPermissionIds = categoryPermissions.map((p) => p.id);
    const selectedCount = categoryPermissionIds.filter((id) =>
      rolePermissionIds.includes(id),
    ).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === categoryPermissionIds.length) return 'all';
    return 'partial';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading role...</p>
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
            Failed to load role
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
          <Link
            href='/roles-permissions'
            className='mt-4 inline-flex items-center text-primary hover:underline'
          >
            <ArrowLeft className='mr-1 h-4 w-4' />
            Back to Roles & Permissions
          </Link>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Role not found
          </h3>
          <Link
            href='/roles-permissions'
            className='mt-4 inline-flex items-center text-primary hover:underline'
          >
            <ArrowLeft className='mr-1 h-4 w-4' />
            Back to Roles & Permissions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      <div className='mx-auto max-w-4xl'>
        {/* Header */}
        <div className='mb-8'>
          <Link
            href='/roles-permissions'
            className='mb-4 inline-flex items-center text-sm text-textSecondary hover:text-textPrimary'
          >
            <ArrowLeft className='mr-1 h-4 w-4' />
            Back to Roles & Permissions
          </Link>
          <div className='flex items-center justify-between'>
            <div>
              <div className='flex items-center gap-3'>
                <h1 className='text-2xl font-bold text-textPrimary'>
                  {role.name}
                </h1>
                {role.is_system && (
                  <span className='text-xs font-semibold text-primary'>
                    System
                  </span>
                )}
                {role.code === 'SUPERADMIN' && (
                  <span className='text-xs font-semibold text-red-600'>
                    Protected
                  </span>
                )}
              </div>
              <p className='mt-1 text-textSecondary'>
                Manage role details and permissions
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <code className='rounded bg-gray-100 px-2 py-1 text-sm text-textSecondary'>
                {role.code}
              </code>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className='mb-8 grid grid-cols-3 gap-4'>
          <div className='border-t border-border pt-4 pb-2'>
            <div className='flex items-center gap-3'>
              <div className='flex items-center h-5 w-5'>
                <Users className='h-5 w-5 text-primary' />
              </div>
              <div>
                <div className='text-2xl font-bold text-textPrimary'>
                  {role.user_count || 0}
                </div>
                <div className='text-sm text-textSecondary'>Users Assigned</div>
              </div>
            </div>
          </div>
          <div className='border-t border-border pt-4 pb-2'>
            <div className='flex items-center gap-3'>
              <div className='flex items-center h-5 w-5'>
                <Shield className='h-5 w-5 text-purple-600' />
              </div>
              <div>
                <div className='text-2xl font-bold text-textPrimary'>
                  {role.permissions?.length || 0}
                </div>
                <div className='text-sm text-textSecondary'>Permissions</div>
              </div>
            </div>
          </div>
          <div className='border-t border-border pt-4 pb-2'>
            <div className='flex items-center gap-3'>
              <div className='flex items-center h-5 w-5'>
                <Calendar className='h-5 w-5 text-green-600' />
              </div>
              <div>
                <div className='text-sm font-medium text-textPrimary'>
                  {role.created_at
                    ? new Date(role.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </div>
                <div className='text-sm text-textSecondary'>Created</div>
              </div>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-6'>
          {/* Left Column - Role Details */}
          <div className='col-span-1'>
            <form onSubmit={handleSubmit}>
              {/* Error Alert */}
              {updateRole.error && (
                <div className='mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600'>
                  <AlertCircle className='h-4 w-4 flex-shrink-0' />
                  <span>{updateRole.error.message}</span>
                </div>
              )}

              <div className='border-t border-border pt-6 pb-2'>
                <h2 className='mb-4 text-lg font-semibold text-textPrimary'>
                  Role Details
                </h2>

                <div className='space-y-4'>
                  {/* Role Code (read-only) */}
                  <div>
                    <label className='mb-1 block text-sm font-medium text-textPrimary'>
                      Role Code
                    </label>
                    <input
                      type='text'
                      value={role.code}
                      disabled
                      className='h-10 w-full cursor-not-allowed rounded-lg border border-border bg-gray-100 px-3 text-textSecondary'
                    />
                    <p className='mt-1 text-xs text-textSecondary'>
                      Code cannot be changed after creation
                    </p>
                  </div>

                  {/* Role Name */}
                  <div>
                    <label
                      htmlFor='name'
                      className='mb-1 block text-sm font-medium text-textPrimary'
                    >
                      Display Name <span className='text-red-500'>*</span>
                    </label>
                    <input
                      id='name'
                      type='text'
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className={`h-10 w-full rounded-lg border px-3 ${
                        errors.name ? 'border-red-500' : 'border-border'
                      } bg-bgGray text-textPrimary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                    />
                    {errors.name && (
                      <p className='mt-1 text-sm text-red-500'>{errors.name}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor='description'
                      className='mb-1 block text-sm font-medium text-textPrimary'
                    >
                      Description
                    </label>
                    <textarea
                      id='description'
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className='w-full rounded-lg border border-border bg-bgGray px-3 py-2 text-textPrimary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                    />
                  </div>

                  <button
                    type='submit'
                    disabled={updateRole.isLoading}
                    className='flex h-10 w-full items-center justify-center rounded-lg bg-primarySolid font-medium text-white transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {updateRole.isLoading ? (
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

              {/* Danger Zone */}
              {!role.is_system && role.code !== 'SUPERADMIN' && (
                <div className='mt-6 rounded-lg border border-red-200 bg-white p-6'>
                  <div className='mb-4 flex items-center gap-2'>
                    <AlertTriangle className='h-5 w-5 text-red-500' />
                    <h2 className='text-lg font-semibold text-red-600'>
                      Danger Zone
                    </h2>
                  </div>

                  <div className='rounded-lg border border-red-100 bg-red-50 p-4'>
                    <div className='mb-3'>
                      <div className='font-medium text-textPrimary'>
                        Delete Role
                      </div>
                      <div className='text-sm text-textSecondary'>
                        This action cannot be undone. All users will be
                        unassigned.
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={role.user_count > 0}
                      className='flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <Trash2 className='mr-1 h-4 w-4' />
                      Delete Role
                    </button>
                    {role.user_count > 0 && (
                      <p className='mt-2 text-xs text-red-600'>
                        Cannot delete role with assigned users. Remove all users
                        first.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Column - Permissions */}
          <div className='col-span-2'>
            <div className='border-t border-border pt-6 pb-2'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-textPrimary'>
                  Permissions
                </h2>
                <span className='text-sm text-textSecondary'>
                  {rolePermissionIds.length} of {permissions.length} assigned
                </span>
              </div>

              {permissionsLoading ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='h-6 w-6 animate-spin text-primary' />
                </div>
              ) : allCategories.length === 0 ? (
                <p className='py-4 text-center text-textSecondary'>
                  No permissions available
                </p>
              ) : (
                <div className='space-y-3'>
                  {allCategories.map((category) => {
                    const categoryPermissions =
                      permissionsByCategory[category] || [];
                    const isExpanded = expandedCategories.includes(category);
                    const selectionState = getCategorySelectionState(category);

                    return (
                      <div
                        key={category}
                        className='overflow-hidden rounded-lg border border-border'
                      >
                        {/* Category Header */}
                        <div
                          className='flex cursor-pointer items-center justify-between bg-bgGray p-3'
                          onClick={() => handleCategoryToggle(category)}
                        >
                          <div className='flex items-center gap-3'>
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded ${
                                selectionState === 'all'
                                  ? 'bg-green-100'
                                  : selectionState === 'partial'
                                    ? 'bg-amber-100'
                                    : 'bg-gray-100'
                              }`}
                            >
                              {selectionState === 'all' && (
                                <Check className='h-3 w-3 text-green-600' />
                              )}
                              {selectionState === 'partial' && (
                                <MoreVertical className='h-3 w-3 text-amber-600' />
                              )}
                              {selectionState === 'none' && (
                                <X className='h-3 w-3 text-gray-400' />
                              )}
                            </div>
                            <span className='font-medium text-textPrimary'>
                              {formatCategoryName(category)}
                            </span>
                            <span className='text-sm text-textSecondary'>
                              (
                              {
                                categoryPermissions.filter((p) =>
                                  rolePermissionIds.includes(p.id),
                                ).length
                              }
                              /{categoryPermissions.length})
                            </span>
                          </div>
                          <svg
                            className={`h-5 w-5 text-textSecondary transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M19 9l-7 7-7-7'
                            />
                          </svg>
                        </div>

                        {/* Category Permissions */}
                        {isExpanded && (
                          <div className='divide-y divide-border'>
                            {categoryPermissions.map((permission) => {
                              const isAssigned = rolePermissionIds.includes(
                                permission.id,
                              );
                              const isPending =
                                pendingPermission === permission.id;

                              return (
                                <div
                                  key={permission.id}
                                  className='flex items-center justify-between p-3 transition hover:bg-bgGray'
                                >
                                  <div className='flex-1'>
                                    <div className='font-medium text-textPrimary'>
                                      {permission.name}
                                    </div>
                                    <div className='text-xs text-textSecondary'>
                                      <code className='rounded bg-gray-100 px-1 py-0.5'>
                                        {permission.code}
                                      </code>
                                    </div>
                                  </div>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      handlePermissionToggle(permission.id)
                                    }
                                    disabled={isPending}
                                    className={`flex h-8 items-center rounded-lg px-3 text-sm font-medium transition ${
                                      isAssigned
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-textSecondary hover:bg-gray-200'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                                  >
                                    {isPending ? (
                                      <Loader2 className='h-4 w-4 animate-spin' />
                                    ) : isAssigned ? (
                                      <>
                                        <Check className='mr-1 h-4 w-4' />
                                        Assigned
                                      </>
                                    ) : (
                                      'Assign'
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='mx-4 w-full max-w-md rounded-lg bg-white p-6'>
            <div className='mb-4 flex items-center gap-3'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-red-100'>
                <AlertTriangle className='h-6 w-6 text-red-600' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-textPrimary'>
                  Delete Role
                </h3>
                <p className='text-sm text-textSecondary'>
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <p className='mb-6 text-textSecondary'>
              Are you sure you want to delete <strong>{role.name}</strong>? This
              will permanently remove the role from the system.
            </p>
            <div className='flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className='rounded-lg border border-border px-4 py-2 text-textPrimary transition hover:bg-bgGray'
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteRole.isLoading}
                className='rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:opacity-50'
              >
                {deleteRole.isLoading ? (
                  <>
                    <Loader2 className='mr-1 inline h-4 w-4 animate-spin' />
                    Deleting...
                  </>
                ) : (
                  'Delete Role'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
