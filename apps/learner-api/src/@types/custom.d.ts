import { TenantInfo } from "../middlewares/tenant-resolver.middleware";

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        tenantId: string;
        email: string;
        sessionToken?: string;
      };
      /**
       * Tenant context resolved from the request hostname.
       * Populated by the tenant resolution middleware.
       * Optional because not all routes require tenant context.
       */
      tenant?: TenantInfo;
    }
  }
}

export { };

