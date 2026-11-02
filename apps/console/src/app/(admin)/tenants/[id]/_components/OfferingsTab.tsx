'use client';

import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Layers,
  Loader2,
  Package,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import {
  useGetTenantBatches,
  useGetTenantBookDetail,
  useGetTenantBooks,
  useGetTenantBundles,
  useGetTenantCourseDetail,
  useGetTenantCourses,
  useGetTenantOfferingsSummary,
  useGetTenantTestSeries,
} from '@/lib/api/hooks';

import {
  formatBytes,
  formatDate,
  formatMoney,
  statusBadgeClass,
} from './format';

type Section = 'courses' | 'books' | 'bundles' | 'batches' | 'test-series';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'courses', label: 'Courses' },
  { id: 'books', label: 'Books' },
  { id: 'bundles', label: 'Bundles' },
  { id: 'batches', label: 'Batches' },
  { id: 'test-series', label: 'Test Series' },
];

const PAGE_SIZE = 20;

/** Turn an UPPER_SNAKE status into a readable Title Case label. */
const prettyLabel = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Status badge, used for course / book / bundle / batch states. */
const Badge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
      status,
    )}`}
  >
    {prettyLabel(status)}
  </span>
);

/** Neutral pill, used for type / mode / visibility descriptors. */
const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className='inline-flex items-center rounded-md bg-bgGray px-2 py-0.5 text-xs font-medium text-textSecondary'>
    {children}
  </span>
);

/** Stacked INR / USD price, or a "Free" badge. */
const PriceCell = ({
  isFree,
  inr,
  usd,
}: {
  isFree: boolean;
  inr: number | null | undefined;
  usd: number | null | undefined;
}) => {
  if (isFree) {
    return (
      <span className='inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-semibold text-success'>
        Free
      </span>
    );
  }
  return (
    <div className='space-y-0.5 leading-tight'>
      <div className='font-medium text-textPrimary'>
        {formatMoney(inr, 'INR')}
      </div>
      <div className='text-xs text-textSecondary'>
        {formatMoney(usd, 'USD')}
      </div>
    </div>
  );
};

/** A right-aligned numeric metric cell. */
const NumCell = ({ children }: { children: React.ReactNode }) => (
  <td className='whitespace-nowrap px-6 py-4 text-right text-sm font-medium tabular-nums text-textPrimary'>
    {children}
  </td>
);

function SummaryStrip({ tenantId }: { tenantId: string }) {
  const { data } = useGetTenantOfferingsSummary(tenantId);
  if (!data) return null;
  const cards = [
    {
      label: 'Courses',
      icon: GraduationCap,
      total: data.courses.total,
      by: data.courses.by_status,
    },
    {
      label: 'Books',
      icon: BookOpen,
      total: data.books.total,
      by: data.books.by_status,
    },
    {
      label: 'Bundles',
      icon: Layers,
      total: data.bundles.total,
      by: data.bundles.by_status,
    },
    {
      label: 'Batches',
      icon: CalendarClock,
      total: data.batches.total,
      by: data.batches.by_status,
    },
    {
      label: 'Test Series',
      icon: ClipboardList,
      total: data.test_series.total,
      by: data.test_series.by_status,
    },
  ];
  return (
    <div className='mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5'>
      {cards.map((c) => {
        const Icon = c.icon;
        const breakdown = Object.entries(c.by ?? {});
        return (
          <div
            key={c.label}
            className='rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md'
          >
            <div className='flex items-center gap-3'>
              <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600'>
                <Icon className='h-5 w-5' />
              </div>
              <div className='min-w-0'>
                <div className='text-3xl font-bold leading-none text-textPrimary'>
                  {c.total}
                </div>
                <div className='mt-1.5 text-sm font-medium text-textSecondary'>
                  {c.label}
                </div>
              </div>
            </div>
            <div className='mt-4 flex flex-wrap gap-1.5'>
              {breakdown.length === 0 ? (
                <span className='text-xs text-textSecondary'>No items yet</span>
              ) : (
                breakdown.map(([status, count]) => (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                      status,
                    )}`}
                  >
                    {prettyLabel(status)}
                    <span className='font-bold'>{count}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className='flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
      <span className='text-sm text-textSecondary'>
        Page <span className='font-medium text-textPrimary'>{page}</span> of{' '}
        {Math.max(1, totalPages)} &nbsp;•&nbsp;{' '}
        <span className='font-medium text-textPrimary'>{total}</span> total
      </span>
      <div className='flex gap-2'>
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className='rounded-lg border border-border bg-surface px-4 py-1.5 text-sm font-medium text-textPrimary transition hover:bg-bgGray disabled:cursor-not-allowed disabled:opacity-50'
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className='rounded-lg border border-border bg-surface px-4 py-1.5 text-sm font-medium text-textPrimary transition hover:bg-bgGray disabled:cursor-not-allowed disabled:opacity-50'
        >
          Next
        </button>
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className='flex h-56 items-center justify-center'>
    <Loader2 className='h-6 w-6 animate-spin text-primary-600' />
  </div>
);

