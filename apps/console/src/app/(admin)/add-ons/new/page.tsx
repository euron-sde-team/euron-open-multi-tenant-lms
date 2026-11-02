'use client';

import {
  ArrowLeft,
  Check,
  DollarSign,
  Eye,
  EyeOff,
  Gift,
  Info,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useCreateAddon,
  useGetApplications,
  useGetProducts,
} from '@/lib/api/hooks';

import ProductSelectDropdown from '@/components/common/ProductSelectDropdown';

export default function CreateAddOnPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    applicationId: '',
    code: '',
    name: '',
    description: '',
    productId: '',
    isUnlimited: false,
    grantValue: '0',
    priceMonthlyINR: '0',
    priceYearlyINR: '0',
    discountMonthlyINR: '0',
    discountYearlyINR: '0',
    priceMonthlyUSD: '0',
    priceYearlyUSD: '0',
    discountMonthlyUSD: '0',
    discountYearlyUSD: '0',
    isActive: true,
    isPublic: true,
    enableINR: true,
    enableUSD: true,
  });

  const { data: applicationsData } = useGetApplications();
  const { data: productsData } = useGetProducts({
    application_id: formData.applicationId || undefined,
    limit: 200,
  });
  const applications = applicationsData?.applications || [];
  const filteredProducts = productsData?.products || [];
  const createAddonMutation = useCreateAddon();

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]:
          type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      };
      if (name === 'applicationId') next.productId = '';
      return next;
    });
    setError(null);
  };

  const handleToggle = (field: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      !formData.applicationId ||
      !formData.code ||
      !formData.name ||
      !formData.productId
    ) {
      setError('Application, Code, Name, and Product are required.');
      return;
    }
    const priceMonthlyINR = Number(formData.priceMonthlyINR) || 0;
    const priceYearlyINR = Number(formData.priceYearlyINR) || 0;
    const priceMonthlyUSD = Number(formData.priceMonthlyUSD) || 0;
    const priceYearlyUSD = Number(formData.priceYearlyUSD) || 0;
    if (
      (!formData.enableINR && !formData.enableUSD) ||
      (priceMonthlyINR === 0 &&
        priceYearlyINR === 0 &&
        priceMonthlyUSD === 0 &&
        priceYearlyUSD === 0)
    ) {
      setError('At least one price (INR or USD) must be greater than 0.');
      return;
    }
    try {
      const result = await createAddonMutation.mutateAsync({
        data: {
          application_id: formData.applicationId,
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          product_id: formData.productId,
          grant_value: formData.isUnlimited
            ? 0
            : Number(formData.grantValue) || 0,
          is_unlimited: formData.isUnlimited,
          price_monthly_inr: formData.enableINR ? priceMonthlyINR : 0,
          price_yearly_inr: formData.enableINR ? priceYearlyINR : 0,
          price_monthly_usd: formData.enableUSD ? priceMonthlyUSD : 0,
          price_yearly_usd: formData.enableUSD ? priceYearlyUSD : 0,
          discount_monthly_inr_type: 'NONE',
          discount_monthly_inr_value: Number(formData.discountMonthlyINR) || 0,
          discount_yearly_inr_type: 'NONE',
          discount_yearly_inr_value: Number(formData.discountYearlyINR) || 0,
          discount_monthly_usd_type: 'NONE',
          discount_monthly_usd_value: Number(formData.discountMonthlyUSD) || 0,
          discount_yearly_usd_type: 'NONE',
          discount_yearly_usd_value: Number(formData.discountYearlyUSD) || 0,
          is_active: formData.isActive,
          is_public: formData.isPublic,
        },
      });
      const addonId = result.data?.id;
      if (addonId) {
        router.push(`/add-ons/${addonId}/edit`);
      } else {
        router.push('/add-ons');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create add-on');
    }
  };

  return (
    <div className='p-8'>
      {/* Page Header */}
      <section className='mb-8'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <Link
              href='/add-ons'
              className='w-10 h-10 flex items-center justify-center hover:bg-bgGray rounded-lg mr-4'
            >
              <ArrowLeft className='h-5 w-5 text-textPrimary' />
            </Link>
            <div>
              <h1 className='text-3xl font-bold text-textPrimary mb-2'>
                Create Add-on
              </h1>
              <p className='text-textSecondary'>
                Define a new add-on product for your applications
              </p>
            </div>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href='/add-ons'
              className='flex h-10 items-center rounded-lg border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              Cancel
            </Link>
            <button
              type='button'
              onClick={handleSubmit}
              disabled={createAddonMutation.isLoading}
              className='h-10 px-5 bg-primarySolid hover:bg-primaryHover text-white font-semibold rounded-full text-sm flex items-center disabled:opacity-50'
            >
              {createAddonMutation.isLoading ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Check className='h-4 w-4 mr-2' />
              )}
              Create Add-on
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )}

      <div className='grid grid-cols-3 gap-6'>
        {/* Main Form */}
        <div className='col-span-2'>
          {/* Basic Information */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <Info className='h-5 w-5 text-primary' />
              </div>
              <h2 className='text-xl font-semibold text-textPrimary ml-3'>
                Basic Information
              </h2>
            </div>

            <div className='space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Application <span className='text-error'>*</span>
                </label>
                <select
                  name='applicationId'
                  value={formData.applicationId}
                  onChange={handleInputChange}
                  className='w-full h-11 px-4 bg-surface border border-border rounded-lg text-sm text-textPrimary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                >
                  <option value=''>Select an application</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
                <p className='text-xs text-textSecondary mt-1.5'>
                  Choose the application this add-on belongs to
                </p>
              </div>

              <div className='grid grid-cols-2 gap-5'>
                <div>
                  <label className='block text-sm font-semibold text-textPrimary mb-2'>
                    Add-on Code <span className='text-error'>*</span>
                  </label>
                  <input
                    type='text'
                    name='code'
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder='e.g., ADDON_STORAGE_500GB'
                    className='w-full h-11 px-4 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                  />
                  <p className='text-xs text-textSecondary mt-1.5'>
                    Unique identifier (uppercase, underscores)
                  </p>
                </div>

                <div>
                  <label className='block text-sm font-semibold text-textPrimary mb-2'>
                    Add-on Name <span className='text-error'>*</span>
                  </label>
                  <input
                    type='text'
                    name='name'
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder='e.g., Extra Storage 500GB'
                    className='w-full h-11 px-4 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                  />
                  <p className='text-xs text-textSecondary mt-1.5'>
                    Display name for customers
                  </p>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Description
                </label>
                <textarea
                  name='description'
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder='Describe what this add-on provides and its benefits...'
                  className='w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none'
                />
                <p className='text-xs text-textSecondary mt-1.5'>
                  Detailed description visible to customers
                </p>
              </div>

              <div>
                <label className='block text-sm font-semibold text-textPrimary mb-2'>
                  Product <span className='text-error'>*</span>
                </label>
                <ProductSelectDropdown
                  value={formData.productId}
                  products={filteredProducts}
                  onChange={(productId) =>
                    setFormData((prev) => ({ ...prev, productId }))
                  }
                  disabled={!formData.applicationId}
                  placeholder='Select a product'
                  aria-label='Product'
                />
                <p className='text-xs text-textSecondary mt-1.5'>
                  Product category filtered by selected application
                </p>
              </div>
            </div>
          </section>

          {/* Grant Configuration */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <Gift className='h-5 w-5 text-purple-600' />
              </div>
              <h2 className='text-xl font-semibold text-textPrimary ml-3'>
                Grant Configuration
              </h2>
            </div>

            <div className='space-y-5'>
              <div className='flex items-center justify-between p-4 bg-bgGray rounded-lg'>
                <div className='flex-1'>
                  <div className='font-semibold text-textPrimary mb-1'>
                    Unlimited Access
                  </div>
                  <div className='text-sm text-textSecondary'>
                    Enable unlimited usage for this add-on
                  </div>
                </div>
                <button
                  type='button'
                  role='switch'
                  aria-checked={formData.isUnlimited}
                  onClick={() => handleToggle('isUnlimited')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                    formData.isUnlimited ? 'bg-primarySolid' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      formData.isUnlimited ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {!formData.isUnlimited && (
                <div>
                  <label className='block text-sm font-semibold text-textPrimary mb-2'>
                    Grant Value <span className='text-error'>*</span>
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      name='grantValue'
                      value={formData.grantValue}
                      onChange={handleInputChange}
                      placeholder='Enter quantity'
                      className='w-full h-11 px-4 pr-16 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                    />
                    <div className='absolute right-4 top-1/2 -translate-y-1/2 text-sm text-textSecondary'>
                      units
                    </div>
                  </div>
                  <p className='text-xs text-textSecondary mt-1.5'>
                    Quantity of resources granted by this add-on
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Pricing Configuration */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <DollarSign className='h-5 w-5 text-success' />
              </div>
              <h2 className='text-xl font-semibold text-textPrimary ml-3'>
                Pricing Configuration
              </h2>
            </div>

            <div className='space-y-6'>
              {/* INR Pricing */}
              <div className='border border-border rounded-lg p-5'>
                <div className='flex items-center justify-between mb-5'>
                  <div className='flex items-center'>
                    <div className='w-8 h-8 bg-primary-100 rounded flex items-center justify-center'>
                      <span className='text-primary text-sm font-bold'>₹</span>
                    </div>
                    <span className='ml-3 font-semibold text-textPrimary text-lg'>
                      INR Pricing
                    </span>
                  </div>
                  <button
                    type='button'
                    role='switch'
                    aria-checked={formData.enableINR}
                    onClick={() => handleToggle('enableINR')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                      formData.enableINR ? 'bg-primarySolid' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        formData.enableINR ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.enableINR && (
                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-semibold text-textPrimary mb-2'>
                        Monthly Price (INR)
                      </label>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <div className='relative'>
                            <span className='absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              ₹
                            </span>
                            <input
                              type='number'
                              name='priceMonthlyINR'
                              value={formData.priceMonthlyINR}
                              onChange={handleInputChange}
                              placeholder='0.00'
                              className='w-full h-11 pl-8 pr-4 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Base monthly price
                          </p>
                        </div>
                        <div>
                          <div className='relative'>
                            <input
                              type='number'
                              name='discountMonthlyINR'
                              value={formData.discountMonthlyINR}
                              onChange={handleInputChange}
                              placeholder='0'
                              min='0'
                              max='100'
                              className='w-full h-11 pl-4 pr-10 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                            <span className='absolute right-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              %
                            </span>
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Discount percentage
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-semibold text-textPrimary mb-2'>
                        Yearly Price (INR)
                      </label>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <div className='relative'>
                            <span className='absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              ₹
                            </span>
                            <input
                              type='number'
                              name='priceYearlyINR'
                              value={formData.priceYearlyINR}
                              onChange={handleInputChange}
                              placeholder='0.00'
                              className='w-full h-11 pl-8 pr-4 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Base yearly price
                          </p>
                        </div>
                        <div>
                          <div className='relative'>
                            <input
                              type='number'
                              name='discountYearlyINR'
                              value={formData.discountYearlyINR}
                              onChange={handleInputChange}
                              placeholder='0'
                              min='0'
                              max='100'
                              className='w-full h-11 pl-4 pr-10 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                            <span className='absolute right-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              %
                            </span>
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Discount percentage
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* USD Pricing */}
              <div className='border border-border rounded-lg p-5'>
                <div className='flex items-center justify-between mb-5'>
                  <div className='flex items-center'>
                    <div className='w-8 h-8 bg-green-100 rounded flex items-center justify-center'>
                      <span className='text-success text-sm font-bold'>$</span>
                    </div>
                    <span className='ml-3 font-semibold text-textPrimary text-lg'>
                      USD Pricing
                    </span>
                  </div>
                  <button
                    type='button'
                    role='switch'
                    aria-checked={formData.enableUSD}
                    onClick={() => handleToggle('enableUSD')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                      formData.enableUSD ? 'bg-primarySolid' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        formData.enableUSD ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.enableUSD && (
                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-semibold text-textPrimary mb-2'>
                        Monthly Price (USD)
                      </label>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <div className='relative'>
                            <span className='absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              $
                            </span>
                            <input
                              type='number'
                              name='priceMonthlyUSD'
                              value={formData.priceMonthlyUSD}
                              onChange={handleInputChange}
                              placeholder='0.00'
                              className='w-full h-11 pl-8 pr-4 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Base monthly price
                          </p>
                        </div>
                        <div>
                          <div className='relative'>
                            <input
                              type='number'
                              name='discountMonthlyUSD'
                              value={formData.discountMonthlyUSD}
                              onChange={handleInputChange}
                              placeholder='0'
                              min='0'
                              max='100'
                              className='w-full h-11 pl-4 pr-10 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                            <span className='absolute right-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              %
                            </span>
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Discount percentage
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-semibold text-textPrimary mb-2'>
                        Yearly Price (USD)
                      </label>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <div className='relative'>
                            <span className='absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              $
                            </span>
                            <input
                              type='number'
                              name='priceYearlyUSD'
                              value={formData.priceYearlyUSD}
                              onChange={handleInputChange}
                              placeholder='0.00'
                              className='w-full h-11 pl-8 pr-4 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Base yearly price
                          </p>
                        </div>
                        <div>
                          <div className='relative'>
                            <input
                              type='number'
                              name='discountYearlyUSD'
                              value={formData.discountYearlyUSD}
                              onChange={handleInputChange}
                              placeholder='0'
                              min='0'
                              max='100'
                              className='w-full h-11 pl-4 pr-10 bg-surface border border-border rounded-lg text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                            />
                            <span className='absolute right-4 top-1/2 -translate-y-1/2 text-textSecondary'>
                              %
                            </span>
                          </div>
                          <p className='text-xs text-textSecondary mt-1.5'>
                            Discount percentage
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Visibility & Status */}
          <section className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-6'>
              <div className='flex items-center h-5 w-5'>
                <Eye className='h-5 w-5 text-warning' />
              </div>
              <h2 className='text-xl font-semibold text-textPrimary ml-3'>
                Visibility & Status
              </h2>
            </div>

            <div className='space-y-4'>
              <div className='flex items-center justify-between p-4 bg-bgGray rounded-lg'>
                <div className='flex-1'>
                  <div className='font-semibold text-textPrimary mb-1'>
                    Active Status
                  </div>
                  <div className='text-sm text-textSecondary'>
                    Make this add-on available for subscription
                  </div>
                </div>
                <button
                  type='button'
                  role='switch'
                  aria-checked={formData.isActive}
                  onClick={() => handleToggle('isActive')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                    formData.isActive ? 'bg-primarySolid' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      formData.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className='flex items-center justify-between p-4 bg-bgGray rounded-lg'>
                <div className='flex-1'>
                  <div className='font-semibold text-textPrimary mb-1'>
                    Public Visibility
                  </div>
                  <div className='text-sm text-textSecondary'>
                    Display this add-on in public catalog and pricing pages
                  </div>
                </div>
                <button
                  type='button'
                  role='switch'
                  aria-checked={formData.isPublic}
                  onClick={() => handleToggle('isPublic')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primarySolid focus:ring-offset-2 ${
                    formData.isPublic ? 'bg-primarySolid' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      formData.isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className='col-span-1'>
          {/* Quick Tips */}
          <section className='mb-6 sticky top-24 border-t border-border pt-6 pb-2'>
            <div className='flex items-center mb-4'>
              <div className='w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center'>
                <Lightbulb className='h-4 w-4 text-primary' />
              </div>
              <h3 className='text-lg font-semibold text-textPrimary ml-3'>
                Quick Tips
              </h3>
            </div>

            <div className='space-y-4'>
              <div className='p-3 bg-primary-50 rounded-lg border border-primary-200'>
                <div className='flex items-start'>
                  <Info className='h-4 w-4 text-primary mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Add-on Codes
                    </div>
                    <div className='text-xs text-textSecondary'>
                      Use descriptive codes like ADDON_STORAGE_500GB or
                      ADDON_USERS_10 for easy identification
                    </div>
                  </div>
                </div>
              </div>

              <div className='p-3 bg-green-50 rounded-lg border border-green-200'>
                <div className='flex items-start'>
                  <Check className='h-4 w-4 text-success mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Pricing Strategy
                    </div>
                    <div className='text-xs text-textSecondary'>
                      Offer yearly discounts (typically 15-20%) to encourage
                      annual commitments
                    </div>
                  </div>
                </div>
              </div>

              <div className='p-3 bg-purple-50 rounded-lg border border-purple-200'>
                <div className='flex items-start'>
                  <Gift className='h-4 w-4 text-purple-600 mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Grant Values
                    </div>
                    <div className='text-xs text-textSecondary'>
                      Set realistic grant values based on typical customer needs
                      and usage patterns
                    </div>
                  </div>
                </div>
              </div>

              <div className='p-3 bg-amber-50 rounded-lg border border-amber-200'>
                <div className='flex items-start'>
                  <Eye className='h-4 w-4 text-warning mt-0.5' />
                  <div className='ml-3'>
                    <div className='text-sm font-semibold text-textPrimary mb-1'>
                      Public vs Private
                    </div>
                    <div className='text-xs text-textSecondary'>
                      Keep add-ons private during testing, then make them public
                      when ready for customers
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className='mt-6 pt-6 border-t border-border'>
              <div className='text-sm font-semibold text-textPrimary mb-3'>
                Required Fields
              </div>
              <div className='space-y-2'>
                <div className='flex items-center text-xs'>
                  <span className='w-1.5 h-1.5 bg-error rounded-full mr-2'></span>
                  <span className='text-textSecondary'>
                    Application selection
                  </span>
                </div>
                <div className='flex items-center text-xs'>
                  <span className='w-1.5 h-1.5 bg-error rounded-full mr-2'></span>
                  <span className='text-textSecondary'>Add-on code & name</span>
                </div>
                <div className='flex items-center text-xs'>
                  <span className='w-1.5 h-1.5 bg-error rounded-full mr-2'></span>
                  <span className='text-textSecondary'>
                    Product association
                  </span>
                </div>
                <div className='flex items-center text-xs'>
                  <span className='w-1.5 h-1.5 bg-error rounded-full mr-2'></span>
                  <span className='text-textSecondary'>
                    Grant value or unlimited
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Preview Card */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='text-sm font-semibold text-textPrimary mb-4'>
              Preview
            </div>
            {formData.name ? (
              <div className='border border-border rounded-lg p-4'>
                <div className='flex items-center mb-3'>
                  <div className='w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center'>
                    <Gift className='h-5 w-5 text-white' />
                  </div>
                  <div className='ml-3'>
                    <div className='font-semibold text-textPrimary'>
                      {formData.name || 'Add-on Name'}
                    </div>
                    <div className='text-xs text-textSecondary font-mono'>
                      {formData.code || 'addon_code'}
                    </div>
                  </div>
                </div>
                <div className='text-sm text-textSecondary mb-3'>
                  {formData.description ||
                    'Add-on description will appear here...'}
                </div>
                <div className='flex items-center justify-between pt-3 border-t border-border'>
                  <div>
                    <div className='text-lg font-bold text-textPrimary'>
                      {formData.priceMonthlyUSD
                        ? `$${formData.priceMonthlyUSD}/mo`
                        : '$0/mo'}
                    </div>
                  </div>
                  <div className='flex space-x-2'>
                    {formData.isActive && (
                      <span className='text-success text-xs font-semibold'>
                        Active
                      </span>
                    )}
                    {formData.isPublic && (
                      <span className='text-primary text-xs font-semibold'>
                        Public
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className='border-2 border-dashed border-border rounded-lg p-4'>
                <div className='text-center text-textSecondary'>
                  <EyeOff className='h-8 w-8 mx-auto mb-2 opacity-50' />
                  <div className='text-sm'>
                    Fill out the form to see a preview of your add-on
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
