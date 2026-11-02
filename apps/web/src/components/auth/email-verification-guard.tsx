"use client";

import { usePathname } from "next/navigation";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { EmailVerificationModal } from "./email-verification-modal";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function EmailVerificationGuard() {
  const member = useUserAuthStore((s) => s.member);
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname?.startsWith(route));

  // Suppress the verify-now nag ONLY for accounts auto-created via easy checkout.
  // These members opted out of verification at signup by tenant policy, and will
  // be flipped to email_verified=true the next time they log in via Email OTP
  // (see auth.service.ts:verifyOtp). Password / OAuth / regular OTP signups still
  // get the verification modal exactly as before, the suppression is account-
  // scoped, not tenant-scoped, so legacy unverified accounts don't quietly fall
  // through the guard.
  const isEasyCheckoutMember =
    !!member && member.profileMetadata?.signupSource === "EASY_CHECKOUT";

  const showModal =
    isAuthenticated &&
    !!member &&
    !member.emailVerified &&
    !isAuthRoute &&
    !member.email.endsWith("@phone.user") &&
    !isEasyCheckoutMember;

  return <EmailVerificationModal open={showModal} />;
}
