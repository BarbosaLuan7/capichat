import React, { memo, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LeadWithRelations } from './types';

// Lazy loaded AI components - loaded only when IA tab is active
const AIClassificationSuggestion = React.lazy(() =>
  import('../AIClassificationSuggestion').then((m) => ({ default: m.AIClassificationSuggestion }))
);
const AIConversationSummary = React.lazy(() =>
  import('../AIConversationSummary').then((m) => ({ default: m.AIConversationSummary }))
);

interface LeadAISectionProps {
  lead: LeadWithRelations;
  messages: any[];
  onUpdate: () => void;
}

function LeadAISectionComponent({ lead, messages, onUpdate }: LeadAISectionProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          {/* AI Summary */}
          <AIConversationSummary messages={messages} lead={lead} onSummaryGenerated={onUpdate} />

          {/* AI Classification */}
          <AIClassificationSuggestion
            messages={messages}
            lead={lead}
            onApplyClassification={onUpdate}
          />
        </Suspense>
      </div>
    </ScrollArea>
  );
}

export const LeadAISection = memo(LeadAISectionComponent);
