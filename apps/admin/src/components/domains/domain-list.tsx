"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  MoreVertical,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { domainsApi } from "@/lib/api";
import {
  domainsKeys,
  useDomains,
  useDomainStatus,
  useRemoveDomain,
  useSetPrimaryDomain,
} from "@/lib/hooks";
import type { Domain } from "@/lib/types";

import { DnsInstructions } from "./dns-instructions";
import { DomainStatusBadge } from "./domain-status-badge";

export function DomainList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: domains, isLoading, error, refetch } = useDomains();
  const removeMutation = useRemoveDomain();
  const setPrimaryMutation = useSetPrimaryDomain();

  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading domains...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-destructive">Failed to load domains</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Globe className="mx-auto h-12 w-12 mb-4" />
            <p>No domains configured yet.</p>
            <p className="text-sm mt-1">
              Deploy your subdomain or add a custom domain to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDelete = async () => {
    if (!domainToDelete) return;

    try {
      await removeMutation.mutateAsync(domainToDelete.id);
      toast({
        title: "Domain Removed",
        description: `${domainToDelete.domainName} has been removed.`,
      });
      setDomainToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove domain",
        variant: "destructive",
      });
    }
  };

  const handleSetPrimary = async (domain: Domain) => {
    try {
      await setPrimaryMutation.mutateAsync(domain.id);
      toast({
        title: "Primary Domain Updated",
        description: `${domain.domainName} is now your primary domain.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to set primary domain",
        variant: "destructive",
      });
    }
  };

  const handleVerify = async (domainId: string) => {
    try {
      await domainsApi.verify(domainId);
      queryClient.invalidateQueries({ queryKey: domainsKeys.status(domainId) });
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
      toast({
        title: "Verification Checked",
        description: "Domain verification status has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to check verification",
        variant: "destructive",
      });
    }
  };

  const handleRetry = async (domainId: string) => {
    try {
      await domainsApi.retry(domainId);
      queryClient.invalidateQueries({ queryKey: domainsKeys.status(domainId) });
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
      toast({
        title: "Retry Initiated",
        description: "Domain verification retry has been triggered.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to retry verification",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        {domains.map((domain) => (
          <DomainCard
            key={domain.id}
            domain={domain}
            isExpanded={expandedDomain === domain.id}
            onToggleExpand={() =>
              setExpandedDomain(expandedDomain === domain.id ? null : domain.id)
            }
            onDelete={() => setDomainToDelete(domain)}
            onSetPrimary={() => handleSetPrimary(domain)}
            onVerify={() => handleVerify(domain.id)}
            onRetry={() => handleRetry(domain.id)}
          />
        ))}
      </div>

      <AlertDialog
        open={!!domainToDelete}
        onOpenChange={(open) => !open && setDomainToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">{domainToDelete?.domainName}</span>?
              {domainToDelete?.domainType === "SUBDOMAIN" && (
                <span className="block mt-2 text-amber-600">
                  Note: Removing your subdomain will make your site inaccessible at this
                  address. You can re-deploy it later from the Domains settings.
                </span>
              )}
              {domains && domains.length === 1 && (
                <span className="block mt-2 text-amber-600">
                  This is your only domain. Your site will not be accessible until you
                  deploy a new subdomain or add a custom domain.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface DomainCardProps {
  domain: Domain;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  onVerify: () => void;
  onRetry: () => void;
}

function DomainCard({
  domain,
  isExpanded,
  onToggleExpand,
  onDelete,
  onSetPrimary,
  onVerify,
  onRetry,
}: DomainCardProps) {
  const queryClient = useQueryClient();

  const shouldPoll =
    domain.status !== "ACTIVE" &&
    domain.status !== "FAILED" &&
    domain.status !== "REDIRECT";
  const shouldFetchOnExpand = isExpanded && !shouldPoll;

  const { data: statusData } = useDomainStatus(domain.id, {
    enabled: shouldPoll || shouldFetchOnExpand,
    refetchInterval: shouldPoll
      ? isExpanded
        ? 5000
        : 15000
      : false,
  });

  const currentStatus = statusData?.status || domain.status;
  const dnsRecords = statusData?.dnsRecords || [];
  const isRedirect = currentStatus === "REDIRECT";

  useEffect(() => {
    if (statusData?.status === "ACTIVE" || statusData?.status === "FAILED" || statusData?.status === "REDIRECT") {
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    }
  }, [statusData?.status, queryClient]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {domain.domainName}
              {domain.isPrimary && (
                <Badge variant="outline" className="ml-2">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Primary
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span className="capitalize">{domain.domainType.toLowerCase()}</span>
              {currentStatus === "ACTIVE" && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <a
                    href={domain.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    Visit site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <DomainStatusBadge status={currentStatus} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {domain.domainType === "CUSTOM" && (
                  <DropdownMenuItem onClick={onToggleExpand}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isExpanded ? "Hide DNS Records" : "Show DNS Records"}
                  </DropdownMenuItem>
                )}
                {domain.domainType === "CUSTOM" && (currentStatus === "PENDING_VERIFICATION" || currentStatus === "PENDING_SSL") && (
                  <DropdownMenuItem onClick={onVerify}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check verification
                  </DropdownMenuItem>
                )}
                {currentStatus === "FAILED" && (
                  <DropdownMenuItem onClick={onRetry}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry verification
                  </DropdownMenuItem>
                )}
                {!domain.isPrimary && (currentStatus === "ACTIVE" || isRedirect) && (
                  <DropdownMenuItem onClick={onSetPrimary}>
                    <Star className="h-4 w-4 mr-2" />
                    Set as Primary
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Domain
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {isRedirect && (
        <CardContent className="pt-0">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">DNS provider limitation</p>
                <p className="mt-1">
                  Your DNS provider does not support CNAME records on the root domain.
                  To fix this, set up <strong>forwarding</strong> from{" "}
                  <strong>{domain.domainName}</strong> to{" "}
                  <strong>www.{domain.domainName}</strong> at your registrar.
                  See the DNS Setup Guide tab below for step-by-step instructions.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}

      {isExpanded && dnsRecords.length > 0 && (
        <CardContent className="pt-0">
          <DnsInstructions records={dnsRecords} domainName={domain.domainName} />
        </CardContent>
      )}

      {domain.errorMessage && !isRedirect && (
        <CardContent className="pt-0">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {domain.errorMessage}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
