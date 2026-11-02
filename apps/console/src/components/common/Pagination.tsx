'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className='flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6'>
      <div className='flex flex-1 justify-between sm:hidden'>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className='relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className='relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        >
          Next
        </button>
      </div>
      <div className='hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'>
        <div>
          <p className='text-sm text-gray-700'>
            Showing <span className='font-medium'>{startItem}</span> to{' '}
            <span className='font-medium'>{endItem}</span> of{' '}
            <span className='font-medium'>{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav
            className='isolate inline-flex -space-x-px rounded-md shadow-sm'
            aria-label='Pagination'
          >
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className='relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20 disabled:opacity-50'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                // Show first page, last page, current page, and pages around current
                return (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                );
              })
              .map((page, index, array) => {
                // Add ellipsis if needed
                const showEllipsisBefore =
                  index > 0 && page - array[index - 1] > 1;
                return (
                  <div key={page} className='flex items-center'>
                    {showEllipsisBefore && (
                      <span className='relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700'>
                        ...
                      </span>
                    )}
                    <button
                      onClick={() => onPageChange(page)}
                      className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium focus:z-20 ${
                        currentPage === page
                          ? 'z-10 border-primary-500 bg-primary-50 text-primary-600'
                          : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                );
              })}
            <button
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className='relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20 disabled:opacity-50'
            >
              <ChevronRight className='h-5 w-5' />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
