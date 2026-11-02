"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import { decodeHtmlEntities, getErrorMessage } from "@open-mtlms/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  BookOpen,
  Boxes,
  GraduationCap,
  Layers,
  ListChecks,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useBatches } from "../../../lib/hooks/use-batches";
import { useBundles } from "../../../lib/hooks/use-bundles";
import {
  useMemberEnrollments,
  useMemberBookAccess,
  useMemberBatchEnrollments,
  useMemberTestSeriesEnrollments,
  useMemberCertificates,
  usePublishedCourses,
  usePublishedBooks,
  useGrantCourseAccess,
  useRevokeCourseAccess,
  useGrantBookAccess,
  useRevokeBookAccess,
  useGrantBatchAccess,
  useRevokeBatchAccess,
  useGrantTestSeriesAccess,
  useRevokeTestSeriesAccess,
  useGrantBundleAccess,
  useUpdateEnrollmentValidity,
  useUpdateBookAccessValidity,
  useUpdateBatchEnrollmentValidity,
  useUpdateTestSeriesEnrollmentValidity,
  memberKeys,
} from "../../../lib/hooks/use-members";
import { useTestSeriesList } from "../../../lib/hooks/use-test-series";
import type {
  MemberEnrollment,
  MemberBookAccess,
  MemberBatchEnrollment,
  MemberTestSeriesEnrollment,
  MemberCertificate,
  MemberAccessGrantAction,
} from "../../../lib/types/members";
import { EditValidityDialog } from "../EditValidityDialog";
import {
  MemberDataTable,
  type Column,
} from "../shared/MemberDataTable";
import { StatusBadge } from "../shared/StatusBadge";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Lifetime";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function grantActionDescription(action: MemberAccessGrantAction): string {
  switch (action) {
    case "ACCESS_REACTIVATED":
      return "Previous access was reactivated.";
    case "ACCESS_ALREADY_ACTIVE":
      return "Access was already active, nothing changed.";
    default:
      return "Access granted.";
  }
}

interface LearningTabProps {
  memberId: string;
  enabled: boolean;
}

type ValidityTarget =
  | { kind: "enrollment"; row: MemberEnrollment }
  | { kind: "book"; row: MemberBookAccess }
  | { kind: "batch"; row: MemberBatchEnrollment }
  | { kind: "testSeries"; row: MemberTestSeriesEnrollment };

