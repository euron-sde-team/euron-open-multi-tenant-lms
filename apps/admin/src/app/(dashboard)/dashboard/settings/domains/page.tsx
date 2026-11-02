"use client";

import { Button, useToast } from "@open-mtlms/core";
import { Plus, Rocket } from "lucide-react";
import { useState } from "react";

import { AddCustomDomainModal, DnsSetupGuide, DomainList } from "@/components/domains";
import { useDeploySubdomain, useDomains } from "@/lib/hooks";

export default function DomainsSettingsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { data: domains } = useDomains();
  const deploySubdomain = useDeploySubdomain();
  const { toast } = useToast();

  // Check if subdomain already exists
  const hasSubdomain = domains?.some((d) => d.domainType === "SUBDOMAIN");

  const handleDeploySubdomain = () => {
    deploySubdomain.mutate(undefined, {
      onSuccess: (data) => {
        if (data.alreadyExists) {
          toast({
            title: "Subdomain Already Deployed",
            description: `Your subdomain ${data.domainName} is already configured.`,
          });
        } else {
          toast({
            title: "Subdomain Deployment Started",
            description: `Deploying ${data.domainName}. SSL certificate provisioning is in progress.`,
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Deployment Failed",
          description: error.message || "Failed to deploy subdomain. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domains</h1>
          <p className="text-muted-foreground">
            Manage your site&apos;s domain settings and add custom domains.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={hasSubdomain ? "outline" : "default"}
            onClick={handleDeploySubdomain}
            disabled={deploySubdomain.isPending || hasSubdomain}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {hasSubdomain
              ? "Subdomain Deployed"
              : deploySubdomain.isPending
                ? "Deploying..."
                : "Deploy Subdomain"}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Domain
          </Button>
        </div>
      </div>

      <DomainList />

      <AddCustomDomainModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />

      <DnsSetupGuide />
    </div>
  );
}
