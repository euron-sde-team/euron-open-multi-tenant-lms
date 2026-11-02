'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

export default function SearchBar({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch, debounceMs]);

  return (
    <div className='relative'>
      <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
      <input
        type='text'
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className='w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'
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
  );
}
