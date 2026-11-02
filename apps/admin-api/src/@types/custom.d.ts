declare namespace Express {
  export interface Request {
    user: {
      id: string;
    };
    tenantUser: {
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      status: string;
      email_verified: boolean;
      roles: string[];
      permissions: string[];
      isOwner: boolean;
    };
    /**
     * Current tenant ID from the X-Tenant-Id header or default owned tenant
     */
    tenantId?: string;
    /**
     * Current tenant status (set by tenant-status middleware)
     */
    tenantStatus?: string;
    /** Set by requireActiveTenant when it ran before the tenant was resolved. */
    requireActiveTenant?: boolean;
    /**
     * True when the X-Tenant-Id header pointed to a tenant the user
     * no longer has access to. In lenient mode the middleware falls back to
     * the first active membership instead of throwing 403.
     */
    tenantAccessDenied?: boolean;

  }
}
