import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config";
import { admin_user_status } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import adminUserRepository from "../repositories/admin-user.repository";
import { AdminJwtPayload, TokenType } from "../types/auth.type";
import auditService from "./audit.service";

/** Request context for attributing the login in the audit log */
interface LoginContext {
  ipAddress: string | null;
  userAgent: string | null;
}

const SALT_ROUNDS = 12;

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  email_verified: boolean;
  roles: string[];
  permissions: string[];
  last_login_at: Date | null;
}

class AdminAuthService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token for admin user
   */
  generateToken(payload: AdminJwtPayload): string {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): AdminJwtPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as AdminJwtPayload;

      if (decoded.type !== TokenType.ADMIN) {
        throw new UnauthorizedError("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError("Invalid or expired token");
    }
  }

  /**
   * Login admin user with email and password
   */
  async login(
    email: string,
    password: string,
    context?: LoginContext
  ): Promise<LoginResponse> {
    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const user = await adminUserRepository.findByEmail(email.toLowerCase().trim());

    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!user.password_hash) {
      throw new UnauthorizedError("Password login not available for this account");
    }

    if (user.status !== admin_user_status.ACTIVE) {
      throw new UnauthorizedError("Account is not active");
    }

    const isPasswordValid = await this.verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Update last login timestamp
    await adminUserRepository.updateLastLogin(user.id);

    // Get user roles
    const roles = await adminUserRepository.getUserRoles(user.id);

    // Generate JWT token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      type: TokenType.ADMIN,
    });

    await auditService.record({
      actor: {
        adminId: user.id,
        email: user.email,
        name: user.name,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
      },
      action: "LOGIN",
      category: "AUTH",
      resourceId: user.id,
      resourceLabel: user.email,
      summary: `${user.email} logged in`,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
      },
    };
  }

  /**
   * Get current admin user profile with roles and permissions
   */
  async getMe(userId: string): Promise<MeResponse> {
    const user = await adminUserRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    const [roles, permissions] = await Promise.all([
      adminUserRepository.getUserRoles(userId),
      adminUserRepository.getUserPermissions(userId),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      roles,
      permissions,
      last_login_at: user.last_login_at,
    };
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    return adminUserRepository.hasRole(userId, roleCode);
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    return adminUserRepository.hasPermission(userId, permissionCode);
  }
}

export default new AdminAuthService();
