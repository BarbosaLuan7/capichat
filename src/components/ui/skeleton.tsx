import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// Skeleton for conversation list items
function ConversationSkeleton() {
  return (
    <div className="p-4 flex items-start gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
        <div className="h-3 w-full bg-muted rounded" />
        <div className="flex gap-1.5">
          <div className="h-5 w-16 bg-muted rounded-full" />
          <div className="h-5 w-14 bg-muted rounded-full" />
        </div>
      </div>
    </div>
  )
}

// Skeleton for message bubbles
function MessageSkeleton({ isAgent = false }: { isAgent?: boolean }) {
  return (
    <div className={cn("flex gap-2 animate-pulse", isAgent && "flex-row-reverse")}>
      <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
      <div className={cn(
        "rounded-2xl p-4 max-w-[70%] space-y-2",
        isAgent ? "bg-primary/20" : "bg-muted"
      )}>
        <div className="h-3 w-32 bg-muted-foreground/20 rounded" />
        <div className="h-3 w-48 bg-muted-foreground/20 rounded" />
        <div className="h-2 w-12 bg-muted-foreground/20 rounded" />
      </div>
    </div>
  )
}

// Skeleton for lead details panel - header section
function LeadDetailsPanelSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      {/* Header Skeleton */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-muted" />
            <div className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-muted" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
          </div>
        </div>
        {/* Quick Actions Skeleton */}
        <div className="flex gap-2 mt-3">
          <div className="h-8 flex-1 bg-muted rounded" />
          <div className="h-8 flex-1 bg-muted rounded" />
          <div className="h-8 w-10 bg-muted rounded" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-border px-4 py-2">
        <div className="flex gap-2">
          <div className="h-7 w-14 bg-muted rounded" />
          <div className="h-7 w-14 bg-muted rounded" />
          <div className="h-7 w-10 bg-muted rounded" />
          <div className="h-7 w-16 bg-muted rounded" />
          <div className="h-7 w-14 bg-muted rounded" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 p-4 space-y-4">
        {/* Contact Section */}
        <div className="space-y-2">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="space-y-1.5">
            <div className="h-10 w-full bg-muted rounded-md" />
            <div className="h-10 w-full bg-muted rounded-md" />
          </div>
        </div>

        {/* Labels Section */}
        <div className="space-y-2">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="flex flex-wrap gap-1.5">
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-5 w-20 bg-muted rounded-full" />
            <div className="h-5 w-14 bg-muted rounded-full" />
          </div>
        </div>

        {/* Info Section */}
        <div className="space-y-2">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-14 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-12 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Skeleton, ConversationSkeleton, MessageSkeleton, LeadDetailsPanelSkeleton }
