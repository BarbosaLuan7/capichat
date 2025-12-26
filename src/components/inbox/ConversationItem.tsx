import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { format, isSameDay, isYesterday, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

interface ConversationLead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  temperature?: string;
  avatar_url?: string | null;
  whatsapp_name?: string | null;
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
}

interface ConversationItemProps {
  conversation: ConversationData;
  isSelected: boolean;
  onClick: () => void;
}

// Format conversation date intelligently
const formatConversationDate = (date: Date): string => {
  const now = new Date();
  const diffMins = differenceInMinutes(now, date);
  const diffHours = differenceInHours(now, date);
  const diffDays = differenceInDays(now, date);
  
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (isSameDay(date, now)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'ontem';
  if (diffDays < 7) return format(date, 'EEEE', { locale: ptBR });
  return format(date, 'dd/MM');
};

function ConversationItemComponent({ conversation, isSelected, onClick }: ConversationItemProps) {
  const convLead = conversation.leads;
  const isFavorite = conversation.is_favorite;
  
  // Determinar melhor nome para exibição
  const isPhoneAsName = convLead?.name?.startsWith('Lead ') && /^Lead \d+$/.test(convLead?.name);
  const displayName = convLead?.whatsapp_name || (!isPhoneAsName ? convLead?.name : null) || formatPhoneNumber(convLead?.phone || '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className={cn(
        'px-3 py-3 cursor-pointer transition-colors hover:bg-muted/50',
        isSelected && 'bg-[#EDE9FE] border-l-[3px] border-l-[#7C3AED]'
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="w-12 h-12 shrink-0">
          <AvatarImage src={convLead?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${convLead?.name}`} />
          <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Row 1: Name + Timestamp */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
              {isFavorite && <Star className="w-3 h-3 fill-warning text-warning shrink-0" />}
              <span className="font-semibold text-foreground truncate text-[15px]">
                {displayName}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="text-xs text-muted-foreground">
                {formatConversationDate(new Date(conversation.last_message_at))}
              </span>
            </div>
          </div>

          {/* Row 2: Last message + Unread/Hot indicators */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground truncate flex-1">
              {conversation.last_message_content || formatPhoneNumber(convLead?.phone || '')}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {convLead?.temperature === 'hot' && (
                <span className="text-sm">🔥</span>
              )}
              {conversation.unread_count > 0 && (
                <span className="min-w-[20px] h-5 w-5 bg-[#EF4444] text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                </span>
              )}
            </div>
          </div>

          {/* Row 3: Status badge + Labels */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-5',
                conversation.status === 'open' && 'border-success text-success',
                conversation.status === 'pending' && 'border-warning text-warning',
                conversation.status === 'resolved' && 'border-muted-foreground text-muted-foreground'
              )}
            >
              {conversation.status === 'open' ? 'Aberta' : conversation.status === 'pending' ? 'Pendente' : 'Resolvida'}
            </Badge>
            {convLead?.lead_labels?.length === 1 ? (
              <Badge
                className="text-[10px] px-1.5 py-0 h-5 border-0 max-w-[140px] truncate"
                style={{
                  backgroundColor: convLead.lead_labels[0]?.labels?.color,
                  color: 'white',
                }}
                title={convLead.lead_labels[0]?.labels?.name}
              >
                {convLead.lead_labels[0]?.labels?.name}
              </Badge>
            ) : (
              <>
                {convLead?.lead_labels?.slice(0, 1).map((ll) => (
                  <Badge
                    key={ll.labels?.id}
                    className="text-[10px] px-1.5 py-0 h-5 border-0 max-w-[80px] truncate"
                    style={{
                      backgroundColor: ll.labels?.color,
                      color: 'white',
                    }}
                    title={ll.labels?.name}
                  >
                    {ll.labels?.name}
                  </Badge>
                ))}
                {convLead?.lead_labels && convLead.lead_labels.length > 1 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                    +{convLead.lead_labels.length - 1}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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
    prevProps.conversation.leads?.temperature === nextProps.conversation.leads?.temperature &&
    prevProps.conversation.leads?.lead_labels?.length === nextProps.conversation.leads?.lead_labels?.length
  );
});
