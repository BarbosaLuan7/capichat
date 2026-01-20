import React from 'react';
import { cn } from '@/lib/utils';
import { Image, Mic, Video, FileText } from 'lucide-react';

interface QuotedMessageData {
  id: string;
  body: string;
  from: string;
  type?: string;
}

interface QuotedMessageProps {
  quote: QuotedMessageData;
  isAgentMessage: boolean;
  leadName?: string;
  agentName?: string;
}

export function QuotedMessage({ quote, isAgentMessage, leadName, agentName }: QuotedMessageProps) {
  // Usar o nome que veio do banco (já está correto no quoted_message.from)
  // Fallback: Se quote.from for um número de telefone, usar leadName
  const isPhoneNumber = /^\d+@/.test(quote.from || '');
  const senderName = isPhoneNumber ? leadName || 'Lead' : quote.from || 'Desconhecido';

  // Truncar texto longo
  const truncatedBody = quote.body.length > 80 ? quote.body.substring(0, 80) + '...' : quote.body;

  // Ícone baseado no tipo
  const getTypeIcon = () => {
    switch (quote.type) {
      case 'image':
        return <Image className="h-3 w-3 shrink-0" />;
      case 'audio':
        return <Mic className="h-3 w-3 shrink-0" />;
      case 'video':
        return <Video className="h-3 w-3 shrink-0" />;
      case 'document':
        return <FileText className="h-3 w-3 shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'mb-2 rounded-lg border-l-4 px-3 py-2 text-xs',
        isAgentMessage
          ? 'border-l-primary-foreground/50 bg-primary-foreground/10'
          : 'border-l-primary/50 bg-muted/80'
      )}
    >
      <div
        className={cn(
          'mb-0.5 flex items-center gap-1 font-semibold',
          isAgentMessage ? 'text-primary-foreground/80' : 'text-foreground/80'
        )}
      >
        {getTypeIcon()}
        <span>{senderName}</span>
      </div>
      <p
        className={cn(
          'line-clamp-2 italic',
          isAgentMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}
      >
        {truncatedBody}
      </p>
    </div>
  );
}
