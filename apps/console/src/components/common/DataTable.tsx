'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  pageSize?: number;
}

export default function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  actions,
  pageSize = 10,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof T | string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = data.slice(startIndex, endIndex);

  const handleSort = (column: keyof T | string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getValue = (item: T, key: keyof T | string): any => {
    if (typeof key === 'string' && key.includes('.')) {
      const keys = key.split('.');
      let value: any = item;
      for (const k of keys) {
        value = value?.[k];
      }
      return value;
    }
    return item[key as keyof T];
  };

  return (
    <div className='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
      <div className='overflow-x-auto'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope='col'
                  className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className='flex items-center space-x-1'>
                    <span>{column.header}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span>
                        {sortDirection === 'asc' ? (
                          <ChevronUp className='h-4 w-4' />
                        ) : (
                          <ChevronDown className='h-4 w-4' />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && <th scope='col' className='relative px-6 py-3'></th>}
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 bg-white'>
            {currentData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className='px-6 py-8 text-center'
                >
                  <p className='text-sm text-gray-500'>No data available</p>
                </td>
              </tr>
            ) : (
              currentData.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className='whitespace-nowrap px-6 py-4 text-sm'
                    >
                      {column.render
                        ? column.render(item)
                        : String(getValue(item, column.key) ?? '')}
                    </td>
                  ))}
                  {actions && (
                    <td className='relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium'>
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className='flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3'>
          <div className='flex items-center space-x-2'>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className='rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              aria-label='Previous page'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>
            <span className='text-sm text-gray-700'>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className='rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              aria-label='Next page'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
          <div className='text-sm text-gray-700'>
            Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of{' '}
            {data.length} results
          </div>
        </div>
      )}
    </div>
  );
}
