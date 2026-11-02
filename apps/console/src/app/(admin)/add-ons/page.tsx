'use client';

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Filter,
  Loader2,
  MoreVertical,
  Pen,
  Plus,
  PlusCircle,
  Rocket,
  Search,
  ShoppingCart,
  Star,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  useGetApplications,
  useGetAvailableAddons,
  useGetProducts,
} from '@/lib/api/hooks';
import { useDebounce } from '@/hooks/useDebounce';

import { TableLoadingOverlay } from '@/components/common/TableShimmer';

export default function AddOnsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    data: addonsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAvailableAddons({
    search: debouncedSearch || undefined,
    application_id: applicationFilter || undefined,
    product_id: productFilter || undefined,
    is_active:
      statusFilter === 'active'
        ? true
        : statusFilter === 'inactive'
          ? false
          : undefined,
    page: currentPage,
    limit: itemsPerPage,
  });

  const { data: applicationsData } = useGetApplications();
  const { data: productsData } = useGetProducts({ limit: 200 });
  const applications = applicationsData?.applications || [];
  const products = productsData?.products || [];

  const addons = addonsData?.addons || [];
  const totalFromApi = addonsData?.total ?? 0;
  const totalPages = Math.ceil(totalFromApi / itemsPerPage) || 1;

  const stats = {
    total: totalFromApi,
    active: addons.filter((a) => a.is_active).length,
    inactive: addons.filter((a) => !a.is_active).length,
    totalPurchases: 0,
    monthlyRevenue: addons.reduce(
      (sum, a) => sum + (a.price_monthly_usd || 0),
      0,
    ),
    avgPurchaseValue:
      addons.length > 0
        ? (
            addons.reduce((sum, a) => sum + (a.price_monthly_usd || 0), 0) /
            addons.length
          ).toFixed(2)
        : '0',
  };

  if (isLoading && !addonsData) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <Loader2 className='h-12 w-12 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading add-ons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Failed to load add-ons
          </h3>
          <p className='mt-2 text-textSecondary'>{error.message}</p>
          <button
            onClick={() => refetch()}
            className='mt-4 rounded-lg bg-primarySolid px-4 py-2 text-sm font-medium text-white hover:bg-primaryHover'
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const topPerformers = [...addons]
    .sort((a, b) => (b.price_monthly_usd || 0) - (a.price_monthly_usd || 0))
    .slice(0, 4);

  // Recent activity (mock data)
  const recentActivity = [
    {
      type: 'purchase',
      title: 'New Purchase',
      addon: 'Extra API Calls',
      tenant: 'Acme Corporation',
      amount: '+$49/month',
      time: '2 minutes ago',
      icon: Plus,
      bgColor: 'bg-green-100',
      iconColor: 'text-success',
    },
    {
      type: 'update',
      title: 'Add-on Updated',
      addon: 'Unlimited API',
      detail: 'pricing changed from $179/mo to $199/mo',
      time: '15 minutes ago',
      icon: Pen,
      bgColor: 'bg-primary-100',
      iconColor: 'text-primary',
    },
    {
      type: 'milestone',
      title: 'Milestone Reached',
      addon: 'Team Seats Pack',
      detail: 'reached 150 active purchases',
      time: '1 hour ago',
      icon: Star,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      type: 'cancel',
      title: 'Purchase Cancelled',
      addon: 'Custom Domain',
      tenant: 'StartupXYZ',
      amount: '-$19/month',
      time: '3 hours ago',
      icon: X,
      bgColor: 'bg-red-100',
      iconColor: 'text-error',
    },
    {
      type: 'create',
      title: 'New Add-on Created',
      addon: 'Cloud Backup',
      detail: 'add-on published and set to active',
      time: '5 hours ago',
      icon: Rocket,
      bgColor: 'bg-green-100',
      iconColor: 'text-success',
    },
  ];

  const clearFilters = () => {
    setSearchQuery('');
    setApplicationFilter('');
    setProductFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center mb-2'>
              <h1 className='text-3xl font-bold text-textPrimary'>
                Add-ons Management
              </h1>
              <span className='ml-4 text-primary text-sm font-semibold'>
                {stats.total} Total
              </span>
            </div>
            <p className='text-textSecondary'>
              Manage purchasable extras that grant additional product limits
              beyond plans
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center'>
              <Download className='h-4 w-4 mr-2' />
              Export
            </button>
            <Link
              href='/add-ons/new'
              className='h-10 px-5 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm transition flex items-center'
            >
              <Plus className='h-4 w-4 mr-2' />
              Create Add-on
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className='mb-8'>
        <div className='grid grid-cols-4 gap-6'>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center h-5 w-5'>
                <PlusCircle className='h-6 w-6 text-primary' />
              </div>
              <span className='text-xs font-semibold text-success'>
                +8 this month
              </span>
            </div>
            <div className='text-3xl font-bold text-textPrimary mb-1'>
              {stats.total}
            </div>
            <div className='text-sm text-textSecondary'>Total Add-ons</div>
            <div className='mt-4 text-xs text-textSecondary'>
              {stats.active} Active, {stats.inactive} Inactive
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center h-5 w-5'>
                <ShoppingCart className='h-6 w-6 text-success' />
              </div>
              <span className='text-xs font-semibold text-success'>
                +12.4%
              </span>
            </div>
            <div className='text-3xl font-bold text-textPrimary mb-1'>
              {stats.totalPurchases.toLocaleString()}
            </div>
            <div className='text-sm text-textSecondary'>Active Purchases</div>
            <div className='mt-4 text-xs text-textSecondary'>
              Across 247 tenants
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center h-5 w-5'>
                <DollarSign className='h-6 w-6 text-purple-600' />
              </div>
              <span className='text-xs font-semibold text-success'>
                +18.7%
              </span>
            </div>
            <div className='text-3xl font-bold text-textPrimary mb-1'>
              ${(stats.monthlyRevenue / 1000).toFixed(1)}K
            </div>
            <div className='text-sm text-textSecondary'>Monthly Revenue</div>
            <div className='mt-4 text-xs text-textSecondary'>
              +$6.1K vs last month
            </div>
          </div>

          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center h-5 w-5'>
                <TrendingUp className='h-6 w-6 text-warning' />
              </div>
              <span className='text-xs font-semibold text-success'>
                +3.2%
              </span>
            </div>
            <div className='text-3xl font-bold text-textPrimary mb-1'>
              ${stats.avgPurchaseValue}
            </div>
            <div className='text-sm text-textSecondary'>Avg Purchase Value</div>
            <div className='mt-4 text-xs text-textSecondary'>
              Per tenant/month
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className='mb-6'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='grid grid-cols-5 gap-4'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textSecondary' />
              <input
                type='text'
                placeholder='Search add-ons...'
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className='w-full h-10 pl-10 pr-4 bg-bgGray border border-border rounded-lg text-sm focus:outline-none focus:border-primary'
              />
            </div>
            <select
              value={applicationFilter}
              onChange={(e) => {
                setApplicationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className='h-10 px-4 bg-bgGray border border-border rounded-lg text-sm font-medium text-textPrimary focus:outline-none focus:border-primary'
            >
              <option value=''>All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
            <select
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setCurrentPage(1);
              }}
              className='h-10 px-4 bg-bgGray border border-border rounded-lg text-sm font-medium text-textPrimary focus:outline-none focus:border-primary'
            >
              <option value=''>All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className='h-10 px-4 bg-bgGray border border-border rounded-lg text-sm font-medium text-textPrimary focus:outline-none focus:border-primary'
            >
              <option value=''>All Statuses</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
            <button
              onClick={clearFilters}
              className='h-10 px-4 border border-border rounded-lg text-sm font-medium text-textPrimary hover:bg-bgGray transition flex items-center justify-center'
            >
              <Filter className='h-4 w-4 mr-2' />
              Clear Filters
            </button>
          </div>
        </div>
      </section>

      {/* Add-ons Table */}
      <section className='mb-8'>
        <TableLoadingOverlay isLoading={!!isFetching}>
          <div className='border-t border-border'>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-border'>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      <input
                        type='checkbox'
                        className='w-4 h-4 rounded border-border text-primary focus:ring-primary'
                      />
                    </th>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      <div className='flex items-center cursor-pointer hover:text-textPrimary'>
                        Add-on Details
                      </div>
                    </th>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      Application
                    </th>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      Product & Grant
                    </th>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      Pricing
                    </th>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      Status
                    </th>
                    <th className='text-left py-4 px-6 text-sm font-semibold text-textSecondary'>
                      Purchases
                    </th>
                    <th className='text-right py-4 px-6 text-sm font-semibold text-textSecondary'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addons.length === 0 ? (
                    <tr>
                      <td colSpan={8} className='py-12 text-center'>
                        <PlusCircle className='mx-auto h-12 w-12 text-textSecondary' />
                        <p className='mt-4 text-textSecondary'>
                          No add-ons found
                        </p>
                      </td>
                    </tr>
                  ) : (
                    addons.map((addon) => {
                      const IconComponent = Zap;
                      return (
                        <tr
                          key={addon.id}
                          className='border-b border-border hover:bg-bgGray transition'
                        >
                          <td className='py-4 px-6'>
                            <input
                              type='checkbox'
                              className='w-4 h-4 rounded border-border text-primary focus:ring-primary'
                            />
                          </td>
                          <td className='py-4 px-6'>
                            <div className='flex items-center'>
                              <div className='w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center flex-shrink-0'>
                                <IconComponent className='h-5 w-5 text-white' />
                              </div>
                              <div className='ml-3'>
                                <div className='font-semibold text-textPrimary'>
                                  {addon.name}
                                </div>
                                <div className='text-xs text-textSecondary font-mono'>
                                  {addon.code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className='py-4 px-6'>
                            <span className='text-sm text-textPrimary'>
                              {addon.application_name || 'N/A'}
                            </span>
                          </td>
                          <td className='py-4 px-6'>
                            <div>
                              <div className='text-sm font-medium text-textPrimary'>
                                {addon.product_code} /{' '}
                                {addon.feature_key || 'N/A'}
                              </div>
                              <div className='text-xs text-textSecondary'>
                                {addon.is_unlimited
                                  ? 'Unlimited'
                                  : `+${addon.grant_value ?? 0}`}
                              </div>
                            </div>
                          </td>
                          <td className='py-4 px-6'>
                            <div>
                              <div className='text-sm font-semibold text-textPrimary'>
                                ${addon.price_monthly_usd ?? 0}/mo · $
                                {addon.price_yearly_usd ?? 0}/yr
                              </div>
                              <div className='text-xs text-textSecondary'>
                                ₹{addon.price_monthly_inr ?? 0}/mo · ₹
                                {addon.price_yearly_inr ?? 0}/yr
                              </div>
                            </div>
                          </td>
                          <td className='py-4 px-6'>
                            <div className='flex items-center space-x-2'>
                              <span
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                  addon.is_active
                                    ? 'bg-green-50 text-success'
                                    : 'bg-gray-100 text-textSecondary'
                                }`}
                              >
                                {addon.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td className='py-4 px-6'>
                            <span className='text-sm text-textSecondary'>
                              -
                            </span>
                          </td>
                          <td className='py-4 px-6 text-right'>
                            <div className='flex items-center justify-end space-x-2'>
                              <Link
                                href={`/add-ons/${addon.id}/edit`}
                                className='w-8 h-8 flex items-center justify-center text-textSecondary hover:text-primary hover:bg-primary-50 rounded transition'
                                title='Edit'
                              >
                                <Pen className='h-4 w-4' />
                              </Link>
                              <button
                                className='w-8 h-8 flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-bgGray rounded transition'
                                title='More'
                              >
                                <MoreVertical className='h-4 w-4' />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className='flex items-center justify-between p-6 border-t border-border'>
              <div className='flex items-center space-x-4'>
                <span className='text-sm text-textSecondary'>
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, totalFromApi)} of{' '}
                  {totalFromApi} add-ons
                </span>
                <span className='text-sm text-textSecondary'>
                  {itemsPerPage} per page
                </span>
              </div>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textSecondary hover:bg-bgGray disabled:opacity-50'
                  aria-label='Previous page'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, i) => i + 1,
                ).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg font-medium ${
                      currentPage === page
                        ? 'bg-primary text-white'
                        : 'border border-border text-textPrimary hover:bg-bgGray'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className='w-9 h-9 flex items-center justify-center border border-border rounded-lg text-textSecondary hover:bg-bgGray disabled:opacity-50'
                  aria-label='Next page'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            </div>
          </div>
        </TableLoadingOverlay>
      </section>

      {/* Bottom Grid: Top Performers & Revenue */}
      <div className='grid grid-cols-2 gap-6 mb-8'>
        {/* Top Performing Add-ons */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Top Performing Add-ons
              </h2>
              <button className='text-sm text-primary font-medium hover:underline'>
                View All
              </button>
            </div>
            <div className='space-y-4'>
              {topPerformers.map((addon) => (
                <div
                  key={addon.id}
                  className='flex items-center justify-between p-4 bg-bgGray rounded-lg'
                >
                  <div className='flex items-center'>
                    <div className='w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center'>
                      <Zap className='h-5 w-5 text-white' />
                    </div>
                    <div className='ml-3'>
                      <div className='font-semibold text-textPrimary'>
                        {addon.name}
                      </div>
                      <div className='text-xs text-textSecondary'>
                        {addon.feature_key}
                      </div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className='text-lg font-bold text-textPrimary'>
                      ${addon.price_monthly_usd ?? 0}/mo
                    </div>
                    <div className='text-xs text-textSecondary'>
                      ₹{addon.price_monthly_inr ?? 0}/mo
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Revenue by Product Type */}
        <section>
          <div className='border-t border-border pt-6 pb-2'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-textPrimary'>
                Revenue by Product Type
              </h2>
              <select className='h-9 px-3 bg-bgGray border border-border rounded-lg text-sm font-medium text-textPrimary focus:outline-none focus:border-primary'>
                <option>This Month</option>
                <option>Last Month</option>
                <option>Last 3 Months</option>
              </select>
            </div>
            <div className='space-y-4'>
              {[
                {
                  name: 'API Calls',
                  revenue: 29814,
                  color: 'bg-primary',
                  percent: '31%',
                },
                {
                  name: 'Analytics',
                  revenue: 18476,
                  color: 'bg-teal-500',
                  percent: '19%',
                },
                {
                  name: 'Team Seats',
                  revenue: 11700,
                  color: 'bg-green-500',
                  percent: '12%',
                },
                {
                  name: 'Security',
                  revenue: 6633,
                  color: 'bg-pink-500',
                  percent: '7%',
                },
                {
                  name: 'Storage',
                  revenue: 9303,
                  color: 'bg-purple-500',
                  percent: '10%',
                },
                {
                  name: 'Other',
                  revenue: 20503,
                  color: 'bg-amber-500',
                  percent: '21%',
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className='flex items-center justify-between'
                >
                  <div className='flex items-center'>
                    <div
                      className={`w-3 h-3 ${item.color} rounded-full mr-3`}
                    ></div>
                    <span className='text-sm text-textPrimary'>
                      {item.name}
                    </span>
                  </div>
                  <div className='flex items-center space-x-4'>
                    <span className='text-sm font-semibold text-textPrimary'>
                      ${(item.revenue / 1000).toFixed(1)}K
                    </span>
                    <span className='text-xs text-textSecondary w-10 text-right'>
                      {item.percent}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Recent Activity */}
      <section className='mb-8'>
        <div className='border-t border-border pt-6 pb-2'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-xl font-semibold text-textPrimary'>
              Recent Add-on Activity
            </h2>
            <button className='text-sm text-primary font-medium hover:underline'>
              View All Activity
            </button>
          </div>
          <div className='space-y-3'>
            {recentActivity.map((activity, index) => {
              const IconComponent = activity.icon;
              return (
                <div
                  key={index}
                  className='flex items-start p-4 border border-border rounded-lg hover:bg-bgGray transition'
                >
                  <div
                    className={`w-10 h-10 ${activity.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}
                  >
                    <IconComponent
                      className={`h-4 w-4 ${activity.iconColor}`}
                    />
                  </div>
                  <div className='ml-4 flex-1'>
                    <div className='flex items-center justify-between mb-1'>
                      <div className='font-semibold text-textPrimary'>
                        {activity.title}
                      </div>
                      <span className='text-xs text-textSecondary'>
                        {activity.time}
                      </span>
                    </div>
                    <div className='text-sm text-textSecondary'>
                      {activity.tenant && `${activity.tenant} purchased `}
                      <span className='font-medium text-textPrimary'>
                        {activity.addon}
                      </span>
                      {activity.detail && ` ${activity.detail}`}
                    </div>
                    {activity.amount && (
                      <div
                        className={`text-xs mt-1 ${activity.amount.startsWith('+') ? 'text-success' : 'text-error'}`}
                      >
                        {activity.amount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
