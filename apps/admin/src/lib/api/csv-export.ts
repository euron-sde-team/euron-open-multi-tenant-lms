import { apiClient } from "./axios";

/**
 * Download an authenticated CSV from any GET endpoint. Uses the existing
 * Axios client so the tenant JWT + X-Tenant-Id header come along for free.
 * Triggers a programmatic download via a Blob URL.
 */
export async function downloadCsv(
  path: string,
  filename: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const res = await apiClient.get<Blob>(path, {
    params,
    responseType: "blob",
  });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
