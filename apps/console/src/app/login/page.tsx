'use client';

import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useContext, useEffect, useState } from 'react';

import { login } from '@/lib/api/auth';
import { BRAND_NAME, CONSOLE_TITLE } from '@/lib/brand';

import { AuthContext } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const {
    authenticated,
    setAuthenticated,
    isLoading: authLoading,
  } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && authenticated) {
      router.push('/');
    }
  }, [authenticated, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setIsLoading(true);
      const response = await login({ email, password });

      if (response.success && response.data.token) {
        // Store token and update auth context
        setAuthenticated(response.data.token);
        // Redirect to dashboard
        router.push('/');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (axiosError.response?.status === 401) {
          setError('Invalid email or password');
        } else if (axiosError.response?.data?.message) {
          setError(axiosError.response.data.message);
        } else {
          setError('An error occurred. Please try again.');
        }
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render login form if already authenticated
  if (authLoading) {
    return (
      <div className='flex h-screen w-full items-center justify-center bg-[#F3F6F8]'>
        <div className='h-12 w-12 animate-spin rounded-full border-4 border-[#047857] border-t-transparent'></div>
      </div>
    );
  }

  if (authenticated) {
    return null;
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-[#F3F6F8] px-4'>
      <div className='w-full max-w-md'>
        {/* Logo and Header */}
        <div className='mb-8 text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[#047857]'>
            <span className='text-2xl font-bold text-white'>{BRAND_NAME.charAt(0)}</span>
          </div>
          <h1 className='text-2xl font-bold text-[#111827]'>
            {CONSOLE_TITLE}
          </h1>
          <p className='mt-2 text-[#4B5563]'>
            Sign in to access the admin dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className='rounded-lg border border-[#E5E7EB] bg-white p-8 shadow-sm'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Error Message */}
            {error && (
              <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600'>
                <AlertCircle className='h-4 w-4 flex-shrink-0' />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor='email'
                className='mb-2 block text-sm font-medium text-[#111827]'
              >
                Email Address
              </label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]' />
                <input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='admin@example.com'
                  className='h-12 w-full rounded-lg border border-[#E5E7EB] bg-[#F3F6F8] pl-10 pr-4 text-[#111827] placeholder-[#9CA3AF] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20'
                  disabled={isLoading}
                  autoComplete='email'
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor='password'
                className='mb-2 block text-sm font-medium text-[#111827]'
              >
                Password
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]' />
                <input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='Enter your password'
                  className='h-12 w-full rounded-lg border border-[#E5E7EB] bg-[#F3F6F8] pl-10 pr-12 text-[#111827] placeholder-[#9CA3AF] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20'
                  disabled={isLoading}
                  autoComplete='current-password'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827]'
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className='h-5 w-5' />
                  ) : (
                    <Eye className='h-5 w-5' />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type='submit'
              disabled={isLoading}
              className='flex h-12 w-full items-center justify-center rounded-full bg-[#047857] font-semibold text-white transition hover:bg-[#065f46] disabled:cursor-not-allowed disabled:opacity-50'
            >
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className='mt-6 text-center text-sm text-[#4B5563]'>
          Protected admin area. Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
