"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { MemberDetailTabs } from "../../../../../components/member-detail/MemberDetailTabs";
import { MemberProfileCard } from "../../../../../components/member-detail/MemberProfileCard";
import { useMember } from "../../../../../lib/hooks/use-members";

export default function MemberDetailPage() {
  const params = useParams() ?? {};
  const memberId = params.id as string;

  const { data: member, isLoading } = useMember(memberId);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-40 bg-muted rounded" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Member not found</CardTitle>
            <CardDescription>
              This student may have been removed or doesn&apos;t exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/users">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
      </div>

      <MemberProfileCard member={member} memberId={memberId} />
      <MemberDetailTabs memberId={memberId} />
    </div>
  );
}
