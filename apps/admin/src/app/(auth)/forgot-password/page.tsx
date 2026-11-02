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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { useForgotPassword } from "@/lib/hooks/use-auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const forgotPassword = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPassword.mutate(email);
  };

  return (
    <AuthPageLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            {forgotPassword.isSuccess
              ? "Check your email for a reset link"
              : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        {forgotPassword.isSuccess ? (
          <>
            <CardContent>
              <div className="rounded-md bg-primary/10 p-3 text-sm text-foreground">
                If an account with that email exists, a password reset link has
                been sent. The link expires in 15 minutes.
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {forgotPassword.error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {forgotPassword.error.message}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={forgotPassword.isPending}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                disabled={forgotPassword.isPending}
              >
                {forgotPassword.isPending
                  ? "Sending..."
                  : "Send Reset Link"}
              </Button>
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="mr-1 inline h-3 w-3" />
                Back to Login
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </AuthPageLayout>
  );
}
