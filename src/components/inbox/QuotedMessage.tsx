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
  // Determinar quem enviou a mensagem citada baseado no 'from'
  // Se from começa com número, é do lead. Se não, pode ser do agente
  const isQuoteFromLead = /^\d/.test(quote.from || '');
  const senderName = isQuoteFromLead ? (leadName || 'Lead') : (agentName || 'Agente');
  
  // Truncar texto longo
  const truncatedBody = quote.body.length > 80 
    ? quote.body.substring(0, 80) + '...' 
    : quote.body;
  
  // Ícone baseado no tipo
  const getTypeIcon = () => {
    switch (quote.type) {
      case 'image':
        return <Image className="w-3 h-3 shrink-0" />;
      case 'audio':
        return <Mic className="w-3 h-3 shrink-0" />;
      case 'video':
        return <Video className="w-3 h-3 shrink-0" />;
      case 'document':
        return <FileText className="w-3 h-3 shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "mb-2 rounded-lg px-3 py-2 border-l-4 text-xs",
        isAgentMessage
          ? "bg-primary-foreground/10 border-l-primary-foreground/50"
          : "bg-muted/80 border-l-primary/50"
      )}
    >
      <div className={cn(
        "font-semibold mb-0.5 flex items-center gap-1",
        isAgentMessage ? "text-primary-foreground/80" : "text-foreground/80"
      )}>
        {getTypeIcon()}
        <span>{senderName}</span>
      </div>
      <p className={cn(
        "line-clamp-2 italic",
        isAgentMessage ? "text-primary-foreground/70" : "text-muted-foreground"
      )}>
        {truncatedBody}
      </p>
    </div>
  );
}