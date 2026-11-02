import type { ApiResponse } from "../types/auth";
import type {
  Instructor,
  InstructorsListResponse,
  InstructorExperience,
  InstructorSocials,
} from "../types/instructor";

import { apiClient } from "./axios";

const BASE = "/tenant/instructors";

export const instructorsApi = {
  /* ---- Instructors ---- */

  getInstructors: async (
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<InstructorsListResponse> => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.search) search.set("search", params.search);
    const q = search.toString();
    const response = await apiClient.get<ApiResponse<InstructorsListResponse>>(
      q ? `${BASE}?${q}` : BASE
    );
    return response.data.data;
  },

  getInstructor: async (instructorId: string): Promise<Instructor> => {
    const response = await apiClient.get<ApiResponse<Instructor>>(
      `${BASE}/${instructorId}`
    );
    return response.data.data;
  },

  createInstructor: async (data: {
    name: string;
    email?: string | null;
    bio?: string | null;
    expertise?: string | null;
  }): Promise<Instructor> => {
    const response = await apiClient.post<ApiResponse<Instructor>>(BASE, data);
    return response.data.data;
  },

  updateInstructor: async (
    instructorId: string,
    data: {
      name?: string;
      email?: string | null;
      bio?: string | null;
      expertise?: string | null;
    }
  ): Promise<Instructor> => {
    const response = await apiClient.put<ApiResponse<Instructor>>(
      `${BASE}/${instructorId}`,
      data
    );
    return response.data.data;
  },

  deleteInstructor: async (instructorId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${instructorId}`);
  },

  /* ---- Photo Upload ---- */

  uploadProfilePhoto: async (
    instructorId: string,
    file: File
  ): Promise<{ key: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<
      ApiResponse<{ key: string; url: string }>
    >(`${BASE}/${instructorId}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
  },

  deleteProfilePhoto: async (instructorId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${instructorId}/photo`);
  },

  uploadCompanyLogo: async (
    instructorId: string,
    experienceId: string,
    file: File
  ): Promise<{ key: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<
      ApiResponse<{ key: string; url: string }>
    >(
      `${BASE}/${instructorId}/experiences/${experienceId}/logo`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data.data;
  },

  deleteCompanyLogo: async (
    instructorId: string,
    experienceId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${BASE}/${instructorId}/experiences/${experienceId}/logo`
    );
  },

  /* ---- Experiences ---- */

  getExperiences: async (
    instructorId: string
  ): Promise<InstructorExperience[]> => {
    const response = await apiClient.get<ApiResponse<InstructorExperience[]>>(
      `${BASE}/${instructorId}/experiences`
    );
    return response.data.data;
  },

  createExperience: async (
    instructorId: string,
    data: {
      company: string;
      company_logo?: string | null;
      years: number;
      details?: string | null;
      sort_order?: number;
    }
  ): Promise<InstructorExperience> => {
    const response = await apiClient.post<ApiResponse<InstructorExperience>>(
      `${BASE}/${instructorId}/experiences`,
      data
    );
    return response.data.data;
  },

  updateExperience: async (
    instructorId: string,
    experienceId: string,
    data: {
      company?: string;
      company_logo?: string | null;
      years?: number;
      details?: string | null;
      sort_order?: number;
    }
  ): Promise<InstructorExperience> => {
    const response = await apiClient.put<ApiResponse<InstructorExperience>>(
      `${BASE}/${instructorId}/experiences/${experienceId}`,
      data
    );
    return response.data.data;
  },

  deleteExperience: async (
    instructorId: string,
    experienceId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${BASE}/${instructorId}/experiences/${experienceId}`
    );
  },

  /* ---- Socials ---- */

  getSocials: async (
    instructorId: string
  ): Promise<InstructorSocials | null> => {
    const response = await apiClient.get<ApiResponse<InstructorSocials | null>>(
      `${BASE}/${instructorId}/socials`
    );
    return response.data.data;
  },

  upsertSocials: async (
    instructorId: string,
    data: {
      linkedin_url?: string | null;
      twitter_url?: string | null;
      youtube_url?: string | null;
      github_url?: string | null;
      website_url?: string | null;
      facebook_url?: string | null;
      instagram_url?: string | null;
    }
  ): Promise<InstructorSocials> => {
    const response = await apiClient.put<ApiResponse<InstructorSocials>>(
      `${BASE}/${instructorId}/socials`,
      data
    );
    return response.data.data;
  },
};
