'use client';

import { Filter, X } from 'lucide-react';
import { useState } from 'react';

interface FilterOption {
  value: string;
  label: string;
}

interface Filter {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: Filter[];
  onFilterChange: (key: string, value: string) => void;
  activeFilters: Record<string, string>;
}

export default function FilterBar({
  filters,
  onFilterChange,
  activeFilters,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = Object.values(activeFilters).filter(
    (v) => v,
  ).length;

  const clearFilter = (key: string) => {
    onFilterChange(key, '');
  };

  const clearAllFilters = () => {
    filters.forEach((filter) => {
      onFilterChange(filter.key, '');
    });
  };

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
      >
        <Filter className='h-4 w-4' />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className='text-xs font-medium text-primary-600'>
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className='fixed inset-0 z-10'
            onClick={() => setIsOpen(false)}
          />
          <div className='absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg'>
            <div className='p-4'>
              <div className='mb-4 flex items-center justify-between'>
                <h3 className='text-sm font-semibold text-gray-900'>Filters</h3>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className='text-xs text-primary-600 hover:text-primary-700'
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className='space-y-4'>
                {filters.map((filter) => (
                  <div key={filter.key}>
                    <label className='mb-2 block text-xs font-medium text-gray-700'>
                      {filter.label}
                    </label>
                    <select
                      value={activeFilters[filter.key] || ''}
                      onChange={(e) =>
                        onFilterChange(filter.key, e.target.value)
                      }
                      className='w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'
                    >
                      <option value=''>All</option>
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {activeFilters[filter.key] && (
                      <button
                        onClick={() => clearFilter(filter.key)}
                        className='mt-2 flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700'
                      >
                        <X className='h-3 w-3' />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
