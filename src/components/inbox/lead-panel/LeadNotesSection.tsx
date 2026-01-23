import { memo } from 'react';
import { StickyNote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InternalNotes } from '../InternalNotes';
import { useInternalNotes } from '@/hooks/useInternalNotes';

interface LeadNotesSectionProps {
  conversationId: string;
}

function LeadNotesSectionComponent({ conversationId }: LeadNotesSectionProps) {
  const { data: notes } = useInternalNotes(conversationId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-medium">Notas Internas</h3>
        {(notes?.length ?? 0) > 0 && (
          <Badge variant="secondary" className="text-xs">
            {notes?.length}
          </Badge>
        )}
      </div>
      <InternalNotes conversationId={conversationId} />
    </div>
  );
}

export const LeadNotesSection = memo(LeadNotesSectionComponent);
