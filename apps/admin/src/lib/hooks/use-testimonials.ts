import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  testimonialsApi,
  type TestimonialsListResponse,
  type TestimonialStats,
} from "../api/testimonials";

export const testimonialKeys = {
  all: ["testimonials"] as const,
  lists: () => [...testimonialKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...testimonialKeys.lists(), params] as const,
  stats: () => [...testimonialKeys.all, "stats"] as const,
  details: () => [...testimonialKeys.all, "detail"] as const,
  detail: (id: string) => [...testimonialKeys.details(), id] as const,
};

export const useTestimonials = (
  params?: { page?: number; limit?: number; search?: string; status?: string }
) => {
  return useQuery<TestimonialsListResponse>({
    queryKey: testimonialKeys.list(params ?? {}),
    queryFn: () => testimonialsApi.list(params),
    placeholderData: (prev) => prev,
  });
};

export const useTestimonialStats = () => {
  return useQuery<TestimonialStats>({
    queryKey: testimonialKeys.stats(),
    queryFn: () => testimonialsApi.getStats(),
  });
};

export const useCreateTestimonial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof testimonialsApi.create>[0]) =>
      testimonialsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testimonialKeys.lists() });
      queryClient.invalidateQueries({ queryKey: testimonialKeys.stats() });
    },
  });
};

export const useUpdateTestimonial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof testimonialsApi.update>[1];
    }) => testimonialsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testimonialKeys.lists() });
      queryClient.invalidateQueries({ queryKey: testimonialKeys.stats() });
    },
  });
};

export const useDeleteTestimonial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testimonialsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testimonialKeys.lists() });
      queryClient.invalidateQueries({ queryKey: testimonialKeys.stats() });
    },
  });
};

export const useUpdateTestimonialStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      testimonialsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testimonialKeys.lists() });
      queryClient.invalidateQueries({ queryKey: testimonialKeys.stats() });
    },
  });
};
