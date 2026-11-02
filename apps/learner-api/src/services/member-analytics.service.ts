import memberAnalyticsRepo from "../repositories/member-analytics.repository";

class MemberAnalyticsService {
  async getAnalytics(tenantId: string, memberId: string) {
    return memberAnalyticsRepo.getAggregatedAnalytics(tenantId, memberId);
  }
}

export default new MemberAnalyticsService();
