import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";

export interface EnrolledCoursesSettings {
  /**
   * When true, learners on this tenant only ever see the courses they are
   * enrolled in, the public catalog / explore surfaces are hidden across web
   * and mobile, and the learner-api forces enrolled-only listing for everyone
   * (including subscribers). Default: false.
   */
  enrolled_courses_only_enabled: boolean;
  enrolled_courses_only_enabled_at: Date | null;
}

class EnrolledCoursesSettingsService {
  async getSettings(tenantId: string): Promise<EnrolledCoursesSettings> {
    const row = await db
      .selectFrom("tenants")
      .select(["enrolled_courses_only_enabled", "enrolled_courses_only_enabled_at"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Tenant not found");
    return {
      // Default OFF: treat a null column (older rows) as disabled.
      enrolled_courses_only_enabled: row.enrolled_courses_only_enabled ?? false,
      enrolled_courses_only_enabled_at: row.enrolled_courses_only_enabled_at,
    };
  }

  async updateSettings(
    tenantId: string,
    enabled: boolean,
    updatedByUserId: string,
  ): Promise<EnrolledCoursesSettings> {
    const current = await this.getSettings(tenantId);
    if (enabled === current.enrolled_courses_only_enabled) return current;

    await db
      .updateTable("tenants")
      .set({
        enrolled_courses_only_enabled: enabled,
        enrolled_courses_only_enabled_at: enabled ? new Date() : null,
        enrolled_courses_only_enabled_by_user_id: enabled ? updatedByUserId : null,
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();

    return this.getSettings(tenantId);
  }
}

export default new EnrolledCoursesSettingsService();
