"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import {
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Search,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";


import { StatCard } from "../../../../components/dashboard/StatCard";
import { RevenueBreakdownDisplay } from "../../../../components/shared/RevenueBreakdown";
import { AddUserModal } from "../../../../components/users/AddUserModal";
import {
  useMembers,
  useMemberStats,
  useUpdateMemberStatus,
} from "../../../../lib/hooks/use-members";
import { useTenantStore } from "../../../../lib/stores/tenant-store";
import type { MemberListItem, MemberStatus } from "../../../../lib/types/members";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DEACTIVATED", label: "Deactivated" },
];

const SORT_OPTIONS = [
  { value: "joined_at", label: "Date Joined" },
  { value: "name", label: "Name" },
  { value: "last_login_at", label: "Last Login" },
];

function statusBadge(status: MemberStatus) {
  const map: Record<MemberStatus, { variant: "default" | "secondary" | "destructive"; label: string }> = {
    ACTIVE: { variant: "default", label: "Active" },
    SUSPENDED: { variant: "destructive", label: "Suspended" },
    DEACTIVATED: { variant: "secondary", label: "Deactivated" },
  };
  const s = map[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


export default function UsersPage() {
  const { selectedTenantId } = useTenantStore();
  const { toast } = useToast();

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("joined_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const limit = 20;

  const { data: stats } = useMemberStats(!!selectedTenantId);
  const { data, isLoading, error } = useMembers(
    {
      page,
      limit,
      search: debouncedSearch || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      sortBy,
      sortOrder,
    },
    !!selectedTenantId
  );

  const updateStatus = useUpdateMemberStatus();

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      const timeout = setTimeout(() => setDebouncedSearch(value), 400);
      return () => clearTimeout(timeout);
    },
    []
  );

  const handleStatusChange = (memberId: string, newStatus: string) => {
    updateStatus.mutate(
      { memberId, status: newStatus },
      {
        onSuccess: () => {
          toast({
            title: "Status updated",
            description: `Member status changed to ${newStatus.toLowerCase()}.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to update status",
            variant: "destructive",
          });
        },
      }
    );
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage your students, enrollments, and access
          </p>
        </div>
        <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddUserOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Add user
            </Button>
            <Link href="/dashboard/users/bulk-enroll">
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" /> Bulk enroll existing users
              </Button>
            </Link>
            <Link href="/dashboard/users/bulk-import">
              <Button size="sm">
                <UploadCloud className="mr-2 h-4 w-4" /> Bulk import
              </Button>
            </Link>
        </div>
      </div>

      <AddUserModal open={addUserOpen} onOpenChange={setAddUserOpen} />

      {/* Stats */}
      {stats && (
        <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={stats.total_members.toLocaleString()}
            icon={Users}
            subtitle={`${stats.new_members_30d} new in last 30 days`}
          />
          <StatCard
            title="Active"
            value={stats.active_members.toLocaleString()}
            icon={UserCheck}
            subtitle="Currently active students"
          />
          <StatCard
            title="Suspended"
            value={stats.suspended_members.toLocaleString()}
            icon={ShieldAlert}
            subtitle="Temporarily suspended"
          />
          <StatCard
            title="New (30 days)"
            value={stats.new_members_30d.toLocaleString()}
            icon={UserCheck}
            subtitle="Joined recently"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            aria-label="Search users"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
        >
          {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading members...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-destructive">
              {error instanceof Error ? error.message : "Failed to load members"}
            </div>
          ) : !data || data.members.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {debouncedSearch || statusFilter !== "all"
                ? "No members match your filters."
                : "No students have joined yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-center font-medium">
                      <GraduationCap className="inline h-4 w-4" /> Courses
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <BookOpen className="inline h-4 w-4" /> Books
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      <Award className="inline h-4 w-4" /> Certs
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                    <th className="px-4 py-3 text-left font-medium">Last Login</th>
                    <th className="px-4 py-3 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m: MemberListItem) => (
                    <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/users/${m.id}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.email || m.phone || "-"}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">{statusBadge(m.status)}</td>
                      <td className="px-4 py-3 text-center">{m.enrollment_count}</td>
                      <td className="px-4 py-3 text-center">{m.book_access_count}</td>
                      <td className="px-4 py-3 text-center">{m.certificate_count}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {m.total_spent.combined_inr > 0 ? (
                          <RevenueBreakdownDisplay
                            value={m.total_spent}
                            variant="cell"
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(m.joined_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(m.last_login_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {m.status === "ACTIVE" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleStatusChange(m.id, "SUSPENDED")}
                              disabled={updateStatus.isPending}
                            >
                              <UserMinus className="mr-1 h-3 w-3" />
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-600"
                              onClick={() => handleStatusChange(m.id, "ACTIVE")}
                              disabled={updateStatus.isPending}
                            >
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}–
            {Math.min(page * limit, data.total)} of {data.total} students
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
