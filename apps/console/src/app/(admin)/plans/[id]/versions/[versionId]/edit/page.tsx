'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  DollarSign,
  Edit2,
  GitBranch,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  useAddProductToVersion,
  useGetPlan,
  useGetPlanVersion,
  usePublishPlanVersion,
  useRemoveProductFromVersion,
  useRetirePlanVersion,
  useUpdatePlanVersion,
} from '@/lib/api/hooks/usePlans';
import { useGetProducts } from '@/lib/api/hooks/useProducts';
import {
  DiscountType,
  PlanVersionProduct,
  PurchaseMode,
} from '@/lib/api/types';
import { decodeHtmlEntities } from '@/lib/utils';

import ConfirmModal from '@/components/common/ConfirmModal';
import { EntitlementSyncModal } from '@/components/plans/EntitlementSyncModal';

interface PricingFormState {
  purchase_mode: PurchaseMode;
  price_monthly_inr: number;
  price_yearly_inr: number;
  discount_monthly_inr_type: DiscountType;
  discount_monthly_inr_value: number;
  discount_yearly_inr_type: DiscountType;
  discount_yearly_inr_value: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_usd_type: DiscountType;
  discount_monthly_usd_value: number;
  discount_yearly_usd_type: DiscountType;
  discount_yearly_usd_value: number;
  // Two-yearly pricing
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  discount_two_yearly_inr_type: DiscountType;
  discount_two_yearly_inr_value: number;
  discount_two_yearly_usd_type: DiscountType;
  discount_two_yearly_usd_value: number;
  // Offer fields
  is_offer: boolean;
  offer_name: string;
  offer_description: string;
  offer_valid_from: string;
  offer_valid_to: string;
}