const Empty = ({ label }: { label: string }) => (
  <div className='flex h-56 flex-col items-center justify-center text-textSecondary'>
    <div className='flex h-14 w-14 items-center justify-center rounded-full bg-bgGray'>
      <Package className='h-7 w-7' />
    </div>
    <p className='mt-3 text-sm font-medium'>No {label} found</p>
    <p className='mt-1 text-xs text-textSecondary'>
      This tenant has not created any {label} yet.
    </p>
  </div>
);

/** Shared table header cell. */
const Th = ({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) => (
  <th
    className={`px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-textSecondary ${
      align === 'right' ? 'text-right' : 'text-left'
    }`}
  >
    {children}
  </th>
);

/** Title + slug cell, optionally with an expand chevron. */
const TitleCell = ({
  title,
  slug,
  expandable,
  expanded,
}: {
  title: string;
  slug: string;
  expandable?: boolean;
  expanded?: boolean;
}) => (
  <td className='px-6 py-4'>
    <div className='flex items-start gap-2.5'>
      {expandable && (
        <div className='mt-0.5 text-textSecondary'>
          {expanded ? (
            <ChevronDown className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
        </div>
      )}
      <div className='min-w-0'>
        <div className='font-semibold text-textPrimary'>{title}</div>
        <div className='mt-0.5 truncate text-xs text-textSecondary'>{slug}</div>
      </div>
    </div>
  </td>
);

/** Compact label/value tile used inside expanded detail panels. */
const MetaItem = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className='rounded-lg border border-border bg-surface px-3 py-2'>
    <div className='text-[10px] font-semibold uppercase tracking-wide text-textSecondary'>
      {label}
    </div>
    <div className='mt-1 text-sm font-semibold text-textPrimary'>{value}</div>
  </div>
);

// ---------- Courses ----------
function CourseDetail({
  tenantId,
  courseId,
}: {
  tenantId: string;
  courseId: string;
}) {
  const { data, isLoading } = useGetTenantCourseDetail(tenantId, courseId);
  if (isLoading) return <Spinner />;
  if (!data) return null;
  return (
    <div className='space-y-4 bg-bgGray p-6'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
        <MetaItem label='Difficulty' value={data.difficulty || '-'} />
        <MetaItem label='Languages' value={data.language.join(', ') || '-'} />
        <MetaItem label='Duration' value={data.duration || '-'} />
        <MetaItem label='Enrollments' value={data.enrollment_count} />
        <MetaItem label='Lectures' value={data.total_lectures} />
      </div>
      {data.sections.map((section) => (
        <div
          key={section.id}
          className='overflow-hidden border-t border-border'
        >
          <div className='border-b border-border bg-bgGray px-4 py-2.5 text-sm font-semibold text-textPrimary'>
            {section.title}
          </div>
          {section.lessons.map((lesson) => (
            <div
              key={lesson.id}
              className='border-b border-border last:border-0'
            >
              <div className='flex items-center gap-2 px-4 py-2 text-xs font-medium text-textSecondary'>
                {lesson.title}
                <Pill>{lesson.type}</Pill>
              </div>
              {lesson.lectures.map((lec) => (
                <div
                  key={lec.id}
                  className='flex items-center justify-between gap-4 border-t border-border bg-bgGray/40 px-4 py-2 pl-8 text-xs text-textPrimary'
                >
                  <span className='truncate'>{lec.title}</span>
                  <span className='flex shrink-0 items-center gap-3 text-textSecondary'>
                    <span>{lec.duration || '-'}</span>
                    <span>{lec.video_provider || 'no video'}</span>
                    <Pill>{lec.processing_status}</Pill>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CoursesSection({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useGetTenantCourses(tenantId, {
    page,
    limit: PAGE_SIZE,
  });
  if (isLoading) return <Spinner />;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <Empty label='courses' />;
  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border'>
              <Th>Course</Th>
              <Th>Type / Mode</Th>
              <Th>Status</Th>
              <Th>Price</Th>
              <Th align='right'>Sections</Th>
              <Th align='right'>Lectures</Th>
              <Th align='right'>Enrolled</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.id}>
                <tr
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-bgGray/60 ${
                    expanded === c.id ? 'bg-bgGray/60' : ''
                  }`}
                >
                  <TitleCell
                    title={c.title}
                    slug={c.slug}
                    expandable
                    expanded={expanded === c.id}
                  />
                  <td className='px-6 py-4'>
                    <div className='flex flex-wrap gap-1.5'>
                      <Pill>{prettyLabel(c.course_type)}</Pill>
                      <Pill>{prettyLabel(c.mode)}</Pill>
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <Badge status={c.status} />
                  </td>
                  <td className='px-6 py-4'>
                    <PriceCell
                      isFree={c.purchase_mode === 'FREE'}
                      inr={c.price_inr}
                      usd={c.price_usd}
                    />
                  </td>
                  <NumCell>{c.section_count}</NumCell>
                  <NumCell>{c.lecture_count}</NumCell>
                  <NumCell>{c.enrollment_count}</NumCell>
                </tr>
                {expanded === c.id && (
                  <tr>
                    <td colSpan={7} className='p-0'>
                      <CourseDetail tenantId={tenantId} courseId={c.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </>
  );
}

// ---------- Books ----------
function BookDetail({
  tenantId,
  bookId,
}: {
  tenantId: string;
  bookId: string;
}) {
  const { data, isLoading } = useGetTenantBookDetail(tenantId, bookId);
  if (isLoading) return <Spinner />;
  if (!data) return null;
  return (
    <div className='space-y-4 bg-bgGray p-6'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
        <MetaItem label='Format' value={data.file_format} />
        <MetaItem label='Pages' value={data.pages ?? '-'} />
        <MetaItem label='Page images' value={data.page_images_count} />
        <MetaItem
          label='Sample'
          value={
            data.sample_enabled ? `${data.sample_pages ?? 0} pages` : 'Off'
          }
        />
        <MetaItem label='Purchases' value={data.book_access_count} />
      </div>
      {data.summary && (
        <p className='rounded-lg border border-border bg-surface px-4 py-3 text-sm text-textPrimary'>
          {data.summary}
        </p>
      )}
      <div className='overflow-hidden border-t border-border'>
        <div className='border-b border-border bg-bgGray px-4 py-2.5 text-sm font-semibold text-textPrimary'>
          Conversions ({data.conversions.length})
        </div>
        {data.conversions.length === 0 ? (
          <p className='px-4 py-4 text-sm text-textSecondary'>
            No PDF/EPUB conversions recorded.
          </p>
        ) : (
          <table className='w-full text-xs'>
            <thead>
              <tr className='border-b border-border text-left text-textSecondary'>
                <th className='px-4 py-2 font-semibold'>Source</th>
                <th className='px-4 py-2 font-semibold'>Source size</th>
                <th className='px-4 py-2 font-semibold'>Output</th>
                <th className='px-4 py-2 font-semibold'>Output size</th>
                <th className='px-4 py-2 font-semibold'>Status</th>
                <th className='px-4 py-2 font-semibold'>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.conversions.map((cv) => (
                <tr
                  key={cv.id}
                  className='border-b border-border text-textPrimary last:border-0'
                >
                  <td className='px-4 py-2.5'>
                    {cv.source_type} • {cv.source_filename}
                  </td>
                  <td className='px-4 py-2.5'>
                    {formatBytes(cv.source_size_bytes)}
                  </td>
                  <td className='px-4 py-2.5'>
                    {cv.output_key ? 'ready' : '-'}
                  </td>
                  <td className='px-4 py-2.5'>
                    {cv.output_size_bytes != null
                      ? formatBytes(cv.output_size_bytes)
                      : '-'}
                  </td>
                  <td className='px-4 py-2.5'>
                    <Pill>{cv.status}</Pill>
                  </td>
                  <td className='px-4 py-2.5'>{formatDate(cv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BooksSection({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useGetTenantBooks(tenantId, {
    page,
    limit: PAGE_SIZE,
  });
  if (isLoading) return <Spinner />;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <Empty label='books' />;
  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border'>
              <Th>Book</Th>
              <Th>Author</Th>
              <Th>Format</Th>
              <Th>Status</Th>
              <Th>Price</Th>
              <Th align='right'>Pages</Th>
              <Th align='right'>Purchases</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <Fragment key={b.id}>
                <tr
                  onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-bgGray/60 ${
                    expanded === b.id ? 'bg-bgGray/60' : ''
                  }`}
                >
                  <TitleCell
                    title={b.title}
                    slug={b.slug}
                    expandable
                    expanded={expanded === b.id}
                  />
                  <td className='px-6 py-4 text-textSecondary'>
                    {b.author || '-'}
                  </td>
                  <td className='px-6 py-4'>
                    <Pill>{b.file_format}</Pill>
                  </td>
                  <td className='px-6 py-4'>
                    <Badge status={b.status} />
                  </td>
                  <td className='px-6 py-4'>
                    <PriceCell
                      isFree={b.purchase_mode === 'FREE'}
                      inr={b.price_inr}
                      usd={b.price_usd}
                    />
                  </td>
                  <NumCell>{b.pages ?? '-'}</NumCell>
                  <NumCell>{b.book_access_count}</NumCell>
                </tr>
                {expanded === b.id && (
                  <tr>
                    <td colSpan={7} className='p-0'>
                      <BookDetail tenantId={tenantId} bookId={b.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </>
  );
}

// ---------- Bundles / Batches / Test Series ----------
function BundlesSection({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetTenantBundles(tenantId, {
    page,
    limit: PAGE_SIZE,
  });
  if (isLoading) return <Spinner />;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <Empty label='bundles' />;
  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border'>
              <Th>Bundle</Th>
              <Th>Status</Th>
              <Th>Price</Th>
              <Th>Items</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((bn) => (
              <tr
                key={bn.id}
                className='border-b border-border transition-colors last:border-0 hover:bg-bgGray/60'
              >
                <TitleCell title={bn.title} slug={bn.slug} />
                <td className='px-6 py-4'>
                  <Badge status={bn.status} />
                </td>
                <td className='px-6 py-4'>
                  <PriceCell
                    isFree={bn.purchase_mode === 'FREE'}
                    inr={bn.price_inr}
                    usd={bn.price_usd}
                  />
                </td>
                <td className='px-6 py-4'>
                  {bn.items.length === 0 ? (
                    <span className='text-textSecondary'>-</span>
                  ) : (
                    <div className='flex max-w-md flex-wrap gap-1.5'>
                      {bn.items.map((i, idx) => (
                        <Pill key={idx}>
                          {prettyLabel(i.item_type)}: {i.title ?? i.slug ?? '?'}
                        </Pill>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </>
  );
}

function BatchesSection({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetTenantBatches(tenantId, {
    page,
    limit: PAGE_SIZE,
  });
  if (isLoading) return <Spinner />;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <Empty label='batches' />;
  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border'>
              <Th>Batch</Th>
              <Th>Status</Th>
              <Th>Schedule</Th>
              <Th>Price</Th>
              <Th align='right'>Enrolled</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((bt) => (
              <tr
                key={bt.id}
                className='border-b border-border transition-colors last:border-0 hover:bg-bgGray/60'
              >
                <TitleCell title={bt.title} slug={bt.slug} />
                <td className='px-6 py-4'>
                  <Badge status={bt.status} />
                </td>
                <td className='whitespace-nowrap px-6 py-4 text-textSecondary'>
                  {formatDate(bt.start_date)}
                  <span className='mx-1.5 text-textSecondary'>→</span>
                  {formatDate(bt.end_date)}
                </td>
                <td className='px-6 py-4'>
                  <PriceCell
                    isFree={bt.purchase_mode === 'FREE'}
                    inr={bt.price_inr}
                    usd={bt.price_usd}
                  />
                </td>
                <NumCell>{bt.total_enrollments}</NumCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </>
  );
}

function TestSeriesSection({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetTenantTestSeries(tenantId, {
    page,
    limit: PAGE_SIZE,
  });
  if (isLoading) return <Spinner />;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <Empty label='test series' />;
  return (
    <>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border'>
              <Th>Test Series</Th>
              <Th>Status</Th>
              <Th>Pricing</Th>
              <Th>Visibility</Th>
              <Th align='right'>Tests</Th>
              <Th align='right'>Enrolled</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ts) => (
              <tr
                key={ts.id}
                className='border-b border-border transition-colors last:border-0 hover:bg-bgGray/60'
              >
                <TitleCell title={ts.title} slug={ts.slug} />
                <td className='px-6 py-4'>
                  <Badge status={ts.status} />
                </td>
                <td className='px-6 py-4'>
                  <PriceCell
                    isFree={ts.pricing_type === 'FREE'}
                    inr={ts.price_inr}
                    usd={ts.price_usd}
                  />
                </td>
                <td className='px-6 py-4'>
                  <div className='flex flex-wrap gap-1.5'>
                    <Pill>{prettyLabel(ts.visibility)}</Pill>
                    <Pill>{prettyLabel(ts.access_mode)}</Pill>
                  </div>
                </td>
                <NumCell>{ts.test_count}</NumCell>
                <NumCell>{ts.enrollment_count}</NumCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onChange={setPage}
      />
    </>
  );
}

export default function OfferingsTab({ tenantId }: { tenantId: string }) {
  const [section, setSection] = useState<Section>('courses');
  return (
    <div>
      <div className='mb-6'>
        <h3 className='text-lg font-semibold text-textPrimary'>Offerings</h3>
        <p className='mt-1 text-sm text-textSecondary'>
          Everything this tenant has published and is selling, across courses,
          books, bundles, batches and test series.
        </p>
      </div>

      <SummaryStrip tenantId={tenantId} />

      <div className='mb-5 flex flex-wrap gap-2'>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              section === s.id
                ? 'bg-primarySolid text-white shadow-sm'
                : 'border border-border bg-surface text-textSecondary hover:bg-bgGray hover:text-textPrimary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className='overflow-hidden rounded-xl border border-border bg-surface shadow-sm'>
        {section === 'courses' && <CoursesSection tenantId={tenantId} />}
        {section === 'books' && <BooksSection tenantId={tenantId} />}
        {section === 'bundles' && <BundlesSection tenantId={tenantId} />}
        {section === 'batches' && <BatchesSection tenantId={tenantId} />}
        {section === 'test-series' && <TestSeriesSection tenantId={tenantId} />}
      </div>
    </div>
  );
}
