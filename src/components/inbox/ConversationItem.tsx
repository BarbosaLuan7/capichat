import React, { memo } from 'react';
import { Star, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, getContrastTextColor } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { format, isSameDay, isYesterday } from 'date-fns';
import { LeadAvatar } from '@/components/ui/lead-avatar';
import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number?: string | null;
}

interface ConversationLead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  temperature?: string;
  avatar_url?: string | null;
  whatsapp_name?: string | null;
  benefit_type?: string | null;
  lead_labels?: Array<{
    labels?: {
      id: string;
      name: string;
      color: string;
      category?: string;
    };
  }>;
}

interface ConversationData {
  id: string;
  status: ConversationStatus;
  last_message_at: string;
  last_message_content?: string | null;
  unread_count: number;
  is_favorite?: boolean | null;
  leads?: ConversationLead;
  whatsapp_instance_id?: string | null;
  whatsapp_config?: WhatsAppInstance | null;
}

interface ConversationItemProps {
  conversation: ConversationData;
  isSelected: boolean;
  onClick: () => void;
}

// Remove unreplaced template placeholders from preview text
const sanitizePreviewContent = (content: string | null | undefined): string => {
  if (!content) return '';
  return content
    .replace(/\{\{[^}]+\}\}/g, '') // Remove {{variable}}
    .replace(/\{[^}]+\}/g, '') // Remove {variable}
    .replace(/\[[^\]]+\]/g, '') // Remove [variable]
    .trim();
};

// Format conversation date - always show time, with date prefix for older messages
const formatConversationDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();

    if (isSameDay(date, now)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return `ontem ${format(date, 'HH:mm')}`;
    }
    return format(date, 'dd/MM HH:mm');
  } catch {
    return '';
  }
};

