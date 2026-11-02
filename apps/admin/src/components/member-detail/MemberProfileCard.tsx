"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  useToast,
} from "@open-mtlms/core";
import {
  Calendar,
  Mail,
  MailCheck,
  Pencil,
  Phone,
  ShieldCheck,
  UserCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { useUpdateMemberStatus } from "../../lib/hooks/use-members";
import { useHasPermission } from "../../lib/hooks/use-permissions";
import type { MemberDetail, MemberStatus } from "../../lib/types/members";

import { EditMemberProfileDialog } from "./EditMemberProfileDialog";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: MemberStatus) {
  const map: Record<MemberStatus, "default" | "secondary" | "destructive"> = {
    ACTIVE: "default",
    SUSPENDED: "destructive",
    DEACTIVATED: "secondary",
  };
  return map[status] ?? "secondary";
}

interface MemberProfileCardProps {
  member: MemberDetail;
  memberId: string;
}

export function MemberProfileCard({
  member,
  memberId,
}: MemberProfileCardProps) {
  const { toast } = useToast();
  const updateStatus = useUpdateMemberStatus();
  const canEdit = useHasPermission("members.update");
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleStatusToggle = () => {
    const newStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    updateStatus.mutate(
      { memberId, status: newStatus },
      {
        onSuccess: () =>
          toast({
            title: "Status updated",
            description: `Member is now ${newStatus.toLowerCase()}.`,
          }),
        onError: (err) =>
          toast({
            title: "Error",
            description:
              err instanceof Error ? err.message : "Failed",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <UserCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {member.email && (
                  <span className="flex items-center gap-1">
                    {member.email_verified ? (
                      <MailCheck className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    {member.email}
                  </span>
                )}
                {member.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {member.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {formatDate(member.joined_at)}
                </span>
              </div>
              {member.oauth_provider && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Signed up via {member.oauth_provider}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColor(member.status)}>
              {member.status}
            </Badge>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(true)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit Profile
              </Button>
            )}
            <Button
              variant={
                member.status === "ACTIVE" ? "destructive" : "default"
              }
              size="sm"
              onClick={handleStatusToggle}
              disabled={updateStatus.isPending}
            >
              {member.status === "ACTIVE" ? (
                <>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Suspend
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Activate
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      {canEdit && (
        <EditMemberProfileDialog
          member={member}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      )}
    </Card>
  );
}
