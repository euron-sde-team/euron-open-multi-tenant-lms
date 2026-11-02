"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { useResetPassword } from "@/lib/hooks/use-auth";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState("");
  const resetPassword = useResetPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    resetPassword.mutate({ token, password });
  };

  if (resetPassword.isSuccess) {
    return (
      <AuthPageLayout>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              Password Reset Successful
            </CardTitle>
            <CardDescription>
              Your password has been updated. You can now sign in with your new
              password.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Set New Password
          </CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {(validationError || resetPassword.error) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {validationError || resetPassword.error?.message}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={resetPassword.isPending}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={resetPassword.isPending}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
            {resetPassword.error && (
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Request a new reset link
              </Link>
            )}
          </CardFooter>
        </form>
      </Card>
    </AuthPageLayout>
  );
}