function ConversationItemComponent({ conversation, isSelected, onClick }: ConversationItemProps) {
  const convLead = conversation.leads;
  const isFavorite = conversation.is_favorite;
  const whatsappInstance = conversation.whatsapp_config;

  // Determinar melhor nome para exibição (com null checks seguros)
  const leadName = convLead?.name || '';
  const isPhoneAsName = leadName.startsWith('Lead ') && /^Lead \d+$/.test(leadName);
  const displayName =
    convLead?.whatsapp_name ||
    (!isPhoneAsName ? leadName : null) ||
    formatPhoneNumber(convLead?.phone || '');

  // Nome curto da instância WhatsApp (últimos 4 dígitos do telefone ou nome)
  const instanceLabel = whatsappInstance?.phone_number
    ? whatsappInstance.phone_number.slice(-4)
    : whatsappInstance?.name?.slice(0, 8);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Conversa com ${displayName}${conversation.unread_count > 0 ? `, ${conversation.unread_count} mensagens não lidas` : ''}`}
      className={cn(
        'cursor-pointer select-none border-l-4 border-l-transparent px-3 py-2 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-l-primary bg-primary/10'
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <LeadAvatar
          lead={{
            id: convLead?.id || '',
            name: convLead?.name || '',
            phone: convLead?.phone,
            avatar_url: convLead?.avatar_url,
          }}
          size="md"
          className="shrink-0"
        />

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Row 1: Name + Timestamp */}
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 max-w-[65%] items-center gap-2">
              {isFavorite && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
              <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {/* WhatsApp Instance Badge */}
              {instanceLabel && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-2xs inline-flex items-center gap-0.5 rounded border border-success/20 bg-success/10 px-1 py-0.5 text-success">
                        <Phone className="h-2.5 w-2.5" />
                        {instanceLabel}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {whatsappInstance?.name || 'Instância WhatsApp'}:{' '}
                      {whatsappInstance?.phone_number || 'N/A'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="text-xs text-muted-foreground">
                {formatConversationDate(conversation.last_message_at)}
              </span>
            </div>
          </div>

          {/* Row 2: Last message + Unread/Hot indicators */}
          <div className="flex items-center justify-between gap-2">
            <p className="flex-1 truncate text-sm text-muted-foreground">
              {sanitizePreviewContent(conversation.last_message_content) ||
                formatPhoneNumber(convLead?.phone || '')}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {convLead?.temperature === 'hot' && <span className="text-sm">🔥</span>}
              {conversation.unread_count > 0 && (
                <span className="flex h-5 w-5 min-w-[20px] items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                  {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                </span>
              )}
            </div>
          </div>

          {/* Row 2.5: Benefit type badge */}
          {convLead?.benefit_type && (
            <div className="mt-0.5">
              <span className="text-2xs rounded border border-success/20 bg-success/10 px-1.5 py-0.5 uppercase tracking-wider text-success">
                {convLead.benefit_type}
              </span>
            </div>
          )}

          {/* Row 3: Labels - só renderiza se houver labels */}
          {convLead?.lead_labels && convLead.lead_labels.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              {convLead.lead_labels.length === 1 ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        className={cn(
                          'text-2xs h-5 max-w-[140px] cursor-default truncate border-0 px-2 py-0',
                          getContrastTextColor(convLead.lead_labels[0]?.labels?.color || '')
                        )}
                        style={{
                          backgroundColor: convLead.lead_labels[0]?.labels?.color,
                        }}
                      >
                        {convLead.lead_labels[0]?.labels?.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{convLead.lead_labels[0]?.labels?.name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>
                  {convLead.lead_labels.slice(0, 1).map((ll) => (
                    <TooltipProvider key={ll.labels?.id} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            className={cn(
                              'text-2xs h-5 max-w-[80px] cursor-default truncate border-0 px-2 py-0',
                              getContrastTextColor(ll.labels?.color || '')
                            )}
                            style={{
                              backgroundColor: ll.labels?.color,
                            }}
                          >
                            {ll.labels?.name}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{ll.labels?.name}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                  {convLead.lead_labels.length > 1 && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="text-2xs h-5 cursor-default px-1 py-0"
                          >
                            +{convLead.lead_labels.length - 1}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {convLead.lead_labels
                            .slice(1)
                            .map((ll) => ll.labels?.name)
                            .join(', ')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to compare labels by their IDs, not just length
const areLabelsEqual = (
  prevLabels: ConversationLead['lead_labels'],
  nextLabels: ConversationLead['lead_labels']
): boolean => {
  const prev = prevLabels || [];
  const next = nextLabels || [];

  if (prev.length !== next.length) return false;

  // Compare sorted label IDs to detect changes even when count is same
  const prevIds = prev
    .map((ll) => ll.labels?.id)
    .filter(Boolean)
    .sort()
    .join(',');
  const nextIds = next
    .map((ll) => ll.labels?.id)
    .filter(Boolean)
    .sort()
    .join(',');

  return prevIds === nextIds;
};

// Memoize with custom comparison function
export const ConversationItem = memo(ConversationItemComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.status === nextProps.conversation.status &&
    prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
    prevProps.conversation.last_message_at === nextProps.conversation.last_message_at &&
    prevProps.conversation.last_message_content === nextProps.conversation.last_message_content &&
    prevProps.conversation.is_favorite === nextProps.conversation.is_favorite &&
    prevProps.conversation.whatsapp_instance_id === nextProps.conversation.whatsapp_instance_id &&
    prevProps.conversation.leads?.temperature === nextProps.conversation.leads?.temperature &&
    prevProps.conversation.leads?.benefit_type === nextProps.conversation.leads?.benefit_type &&
    prevProps.conversation.leads?.whatsapp_name === nextProps.conversation.leads?.whatsapp_name &&
    prevProps.conversation.leads?.avatar_url === nextProps.conversation.leads?.avatar_url &&
    areLabelsEqual(
      prevProps.conversation.leads?.lead_labels,
      nextProps.conversation.leads?.lead_labels
    )
  );
});
