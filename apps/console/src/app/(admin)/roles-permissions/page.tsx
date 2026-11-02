'use client';

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  Loader2,
  Lock,
  Pen,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  useCreatePermission,
  useDeletePermission,
  useGetPermissionCategories,
  useGetPermissions,
  useGetRoles,
  useUpdatePermission,
} from '@/lib/api/hooks';
import { Permission, Role } from '@/lib/api/types';

// Build dynamic permission matrix from roles and permissions
const buildPermissionMatrix = (
  roles: Role[],
  permissions: Permission[],
): {
  categories: string[];
  permissionsByCategory: Record<
    string,
    {
      id: string;
      name: string;
      code: string;
      roleAccess: Record<string, boolean>;
    }[]
  >;
} => {
  // Get unique categories
  const categoriesSet = new Set<string>();
  permissions.forEach((p) => {
    categoriesSet.add(p.category || 'other');
  });
  const categories = Array.from(categoriesSet).sort();

  // Build permissions grouped by category with role access
  const permissionsByCategory: Record<
    string,
    {
      id: string;
      name: string;
      code: string;
      roleAccess: Record<string, boolean>;
    }[]
  > = {};

  categories.forEach((cat) => {
    permissionsByCategory[cat] = permissions
      .filter((p) => (p.category || 'other') === cat)
      .map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        roleAccess: Object.fromEntries(
          roles.map((r) => [
            r.id,
            r.permissions?.some((rp) => rp.id === p.id) || false,
          ]),
        ),
      }));
  });

  return { categories, permissionsByCategory };
};

