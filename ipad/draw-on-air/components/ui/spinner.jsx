import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function Spinner({ className, size = 'default' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2
      className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)}
    />
  );
}

export function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse-soft">{message}</p>
    </div>
  );
}

export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3">
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
