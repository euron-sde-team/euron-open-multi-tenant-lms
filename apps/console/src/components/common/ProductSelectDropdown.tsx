'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Product } from '@/lib/api/types';

function productLabel(prod: Product): string {
  const name = prod.feature_name || prod.feature_key;
  return `${prod.code} (${name})`;
}

export interface ProductSelectDropdownProps {
  value: string;
  products: Product[];
  onChange: (productId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
}

export default function ProductSelectDropdown({
  value,
  products,
  onChange,
  disabled = false,
  placeholder = 'Select a product',
  id,
  'aria-label': ariaLabel = 'Product',
}: ProductSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === value);
  const displayLabel = selectedProduct
    ? productLabel(selectedProduct)
    : placeholder;

  const filteredProducts = search.trim()
    ? products.filter((p) => {
        const label = productLabel(p).toLowerCase();
        return label.includes(search.toLowerCase());
      })
    : products;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className='relative w-full'>
      <button
        type='button'
        id={id}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup='listbox'
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className='flex h-11 w-full items-center justify-between rounded-lg border border-border bg-surface px-4 text-left text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50'
      >
        <span
          className={
            selectedProduct ? 'text-textPrimary' : 'text-textSecondary'
          }
        >
          {displayLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-textSecondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role='listbox'
          aria-label={ariaLabel}
          className='absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-hidden rounded-lg border border-border bg-surface shadow-lg'
        >
          <div className='border-b border-border p-2'>
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search products...'
              className='w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-textPrimary placeholder-textSecondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              autoFocus
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className='max-h-48 overflow-y-auto p-1'>
            {filteredProducts.length === 0 ? (
              <div className='px-3 py-4 text-center text-sm text-textSecondary'>
                No products found
              </div>
            ) : (
              filteredProducts.map((prod) => {
                const isSelected = prod.id === value;
                const label = productLabel(prod);
                return (
                  <button
                    key={prod.id}
                    type='button'
                    role='option'
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(prod.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-textPrimary hover:bg-bgGray'
                    }`}
                  >
                    <span>{label}</span>
                    {isSelected && (
                      <Check className='h-4 w-4 flex-shrink-0 text-primary' />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