const formatCategoryName = (category: string) => {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Permission Modal Component
function PermissionModal({
  permission,
  categories,
  onClose,
  onSave,
  isLoading,
  error,
}: {
  permission: Permission | null;
  categories: string[];
  onClose: () => void;
  onSave: (data: {
    code: string;
    name: string;
    description?: string;
    category?: string;
  }) => void;
  isLoading: boolean;
  error: Error | null;
}) {
  const [formData, setFormData] = useState({
    code: permission?.code || '',
    name: permission?.name || '',
    description: permission?.description || '',
    category: permission?.category || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Permission code is required';
    } else if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/.test(formData.code)) {
      newErrors.code =
        'Code must be lowercase with format: category.action (e.g., tenants.manage)';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Permission name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSave({
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
    });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='mx-4 w-full max-w-md rounded-lg bg-white p-6'>
        <div className='mb-6 flex items-center justify-between'>
          <h3 className='text-lg font-semibold text-textPrimary'>
            {permission ? 'Edit Permission' : 'Create Permission'}
          </h3>
          <button
            onClick={onClose}
            className='text-textSecondary hover:text-textPrimary'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {error && (
          <div className='mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600'>
            <AlertCircle className='h-4 w-4 flex-shrink-0' />
            <span>{error.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='space-y-4'>
            {/* Code */}
            <div>
              <label className='mb-1 block text-sm font-medium text-textPrimary'>
                Permission Code <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toLowerCase(),
                  })
                }
                disabled={!!permission}
                placeholder='tenants.manage'
                className={`h-10 w-full rounded-lg border px-3 ${
                  errors.code ? 'border-red-500' : 'border-border'
                } ${
                  permission ? 'cursor-not-allowed bg-gray-100' : 'bg-bgGray'
                } text-textPrimary focus:border-primary focus:outline-none`}
              />
              {errors.code ? (
                <p className='mt-1 text-xs text-red-500'>{errors.code}</p>
              ) : (
                <p className='mt-1 text-xs text-textSecondary'>
                  Format: category.action (lowercase)
                </p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className='mb-1 block text-sm font-medium text-textPrimary'>
                Display Name <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder='Manage Tenants'
                className={`h-10 w-full rounded-lg border px-3 ${
                  errors.name ? 'border-red-500' : 'border-border'
                } bg-bgGray text-textPrimary focus:border-primary focus:outline-none`}
              />
              {errors.name && (
                <p className='mt-1 text-xs text-red-500'>{errors.name}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className='mb-1 block text-sm font-medium text-textPrimary'>
                Category
              </label>
              <div className='flex gap-2'>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className='h-10 flex-1 rounded-lg border border-border bg-bgGray px-3 text-textPrimary focus:border-primary focus:outline-none'
                >
                  <option value=''>Select or enter new</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {formatCategoryName(cat)}
                    </option>
                  ))}
                </select>
                <input
                  type='text'
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value.toLowerCase(),
                    })
                  }
                  placeholder='or type new'
                  className='h-10 w-32 rounded-lg border border-border bg-bgGray px-3 text-textPrimary focus:border-primary focus:outline-none'
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className='mb-1 block text-sm font-medium text-textPrimary'>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder='Describe what this permission allows...'
                rows={2}
                className='w-full rounded-lg border border-border bg-bgGray px-3 py-2 text-textPrimary focus:border-primary focus:outline-none'
              />
            </div>
          </div>

          <div className='mt-6 flex items-center justify-end gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='rounded-lg border border-border px-4 py-2 text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={isLoading}
              className='flex items-center rounded-lg bg-primarySolid px-4 py-2 text-white transition hover:bg-primaryHover disabled:opacity-50'
            >
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                <>
                  <Save className='mr-2 h-4 w-4' />
                  {permission ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RolesPermissionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('');
  const [permissionCategoryFilter, setPermissionCategoryFilter] = useState('');
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch roles and permissions using react-query
  const {
    data: rolesData,
    isLoading: rolesLoading,
    error: rolesError,
  } = useGetRoles({ search: searchQuery || undefined });

  const { data: permissionsData, isLoading: permissionsLoading } =
    useGetPermissions();

  const { data: categoriesData } = useGetPermissionCategories();

  const createPermission = useCreatePermission();
  const updatePermission = useUpdatePermission();
  const deletePermission = useDeletePermission();

  const isLoading = rolesLoading || permissionsLoading;
  const roles = rolesData?.roles || [];
  const permissions = permissionsData?.permissions || [];
  const allCategories = categoriesData?.categories || [];

  // Build dynamic permission matrix
  const { categories, permissionsByCategory } = useMemo(
    () => buildPermissionMatrix(roles, permissions),
    [roles, permissions],
  );

  // Filter categories based on module filter
  const filteredCategories = useMemo(() => {
    if (!moduleFilter) return categories;
    return categories.filter((cat) =>
      cat.toLowerCase().includes(moduleFilter.toLowerCase()),
    );
  }, [categories, moduleFilter]);

  // Filter permissions for the permissions list
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const matchesSearch =
        !permissionSearchQuery ||
        p.name.toLowerCase().includes(permissionSearchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(permissionSearchQuery.toLowerCase());

      const matchesCategory =
        !permissionCategoryFilter ||
        (p.category || 'other') === permissionCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [permissions, permissionSearchQuery, permissionCategoryFilter]);

  // Filter roles based on type
  const filteredRoles = roles.filter((role) => {
    const matchesType =
      !typeFilter ||
      (typeFilter === 'system' && role.is_system) ||
      (typeFilter === 'custom' && !role.is_system);
    return matchesType;
  });

  // Stats from API
  const stats = {
    totalRoles: rolesData?.total || roles.length,
    totalPermissions: permissionsData?.total || permissions.length,
    assignedUsers: roles.reduce((sum, r) => sum + (r.user_count || 0), 0),
    systemRoles: roles.filter((r) => r.is_system).length,
    customRoles: roles.filter((r) => !r.is_system).length,
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const expandAll = () => {
    if (expandedCategories.length === filteredCategories.length) {
      setExpandedCategories([]);
    } else {
      setExpandedCategories([...filteredCategories]);
    }
  };

  const handleCreatePermission = () => {
    setEditingPermission(null);
    setPermissionModalOpen(true);
  };

  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission);
    setPermissionModalOpen(true);
  };

  const handleSavePermission = async (data: {
    code: string;
    name: string;
    description?: string;
    category?: string;
  }) => {
    try {
      if (editingPermission) {
        await updatePermission.mutateAsync({
          id: editingPermission.id,
          data: {
            name: data.name,
            description: data.description,
            category: data.category,
          },
        });
      } else {
        await createPermission.mutateAsync(data);
      }
      setPermissionModalOpen(false);
      setEditingPermission(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeletePermission = async (id: string) => {
    try {
      await deletePermission.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch {
      // Error handled by mutation
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading roles and permissions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (rolesError) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load roles
          </h3>
          <p className='mt-2 text-textSecondary'>{rolesError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
              Roles & Permissions
            </h1>
            <p className='text-textSecondary'>
              Manage user roles and configure access permissions
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'>
              <Download className='mr-2 h-4 w-4' />
              Export Roles
            </button>
            <Link
              href='/roles-permissions/new'
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white hover:bg-primaryHover'
            >
              <Plus className='mr-2 h-4 w-4' />
              Create Role
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className='mb-8 grid grid-cols-3 gap-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <Lock className='h-5 w-5 text-primary' />
            </div>
            <span className='text-xs font-semibold text-green-600'>
              Active
            </span>
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {stats.totalRoles}
          </div>
          <div className='text-sm text-textSecondary'>Total Roles</div>
          <div className='mt-4 text-xs text-textSecondary'>
            {stats.systemRoles} system, {stats.customRoles} custom
          </div>
        </div>

        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <Shield className='h-5 w-5 text-purple-600' />
            </div>
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {stats.totalPermissions}
          </div>
          <div className='text-sm text-textSecondary'>Total Permissions</div>
          <div className='mt-4 text-xs text-textSecondary'>
            Across {categories.length} modules
          </div>
        </div>

        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center h-5 w-5'>
              <UserCog className='h-5 w-5 text-green-600' />
            </div>
          </div>
          <div className='mb-1 text-3xl font-bold text-textPrimary'>
            {stats.assignedUsers}
          </div>
          <div className='text-sm text-textSecondary'>Assigned Users</div>
          <div className='mt-4 text-xs text-textSecondary'>
            Across all roles
          </div>
        </div>
      </div>

      {/* Roles List */}
      <section className='mb-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='mb-1 text-xl font-semibold text-textPrimary'>
                All Roles
              </h2>
              <p className='text-sm text-textSecondary'>
                Manage role permissions and assignments
              </p>
            </div>
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Search roles...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='h-10 w-64 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Types</option>
                <option value='system'>System Roles</option>
                <option value='custom'>Custom Roles</option>
              </select>
            </div>
          </div>

          <div className='space-y-3'>
            {filteredRoles.length === 0 ? (
              <div className='py-12 text-center'>
                <Shield className='mx-auto h-12 w-12 text-textSecondary' />
                <p className='mt-4 text-textSecondary'>No roles found</p>
              </div>
            ) : (
              filteredRoles.map((role) => {
                const IconComponent =
                  role.code === 'SUPERADMIN' ? Crown : UserCog;
                const gradient = role.is_system
                  ? 'from-primary-500 to-primary-600'
                  : 'from-purple-500 to-purple-600';
                return (
                  <div
                    key={role.id}
                    className='rounded-lg border border-border p-5 transition hover:border-primary'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex flex-1 items-center'>
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}
                        >
                          <IconComponent className='h-5 w-5 text-white' />
                        </div>
                        <div className='ml-4 flex-1'>
                          <div className='flex items-center'>
                            <span className='text-lg font-bold text-textPrimary'>
                              {role.name}
                            </span>
                            <span
                              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                role.is_system
                                  ? 'bg-primary-50 text-primary'
                                  : 'bg-purple-50 text-purple-600'
                              }`}
                            >
                              {role.is_system ? 'System' : 'Custom'}
                            </span>
                            {role.code === 'SUPERADMIN' && (
                              <span className='ml-2 text-xs font-semibold text-red-600'>
                                Protected
                              </span>
                            )}
                          </div>
                          <p className='mt-1 text-sm text-textSecondary'>
                            {role.description || 'No description'}
                          </p>
                          <div className='mt-3 flex items-center space-x-4'>
                            <div className='flex items-center text-sm text-textSecondary'>
                              <Users className='mr-1.5 h-3 w-3' />
                              <span>{role.user_count || 0} users assigned</span>
                            </div>
                            <div className='flex items-center text-sm text-textSecondary'>
                              <Shield className='mr-1.5 h-3 w-3' />
                              <span>
                                {role.permissions?.length || 0} permissions
                              </span>
                            </div>
                            <div className='flex items-center text-sm text-textSecondary'>
                              <Calendar className='mr-1.5 h-3 w-3' />
                              <span>
                                Created{' '}
                                {role.created_at
                                  ? new Date(
                                      role.created_at,
                                    ).toLocaleDateString('en-US', {
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className='ml-4 flex items-center space-x-2'>
                        <Link
                          href={`/roles-permissions/${role.id}`}
                          className='flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Permissions Management */}
      <section className='mb-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='mb-1 text-xl font-semibold text-textPrimary'>
                All Permissions
              </h2>
              <p className='text-sm text-textSecondary'>
                Manage system permissions that can be assigned to roles
              </p>
            </div>
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Search permissions...'
                  value={permissionSearchQuery}
                  onChange={(e) => setPermissionSearchQuery(e.target.value)}
                  className='h-10 w-64 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                />
              </div>
              <select
                value={permissionCategoryFilter}
                onChange={(e) => setPermissionCategoryFilter(e.target.value)}
                className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatCategoryName(cat)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreatePermission}
                className='flex h-10 items-center rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700'
              >
                <Plus className='mr-2 h-4 w-4' />
                Add Permission
              </button>
            </div>
          </div>

          <div className='overflow-hidden rounded-lg border border-border'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                    Permission
                  </th>
                  <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                    Code
                  </th>
                  <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                    Category
                  </th>
                  <th className='px-4 py-3 text-right text-sm font-semibold text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='px-4 py-12 text-center'>
                      <Shield className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No permissions found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPermissions.map((permission) => (
                    <tr
                      key={permission.id}
                      className='border-b border-border transition hover:bg-bgGray'
                    >
                      <td className='px-4 py-3'>
                        <div className='font-medium text-textPrimary'>
                          {permission.name}
                        </div>
                        {permission.description && (
                          <div className='text-xs text-textSecondary'>
                            {permission.description}
                          </div>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        <code className='rounded bg-gray-100 px-2 py-1 text-xs text-textSecondary'>
                          {permission.code}
                        </code>
                      </td>
                      <td className='px-4 py-3'>
                        <span className='text-xs font-medium text-purple-700'>
                          {formatCategoryName(permission.category || 'other')}
                        </span>
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center justify-end space-x-2'>
                          <button
                            onClick={() => handleEditPermission(permission)}
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-primary-50 hover:text-primary'
                            title='Edit'
                          >
                            <Pen className='h-4 w-4' />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(permission.id)}
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-red-50 hover:text-red-600'
                            title='Delete'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Permission Matrix */}
      <section className='mb-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='mb-1 text-xl font-semibold text-textPrimary'>
                Permission Matrix
              </h2>
              <p className='text-sm text-textSecondary'>
                View and compare permissions across all roles
              </p>
            </div>
            <div className='flex items-center space-x-3'>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className='h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Modules</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatCategoryName(cat)}
                  </option>
                ))}
              </select>
              <button
                onClick={expandAll}
                className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                {expandedCategories.length === filteredCategories.length ? (
                  <>
                    <ChevronUp className='mr-2 h-4 w-4' />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronDown className='mr-2 h-4 w-4' />
                    Expand All
                  </>
                )}
              </button>
            </div>
          </div>

          {roles.length === 0 || permissions.length === 0 ? (
            <div className='py-12 text-center'>
              <Shield className='mx-auto h-12 w-12 text-textSecondary' />
              <p className='mt-4 text-textSecondary'>
                {roles.length === 0
                  ? 'No roles available'
                  : 'No permissions available'}
              </p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b-2 border-border'>
                    <th className='sticky left-0 z-10 min-w-[200px] bg-bgGray px-4 py-4 text-left text-sm font-semibold text-textPrimary'>
                      Permission
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role.id}
                        className='bg-bgGray px-3 py-4 text-center text-xs font-semibold text-textPrimary'
                      >
                        <div className='flex flex-col items-center'>
                          {role.code === 'SUPERADMIN' ? (
                            <Crown className='mb-1 h-4 w-4 text-primary' />
                          ) : (
                            <UserCog className='mb-1 h-4 w-4 text-purple-600' />
                          )}
                          <span className='max-w-[80px] truncate'>
                            {role.name}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => {
                    const categoryPermissions =
                      permissionsByCategory[category] || [];
                    const isExpanded = expandedCategories.includes(category);

                    return (
                      <>
                        {/* Category Header */}
                        <tr
                          key={`cat-${category}`}
                          className='cursor-pointer border-b border-border'
                          onClick={() => toggleCategory(category)}
                        >
                          <td
                            colSpan={roles.length + 1}
                            className='bg-bgGray px-4 py-3'
                          >
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center'>
                                <Shield className='mr-2 h-4 w-4 text-textSecondary' />
                                <span className='font-semibold text-textPrimary'>
                                  {formatCategoryName(category)}
                                </span>
                                <span className='ml-2 text-sm text-textSecondary'>
                                  ({categoryPermissions.length} permissions)
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className='h-4 w-4 text-textSecondary' />
                              ) : (
                                <ChevronDown className='h-4 w-4 text-textSecondary' />
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Permission Rows */}
                        {isExpanded &&
                          categoryPermissions.map((perm) => (
                            <tr
                              key={perm.id}
                              className='border-b border-border hover:bg-bgGray'
                            >
                              <td className='sticky left-0 bg-surface px-4 py-3'>
                                <div className='text-sm font-medium text-textPrimary'>
                                  {perm.name}
                                </div>
                                <div className='text-xs text-textSecondary'>
                                  <code className='rounded bg-gray-100 px-1 py-0.5'>
                                    {perm.code}
                                  </code>
                                </div>
                              </td>
                              {roles.map((role) => (
                                <td
                                  key={role.id}
                                  className='px-3 py-3 text-center'
                                >
                                  {perm.roleAccess[role.id] ? (
                                    <Check className='mx-auto h-4 w-4 text-green-600' />
                                  ) : (
                                    <X className='mx-auto h-4 w-4 text-gray-300' />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Permission Modal */}
      {permissionModalOpen && (
        <PermissionModal
          permission={editingPermission}
          categories={allCategories.length > 0 ? allCategories : categories}
          onClose={() => {
            setPermissionModalOpen(false);
            setEditingPermission(null);
          }}
          onSave={handleSavePermission}
          isLoading={createPermission.isLoading || updatePermission.isLoading}
          error={createPermission.error || updatePermission.error}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='mx-4 w-full max-w-md rounded-lg bg-white p-6'>
            <div className='mb-4 flex items-center gap-3'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-red-100'>
                <AlertTriangle className='h-6 w-6 text-red-600' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-textPrimary'>
                  Delete Permission
                </h3>
                <p className='text-sm text-textSecondary'>
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <p className='mb-6 text-textSecondary'>
              Are you sure you want to delete this permission? It will be
              removed from all roles that currently have it.
            </p>
            <div className='flex items-center justify-end gap-3'>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className='rounded-lg border border-border px-4 py-2 text-textPrimary transition hover:bg-bgGray'
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePermission(deleteConfirmId)}
                disabled={deletePermission.isLoading}
                className='rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:opacity-50'
              >
                {deletePermission.isLoading ? (
                  <>
                    <Loader2 className='mr-1 inline h-4 w-4 animate-spin' />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