export function LearningTab({ memberId, enabled }: LearningTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: enrollments, isLoading: loadingE } =
    useMemberEnrollments(memberId);
  const { data: bookAccess, isLoading: loadingB } =
    useMemberBookAccess(memberId);
  const { data: batchEnrollments, isLoading: loadingBa } =
    useMemberBatchEnrollments(memberId);
  const { data: testSeriesEnrollments, isLoading: loadingT } =
    useMemberTestSeriesEnrollments(memberId);
  const { data: certificates, isLoading: loadingC } =
    useMemberCertificates(memberId);
  const { data: publishedCourses } = usePublishedCourses(enabled);
  const { data: publishedBooks } = usePublishedBooks(enabled);
  const { data: batchesData } = useBatches(1, 200, { status: "PUBLISHED" });
  const { data: testSeriesData } = useTestSeriesList({
    page: 1,
    limit: 200,
    status: "PUBLISHED",
  });
  const { data: bundlesData } = useBundles(1, 200, { status: "PUBLISHED" });

  const grantCourse = useGrantCourseAccess();
  const revokeCourse = useRevokeCourseAccess();
  const grantBook = useGrantBookAccess();
  const revokeBook = useRevokeBookAccess();
  const grantBatch = useGrantBatchAccess();
  const revokeBatch = useRevokeBatchAccess();
  const grantTestSeries = useGrantTestSeriesAccess();
  const revokeTestSeries = useRevokeTestSeriesAccess();
  const grantBundle = useGrantBundleAccess();
  const updateEnrollmentValidity = useUpdateEnrollmentValidity();
  const updateBookAccessValidity = useUpdateBookAccessValidity();
  const updateBatchValidity = useUpdateBatchEnrollmentValidity();
  const updateTestSeriesValidity = useUpdateTestSeriesEnrollmentValidity();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedTestSeriesId, setSelectedTestSeriesId] = useState("");
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [validityTarget, setValidityTarget] = useState<ValidityTarget | null>(
    null,
  );

  const grantErrorToast = (err: unknown) =>
    toast({
      title: "Could not grant access",
      description: getErrorMessage(err) ?? "Please try again.",
      variant: "destructive",
    });

  const revokeErrorToast = (err: unknown) =>
    toast({
      title: "Error",
      description: err instanceof Error ? err.message : "Failed",
      variant: "destructive",
    });

  const handleGrantCourse = () => {
    if (!selectedCourseId) return;
    grantCourse.mutate(
      { memberId, courseId: selectedCourseId },
      {
        onSuccess: () => {
          toast({
            title: "Access granted",
            description: "Course enrollment created.",
          });
          setSelectedCourseId("");
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: grantErrorToast,
      },
    );
  };

  const handleGrantBook = () => {
    if (!selectedBookId) return;
    grantBook.mutate(
      { memberId, bookId: selectedBookId },
      {
        onSuccess: () => {
          toast({
            title: "Access granted",
            description: "Book access created.",
          });
          setSelectedBookId("");
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: grantErrorToast,
      },
    );
  };

  const handleGrantBatch = () => {
    if (!selectedBatchId) return;
    grantBatch.mutate(
      { memberId, batchId: selectedBatchId },
      {
        onSuccess: (action) => {
          toast({
            title: "Access granted",
            description: grantActionDescription(action),
          });
          setSelectedBatchId("");
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: grantErrorToast,
      },
    );
  };

  const handleGrantTestSeries = () => {
    if (!selectedTestSeriesId) return;
    grantTestSeries.mutate(
      { memberId, testSeriesId: selectedTestSeriesId },
      {
        onSuccess: (action) => {
          toast({
            title: "Access granted",
            description: grantActionDescription(action),
          });
          setSelectedTestSeriesId("");
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: grantErrorToast,
      },
    );
  };

  const handleGrantBundle = () => {
    if (!selectedBundleId) return;
    grantBundle.mutate(
      { memberId, bundleId: selectedBundleId },
      {
        onSuccess: (action) => {
          toast({
            title: "Bundle granted",
            description: `${grantActionDescription(action)} Contents appear in the course, book and test series lists.`,
          });
          setSelectedBundleId("");
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: grantErrorToast,
      },
    );
  };

  const handleRevokeCourse = (enrollmentId: string) => {
    revokeCourse.mutate(
      { memberId, enrollmentId },
      {
        onSuccess: () => {
          toast({ title: "Access revoked", description: "Enrollment cancelled." });
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: revokeErrorToast,
      }
    );
  };

  const handleRevokeBook = (accessId: string) => {
    revokeBook.mutate(
      { memberId, accessId },
      {
        onSuccess: () => {
          toast({ title: "Access revoked", description: "Book access removed." });
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: revokeErrorToast,
      }
    );
  };

  const handleRevokeBatch = (enrollmentId: string) => {
    revokeBatch.mutate(
      { memberId, enrollmentId },
      {
        onSuccess: () => {
          toast({ title: "Access revoked", description: "Batch enrollment cancelled." });
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: revokeErrorToast,
      }
    );
  };

  const handleRevokeTestSeries = (enrollmentId: string) => {
    revokeTestSeries.mutate(
      { memberId, enrollmentId },
      {
        onSuccess: () => {
          toast({ title: "Access revoked", description: "Test series enrollment cancelled." });
          qc.invalidateQueries({ queryKey: memberKeys.detailStats(memberId) });
        },
        onError: revokeErrorToast,
      }
    );
  };

  const handleSaveValidity = (validTill: string | null) => {
    if (!validityTarget) return;
    const callbacks = {
      onSuccess: () => {
        toast({
          title: "Validity updated",
          description: validTill
            ? "New expiry has been saved."
            : "Set to lifetime access.",
        });
        setValidityTarget(null);
      },
      onError: (err: unknown) =>
        toast({
          title: "Could not update validity",
          description: getErrorMessage(err) ?? "Please try again.",
          variant: "destructive",
        }),
    };
    switch (validityTarget.kind) {
      case "enrollment":
        updateEnrollmentValidity.mutate(
          { memberId, enrollmentId: validityTarget.row.id, validTill },
          callbacks,
        );
        return;
      case "book":
        updateBookAccessValidity.mutate(
          { memberId, accessId: validityTarget.row.id, validTill },
          callbacks,
        );
        return;
      case "batch":
        updateBatchValidity.mutate(
          { memberId, enrollmentId: validityTarget.row.id, validTill },
          callbacks,
        );
        return;
      case "testSeries":
        updateTestSeriesValidity.mutate(
          { memberId, enrollmentId: validityTarget.row.id, validTill },
          callbacks,
        );
        return;
    }
  };

  const validityCell = (
    validTill: string | null,
    onEdit: () => void,
  ) => (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{formatDate(validTill)}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={onEdit}
      >
        <Pencil className="mr-1 h-3 w-3" />
        Edit
      </Button>
    </div>
  );

  const grantPicker = (
    value: string,
    onChange: (v: string) => void,
    items: Array<{ id: string; title: string }>,
    placeholder: string,
    onGrant: () => void,
    isPending: boolean,
  ) => (
      <div className="flex items-center gap-2 pt-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {decodeHtmlEntities(item.title)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onGrant} disabled={!value || isPending}>
          Grant Access
        </Button>
      </div>
    );

  const enrollmentColumns: Column<MemberEnrollment>[] = [
    { key: "course", label: "Course", render: (e) => <span className="font-medium">{decodeHtmlEntities(e.course_title)}</span> },
    { key: "mode", label: "Mode", render: (e) => <Badge variant="outline" className="text-[10px]">{e.course_mode.replace("_", " ")}</Badge> },
    { key: "status", label: "Status", render: (e) => <StatusBadge status={e.status} /> },
    { key: "source", label: "Source", render: (e) => <span className="text-muted-foreground">{e.source}</span> },
    {
      key: "progress",
      label: "Progress",
      render: (e) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${e.progress_percent}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{e.progress_percent}%</span>
        </div>
      ),
    },
    { key: "enrolled", label: "Enrolled", render: (e) => <span className="text-muted-foreground">{formatDate(e.enrolled_at)}</span> },
    {
      key: "valid_till",
      label: "Valid Till",
      render: (e) =>
        validityCell(e.valid_till, () =>
          setValidityTarget({ kind: "enrollment", row: e }),
        ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      render: (e) =>
        e.status === "ACTIVE" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => handleRevokeCourse(e.id)}
            disabled={revokeCourse.isPending}
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  const bookColumns: Column<MemberBookAccess>[] = [
    { key: "book", label: "Book", render: (b) => <span className="font-medium">{decodeHtmlEntities(b.book_title)}</span> },
    { key: "status", label: "Status", render: (b) => <StatusBadge status={b.status} /> },
    { key: "source", label: "Source", render: (b) => <span className="text-muted-foreground">{b.source}</span> },
    {
      key: "valid_till",
      label: "Valid Till",
      render: (b) =>
        validityCell(b.valid_till, () =>
          setValidityTarget({ kind: "book", row: b }),
        ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      render: (b) =>
        b.status === "ACTIVE" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => handleRevokeBook(b.id)}
            disabled={revokeBook.isPending}
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  const batchColumns: Column<MemberBatchEnrollment>[] = [
    { key: "batch", label: "Batch", render: (b) => <span className="font-medium">{decodeHtmlEntities(b.batch_title)}</span> },
    { key: "status", label: "Status", render: (b) => <StatusBadge status={b.status} /> },
    { key: "source", label: "Source", render: (b) => <span className="text-muted-foreground">{b.source}</span> },
    { key: "joined", label: "Joined", render: (b) => <span className="text-muted-foreground">{formatDate(b.joined_at)}</span> },
    {
      key: "valid_till",
      label: "Valid Till",
      render: (b) =>
        validityCell(b.valid_till, () =>
          setValidityTarget({ kind: "batch", row: b }),
        ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      render: (b) =>
        b.status === "ACTIVE" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => handleRevokeBatch(b.id)}
            disabled={revokeBatch.isPending}
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  const testSeriesColumns: Column<MemberTestSeriesEnrollment>[] = [
    { key: "series", label: "Test Series", render: (t) => <span className="font-medium">{decodeHtmlEntities(t.test_series_title)}</span> },
    { key: "status", label: "Status", render: (t) => <StatusBadge status={t.status} /> },
    { key: "source", label: "Source", render: (t) => <span className="text-muted-foreground">{t.source}</span> },
    { key: "enrolled", label: "Enrolled", render: (t) => <span className="text-muted-foreground">{formatDate(t.enrolled_at)}</span> },
    {
      key: "valid_till",
      label: "Valid Till",
      render: (t) =>
        validityCell(t.valid_till, () =>
          setValidityTarget({ kind: "testSeries", row: t }),
        ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      render: (t) => (
        <div className="flex items-center justify-center gap-1">
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href={`/dashboard/test-series/series/${t.test_series_id}/analytics`}>
              <BarChart3 className="mr-1 h-3.5 w-3.5" />
              Analytics
            </Link>
          </Button>
          {t.status === "ACTIVE" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => handleRevokeTestSeries(t.id)}
              disabled={revokeTestSeries.isPending}
            >
              Revoke
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const certColumns: Column<MemberCertificate>[] = [
    { key: "course", label: "Course", render: (c) => <span className="font-medium">{decodeHtmlEntities(c.course_title)}</span> },
    { key: "number", label: "Certificate #", render: (c) => <span className="font-mono text-xs">{c.certificate_number}</span> },
    { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "issued", label: "Issued", render: (c) => <span className="text-muted-foreground">{formatDate(c.issued_at)}</span> },
  ];

  const isSavingValidity =
    updateEnrollmentValidity.isPending ||
    updateBookAccessValidity.isPending ||
    updateBatchValidity.isPending ||
    updateTestSeriesValidity.isPending;
  const validityTitle =
    validityTarget?.kind === "enrollment"
      ? "Edit enrollment validity"
      : validityTarget?.kind === "book"
        ? "Edit book access validity"
        : validityTarget?.kind === "batch"
          ? "Edit batch enrollment validity"
          : "Edit test series validity";
  const validityDescription =
    validityTarget?.kind === "enrollment"
      ? decodeHtmlEntities(validityTarget.row.course_title)
      : validityTarget?.kind === "book"
        ? decodeHtmlEntities(validityTarget.row.book_title)
        : validityTarget?.kind === "batch"
          ? decodeHtmlEntities(validityTarget.row.batch_title)
          : validityTarget?.kind === "testSeries"
            ? decodeHtmlEntities(validityTarget.row.test_series_title)
            : undefined;

  return (
    <div className="space-y-6">
      {/* Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Course Enrollments
          </CardTitle>
          <CardDescription>
            Review enrollments and adjust validity for this student.
          </CardDescription>
          {grantPicker(
            selectedCourseId,
            setSelectedCourseId,
            publishedCourses ?? [],
            "Select a course to grant...",
            handleGrantCourse,
            grantCourse.isPending,
          )}
        </CardHeader>
        <CardContent>
          <MemberDataTable
            columns={enrollmentColumns}
            data={enrollments}
            isLoading={loadingE}
            emptyMessage="No enrollments yet."
            emptyIcon={GraduationCap}
            keyExtractor={(e) => e.id}
          />
        </CardContent>
      </Card>

      {/* Book Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Book Access
          </CardTitle>
          <CardDescription>
            Review book access and adjust validity for this student.
          </CardDescription>
          {grantPicker(
            selectedBookId,
            setSelectedBookId,
            publishedBooks ?? [],
            "Select a book to grant...",
            handleGrantBook,
            grantBook.isPending,
          )}
        </CardHeader>
        <CardContent>
          <MemberDataTable
            columns={bookColumns}
            data={bookAccess}
            isLoading={loadingB}
            emptyMessage="No book access yet."
            emptyIcon={BookOpen}
            keyExtractor={(b) => b.id}
          />
        </CardContent>
      </Card>

      {/* Batch Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" /> Batch Enrollments
          </CardTitle>
          <CardDescription>
            Review batch enrollments and adjust validity for this student.
          </CardDescription>
          {grantPicker(
            selectedBatchId,
            setSelectedBatchId,
            (batchesData?.batches ?? []).map((b) => ({
              id: b.id,
              title: b.title,
            })),
            "Select a batch to grant...",
            handleGrantBatch,
            grantBatch.isPending,
          )}
        </CardHeader>
        <CardContent>
          <MemberDataTable
            columns={batchColumns}
            data={batchEnrollments}
            isLoading={loadingBa}
            emptyMessage="No batch enrollments yet."
            emptyIcon={Layers}
            keyExtractor={(b) => b.id}
          />
        </CardContent>
      </Card>

      {/* Test Series Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" /> Test Series
          </CardTitle>
          <CardDescription>
            Review test series enrollments and adjust validity for this student.
          </CardDescription>
          {grantPicker(
            selectedTestSeriesId,
            setSelectedTestSeriesId,
            (testSeriesData?.series ?? []).map((s) => ({
              id: s.id,
              title: s.title,
            })),
            "Select a test series to grant...",
            handleGrantTestSeries,
            grantTestSeries.isPending,
          )}
        </CardHeader>
        <CardContent>
          <MemberDataTable
            columns={testSeriesColumns}
            data={testSeriesEnrollments}
            isLoading={loadingT}
            emptyMessage="No test series enrollments yet."
            emptyIcon={ListChecks}
            keyExtractor={(t) => t.id}
          />
        </CardContent>
      </Card>

      {/* Bundle grant (grant-only, no list of its own) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" /> Grant Bundle
          </CardTitle>
          <CardDescription>
            Granting a bundle grants each of its items individually. The
            contents appear in the course, book and test series lists above and
            are revoked individually there.
          </CardDescription>
          {grantPicker(
            selectedBundleId,
            setSelectedBundleId,
            (bundlesData?.bundles ?? []).map((b) => ({
              id: b.id,
              title: b.title,
            })),
            "Select a bundle to grant...",
            handleGrantBundle,
            grantBundle.isPending,
          )}
        </CardHeader>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" /> Certificates
          </CardTitle>
          <CardDescription>Certificates earned by this student</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberDataTable
            columns={certColumns}
            data={certificates}
            isLoading={loadingC}
            emptyMessage="No certificates yet."
            emptyIcon={Award}
            keyExtractor={(c) => c.id}
          />
        </CardContent>
      </Card>

      <EditValidityDialog
        open={validityTarget !== null}
        onOpenChange={(open) => {
          if (!open) setValidityTarget(null);
        }}
        title={validityTitle}
        description={validityDescription}
        currentValidTill={validityTarget ? validityTarget.row.valid_till : null}
        isSaving={isSavingValidity}
        onSave={handleSaveValidity}
      />
    </div>
  );
}
