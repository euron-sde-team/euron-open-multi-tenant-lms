import dashboardRepository from "../repositories/dashboard.repository";
import analyticsCacheService from "./analytics-cache.service";
import type {
  ContentOverview,
  MemberOverview,
  EnrollmentOverview,
  RevenueOverview,
  RecentEnrollment,
  RecentOrder,
  TopCourse,
} from "../repositories/dashboard.repository";

export interface DashboardData {
  content: ContentOverview;
  members: MemberOverview;
  enrollments: EnrollmentOverview;
  revenue: RevenueOverview;
  recent_enrollments: RecentEnrollment[];
  recent_orders: RecentOrder[];
  top_courses: TopCourse[];
}

const DASHBOARD_L1 = 30_000;
const DASHBOARD_L2 = 120;

class DashboardService {
  async getCourseStatsByMode(tenantId: string) {
    return dashboardRepository.getCourseStatsByMode(tenantId);
  }

  async getBookStatsWithAccess(tenantId: string) {
    return dashboardRepository.getBookStatsWithAccess(tenantId);
  }

  async getEnrollmentBreakdownByCourse(tenantId: string, limit = 20, search?: string) {
    return dashboardRepository.getEnrollmentBreakdownByCourse(tenantId, limit, search);
  }

  async getBookAccessBreakdown(tenantId: string, limit = 20, search?: string) {
    return dashboardRepository.getBookAccessBreakdown(tenantId, limit, search);
  }

  async getUserStats(tenantId: string, page = 1, limit = 20, search?: string) {
    return dashboardRepository.getUserStats(tenantId, page, limit, search);
  }

  async getDashboardData(tenantId: string, nocache = false): Promise<DashboardData> {
    const key = analyticsCacheService.dashboardKey(tenantId);
    if (!nocache) {
      const cached = await analyticsCacheService.get<DashboardData>(key);
      if (cached) return cached;
    }

    const [
      content,
      members,
      enrollments,
      revenue,
      recent_enrollments,
      recent_orders,
      top_courses,
    ] = await Promise.all([
      dashboardRepository.getContentOverview(tenantId),
      dashboardRepository.getMemberOverview(tenantId),
      dashboardRepository.getEnrollmentOverview(tenantId),
      dashboardRepository.getRevenueOverview(tenantId),
      dashboardRepository.getRecentEnrollments(tenantId, 5),
      dashboardRepository.getRecentOrders(tenantId, 5),
      dashboardRepository.getTopCourses(tenantId, 5),
    ]);

    const data = {
      content,
      members,
      enrollments,
      revenue,
      recent_enrollments,
      recent_orders,
      top_courses,
    };

    analyticsCacheService.set(key, data, DASHBOARD_L1, DASHBOARD_L2).catch(() => {});
    return data;
  }
}

export default new DashboardService();
