export type DomainType = "SUBDOMAIN" | "CUSTOM";

export type DomainStatus =
  | "PENDING_VERIFICATION"
  | "PENDING_SSL"
  | "ACTIVE"
  | "FAILED"
  | "REMOVING"
  | "REDIRECT";

export interface DnsRecord {
  type: string;
  host: string;
  value: string;
  purpose: string;
  required: boolean;
  isRootApex?: boolean;
}

export interface Domain {
  id: string;
  domainType: DomainType;
  domainName: string;
  subdomainPrefix: string | null;
  fullUrl: string;
  status: DomainStatus;
  sslStatus: string | null;
  ownershipVerified: boolean;
  sslActive: boolean;
  isPrimary: boolean;
  errorMessage: string | null;
  createdAt: string;
  verifiedAt: string | null;
  linkedWwwDomainId?: string;
  linkedApexDomainId?: string;
  forwardingRequired?: boolean;
}

export interface DomainStatusResponse {
  id: string;
  domainName: string;
  domainType: string;
  status: DomainStatus;
  sslStatus: string | null;
  ownershipVerified: boolean;
  sslActive: boolean;
  isPrimary: boolean;
  dnsRecords: DnsRecord[];
  verificationErrors: string[];
  verifiedAt: string | null;
  errorMessage: string | null;
}

export interface CustomDomainResponse {
  id: string;
  domainName: string;
  status: DomainStatus;
  sslStatus: string | null;
  dnsRecords: DnsRecord[];
}

export interface AddCustomDomainRequest {
  domain: string;
}

export interface SetPrimaryResponse {
  id: string;
  domainName: string;
  isPrimary: boolean;
}

export interface SubdomainDeployResponse {
  id: string;
  domainName: string;
  subdomainPrefix: string;
  fullUrl: string;
  status: DomainStatus;
  isPrimary: boolean;
  alreadyExists: boolean;
  createdAt: string;
}
