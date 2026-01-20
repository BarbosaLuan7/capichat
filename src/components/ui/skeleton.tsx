import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

// Skeleton for conversation list items
function ConversationSkeleton() {
  return (
    <div className="flex animate-pulse items-start gap-3 p-4">
      <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-12 rounded bg-muted" />
        </div>
        <div className="h-3 w-full rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-14 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

// Skeleton for message bubbles
function MessageSkeleton({ isAgent = false }: { isAgent?: boolean }) {
  return (
    <div className={cn('flex animate-pulse gap-2', isAgent && 'flex-row-reverse')}>
      <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
      <div
        className={cn(
          'max-w-[70%] space-y-2 rounded-2xl p-4',
          isAgent ? 'bg-primary/20' : 'bg-muted'
        )}
      >
        <div className="h-3 w-32 rounded bg-muted-foreground/20" />
        <div className="h-3 w-48 rounded bg-muted-foreground/20" />
        <div className="h-2 w-12 rounded bg-muted-foreground/20" />
      </div>
    </div>
  );
}

// Skeleton for lead details panel - header section
function LeadDetailsPanelSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col">
      {/* Header Skeleton */}
      <div className="border-b border-border p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="h-14 w-14 rounded-full bg-muted" />
            <div className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-muted" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
          </div>
        </div>
        {/* Quick Actions Skeleton */}
        <div className="mt-3 flex gap-2">
          <div className="h-8 flex-1 rounded bg-muted" />
          <div className="h-8 flex-1 rounded bg-muted" />
          <div className="h-8 w-10 rounded bg-muted" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-border px-4 py-2">
        <div className="flex gap-2">
          <div className="h-7 w-14 rounded bg-muted" />
          <div className="h-7 w-14 rounded bg-muted" />
          <div className="h-7 w-10 rounded bg-muted" />
          <div className="h-7 w-16 rounded bg-muted" />
          <div className="h-7 w-14 rounded bg-muted" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 space-y-4 p-4">
        {/* Contact Section */}
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-10 w-full rounded-md bg-muted" />
            <div className="h-10 w-full rounded-md bg-muted" />
          </div>
        </div>

        {/* Labels Section */}
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="flex flex-wrap gap-2">
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
            <div className="h-5 w-14 rounded-full bg-muted" />
          </div>
        </div>

        {/* Info Section */}
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-14 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-12 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton for chat area
function ChatAreaSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 animate-pulse flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-8 rounded bg-muted" />
          <div className="h-8 w-8 rounded bg-muted" />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 space-y-4 p-4">
        <MessageSkeleton isAgent={false} />
        <MessageSkeleton isAgent={true} />
        <MessageSkeleton isAgent={false} />
        <MessageSkeleton isAgent={true} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="h-12 w-full rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  ConversationSkeleton,
  MessageSkeleton,
  LeadDetailsPanelSkeleton,
  ChatAreaSkeleton,
};
