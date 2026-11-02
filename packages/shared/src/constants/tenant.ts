import { assetUrl, getTenantAssetsBaseUrl } from "../utils/asset-url";

/** Public base URL for tenant organisation assets, from NEXT_PUBLIC_TENANT_ASSETS_BASE_URL. */
export const TENANT_DETAILS_S3_BASE_URL = getTenantAssetsBaseUrl();

export function getTenantOrgImageUrl(
  key: string | null | undefined
): string | null {
  return assetUrl(key, getTenantAssetsBaseUrl());
}
