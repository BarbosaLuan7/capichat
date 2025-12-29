import React from 'react';
import { X, CornerUpLeft, Image, Mic, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReplyMessage {
  id: string;
  external_id?: string | null;
  content: string;
  sender_type: 'lead' | 'agent';
  type?: string;
}

interface ReplyPreviewProps {
  message: ReplyMessage;
  leadName: string;
  agentName?: string;
  onCancel: () => void;
}

export function ReplyPreview({ message, leadName, agentName = 'Você', onCancel }: ReplyPreviewProps) {
  const senderName = message.sender_type === 'lead' ? leadName : agentName;
  
  // Truncar conteúdo
  const truncatedContent = message.content.length > 50 
    ? message.content.substring(0, 50) + '...' 
    : message.content;
  
  // Ícone baseado no tipo
  const getTypeIcon = () => {
    switch (message.type) {
      case 'image':
        return <Image className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'audio':
        return <Mic className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'video':
        return <Video className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'document':
        return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-2 bg-muted/50 border-t border-border">
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-primary">
          <CornerUpLeft className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0 border-l-2 border-primary/50 pl-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
            {getTypeIcon()}
            <span>Respondendo a {senderName}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {truncatedContent}
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCancel}
          aria-label="Cancelar resposta"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}