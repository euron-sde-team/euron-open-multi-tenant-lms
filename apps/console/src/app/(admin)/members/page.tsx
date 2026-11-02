'use client';

import {
  Building2,
  Clock,
  Download,
  Filter,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { useGetStaffMembers } from '@/lib/api/hooks/useStaff';
import { exportStaffMembers } from '@/lib/api/staff';
import { TenantUserStatus } from '@/lib/api/types';
import { useDebounce } from '@/hooks/useDebounce';

import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageHeader from '@/components/common/PageHeader';
import StatsCard from '@/components/common/StatsCard';
import StatusBadge from '@/components/common/StatusBadge';

import MemberDetailsDrawer from './components/MemberDetailsDrawer';

export default function MembersPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantUserStatus | ''>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data, isLoading, isError } = useGetStaffMembers({
    page,
    limit,
    search: debouncedSearch,
    status: statusFilter || undefined,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as TenantUserStatus | '');
    setPage(1); // Reset to first page on filter change
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      const blob = await exportStaffMembers(
        exportStartDate || undefined,
        exportEndDate || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff-members-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Stats are currently mocked as API doesn't return global stats yet
  // In a real app, we might fetch these from a separate stats endpoint
  const stats = {
    total: data?.total || 0,
    active: 0, // Placeholder
    pending: 0, // Placeholder
  };

  if (isError) {
    return (
      <div className='flex h-96 items-center justify-center text-error'>
        Failed to load staff members
      </div>
    );
  }

  return (
    <div className='p-8'>
      <PageHeader
        title='Tenant Staff Members'
        description='Manage tenant staff members and their access across organizations'
        breadcrumbs={[
          { label: 'Tenants', href: '/tenants' },
          { label: 'Tenant Staff Members' },
        ]}
        actions={[
          {
            label: 'Export',
            icon: Download,
            variant: 'secondary',
            onClick: () => setShowExportModal(true),
          },
          { label: 'Invite Member', icon: Plus, variant: 'primary' },
        ]}
      />

      {/* Stats Grid */}
      <section className='mb-8 grid grid-cols-4 gap-6'>
        <StatsCard
          icon={Users}
          iconBgColor='bg-primary-100'
          iconColor='text-primary'
          value={stats.total}
          label='Total Members'
        />
        <StatsCard
          icon={UserCheck}
          iconBgColor='bg-green-100'
          iconColor='text-success'
          value={stats.active}
          label='Active Members'
          change='-'
          changeType='neutral'
        />
        <StatsCard
          icon={Clock}
          iconBgColor='bg-amber-100'
          iconColor='text-warning'
          value={stats.pending}
          label='Pending Invites'
        />
        <StatsCard
          icon={Building2}
          iconBgColor='bg-purple-100'
          iconColor='text-purple-600'
          value={0}
          label='Departments'
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
                  placeholder='Search by name, email, or phone...'
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className='h-10 w-80 rounded-lg border border-border bg-bgGray pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
              </div>
              <select
                value={statusFilter}
                onChange={handleStatusChange}
                className='h-10 rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                <option value=''>All Status</option>
                <option value='ACTIVE'>Active</option>
                <option value='INVITED'>Invited</option>
                <option value='SUSPENDED'>Suspended</option>
                <option value='DEACTIVATED'>Deactivated</option>
              </select>
            </div>
            <div className='flex items-center space-x-2'>
              <button className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'>
                <Filter className='mr-2 h-4 w-4' />
                Filters
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className='overflow-x-auto'>
          {isLoading ? (
            <div className='flex h-64 items-center justify-center'>
              <LoadingSpinner />
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
                    Member
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Role
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Tenants
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Status
                  </th>
                  <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Last Active
                  </th>
                  <th className='px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-textSecondary'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className='py-8 text-center text-textSecondary'
                    >
                      No members found matching your criteria
                    </td>
                  </tr>
                ) : (
                  data?.data.map((member) => (
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
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.name}
                              className='h-10 w-10 rounded-full'
                            />
                          ) : (
                            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-sm font-bold text-white'>
                              {member.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className='ml-3'>
                            <div className='font-semibold text-textPrimary'>
                              {member.name}
                            </div>
                            <div className='text-xs text-textSecondary'>
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <span className='text-xs font-medium text-primary'>
                          {member.primary_role || 'No Role'}
                        </span>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex flex-col'>
                          <span className='text-sm font-medium text-textPrimary'>
                            {member.primary_tenant_name || 'N/A'}
                          </span>
                          {member.tenant_count > 1 && (
                            <span className='text-xs text-textSecondary'>
                              + {member.tenant_count - 1} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <StatusBadge status={member.status.toLowerCase()} />
                      </td>
                      <td className='px-6 py-4'>
                        <span className='text-sm text-textSecondary'>
                          {member.last_login_at
                            ? new Date(
                                member.last_login_at,
                              ).toLocaleDateString()
                            : 'Never'}
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
                            onClick={() => {
                              setSelectedMemberId(member.id);
                              setIsDrawerOpen(true);
                            }}
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-primary-50 hover:text-primary'
                            title='Settings'
                          >
                            <Settings className='h-4 w-4' />
                          </button>
                          <button
                            className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-red-50 hover:text-error'
                            title='Remove'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                          <button className='flex h-8 w-8 items-center justify-center rounded text-textSecondary transition hover:bg-bgGray hover:text-textPrimary'>
                            <MoreVertical className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && (
          <div className='flex items-center justify-between border-t border-border px-6 py-4'>
            <div className='text-sm text-textSecondary'>
              Showing{' '}
              <span className='font-medium'>
                {Math.min((page - 1) * limit + 1, data.total)}
              </span>{' '}
              to{' '}
              <span className='font-medium'>
                {Math.min(page * limit, data.total)}
              </span>{' '}
              of <span className='font-medium'>{data.total}</span> members
            </div>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className='rounded-lg border border-border px-3 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Previous
              </button>
              {/* Pagination placeholder */}
              <span className='text-sm text-textSecondary'>
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages || isLoading}
                className='rounded-lg border border-border px-3 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <MemberDetailsDrawer
        userId={selectedMemberId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {showExportModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => {
              setShowExportModal(false);
              setExportError('');
            }}
          />
          <div className='relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-lg font-semibold text-textPrimary'>
                Export Staff Members
              </h2>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportError('');
                }}
                className='text-textSecondary hover:text-textPrimary transition'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <p className='text-sm text-textSecondary mb-5'>
              Filter by signup date range. Leave both fields empty to export all
              staff members.
            </p>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-textPrimary mb-1.5'>
                  Start Date
                </label>
                <input
                  type='date'
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className='w-full h-10 px-3 border border-border rounded-lg text-sm text-textPrimary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-textPrimary mb-1.5'>
                  End Date
                </label>
                <input
                  type='date'
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  min={exportStartDate || undefined}
                  className='w-full h-10 px-3 border border-border rounded-lg text-sm text-textPrimary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
                />
              </div>
            </div>

            {exportError && (
              <p className='mt-3 text-sm text-red-500'>{exportError}</p>
            )}

            <div className='flex items-center justify-end gap-3 mt-6'>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportError('');
                }}
                className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition'
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className='h-10 px-5 bg-primarySolid hover:bg-primaryHover disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center gap-2'
              >
                {isExporting ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className='h-4 w-4' />
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
