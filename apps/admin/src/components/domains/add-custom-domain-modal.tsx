"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { useState } from "react";

import { useAddCustomDomain } from "@/lib/hooks";
import type { CustomDomainResponse } from "@/lib/types";

import { DnsInstructions } from "./dns-instructions";

interface AddCustomDomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCustomDomainModal({ open, onOpenChange }: AddCustomDomainModalProps) {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<CustomDomainResponse | null>(null);
  const { toast } = useToast();

  const addDomainMutation = useAddCustomDomain();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!domain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    // Basic domain validation
    const domainRegex = /^(?!-)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    const trimmed = domain.trim();
    if (!domainRegex.test(trimmed)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid domain name (e.g., example.com)",
        variant: "destructive",
      });
      return;
    }

    const normalizedDomain = trimmed.toLowerCase().startsWith("www.")
      ? trimmed.toLowerCase().slice(4)
      : trimmed.toLowerCase();

    try {
      const response = await addDomainMutation.mutateAsync(normalizedDomain);
      setResult(response);
      toast({
        title: "Domain Added",
        description: "Please configure the DNS records shown below.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add custom domain",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setDomain("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {result ? "Configure Your Domain" : "Add Custom Domain"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Add these DNS records to complete the setup."
              : "Connect your own domain to your site. You'll need access to your domain's DNS settings."}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain Name</Label>
                <Input
                  id="domain"
                  placeholder="example.com or learn.example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={addDomainMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your domain without http://. Use your root domain (example.com),
                  www (www.example.com), or a subdomain (learn.example.com).
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={addDomainMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addDomainMutation.isPending}>
                {addDomainMutation.isPending ? "Adding..." : "Add Domain"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-4">
            <DnsInstructions records={result.dnsRecords} domainName={result.domainName} />

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
