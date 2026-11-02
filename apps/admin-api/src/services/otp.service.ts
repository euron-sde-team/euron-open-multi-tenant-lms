import { ulid } from "ulid";
import config from "../config";
import tenantAdminOtpRepository from "../repositories/tenant-admin-otp.repository";
import notificationService from "./notification.service";
import { BRAND } from "../lib/brand";
import logger from "../utils/logger";
import { BadRequestError } from "../errors/bad-request.error";

class OtpService {
  /**
   * Generate a random numeric OTP of configured length.
   */
  generateCode(): string {
    const length = parseInt(config.OTP_LENGTH, 10);
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return String(Math.floor(min + Math.random() * (max - min + 1)));
  }

  /**
   * Send an OTP to the given email address.
   * Creates a DB record and dispatches the message.
   */
  async sendOtp(
    userId: string,
    identifier: string,
    channel: "email"
  ): Promise<void> {
    // Clean up expired OTPs for this identifier
    await tenantAdminOtpRepository.deleteExpired(userId, identifier, channel);

    // Check for rate limiting, max 1 OTP per minute per identifier+channel
    const recent = await tenantAdminOtpRepository.findRecent(userId, identifier, channel, 60);
    if (recent) {
      throw new BadRequestError("Please wait before requesting another OTP");
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + parseInt(config.OTP_EXPIRY_MINUTES, 10) * 60 * 1000);

    await tenantAdminOtpRepository.create({
      id: ulid(),
      user_id: userId,
      identifier,
      code,
      channel,
      expires_at: expiresAt,
    });

    const minutes = parseInt(config.OTP_EXPIRY_MINUTES, 10);
    await notificationService.sendCustomEmail(
      identifier,
      `Your ${BRAND.name} verification code`,
      `<p>Your verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong>.</p>` +
        `<p>It expires in ${minutes} minutes. If you did not request it, you can ignore this email.</p>`
    );

    logger.info(`OTP sent via ${channel} to ${identifier} for user ${userId}`);
  }

  /**
   * Verify an OTP code. Returns true if valid, throws otherwise.
   */
  async verifyOtp(
    userId: string,
    identifier: string,
    channel: "email",
    code: string
  ): Promise<boolean> {
    const maxAttempts = parseInt(config.OTP_MAX_ATTEMPTS, 10);

    const otp = await tenantAdminOtpRepository.findLatestValid(userId, identifier, channel);

    if (!otp) {
      throw new BadRequestError("No valid OTP found. Please request a new one.");
    }

    if (otp.attempts >= maxAttempts) {
      throw new BadRequestError("Too many verification attempts. Please request a new OTP.");
    }

    // Increment attempts
    await tenantAdminOtpRepository.incrementAttempts(otp.id);

    if (otp.code !== code) {
      throw new BadRequestError("Invalid OTP code");
    }

    // Mark as verified
    await tenantAdminOtpRepository.markVerified(otp.id);

    return true;
  }
}

export default new OtpService();
