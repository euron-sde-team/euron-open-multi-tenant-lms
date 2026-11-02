import { useMutation } from "@tanstack/react-query";

import { pageAIApi } from "../api/page-ai";
import type {
  GenerateSectionRequest,
} from "../api/page-ai";

export function useGenerateSection() {
  return useMutation({
    mutationFn: (params: GenerateSectionRequest) =>
      pageAIApi.generateSection(params),
  });
}

// Image generation now uses background queue + polling.
// See use-page-image-generation.ts for the new hook.
