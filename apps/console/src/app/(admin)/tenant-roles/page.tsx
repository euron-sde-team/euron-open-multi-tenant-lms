'use client';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useCreateTenantPermission,
  useCreateTenantRole,
  useDeleteTenantPermission,
  useGetRolePermissions,
  useGetTenantPermissionCategories,
  useGetTenantPermissions,
  useGetTenantRoles,
  useSetRolePermissions,
  useUpdateTenantPermission,
  useUpdateTenantRole,
} from '@/lib/api/hooks';
import type {
  CreateTenantPermissionRequest,
  CreateTenantRoleRequest,
  TenantPermission,
  TenantRole,
} from '@/lib/api/types';

import PageHeader from '@/components/common/PageHeader';

type Tab = 'roles' | 'permissions';

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------

export default function TenantRoleManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('roles');

  return (
    <div className='p-8'>
      <PageHeader
        title='Tenant Roles & Permissions'
        description='Define roles and their permissions for tenant staff. Changes apply to all tenants immediately.'
        breadcrumbs={[
          { label: 'Tenants', href: '/tenants' },
          { label: 'Roles & Permissions' },
        ]}
      />

      {/* Tab Switcher */}
      <div className='mb-6 flex gap-1 rounded-lg border border-border bg-bgGray p-1'>
        <button
          type='button'
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'roles'
              ? 'bg-white text-textPrimary shadow-sm'
              : 'text-textSecondary hover:text-textPrimary'
          }`}
        >
          <ShieldCheck className='h-4 w-4' />
          Roles
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'permissions'
              ? 'bg-white text-textPrimary shadow-sm'
              : 'text-textSecondary hover:text-textPrimary'
          }`}
        >
          <Shield className='h-4 w-4' />
          Permissions
        </button>
      </div>

      {activeTab === 'roles' ? <RolesTab /> : <PermissionsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROLES TAB
// ---------------------------------------------------------------------------

function RolesTab() {
  const { data: roles, isLoading } = useGetTenantRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<TenantRole | null>(null);

  const rolesList = roles ?? [];

  return (
    <div className='flex gap-6'>
      {/* Role List */}
      <div className='w-80 flex-shrink-0'>
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='text-sm font-semibold uppercase text-textSecondary'>
            Roles ({rolesList.length})
          </h3>
          <button
            type='button'
            onClick={() => setCreateModalOpen(true)}
            className='inline-flex items-center gap-1 rounded-full bg-primarySolid px-3 py-1.5 text-xs font-semibold text-white hover:bg-primaryHover'
          >
            <Plus className='h-3 w-3' />
            New
          </button>
        </div>

        {isLoading ? (
          <div className='rounded-lg border border-border bg-bgGray py-8 text-center'>
            <div className='inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          </div>
        ) : (
          <div className='space-y-1'>
            {rolesList.map((role) => (
              <button
                key={role.id}
                type='button'
                onClick={() => setSelectedRoleId(role.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedRoleId === role.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-bgGray'
                }`}
              >
                <div>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium text-textPrimary'>
                      {role.name}
                    </span>
                    {role.is_system && (
                      <span className='rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-warning'>
                        SYSTEM
                      </span>
                    )}
                  </div>
                  <span className='text-xs text-textSecondary'>
                    {role.code}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingRole(role);
                  }}
                  className='rounded p-1 text-textSecondary hover:bg-bgGray hover:text-textPrimary'
                >
                  <Pencil className='h-3.5 w-3.5' />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Permission Matrix Panel */}
      <div className='min-w-0 flex-1'>
        {selectedRoleId ? (
          <RolePermissionMatrix roleId={selectedRoleId} />
        ) : (
          <div className='flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-textSecondary'>
            Select a role to manage its permissions
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <CreateRoleModal onClose={() => setCreateModalOpen(false)} />
      )}

      {/* Edit Modal */}
      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROLE PERMISSION MATRIX
// ---------------------------------------------------------------------------

function RolePermissionMatrix({ roleId }: { roleId: string }) {
  const {
    data: roleData,
    isLoading: roleLoading,
    error: roleError,
  } = useGetRolePermissions(roleId);
  const {
    data: allPermissions,
    isLoading: permsLoading,
    error: permsError,
  } = useGetTenantPermissions();
  const setPermissionsMutation = useSetRolePermissions();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  // Sync selectedIds with server data
  useEffect(() => {
    if (roleData) {
      setSelectedIds(new Set(roleData.permissions.map((p) => p.id)));
      setIsDirty(false);
    }
  }, [roleData]);

  // Expand all categories by default
  useEffect(() => {
    if (allPermissions) {
      const cats = new Set(
        allPermissions
          .map((p) => p.category)
          .filter((c): c is string => c !== null),
      );
      setExpandedCategories(cats);
    }
  }, [allPermissions]);

  // Group permissions by category
  const grouped = useMemo(() => {
    if (!allPermissions) return new Map<string, TenantPermission[]>();
    const map = new Map<string, TenantPermission[]>();
    for (const p of allPermissions) {
      const cat = p.category ?? 'other';
      const arr = map.get(cat) ?? [];
      arr.push(p);
      map.set(cat, arr);
    }
    return map;
  }, [allPermissions]);

  const togglePermission = useCallback((permId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setIsDirty(true);
  }, []);

  const toggleCategory = useCallback(
    (category: string) => {
      const perms = grouped.get(category) ?? [];
      const allSelected = perms.every((p) => selectedIds.has(p.id));

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of perms) {
          if (allSelected) next.delete(p.id);
          else next.add(p.id);
        }
        return next;
      });
      setIsDirty(true);
    },
    [grouped, selectedIds],
  );

  const toggleCategoryExpansion = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleSave = async () => {
    await setPermissionsMutation.mutateAsync({
      roleId,
      permissionIds: Array.from(selectedIds),
    });
    setIsDirty(false);
  };

  if (roleLoading || permsLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent' />
      </div>
    );
  }

  if (roleError || permsError) {
    return (
      <div className='flex h-64 items-center justify-center rounded-lg border border-destructive/20 bg-red-50'>
        <p className='text-sm text-destructive'>
          Failed to load permissions. Please try again.
        </p>
      </div>
    );
  }

  if (!roleData) return null;

  return (
    <div>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold text-textPrimary'>
            {roleData.name}
            {roleData.is_system && (
              <span className='ml-2 text-xs font-normal text-textSecondary'>
                (system role)
              </span>
            )}
          </h3>
          <p className='text-sm text-textSecondary'>
            {selectedIds.size} of {allPermissions?.length ?? 0} permissions
            selected
          </p>
        </div>
        {isDirty && (
          <button
            type='button'
            onClick={handleSave}
            disabled={setPermissionsMutation.isLoading}
            className='inline-flex items-center gap-2 rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
          >
            {setPermissionsMutation.isLoading ? (
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
            ) : (
              <Check className='h-4 w-4' />
            )}
            Save Changes
          </button>
        )}
      </div>

      <div className='max-h-[calc(100vh-320px)] overflow-y-auto rounded-lg border border-border'>
        {Array.from(grouped.entries()).map(([category, perms]) => {
          const allChecked = perms.every((p) => selectedIds.has(p.id));
          const someChecked =
            !allChecked && perms.some((p) => selectedIds.has(p.id));
          const isExpanded = expandedCategories.has(category);
          const checkedCount = perms.filter((p) =>
            selectedIds.has(p.id),
          ).length;

          return (
            <div
              key={category}
              className='border-b border-border last:border-b-0'
            >
              {/* Category Header */}
              <div
                className='flex cursor-pointer items-center gap-3 bg-bgGray px-4 py-2.5 hover:bg-gray-100'
                onClick={() => toggleCategoryExpansion(category)}
              >
                {isExpanded ? (
                  <ChevronDown className='h-4 w-4 text-textSecondary' />
                ) : (
                  <ChevronRight className='h-4 w-4 text-textSecondary' />
                )}

                <label
                  className='flex items-center gap-2'
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type='checkbox'
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={() => toggleCategory(category)}
                    className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
                  />
                  <span className='text-sm font-semibold capitalize text-textPrimary'>
                    {category.replace(/_/g, ' ')}
                  </span>
                </label>

                <span className='ml-auto text-xs text-textSecondary'>
                  {checkedCount}/{perms.length}
                </span>
              </div>

              {/* Permission Rows */}
              {isExpanded && (
                <div className='divide-y divide-border/50'>
                  {perms.map((perm) => (
                    <label
                      key={perm.id}
                      className='flex cursor-pointer items-center gap-3 px-4 py-2 pl-12 hover:bg-bgGray'
                    >
                      <input
                        type='checkbox'
                        checked={selectedIds.has(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
                      />
                      <div className='min-w-0 flex-1'>
                        <span className='text-sm text-textPrimary'>
                          {perm.name}
                        </span>
                        <span className='ml-2 text-xs text-textSecondary'>
                          {perm.code}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PERMISSIONS TAB
// ---------------------------------------------------------------------------

function PermissionsTab() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const { data: permissions, isLoading } = useGetTenantPermissions({
    category: categoryFilter || undefined,
    search: search || undefined,
  });
  const { data: allCategories = [] } = useGetTenantPermissionCategories();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] =
    useState<TenantPermission | null>(null);
  const [deletingPermission, setDeletingPermission] =
    useState<TenantPermission | null>(null);

  const grouped = useMemo(() => {
    if (!permissions) return new Map<string, TenantPermission[]>();
    const map = new Map<string, TenantPermission[]>();
    for (const p of permissions) {
      const cat = p.category ?? 'other';
      const arr = map.get(cat) ?? [];
      arr.push(p);
      map.set(cat, arr);
    }
    return map;
  }, [permissions]);

  return (
    <div>
      {/* Filters */}
      <div className='mb-4 flex gap-3'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search permissions...'
            className='w-full rounded-lg border border-border bg-white py-2 pl-10 pr-3 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
        >
          <option value=''>All Categories</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <button
          type='button'
          onClick={() => setCreateModalOpen(true)}
          className='inline-flex items-center gap-1.5 rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover'
        >
          <Plus className='h-4 w-4' />
          Add Permission
        </button>
      </div>

      {/* Stats */}
      <div className='mb-4 flex gap-4'>
        <div className='rounded-lg border border-border bg-white px-4 py-3'>
          <p className='text-2xl font-bold text-textPrimary'>
            {permissions?.length ?? 0}
          </p>
          <p className='text-xs text-textSecondary'>Total Permissions</p>
        </div>
        <div className='rounded-lg border border-border bg-white px-4 py-3'>
          <p className='text-2xl font-bold text-textPrimary'>
            {allCategories.length}
          </p>
          <p className='text-xs text-textSecondary'>Categories</p>
        </div>
      </div>

      {/* Permission List */}
      {isLoading ? (
        <div className='py-12 text-center'>
          <div className='inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent' />
        </div>
      ) : (
        <div className='rounded-lg border border-border'>
          {Array.from(grouped.entries()).map(([category, perms]) => (
            <div
              key={category}
              className='border-b border-border last:border-b-0'
            >
              <div className='bg-bgGray px-4 py-2'>
                <span className='text-xs font-semibold uppercase text-textSecondary'>
                  {category.replace(/_/g, ' ')} ({perms.length})
                </span>
              </div>
              <div className='divide-y divide-border/50'>
                {perms.map((perm) => (
                  <div
                    key={perm.id}
                    className='group flex items-center justify-between px-4 py-2'
                  >
                    <div className='min-w-0 flex-1'>
                      <span className='text-sm font-medium text-textPrimary'>
                        {perm.name}
                      </span>
                      <span className='ml-2 rounded bg-bgGray px-1.5 py-0.5 text-xs text-textSecondary'>
                        {perm.code}
                      </span>
                      {perm.description && (
                        <span className='ml-2 text-xs text-textSecondary'>
, {perm.description}
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                      <button
                        type='button'
                        onClick={() => setEditingPermission(perm)}
                        className='rounded p-1 text-textSecondary hover:bg-bgGray hover:text-textPrimary'
                        title='Edit permission'
                      >
                        <Pencil className='h-3.5 w-3.5' />
                      </button>
                      <button
                        type='button'
                        onClick={() => setDeletingPermission(perm)}
                        className='rounded p-1 text-textSecondary hover:bg-red-50 hover:text-destructive'
                        title='Delete permission'
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Permission Modal */}
      {createModalOpen && (
        <CreatePermissionModal
          categories={allCategories}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {/* Edit Permission Modal */}
      {editingPermission && (
        <EditPermissionModal
          permission={editingPermission}
          categories={allCategories}
          onClose={() => setEditingPermission(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingPermission && (
        <DeletePermissionModal
          permission={deletingPermission}
          onClose={() => setDeletingPermission(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CREATE ROLE MODAL
// ---------------------------------------------------------------------------

const CODE_REGEX = /^[a-z][a-z0-9_]*$/;

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CreateTenantRoleRequest>({
    code: '',
    name: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateTenantRole();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = form.code?.trim() ?? '';
    const name = form.name?.trim() ?? '';

    if (!code) {
      setError('Role code is required.');
      return;
    }
    if (!name) {
      setError('Role name is required.');
      return;
    }
    if (!CODE_REGEX.test(code)) {
      setError(
        'Code must be lowercase with underscores only (e.g. content_manager).',
      );
      return;
    }

    try {
      await mutation.mutateAsync({
        data: {
          code,
          name,
          description: form.description?.trim() || undefined,
        },
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to create role.';
      setError(message);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='fixed inset-0 bg-black/50'
        onClick={() => !mutation.isLoading && onClose()}
        aria-hidden='true'
      />
      <div className='relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-textPrimary'>
              Create Role
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded p-1 hover:bg-bgGray'
          >
            <X className='h-4 w-4 text-textSecondary' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {error && (
            <p className='rounded border border-destructive bg-red-50 px-3 py-2 text-sm text-destructive'>
              {error}
            </p>
          )}
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Code
            </label>
            <input
              type='text'
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              placeholder='e.g. content_manager'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Name
            </label>
            <input
              type='text'
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              placeholder='e.g. Content Manager'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Description (optional)
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <button
              type='button'
              onClick={onClose}
              disabled={mutation.isLoading}
              className='rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={mutation.isLoading}
              className='rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
            >
              {mutation.isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EDIT ROLE MODAL
// ---------------------------------------------------------------------------

function EditRoleModal({
  role,
  onClose,
}: {
  role: TenantRole;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: role.name,
    description: role.description ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateTenantRole();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = form.name?.trim() ?? '';
    if (!name) {
      setError('Name is required.');
      return;
    }

    try {
      await mutation.mutateAsync({
        roleId: role.id,
        data: { name, description: form.description?.trim() || undefined },
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to update role.';
      setError(message);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='fixed inset-0 bg-black/50'
        onClick={() => !mutation.isLoading && onClose()}
        aria-hidden='true'
      />
      <div className='relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-textPrimary'>
              Edit Role: {role.code}
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded p-1 hover:bg-bgGray'
          >
            <X className='h-4 w-4 text-textSecondary' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {error && (
            <p className='rounded border border-destructive bg-red-50 px-3 py-2 text-sm text-destructive'>
              {error}
            </p>
          )}
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Code
            </label>
            <input
              type='text'
              value={role.code}
              disabled
              className='w-full rounded-lg border border-border bg-bgGray px-3 py-2 text-sm text-textSecondary'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Name
            </label>
            <input
              type='text'
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Description (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <button
              type='button'
              onClick={onClose}
              disabled={mutation.isLoading}
              className='rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={mutation.isLoading}
              className='rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
            >
              {mutation.isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CREATE PERMISSION MODAL
// ---------------------------------------------------------------------------

const PERM_CODE_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

function CreatePermissionModal({
  categories,
  onClose,
}: {
  categories: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateTenantPermissionRequest>({
    code: '',
    name: '',
    category: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateTenantPermission();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = form.code?.trim() ?? '';
    const name = form.name?.trim() ?? '';
    const category = form.category?.trim() ?? '';

    if (!code) {
      setError('Permission code is required.');
      return;
    }
    if (!PERM_CODE_REGEX.test(code)) {
      setError(
        'Code must be lowercase, dot-separated (e.g. courses.view, hub.products.create).',
      );
      return;
    }
    if (!name) {
      setError('Permission name is required.');
      return;
    }
    if (!category) {
      setError('Category is required.');
      return;
    }

    try {
      await mutation.mutateAsync({
        code,
        name,
        category,
        description: form.description?.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to create permission.';
      setError(message);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='fixed inset-0 bg-black/50'
        onClick={() => !mutation.isLoading && onClose()}
        aria-hidden='true'
      />
      <div className='relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-textPrimary'>
              Create Permission
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded p-1 hover:bg-bgGray'
          >
            <X className='h-4 w-4 text-textSecondary' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {error && (
            <p className='rounded border border-destructive bg-red-50 px-3 py-2 text-sm text-destructive'>
              {error}
            </p>
          )}
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Code
            </label>
            <input
              type='text'
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  code: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_.]/g, ''),
                }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              placeholder='e.g. courses.view'
            />
            <p className='mt-1 text-xs text-textSecondary'>
              Lowercase, dot-separated segments (e.g. hub.products.create)
            </p>
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Name
            </label>
            <input
              type='text'
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              placeholder='e.g. View Courses'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Category
            </label>
            <input
              type='text'
              list='perm-categories'
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, ''),
                }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              placeholder='e.g. content'
            />
            <datalist id='perm-categories'>
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <p className='mt-1 text-xs text-textSecondary'>
              Pick an existing category or type a new one
            </p>
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Description (optional)
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <button
              type='button'
              onClick={onClose}
              disabled={mutation.isLoading}
              className='rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={mutation.isLoading}
              className='rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
            >
              {mutation.isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EDIT PERMISSION MODAL
// ---------------------------------------------------------------------------

function EditPermissionModal({
  permission,
  categories,
  onClose,
}: {
  permission: TenantPermission;
  categories: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: permission.name,
    category: permission.category ?? '',
    description: permission.description ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateTenantPermission();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = form.name?.trim() ?? '';
    if (!name) {
      setError('Name is required.');
      return;
    }

    try {
      await mutation.mutateAsync({
        id: permission.id,
        data: {
          name,
          category: form.category?.trim() || undefined,
          description: form.description?.trim() || undefined,
        },
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to update permission.';
      setError(message);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='fixed inset-0 bg-black/50'
        onClick={() => !mutation.isLoading && onClose()}
        aria-hidden='true'
      />
      <div className='relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-textPrimary'>
              Edit Permission: {permission.code}
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded p-1 hover:bg-bgGray'
          >
            <X className='h-4 w-4 text-textSecondary' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {error && (
            <p className='rounded border border-destructive bg-red-50 px-3 py-2 text-sm text-destructive'>
              {error}
            </p>
          )}
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Code
            </label>
            <input
              type='text'
              value={permission.code}
              disabled
              className='w-full rounded-lg border border-border bg-bgGray px-3 py-2 text-sm text-textSecondary'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Name
            </label>
            <input
              type='text'
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Category
            </label>
            <input
              type='text'
              list='perm-categories-edit'
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, ''),
                }))
              }
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
            <datalist id='perm-categories-edit'>
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-textPrimary'>
              Description (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <button
              type='button'
              onClick={onClose}
              disabled={mutation.isLoading}
              className='rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={mutation.isLoading}
              className='rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50'
            >
              {mutation.isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DELETE PERMISSION MODAL
// ---------------------------------------------------------------------------

function DeletePermissionModal({
  permission,
  onClose,
}: {
  permission: TenantPermission;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeleteTenantPermission();

  const handleDelete = async () => {
    setError(null);
    try {
      await mutation.mutateAsync(permission.id);
      onClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to delete permission.';
      setError(message);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='fixed inset-0 bg-black/50'
        onClick={() => !mutation.isLoading && onClose()}
        aria-hidden='true'
      />
      <div className='relative z-10 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg'>
        <div className='mb-4 flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-red-50'>
            <AlertTriangle className='h-5 w-5 text-destructive' />
          </div>
          <div>
            <h2 className='text-lg font-semibold text-textPrimary'>
              Delete Permission
            </h2>
            <p className='text-sm text-textSecondary'>
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className='mb-4 rounded-lg border border-border bg-bgGray px-3 py-2'>
          <p className='text-sm font-medium text-textPrimary'>
            {permission.name}
          </p>
          <p className='text-xs text-textSecondary'>{permission.code}</p>
        </div>

        {error && (
          <p className='mb-4 rounded border border-destructive bg-red-50 px-3 py-2 text-sm text-destructive'>
            {error}
          </p>
        )}

        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            disabled={mutation.isLoading}
            className='rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleDelete}
            disabled={mutation.isLoading}
            className='rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50'
          >
            {mutation.isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
