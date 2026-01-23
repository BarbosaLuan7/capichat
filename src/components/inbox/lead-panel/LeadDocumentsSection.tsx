import { memo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentChecklist } from '../DocumentChecklist';
import type { LeadWithRelations, Label } from './types';

interface LeadDocumentsSectionProps {
  leadId: string;
  customFields?: LeadWithRelations['custom_fields'];
  labels?: Label[];
  onUpdate: () => void;
}

function LeadDocumentsSectionComponent({
  leadId,
  customFields,
  labels,
  onUpdate,
}: LeadDocumentsSectionProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <DocumentChecklist
          leadId={leadId}
          customFields={customFields}
          labels={labels}
          onUpdate={onUpdate}
        />
      </div>
    </ScrollArea>
  );
}

export const LeadDocumentsSection = memo(LeadDocumentsSectionComponent);
