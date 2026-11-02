'use client';

import { useEffect, useState } from 'react';

import Header from './Header';
import MobileNav from './MobileNav';
import Sidebar from './Sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className='min-h-screen bg-surface'>
      {/* Fixed Header */}
      <Header />

      {/* Main Layout Container */}
      <div className='flex pt-16'>
        {/* Desktop Sidebar - Hidden on mobile/tablet */}
        <Sidebar />

        {/* Main Content Area - Responsive margins.
            `min-w-0` is required: without it this flex child keeps its
            intrinsic content width and wide pages (e.g. the CRM Kanban)
            overflow the whole viewport instead of scrolling internally. */}
        <main className='min-h-screen w-full min-w-0 flex-1 pb-16 lg:ml-60 lg:pb-0'>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation - Only visible on mobile/tablet */}
      {isMounted && <MobileNav />}
    </div>
  );
}
