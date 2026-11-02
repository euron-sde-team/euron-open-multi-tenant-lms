import { apiGet, apiPost } from "./api-client";

// Types
export interface TestimonialItem {
  id: string;
  name: string;
  text: string | null;
  imageUrl: string | null;
  socialLinks: any;
  rating: number | null;
  createdAt: string;
  memberName: string | null;
  memberAvatar: string | null;
}

export interface TestimonialsListResponse {
  testimonials: TestimonialItem[];
  total: number;
  page: number;
  limit: number;
}

export const testimonialsApi = {
  list: (params?: { page?: number; limit?: number }): Promise<TestimonialsListResponse> =>
    apiGet("/testimonials", { params }),

  submit: (data: {
    name?: string;
    text?: string;
    image_url?: string;
    social_links?: any;
    rating?: number;
  }): Promise<any> => apiPost("/testimonials", data),
};
