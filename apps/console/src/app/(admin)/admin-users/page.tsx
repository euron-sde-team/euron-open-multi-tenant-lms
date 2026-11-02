'use client';

import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  Info,
  Key,
  Pause,
  Pen,
  Play,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  useDeactivateAdminUser,
  useDeleteAdminUser,
  useGetAdminUsers,
  useGetRoles,
  useReactivateAdminUser,
  useUpdateAdminUser,
} from '@/lib/api/hooks';
import { AdminUser } from '@/lib/api/types';

// Helper to format relative time
const formatRelativeTime = (date: string | Date | undefined): string => {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString();
};

// Helper to format absolute time
const formatAbsoluteTime = (date: string | Date | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Color palette for role distribution
const ROLE_COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-600' },
  { bg: 'bg-primary-100', text: 'text-primary', bar: 'bg-primary' },
  { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-600' },
  { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-600' },
  { bg: 'bg-pink-100', text: 'text-pink-700', bar: 'bg-pink-600' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', bar: 'bg-cyan-600' },
  { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-600' },
  { bg: 'bg-gray-100', text: 'text-gray-700', bar: 'bg-gray-600' },
];

// Calculate role distribution from users
const calculateRoleDistribution = (users: AdminUser[]) => {
  const roleCount: Record<
    string,
    { name: string; code: string; count: number }
  > = {};

  users.forEach((user) => {
    user.roles?.forEach((role) => {
      if (!roleCount[role.code]) {
        roleCount[role.code] = { name: role.name, code: role.code, count: 0 };
      }
      roleCount[role.code].count++;
    });
  });

  const total = Object.values(roleCount).reduce((sum, r) => sum + r.count, 0);

  return Object.values(roleCount)
    .sort((a, b) => b.count - a.count)
    .map((role, index) => ({
      ...role,
      percentage: total > 0 ? Math.round((role.count / total) * 1000) / 10 : 0,
      colors: ROLE_COLORS[index % ROLE_COLORS.length],
    }));
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return (
        <span className='text-xs font-semibold text-green-600'>
          Active
        </span>
      );
    case 'suspended':
      return (
        <span className='text-xs font-semibold text-amber-600'>
          Suspended
        </span>
      );
    case 'deactivated':
      return (
        <span className='text-xs font-semibold text-red-600'>
          Deactivated
        </span>
      );
    default:
      return null;
  }
};

const ITEMS_PER_PAGE = 10;

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | ''
  >('');
  const [emailFilter, setEmailFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [_selectedUsers, _setSelectedUsers] = useState<string[]>([]);

  // Fetch admin users using react-query with pagination
  const {
    data: usersData,
    isLoading,
    error,
  } = useGetAdminUsers({
    status: statusFilter || undefined,
    search: searchQuery || undefined,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  // Fetch roles for filter dropdown
  const { data: rolesData } = useGetRoles();

  const deactivateMutation = useDeactivateAdminUser();
  const reactivateMutation = useReactivateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const deleteMutation = useDeleteAdminUser();

  const handleToggleEmailVerified = (user: AdminUser) => {
    updateMutation.mutate({
      id: user.id,
      data: { email_verified: !user.email_verified },
    });
  };

  const handleDeletePermanent = (user: AdminUser) => {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) {
      return;
    }
    deleteMutation.mutate(user.id, {
      onError: (err) => {
        const message =
          axios.isAxiosError(err) && err.response?.data?.error?.message
            ? err.response.data.error.message
            : 'Failed to delete admin user';
        alert(message);
      },
    });
  };

  // Get users from response
  const adminUsers = usersData?.users || [];
  const totalUsers = usersData?.total || 0;
  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);

  // Calculate dynamic role distribution
  const roleDistribution = useMemo(
    () => calculateRoleDistribution(adminUsers),
    [adminUsers],
  );

  // Filter users by email verification if needed (client-side)
  const filteredUsers = useMemo(() => {
    let users = adminUsers;

    // Client-side email filter
    if (emailFilter === 'verified') {
      users = users.filter((u) => u.email_verified);
    } else if (emailFilter === 'unverified') {
      users = users.filter((u) => !u.email_verified);
    }

    // Client-side role filter
    if (roleFilter) {
      users = users.filter((u) =>
        u.roles?.some((r) => r.code.toLowerCase() === roleFilter.toLowerCase()),
      );
    }

    return users;
  }, [adminUsers, emailFilter, roleFilter]);

  // Stats from API response or calculated
  const stats = useMemo(() => {
    const active = adminUsers.filter((u) => u.status === 'ACTIVE').length;
    const suspended = adminUsers.filter((u) => u.status === 'SUSPENDED').length;
    const superAdmins = adminUsers.filter((u) =>
      u.roles?.some((r) => r.code === 'SUPERADMIN'),
    ).length;

    return {
      total: totalUsers,
      active,
      suspended,
      superAdmins,
      activePercentage:
        totalUsers > 0 ? Math.round((active / totalUsers) * 1000) / 10 : 0,
    };
  }, [adminUsers, totalUsers]);

  const resetFilters = () => {
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('');
    setEmailFilter('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(
          1,
          '...',
          currentPage - 1,
          currentPage,
          currentPage + 1,
          '...',
          totalPages,
        );
      }
    }

    return pages;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading admin users...</p>
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
            Failed to load admin users
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
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
              Admin Users
            </h1>
            <p className='text-textSecondary'>
              Manage administrative users and their permissions
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'>
              <Download className='mr-2 h-4 w-4' />
              Export Users
            </button>
            <Link
              href='/admin-users/new'
              className='flex h-10 items-center rounded-full bg-primarySolid px-5 text-sm font-semibold text-white hover:bg-primaryHover'
            >
              <UserPlus className='mr-2 h-4 w-4' />
              Add Admin User
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className='mb-8'>
        <div className='grid grid-cols-4 gap-6'>
          {/* Total Admin Users */}
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <UserCog className='h-5 w-5 text-primary' />
              </div>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {stats.total}
            </div>
            <div className='text-sm text-textSecondary'>Total Admin Users</div>
            <div className='mt-4 text-xs text-textSecondary'>
              {stats.active} active, {stats.suspended} suspended
            </div>
          </div>

          {/* Active Users */}
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <CheckCircle className='h-5 w-5 text-green-600' />
              </div>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {stats.active}
            </div>
            <div className='text-sm text-textSecondary'>Active Users</div>
            <div className='mt-4 text-xs text-textSecondary'>
              {stats.activePercentage}% of total
            </div>
          </div>

          {/* Super Admins */}
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <Crown className='h-5 w-5 text-purple-600' />
              </div>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {stats.superAdmins}
            </div>
            <div className='text-sm text-textSecondary'>Super Admins</div>
            <div className='mt-4 text-xs text-textSecondary'>
              Full system access
            </div>
          </div>

          {/* Active Sessions */}
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center h-5 w-5'>
                <Clock className='h-5 w-5 text-amber-600' />
              </div>
            </div>
            <div className='mb-1 text-3xl font-bold text-textPrimary'>
              {roleDistribution.length}
            </div>
            <div className='text-sm text-textSecondary'>Active Roles</div>
            <div className='mt-4 text-xs text-textSecondary'>
              In use across users
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className='mb-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Search by name, email, or role...'
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className='h-10 w-80 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none'
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className='h-10 rounded-lg border border-border bg-bgGray px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Roles</option>
                {rolesData?.roles.map((role) => (
                  <option key={role.id} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value as
                      | 'ACTIVE'
                      | 'SUSPENDED'
                      | 'DEACTIVATED'
                      | '',
                  );
                  setCurrentPage(1);
                }}
                className='h-10 rounded-lg border border-border bg-bgGray px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>All Status</option>
                <option value='ACTIVE'>Active</option>
                <option value='SUSPENDED'>Suspended</option>
                <option value='DEACTIVATED'>Deactivated</option>
              </select>
              <select
                value={emailFilter}
                onChange={(e) => {
                  setEmailFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className='h-10 rounded-lg border border-border bg-bgGray px-4 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none'
              >
                <option value=''>Email Status</option>
                <option value='all'>All</option>
                <option value='verified'>Verified</option>
                <option value='unverified'>Unverified</option>
              </select>
            </div>
            <button
              onClick={resetFilters}
              className='flex items-center text-sm font-medium text-textSecondary hover:text-textPrimary'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <section className='mb-8'>
        <div className='overflow-hidden border-t border-border'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-6 py-4 text-left'>
                    <input
                      type='checkbox'
                      className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                    />
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    User
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Roles
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Status
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Email Verified
                  </th>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-textSecondary'>
                    Last Login
                  </th>
                  <th className='px-6 py-4 text-right text-sm font-semibold text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='px-6 py-12 text-center'>
                      <UserCog className='mx-auto h-12 w-12 text-textSecondary' />
                      <p className='mt-4 text-textSecondary'>
                        No admin users found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className='border-b border-border transition hover:bg-bgGray'
                    >
                      <td className='px-6 py-4'>
                        <input
                          type='checkbox'
                          className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                        />
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex items-center'>
                          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-white'>
                            {user.name?.[0]?.toUpperCase() ||
                              user.email?.[0]?.toUpperCase()}
                          </div>
                          <div className='ml-3'>
                            <div className='font-semibold text-textPrimary'>
                              {user.name}
                            </div>
                            <div className='text-sm text-textSecondary'>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex flex-wrap gap-2'>
                          {user.roles?.map((role) => (
                            <span
                              key={role.id}
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                role.code === 'SUPERADMIN'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-primary-100 text-primary'
                              }`}
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        {getStatusBadge(user.status?.toLowerCase() || 'active')}
                      </td>
                      <td className='px-6 py-4'>
                        <button
                          type='button'
                          onClick={() => handleToggleEmailVerified(user)}
                          disabled={updateMutation.isLoading}
                          title={
                            user.email_verified
                              ? 'Click to mark email unverified'
                              : 'Click to mark email verified'
                          }
                          className='flex items-center rounded px-1.5 py-1 transition hover:bg-bgGray disabled:opacity-50'
                        >
                          {user.email_verified ? (
                            <>
                              <CheckCircle className='mr-2 h-4 w-4 text-green-600' />
                              <span className='text-sm text-textPrimary'>
                                Verified
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className='mr-2 h-4 w-4 text-red-600' />
                              <span className='text-sm text-textSecondary'>
                                Not Verified
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='text-sm text-textPrimary'>
                          {user.last_login_at
                            ? formatRelativeTime(user.last_login_at)
                            : 'Never'}
                        </div>
                        <div className='text-xs text-textSecondary'>
                          {user.last_login_at
                            ? formatAbsoluteTime(user.last_login_at)
                            : '-'}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex items-center justify-end space-x-2'>
                          <Link
                            href={`/admin-users/${user.id}/edit`}
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-primary-50 hover:text-primary'
                            title='Edit'
                          >
                            <Pen className='h-4 w-4' />
                          </Link>
                          {user.status === 'ACTIVE' ? (
                            <button
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-amber-50 hover:text-amber-600'
                              title='Deactivate'
                              onClick={() => {
                                if (
                                  confirm(
                                    'Are you sure you want to deactivate this user?',
                                  )
                                ) {
                                  deactivateMutation.mutate(user.id);
                                }
                              }}
                            >
                              <Pause className='h-4 w-4' />
                            </button>
                          ) : (
                            <button
                              className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-green-50 hover:text-green-600'
                              title='Activate'
                              onClick={() => {
                                if (
                                  confirm(
                                    'Are you sure you want to reactivate this user?',
                                  )
                                ) {
                                  reactivateMutation.mutate(user.id);
                                }
                              }}
                            >
                              <Play className='h-4 w-4' />
                            </button>
                          )}
                          <button
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-primary-50 hover:text-primary'
                            title='Reset Password'
                          >
                            <Key className='h-4 w-4' />
                          </button>
                          <button
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary hover:bg-red-50 hover:text-red-600 disabled:opacity-50'
                            title='Delete permanently'
                            disabled={deleteMutation.isLoading}
                            onClick={() => handleDeletePermanent(user)}
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

          {/* Pagination */}
          <div className='flex items-center justify-between border-t border-border px-6 py-4'>
            <div className='text-sm text-textSecondary'>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
              {Math.min(currentPage * ITEMS_PER_PAGE, totalUsers)} of{' '}
              {totalUsers} admin users
            </div>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Previous page'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <button
                    key={index}
                    onClick={() => handlePageChange(page)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg font-medium ${
                      page === currentPage
                        ? 'bg-primarySolid text-white'
                        : 'border border-border text-textPrimary hover:bg-bgGray'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span
                    key={index}
                    className='flex h-9 w-9 items-center justify-center text-textSecondary'
                  >
                    {page}
                  </span>
                ),
              )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-textSecondary hover:bg-bgGray disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Next page'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Role Distribution and Security Info */}
      <div className='mb-8 grid grid-cols-2 gap-6'>
        {/* Role Distribution */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <h2 className='mb-6 text-xl font-semibold text-textPrimary'>
              Role Distribution
            </h2>
            {roleDistribution.length === 0 ? (
              <div className='py-8 text-center text-textSecondary'>
                <Shield className='mx-auto h-12 w-12 text-textSecondary' />
                <p className='mt-4'>No roles assigned yet</p>
              </div>
            ) : (
              <div className='space-y-4'>
                {roleDistribution.map((role) => (
                  <div key={role.code}>
                    <div className='mb-2 flex items-center justify-between'>
                      <div className='flex items-center'>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded ${role.colors.bg}`}
                        >
                          {role.code === 'SUPERADMIN' ? (
                            <Crown className={`h-4 w-4 ${role.colors.text}`} />
                          ) : (
                            <Shield className={`h-4 w-4 ${role.colors.text}`} />
                          )}
                        </div>
                        <span className='ml-3 font-semibold text-textPrimary'>
                          {role.name}
                        </span>
                      </div>
                      <span className='text-sm font-semibold text-textPrimary'>
                        {role.count} users ({role.percentage}%)
                      </span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-bgGray'>
                      <div
                        className={`h-2 rounded-full ${role.colors.bar}`}
                        style={{ width: `${role.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Quick Actions
              </h2>
            </div>
            <div className='space-y-3'>
              <Link
                href='/admin-users/new'
                className='flex items-start rounded-lg border border-border p-4 transition hover:border-primary hover:bg-bgGray'
              >
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary'>
                  <UserPlus className='h-4 w-4 text-white' />
                </div>
                <div className='ml-4 flex-1'>
                  <div className='font-semibold text-textPrimary'>
                    Add New Admin User
                  </div>
                  <div className='mt-0.5 text-sm text-textSecondary'>
                    Create a new administrator account with role assignment
                  </div>
                </div>
              </Link>

              <Link
                href='/roles-permissions'
                className='flex items-start rounded-lg border border-border p-4 transition hover:border-primary hover:bg-bgGray'
              >
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-600'>
                  <Shield className='h-4 w-4 text-white' />
                </div>
                <div className='ml-4 flex-1'>
                  <div className='font-semibold text-textPrimary'>
                    Manage Roles & Permissions
                  </div>
                  <div className='mt-0.5 text-sm text-textSecondary'>
                    Configure roles and their permission assignments
                  </div>
                </div>
              </Link>

              <div className='flex items-start rounded-lg border border-primary-200 bg-primary-50 p-4'>
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary'>
                  <Info className='h-4 w-4 text-white' />
                </div>
                <div className='ml-4 flex-1'>
                  <div className='font-semibold text-primary'>Security Tip</div>
                  <div className='mt-0.5 text-sm text-primary'>
                    Regularly review admin user access and remove unnecessary
                    permissions to maintain security.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
