import type { AvailableRoutesResponse } from "@open-mtlms/shared";

import { apiClient } from "./axios";

export const routesApi = {
  getAvailableRoutes: (): Promise<AvailableRoutesResponse> =>
    apiClient
      .get<{ data?: AvailableRoutesResponse }>("/routes/available")
      .then((r) => r.data?.data ?? (r.data as AvailableRoutesResponse)),
};
