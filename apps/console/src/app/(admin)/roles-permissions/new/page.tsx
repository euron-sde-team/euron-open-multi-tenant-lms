'use client';

import {
  AlertCircle,
  ArrowLeft,
  Info,
  Loader2,
  Save,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  useCreateRole,
  useGetPermissionCategories,
  useGetPermissions,
} from '@/lib/api/hooks';

export default function CreateRolePage() {
  const router = useRouter();
  const createRole = useCreateRole();
  const { data: permissionsData, isLoading: permissionsLoading } =
    useGetPermissions();
  const { data: categoriesData } = useGetPermissionCategories();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissionIds: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Role code is required';
    } else if (!/^[A-Z][A-Z0-9_]*$/.test(formData.code)) {
      newErrors.code =
        'Code must start with uppercase letter and contain only uppercase letters, numbers, and underscores';
    }

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
      await createRole.mutateAsync({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        permissionIds:
          formData.permissionIds.length > 0
            ? formData.permissionIds
            : undefined,
      });
      router.push('/roles-permissions');
    } catch {
      // Error is handled by react-query
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const handleSelectAllInCategory = (category: string) => {
    const categoryPermissions = permissionsByCategory[category] || [];
    const categoryPermissionIds = categoryPermissions.map((p) => p.id);
    const allSelected = categoryPermissionIds.every((id) =>
      formData.permissionIds.includes(id),
    );

    if (allSelected) {
      // Deselect all in category
      setFormData((prev) => ({
        ...prev,
        permissionIds: prev.permissionIds.filter(
          (id) => !categoryPermissionIds.includes(id),
        ),
      }));
    } else {
      // Select all in category
      setFormData((prev) => ({
        ...prev,
        permissionIds: Array.from(
          new Set([...prev.permissionIds, ...categoryPermissionIds]),
        ),
      }));
    }
  };

  const getCategorySelectionState = (category: string) => {
    const categoryPermissions = permissionsByCategory[category] || [];
    const categoryPermissionIds = categoryPermissions.map((p) => p.id);
    const selectedCount = categoryPermissionIds.filter((id) =>
      formData.permissionIds.includes(id),
    ).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === categoryPermissionIds.length) return 'all';
    return 'partial';
  };

  const formatCategoryName = (category: string) => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className='p-8'>
      <div className='mx-auto max-w-2xl'>
        {/* Header */}
        <div className='mb-8'>
          <Link
            href='/roles-permissions'
            className='mb-4 inline-flex items-center text-sm text-textSecondary hover:text-textPrimary'
          >
            <ArrowLeft className='mr-1 h-4 w-4' />
            Back to Roles & Permissions
          </Link>
          <h1 className='text-2xl font-bold text-textPrimary'>Create Role</h1>
          <p className='mt-1 text-textSecondary'>
            Define a new role with specific permissions
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Error Alert */}
          {createRole.error && (
            <div className='mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600'>
              <AlertCircle className='h-5 w-5 flex-shrink-0' />
              <span>{createRole.error.message}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center gap-2'>
              <Shield className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-textPrimary'>
                Role Information
              </h2>
            </div>

            <div className='space-y-4'>
              {/* Role Code */}
              <div>
                <label
                  htmlFor='code'
                  className='mb-1 block text-sm font-medium text-textPrimary'
                >
                  Role Code <span className='text-red-500'>*</span>
                </label>
                <input
                  id='code'
                  type='text'
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder='BILLING_MANAGER'
                  className={`h-11 w-full rounded-lg border px-4 ${
                    errors.code ? 'border-red-500' : 'border-border'
                  } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                />
                {errors.code ? (
                  <p className='mt-1 text-sm text-red-500'>{errors.code}</p>
                ) : (
                  <p className='mt-1 text-xs text-textSecondary'>
                    Uppercase letters, numbers, and underscores only (e.g.,
                    BILLING_MANAGER)
                  </p>
                )}
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
                  placeholder='Billing Manager'
                  className={`h-11 w-full rounded-lg border px-4 ${
                    errors.name ? 'border-red-500' : 'border-border'
                  } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
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
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder='Describe the purpose of this role...'
                  rows={3}
                  className='w-full rounded-lg border border-border bg-bgGray px-4 py-3 text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                />
              </div>
            </div>
          </div>

          {/* Permission Assignment */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Shield className='h-5 w-5 text-primary' />
                <h2 className='text-lg font-semibold text-textPrimary'>
                  Permissions
                </h2>
              </div>
              <span className='text-sm text-textSecondary'>
                {formData.permissionIds.length} selected
              </span>
            </div>

            {/* Info banner */}
            <div className='mb-4 flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3'>
              <Info className='mt-0.5 h-4 w-4 flex-shrink-0 text-primary' />
              <p className='text-sm text-primary'>
                Select the permissions this role should have. You can also
                modify permissions after creating the role.
              </p>
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
                        className='flex cursor-pointer items-center justify-between bg-bgGray p-4'
                        onClick={() => handleCategoryToggle(category)}
                      >
                        <div className='flex items-center gap-3'>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAllInCategory(category);
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              selectionState === 'all'
                                ? 'border-primary bg-primary text-white'
                                : selectionState === 'partial'
                                  ? 'border-primary bg-primary/20'
                                  : 'border-gray-300 bg-white'
                            }`}
                          >
                            {selectionState === 'all' && (
                              <svg
                                className='h-3 w-3'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={3}
                                  d='M5 13l4 4L19 7'
                                />
                              </svg>
                            )}
                            {selectionState === 'partial' && (
                              <svg
                                className='h-3 w-3 text-primary'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={3}
                                  d='M20 12H4'
                                />
                              </svg>
                            )}
                          </button>
                          <span className='font-medium text-textPrimary'>
                            {formatCategoryName(category)}
                          </span>
                          <span className='text-sm text-textSecondary'>
                            ({categoryPermissions.length})
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
                          {categoryPermissions.map((permission) => (
                            <label
                              key={permission.id}
                              className='flex cursor-pointer items-center gap-3 p-4 transition hover:bg-bgGray'
                            >
                              <input
                                type='checkbox'
                                checked={formData.permissionIds.includes(
                                  permission.id,
                                )}
                                onChange={() =>
                                  handlePermissionToggle(permission.id)
                                }
                                className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                              />
                              <div className='flex-1'>
                                <div className='font-medium text-textPrimary'>
                                  {permission.name}
                                </div>
                                {permission.description && (
                                  <div className='text-sm text-textSecondary'>
                                    {permission.description}
                                  </div>
                                )}
                                <div className='mt-1 text-xs text-textSecondary'>
                                  <code className='rounded bg-gray-100 px-1.5 py-0.5'>
                                    {permission.code}
                                  </code>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className='flex items-center justify-end gap-3'>
            <Link
              href='/roles-permissions'
              className='flex h-11 items-center justify-center rounded-full border border-border px-6 font-medium text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </Link>
            <button
              type='submit'
              disabled={createRole.isLoading}
              className='flex h-11 items-center justify-center rounded-full bg-primarySolid px-6 font-medium text-white transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
            >
              {createRole.isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                <>
                  <Save className='mr-2 h-4 w-4' />
                  Create Role
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
