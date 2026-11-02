'use client';

import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Download,
  GitBranch,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  useCreatePlanVersion,
  useGetPlan,
  useGetPlans,
  useGetPlanVersion,
  useGetPlanVersions,
} from '@/lib/api/hooks/usePlans';
import { useGetProducts } from '@/lib/api/hooks/useProducts';
import {
  CreatePlanVersionRequest,
  DiscountType,
  PlanVersion,
  PlanVersionProduct,
  PricingFrequency,
  Product,
  PurchaseMode,
} from '@/lib/api/types';
import { decodeHtmlEntities } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface SelectedProduct {
  product_id: string;
  product_code: string;
  constraint_type: string;
  unit: string | null;
  limit_value: number;
  is_unlimited: boolean;
}

export default function CreatePlanVersionPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    purchase_mode: PurchaseMode;
    pricing_frequency: PricingFrequency;
    // Monthly pricing
    price_monthly_inr: number;
    price_monthly_usd: number;
    discount_monthly_inr_type: DiscountType;
    discount_monthly_inr_value: number;
    discount_monthly_usd_type: DiscountType;
    discount_monthly_usd_value: number;
    // Yearly pricing
    price_yearly_inr: number;
    price_yearly_usd: number;
    discount_yearly_inr_type: DiscountType;
    discount_yearly_inr_value: number;
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
  }>({
    purchase_mode: 'PAID',
    pricing_frequency: 'BOTH',
    // Monthly pricing
    price_monthly_inr: 0,
    price_monthly_usd: 0,
    discount_monthly_inr_type: 'NONE',
    discount_monthly_inr_value: 0,
    discount_monthly_usd_type: 'NONE',
    discount_monthly_usd_value: 0,
    // Yearly pricing
    price_yearly_inr: 0,
    price_yearly_usd: 0,
    discount_yearly_inr_type: 'NONE',
    discount_yearly_inr_value: 0,
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

  // Product selection state
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    [],
  );
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productLimit, setProductLimit] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);

  // Import from version state
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importPlanSearch, setImportPlanSearch] = useState('');
  const [importPlanId, setImportPlanId] = useState('');
  const [importPlanDropdownOpen, setImportPlanDropdownOpen] = useState(false);
  const [importVersionId, setImportVersionId] = useState('');
  const [importProductSearch, setImportProductSearch] = useState('');
  const [importSelectedIds, setImportSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const importPlanDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch plan data
  const { data: plan, isLoading: planLoading } = useGetPlan(planId);

  // Pre-populate form from the latest version (so admin doesn't re-enter pricing)
  const hasPrefilled = useRef(false);
  useEffect(() => {
    if (!plan?.latest_version || hasPrefilled.current) return;
    hasPrefilled.current = true;
    const v = plan.latest_version;
    setFormData((prev) => ({
      ...prev,
      purchase_mode: v.purchase_mode ?? prev.purchase_mode,
      pricing_frequency: v.pricing_frequency ?? prev.pricing_frequency,
      price_monthly_inr: v.price_monthly_inr,
      price_monthly_usd: v.price_monthly_usd,
      discount_monthly_inr_type: v.discount_monthly_inr_type,
      discount_monthly_inr_value: v.discount_monthly_inr_value,
      discount_monthly_usd_type: v.discount_monthly_usd_type,
      discount_monthly_usd_value: v.discount_monthly_usd_value,
      price_yearly_inr: v.price_yearly_inr,
      price_yearly_usd: v.price_yearly_usd,
      discount_yearly_inr_type: v.discount_yearly_inr_type,
      discount_yearly_inr_value: v.discount_yearly_inr_value,
      discount_yearly_usd_type: v.discount_yearly_usd_type,
      discount_yearly_usd_value: v.discount_yearly_usd_value,
      price_two_yearly_inr: v.price_two_yearly_inr,
      price_two_yearly_usd: v.price_two_yearly_usd,
      discount_two_yearly_inr_type: v.discount_two_yearly_inr_type ?? 'NONE',
      discount_two_yearly_inr_value: v.discount_two_yearly_inr_value ?? 0,
      discount_two_yearly_usd_type: v.discount_two_yearly_usd_type ?? 'NONE',
      discount_two_yearly_usd_value: v.discount_two_yearly_usd_value ?? 0,
      is_offer: v.is_offer,
      offer_name: v.offer_name ?? '',
      offer_description: v.offer_description ?? '',
      offer_valid_from: v.offer_valid_from ?? '',
      offer_valid_to: v.offer_valid_to ?? '',
    }));
    // Also pre-populate products
    if (v.products?.length) {
      setSelectedProducts(
        v.products.map((p) => ({
          product_id: p.product_id,
          product_code: p.product_code,
          constraint_type: p.constraint_type,
          unit: p.unit,
          limit_value: p.is_unlimited ? 0 : (p.limit_value ?? 0),
          is_unlimited: p.is_unlimited,
        })),
      );
    }
  }, [plan?.latest_version]);

  // Fetch products for selection
  const { data: productsData } = useGetProducts({ limit: 100 });
  const allProducts = productsData?.products || [];

  // Filter products: exclude already selected, and only show products belonging to plan's linked applications
  const planAppCodes = plan?.applications?.map((a) => a.code) ?? [];
  const availableProducts = allProducts.filter(
    (p: Product) =>
      !selectedProducts.some((sp) => sp.product_id === p.id) &&
      (planAppCodes.length === 0 || planAppCodes.includes(p.application_code)),
  );

  // --- Import from version hooks ---
  const debouncedPlanSearch = useDebounce(importPlanSearch, 300);

  const { data: importPlansData, isLoading: importPlansLoading } = useGetPlans({
    search: debouncedPlanSearch || undefined,
    limit: 20,
    is_active: true,
  });
  const importPlans = importPlansData?.plans || [];

  const { data: importVersionsData } = useGetPlanVersions(
    importPlanId || undefined,
    { limit: 50 },
  );
  const importVersions = importVersionsData?.versions || [];

  const { data: importVersionDetail, isLoading: importVersionLoading } =
    useGetPlanVersion(importPlanId || undefined, importVersionId || undefined);

  // Filter version products to those compatible with current plan's apps
  const importableProducts = (importVersionDetail?.products || []).filter(
    (pvp: PlanVersionProduct) => {
      const product = allProducts.find((p: Product) => p.id === pvp.product_id);
      return (
        product &&
        (planAppCodes.length === 0 ||
          planAppCodes.includes(product.application_code))
      );
    },
  );

  // Further filter by product search text
  const filteredImportProducts = importProductSearch.trim()
    ? importableProducts.filter(
        (pvp: PlanVersionProduct) =>
          pvp.product_code
            .toLowerCase()
            .includes(importProductSearch.toLowerCase()) ||
          pvp.feature_key
            .toLowerCase()
            .includes(importProductSearch.toLowerCase()),
      )
    : importableProducts;

  const skippedCount =
    (importVersionDetail?.products?.length || 0) - importableProducts.length;

  // Mutation for creating version
  const createVersionMutation = useCreatePlanVersion();

  const showMonthlyFields =
    formData.pricing_frequency === 'MONTHLY' ||
    formData.pricing_frequency === 'BOTH' ||
    formData.pricing_frequency === 'ALL';
  const showYearlyFields =
    formData.pricing_frequency === 'YEARLY' ||
    formData.pricing_frequency === 'BOTH' ||
    formData.pricing_frequency === 'ALL';
  const showTwoYearlyFields =
    formData.pricing_frequency === 'TWO_YEARLY' ||
    formData.pricing_frequency === 'ALL' ||
    formData.pricing_frequency === 'BOTH';

  // Handle adding a product
  const handleAddProduct = () => {
    if (!selectedProductId) return;

    const product = allProducts.find(
      (p: Product) => p.id === selectedProductId,
    );
    if (!product) return;

    setSelectedProducts((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_code: product.code,
        constraint_type: product.constraint_type,
        unit: product.unit,
        limit_value: isUnlimited ? 0 : productLimit,
        is_unlimited: isUnlimited,
      },
    ]);

    // Reset form
    setSelectedProductId('');
    setProductLimit(0);
    setIsUnlimited(false);
    setShowAddProduct(false);
  };

  // Handle removing a product
  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.filter((p) => p.product_id !== productId),
    );
  };

  // Handle updating a product's limit/unlimited in the selected list
  const handleUpdateProduct = (
    productId: string,
    updates: Partial<Pick<SelectedProduct, 'limit_value' | 'is_unlimited'>>,
  ) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.product_id === productId ? { ...p, ...updates } : p)),
    );
  };

  // --- Import from version helpers ---
  const getVersionStatus = (v: PlanVersion) => {
    if (v.published_at && v.is_active)
      return { label: 'Active', color: 'bg-green-100 text-green-700' };
    if (v.published_at && !v.is_active)
      return { label: 'Retired', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Draft', color: 'bg-primary-100 text-primary-700' };
  };

  const toggleImportProduct = (productId: string) => {
    setImportSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleImportAll = () => {
    if (importSelectedIds.size === importableProducts.length) {
      setImportSelectedIds(new Set());
    } else {
      setImportSelectedIds(
        new Set(
          importableProducts.map((p: PlanVersionProduct) => p.product_id),
        ),
      );
    }
  };

  const handleImportProducts = () => {
    const toImport = importableProducts.filter((pvp: PlanVersionProduct) =>
      importSelectedIds.has(pvp.product_id),
    );

    const imported: SelectedProduct[] = toImport.map(
      (pvp: PlanVersionProduct) => ({
        product_id: pvp.product_id,
        product_code: pvp.product_code,
        constraint_type: pvp.constraint_type,
        unit: pvp.unit,
        limit_value: pvp.limit_value ?? 0,
        is_unlimited: pvp.is_unlimited,
      }),
    );

    setSelectedProducts(imported);
    setShowImportPanel(false);
    setImportPlanId('');
    setImportPlanSearch('');
    setImportVersionId('');
    setImportProductSearch('');
    setImportSelectedIds(new Set());
    setImportPlanDropdownOpen(false);
  };

  // Auto-select all importable products when version detail loads
  useEffect(() => {
    if (importVersionDetail && importableProducts.length > 0) {
      setImportSelectedIds(
        new Set(
          importableProducts.map((p: PlanVersionProduct) => p.product_id),
        ),
      );
    }
  }, [importVersionDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close import plan dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        importPlanDropdownRef.current &&
        !importPlanDropdownRef.current.contains(event.target as Node)
      ) {
        setImportPlanDropdownOpen(false);
      }
    };

    if (importPlanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [importPlanDropdownOpen]);

  const handleSubmit = async () => {
    try {
      setError(null);

      // Build request based on frequency
      const requestData: CreatePlanVersionRequest = {
        purchase_mode: formData.purchase_mode,
        pricing_frequency: formData.pricing_frequency,
      };

      if (formData.purchase_mode !== 'FREE') {
        if (showMonthlyFields) {
          requestData.price_monthly_inr = formData.price_monthly_inr;
          requestData.price_monthly_usd = formData.price_monthly_usd;
          requestData.discount_monthly_inr_type =
            formData.discount_monthly_inr_type;
          requestData.discount_monthly_inr_value =
            formData.discount_monthly_inr_value;
          requestData.discount_monthly_usd_type =
            formData.discount_monthly_usd_type;
          requestData.discount_monthly_usd_value =
            formData.discount_monthly_usd_value;
        }

        if (showYearlyFields) {
          requestData.price_yearly_inr = formData.price_yearly_inr;
          requestData.price_yearly_usd = formData.price_yearly_usd;
          requestData.discount_yearly_inr_type =
            formData.discount_yearly_inr_type;
          requestData.discount_yearly_inr_value =
            formData.discount_yearly_inr_value;
          requestData.discount_yearly_usd_type =
            formData.discount_yearly_usd_type;
          requestData.discount_yearly_usd_value =
            formData.discount_yearly_usd_value;
        }

        if (showTwoYearlyFields) {
          requestData.price_two_yearly_inr = formData.price_two_yearly_inr;
          requestData.price_two_yearly_usd = formData.price_two_yearly_usd;
          requestData.discount_two_yearly_inr_type =
            formData.discount_two_yearly_inr_type;
          requestData.discount_two_yearly_inr_value =
            formData.discount_two_yearly_inr_value;
          requestData.discount_two_yearly_usd_type =
            formData.discount_two_yearly_usd_type;
          requestData.discount_two_yearly_usd_value =
            formData.discount_two_yearly_usd_value;
        }
      }

      // Add offer fields if it's an offer
      if (formData.is_offer) {
        requestData.is_offer = true;
        requestData.offer_name = formData.offer_name || null;
        requestData.offer_description = formData.offer_description || null;
        requestData.offer_valid_from = formData.offer_valid_from || null;
        requestData.offer_valid_to = formData.offer_valid_to || null;
      }

      // Add products if any are selected
      if (selectedProducts.length > 0) {
        requestData.products = selectedProducts.map((p) => ({
          product_id: p.product_id,
          limit_value: p.is_unlimited ? 0 : p.limit_value,
          is_unlimited: p.is_unlimited,
        }));
      }

      const result = await createVersionMutation.mutateAsync({
        planId,
        data: requestData,
      });

      // Navigate to the version edit page
      router.push(`/plans/${planId}/versions/${result.data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version');
    }
  };

  if (planLoading) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <Loader2 className='h-12 w-12 animate-spin text-primarySolid' />
          <p className='text-textSecondary'>Loading plan details...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <h2 className='mb-2 text-xl font-semibold text-textPrimary'>
            Plan not found
          </h2>
          <Link href='/plans' className='text-primary hover:underline'>
            Back to plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='p-8'>
      {/* Header */}
      <section className='mb-8'>
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
            Create New Version
          </span>
        </div>

        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <Link
              href={`/plans/${planId}/edit`}
              className='mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-bgGray'
            >
              <ArrowLeft className='h-5 w-5 text-textSecondary' />
            </Link>
            <div>
              <h1 className='text-3xl font-bold text-textPrimary'>
                Create New Version
              </h1>
              <p className='mt-1 text-textSecondary'>
                Create a new version for {plan.name}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className='grid grid-cols-3 gap-6'>
        {/* Form Section */}
        <div className='col-span-2 space-y-6'>
          {/* Purchase Mode Section */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center'>
              <div className='flex items-center h-5 w-5'>
                <DollarSign className='h-5 w-5 text-indigo-600' />
              </div>
              <div className='ml-4'>
                <h2 className='text-xl font-semibold text-textPrimary'>
                  Purchase Mode
                </h2>
                <p className='text-sm text-textSecondary'>
                  Choose whether this plan is free or paid
                </p>
              </div>
            </div>

            <div className='flex space-x-3'>
              {(['PAID', 'FREE'] as const).map((mode) => (
                <button
                  key={mode}
                  type='button'
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, purchase_mode: mode }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    formData.purchase_mode === mode
                      ? 'bg-primarySolid text-white'
                      : 'bg-bgGray text-textSecondary hover:bg-gray-200'
                  }`}
                >
                  {mode === 'FREE' ? 'Free' : 'Paid'}
                </button>
              ))}
            </div>
          </section>

          {formData.purchase_mode !== 'FREE' && (
            <>
              {/* Pricing Frequency Section */}
              <section className='border-t border-border pt-6 pb-2'>
                <div className='mb-6 flex items-center'>
                  <div className='flex items-center h-5 w-5'>
                    <GitBranch className='h-5 w-5 text-purple-600' />
                  </div>
                  <div className='ml-4'>
                    <h2 className='text-xl font-semibold text-textPrimary'>
                      Pricing Frequency
                    </h2>
                    <p className='text-sm text-textSecondary'>
                      Choose which billing cycles this plan version supports
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-5 gap-4'>
                  {(
                    [
                      'MONTHLY',
                      'YEARLY',
                      'TWO_YEARLY',
                      'BOTH',
                      'ALL',
                    ] as PricingFrequency[]
                  ).map((freq) => (
                    <button
                      key={freq}
                      type='button'
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          pricing_frequency: freq,
                        }))
                      }
                      className={`rounded-lg border-2 p-4 text-center transition ${
                        formData.pricing_frequency === freq
                          ? 'border-primary bg-primary-50'
                          : 'border-border hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`text-lg font-semibold ${
                          formData.pricing_frequency === freq
                            ? 'text-primary'
                            : 'text-textPrimary'
                        }`}
                      >
                        {freq === 'BOTH'
                          ? 'Both'
                          : freq === 'ALL'
                            ? 'All'
                            : freq === 'TWO_YEARLY'
                              ? '2-Yearly'
                              : freq.charAt(0) + freq.slice(1).toLowerCase()}
                      </div>
                      <div className='mt-1 text-xs text-textSecondary'>
                        {freq === 'MONTHLY' && 'Monthly billing only'}
                        {freq === 'YEARLY' && 'Yearly billing only'}
                        {freq === 'TWO_YEARLY' && '2-year billing only'}
                        {freq === 'BOTH' && 'Monthly & Yearly billing'}
                        {freq === 'ALL' && 'All billing cycles'}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Pricing Section */}
              <section className='border-t border-border pt-6 pb-2'>
                <div className='mb-6 flex items-center'>
                  <div className='flex items-center h-5 w-5'>
                    <DollarSign className='h-5 w-5 text-green-600' />
                  </div>
                  <div className='ml-4'>
                    <h2 className='text-xl font-semibold text-textPrimary'>
                      Pricing Details
                    </h2>
                    <p className='text-sm text-textSecondary'>
                      Set pricing for the selected billing frequency
                    </p>
                  </div>
                </div>

                <div className='space-y-6'>
                  {/* Monthly Pricing */}
                  {showMonthlyFields && (
                    <div className='rounded-lg border border-border p-4'>
                      <h3 className='mb-4 font-semibold text-textPrimary'>
                        Monthly Pricing
                      </h3>
                      <div className='grid grid-cols-2 gap-6'>
                        {/* INR Monthly */}
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium text-textSecondary'>
                            INR (Indian Rupees)
                          </h4>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Price
                            </label>
                            <input
                              type='number'
                              value={formData.price_monthly_inr}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  price_monthly_inr: Number(e.target.value),
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Type
                              </label>
                              <select
                                value={formData.discount_monthly_inr_type}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_monthly_inr_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Value
                              </label>
                              <input
                                type='number'
                                value={formData.discount_monthly_inr_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_monthly_inr_value: Number(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                disabled={
                                  formData.discount_monthly_inr_type === 'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </div>

                        {/* USD Monthly */}
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium text-textSecondary'>
                            USD (US Dollars)
                          </h4>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Price
                            </label>
                            <input
                              type='number'
                              value={formData.price_monthly_usd}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  price_monthly_usd: Number(e.target.value),
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Type
                              </label>
                              <select
                                value={formData.discount_monthly_usd_type}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_monthly_usd_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Value
                              </label>
                              <input
                                type='number'
                                value={formData.discount_monthly_usd_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_monthly_usd_value: Number(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                disabled={
                                  formData.discount_monthly_usd_type === 'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Yearly Pricing */}
                  {showYearlyFields && (
                    <div className='rounded-lg border border-border p-4'>
                      <h3 className='mb-4 font-semibold text-textPrimary'>
                        Yearly Pricing
                      </h3>
                      <div className='grid grid-cols-2 gap-6'>
                        {/* INR Yearly */}
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium text-textSecondary'>
                            INR (Indian Rupees)
                          </h4>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Price
                            </label>
                            <input
                              type='number'
                              value={formData.price_yearly_inr}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  price_yearly_inr: Number(e.target.value),
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Type
                              </label>
                              <select
                                value={formData.discount_yearly_inr_type}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_yearly_inr_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Value
                              </label>
                              <input
                                type='number'
                                value={formData.discount_yearly_inr_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_yearly_inr_value: Number(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                disabled={
                                  formData.discount_yearly_inr_type === 'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </div>

                        {/* USD Yearly */}
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium text-textSecondary'>
                            USD (US Dollars)
                          </h4>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Price
                            </label>
                            <input
                              type='number'
                              value={formData.price_yearly_usd}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  price_yearly_usd: Number(e.target.value),
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Type
                              </label>
                              <select
                                value={formData.discount_yearly_usd_type}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_yearly_usd_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Value
                              </label>
                              <input
                                type='number'
                                value={formData.discount_yearly_usd_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_yearly_usd_value: Number(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                disabled={
                                  formData.discount_yearly_usd_type === 'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Two-Yearly Pricing */}
                  {showTwoYearlyFields && (
                    <div className='rounded-lg border border-border p-4'>
                      <h3 className='mb-4 font-semibold text-textPrimary'>
                        Two-Yearly Pricing
                      </h3>
                      <div className='grid grid-cols-2 gap-6'>
                        {/* INR Two-Yearly */}
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium text-textSecondary'>
                            INR (Indian Rupees)
                          </h4>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Price
                            </label>
                            <input
                              type='number'
                              value={formData.price_two_yearly_inr}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  price_two_yearly_inr: Number(e.target.value),
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Type
                              </label>
                              <select
                                value={formData.discount_two_yearly_inr_type}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_two_yearly_inr_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Value
                              </label>
                              <input
                                type='number'
                                value={formData.discount_two_yearly_inr_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_two_yearly_inr_value: Number(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                disabled={
                                  formData.discount_two_yearly_inr_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </div>

                        {/* USD Two-Yearly */}
                        <div className='space-y-4'>
                          <h4 className='text-sm font-medium text-textSecondary'>
                            USD (US Dollars)
                          </h4>
                          <div>
                            <label className='mb-1 block text-sm text-textSecondary'>
                              Price
                            </label>
                            <input
                              type='number'
                              value={formData.price_two_yearly_usd}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  price_two_yearly_usd: Number(e.target.value),
                                }))
                              }
                              className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                              min='0'
                            />
                          </div>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Discount Type
                              </label>
                              <select
                                value={formData.discount_two_yearly_usd_type}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_two_yearly_usd_type: e.target
                                      .value as DiscountType,
                                  }))
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none'
                              >
                                <option value='NONE'>None</option>
                                <option value='PERCENTAGE'>Percentage</option>
                                <option value='FIXED'>Fixed</option>
                              </select>
                            </div>
                            <div>
                              <label className='mb-1 block text-xs text-textSecondary'>
                                Value
                              </label>
                              <input
                                type='number'
                                value={formData.discount_two_yearly_usd_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    discount_two_yearly_usd_value: Number(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                disabled={
                                  formData.discount_two_yearly_usd_type ===
                                  'NONE'
                                }
                                className='h-9 w-full rounded-lg border border-border px-2 text-xs focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Offer Settings Section */}
          <section className='border-t border-border pt-6 pb-2'>
            <div className='mb-6 flex items-center'>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  formData.is_offer ? 'bg-orange-100' : 'bg-gray-100'
                }`}
              >
                <Tag
                  className={`h-5 w-5 ${
                    formData.is_offer ? 'text-orange-600' : 'text-gray-500'
                  }`}
                />
              </div>
              <div className='ml-4'>
                <h2 className='text-xl font-semibold text-textPrimary'>
                  Offer Settings
                </h2>
                <p className='text-sm text-textSecondary'>
                  Configure this version as a promotional offer (optional)
                </p>
              </div>
            </div>

            <div className='rounded-lg border border-border p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <input
                    type='checkbox'
                    id='is_offer'
                    checked={formData.is_offer}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_offer: e.target.checked,
                      }))
                    }
                    className='mr-3 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
                  />
                  <label
                    htmlFor='is_offer'
                    className='font-semibold text-textPrimary'
                  >
                    Mark as Promotional Offer
                  </label>
                </div>
                {formData.is_offer && (
                  <span className='text-xs font-semibold text-orange-700'>
                    Offer Version
                  </span>
                )}
              </div>

              {formData.is_offer && (
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
                        value={formData.offer_name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            offer_name: e.target.value,
                          }))
                        }
                        placeholder='e.g., Diwali Sale - 30% Off'
                        className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                      />
                    </div>

                    <div className='col-span-2'>
                      <label className='mb-1 block text-sm text-textSecondary'>
                        Offer Description
                      </label>
                      <textarea
                        value={formData.offer_description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            offer_description: e.target.value,
                          }))
                        }
                        placeholder='e.g., Limited time offer for new customers'
                        rows={2}
                        className='w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none'
                      />
                    </div>

                    <div>
                      <label className='mb-1 block text-sm text-textSecondary'>
                        Valid From
                      </label>
                      <input
                        type='date'
                        value={formData.offer_valid_from}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            offer_valid_from: e.target.value,
                          }))
                        }
                        className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                      />
                    </div>

                    <div>
                      <label className='mb-1 block text-sm text-textSecondary'>
                        Valid To
                      </label>
                      <input
                        type='date'
                        value={formData.offer_valid_to}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            offer_valid_to: e.target.value,
                          }))
                        }
                        className='h-10 w-full rounded-lg border border-border px-3 text-sm focus:border-primary focus:outline-none'
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Products & Limits Section */}
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
                    Define product entitlements for this plan version (optional)
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <button
                  type='button'
                  onClick={() => setShowImportPanel(true)}
                  className='flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
                >
                  <Download className='mr-2 h-4 w-4' />
                  Import from Version
                </button>
                <button
                  type='button'
                  onClick={() => setShowAddProduct(true)}
                  className='flex h-10 items-center rounded-lg bg-primarySolid px-4 text-sm font-semibold text-white transition hover:bg-primaryHover'
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Add Product
                </button>
              </div>
            </div>

            {/* Import from Version Panel */}
            {showImportPanel && (
              <div className='mb-6 rounded-lg border border-primary bg-primary-50 p-4'>
                <h4 className='mb-4 font-semibold text-textPrimary'>
                  Import Products from Existing Version
                </h4>
                <div className='space-y-4'>
                  {/* Plan Search Dropdown */}
                  <div>
                    <label className='mb-1 block text-sm text-textSecondary'>
                      Plan
                    </label>
                    <div
                      ref={importPlanDropdownRef}
                      className='relative w-full'
                    >
                      <button
                        type='button'
                        onClick={() =>
                          setImportPlanDropdownOpen((prev) => !prev)
                        }
                        className='flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white px-3 text-left text-sm focus:border-primary focus:outline-none'
                      >
                        <span
                          className={
                            importPlanId
                              ? 'text-textPrimary'
                              : 'text-textSecondary'
                          }
                        >
                          {importPlanId
                            ? (() => {
                                const p = importPlans.find(
                                  (pl) => pl.id === importPlanId,
                                );
                                return p
                                  ? `${decodeHtmlEntities(p.name)} (${p.code})`
                                  : 'Selected plan';
                              })()
                            : 'Search and select a plan...'}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 flex-shrink-0 text-textSecondary transition-transform ${importPlanDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {importPlanDropdownOpen && (
                        <div className='absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-hidden rounded-lg border border-border bg-white shadow-lg'>
                          <div className='border-b border-border p-2'>
                            <div className='relative'>
                              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                              <input
                                type='text'
                                value={importPlanSearch}
                                onChange={(e) =>
                                  setImportPlanSearch(e.target.value)
                                }
                                placeholder='Search plans...'
                                className='w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none'
                                autoFocus
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          <div className='max-h-48 overflow-y-auto p-1'>
                            {importPlansLoading ? (
                              <div className='flex items-center justify-center px-3 py-4'>
                                <Loader2 className='h-4 w-4 animate-spin text-textSecondary' />
                                <span className='ml-2 text-sm text-textSecondary'>
                                  Loading...
                                </span>
                              </div>
                            ) : importPlans.length === 0 ? (
                              <div className='px-3 py-4 text-center text-sm text-textSecondary'>
                                No plans found
                              </div>
                            ) : (
                              importPlans.map((pl) => (
                                <button
                                  key={pl.id}
                                  type='button'
                                  onClick={() => {
                                    setImportPlanId(pl.id);
                                    setImportVersionId('');
                                    setImportSelectedIds(new Set());
                                    setImportProductSearch('');
                                    setImportPlanDropdownOpen(false);
                                    setImportPlanSearch('');
                                  }}
                                  className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                                    pl.id === importPlanId
                                      ? 'bg-primary/10 text-primary'
                                      : 'text-textPrimary hover:bg-bgGray'
                                  }`}
                                >
                                  <span>
                                    {decodeHtmlEntities(pl.name)}{' '}
                                    <span className='text-textSecondary'>
                                      ({pl.code})
                                    </span>
                                  </span>
                                  <span className='ml-2 text-xs text-textSecondary'>
                                    {pl.version_count} version
                                    {pl.version_count !== 1 ? 's' : ''}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Version Dropdown */}
                  {importPlanId && (
                    <div>
                      <label className='mb-1 block text-sm text-textSecondary'>
                        Version
                      </label>
                      <select
                        value={importVersionId}
                        onChange={(e) => {
                          setImportVersionId(e.target.value);
                          setImportProductSearch('');
                          // Auto-select all importable products when version changes
                          if (e.target.value) {
                            // Will be selected after version detail loads via effect below
                            setImportSelectedIds(new Set());
                          }
                        }}
                        className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                      >
                        <option value=''>Select a version...</option>
                        {importVersions.map((v) => {
                          const status = getVersionStatus(v);
                          return (
                            <option key={v.id} value={v.id}>
                              v{v.version}, {status.label}
                              {v.products?.length
                                ? ` (${v.products.length} products)`
                                : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Product Selection */}
                  {importVersionId && (
                    <div>
                      {importVersionLoading ? (
                        <div className='flex items-center justify-center py-6'>
                          <Loader2 className='h-5 w-5 animate-spin text-textSecondary' />
                          <span className='ml-2 text-sm text-textSecondary'>
                            Loading products...
                          </span>
                        </div>
                      ) : importableProducts.length === 0 ? (
                        <div className='rounded-lg border border-border bg-white py-6 text-center'>
                          <Package className='mx-auto h-8 w-8 text-textSecondary opacity-30' />
                          <p className='mt-2 text-sm text-textSecondary'>
                            No compatible products in this version
                          </p>
                          {skippedCount > 0 && (
                            <p className='mt-1 text-xs text-yellow-600'>
                              {skippedCount} product
                              {skippedCount !== 1 ? 's' : ''} skipped (not
                              linked to this plan&apos;s applications)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className='border-t border-border'>
                          {/* Product Search */}
                          <div className='border-b border-border p-3'>
                            <div className='relative'>
                              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary' />
                              <input
                                type='text'
                                value={importProductSearch}
                                onChange={(e) =>
                                  setImportProductSearch(e.target.value)
                                }
                                placeholder='Search by product code or feature key...'
                                className='w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none'
                              />
                            </div>
                          </div>

                          {/* Select All */}
                          <div className='border-b border-border px-3 py-2'>
                            <button
                              type='button'
                              onClick={toggleImportAll}
                              className='flex items-center text-sm text-textPrimary hover:text-primary'
                            >
                              <input
                                type='checkbox'
                                checked={
                                  importSelectedIds.size ===
                                    importableProducts.length &&
                                  importableProducts.length > 0
                                }
                                readOnly
                                className='mr-2 h-4 w-4 rounded border-gray-300 text-primary'
                              />
                              Select All ({importableProducts.length} product
                              {importableProducts.length !== 1 ? 's' : ''})
                            </button>
                          </div>

                          {/* Product List */}
                          <div className='max-h-60 overflow-y-auto'>
                            {filteredImportProducts.length === 0 ? (
                              <div className='px-3 py-4 text-center text-sm text-textSecondary'>
                                No products match your search
                              </div>
                            ) : (
                              filteredImportProducts.map(
                                (pvp: PlanVersionProduct) => (
                                  <button
                                    key={pvp.product_id}
                                    type='button'
                                    onClick={() =>
                                      toggleImportProduct(pvp.product_id)
                                    }
                                    className='flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-bgGray'
                                  >
                                    <div className='flex items-center'>
                                      <input
                                        type='checkbox'
                                        checked={importSelectedIds.has(
                                          pvp.product_id,
                                        )}
                                        readOnly
                                        className='mr-3 h-4 w-4 rounded border-gray-300 text-primary'
                                      />
                                      <span className='font-mono text-textPrimary'>
                                        {pvp.product_code}
                                      </span>
                                      <span className='ml-2 text-xs text-textSecondary'>
                                        ({pvp.feature_key})
                                      </span>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                      <span className='text-xs font-medium text-gray-700'>
                                        {pvp.constraint_type}
                                      </span>
                                      {pvp.is_unlimited ? (
                                        <span className='text-xs font-medium text-green-700'>
                                          Unlimited
                                        </span>
                                      ) : (
                                        <span className='text-xs text-textSecondary'>
                                          Limit: {pvp.limit_value ?? 0}
                                          {pvp.unit ? ` ${pvp.unit}` : ''}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ),
                              )
                            )}
                          </div>

                          {/* Skipped warning */}
                          {skippedCount > 0 && (
                            <div className='border-t border-border px-3 py-2'>
                              <p className='text-xs text-yellow-600'>
                                {skippedCount} product
                                {skippedCount !== 1 ? 's' : ''} skipped (not
                                linked to this plan&apos;s applications)
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info text */}
                  {importVersionId && importableProducts.length > 0 && (
                    <p className='text-xs text-textSecondary'>
                      Imported products will replace current selections. You can
                      edit them after import.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className='mt-4 flex justify-end space-x-3'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowImportPanel(false);
                      setImportPlanId('');
                      setImportPlanSearch('');
                      setImportVersionId('');
                      setImportProductSearch('');
                      setImportSelectedIds(new Set());
                      setImportPlanDropdownOpen(false);
                    }}
                    className='h-9 rounded-lg border border-border px-4 text-sm font-medium text-textPrimary hover:bg-bgGray'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={handleImportProducts}
                    disabled={importSelectedIds.size === 0}
                    className='flex h-9 items-center rounded-lg bg-primarySolid px-4 text-sm font-medium text-white hover:bg-primaryHover disabled:opacity-50'
                  >
                    Import {importSelectedIds.size} Product
                    {importSelectedIds.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}

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
                        const prod = availableProducts.find(
                          (p: Product) => p.id === e.target.value,
                        );
                        if (prod?.constraint_type === 'BOOLEAN') {
                          setProductLimit(1);
                          setIsUnlimited(false);
                        }
                      }}
                      className='h-10 w-full rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none'
                    >
                      <option value=''>Select a product...</option>
                      {availableProducts.map((p: Product) => (
                        <option key={p.id} value={p.id}>
                          {decodeHtmlEntities(p.feature_name)}, {p.code}{' '}
                          ({p.constraint_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const selectedProd = availableProducts.find(
                      (p: Product) => p.id === selectedProductId,
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
                    type='button'
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
                    type='button'
                    onClick={handleAddProduct}
                    disabled={!selectedProductId}
                    className='flex h-9 items-center rounded-lg bg-primarySolid px-4 text-sm font-medium text-white hover:bg-primaryHover disabled:opacity-50'
                  >
                    Add Product
                  </button>
                </div>
              </div>
            )}

            {/* Products List */}
            {selectedProducts.length > 0 ? (
              <div className='overflow-hidden rounded-lg border border-border'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-border'>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Product
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Type
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-semibold text-textSecondary'>
                        Limit
                      </th>
                      <th className='px-4 py-3 text-right text-sm font-semibold text-textSecondary'>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((product) => (
                      <tr
                        key={product.product_id}
                        className='border-b border-border last:border-0'
                      >
                        <td className='px-4 py-3'>
                          <span className='font-mono text-sm text-textPrimary'>
                            {product.product_code}
                          </span>
                        </td>
                        <td className='px-4 py-3'>
                          <span className='text-xs font-medium text-gray-700'>
                            {product.constraint_type}
                          </span>
                        </td>
                        <td className='px-4 py-3'>
                          {product.constraint_type === 'BOOLEAN' ? (
                            <div className='flex items-center'>
                              <button
                                type='button'
                                onClick={() =>
                                  handleUpdateProduct(product.product_id, {
                                    limit_value:
                                      product.limit_value === 1 ? 0 : 1,
                                  })
                                }
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${product.limit_value === 1 ? 'bg-primarySolid' : 'bg-gray-300'}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${product.limit_value === 1 ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                              </button>
                              <span className='ml-2 text-sm text-textPrimary'>
                                {product.limit_value === 1 ? 'On' : 'Off'}
                              </span>
                            </div>
                          ) : (
                            <div className='flex items-center gap-3'>
                              <input
                                type='number'
                                value={product.limit_value}
                                onChange={(e) =>
                                  handleUpdateProduct(product.product_id, {
                                    limit_value:
                                      Number.parseInt(e.target.value) || 0,
                                  })
                                }
                                disabled={product.is_unlimited}
                                className='h-8 w-24 rounded-lg border border-border px-2 text-sm focus:border-primary focus:outline-none disabled:bg-gray-100'
                                min='0'
                              />
                              <label className='flex cursor-pointer items-center'>
                                <input
                                  type='checkbox'
                                  checked={product.is_unlimited}
                                  onChange={(e) =>
                                    handleUpdateProduct(product.product_id, {
                                      is_unlimited: e.target.checked,
                                    })
                                  }
                                  className='mr-1.5 h-4 w-4'
                                />
                                <span className='text-xs text-textSecondary'>
                                  Unlimited
                                </span>
                              </label>
                            </div>
                          )}
                        </td>
                        <td className='px-4 py-3 text-right'>
                          <button
                            type='button'
                            onClick={() =>
                              handleRemoveProduct(product.product_id)
                            }
                            className='text-red-500 hover:text-red-700'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='rounded-lg border-2 border-dashed border-border py-8 text-center'>
                <Package className='mx-auto h-12 w-12 text-textSecondary opacity-30' />
                <p className='mt-4 text-textSecondary'>No products added yet</p>
                <p className='mt-1 text-sm text-textSecondary'>
                  Add products to define entitlements for this version
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Plan Info Card */}
          <div className='border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Plan Information
            </h3>
            <div className='space-y-3'>
              <div>
                <span className='text-sm text-textSecondary'>Plan Name</span>
                <p className='font-medium text-textPrimary'>{plan.name}</p>
              </div>
              <div>
                <span className='text-sm text-textSecondary'>Plan Code</span>
                <p className='font-mono text-sm text-textPrimary'>
                  {plan.code}
                </p>
              </div>
              <div>
                <span className='text-sm text-textSecondary'>
                  Current Versions
                </span>
                <p className='font-medium text-textPrimary'>
                  {plan.version_count}
                </p>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className='border-t border-border pt-6 pb-2'>
            <h3 className='mb-4 text-lg font-semibold text-textPrimary'>
              Actions
            </h3>
            <div className='space-y-3'>
              <button
                onClick={handleSubmit}
                disabled={createVersionMutation.isLoading}
                className='flex h-11 w-full items-center justify-center rounded-lg bg-primarySolid text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-50'
              >
                {createVersionMutation.isLoading ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Save className='mr-2 h-4 w-4' />
                )}
                Create Version
              </button>
              <Link
                href={`/plans/${planId}/edit`}
                className='flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-semibold text-textPrimary transition hover:bg-bgGray'
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