export default function EditPlanVersionPage() {
  const params = useParams();
  const planId = params.id as string;
  const versionId = params.versionId as string;

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productLimit, setProductLimit] = useState<number>(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [isEditingOffer, setIsEditingOffer] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'publish' | 'retire' | 'reactivate' | null;
  }>({ isOpen: false, type: null });
  const [pricingForm, setPricingForm] = useState<PricingFormState>({
    purchase_mode: 'PAID',
    price_monthly_inr: 0,
    price_yearly_inr: 0,
    discount_monthly_inr_type: 'NONE',
    discount_monthly_inr_value: 0,
    discount_yearly_inr_type: 'NONE',
    discount_yearly_inr_value: 0,
    price_monthly_usd: 0,
    price_yearly_usd: 0,
    discount_monthly_usd_type: 'NONE',
    discount_monthly_usd_value: 0,
    discount_yearly_usd_type: 'NONE',
    discount_yearly_usd_value: 0,
    // Two-yearly pricing
    price_two_yearly_inr: 0,
    price_two_yearly_usd: 0,
    discount_two_yearly_inr_type: 'NONE',
    discount_two_yearly_inr_value: 0,
    discount_two_yearly_usd_type: 'NONE',
    discount_two_yearly_usd_value: 0,
    // Offer fields
    is_offer: false,
    offer_name: '',
    offer_description: '',
    offer_valid_from: '',
    offer_valid_to: '',
  });

  // Fetch plan and version data
  const { data: plan, isLoading: planLoading } = useGetPlan(planId);
  const {
    data: version,
    isLoading: versionLoading,
    refetch: refetchVersion,
  } = useGetPlanVersion(planId, versionId);

  // Fetch all products for selection
  const { data: productsData } = useGetProducts();
  const allProducts = productsData?.products || [];

  // Mutations
  const addProductMutation = useAddProductToVersion();
  const removeProductMutation = useRemoveProductFromVersion();
  const publishMutation = usePublishPlanVersion();
  const retireMutation = useRetirePlanVersion();
  const updateVersionMutation = useUpdatePlanVersion();

  // Entitlement sync (backfill this version's products to tenants already on the plan)
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Initialize pricing form when version data loads
  useEffect(() => {
    if (version) {
      setPricingForm({
        purchase_mode: version.purchase_mode || 'PAID',
        price_monthly_inr: version.price_monthly_inr,
        price_yearly_inr: version.price_yearly_inr,
        discount_monthly_inr_type: version.discount_monthly_inr_type,
        discount_monthly_inr_value: version.discount_monthly_inr_value,
        discount_yearly_inr_type: version.discount_yearly_inr_type,
        discount_yearly_inr_value: version.discount_yearly_inr_value,
        price_monthly_usd: version.price_monthly_usd,
        price_yearly_usd: version.price_yearly_usd,
        discount_monthly_usd_type: version.discount_monthly_usd_type,
        discount_monthly_usd_value: version.discount_monthly_usd_value,
        discount_yearly_usd_type: version.discount_yearly_usd_type,
        discount_yearly_usd_value: version.discount_yearly_usd_value,
        // Two-yearly pricing
        price_two_yearly_inr: version.price_two_yearly_inr || 0,
        price_two_yearly_usd: version.price_two_yearly_usd || 0,
        discount_two_yearly_inr_type:
          version.discount_two_yearly_inr_type || 'NONE',
        discount_two_yearly_inr_value:
          version.discount_two_yearly_inr_value || 0,
        discount_two_yearly_usd_type:
          version.discount_two_yearly_usd_type || 'NONE',
        discount_two_yearly_usd_value:
          version.discount_two_yearly_usd_value || 0,
        // Offer fields
        is_offer: version.is_offer || false,
        offer_name: version.offer_name || '',
        offer_description: version.offer_description || '',
        offer_valid_from: version.offer_valid_from
          ? version.offer_valid_from.split('T')[0]
          : '',
        offer_valid_to: version.offer_valid_to
          ? version.offer_valid_to.split('T')[0]
          : '',
      });
    }
  }, [version]);

  // Filter products: exclude already added, and only show products belonging to plan's linked applications
  const planAppCodes = plan?.applications?.map((a) => a.code) ?? [];
  const availableProducts = allProducts.filter(
    (p) =>
      !version?.products?.some((vp) => vp.product_id === p.id) &&
      (planAppCodes.length === 0 || planAppCodes.includes(p.application_code)),
  );

  const isPublished = version?.is_active || version?.published_at;
  const isRetired = !!version?.retired_at;
  const canModify = !isPublished && !isRetired;

  const handleAddProduct = async () => {
    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }

    try {
      await addProductMutation.mutateAsync({
        planId,
        versionId,
        data: {
          product_id: selectedProductId,
          limit_value: isUnlimited ? 0 : productLimit,
          is_unlimited: isUnlimited,
        },
      });
      setShowAddProduct(false);
      setSelectedProductId('');
      setProductLimit(0);
      setIsUnlimited(false);
      setError(null);
      refetchVersion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    try {
      await removeProductMutation.mutateAsync({
        planId,
        versionId,
        productId,
      });
      refetchVersion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove product');
    }
  };

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync({ planId, versionId });
      setConfirmModal({ isOpen: false, type: null });
      refetchVersion();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to publish version',
      );
    }
  };

  const handleRetire = async () => {
    try {
      await retireMutation.mutateAsync({ planId, versionId });
      setConfirmModal({ isOpen: false, type: null });
      refetchVersion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retire version');
    }
  };

  const openPublishModal = () => {
    setConfirmModal({ isOpen: true, type: 'publish' });
  };

  const openRetireModal = () => {
    setConfirmModal({ isOpen: true, type: 'retire' });
  };

  const openReactivateModal = () => {
    setConfirmModal({ isOpen: true, type: 'reactivate' });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null });
  };

  const handleReactivate = async () => {
    try {
      await publishMutation.mutateAsync({ planId, versionId });
      setConfirmModal({ isOpen: false, type: null });
      refetchVersion();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reactivate version',
      );
    }
  };

  const handleSavePricing = async () => {
    try {
      await updateVersionMutation.mutateAsync({
        planId,
        versionId,
        data: pricingForm,
      });
      setIsEditingPricing(false);
      setError(null);
      refetchVersion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing');
    }
  };

  const handleCancelPricingEdit = () => {
    // Reset form to current version values
    if (version) {
      setPricingForm({
        purchase_mode: version.purchase_mode || 'PAID',
        price_monthly_inr: version.price_monthly_inr,
        price_yearly_inr: version.price_yearly_inr,
        discount_monthly_inr_type: version.discount_monthly_inr_type,
        discount_monthly_inr_value: version.discount_monthly_inr_value,
        discount_yearly_inr_type: version.discount_yearly_inr_type,
        discount_yearly_inr_value: version.discount_yearly_inr_value,
        price_monthly_usd: version.price_monthly_usd,
        price_yearly_usd: version.price_yearly_usd,
        discount_monthly_usd_type: version.discount_monthly_usd_type,
        discount_monthly_usd_value: version.discount_monthly_usd_value,
        discount_yearly_usd_type: version.discount_yearly_usd_type,
        discount_yearly_usd_value: version.discount_yearly_usd_value,
        // Two-yearly pricing
        price_two_yearly_inr: version.price_two_yearly_inr || 0,
        price_two_yearly_usd: version.price_two_yearly_usd || 0,
        discount_two_yearly_inr_type:
          version.discount_two_yearly_inr_type || 'NONE',
        discount_two_yearly_inr_value:
          version.discount_two_yearly_inr_value || 0,
        discount_two_yearly_usd_type:
          version.discount_two_yearly_usd_type || 'NONE',
        discount_two_yearly_usd_value:
          version.discount_two_yearly_usd_value || 0,
        // Offer fields
        is_offer: version.is_offer || false,
        offer_name: version.offer_name || '',
        offer_description: version.offer_description || '',
        offer_valid_from: version.offer_valid_from
          ? version.offer_valid_from.split('T')[0]
          : '',
        offer_valid_to: version.offer_valid_to
          ? version.offer_valid_to.split('T')[0]
          : '',
      });
    }
    setIsEditingPricing(false);
  };

  const handleSaveOffer = async () => {
    try {
      await updateVersionMutation.mutateAsync({
        planId,
        versionId,
        data: {
          is_offer: pricingForm.is_offer,
          offer_name: pricingForm.offer_name || null,
          offer_description: pricingForm.offer_description || null,
          offer_valid_from: pricingForm.offer_valid_from || null,
          offer_valid_to: pricingForm.offer_valid_to || null,
        },
      });
      setIsEditingOffer(false);
      setError(null);
      refetchVersion();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update offer settings',
      );
    }
  };

  const handleCancelOfferEdit = () => {
    // Reset offer fields to current version values
    if (version) {
      setPricingForm((prev) => ({
        ...prev,
        is_offer: version.is_offer || false,
        offer_name: version.offer_name || '',
        offer_description: version.offer_description || '',
        offer_valid_from: version.offer_valid_from
          ? version.offer_valid_from.split('T')[0]
          : '',
        offer_valid_to: version.offer_valid_to
          ? version.offer_valid_to.split('T')[0]
          : '',
      }));
    }
    setIsEditingOffer(false);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (planLoading || versionLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <Loader2 className='h-12 w-12 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading version details...</p>
        </div>
      </div>
    );
  }

  if (!plan || !version) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-amber-500' />
          <h3 className='mt-4 text-lg font-semibold text-textPrimary'>
            Version not found
          </h3>
          <Link
            href={`/plans/${planId}/edit`}
            className='mt-4 inline-flex items-center text-sm font-medium text-primarySolid hover:underline'
          >
            Back to Plan
          </Link>
        </div>
      </div>
    );
  }

  // Pricing frequency helpers
  const showMonthlyPricing =
    version.pricing_frequency === 'MONTHLY' ||
    version.pricing_frequency === 'BOTH' ||
    version.pricing_frequency === 'ALL';
  const showYearlyPricing =
    version.pricing_frequency === 'YEARLY' ||
    version.pricing_frequency === 'BOTH' ||
    version.pricing_frequency === 'ALL';
  const showTwoYearlyPricing =
    version.pricing_frequency === 'TWO_YEARLY' ||
    version.pricing_frequency === 'ALL' ||
    version.pricing_frequency === 'BOTH';

  return (
    <div className='p-8'>
      {/* Breadcrumb */}
      <section className='mb-6'>
        <div className='mb-4 flex items-center text-sm text-textSecondary'>
          <Link href='/plans' className='hover:text-primary'>
            Catalog
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <Link href='/plans' className='hover:text-primary'>
            Plans
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <Link href={`/plans/${planId}/edit`} className='hover:text-primary'>
            {plan.name}
          </Link>
          <ChevronRight className='mx-2 h-3 w-3' />
          <span className='font-medium text-textPrimary'>
            Version {version.version}
          </span>
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <div className='mb-2 flex items-center gap-3'>
              <h1 className='text-3xl font-bold text-textPrimary'>
                {plan.name} - Version {version.version}
              </h1>
              {version.is_offer && (
                <span className='text-sm font-semibold text-orange-700'>
                  Offer
                </span>
              )}
            </div>
            <p className='text-textSecondary'>
              Configure pricing, products, and publish settings
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Link
              href={`/plans/${planId}/edit`}
              className='flex h-10 items-center rounded-full border border-border px-5 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back to Plan
            </Link>
            {canModify && (
              <button
                onClick={openPublishModal}
                className='flex h-10 items-center rounded-full bg-success px-5 text-sm font-semibold text-white transition hover:bg-green-600'
              >
                <Play className='mr-2 h-4 w-4' />
                Publish Version
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-center'>
            <AlertCircle className='mr-2 h-5 w-5 text-error' />
            <span className='text-sm text-error'>{error}</span>
            <button
              onClick={() => setError(null)}
              className='ml-auto text-error hover:text-red-700'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        </section>
      )}

      <div className='grid grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='col-span-2 space-y-6'>
          {/* Version Status Banner */}
          {isPublished && !isRetired && (
            <div className='rounded-lg border border-green-200 bg-green-50 p-4'>
              <div className='flex items-center'>
                <Check className='mr-2 h-5 w-5 text-success' />
                <span className='font-semibold text-success'>
                  This version is currently active
                </span>
              </div>
              <p className='mt-1 text-sm text-textSecondary'>
                Published on {formatDate(version.published_at)}. Products and
                pricing cannot be modified.
              </p>
            </div>
          )}

          {isRetired && (
            <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <AlertTriangle className='mr-2 h-5 w-5 text-textSecondary' />
                  <span className='font-semibold text-textSecondary'>
                    This version has been retired
                  </span>
                </div>
                <button
                  onClick={openReactivateModal}
                  className='flex items-center rounded-lg bg-primarySolid px-4 py-2 text-sm font-semibold text-white transition hover:bg-primaryHover'
                >
                  <Play className='mr-2 h-4 w-4' />
                  Reactivate
                </button>
              </div>
              <p className='mt-2 text-sm text-textSecondary'>
                Retired on {formatDate(version.retired_at)}. You can reactivate
                this version to make it active again.
              </p>
            </div>
          )}

          {/* Pricing Section */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <div className='flex items-center'>
                <div className='flex items-center h-5 w-5'>
                  <DollarSign className='h-5 w-5 text-success' />
                </div>
                <div className='ml-4'>
                  <div className='flex items-center gap-2'>
                    <h2 className='text-xl font-semibold text-textPrimary'>
                      Pricing
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        version.pricing_frequency === 'MONTHLY'
                          ? 'bg-primary-100 text-primary-700'
                          : version.pricing_frequency === 'YEARLY'
                            ? 'bg-purple-100 text-purple-700'
                            : version.pricing_frequency === 'TWO_YEARLY'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {version.pricing_frequency === 'BOTH'
                        ? 'Monthly & Yearly'
                        : version.pricing_frequency === 'ALL'
                          ? 'All Cycles'
                          : version.pricing_frequency === 'TWO_YEARLY'
                            ? '2-Yearly'
                            : version.pricing_frequency}
                    </span>
                    {version.purchase_mode && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          version.purchase_mode === 'FREE'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {version.purchase_mode}
                      </span>
                    )}
                  </div>
                  <p className='text-sm text-textSecondary'>
                    {version.purchase_mode === 'FREE'
                      ? 'This is a free plan version'
                      : version.pricing_frequency === 'MONTHLY'
                        ? 'Monthly pricing in INR and USD'
                        : version.pricing_frequency === 'YEARLY'
                          ? 'Yearly pricing in INR and USD'
                          : version.pricing_frequency === 'TWO_YEARLY'
                            ? 'Two-yearly pricing in INR and USD'
                            : version.pricing_frequency === 'ALL'
                              ? 'Monthly, yearly, and two-yearly pricing in INR and USD'
                              : 'Monthly and yearly pricing in INR and USD'}
                  </p>
                </div>
              </div>
              {canModify && !isEditingPricing && (
                <button
                  onClick={() => setIsEditingPricing(true)}
                  className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                >
                  <Edit2 className='mr-2 h-4 w-4' />
                  Edit Pricing
                </button>
              )}
            </div>

            {isEditingPricing ? (
              <>
                <div className='grid grid-cols-2 gap-6'>
                  {/* INR Pricing - Editable */}
                  <div className='rounded-lg border border-primary bg-primary-50 p-4'>
                    <h3 className='mb-4 font-semibold text-textPrimary'>
                      INR Pricing
                    </h3>
                    <div className='space-y-4'>
                      {showMonthlyPricing && (
                        <>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Monthly Price (INR)
                            </label>
                            <input
                              type='number'
                              value={pricingForm.price_monthly_inr}
                              onChange={(e) =>
                                setPricingForm((prev) => ({
                                  ...prev,
                                  price_monthly_inr:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                              step='0.01'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Monthly Discount Type
                              </label>
                              <select
                                value={pricingForm.discount_monthly_inr_type}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_monthly_inr_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Value
                              </label>
                              <input
                                type='number'
                                value={pricingForm.discount_monthly_inr_value}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_monthly_inr_value:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                disabled={
                                  pricingForm.discount_monthly_inr_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </>
                      )}
                      {showYearlyPricing && (
                        <>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Yearly Price (INR)
                            </label>
                            <input
                              type='number'
                              value={pricingForm.price_yearly_inr}
                              onChange={(e) =>
                                setPricingForm((prev) => ({
                                  ...prev,
                                  price_yearly_inr:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                              step='0.01'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Yearly Discount Type
                              </label>
                              <select
                                value={pricingForm.discount_yearly_inr_type}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_yearly_inr_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Value
                              </label>
                              <input
                                type='number'
                                value={pricingForm.discount_yearly_inr_value}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_yearly_inr_value:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                disabled={
                                  pricingForm.discount_yearly_inr_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </>
                      )}
                      {showTwoYearlyPricing && (
                        <>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Two-Yearly Price (INR)
                            </label>
                            <input
                              type='number'
                              value={pricingForm.price_two_yearly_inr}
                              onChange={(e) =>
                                setPricingForm((prev) => ({
                                  ...prev,
                                  price_two_yearly_inr:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                              step='0.01'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Two-Yearly Discount Type
                              </label>
                              <select
                                value={pricingForm.discount_two_yearly_inr_type}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_two_yearly_inr_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Value
                              </label>
                              <input
                                type='number'
                                value={
                                  pricingForm.discount_two_yearly_inr_value
                                }
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_two_yearly_inr_value:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                disabled={
                                  pricingForm.discount_two_yearly_inr_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* USD Pricing - Editable */}
                  <div className='rounded-lg border border-primary bg-primary-50 p-4'>
                    <h3 className='mb-4 font-semibold text-textPrimary'>
                      USD Pricing
                    </h3>
                    <div className='space-y-4'>
                      {showMonthlyPricing && (
                        <>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Monthly Price (USD)
                            </label>
                            <input
                              type='number'
                              value={pricingForm.price_monthly_usd}
                              onChange={(e) =>
                                setPricingForm((prev) => ({
                                  ...prev,
                                  price_monthly_usd:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                              step='0.01'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Monthly Discount Type
                              </label>
                              <select
                                value={pricingForm.discount_monthly_usd_type}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_monthly_usd_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Value
                              </label>
                              <input
                                type='number'
                                value={pricingForm.discount_monthly_usd_value}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_monthly_usd_value:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                disabled={
                                  pricingForm.discount_monthly_usd_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </>
                      )}
                      {showYearlyPricing && (
                        <>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Yearly Price (USD)
                            </label>
                            <input
                              type='number'
                              value={pricingForm.price_yearly_usd}
                              onChange={(e) =>
                                setPricingForm((prev) => ({
                                  ...prev,
                                  price_yearly_usd:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                              step='0.01'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Yearly Discount Type
                              </label>
                              <select
                                value={pricingForm.discount_yearly_usd_type}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_yearly_usd_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Value
                              </label>
                              <input
                                type='number'
                                value={pricingForm.discount_yearly_usd_value}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_yearly_usd_value:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                disabled={
                                  pricingForm.discount_yearly_usd_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </>
                      )}
                      {showTwoYearlyPricing && (
                        <>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Two-Yearly Price (USD)
                            </label>
                            <input
                              type='number'
                              value={pricingForm.price_two_yearly_usd}
                              onChange={(e) =>
                                setPricingForm((prev) => ({
                                  ...prev,
                                  price_two_yearly_usd:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                              step='0.01'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Two-Yearly Discount Type
                              </label>
                              <select
                                value={pricingForm.discount_two_yearly_usd_type}
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_two_yearly_usd_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Value
                              </label>
                              <input
                                type='number'
                                value={
                                  pricingForm.discount_two_yearly_usd_value
                                }
                                onChange={(e) =>
                                  setPricingForm((prev) => ({
                                    ...prev,
                                    discount_two_yearly_usd_value:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                disabled={
                                  pricingForm.discount_two_yearly_usd_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Purchase Mode Toggle (Draft only) */}
                {canModify && (
                  <div className='mt-4'>
                    <label className='block text-sm font-semibold text-textPrimary mb-3'>
                      Purchase Mode
                    </label>
                    <div className='flex space-x-3'>
                      {(['PAID', 'FREE'] as const).map((mode) => (
                        <button
                          key={mode}
                          type='button'
                          onClick={() =>
                            setPricingForm((prev) => ({
                              ...prev,
                              purchase_mode: mode,
                            }))
                          }
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            pricingForm.purchase_mode === mode
                              ? 'bg-primarySolid text-white'
                              : 'bg-bgGray text-textSecondary hover:bg-gray-200'
                          }`}
                        >
                          {mode === 'FREE' ? 'Free' : 'Paid'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className='mt-4 flex justify-end space-x-3'>
                  <button
                    onClick={handleCancelPricingEdit}
                    className='h-10 rounded-lg border border-border px-5 text-sm font-medium text-textPrimary hover:bg-bgGray'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePricing}
                    disabled={updateVersionMutation.isLoading}
                    className='flex h-10 items-center rounded-lg bg-primarySolid px-5 text-sm font-medium text-white hover:bg-primaryHover disabled:opacity-50'
                  >
                    {updateVersionMutation.isLoading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <Save className='mr-2 h-4 w-4' />
                    )}
                    Save Pricing
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className='grid grid-cols-2 gap-6'>
                  {/* INR Pricing - Read-only */}
                  <div className='rounded-lg border border-border p-4'>
                    <h3 className='mb-4 font-semibold text-textPrimary'>
                      INR Pricing
                    </h3>
                    <div className='space-y-4'>
                      {showMonthlyPricing && (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Monthly
                          </label>
                          <div className='text-2xl font-bold text-textPrimary'>
                            {formatCurrency(version.price_monthly_inr, 'INR')}
                          </div>
                          {version.discount_monthly_inr_type !== 'NONE' && (
                            <div className='mt-1 text-xs text-success'>
                              {version.discount_monthly_inr_type ===
                              'PERCENTAGE'
                                ? `${version.discount_monthly_inr_value}% off`
                                : `₹${version.discount_monthly_inr_value} off`}
                            </div>
                          )}
                        </div>
                      )}
                      {showYearlyPricing && (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Yearly
                          </label>
                          <div className='text-2xl font-bold text-textPrimary'>
                            {formatCurrency(version.price_yearly_inr, 'INR')}
                          </div>
                          {version.discount_yearly_inr_type !== 'NONE' && (
                            <div className='mt-1 text-xs text-success'>
                              {version.discount_yearly_inr_type === 'PERCENTAGE'
                                ? `${version.discount_yearly_inr_value}% off`
                                : `₹${version.discount_yearly_inr_value} off`}
                            </div>
                          )}
                        </div>
                      )}
                      {showTwoYearlyPricing && (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Two-Yearly
                          </label>
                          <div className='text-2xl font-bold text-textPrimary'>
                            {formatCurrency(
                              version.price_two_yearly_inr,
                              'INR',
                            )}
                          </div>
                          {version.discount_two_yearly_inr_type !== 'NONE' && (
                            <div className='mt-1 text-xs text-success'>
                              {version.discount_two_yearly_inr_type ===
                              'PERCENTAGE'
                                ? `${version.discount_two_yearly_inr_value}% off`
                                : `₹${version.discount_two_yearly_inr_value} off`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* USD Pricing - Read-only */}
                  <div className='rounded-lg border border-border p-4'>
                    <h3 className='mb-4 font-semibold text-textPrimary'>
                      USD Pricing
                    </h3>
                    <div className='space-y-4'>
                      {showMonthlyPricing && (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Monthly
                          </label>
                          <div className='text-2xl font-bold text-textPrimary'>
                            {formatCurrency(version.price_monthly_usd, 'USD')}
                          </div>
                          {version.discount_monthly_usd_type !== 'NONE' && (
                            <div className='mt-1 text-xs text-success'>
                              {version.discount_monthly_usd_type ===
                              'PERCENTAGE'
                                ? `${version.discount_monthly_usd_value}% off`
                                : `$${version.discount_monthly_usd_value} off`}
                            </div>
                          )}
                        </div>
                      )}
                      {showYearlyPricing && (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Yearly
                          </label>
                          <div className='text-2xl font-bold text-textPrimary'>
                            {formatCurrency(version.price_yearly_usd, 'USD')}
                          </div>
                          {version.discount_yearly_usd_type !== 'NONE' && (
                            <div className='mt-1 text-xs text-success'>
                              {version.discount_yearly_usd_type === 'PERCENTAGE'
                                ? `${version.discount_yearly_usd_value}% off`
                                : `$${version.discount_yearly_usd_value} off`}
                            </div>
                          )}
                        </div>
                      )}
                      {showTwoYearlyPricing && (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Two-Yearly
                          </label>
                          <div className='text-2xl font-bold text-textPrimary'>
                            {formatCurrency(
                              version.price_two_yearly_usd,
                              'USD',
                            )}
                          </div>
                          {version.discount_two_yearly_usd_type !== 'NONE' && (
                            <div className='mt-1 text-xs text-success'>
                              {version.discount_two_yearly_usd_type ===
                              'PERCENTAGE'
                                ? `${version.discount_two_yearly_usd_value}% off`
                                : `$${version.discount_two_yearly_usd_value} off`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isPublished && (
                  <p className='mt-4 text-sm text-textSecondary'>
                    Note: Published versions are immutable. To change pricing,
                    create a new version with the desired pricing.
                  </p>
                )}
              </>
            )}
          </section>

          {/* Offer Settings Section */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <div className='flex items-center'>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    version.is_offer ? 'bg-orange-100' : 'bg-gray-100'
                  }`}
                >
                  <GitBranch
                    className={`h-5 w-5 ${
                      version.is_offer ? 'text-orange-600' : 'text-gray-500'
                    }`}
                  />
                </div>
                <div className='ml-4'>
                  <h2 className='text-xl font-semibold text-textPrimary'>
                    Offer Settings
                  </h2>
                  <p className='text-sm text-textSecondary'>
                    Configure this version as a promotional offer
                  </p>
                </div>
              </div>
              {canModify && !isEditingOffer && (
                <button
                  onClick={() => setIsEditingOffer(true)}
                  className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                >
                  <Edit2 className='mr-2 h-4 w-4' />
                  Edit Offer
                </button>
              )}
            </div>

            {isEditingOffer ? (
              <>
                {/* Offer Edit Form */}
                <div className='rounded-lg border border-primary bg-primary-50 p-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center'>
                      <input
                        type='checkbox'
                        id='is_offer_edit'
                        checked={pricingForm.is_offer}
                        onChange={(e) =>
                          setPricingForm((prev) => ({
                            ...prev,
                            is_offer: e.target.checked,
                          }))
                        }
                        className='mr-3 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
                      />
                      <label
                        htmlFor='is_offer_edit'
                        className='font-semibold text-textPrimary'
                      >
                        Mark as Promotional Offer
                      </label>
                    </div>
                    {pricingForm.is_offer && (
                      <span className='text-xs font-semibold text-orange-700'>
                        Offer Version
                      </span>
                    )}
                  </div>

                  {pricingForm.is_offer && (
                    <div className='mt-4 space-y-4'>
                      <p className='text-sm text-textSecondary'>
                        Configure promotional offer details. This helps identify
                        offer versions and manage promotional periods.
                      </p>

                      <div className='grid grid-cols-2 gap-4'>
                        <div className='col-span-2'>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Offer Name
                          </label>
                          <input
                            type='text'
                            value={pricingForm.offer_name}
                            onChange={(e) =>
                              setPricingForm((prev) => ({
                                ...prev,
                                offer_name: e.target.value,
                              }))
                            }
                            placeholder='e.g., Diwali Sale - 30% Off'
                            className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                          />
                        </div>

                        <div className='col-span-2'>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Offer Description
                          </label>
                          <textarea
                            value={pricingForm.offer_description}
                            onChange={(e) =>
                              setPricingForm((prev) => ({
                                ...prev,
                                offer_description: e.target.value,
                              }))
                            }
                            placeholder='e.g., Limited time offer for new customers'
                            rows={2}
                            className='w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none'
                          />
                        </div>

                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Valid From
                          </label>
                          <input
                            type='date'
                            value={pricingForm.offer_valid_from}
                            onChange={(e) =>
                              setPricingForm((prev) => ({
                                ...prev,
                                offer_valid_from: e.target.value,
                              }))
                            }
                            className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                          />
                        </div>

                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Valid To
                          </label>
                          <input
                            type='date'
                            value={pricingForm.offer_valid_to}
                            onChange={(e) =>
                              setPricingForm((prev) => ({
                                ...prev,
                                offer_valid_to: e.target.value,
                              }))
                            }
                            className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                          />
                        </div>
                      </div>

                      <p className='text-xs text-textSecondary'>
                        Note: Validity dates are for reference only. Remember to
                        manually retire the offer version and reactivate the
                        normal version when the offer period ends.
                      </p>
                    </div>
                  )}
                </div>

                <div className='mt-4 flex justify-end space-x-3'>
                  <button
                    onClick={handleCancelOfferEdit}
                    className='h-10 rounded-lg border border-border px-5 text-sm font-medium text-textPrimary hover:bg-bgGray'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOffer}
                    disabled={updateVersionMutation.isLoading}
                    className='flex h-10 items-center rounded-lg bg-primarySolid px-5 text-sm font-medium text-white hover:bg-primaryHover disabled:opacity-50'
                  >
                    {updateVersionMutation.isLoading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <Save className='mr-2 h-4 w-4' />
                    )}
                    Save Offer Settings
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Offer Read-only View */}
                {version.is_offer ? (
                  <div className='rounded-lg border border-orange-200 bg-orange-50 p-4'>
                    <div className='mb-3 flex items-center'>
                      <span className='text-sm font-semibold text-orange-700'>
                        Promotional Offer
                      </span>
                    </div>
                    {version.offer_name && (
                      <div className='mb-2'>
                        <span className='font-semibold text-textPrimary'>
                          {version.offer_name}
                        </span>
                      </div>
                    )}
                    {version.offer_description && (
                      <p className='mb-3 text-sm text-textSecondary'>
                        {version.offer_description}
                      </p>
                    )}
                    {(version.offer_valid_from || version.offer_valid_to) && (
                      <div className='text-sm text-textSecondary'>
                        <span className='font-medium'>Validity: </span>
                        {version.offer_valid_from
                          ? formatDate(version.offer_valid_from)
                          : 'Start date not set'}
                        {' - '}
                        {version.offer_valid_to
                          ? formatDate(version.offer_valid_to)
                          : 'End date not set'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
                    <p className='text-sm text-textSecondary'>
                      This version is not configured as a promotional offer.
                      {canModify && (
                        <span>
                          {' '}
                          Click &quot;Edit Offer&quot; to configure offer
                          settings.
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {isPublished && (
                  <p className='mt-4 text-sm text-textSecondary'>
                    Note: Published versions are immutable. To change offer
                    settings, create a new version.
                  </p>
                )}
              </>
            )}
          </section>

          {/* Products Section */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center justify-between'>
              <div className='flex items-center'>
                <div className='flex items-center h-5 w-5'>
                  <Package className='h-5 w-5 text-purple-600' />
                </div>
                <div className='ml-4'>
                  <h2 className='text-xl font-semibold text-textPrimary'>
                    Products & Limits
                  </h2>
                  <p className='text-sm text-textSecondary'>
                    Define product entitlements for this plan version
                  </p>
                </div>
              </div>
              {canModify && (
                <button
                  onClick={() => setShowAddProduct(true)}
                  className='flex h-10 items-center rounded-lg bg-primarySolid px-4 text-sm font-semibold text-white transition hover:bg-primaryHover'
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Add Product
                </button>
              )}
            </div>

            {/* Add Product Form */}
            {showAddProduct && (
              <div className='mb-6 rounded-lg border border-primary bg-primary-50 p-4'>
                <h4 className='mb-4 font-semibold text-textPrimary'>
                  Add Product to Version
                </h4>
                <div className='space-y-4'>
                  <div>
                    <label className='mb-1 block text-sm text-textSecondary'>
                      Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        // Auto-set for BOOLEAN products
                        const prod = availableProducts.find(
                          (p) => p.id === e.target.value,
                        );
                        if (prod?.constraint_type === 'BOOLEAN') {
                          setProductLimit(1);
                          setIsUnlimited(false);
                        }
                      }}
                      className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                    >
                      <option value=''>Select a product...</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {decodeHtmlEntities(p.feature_name)}, {p.code}{' '}
                          ({p.constraint_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const selectedProd = availableProducts.find(
                      (p) => p.id === selectedProductId,
                    );
                    if (
                      selectedProd &&
                      selectedProd.constraint_type === 'BOOLEAN'
                    ) {
                      return (
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Enabled
                          </label>
                          <button
                            type='button'
                            onClick={() =>
                              setProductLimit(productLimit === 1 ? 0 : 1)
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${productLimit === 1 ? 'bg-primarySolid' : 'bg-gray-300'}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${productLimit === 1 ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                          </button>
                          <span className='ml-3 text-sm text-textPrimary'>
                            {productLimit === 1 ? 'On' : 'Off'}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <label className='mb-1 block text-sm text-textSecondary'>
                            Limit Value
                          </label>
                          <input
                            type='number'
                            value={productLimit}
                            onChange={(e) =>
                              setProductLimit(parseInt(e.target.value) || 0)
                            }
                            disabled={isUnlimited}
                            className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none disabled:bg-gray-100'
                          />
                        </div>
                        <div className='flex items-end'>
                          <label className='flex cursor-pointer items-center'>
                            <input
                              type='checkbox'
                              checked={isUnlimited}
                              onChange={(e) => setIsUnlimited(e.target.checked)}
                              className='mr-2 h-4 w-4'
                            />
                            <span className='text-sm text-textPrimary'>
                              Unlimited
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className='mt-4 flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowAddProduct(false);
                      setSelectedProductId('');
                      setProductLimit(0);
                      setIsUnlimited(false);
                    }}
                    className='h-9 rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProduct}
                    disabled={addProductMutation.isLoading}
                    className='flex h-9 items-center rounded-lg bg-primarySolid px-4 text-sm font-medium text-white hover:bg-primaryHover disabled:opacity-50'
                  >
                    {addProductMutation.isLoading && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    Add Product
                  </button>
                </div>
              </div>
            )}

            {/* Products List */}
            {version.products && version.products.length > 0 ? (
              <div className='overflow-hidden rounded-lg border border-border'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-border'>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Product Code
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Feature
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Type
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Limit
                      </th>
                      {canModify && (
                        <th className='px-4 py-3 text-right text-sm font-semibold text-textSecondary'>
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {version.products.map((product: PlanVersionProduct) => (
                      <tr
                        key={product.id}
                        className='border-b border-border last:border-0'
                      >
                        <td className='px-4 py-3'>
                          <span className='font-mono text-sm font-semibold text-textPrimary'>
                            {product.product_code}
                          </span>
                        </td>
                        <td className='px-4 py-3 text-sm text-textSecondary'>
                          {product.feature_key}
                        </td>
                        <td className='px-4 py-3'>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              product.constraint_type === 'BOOLEAN'
                                ? 'bg-primary-50 text-primary-600'
                                : product.constraint_type === 'COUNT'
                                  ? 'bg-green-50 text-success'
                                  : 'bg-orange-50 text-orange-600'
                            }`}
                          >
                            {product.constraint_type}
                          </span>
                        </td>
                        <td className='px-4 py-3'>
                          {product.is_unlimited ? (
                            <span className='font-semibold text-success'>
                              Unlimited
                            </span>
                          ) : (
                            <span className='font-semibold text-textPrimary'>
                              {product.limit_value}
                              {product.unit && (
                                <span className='ml-1 text-textSecondary'>
                                  {product.unit}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        {canModify && (
                          <td className='px-4 py-3 text-right'>
                            <button
                              onClick={() =>
                                handleRemoveProduct(product.product_id)
                              }
                              disabled={removeProductMutation.isLoading}
                              className='text-error hover:text-red-700 disabled:opacity-50'
                            >
                              <Trash2 className='h-4 w-4' />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='rounded-lg border-2 border-dashed border-border py-12 text-center'>
                <Package className='mx-auto h-12 w-12 text-textSecondary opacity-30' />
                <p className='mt-4 text-textSecondary'>
                  No products added to this version yet
                </p>
                {canModify && (
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className='mt-4 text-sm font-medium text-primarySolid hover:underline'
                  >
                    Add your first product
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className='col-span-1 space-y-6'>
          {/* Version Info */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='mb-4 flex items-center'>
              <GitBranch className='mr-2 h-5 w-5 text-primarySolid' />
              <h3 className='font-semibold text-textPrimary'>Version Info</h3>
            </div>
            <div className='space-y-4'>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Version</span>
                <span className='font-semibold text-textPrimary'>
                  {version.version}
                </span>
              </div>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Status</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    version.is_active
                      ? 'bg-green-50 text-success'
                      : version.retired_at
                        ? 'bg-gray-100 text-textSecondary'
                        : 'bg-amber-50 text-warning'
                  }`}
                >
                  {version.is_active
                    ? 'Active'
                    : version.retired_at
                      ? 'Retired'
                      : 'Draft'}
                </span>
              </div>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Mode</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    version.purchase_mode === 'FREE'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {version.purchase_mode || 'PAID'}
                </span>
              </div>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Products</span>
                <span className='font-semibold text-textPrimary'>
                  {version.products?.length || 0}
                </span>
              </div>
              <div className='flex items-center justify-between border-b border-border pb-3'>
                <span className='text-sm text-textSecondary'>Created</span>
                <span className='text-sm text-textSecondary'>
                  {formatDate(version.created_at)}
                </span>
              </div>
              {version.published_at && (
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-textSecondary'>Published</span>
                  <span className='text-sm text-textSecondary'>
                    {formatDate(version.published_at)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Actions */}
          <section className='border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 font-semibold text-textPrimary'>Actions</h3>
            <div className='space-y-3'>
              {canModify && (
                <button
                  onClick={openPublishModal}
                  className='flex w-full items-center justify-center rounded-lg bg-success px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600'
                >
                  <Play className='mr-2 h-4 w-4' />
                  Publish Version
                </button>
              )}
              {isPublished && !isRetired && (
                <button
                  onClick={openRetireModal}
                  className='flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                >
                  <AlertTriangle className='mr-2 h-4 w-4' />
                  Retire Version
                </button>
              )}
              {isPublished && (
                <button
                  onClick={() => setSyncModalOpen(true)}
                  className='flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                  title="Grant this version's products to tenants already on the plan"
                >
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Sync to Existing Tenants
                </button>
              )}
              {isRetired && (
                <button
                  onClick={openReactivateModal}
                  className='flex w-full items-center justify-center rounded-lg bg-primarySolid px-4 py-3 text-sm font-semibold text-white transition hover:bg-primaryHover'
                >
                  <Play className='mr-2 h-4 w-4' />
                  Reactivate Version
                </button>
              )}
              <Link
                href={`/plans/${planId}/edit`}
                className='flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
              >
                <ArrowLeft className='mr-2 h-4 w-4' />
                Back to Plan
              </Link>
            </div>
          </section>

          {/* Help */}
          <section className='rounded-lg border border-amber-200 bg-amber-50 p-6'>
            <div className='flex items-start'>
              <AlertTriangle className='mr-3 h-5 w-5 text-warning' />
              <div>
                <h4 className='font-semibold text-textPrimary'>
                  {canModify ? 'Draft Version' : 'Version Immutability'}
                </h4>
                <p className='mt-1 text-sm text-textSecondary'>
                  {canModify
                    ? 'This is a draft version. You can edit pricing, add/remove products, and publish when ready. Once published, it cannot be modified.'
                    : 'Once published, plan versions cannot be modified. To make changes, create a new version with updated pricing and products.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'publish'}
        onClose={closeConfirmModal}
        onConfirm={handlePublish}
        title='Publish Version'
        message='Are you sure you want to publish this version? This will make it the active version and any existing active version will be retired.'
        confirmText='Publish'
        cancelText='Cancel'
        variant='success'
        isLoading={publishMutation.isLoading}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'retire'}
        onClose={closeConfirmModal}
        onConfirm={handleRetire}
        title='Retire Version'
        message='Are you sure you want to retire this version? This action cannot be undone.'
        confirmText='Retire'
        cancelText='Cancel'
        variant='warning'
        isLoading={retireMutation.isLoading}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen && confirmModal.type === 'reactivate'}
        onClose={closeConfirmModal}
        onConfirm={handleReactivate}
        title='Reactivate Version'
        message='Are you sure you want to reactivate this version? This will make it the active version and retire any currently active version.'
        confirmText='Reactivate'
        cancelText='Cancel'
        variant='success'
        isLoading={publishMutation.isLoading}
      />

      {syncModalOpen && version && (
        <EntitlementSyncModal
          planId={planId}
          sourceVersionId={versionId}
          planName={plan?.name}
          versionNumber={version.version}
          onClose={() => setSyncModalOpen(false)}
        />
      )}
    </div>
  );
}
