'use client';

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers,
  Mail,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  useGetTenantAnalyticsDetail,
  useSendTenantEmail,
} from '@/lib/api/hooks/useTenantAnalytics';
import type { TenantActivityStatus } from '@/lib/api/tenantAnalytics';

import { BRAND_NAME } from '@/lib/brand';

import PageHeader from '@/components/common/PageHeader';

const STATUS_BADGE: Record<
  TenantActivityStatus,
  { bg: string; text: string; label: string }
> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Active' },
  dormant: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Dormant' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
};

/** Wrap a plain message in a clean, branded HTML email. */
function buildEmailHtml(tenantName: string, message: string): string {
  const body = message
    .split('\n')
    .map((l) =>
      l.trim()
        ? `<p style="margin:0 0 14px;line-height:1.6;color:#374151">${l}</p>`
        : '<br/>',
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="background:#4f46e5;padding:20px 28px"><span style="color:#ffffff;font-size:18px;font-weight:700">${BRAND_NAME}</span></td></tr>
      <tr><td style="padding:28px"><p style="margin:0 0 16px;color:#111827;font-size:16px">Hi ${tenantName},</p>${body}
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px">The ${BRAND_NAME} team</p></td></tr>
      <tr><td style="background:#f9fafb;padding:16px 28px;color:#9ca3af;font-size:12px">You're receiving this because you're a ${BRAND_NAME} customer.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export default function TenantAnalyticsDetailPage() {
  const params = useParams();
  const id =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : undefined;
  const { data: d, isLoading, error } = useGetTenantAnalyticsDetail(id);
  const sendEmail = useSendTenantEmail(id);

  const [showEmail, setShowEmail] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sentMsg, setSentMsg] = useState('');

  const ownerEmail = d?.tenant.ownerEmail ?? '';
  const recipient = to || ownerEmail;

  const openEmail = () => {
    setTo(ownerEmail);
    setSubject('');
    setMessage('');
    setSentMsg('');
    setShowEmail(true);
  };

  const handleSend = () => {
    if (!d) return;
    const html = buildEmailHtml(d.tenant.name, message);
    sendEmail.mutate(
      { to: recipient, subject, html },
      {
        onSuccess: (r) => {
          setSentMsg(`Email sent to ${r.to}`);
          setShowEmail(false);
        },
      },
    );
  };

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '-';

  const oc = d?.offeringCounts ?? {
    courses: 0,
    books: 0,
    bundles: 0,
    batches: 0,
    testSeries: 0,
  };

  const offeringCards = useMemo(
    () =>
      d
        ? [
            { label: 'Courses', value: oc.courses, icon: GraduationCap },
            { label: 'Books', value: oc.books, icon: BookOpen },
            { label: 'Bundles', value: oc.bundles, icon: Layers },
            { label: 'Batches', value: oc.batches, icon: Users },
            { label: 'Test Series', value: oc.testSeries, icon: Layers },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d],
  );

  if (error) {
    return (
      <div className='p-8'>
        <Link
          href='/tenants/analytics'
          className='mb-4 inline-flex items-center gap-1 text-sm text-textSecondary hover:text-textPrimary'
        >
          <ArrowLeft className='h-4 w-4' /> Back
        </Link>
        <p className='text-error'>Failed to load: {error.message}</p>
      </div>
    );
  }

  return (
    <div className='p-8'>
      <Link
        href='/tenants/analytics'
        className='mb-4 inline-flex items-center gap-1 text-sm text-textSecondary hover:text-textPrimary'
      >
        <ArrowLeft className='h-4 w-4' /> Back to Tenant Analytics
      </Link>

      <PageHeader
        title={d?.tenant.name ?? (isLoading ? 'Loading…' : 'Tenant')}
        description={d ? `${d.tenant.slug} · owner: ${ownerEmail || '-'}` : ''}
        actions={[
          {
            label: 'Send Email',
            icon: Mail,
            variant: 'primary',
            onClick: openEmail,
          },
        ]}
      />

      {sentMsg && (
        <p className='mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700'>
          {sentMsg}
        </p>
      )}

      {d && (
        <>
          <div className='mb-6 flex flex-wrap items-center gap-3'>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE[d.activityStatus].bg} ${STATUS_BADGE[d.activityStatus].text}`}
            >
              {STATUS_BADGE[d.activityStatus].label}
            </span>
            <span className='text-sm text-textSecondary'>
              Last activity: {fmt(d.lastActivityAt)}
            </span>
            {d.subscription && (
              <span className='text-sm text-textSecondary'>
                · Plan: {d.subscription.plan} ({d.subscription.status})
              </span>
            )}
          </div>

          {/* Plan / validity / URLs */}
          <section className='mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4'>
            <div className='bg-surface p-4'>
              <p className='text-xs uppercase tracking-wide text-textSecondary'>
                Plan
              </p>
              <p className='text-sm font-semibold text-textPrimary'>
                {d.subscription?.plan ?? 'No active plan'}
              </p>
              {d.subscription?.planCode && (
                <p className='text-xs text-textSecondary'>
                  {d.subscription.planCode}
                </p>
              )}
            </div>
            <div className='bg-surface p-4'>
              <p className='text-xs uppercase tracking-wide text-textSecondary'>
                Valid until
              </p>
              <p className='text-sm font-semibold text-textPrimary'>
                {d.subscription?.validUntil
                  ? fmt(d.subscription.validUntil)
                  : '-'}
              </p>
            </div>
            <div className='bg-surface p-4'>
              <p className='text-xs uppercase tracking-wide text-textSecondary'>
                Owner contact
              </p>
              <p
                className='truncate text-sm font-semibold text-textPrimary'
                title={d.tenant.ownerEmail ?? ''}
              >
                {d.tenant.ownerEmail ?? '-'}
              </p>
              <p className='text-xs text-textSecondary'>
                {d.tenant.ownerPhone ?? 'No phone'}
              </p>
            </div>
            <div className='bg-surface p-4'>
              <p className='text-xs uppercase tracking-wide text-textSecondary'>
                Platform URL
              </p>
              <a
                href={d.tenant.platformUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='block truncate text-sm font-semibold text-primary hover:underline'
                title={d.tenant.platformUrl}
              >
                {d.tenant.platformUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
            <div className='bg-surface p-4'>
              <p className='text-xs uppercase tracking-wide text-textSecondary'>
                Custom URL
              </p>
              {d.tenant.customUrl ? (
                <a
                  href={d.tenant.customUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block truncate text-sm font-semibold text-primary hover:underline'
                  title={d.tenant.customUrl}
                >
                  {d.tenant.customUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <p className='text-sm text-textSecondary'>None</p>
              )}
            </div>
          </section>

          {/* Top metrics */}
          <section className='mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4'>
            <div className='border-t border-border pt-5 pb-2'>
              <Users className='mb-2 h-5 w-5 text-rose-500' />
              <div className='text-2xl font-bold text-textPrimary'>
                {d.members.total.toLocaleString()}
              </div>
              <div className='text-sm text-textSecondary'>
                Members ({d.members.recentLogins} active recently)
              </div>
            </div>
            <div className='border-t border-border pt-5 pb-2'>
              <GraduationCap className='mb-2 h-5 w-5 text-indigo-500' />
              <div className='text-2xl font-bold text-textPrimary'>
                {oc.courses.toLocaleString()}
              </div>
              <div className='text-sm text-textSecondary'>Courses launched</div>
            </div>
            <div className='border-t border-border pt-5 pb-2'>
              <CheckCircle2 className='mb-2 h-5 w-5 text-green-500' />
              <div className='text-2xl font-bold text-textPrimary'>
                {d.featuresUsed.length}
              </div>
              <div className='text-sm text-textSecondary'>
                Features in use ({d.featuresUnused.length} unused)
              </div>
            </div>
          </section>

          {/* Offerings breakdown */}
          <section className='mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
            {offeringCards.map((c) => (
              <div
                key={c.label}
                className='rounded-lg border border-border bg-surface px-4 py-4'
              >
                <c.icon className='mb-1 h-4 w-4 text-textSecondary' />
                <div className='text-xl font-bold text-textPrimary'>
                  {Number(c.value).toLocaleString()}
                </div>
                <div className='text-xs text-textSecondary'>{c.label}</div>
              </div>
            ))}
          </section>

          {/* Features used vs unused */}
          <section className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <div className='border-t border-border pt-5 pb-2'>
              <h3 className='mb-3 flex items-center gap-2 text-sm font-semibold text-textPrimary'>
                <CheckCircle2 className='h-4 w-4 text-green-600' /> Features in
                use ({d.featuresUsed.length})
              </h3>
              <ul className='space-y-2'>
                {d.featuresUsed.length === 0 && (
                  <li className='text-sm text-textSecondary'>
                    No measured usage yet.
                  </li>
                )}
                {d.featuresUsed.map((f) => (
                  <li
                    key={f.productCode}
                    className='flex items-center justify-between text-sm'
                  >
                    <span className='text-textPrimary'>{f.featureKey}</span>
                    <span className='text-textSecondary'>
                      {f.currentUsage}
                      {f.isUnlimited ? '' : ` / ${f.limitValue}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className='border-t border-border pt-5 pb-2'>
              <h3 className='mb-3 flex items-center gap-2 text-sm font-semibold text-textPrimary'>
                <XCircle className='h-4 w-4 text-gray-400' /> Not used (
                {d.featuresUnused.length})
              </h3>
              <ul className='space-y-2'>
                {d.featuresUnused.length === 0 && (
                  <li className='text-sm text-textSecondary'>
                    Everything they have is being used.
                  </li>
                )}
                {d.featuresUnused.map((f) => (
                  <li
                    key={f.productCode}
                    className='flex items-center justify-between text-sm'
                  >
                    <span className='text-textSecondary'>{f.featureKey}</span>
                    <span className='text-xs text-textSecondary'>
                      {f.isUnlimited ? 'unlimited' : `limit ${f.limitValue}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Recent activity */}
          <section className='mt-4 border-t border-border pt-5 pb-2'>
            <h3 className='mb-3 text-sm font-semibold text-textPrimary'>
              Recent activity
            </h3>
            {d.recentActivity.length === 0 ? (
              <p className='text-sm text-textSecondary'>
                No recorded activity yet.
              </p>
            ) : (
              <ul className='divide-y divide-border'>
                {d.recentActivity.map((a, i) => (
                  <li
                    key={i}
                    className='flex items-center justify-between py-2 text-sm'
                  >
                    <div>
                      <span className='text-textPrimary'>{a.summary}</span>
                      {a.product && (
                        <span className='ml-2 rounded bg-bgGray px-1.5 py-0.5 text-xs text-textSecondary'>
                          {a.product}
                        </span>
                      )}
                      {a.actor && (
                        <span className='ml-2 text-xs text-textSecondary'>
                          by {a.actor}
                        </span>
                      )}
                    </div>
                    <span className='whitespace-nowrap text-xs text-textSecondary'>
                      {fmt(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </>
      )}

      {/* Email composer modal */}
      {showEmail && d && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl'>
            <h2 className='mb-1 text-lg font-semibold text-textPrimary'>
              Email {d.tenant.name}
            </h2>
            <p className='mb-4 text-sm text-textSecondary'>
              Sends a clean, branded email. The body is wrapped in a nice
              template automatically.
            </p>
            <div className='space-y-3'>
              <div>
                <label className='mb-1 block text-sm font-medium text-textPrimary'>
                  To
                </label>
                <input
                  type='email'
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder={ownerEmail || 'recipient@example.com'}
                  className='h-10 w-full rounded-lg border border-border bg-bgGray px-3 text-sm'
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-medium text-textPrimary'>
                  Subject
                </label>
                <input
                  type='text'
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className='h-10 w-full rounded-lg border border-border bg-bgGray px-3 text-sm'
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-medium text-textPrimary'>
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className='w-full rounded-lg border border-border bg-bgGray px-3 py-2 text-sm'
                  placeholder='Write your message… (line breaks become paragraphs)'
                />
              </div>
            </div>
            {sendEmail.isError && (
              <p className='mt-3 text-sm text-error'>
                {(sendEmail.error as Error)?.message || 'Failed to send'}
              </p>
            )}
            <div className='mt-5 flex justify-end gap-3'>
              <button
                type='button'
                onClick={() => setShowEmail(false)}
                disabled={sendEmail.isLoading}
                className='rounded-lg border border-border px-4 py-2 text-sm font-medium text-textPrimary hover:bg-bgGray disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleSend}
                disabled={
                  sendEmail.isLoading ||
                  !recipient ||
                  !subject.trim() ||
                  !message.trim()
                }
                className='inline-flex h-10 items-center gap-2 rounded-lg bg-primarySolid px-5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-60'
              >
                <Mail className='h-4 w-4' />
                {sendEmail.isLoading ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
