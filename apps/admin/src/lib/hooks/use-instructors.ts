import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { instructorsApi } from "../api/instructors";
import type {
  InstructorsListResponse,
  Instructor,
  InstructorExperience,
  InstructorSocials,
} from "../types/instructor";

import { entitlementKeys } from "./use-entitlements";

export const instructorKeys = {
  all: ["instructors"] as const,
  lists: () => [...instructorKeys.all, "list"] as const,
  list: (tenantId: string) => [...instructorKeys.lists(), tenantId] as const,
  details: () => [...instructorKeys.all, "detail"] as const,
  detail: (id: string) => [...instructorKeys.details(), id] as const,
  experiences: (instructorId: string) =>
    [...instructorKeys.all, "experiences", instructorId] as const,
  socials: (instructorId: string) =>
    [...instructorKeys.all, "socials", instructorId] as const,
};

/* ---- Instructors ---- */

export const useInstructors = (tenantId: string | undefined) => {
  return useQuery<InstructorsListResponse>({
    queryKey: instructorKeys.list(tenantId ?? ""),
    queryFn: () => instructorsApi.getInstructors({ limit: 100 }),
    enabled: !!tenantId,
  });
};

export const useInstructor = (
  tenantId: string | undefined,
  instructorId: string | undefined
) => {
  return useQuery<Instructor>({
    queryKey: instructorKeys.detail(instructorId ?? ""),
    queryFn: () => instructorsApi.getInstructor(instructorId!),
    enabled: !!tenantId && !!instructorId,
  });
};

export const useCreateInstructor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      email?: string | null;
      bio?: string | null;
      expertise?: string | null;
    }) => instructorsApi.createInstructor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instructorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

export const useUpdateInstructor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      data,
    }: {
      instructorId: string;
      data: { name?: string; email?: string | null; bio?: string | null; expertise?: string | null };
    }) => instructorsApi.updateInstructor(instructorId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: instructorKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: instructorKeys.detail(variables.instructorId),
      });
    },
  });
};

export const useDeleteInstructor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instructorId: string) =>
      instructorsApi.deleteInstructor(instructorId),
    onSuccess: (_, instructorId) => {
      queryClient.removeQueries({
        queryKey: instructorKeys.detail(instructorId),
      });
      queryClient.invalidateQueries({ queryKey: instructorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

/* ---- Photo Upload ---- */

export const useUploadProfilePhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      file,
    }: {
      instructorId: string;
      file: File;
    }) => instructorsApi.uploadProfilePhoto(instructorId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: instructorKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: instructorKeys.detail(variables.instructorId),
      });
    },
  });
};

export const useDeleteProfilePhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instructorId: string) =>
      instructorsApi.deleteProfilePhoto(instructorId),
    onSuccess: (_, instructorId) => {
      queryClient.invalidateQueries({ queryKey: instructorKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: instructorKeys.detail(instructorId),
      });
    },
  });
};

export const useUploadCompanyLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      experienceId,
      file,
    }: {
      instructorId: string;
      experienceId: string;
      file: File;
    }) => instructorsApi.uploadCompanyLogo(instructorId, experienceId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: instructorKeys.experiences(variables.instructorId),
      });
    },
  });
};

export const useDeleteCompanyLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      experienceId,
    }: {
      instructorId: string;
      experienceId: string;
    }) => instructorsApi.deleteCompanyLogo(instructorId, experienceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: instructorKeys.experiences(variables.instructorId),
      });
    },
  });
};

/* ---- Experiences ---- */

export const useExperiences = (instructorId: string | undefined) => {
  return useQuery<InstructorExperience[]>({
    queryKey: instructorKeys.experiences(instructorId ?? ""),
    queryFn: () => instructorsApi.getExperiences(instructorId!),
    enabled: !!instructorId,
  });
};

export const useCreateExperience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      data,
    }: {
      instructorId: string;
      data: {
        company: string;
        company_logo?: string | null;
        years: number;
        details?: string | null;
        sort_order?: number;
      };
    }) => instructorsApi.createExperience(instructorId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: instructorKeys.experiences(variables.instructorId),
      });
    },
  });
};

export const useUpdateExperience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      experienceId,
      data,
    }: {
      instructorId: string;
      experienceId: string;
      data: {
        company?: string;
        company_logo?: string | null;
        years?: number;
        details?: string | null;
        sort_order?: number;
      };
    }) => instructorsApi.updateExperience(instructorId, experienceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: instructorKeys.experiences(variables.instructorId),
      });
    },
  });
};

export const useDeleteExperience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      experienceId,
    }: {
      instructorId: string;
      experienceId: string;
    }) => instructorsApi.deleteExperience(instructorId, experienceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: instructorKeys.experiences(variables.instructorId),
      });
    },
  });
};

/* ---- Socials ---- */

export const useSocials = (instructorId: string | undefined) => {
  return useQuery<InstructorSocials | null>({
    queryKey: instructorKeys.socials(instructorId ?? ""),
    queryFn: () => instructorsApi.getSocials(instructorId!),
    enabled: !!instructorId,
  });
};

export const useUpsertSocials = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      data,
    }: {
      instructorId: string;
      data: {
        linkedin_url?: string | null;
        twitter_url?: string | null;
        youtube_url?: string | null;
        github_url?: string | null;
        website_url?: string | null;
        facebook_url?: string | null;
        instagram_url?: string | null;
      };
    }) => instructorsApi.upsertSocials(instructorId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: instructorKeys.socials(variables.instructorId),
      });
    },
  });
};
