import React from 'react';
import { Star, PanelRightClose, PanelRightOpen, ArrowLeft, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeadAvatar } from '@/components/ui/lead-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConversationStatusActions } from '@/components/inbox/ConversationStatusActions';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/masks';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ConversationStatus = Database['public']['Enums']['conversation_status'];

interface LeadInfo {
  id: string;
  name: string;
  phone: string;
  avatar_url?: string | null;
  whatsapp_name?: string | null;
}

interface ChatHeaderProps {
  lead: LeadInfo;
  conversationStatus: ConversationStatus;
  isFavorite: boolean;
  showLeadPanel: boolean;
  isMobile: boolean;
  isSyncing: boolean;
  isUpdatingStatus: boolean;
  onBack?: () => void;
  onStatusChange: (status: ConversationStatus) => void;
  onToggleFavorite: () => void;
  onSyncHistory: () => void;
  onToggleLeadPanel: () => void;
}

export function ChatHeader({
  lead,
  conversationStatus,
  isFavorite,
  showLeadPanel,
  isMobile,
  isSyncing,
  isUpdatingStatus,
  onBack,
  onStatusChange,
  onToggleFavorite,
  onSyncHistory,
  onToggleLeadPanel,
}: ChatHeaderProps) {
  const isPhoneAsName = lead.name?.startsWith('Lead ') && /^Lead \d+$/.test(lead.name || '');
  const chatDisplayName =
    lead.whatsapp_name || (!isPhoneAsName ? lead.name : null) || formatPhoneNumber(lead.phone);

  return (
    <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-4">
      {/* Mobile back button */}
      {isMobile && onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0"
          aria-label="Voltar para lista de conversas"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <LeadAvatar lead={lead} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{chatDisplayName}</p>
          <div className="flex items-center gap-1">
            <p className="truncate text-xs text-muted-foreground">
              {formatPhoneNumber(lead.phone)}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(formatPhoneNumber(lead.phone));
                toast.success('Telefone copiado!', { duration: 1500 });
              }}
              aria-label="Copiar telefone"
            >
              <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ConversationStatusActions
          currentStatus={conversationStatus}
          onStatusChange={onStatusChange}
          isLoading={isUpdatingStatus}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star className={cn('h-4 w-4', isFavorite && 'fill-warning text-warning')} />
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSyncHistory}
                disabled={isSyncing}
                aria-label={isSyncing ? 'Sincronizando...' : 'Sincronizar historico do WhatsApp'}
                aria-busy={isSyncing}
              >
                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isSyncing ? 'Sincronizando...' : 'Sincronizar historico do WhatsApp'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant={showLeadPanel ? 'secondary' : 'ghost'}
          size="icon"
          onClick={onToggleLeadPanel}
          aria-label={showLeadPanel ? 'Ocultar detalhes do lead' : 'Mostrar detalhes do lead'}
          className={cn(
            'transition-colors',
            !showLeadPanel && 'text-primary hover:bg-primary/10 hover:text-primary'
          )}
        >
          {showLeadPanel ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
