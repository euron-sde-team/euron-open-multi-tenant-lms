'use client';

import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  GlobalMembersFilters,
  useGetAllMembers,
  useGetTenants,
} from '@/lib/api/hooks/useTenants';
import { GlobalMember, TenantMemberStatus } from '@/lib/api/types';

import PageHeader from '@/components/common/PageHeader';
import StatsCard from '@/components/common/StatsCard';
import StatusBadge from '@/components/common/StatusBadge';
import EditTenantUserDrawer from '@/components/tenant-users/EditTenantUserDrawer';

export default function TenantUsersPage() {
  // Search and filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantMemberStatus | ''>('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [editTarget, setEditTarget] = useState<GlobalMember | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build filters object
  const filters: GlobalMembersFilters = {
    page,
    limit,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(statusFilter && { status: statusFilter }),
    ...(tenantFilter && { tenant_id: tenantFilter }),
  };

  // API calls
  const { data: membersData, isLoading: membersLoading } =
    useGetAllMembers(filters);
  const { data: tenantsData } = useGetTenants({ limit: 100 });

  // Extract data
  const members = membersData?.data ?? [];
  const total = membersData?.total ?? 0;
  const totalPages = membersData?.totalPages ?? 0;
  const tenants = tenantsData?.data ?? [];

  // Stats - for now show total count
  const stats = {
    total,
    active: members.filter((m: GlobalMember) => m.status === 'ACTIVE').length,
    suspended: members.filter((m: GlobalMember) => m.status === 'SUSPENDED')
      .length,
    deactivated: members.filter((m: GlobalMember) => m.status === 'DEACTIVATED')
      .length,
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className='p-8'>
      <PageHeader
        title='Tenant Users'
        description='Manage users across all tenant organizations'
        breadcrumbs={[
          { label: 'Tenants', href: '/tenants' },
          { label: 'Tenant Users' },
        ]}
        actions={[
          { label: 'Export', icon: Download, variant: 'secondary' },
          { label: 'Invite User', icon: Plus, variant: 'primary' },
        ]}
      />

      {/* Stats Grid */}
      <section className='mb-8 grid grid-cols-4 gap-6'>
        <StatsCard
          icon={Users}
          iconBgColor='bg-primary-100'
          iconColor='text-primary'
          value={stats.total}
          label='Total Users'
        />
        <StatsCard
          icon={UserCheck}
          iconBgColor='bg-green-100'
          iconColor='text-success'
          value={stats.active}
          label='Active Users'
        />
        <StatsCard
          icon={Clock}
          iconBgColor='bg-amber-100'
          iconColor='text-warning'
          value={stats.suspended}
          label='Suspended'
        />
        <StatsCard
          icon={UserX}
          iconBgColor='bg-red-100'
          iconColor='text-error'
          value={stats.deactivated}
          label='Deactivated'
        />
      </section>

      {/* Table Section */}
      <section className='border-t border-border'>
        {/* Filters */}
        <div className='border-b border-border p-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                <input
                  type='text'
                  placeholder='Search users by name, email, or phone...'
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className='h-10 w-80 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as TenantMemberStatus | '');
                  setPage(1);
                }}
                className='h-10 rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                <option value=''>All Status</option>
                <option value='ACTIVE'>Active</option>
                <option value='SUSPENDED'>Suspended</option>
                <option value='DEACTIVATED'>Deactivated</option>
              </select>
              <select
                value={tenantFilter}
                onChange={(e) => {
                  setTenantFilter(e.target.value);
                  setPage(1);
                }}
                className='h-10 rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                <option value=''>All Tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='flex items-center space-x-2'>
              <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'>
                <Filter className='mr-2 h-4 w-4' />
                More Filters
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className='overflow-x-auto'>
          {membersLoading ? (
            <div className='flex justify-center py-12'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
            </div>
          ) : members.length === 0 ? (
            <div className='py-12 text-center text-textSecondary'>
              No users found
            </div>
          ) : (
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    <input
                      type='checkbox'
                      className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                    />
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    User
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Tenant
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Status
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Joined
                  </th>
                  <th className='px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: GlobalMember) => (
                  <tr
                    key={member.id}
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
                        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-sm font-bold text-white'>
                          {member.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('') || '?'}
                        </div>
                        <div className='ml-3'>
                          <div className='font-semibold text-textPrimary'>
                            {member.name}
                          </div>
                          <div className='text-xs text-textSecondary'>
                            {member.email ?? '-'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <span className='text-sm text-textPrimary'>
                        {member.tenant_name}
                      </span>
                    </td>
                    <td className='px-6 py-4'>
                      <StatusBadge status={member.status.toLowerCase()} />
                    </td>
                    <td className='px-6 py-4'>
                      <span className='text-sm text-textSecondary'>
                        {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex items-center justify-end space-x-2'>
                        <button
                          className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primary'
                          title='Send Email'
                        >
                          <Mail className='h-4 w-4' />
                        </button>
                        <button
                          type='button'
                          onClick={() => setEditTarget(member)}
                          className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primary'
                          title='Edit contact info'
                        >
                          <Pencil className='h-4 w-4' />
                        </button>
                        <button
                          className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-red-50 hover:text-error'
                          title='Suspend'
                        >
                          <Ban className='h-4 w-4' />
                        </button>
                        <button className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'>
                          <MoreVertical className='h-4 w-4' />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!membersLoading && members.length > 0 && (
          <div className='flex items-center justify-between border-t border-border px-6 py-4'>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-textSecondary'>
                Showing{' '}
                <span className='font-medium'>
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
                </span>{' '}
                of <span className='font-medium'>{total}</span> users
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className='rounded-lg border border-border px-2 py-1 text-sm'
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className='flex h-8 w-8 items-center justify-center rounded-lg border border-border text-textPrimary hover:bg-bgGray disabled:opacity-50'
                aria-label='Previous page'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm text-textSecondary'>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className='flex h-8 w-8 items-center justify-center rounded-lg border border-border text-textPrimary hover:bg-bgGray disabled:opacity-50'
                aria-label='Next page'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        )}
      </section>

      <EditTenantUserDrawer
        target={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}
