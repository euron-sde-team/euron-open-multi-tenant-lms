"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { Building2 } from "lucide-react";
import { useState } from "react";

import { useCreateOrganization } from "../../lib/hooks/use-organization";
import { ProfileEnrichmentModal } from "../auth/ProfileEnrichmentModal";

export function SetupOrganizationCard() {
  const [name, setName] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { toast } = useToast();
  const createOrgMutation = useCreateOrganization();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    createOrgMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: (data) => {
          toast({
            title: "Organization created",
            description: `${data.name} is ready to go.`,
          });
          // Show profile enrichment modal after org creation
          setShowProfileModal(true);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to create organization",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <>
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Set up your organization</CardTitle>
        <CardDescription>
          Create your organization to start managing courses, users, and content.
          You can customize everything later.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              type="text"
              placeholder="e.g. Acme Academy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={createOrgMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              This will be used to generate your unique subdomain
            </p>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={createOrgMutation.isPending || !name.trim()}
          >
            {createOrgMutation.isPending
              ? "Creating..."
              : "Create Organization"}
          </Button>
        </CardContent>
      </form>
    </Card>

    {/* Profile enrichment after org creation (skippable) */}
    <ProfileEnrichmentModal
      open={showProfileModal}
      onClose={() => setShowProfileModal(false)}
    />
    </>
  );
}
