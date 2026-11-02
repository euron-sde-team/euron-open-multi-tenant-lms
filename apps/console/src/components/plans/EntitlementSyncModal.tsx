'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Infinity as InfinityIcon,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  useApplyEntitlementSync,
  usePreviewEntitlementSync,
} from '@/lib/api/hooks/usePlans';
import {
  EntitlementSyncChange,
  EntitlementSyncPreview,
  EntitlementSyncResult,
  EntitlementSyncTenantPlan,
  SubscriptionStatus,
} from '@/lib/api/types';
import { decodeHtmlEntities } from '@/lib/utils';

interface EntitlementSyncModalProps {
  planId: string;
  /** Version whose products are handed out. Omit to use the plan's active version. */
  sourceVersionId?: string;
  planName?: string;
  versionNumber?: number;
  onClose: () => void;
}

const MIN_REASON_LENGTH = 10;

/** "20", "unlimited", "512 MB" */
const formatLimit = (
  value: number | null,
  isUnlimited: boolean | null,
  unit?: string | null,
) => {
  if (isUnlimited) return 'unlimited';
  if (value === null) return '-';
  return unit ? `${value} ${unit}` : `${value}`;
};

const changeLabel = (change: EntitlementSyncChange) =>
  change.action === 'CREATE'
    ? formatLimit(
        change.source_limit_value,
        change.source_is_unlimited,
        change.unit,
      )
    : `${formatLimit(
        change.current_limit_value,
        change.current_is_unlimited,
        change.unit,
      )} → ${formatLimit(
        change.source_limit_value,
        change.source_is_unlimited,
        change.unit,
      )}`;

/**
 * Backfills the products of one published plan version onto the tenants already
 * subscribed to that plan. Three steps in one dialog: options, preview, result.
 *
 * The preview is advisory only. The server recomputes the diff on apply, so a
 * stale preview can never cause a wrong write, it just means the result differs
 * from what was shown.
 */
