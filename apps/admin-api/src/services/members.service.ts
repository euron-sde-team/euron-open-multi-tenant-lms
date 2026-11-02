import { ulid } from "ulid";

import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import membersRepository from "../repositories/members.repository";
import logger from "../utils/logger";
import grantNotificationService from "./grant-notification.service";
import {
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
} from "./bulk-imports.matcher";
import type {
  MembersListParams,
  MembersListResult,
  MemberDetail,
  MemberEnrollment,
  MemberBookAccess,
  MemberOrder,
  MemberCertificate,
  MemberStats,
  MemberDetailStats,
  MemberCartItem,
  MemberCouponRedemption,
  MemberRefund,
} from "../repositories/members.repository";
import type { member_status } from "../db/enums";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s()-]{4,}$/;

/**
 * Default validity for an admin-granted enrollment / book access when the
 * caller didn't pass an explicit expiry. One year from grant time, so
 * comped access doesn't quietly become a perpetual freebie.
 */
export function defaultAdminGrantValidTill(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

class MembersService {
  async listMembers(params: MembersListParams): Promise<MembersListResult> {
    return membersRepository.list(params);
  }

  async getMember(
    tenantId: string,
    memberId: string
  ): Promise<MemberDetail> {
    const member = await membersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }
    return member;
  }

  async updateMemberStatus(
    tenantId: string,
    memberId: string,
    status: string
  ): Promise<void> {
    const validStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const member = await membersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }

    await membersRepository.updateStatus(
      tenantId,
      memberId,
      status as member_status
    );

    // Suspending or deactivating must also close any session the learner
    // currently has open. Deliberately after the status write and never allowed
    // to fail the request: the status change has already committed, and the
    // learner-api denies non-ACTIVE members on every request regardless, so a
    // failure here degrades to "the stale session row lingers", not "the
    // suspension didn't apply".
    if (status !== "ACTIVE") {
      try {
        const closed = await membersRepository.deactivateSessionsForMember(
          tenantId,
          memberId
        );
        logger.info(
          `[members] Closed ${closed} session(s) for member ${memberId} on ${status}`
        );
      } catch (err) {
        logger.error(
          `[members] Failed to close sessions for member ${memberId}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  async updateMemberProfile(
    tenantId: string,
    memberId: string,
    input: {
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      keepEmailVerified?: unknown;
      keepPhoneVerified?: unknown;
    }
  ): Promise<MemberDetail> {
    const member = await membersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }

    const patch: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      email_verified?: boolean;
      phone_verified?: boolean;
    } = {};

    if (input.name !== undefined) {
      if (typeof input.name !== "string") {
        throw new BadRequestError("name must be a string");
      }
      const trimmed = input.name.trim();
      if (trimmed.length === 0) {
        throw new BadRequestError("name cannot be empty");
      }
      if (trimmed.length > 200) {
        throw new BadRequestError("name is too long");
      }
      if (trimmed !== member.name) {
        patch.name = trimmed;
      }
    }

    let newEmail: string | null | undefined;
    if (input.email !== undefined) {
      if (input.email === null) {
        newEmail = null;
      } else if (typeof input.email !== "string") {
        throw new BadRequestError("email must be a string or null");
      } else {
        const trimmed = input.email.trim().toLowerCase();
        if (trimmed.length === 0) {
          newEmail = null;
        } else {
          if (!EMAIL_REGEX.test(trimmed) || trimmed.length > 320) {
            throw new BadRequestError("email format is invalid");
          }
          newEmail = trimmed;
        }
      }
      if (newEmail !== (member.email ?? null)) {
        patch.email = newEmail;
      } else {
        newEmail = undefined;
      }
    }

    let newPhone: string | null | undefined;
    if (input.phone !== undefined) {
      if (input.phone === null) {
        newPhone = null;
      } else if (typeof input.phone !== "string") {
        throw new BadRequestError("phone must be a string or null");
      } else {
        const trimmed = input.phone.trim();
        if (trimmed.length === 0) {
          newPhone = null;
        } else {
          if (!PHONE_REGEX.test(trimmed) || trimmed.length > 32) {
            throw new BadRequestError("phone format is invalid");
          }
          newPhone = trimmed;
        }
      }
      if (newPhone !== (member.phone ?? null)) {
        patch.phone = newPhone;
      } else {
        newPhone = undefined;
      }
    }

    const effectiveEmail =
      patch.email !== undefined ? patch.email : member.email ?? null;
    const effectivePhone =
      patch.phone !== undefined ? patch.phone : member.phone ?? null;
    if (effectiveEmail === null && effectivePhone === null) {
      throw new BadRequestError(
        "At least one of email or phone must be set"
      );
    }

    if (patch.email !== undefined && patch.email !== null) {
      const conflictId = await membersRepository.findIdByEmail(
        tenantId,
        patch.email,
        memberId
      );
      if (conflictId) {
        throw new ConflictError(
          "Another member in this tenant already uses this email"
        );
      }
    }
    if (patch.phone !== undefined && patch.phone !== null) {
      const conflictId = await membersRepository.findIdByPhone(
        tenantId,
        patch.phone,
        memberId
      );
      if (conflictId) {
        throw new ConflictError(
          "Another member in this tenant already uses this phone"
        );
      }
    }

    if (patch.email !== undefined) {
      patch.email_verified = input.keepEmailVerified === true
        ? member.email_verified
        : false;
    }
    if (patch.phone !== undefined) {
      patch.phone_verified = input.keepPhoneVerified === true
        ? member.phone_verified
        : false;
    }

    if (Object.keys(patch).length === 0) {
      return member;
    }

    try {
      await membersRepository.updateProfile(tenantId, memberId, patch);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const constraint = (err as { constraint?: string }).constraint ?? "";
        if (constraint.includes("email")) {
          throw new ConflictError(
            "Another member in this tenant already uses this email"
          );
        }
        if (constraint.includes("phone")) {
          throw new ConflictError(
            "Another member in this tenant already uses this phone"
          );
        }
        throw new ConflictError("Email or phone is already in use");
      }
      throw err;
    }

    const updated = await membersRepository.findById(tenantId, memberId);
    if (!updated) {
      throw new NotFoundError("Member not found after update");
    }
    return updated;
  }

  /**
   * Manually add a single tenant member from the admin Users section. This is
   * the single-row sibling of bulk import: same contract (name required + at
   * least one of email/phone), same revenue-sharing guard. Blocked entirely
   * when revenue sharing is enabled because manually adding members would let
   * the tenant onboard users outside the platform-managed payment flow.
   * password_hash stays NULL so the user signs in via the normal reset/OTP
   * flows; verification flags stay false.
   */
  async createSingleMember(
    tenantId: string,
    actingUserId: string,
    input: { name?: unknown; email?: unknown; phone?: unknown }
  ): Promise<MemberDetail> {
    if (typeof input.name !== "string") {
      throw new BadRequestError("name is required");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new BadRequestError("name cannot be empty");
    }
    if (name.length > 200) {
      throw new BadRequestError("name is too long");
    }

    // Normalize with the SAME helpers bulk import uses, so a manually added
    // member dedups against (and is stored consistently with) imported rows.
    if (input.email !== undefined && typeof input.email !== "string" && input.email !== null) {
      throw new BadRequestError("email must be a string");
    }
    if (input.phone !== undefined && typeof input.phone !== "string" && input.phone !== null) {
      throw new BadRequestError("phone must be a string");
    }
    const email = normalizeEmail(
      typeof input.email === "string" ? input.email : null
    );
    if (email !== null && (!isValidEmail(email) || email.length > 320)) {
      throw new BadRequestError("email format is invalid");
    }
    const phone = normalizePhone(
      typeof input.phone === "string" ? input.phone : null
    );
    if (phone !== null && (!isValidPhone(phone) || phone.length > 32)) {
      throw new BadRequestError("phone format is invalid");
    }

    if (email === null && phone === null) {
      throw new BadRequestError(
        "At least one of email or phone is required"
      );
    }

    if (email !== null) {
      const existing = await membersRepository.findByEmail(tenantId, email);
      if (existing) {
        throw new ConflictError(
          "A member with this email already exists in this tenant"
        );
      }
    }
    if (phone !== null) {
      const existing = await membersRepository.findByPhone(tenantId, phone);
      if (existing) {
        throw new ConflictError(
          "A member with this phone already exists in this tenant"
        );
      }
    }

    let memberId: string;
    try {
      memberId = await membersRepository.createMember({
        tenantId,
        name,
        email,
        phone,
        invitedBy: actingUserId,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const constraint = (err as { constraint?: string }).constraint ?? "";
        if (constraint.includes("email")) {
          throw new ConflictError(
            "A member with this email already exists in this tenant"
          );
        }
        if (constraint.includes("phone")) {
          throw new ConflictError(
            "A member with this phone already exists in this tenant"
          );
        }
        throw new ConflictError("Email or phone is already in use");
      }
      throw err;
    }

    const created = await membersRepository.findById(tenantId, memberId);
    if (!created) {
      throw new NotFoundError("Member not found after creation");
    }
    return created;
  }

  async getMemberEnrollments(
    tenantId: string,
    memberId: string
  ): Promise<MemberEnrollment[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getEnrollments(tenantId, memberId);
  }

  async getMemberBookAccess(
    tenantId: string,
    memberId: string
  ): Promise<MemberBookAccess[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getBookAccess(tenantId, memberId);
  }

  async getMemberOrders(
    tenantId: string,
    memberId: string
  ): Promise<MemberOrder[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getOrders(tenantId, memberId);
  }

  async getMemberCertificates(
    tenantId: string,
    memberId: string
  ): Promise<MemberCertificate[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getCertificates(tenantId, memberId);
  }

  async getMemberStats(tenantId: string): Promise<MemberStats> {
    return membersRepository.getStats(tenantId);
  }

  async grantCourseAccess(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);

    const existing = await membersRepository.findExistingEnrollment(
      tenantId,
      memberId,
      courseId
    );
    const validTill = defaultAdminGrantValidTill();
    if (existing) {
      if (existing.status === "ACTIVE") {
        throw new ConflictError("Member already has access to this course");
      }
      await membersRepository.reactivateEnrollment(tenantId, existing.id, validTill);
      void grantNotificationService.notifyGrant(tenantId, memberId, "COURSE", courseId);
      return;
    }

    await membersRepository.grantEnrollment(
      tenantId,
      memberId,
      courseId,
      ulid(),
      validTill
    );
    void grantNotificationService.notifyGrant(tenantId, memberId, "COURSE", courseId);
  }

  async revokeCourseAccess(
    tenantId: string,
    memberId: string,
    enrollmentId: string
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    await membersRepository.revokeEnrollment(tenantId, enrollmentId);
  }

  async grantBookAccess(
    tenantId: string,
    memberId: string,
    bookId: string
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);

    const existing = await membersRepository.findExistingBookAccess(
      tenantId,
      memberId,
      bookId
    );
    const validTill = defaultAdminGrantValidTill();
    if (existing) {
      if (existing.status === "ACTIVE") {
        throw new ConflictError("Member already has access to this book");
      }
      await membersRepository.reactivateBookAccess(tenantId, existing.id, validTill);
      void grantNotificationService.notifyGrant(tenantId, memberId, "BOOK", bookId);
      return;
    }

    await membersRepository.grantBookAccess(
      tenantId,
      memberId,
      bookId,
      ulid(),
      validTill
    );
    void grantNotificationService.notifyGrant(tenantId, memberId, "BOOK", bookId);
  }

  async revokeBookAccess(
    tenantId: string,
    memberId: string,
    accessId: string
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    await membersRepository.revokeBookAccess(tenantId, accessId);
  }

  /**
   * Allows tenant admin to manually push or pull an enrollment's expiry.
   * `validTill = null` clears the expiry (lifetime access). The enrollment
   * must already belong to the given member under the given tenant; this is
   * the cross-tenant data-isolation guard since the route only knows
   * (memberId, enrollmentId) from the URL.
   */
  async updateEnrollmentValidity(
    tenantId: string,
    memberId: string,
    enrollmentId: string,
    validTill: Date | null
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    const row = await membersRepository.findEnrollmentById(
      tenantId,
      enrollmentId
    );
    if (!row || row.tenant_member_id !== memberId) {
      throw new NotFoundError("Enrollment not found");
    }
    await membersRepository.updateEnrollmentValidity(
      tenantId,
      enrollmentId,
      validTill
    );
  }

  async updateBookAccessValidity(
    tenantId: string,
    memberId: string,
    accessId: string,
    validTill: Date | null
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    const row = await membersRepository.findBookAccessById(tenantId, accessId);
    if (!row || row.tenant_member_id !== memberId) {
      throw new NotFoundError("Book access not found");
    }
    await membersRepository.updateBookAccessValidity(
      tenantId,
      accessId,
      validTill
    );
  }

  // ─── Batch / test series access management.
  //     Grants go through bulkEnrollService.grantSingle (same engine as bulk
  //     enroll); these handle list/revoke/expiry.

  async getMemberBatchEnrollments(tenantId: string, memberId: string) {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getBatchEnrollments(tenantId, memberId);
  }

  async revokeBatchAccess(
    tenantId: string,
    memberId: string,
    enrollmentId: string
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    const row = await membersRepository.findBatchEnrollmentById(tenantId, enrollmentId);
    if (!row || row.tenant_member_id !== memberId) {
      throw new NotFoundError("Batch enrollment not found");
    }
    await membersRepository.revokeBatchEnrollment(tenantId, memberId, enrollmentId, row.batch_id);
  }

  async updateBatchEnrollmentValidity(
    tenantId: string,
    memberId: string,
    enrollmentId: string,
    validTill: Date | null
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    const row = await membersRepository.findBatchEnrollmentById(tenantId, enrollmentId);
    if (!row || row.tenant_member_id !== memberId) {
      throw new NotFoundError("Batch enrollment not found");
    }
    await membersRepository.updateBatchEnrollmentValidity(tenantId, enrollmentId, validTill);
  }

  async getMemberTestSeriesEnrollments(tenantId: string, memberId: string) {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getTestSeriesEnrollments(tenantId, memberId);
  }

  async revokeTestSeriesAccess(
    tenantId: string,
    memberId: string,
    enrollmentId: string
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    const row = await membersRepository.findTestSeriesEnrollmentById(tenantId, enrollmentId);
    if (!row || row.tenant_member_id !== memberId) {
      throw new NotFoundError("Test series enrollment not found");
    }
    await membersRepository.revokeTestSeriesEnrollment(tenantId, enrollmentId);
  }

  async updateTestSeriesEnrollmentValidity(
    tenantId: string,
    memberId: string,
    enrollmentId: string,
    validTill: Date | null
  ): Promise<void> {
    await this.ensureMemberExists(tenantId, memberId);
    const row = await membersRepository.findTestSeriesEnrollmentById(tenantId, enrollmentId);
    if (!row || row.tenant_member_id !== memberId) {
      throw new NotFoundError("Test series enrollment not found");
    }
    await membersRepository.updateTestSeriesEnrollmentValidity(tenantId, enrollmentId, validTill);
  }

  async getPublishedCourses(tenantId: string) {
    return membersRepository.getPublishedCourses(tenantId);
  }

  async getPublishedBooks(tenantId: string) {
    return membersRepository.getPublishedBooks(tenantId);
  }

  async getMemberDetailStats(
    tenantId: string,
    memberId: string
  ): Promise<MemberDetailStats> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getDetailStats(tenantId, memberId);
  }

  async getMemberCartItems(
    tenantId: string,
    memberId: string
  ): Promise<MemberCartItem[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getCartItems(tenantId, memberId);
  }

  async getMemberCouponRedemptions(
    tenantId: string,
    memberId: string
  ): Promise<MemberCouponRedemption[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getCouponRedemptions(tenantId, memberId);
  }

  async getMemberRefunds(
    tenantId: string,
    memberId: string
  ): Promise<MemberRefund[]> {
    await this.ensureMemberExists(tenantId, memberId);
    return membersRepository.getRefunds(tenantId, memberId);
  }

  private async ensureMemberExists(
    tenantId: string,
    memberId: string
  ): Promise<void> {
    const member = await membersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }
  }
}

export default new MembersService();
