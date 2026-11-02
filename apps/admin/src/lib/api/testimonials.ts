import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface Testimonial {
  id: string;
  tenantId: string;
  tenantMemberId: string | null;
  name: string;
  text: string | null;
  imageUrl: string | null;
  socialLinks: Record<string, unknown> | null;
  rating: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  memberName: string | null;
  memberEmail: string | null;
  memberAvatar: string | null;
}

export interface TestimonialsListResponse {
  testimonials: Testimonial[];
  total: number;
  page: number;
  limit: number;
}

export interface TestimonialStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const BASE = "/tenant/testimonials";

export const testimonialsApi = {
  list: async (
    params?: { page?: number; limit?: number; search?: string; status?: string }
  ): Promise<TestimonialsListResponse> => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.search) search.set("search", params.search);
    if (params?.status) search.set("status", params.status);
    const q = search.toString();
    const response = await apiClient.get<ApiResponse<TestimonialsListResponse>>(
      q ? `${BASE}?${q}` : BASE
    );
    return response.data.data;
  },

  getStats: async (): Promise<TestimonialStats> => {
    const response = await apiClient.get<ApiResponse<TestimonialStats>>(
      `${BASE}/stats`
    );
    return response.data.data;
  },

  get: async (id: string): Promise<Testimonial> => {
    const response = await apiClient.get<ApiResponse<Testimonial>>(
      `${BASE}/${id}`
    );
    return response.data.data;
  },

  create: async (data: {
    name: string;
    text?: string;
    image_url?: string;
    social_links?: Record<string, unknown>;
    rating?: number;
    member_email?: string;
    status?: string;
  }): Promise<Testimonial> => {
    const response = await apiClient.post<ApiResponse<Testimonial>>(BASE, data);
    return response.data.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      text?: string;
      image_url?: string;
      social_links?: Record<string, unknown>;
      rating?: number;
      member_email?: string;
      status?: string;
    }
  ): Promise<Testimonial> => {
    const response = await apiClient.put<ApiResponse<Testimonial>>(
      `${BASE}/${id}`,
      data
    );
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`);
  },

  updateStatus: async (id: string, status: string): Promise<Testimonial> => {
    const response = await apiClient.patch<ApiResponse<Testimonial>>(
      `${BASE}/${id}/status`,
      { status }
    );
    return response.data.data;
  },
};
