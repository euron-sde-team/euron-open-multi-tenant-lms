'use client';

import { ChevronRight, CreditCard, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useCreateBillingProvider } from '@/lib/api/hooks/useBillingProviders';
import type { CredentialFieldSchema } from '@/lib/api/types';

function emptyField(): CredentialFieldSchema {
  return { key: '', label: '', type: 'text', required: true };
}

export default function CreateProviderPage() {
  const router = useRouter();
  const createProvider = useCreateBillingProvider();
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isVisibleToTenant, setIsVisibleToTenant] = useState(true);
  const [fields, setFields] = useState<CredentialFieldSchema[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addField() {
    setFields((prev) => [...prev, emptyField()]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function updateField(index: number, patch: Partial<CredentialFieldSchema>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  function changeFieldType(
    index: number,
    newType: 'text' | 'secret' | 'select',
  ) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        if (newType === 'select') {
          return {
            ...f,
            type: newType,
            options:
              f.options && f.options.length > 0
                ? f.options
                : [{ value: '', label: '' }],
          };
        }
        const { options: _options, ...rest } = f;
        return { ...rest, type: newType };
      }),
    );
  }

  function addOption(fieldIndex: number) {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex
          ? { ...f, options: [...(f.options ?? []), { value: '', label: '' }] }
          : f,
      ),
    );
  }

  function removeOption(fieldIndex: number, optIdx: number) {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex
          ? {
              ...f,
              options: (f.options ?? []).filter((_, oi) => oi !== optIdx),
            }
          : f,
      ),
    );
  }

  function updateOption(
    fieldIndex: number,
    optIdx: number,
    patch: Partial<{ value: string; label: string }>,
  ) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const opts = [...(f.options ?? [])];
        opts[optIdx] = { ...opts[optIdx], ...patch };
        return { ...f, options: opts };
      }),
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Provider name is required');
      return;
    }

    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].key.trim() || !fields[i].label.trim()) {
        setError(`Credential field #${i + 1}: key and label are required`);
        return;
      }
      if (fields[i].type === 'select') {
        const validOpts = (fields[i].options ?? []).filter(
          (o) => o.value.trim() && o.label.trim(),
        );
        if (validOpts.length === 0) {
          setError(
            `Credential field #${i + 1}: select fields require at least one option (value + label).`,
          );
          return;
        }
      }
    }

    const validFields = fields
      .filter((f) => f.key.trim() && f.label.trim())
      .map((f) => {
        const cleaned: CredentialFieldSchema = {
          ...f,
          key: f.key.trim().toLowerCase().replace(/\s+/g, '_'),
          label: f.label.trim(),
          placeholder: f.placeholder?.trim() || undefined,
          description: f.description?.trim() || undefined,
        };
        if (f.type === 'select') {
          cleaned.options = (f.options ?? [])
            .filter((o) => o.value.trim() && o.label.trim())
            .map((o) => ({ value: o.value.trim(), label: o.label.trim() }));
        } else {
          delete cleaned.options;
        }
        return cleaned;
      });

    try {
      await createProvider.mutateAsync({
        name: trimmedName.toUpperCase(),
        is_active: isActive,
        is_visible_to_tenant: isVisibleToTenant,
        credential_schema: validFields.length > 0 ? validFields : null,
      });
      router.push('/providers');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create provider',
      );
    }
  };

  return (
    <div className='p-8'>
      <section className='mb-8'>
        <div className='mb-2 flex items-center'>
          <Link
            href='/billing'
            className='text-sm font-medium text-textSecondary hover:text-primary'
          >
            Billing
          </Link>
          <ChevronRight className='mx-2 h-3 w-3 text-textSecondary' />
          <Link
            href='/providers'
            className='text-sm font-medium text-textSecondary hover:text-primary'
          >
            Providers
          </Link>
          <ChevronRight className='mx-2 h-3 w-3 text-textSecondary' />
          <span className='text-sm font-semibold text-textPrimary'>
            Add Provider
          </span>
        </div>
        <h1 className='mb-2 text-3xl font-bold text-textPrimary'>
          Add Billing Provider
        </h1>
        <p className='text-textSecondary'>
          Add a payment gateway that tenants or the platform can use for billing
        </p>
      </section>

      <form onSubmit={handleSubmit}>
        <div className='grid grid-cols-3 gap-8'>
          <div className='col-span-2 space-y-6'>
            <div className='border-t border-border pt-6 pb-2'>
              <h2 className='mb-4 flex items-center text-lg font-semibold text-textPrimary'>
                <CreditCard className='mr-2 h-5 w-5 text-primary' />
                Provider name
              </h2>
              <p className='mb-4 text-sm text-textSecondary'>
                Enter the billing provider name (e.g. RAZORPAY, STRIPE, PAYU).
              </p>
              <label className='mb-2 block text-sm font-medium text-textPrimary'>
                Name <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder='e.g. RAZORPAY'
                className='h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm uppercase focus:border-primary focus:outline-none'
              />
            </div>

            <div className='border-t border-border pt-6 pb-2'>
              <h2 className='mb-4 text-lg font-semibold text-textPrimary'>
                Settings
              </h2>
              <div className='space-y-4'>
                <label className='flex items-center gap-3'>
                  <input
                    type='checkbox'
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                  />
                  <span className='text-sm text-textPrimary'>Active</span>
                </label>
                <label className='flex items-center gap-3'>
                  <input
                    type='checkbox'
                    checked={isVisibleToTenant}
                    onChange={(e) => setIsVisibleToTenant(e.target.checked)}
                    className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                  />
                  <span className='text-sm text-textPrimary'>
                    Visible to tenants (tenants can link this provider)
                  </span>
                </label>
              </div>
            </div>

            {/* Credential Schema Builder */}
            <div className='border-t border-border pt-6 pb-2'>
              <h2 className='mb-1 flex items-center text-lg font-semibold text-textPrimary'>
                <CreditCard className='mr-2 h-5 w-5 text-primary' />
                Credential Schema
              </h2>
              <p className='mb-5 text-sm text-textSecondary'>
                Define the fields tenants must fill when connecting this
                provider. These are rendered as a dynamic form in the tenant
                admin dashboard.
              </p>

              {fields.length === 0 ? (
                <div className='rounded-lg border-2 border-dashed border-border/60 py-10 text-center'>
                  <CreditCard className='mx-auto mb-3 h-8 w-8 text-textSecondary/50' />
                  <p className='mb-1 text-sm font-medium text-textSecondary'>
                    No credential fields defined
                  </p>
                  <p className='mb-4 text-xs text-textSecondary/70'>
                    Add the API keys or secrets tenants need to provide
                  </p>
                  <button
                    type='button'
                    onClick={addField}
                    className='inline-flex items-center gap-1.5 rounded-full bg-primarySolid px-4 py-2 text-sm font-medium text-white hover:bg-primaryHover'
                  >
                    <Plus className='h-4 w-4' />
                    Add first field
                  </button>
                </div>
              ) : (
                <div className='space-y-3'>
                  {fields.map((field, index) => (
                    <div
                      key={index}
                      className='group relative rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-sm'
                    >
                      <div className='mb-3 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary'>
                            {index + 1}
                          </span>
                          <span className='text-sm font-medium text-textPrimary'>
                            {field.label || field.key || 'New field'}
                          </span>
                          {field.required && (
                            <span className='rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-500'>
                              Required
                            </span>
                          )}
                          <span className='rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-textSecondary'>
                            {field.type === 'secret'
                              ? 'Password'
                              : field.type === 'select'
                                ? 'Dropdown'
                                : 'Text'}
                          </span>
                        </div>
                        <button
                          type='button'
                          onClick={() => removeField(index)}
                          className='rounded-md p-1 text-textSecondary opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100'
                          title='Remove field'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>

                      <div className='grid grid-cols-4 gap-3'>
                        <div>
                          <label className='mb-1 block text-[11px] font-medium uppercase tracking-wide text-textSecondary/80'>
                            Key <span className='text-red-400'>*</span>
                          </label>
                          <input
                            type='text'
                            value={field.key}
                            onChange={(e) =>
                              updateField(index, { key: e.target.value })
                            }
                            placeholder='key_id'
                            className='h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                          />
                        </div>
                        <div>
                          <label className='mb-1 block text-[11px] font-medium uppercase tracking-wide text-textSecondary/80'>
                            Label <span className='text-red-400'>*</span>
                          </label>
                          <input
                            type='text'
                            value={field.label}
                            onChange={(e) =>
                              updateField(index, { label: e.target.value })
                            }
                            placeholder='Key ID'
                            className='h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                          />
                        </div>
                        <div>
                          <label className='mb-1 block text-[11px] font-medium uppercase tracking-wide text-textSecondary/80'>
                            Type
                          </label>
                          <select
                            value={field.type}
                            onChange={(e) =>
                              changeFieldType(
                                index,
                                e.target.value as 'text' | 'secret' | 'select',
                              )
                            }
                            className='h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                          >
                            <option value='text'>Text</option>
                            <option value='secret'>Secret</option>
                            <option value='select'>Select</option>
                          </select>
                        </div>
                        <div>
                          <label className='mb-1 block text-[11px] font-medium uppercase tracking-wide text-textSecondary/80'>
                            Placeholder
                          </label>
                          <input
                            type='text'
                            value={field.placeholder ?? ''}
                            onChange={(e) =>
                              updateField(index, {
                                placeholder: e.target.value || undefined,
                              })
                            }
                            placeholder='rzp_live_xxxxx'
                            className='h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                          />
                        </div>
                      </div>

                      <div className='mt-3 grid grid-cols-4 items-end gap-3'>
                        <div className='col-span-3'>
                          <label className='mb-1 block text-[11px] font-medium uppercase tracking-wide text-textSecondary/80'>
                            Help text
                          </label>
                          <input
                            type='text'
                            value={field.description ?? ''}
                            onChange={(e) =>
                              updateField(index, {
                                description: e.target.value || undefined,
                              })
                            }
                            placeholder='e.g. Found in Razorpay Dashboard > Settings > API Keys'
                            className='h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                          />
                        </div>
                        <div className='flex h-9 items-center'>
                          <label className='flex cursor-pointer items-center gap-2'>
                            <input
                              type='checkbox'
                              checked={field.required}
                              onChange={(e) =>
                                updateField(index, {
                                  required: e.target.checked,
                                })
                              }
                              className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                            />
                            <span className='text-sm text-textPrimary'>
                              Required
                            </span>
                          </label>
                        </div>
                      </div>

                      {field.type === 'select' && (
                        <div className='mt-4 rounded-md border border-border/60 bg-surface/40 p-3'>
                          <div className='mb-2 flex items-center justify-between'>
                            <label className='text-[11px] font-medium uppercase tracking-wide text-textSecondary/80'>
                              Dropdown options{' '}
                              <span className='text-red-400'>*</span>
                            </label>
                            <span className='text-[10px] text-textSecondary/70'>
                              Value is what gets stored. Label is what tenants
                              see.
                            </span>
                          </div>
                          <div className='space-y-2'>
                            {(field.options ?? []).map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className='flex items-center gap-2'
                              >
                                <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-textSecondary/10 text-[10px] font-semibold text-textSecondary'>
                                  {optIdx + 1}
                                </span>
                                <input
                                  type='text'
                                  value={opt.value}
                                  onChange={(e) =>
                                    updateOption(index, optIdx, {
                                      value: e.target.value,
                                    })
                                  }
                                  placeholder='value (e.g. test)'
                                  className='h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                                />
                                <input
                                  type='text'
                                  value={opt.label}
                                  onChange={(e) =>
                                    updateOption(index, optIdx, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder='Label (e.g. Sandbox)'
                                  className='h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'
                                />
                                <button
                                  type='button'
                                  onClick={() => removeOption(index, optIdx)}
                                  className='shrink-0 rounded-md p-1.5 text-textSecondary hover:bg-red-50 hover:text-red-500'
                                  title='Remove option'
                                >
                                  <Trash2 className='h-3.5 w-3.5' />
                                </button>
                              </div>
                            ))}
                            <button
                              type='button'
                              onClick={() => addOption(index)}
                              className='flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 py-2 text-xs font-medium text-textSecondary transition-colors hover:border-primary/40 hover:text-primary'
                            >
                              <Plus className='h-3.5 w-3.5' />
                              Add option
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type='button'
                    onClick={addField}
                    className='flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border/60 py-3 text-sm font-medium text-textSecondary transition-colors hover:border-primary/40 hover:text-primary'
                  >
                    <Plus className='h-4 w-4' />
                    Add another field
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800'>
                {error}
              </div>
            )}

            <div className='space-y-3'>
              <button
                type='submit'
                disabled={!name.trim() || createProvider.isLoading}
                className='h-10 w-full rounded-full bg-primarySolid text-sm font-semibold text-white hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50'
              >
                {createProvider.isLoading ? 'Creating…' : 'Add Provider'}
              </button>
              <Link
                href='/providers'
                className='flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-textPrimary hover:bg-bgGray'
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
