import type {
  ApiResponse,
  CustomDomainResponse,
  Domain,
  DomainStatusResponse,
  SetPrimaryResponse,
  SubdomainDeployResponse,
} from "../types";

import { apiClient } from "./axios";

export const domainsApi = {
  list: async (): Promise<Domain[]> => {
    const response = await apiClient.get<ApiResponse<Domain[]>>("/tenant/domains");
    return response.data.data;
  },

  get: async (id: string): Promise<Domain> => {
    const response = await apiClient.get<ApiResponse<Domain>>(`/tenant/domains/${id}`);
    return response.data.data;
  },

  getStatus: async (id: string): Promise<DomainStatusResponse> => {
    const response = await apiClient.get<ApiResponse<DomainStatusResponse>>(
      `/tenant/domains/${id}/status`
    );
    return response.data.data;
  },

  deploySubdomain: async (): Promise<SubdomainDeployResponse> => {
    const response = await apiClient.post<ApiResponse<SubdomainDeployResponse>>(
      "/tenant/domains/subdomain"
    );
    return response.data.data;
  },

  addCustomDomain: async (domain: string): Promise<CustomDomainResponse> => {
    const response = await apiClient.post<ApiResponse<CustomDomainResponse>>(
      "/tenant/domains/custom",
      { domain }
    );
    return response.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenant/domains/${id}`);
  },

  setPrimary: async (id: string): Promise<SetPrimaryResponse> => {
    const response = await apiClient.post<ApiResponse<SetPrimaryResponse>>(
      `/tenant/domains/${id}/set-primary`
    );
    return response.data.data;
  },

  verify: async (id: string): Promise<DomainStatusResponse> => {
    const response = await apiClient.post<ApiResponse<DomainStatusResponse>>(
      `/tenant/domains/${id}/verify`
    );
    return response.data.data;
  },

  retry: async (id: string): Promise<DomainStatusResponse> => {
    const response = await apiClient.post<ApiResponse<DomainStatusResponse>>(
      `/tenant/domains/${id}/retry`
    );
    return response.data.data;
  },
};
