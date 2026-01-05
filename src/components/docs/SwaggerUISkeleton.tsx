import { Skeleton } from '@/components/ui/skeleton';

export function SwaggerUISkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Info section skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Authorization section skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>

      {/* Endpoints section skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64 ml-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Models section skeleton */}
      <div className="space-y-2 mt-8">
        <Skeleton className="h-6 w-24" />
        <div className="border rounded-lg p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </div>
  );
}
