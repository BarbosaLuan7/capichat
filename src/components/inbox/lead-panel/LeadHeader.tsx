import { memo } from 'react';
import { Star, UserPlus, Tag, ExternalLink } from 'lucide-react';
import { LeadAvatar } from '@/components/ui/lead-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatPhoneNumber, toWhatsAppFormat } from '@/lib/masks';
import type { LeadWithRelations } from './types';

interface LeadHeaderProps {
  lead: LeadWithRelations;
  isFavorite?: boolean;
  onToggleFavorite: () => void;
  onTransferClick: () => void;
  onLabelsClick: () => void;
}

function LeadHeaderComponent({
  lead,
  isFavorite,
  onToggleFavorite,
  onTransferClick,
  onLabelsClick,
}: LeadHeaderProps) {
  const openWhatsApp = () => {
    window.open(`https://wa.me/${toWhatsAppFormat(lead.phone)}`, '_blank');
  };

  const isPhoneAsName = lead.name?.startsWith('Lead ') && /^Lead \d+$/.test(lead.name);
  const displayName =
    lead.whatsapp_name || (!isPhoneAsName ? lead.name : null) || formatPhoneNumber(lead.phone);

  return (
    <div className="border-b border-border p-4">
      <div className="flex items-start gap-3">
        <div className="relative">
          <LeadAvatar lead={lead} size="lg" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'absolute -right-1 -top-1 h-6 w-6 rounded-full border border-border bg-card',
                    isFavorite && 'text-warning'
                  )}
                  onClick={onToggleFavorite}
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star
                    className={cn('h-3 w-3', isFavorite && 'fill-warning')}
                    aria-hidden="true"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground" title={displayName}>
            {displayName}
          </h3>
          {lead.whatsapp_name && lead.whatsapp_name !== lead.name && !isPhoneAsName && (
            <p className="text-xs text-muted-foreground">WhatsApp: {lead.whatsapp_name}</p>
          )}
          {lead.funnel_stages && (
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: lead.funnel_stages.color,
                  color: lead.funnel_stages.color,
                }}
              >
                {lead.funnel_stages.name}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onTransferClick}>
          <UserPlus className="mr-1 h-3 w-3" />
          Transferir
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onLabelsClick}>
          <Tag className="mr-1 h-3 w-3" />
          Etiquetar
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={openWhatsApp}
                aria-label="Abrir conversa no WhatsApp"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir no WhatsApp</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export const LeadHeader = memo(LeadHeaderComponent);
