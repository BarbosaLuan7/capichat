import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Star, Image, FileText, Video, Mic, Sparkles, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'] & {
  is_starred?: boolean;
};

interface MessageBubbleProps {
  message: Message;
  isAgent: boolean;
  showAvatar: boolean;
  leadName: string;
  agentName?: string;
  onToggleStar?: (messageId: string, isStarred: boolean) => void;
}

export function MessageBubble({
  message,
  isAgent,
  showAvatar,
  leadName,
  agentName = 'Agente',
  onToggleStar,
}: MessageBubbleProps) {
  const { transcribeAudio, getTranscription, isLoading } = useAudioTranscription();
  const [transcription, setTranscription] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  // Auto-transcribe audio messages from leads
  useEffect(() => {
    if (message.type === 'audio' && message.media_url && !isAgent && !hasAttempted) {
      const cached = getTranscription(message.id);
      if (cached) {
        setTranscription(cached);
      } else {
        setHasAttempted(true);
        transcribeAudio(message.id, message.media_url).then((text) => {
          if (text) setTranscription(text);
        });
      }
    }
  }, [message.id, message.type, message.media_url, isAgent, hasAttempted, transcribeAudio, getTranscription]);

  const renderMedia = () => {
    if (!message.media_url) return null;

    switch (message.type) {
      case 'image':
        return (
          <div className="mb-2">
            <img
              src={message.media_url}
              alt="Imagem"
              className="max-w-full rounded-lg max-h-64 object-cover"
            />
          </div>
        );
      case 'video':
        return (
          <div className="mb-2">
            <video
              src={message.media_url}
              controls
              className="max-w-full rounded-lg max-h-64"
            />
          </div>
        );
      case 'audio':
        return (
          <div className="mb-2 space-y-2">
            <audio src={message.media_url} controls className="w-full" />
            
            {/* Transcription section */}
            {!isAgent && (
              <div className="text-xs">
                {isLoading(message.id) && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Transcrevendo...</span>
                  </div>
                )}
                
                {transcription && (
                  <div className="p-2 rounded-md bg-background/50 border border-border/50">
                    <div className="flex items-center gap-1 text-primary/70 mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span className="font-medium">Transcrição:</span>
                    </div>
                    <p className="text-foreground/80 italic">"{transcription}"</p>
                  </div>
                )}
                
                {!isLoading(message.id) && !transcription && hasAttempted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      transcribeAudio(message.id, message.media_url!).then((text) => {
                        if (text) setTranscription(text);
                      });
                    }}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Transcrever áudio
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      case 'document':
        return (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-background/50 rounded-lg mb-2 hover:bg-background/80 transition-colors"
          >
            <FileText className="w-5 h-5" />
            <span className="text-sm underline">Documento</span>
          </a>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = () => {
    switch (message.type) {
      case 'image':
        return <Image className="w-3 h-3" />;
      case 'video':
        return <Video className="w-3 h-3" />;
      case 'audio':
        return <Mic className="w-3 h-3" />;
      case 'document':
        return <FileText className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2 group', isAgent && 'flex-row-reverse')}
    >
      {showAvatar ? (
        <Avatar className="w-8 h-8">
          <AvatarImage
            src={
              isAgent
                ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentName}`
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${leadName}`
            }
          />
          <AvatarFallback>
            {isAgent ? agentName.charAt(0) : leadName.charAt(0)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8" />
      )}

      <div className="relative max-w-[70%]">
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isAgent
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm'
          )}
        >
          {renderMedia()}
          
          {message.content && message.content !== '[Áudio]' && message.content !== '[audio]' && (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
          
          <div className={cn('flex items-center gap-1 mt-1', isAgent && 'justify-end')}>
            {getTypeIcon()}
            <span
              className={cn(
                'text-xs',
                isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
            </span>
            {isAgent && (
              <span className={message.status === 'read' ? 'text-blue-400' : 'text-primary-foreground/70'}>
                {message.status === 'read' ? (
                  <CheckCheck className="w-3.5 h-3.5" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>
        </div>

        {onToggleStar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6',
              message.is_starred && 'opacity-100'
            )}
            onClick={() => onToggleStar(message.id, !message.is_starred)}
          >
            <Star
              className={cn(
                'w-4 h-4',
                message.is_starred
                  ? 'fill-warning text-warning'
                  : 'text-muted-foreground'
              )}
            />
          </Button>
        )}
      </div>
    </motion.div>
  );
}