export function EntitlementSyncModal({
  planId,
  sourceVersionId,
  planName,
  versionNumber,
  onClose,
}: EntitlementSyncModalProps) {
  const [grantMissingApplications, setGrantMissingApplications] =
    useState(true);
  const [includePastDue, setIncludePastDue] = useState(false);
  // Off by default: a run adds missing entitlements and never edits an existing one.
  const [raiseExistingLimits, setRaiseExistingLimits] = useState(false);
  const [reason, setReason] = useState('');
  const [excludedTenantIds, setExcludedTenantIds] = useState<Set<string>>(
    new Set(),
  );
  const [preview, setPreview] = useState<EntitlementSyncPreview | null>(null);
  const [result, setResult] = useState<EntitlementSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewMutation = usePreviewEntitlementSync();
  const applyMutation = useApplyEntitlementSync();
  const busy = previewMutation.isLoading || applyMutation.isLoading;

  const options = useMemo(
    () => ({
      source_version_id: sourceVersionId,
      grant_missing_applications: grantMissingApplications,
      raise_existing_limits: raiseExistingLimits,
      statuses: includePastDue
        ? (['ACTIVE', 'TRIALING', 'PAST_DUE'] as SubscriptionStatus[])
        : undefined,
    }),
    [
      sourceVersionId,
      grantMissingApplications,
      includePastDue,
      raiseExistingLimits,
    ],
  );

  // Options changed, so the preview on screen no longer describes what would happen.
  useEffect(() => {
    setPreview(null);
    setExcludedTenantIds(new Set());
  }, [grantMissingApplications, includePastDue, raiseExistingLimits]);

  const runPreview = async () => {
    setError(null);
    try {
      const response = await previewMutation.mutateAsync({ planId, options });
      setPreview(response.data);
      setExcludedTenantIds(new Set());
    } catch (err) {
      setError(readError(err));
    }
  };

  const tenantsWithChanges = useMemo(
    () =>
      (preview?.tenants ?? []).filter(
        (t) => t.creates.length > 0 || t.raises.length > 0,
      ),
    [preview],
  );

  const selectedTenants = useMemo(
    () => tenantsWithChanges.filter((t) => !excludedTenantIds.has(t.tenant_id)),
    [tenantsWithChanges, excludedTenantIds],
  );

  const selectedTotals = useMemo(
    () => ({
      creates: selectedTenants.reduce((n, t) => n + t.creates.length, 0),
      raises: selectedTenants.reduce((n, t) => n + t.raises.length, 0),
    }),
    [selectedTenants],
  );

  const runApply = async () => {
    if (!preview) return;
    setError(null);
    try {
      const response = await applyMutation.mutateAsync({
        planId,
        data: {
          ...options,
          reason: reason.trim(),
          // Send the explicit selection so an unchecked tenant is never touched,
          // even if the server-side diff moved since the preview.
          tenant_ids: selectedTenants.map((t) => t.tenant_id),
        },
      });
      setResult(response.data);
    } catch (err) {
      setError(readError(err));
    }
  };

  const toggleTenant = (tenantId: string) =>
    setExcludedTenantIds((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });

  const heading = planName
    ? `Sync entitlements from ${decodeHtmlEntities(planName)}${versionNumber ? ` v${versionNumber}` : ''}`
    : 'Sync entitlements to existing tenants';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4'
      role='dialog'
      aria-modal='true'
    >
      <div
        className='fixed inset-0 bg-black/50'
        onClick={() => !busy && onClose()}
        aria-hidden='true'
      />
      <div className='relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-surface shadow-xl'>
        {/* Header */}
        <div className='flex items-start justify-between border-b border-border px-6 py-4'>
          <div>
            <h3 className='text-lg font-semibold text-textPrimary'>
              {heading}
            </h3>
            <p className='mt-1 text-sm text-textSecondary'>
              Grants the products of this version to tenants already on the
              plan. Only entitlements they are missing are added. Their version,
              price, usage and existing entitlement values are left untouched.
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className='rounded-lg p-1 text-textSecondary transition hover:bg-bgGray'
            aria-label='Close'
            disabled={busy}
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-5'>
          {error && (
            <div className='mb-4 flex items-start gap-2 rounded-lg border border-error/30 bg-red-50 p-3 text-sm text-error'>
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <ResultView result={result} />
          ) : (
            <>
              {/* Step 1: options */}
              <div className='mb-5 space-y-3 rounded-lg border border-border bg-bgGray/50 p-4'>
                <label className='flex cursor-pointer items-start gap-3'>
                  <input
                    type='checkbox'
                    checked={grantMissingApplications}
                    onChange={(e) =>
                      setGrantMissingApplications(e.target.checked)
                    }
                    disabled={busy}
                    className='mt-0.5 h-4 w-4 rounded border-border'
                  />
                  <span className='text-sm'>
                    <span className='font-medium text-textPrimary'>
                      Grant missing applications
                    </span>
                    <span className='block text-textSecondary'>
                      An entitlement whose application the tenant does not hold
                      is inert. Leave this on unless you want to grant access
                      separately.
                    </span>
                  </span>
                </label>
                <label className='flex cursor-pointer items-start gap-3'>
                  <input
                    type='checkbox'
                    checked={includePastDue}
                    onChange={(e) => setIncludePastDue(e.target.checked)}
                    disabled={busy}
                    className='mt-0.5 h-4 w-4 rounded border-border'
                  />
                  <span className='text-sm'>
                    <span className='font-medium text-textPrimary'>
                      Include past-due tenants
                    </span>
                    <span className='block text-textSecondary'>
                      Off by default. Only active and trialing subscriptions are
                      included.
                    </span>
                  </span>
                </label>
                <label className='flex cursor-pointer items-start gap-3'>
                  <input
                    type='checkbox'
                    checked={raiseExistingLimits}
                    onChange={(e) => setRaiseExistingLimits(e.target.checked)}
                    disabled={busy}
                    className='mt-0.5 h-4 w-4 rounded border-border'
                  />
                  <span className='text-sm'>
                    <span className='font-medium text-textPrimary'>
                      Also raise limits the new version increased
                    </span>
                    <span className='block text-textSecondary'>
                      Off by default, so the run only adds missing entitlements
                      and never edits a value a tenant already has. Turn this on
                      when a version bumped a number (say storage from 10 to 20)
                      and you want existing tenants moved up too. It can only
                      raise, never lower, and every change is logged.
                    </span>
                  </span>
                </label>
              </div>

              {!preview ? (
                <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12'>
                  <p className='mb-4 text-sm text-textSecondary'>
                    Run a preview to see exactly what each tenant would receive.
                    Nothing is written.
                  </p>
                  <button
                    onClick={runPreview}
                    disabled={busy}
                    className='inline-flex items-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-60'
                  >
                    {previewMutation.isLoading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <RefreshCw className='mr-2 h-4 w-4' />
                    )}
                    Preview impact
                  </button>
                </div>
              ) : (
                <PreviewView
                  preview={preview}
                  tenantsWithChanges={tenantsWithChanges}
                  excludedTenantIds={excludedTenantIds}
                  onToggleTenant={toggleTenant}
                  disabled={busy}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className='border-t border-border px-6 py-4'>
          {result ? (
            <div className='flex justify-end'>
              <button
                onClick={onClose}
                className='rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryHover'
              >
                Done
              </button>
            </div>
          ) : (
            <div className='flex flex-col gap-3'>
              {preview && tenantsWithChanges.length > 0 && (
                <div>
                  <label className='mb-1 block text-sm font-semibold text-textPrimary'>
                    Reason <span className='text-error'>*</span>
                  </label>
                  <input
                    type='text'
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder='e.g. Backfilling the Store feature added in v30 to existing Growth tenants'
                    disabled={busy}
                    className='w-full rounded-lg border border-border bg-bgGray px-4 py-2.5 text-sm text-textPrimary focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
                  />
                  <p className='mt-1 text-xs text-textSecondary'>
                    Recorded on the audit log and on every limit change. Minimum{' '}
                    {MIN_REASON_LENGTH} characters.
                  </p>
                </div>
              )}
              <div className='flex items-center justify-between'>
                <button
                  onClick={onClose}
                  disabled={busy}
                  className='rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-textPrimary transition hover:bg-bgGray disabled:opacity-60'
                >
                  Cancel
                </button>
                <div className='flex items-center gap-2'>
                  {preview && (
                    <button
                      onClick={runPreview}
                      disabled={busy}
                      className='inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-textPrimary transition hover:bg-bgGray disabled:opacity-60'
                    >
                      {previewMutation.isLoading ? (
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      ) : (
                        <RefreshCw className='mr-2 h-4 w-4' />
                      )}
                      Refresh preview
                    </button>
                  )}
                  <button
                    onClick={runApply}
                    disabled={
                      busy ||
                      !preview ||
                      selectedTenants.length === 0 ||
                      reason.trim().length < MIN_REASON_LENGTH
                    }
                    className='inline-flex items-center rounded-lg bg-primarySolid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryHover disabled:opacity-60'
                  >
                    {applyMutation.isLoading && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    {preview
                      ? `Apply to ${selectedTenants.length} tenant${
                          selectedTenants.length === 1 ? '' : 's'
                        }` +
                        (selectedTotals.creates + selectedTotals.raises > 0
                          ? ` (${selectedTotals.creates} new${
                              selectedTotals.raises > 0
                                ? `, ${selectedTotals.raises} raised`
                                : ''
                            })`
                          : '')
                      : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Preview
// ============================================

function PreviewView({
  preview,
  tenantsWithChanges,
  excludedTenantIds,
  onToggleTenant,
  disabled,
}: {
  preview: EntitlementSyncPreview;
  tenantsWithChanges: EntitlementSyncTenantPlan[];
  excludedTenantIds: Set<string>;
  onToggleTenant: (tenantId: string) => void;
  disabled: boolean;
}) {
  const raising = preview.options_used.raise_existing_limits;
  const changingProducts = preview.products.filter(
    (p) => p.tenants_to_create > 0 || p.tenants_to_raise > 0,
  );

  if (preview.summary.tenants_matched === 0) {
    return (
      <div className='rounded-lg border border-dashed border-border py-12 text-center text-sm text-textSecondary'>
        No tenant currently holds a live subscription on this plan, so there is
        nothing to sync.
      </div>
    );
  }

  if (tenantsWithChanges.length === 0) {
    return (
      <div className='rounded-lg border border-success/30 bg-green-50 p-6 text-center'>
        <CheckCircle2 className='mx-auto mb-2 h-6 w-6 text-success' />
        <p className='text-sm font-medium text-textPrimary'>
          All {preview.summary.tenants_matched} tenants are already up to date
        </p>
        <p className='mt-1 text-sm text-textSecondary'>
          Every product in v{preview.source_version.version} is already granted
          to them. Nothing to do.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Summary tiles */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Tile
          label='Tenants affected'
          value={preview.summary.tenants_with_changes}
        />
        <Tile
          label='Entitlements to add'
          value={preview.summary.entitlements_to_create}
        />
        {raising ? (
          <Tile
            label='Limits to raise'
            value={preview.summary.entitlements_to_raise}
          />
        ) : (
          <Tile label='Values changed' value={0} muted />
        )}
        <Tile
          label='Left as they are'
          value={preview.summary.entitlements_unchanged}
          muted
        />
      </div>

      {!raising && (
        <p className='-mt-3 text-xs text-textSecondary'>
          This run only adds entitlements tenants are missing. Nothing they
          already hold is modified.
        </p>
      )}

      {/* Per-product roll-up */}
      <section>
        <h4 className='mb-2 text-sm font-semibold text-textPrimary'>
          What gets handed out
        </h4>
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full min-w-[640px]'>
            <thead className='bg-bgGray'>
              <tr>
                <Th>Product</Th>
                <Th>Limit</Th>
                <Th className='text-right'>New for</Th>
                {raising && <Th className='text-right'>Raised for</Th>}
                <Th className='text-right'>Already has it</Th>
              </tr>
            </thead>
            <tbody>
              {changingProducts.map((product) => (
                <tr
                  key={product.product_id}
                  className='border-t border-border text-sm'
                >
                  <td className='px-4 py-2.5'>
                    <div className='font-medium text-textPrimary'>
                      {product.product_code}
                    </div>
                    <div className='text-xs text-textSecondary'>
                      {product.application_code} · {product.constraint_type}
                    </div>
                  </td>
                  <td className='px-4 py-2.5 text-textPrimary'>
                    {product.is_unlimited ? (
                      <span className='inline-flex items-center gap-1'>
                        <InfinityIcon className='h-3.5 w-3.5' /> unlimited
                      </span>
                    ) : (
                      formatLimit(product.limit_value, false, product.unit)
                    )}
                  </td>
                  <td className='px-4 py-2.5 text-right font-medium text-textPrimary'>
                    {product.tenants_to_create || '-'}
                  </td>
                  {raising && (
                    <td className='px-4 py-2.5 text-right font-medium text-warning'>
                      {product.tenants_to_raise || '-'}
                    </td>
                  )}
                  <td className='px-4 py-2.5 text-right text-textSecondary'>
                    {product.tenants_unchanged}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-tenant detail */}
      <section>
        <h4 className='mb-2 text-sm font-semibold text-textPrimary'>
          Tenants ({tenantsWithChanges.length - excludedTenantIds.size} of{' '}
          {tenantsWithChanges.length} selected)
        </h4>
        <div className='space-y-2'>
          {tenantsWithChanges.map((tenant) => {
            const excluded = excludedTenantIds.has(tenant.tenant_id);
            return (
              <div
                key={tenant.tenant_id}
                className={`rounded-lg border p-3 ${
                  excluded
                    ? 'border-border bg-bgGray/40 opacity-60'
                    : 'border-border'
                }`}
              >
                <label className='flex cursor-pointer items-start gap-3'>
                  <input
                    type='checkbox'
                    checked={!excluded}
                    onChange={() => onToggleTenant(tenant.tenant_id)}
                    disabled={disabled}
                    className='mt-1 h-4 w-4 rounded border-border'
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium text-textPrimary'>
                        {decodeHtmlEntities(tenant.tenant_name)}
                      </span>
                      <span className='text-xs text-textSecondary'>
                        v{tenant.plan_version}
                      </span>
                      {tenant.tenant_status !== 'ACTIVE' && (
                        <span className='text-xs font-medium text-warning'>
                          {tenant.tenant_status}
                        </span>
                      )}
                    </div>

                    <div className='mt-1.5 flex flex-wrap gap-1.5'>
                      {tenant.creates.map((change) => (
                        <Chip
                          key={`c-${change.product_code}`}
                          tone='new'
                          title={`${change.product_code}: ${changeLabel(change)}`}
                        >
                          + {change.product_code}
                        </Chip>
                      ))}
                      {tenant.raises.map((change) => (
                        <Chip
                          key={`r-${change.product_code}`}
                          tone={
                            change.current_source &&
                            change.current_source !== 'PLAN'
                              ? 'alert'
                              : 'raise'
                          }
                          title={`${change.product_code}: ${changeLabel(change)}${
                            change.current_source
                              ? ` (existing source: ${change.current_source})`
                              : ''
                          }`}
                        >
                          {change.product_code} {changeLabel(change)}
                          {change.current_source &&
                            change.current_source !== 'PLAN' &&
                            ` · ${change.current_source}`}
                        </Chip>
                      ))}
                      {tenant.applications_to_grant.map((app) => (
                        <Chip key={`a-${app.application_id}`} tone='app'>
                          app: {app.application_code}
                        </Chip>
                      ))}
                      {tenant.unchanged_count > 0 && (
                        <span className='self-center text-xs text-textSecondary'>
                          {tenant.unchanged_count} untouched
                        </span>
                      )}
                    </div>

                    {tenant.warnings.map((warning) => (
                      <p
                        key={warning}
                        className='mt-1.5 flex items-start gap-1.5 text-xs text-warning'
                      >
                        <AlertTriangle className='mt-0.5 h-3 w-3 shrink-0' />
                        {warning}
                      </p>
                    ))}
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================
// Result
// ============================================

function ResultView({ result }: { result: EntitlementSyncResult }) {
  const failed = result.tenants.filter((t) => t.outcome === 'FAILED');
  const applied = result.tenants.filter((t) => t.outcome === 'APPLIED');

  return (
    <div className='space-y-5'>
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          failed.length > 0
            ? 'border-warning/30 bg-amber-50'
            : 'border-success/30 bg-green-50'
        }`}
      >
        {failed.length > 0 ? (
          <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-warning' />
        ) : (
          <CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-success' />
        )}
        <div>
          <p className='font-medium text-textPrimary'>
            {result.summary.tenants_changed} of{' '}
            {result.summary.tenants_processed} tenants updated
          </p>
          <p className='mt-0.5 text-sm text-textSecondary'>
            {result.summary.entitlements_created} entitlements created,{' '}
            {result.summary.entitlements_raised} limits raised,{' '}
            {result.summary.applications_granted} applications granted
            {failed.length > 0 ? `, ${failed.length} tenants failed` : ''}.
          </p>
        </div>
      </div>

      {failed.length > 0 && (
        <section>
          <h4 className='mb-2 text-sm font-semibold text-textPrimary'>
            Failures
          </h4>
          <div className='space-y-2'>
            {failed.map((tenant) => (
              <div
                key={tenant.tenant_id}
                className='flex items-start gap-2 rounded-lg border border-error/30 bg-red-50 p-3 text-sm'
              >
                <XCircle className='mt-0.5 h-4 w-4 shrink-0 text-error' />
                <div>
                  <span className='font-medium text-textPrimary'>
                    {decodeHtmlEntities(tenant.tenant_name)}
                  </span>
                  <p className='text-textSecondary'>{tenant.error}</p>
                </div>
              </div>
            ))}
          </div>
          <p className='mt-2 text-xs text-textSecondary'>
            Each tenant ran in its own transaction, so the tenants above were
            left untouched and everyone else still succeeded. Re-running the
            sync retries only what is missing.
          </p>
        </section>
      )}

      {applied.length > 0 && (
        <section>
          <h4 className='mb-2 text-sm font-semibold text-textPrimary'>
            Updated tenants
          </h4>
          <div className='overflow-x-auto rounded-lg border border-border'>
            <table className='w-full min-w-[520px]'>
              <thead className='bg-bgGray'>
                <tr>
                  <Th>Tenant</Th>
                  <Th className='text-right'>Created</Th>
                  <Th className='text-right'>Raised</Th>
                  <Th className='text-right'>Apps</Th>
                </tr>
              </thead>
              <tbody>
                {applied.map((tenant) => (
                  <tr
                    key={tenant.tenant_id}
                    className='border-t border-border text-sm'
                  >
                    <td className='px-4 py-2.5 text-textPrimary'>
                      {decodeHtmlEntities(tenant.tenant_name)}
                    </td>
                    <td className='px-4 py-2.5 text-right text-textPrimary'>
                      {tenant.entitlements_created || '-'}
                    </td>
                    <td className='px-4 py-2.5 text-right text-textPrimary'>
                      {tenant.entitlements_raised || '-'}
                    </td>
                    <td className='px-4 py-2.5 text-right text-textPrimary'>
                      {tenant.applications_granted || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================
// Small presentational helpers
// ============================================

function Tile({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className='rounded-lg border border-border p-3'>
      <div
        className={`text-xl font-semibold ${
          muted ? 'text-textSecondary' : 'text-textPrimary'
        }`}
      >
        {value}
      </div>
      <div className='text-xs text-textSecondary'>{label}</div>
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-textSecondary ${className}`}
    >
      {children}
    </th>
  );
}

type ChipTone = 'new' | 'raise' | 'alert' | 'app';

function Chip({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: ChipTone;
  title?: string;
}) {
  const tones: Record<ChipTone, string> = {
    new: 'bg-green-50 text-success',
    raise: 'bg-primary-50 text-primarySolid',
    alert: 'bg-amber-50 text-warning',
    app: 'bg-bgGray text-textSecondary',
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Pull the server's message out of an Axios error, falling back to the raw one. */
function readError(err: unknown): string {
  const axiosLike = err as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    axiosLike?.response?.data?.error?.message ||
    axiosLike?.response?.data?.message ||
    axiosLike?.message ||
    'Something went wrong'
  );
}
