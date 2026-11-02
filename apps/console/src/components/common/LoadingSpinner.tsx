import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  className?: string;
}

export default function LoadingSpinner({
  className = '',
}: LoadingSpinnerProps) {
  return (
    <Loader2 className={`h-6 w-6 animate-spin text-primary ${className}`} />
  );
}
