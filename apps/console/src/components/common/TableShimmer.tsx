'use client';

interface TableShimmerProps {
  columns: number;
  rows?: number;
}

/**
 * Shimmer loading skeleton for table rows
 * Shows animated placeholder rows while data is being fetched
 */
export default function TableShimmer({ columns, rows = 5 }: TableShimmerProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className='border-b border-border'>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className='px-6 py-4'>
              <div className='animate-pulse'>
                <div
                  className='h-4 bg-gray-200 rounded'
                  style={{
                    width:
                      colIndex === 0
                        ? '60%'
                        : colIndex === columns - 1
                          ? '40%'
                          : '80%',
                  }}
                />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Overlay shimmer for existing content
 * Shows a subtle loading overlay on top of existing data
 */
export function TableLoadingOverlay({
  children,
  isLoading,
}: {
  children: React.ReactNode;
  isLoading: boolean;
}) {
  return (
    <div className='relative'>
      {children}
      {isLoading && (
        <div className='absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10'>
          <div className='flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-border'>
            <div className='h-4 w-4 border-2 border-primarySolid border-t-transparent rounded-full animate-spin' />
            <span className='text-sm text-textSecondary'>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
