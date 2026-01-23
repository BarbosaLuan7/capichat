import { useState, memo } from 'react';
import { User, ClipboardList, Brain, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { TransferLeadModal } from '../TransferLeadModal';
import { LeadLabelsModal } from '../LeadLabelsModal';
import { useInternalNotes } from '@/hooks/useInternalNotes';
import { getDocumentsByBenefitType, type BenefitType } from '@/lib/documentChecklist';

import { LeadHeader } from './LeadHeader';
import { LeadInfoSection } from './LeadInfoSection';
import { LeadLabelsSection } from './LeadLabelsSection';
import { LeadTimelineSection } from './LeadTimelineSection';
import { LeadNotesSection } from './LeadNotesSection';
import { LeadDocumentsSection } from './LeadDocumentsSection';
import { LeadAISection } from './LeadAISection';
import type { LeadDetailsPanelProps, LeadWithRelations } from './types';

function LeadDetailsPanelComponent({
  lead,
  conversationId,
  messages,
  isFavorite,
  onToggleFavorite,
  onTransfer,
  onLabelsUpdate,
}: LeadDetailsPanelProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);

  const { data: notes } = useInternalNotes(conversationId);
  const labelIds = lead.labels?.map((l) => l.id) || [];

  // Calculate pending documents count for badge
  const getPendingDocsCount = () => {
    const checklistState = lead.custom_fields?.documentChecklist;
    if (!checklistState?.benefitType) return null;

    const benefit = getDocumentsByBenefitType(checklistState.benefitType as BenefitType);
    if (!benefit) return null;

    const total = benefit.documents.length;
    const checked = checklistState.checkedDocuments?.length || 0;
    return total - checked;
  };

  const pendingDocs = getPendingDocsCount();

  return (
    <>
      <div className="flex h-full w-full min-w-[320px] max-w-full flex-col overflow-hidden">
        {/* Lead Header */}
        <LeadHeader
          lead={lead}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          onTransferClick={() => setShowTransferModal(true)}
          onLabelsClick={() => setShowLabelsModal(true)}
        />

        {/* Tabs */}
        <Tabs
          defaultValue="dados"
          className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden"
        >
          <TabsList className="w-full shrink-0 justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger value="dados" className="gap-1 text-xs data-[state=active]:bg-muted">
              <User className="h-3 w-3" />
              Dados
            </TabsTrigger>
            <TabsTrigger
              value="docs"
              className="relative gap-1 text-xs data-[state=active]:bg-muted"
            >
              <ClipboardList className="h-3 w-3" />
              Docs
              {pendingDocs && pendingDocs > 0 && (
                <Badge variant="destructive" className="text-2xs ml-1 h-4 px-1">
                  {pendingDocs}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-1 text-xs data-[state=active]:bg-muted">
              <Brain className="h-3 w-3" />
              IA
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1 text-xs data-[state=active]:bg-muted">
              <History className="h-3 w-3" />
              Historico
              {(notes?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="text-2xs ml-1 h-4 px-1">
                  {notes?.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent
            value="dados"
            className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <ScrollArea className="min-h-0 w-full max-w-full flex-1 [&_[data-radix-scroll-area-viewport]]:max-w-full [&_[data-radix-scroll-area-viewport]]:!overflow-x-hidden">
              <LeadLabelsSection labels={lead.labels} />
              <LeadInfoSection lead={lead} />
            </ScrollArea>
          </TabsContent>

          {/* Docs Tab */}
          <TabsContent
            value="docs"
            className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <LeadDocumentsSection
              leadId={lead.id}
              customFields={lead.custom_fields}
              labels={lead.labels}
              onUpdate={onLabelsUpdate}
            />
          </TabsContent>

          {/* IA Tab */}
          <TabsContent
            value="ia"
            className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <LeadAISection lead={lead} messages={messages || []} onUpdate={onLabelsUpdate} />
          </TabsContent>

          {/* Historico Tab */}
          <TabsContent
            value="historico"
            className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-6 p-4">
                <LeadNotesSection conversationId={conversationId} />
                <Separator />
                <LeadTimelineSection lead={lead} />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <TransferLeadModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        onTransfer={onTransfer}
        currentAssignee={lead.assigned_to || undefined}
      />

      <LeadLabelsModal
        open={showLabelsModal}
        onOpenChange={(open) => {
          setShowLabelsModal(open);
          if (!open) onLabelsUpdate();
        }}
        leadId={lead.id}
        currentLabelIds={labelIds}
      />
    </>
  );
}

// Memoize with custom comparison to avoid unnecessary re-renders
export const LeadDetailsPanel = memo(LeadDetailsPanelComponent, (prevProps, nextProps) => {
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.updated_at === nextProps.lead.updated_at &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.conversationId === nextProps.conversationId &&
    JSON.stringify(prevProps.lead.labels) === JSON.stringify(nextProps.lead.labels)
  );
});

// Re-export types for consumers
export type { LeadDetailsPanelProps, LeadWithRelations } from './types';
