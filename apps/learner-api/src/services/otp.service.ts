import { ulid } from "ulid";
import config from "../config";
import otpRepository from "../repositories/otp.repository";
import emailService from "./email.service";
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
   * Send an OTP to the given identifier. Email is the only delivery
   * channel; anything else is rejected before a code is minted.
   */
  async sendOtp(
    tenantId: string,
    identifier: string,
    channel: "email" | "whatsapp",
    tenantName: string,
    tenantLogoUrl?: string,
    _context: "login" | "phone_verify" = "login"
  ): Promise<void> {
    if (channel !== "email") {
      throw new BadRequestError("Only email one-time codes are supported");
    }
    // Clean up expired OTPs for this identifier
    await otpRepository.deleteExpired(tenantId, identifier, channel);

    // Rate limit: max 1 OTP per minute per identifier+channel.
    const recent = await otpRepository.findRecent(tenantId, identifier, channel, 60);
    if (recent) {
      throw new BadRequestError("Please wait before requesting another OTP");
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + parseInt(config.OTP_EXPIRY_MINUTES, 10) * 60 * 1000);
    const otpId = ulid();

    await otpRepository.create({
      id: otpId,
      tenant_id: tenantId,
      identifier,
      code,
      channel,
      expires_at: expiresAt,
    });

    await emailService.sendOtpEmail(
      tenantId,
      identifier,
      code,
      tenantName,
      tenantLogoUrl,
      otpId,
    );
    logger.info(`OTP sent via email to ${identifier} for tenant ${tenantId}`);
  }

  /**
   * Verify an OTP code. Returns true if valid, throws otherwise.
   */
  async verifyOtp(
    tenantId: string,
    identifier: string,
    channel: "email" | "whatsapp",
    code: string
  ): Promise<boolean> {
    const maxAttempts = parseInt(config.OTP_MAX_ATTEMPTS, 10);

    const otp = await otpRepository.findLatestValid(tenantId, identifier, channel);

    if (!otp) {
      throw new BadRequestError("No valid OTP found. Please request a new one.");
    }

    if (otp.attempts >= maxAttempts) {
      throw new BadRequestError("Too many verification attempts. Please request a new OTP.");
    }

    // Increment attempts
    await otpRepository.incrementAttempts(otp.id);

    if (otp.code !== code) {
      throw new BadRequestError("Invalid OTP code");
    }

    // Mark as verified
    await otpRepository.markVerified(otp.id);

    return true;
  }
}

export default new OtpService();
