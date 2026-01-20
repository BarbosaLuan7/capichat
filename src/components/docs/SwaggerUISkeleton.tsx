import { Skeleton } from '@/components/ui/skeleton';

export function SwaggerUISkeleton() {
  return (
    <div className="space-y-6 p-6 duration-300 animate-in fade-in">
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
          <div key={i} className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-64" />
            </div>
          </div>
        ))}
      </div>

      {/* Models section skeleton */}
      <div className="mt-8 space-y-2">
        <Skeleton className="h-6 w-24" />
        <div className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </div>
  );
}
