'use client';

import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Shield,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useCreateAdminUser, useGetRoles } from '@/lib/api/hooks';

export default function CreateAdminUserPage() {
  const router = useRouter();
  const createAdminUser = useCreateAdminUser();
  const { data: rolesData, isLoading: rolesLoading } = useGetRoles();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    avatar_url: '',
    roleIds: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const roles = rolesData?.roles || [];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await createAdminUser.mutateAsync({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        avatar_url: formData.avatar_url || undefined,
        roleIds: formData.roleIds.length > 0 ? formData.roleIds : undefined,
      });
      router.push('/admin-users');
    } catch {
      // Error is handled by react-query
    }
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  return (
    <div className='p-8'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <Link
            href='/admin-users'
            className='inline-flex items-center text-sm text-textSecondary hover:text-textPrimary mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            Back to Admin Users
          </Link>
          <h1 className='text-2xl font-bold text-textPrimary'>
            Create Admin User
          </h1>
          <p className='text-textSecondary mt-1'>
            Add a new administrator to the system
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Error Alert */}
          {createAdminUser.error && (
            <div className='mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600'>
              <AlertCircle className='h-5 w-5 flex-shrink-0' />
              <span>{createAdminUser.error.message}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center gap-2 mb-6'>
              <User className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-textPrimary'>
                Basic Information
              </h2>
            </div>

            <div className='space-y-4'>
              {/* Name */}
              <div>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Full Name <span className='text-red-500'>*</span>
                </label>
                <input
                  id='name'
                  type='text'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder='John Doe'
                  className={`w-full h-11 px-4 rounded-lg border ${
                    errors.name ? 'border-red-500' : 'border-border'
                  } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                />
                {errors.name && (
                  <p className='mt-1 text-sm text-red-500'>{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Email Address <span className='text-red-500'>*</span>
                </label>
                <input
                  id='email'
                  type='email'
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder='admin@example.com'
                  className={`w-full h-11 px-4 rounded-lg border ${
                    errors.email ? 'border-red-500' : 'border-border'
                  } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                />
                {errors.email && (
                  <p className='mt-1 text-sm text-red-500'>{errors.email}</p>
                )}
              </div>

              {/* Avatar URL */}
              <div>
                <label
                  htmlFor='avatar_url'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Avatar URL
                </label>
                <input
                  id='avatar_url'
                  type='url'
                  value={formData.avatar_url}
                  onChange={(e) =>
                    setFormData({ ...formData, avatar_url: e.target.value })
                  }
                  placeholder='https://example.com/avatar.jpg'
                  className='w-full h-11 px-4 rounded-lg border border-border bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                />
                <p className='mt-1 text-xs text-textSecondary'>
                  Optional. Enter a URL for the user&apos;s profile picture.
                </p>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center gap-2 mb-6'>
              <Shield className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-textPrimary'>
                Security
              </h2>
            </div>

            <div className='space-y-4'>
              {/* Password */}
              <div>
                <label
                  htmlFor='password'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Password <span className='text-red-500'>*</span>
                </label>
                <div className='relative'>
                  <input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder='Minimum 8 characters'
                    className={`w-full h-11 px-4 pr-12 rounded-lg border ${
                      errors.password ? 'border-red-500' : 'border-border'
                    } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary'
                  >
                    {showPassword ? (
                      <EyeOff className='h-5 w-5' />
                    ) : (
                      <Eye className='h-5 w-5' />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className='mt-1 text-sm text-red-500'>{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor='confirmPassword'
                  className='block text-sm font-medium text-textPrimary mb-1'
                >
                  Confirm Password <span className='text-red-500'>*</span>
                </label>
                <div className='relative'>
                  <input
                    id='confirmPassword'
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder='Re-enter password'
                    className={`w-full h-11 px-4 pr-12 rounded-lg border ${
                      errors.confirmPassword
                        ? 'border-red-500'
                        : 'border-border'
                    } bg-bgGray text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
                  />
                  <button
                    type='button'
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary'
                  >
                    {showConfirmPassword ? (
                      <EyeOff className='h-5 w-5' />
                    ) : (
                      <Eye className='h-5 w-5' />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className='mt-1 text-sm text-red-500'>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Role Assignment */}
          <div className='mb-6 border-t border-border pt-6 pb-2'>
            <div className='flex items-center gap-2 mb-6'>
              <Shield className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-textPrimary'>
                Role Assignment
              </h2>
            </div>

            {rolesLoading ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='h-6 w-6 animate-spin text-primary' />
              </div>
            ) : (
              <div className='space-y-3'>
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center p-4 rounded-lg border cursor-pointer transition ${
                      formData.roleIds.includes(role.id)
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:bg-bgGray'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={formData.roleIds.includes(role.id)}
                      onChange={() => handleRoleToggle(role.id)}
                      className='w-4 h-4 text-primary border-border rounded focus:ring-primary'
                    />
                    <div className='ml-3'>
                      <div className='font-medium text-textPrimary'>
                        {role.name}
                        {role.is_system && (
                          <span className='ml-2 text-xs text-purple-700'>
                            System
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <div className='text-sm text-textSecondary'>
                          {role.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
                {roles.length === 0 && (
                  <p className='text-textSecondary text-center py-4'>
                    No roles available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className='flex items-center justify-end gap-3'>
            <Link
              href='/admin-users'
              className='h-11 px-6 flex items-center justify-center rounded-full border border-border text-textPrimary font-medium hover:bg-bgGray transition'
            >
              Cancel
            </Link>
            <button
              type='submit'
              disabled={createAdminUser.isLoading}
              className='h-11 px-6 flex items-center justify-center rounded-full bg-primarySolid text-white font-medium hover:bg-primaryHover transition disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {createAdminUser.isLoading ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Creating...
                </>
              ) : (
                <>
                  <Save className='h-4 w-4 mr-2' />
                  Create Admin User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
