import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

/** Offering types that can carry a per-type certificate design. */
export type CertOfferingType = "COURSE" | "TEST_SERIES";

/** The effective design for one offering type, either the per-type assignment
 *  or (when unset) the tenant's global default. `source` tells the UI which. */
export interface CertificateAssignment {
  offeringType: CertOfferingType;
  source: "assigned" | "default";
  presetTemplate: string | null;
  certificateTemplateId: string | null;
  certificateTemplateName: string | null;
  certificateLogo: string | null;
}

export interface SetCertificateAssignmentInput {
  /** Provide exactly one of presetTemplate / certificateTemplateId. */
  presetTemplate?: string | null;
  certificateTemplateId?: string | null;
  certificateLogo?: string | null;
}

const BASE = "/tenant/certificate-assignments";

export const certificateAssignmentsApi = {
  list: async (): Promise<CertificateAssignment[]> => {
    const res = await apiClient.get<ApiResponse<{ assignments: CertificateAssignment[] }>>(BASE);
    return res.data.data.assignments;
  },

  set: async (
    offeringType: CertOfferingType,
    input: SetCertificateAssignmentInput,
  ): Promise<CertificateAssignment[]> => {
    const res = await apiClient.put<ApiResponse<{ assignments: CertificateAssignment[] }>>(
      `${BASE}/${offeringType}`,
      input,
    );
    return res.data.data.assignments;
  },

  clear: async (offeringType: CertOfferingType): Promise<CertificateAssignment[]> => {
    const res = await apiClient.delete<ApiResponse<{ assignments: CertificateAssignment[] }>>(
      `${BASE}/${offeringType}`,
    );
    return res.data.data.assignments;
  },
};
