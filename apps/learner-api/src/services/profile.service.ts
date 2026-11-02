import authRepository from "../repositories/auth.repository";
import { NotFoundError } from "../errors/not-found.error";

export interface PublicProfileResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
  about: string | null;
}

class ProfileService {
  async getPublicProfile(tenantId: string, userId: string): Promise<PublicProfileResponse> {
    const member = await authRepository.findById(userId);
    if (!member || member.tenant_id !== tenantId) {
      throw new NotFoundError("Profile not found");
    }
    if (member.status !== "ACTIVE") {
      throw new NotFoundError("Profile not found");
    }
    return {
      id: member.id,
      name: member.name,
      avatarUrl: member.avatar_url,
      about: (member as { about?: string | null }).about ?? null,
    };
  }
}

export default new ProfileService();
