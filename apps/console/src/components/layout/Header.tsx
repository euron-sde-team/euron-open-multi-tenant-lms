'use client';

import { Bell, LogOut, Menu, Search, Settings, User, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { BRAND_NAME, CONSOLE_TITLE } from '@/lib/brand';

export default function Header() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <header className='fixed left-0 right-0 top-0 z-50 h-16 border-b border-gray-200 bg-white'>
      <div className='flex h-full w-full items-center justify-between px-4 md:px-6'>
        {/* Left Section - Logo and Mobile Menu */}
        <div className='flex min-w-0 items-center space-x-4'>
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className='lg:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100'
            aria-label='Toggle menu'
          >
            {isMobileMenuOpen ? (
              <X className='h-5 w-5' />
            ) : (
              <Menu className='h-5 w-5' />
            )}
          </button>

          {/* Logo */}
          <Link href='/' className='flex items-center space-x-2'>
            <div className='flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg'>
              <Image
                src='/svg/Logo.svg'
                alt={BRAND_NAME}
                width={32}
                height={32}
                className='h-full w-full object-cover'
              />
            </div>
            <span className='hidden text-lg font-semibold tracking-tight text-gray-900 sm:block'>
              {CONSOLE_TITLE}
            </span>
          </Link>
        </div>

        {/* Center Section - Search (Desktop) */}
        <div className='relative hidden max-w-md flex-1 px-4 md:block'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                aria-label='Clear search'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
        </div>

        {/* Right Section - Actions and User Menu */}
        <div className='flex flex-shrink-0 items-center justify-end space-x-2 md:space-x-4'>
          {/* Mobile Search Icon */}
          <button
            className='relative flex items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 md:hidden'
            aria-label='Search'
          >
            <Search className='h-5 w-5' />
          </button>

          {/* Notifications */}
          <button
            className='relative flex items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100'
            aria-label='Notifications'
          >
            <Bell className='h-5 w-5' />
            <span className='absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500'></span>
          </button>

          {/* User Profile Dropdown */}
          <div
            className='relative flex items-center space-x-2 border-l border-gray-200 pl-2 md:space-x-3 md:pl-4'
            ref={dropdownRef}
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className='flex items-center'
              aria-label='Account menu'
              aria-haspopup='menu'
              aria-expanded={isDropdownOpen}
            >
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-white md:h-9 md:w-9'>
                <User className='h-4 w-4 md:h-5 md:w-5' />
              </div>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className='absolute right-0 top-full mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg'>
                <div className='py-1'>
                  <Link
                    href='/admin-users'
                    className='flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Settings className='h-4 w-4' />
                    <span>Admin users</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      // Handle logout
                    }}
                    className='flex w-full items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                  >
                    <LogOut className='h-4 w-4' />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
