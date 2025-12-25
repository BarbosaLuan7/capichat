import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Star, Image, FileText, Video, Mic, Sparkles, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { AudioPlayer } from '@/components/inbox/AudioPlayer';
import { ImageLightbox } from '@/components/inbox/ImageLightbox';
import { DocumentPreview } from '@/components/inbox/DocumentPreview';
import type { Database } from '@/integrations/supabase/types';

// Placeholder texts to filter out from message content display
const MEDIA_PLACEHOLDERS = [
  '[Áudio]', '[audio]', '[Audio]',
  '[Imagem]', '[imagem]', '[Image]', '[image]',
  '[Video]', '[video]', '[Vídeo]', '[vídeo]',
  '[Documento]', '[documento]', '[Document]', '[document]',
];

type Message = Database['public']['Tables']['messages']['Row'] & {
  is_starred?: boolean;
};

interface MessageBubbleProps {
  message: Message;
  isAgent: boolean;
  showAvatar: boolean;
  leadName: string;
  leadAvatarUrl?: string | null;
  agentName?: string;
  onToggleStar?: (messageId: string, isStarred: boolean) => void;
}

export function MessageBubble({
  message,
  isAgent,
  showAvatar,
  leadName,
  leadAvatarUrl,
  agentName = 'Agente',
  onToggleStar,
}: MessageBubbleProps) {
  const { transcribeAudio, getTranscription, isLoading } = useAudioTranscription();
  const [transcription, setTranscription] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Usar signed URL para mídias em buckets privados
  const { signedUrl: resolvedMediaUrl, isLoading: isLoadingUrl } = useSignedUrl(message.media_url);

  const handleCopyTranscription = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      setCopied(true);
      toast.success('Transcrição copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Auto-transcribe audio messages from leads
  useEffect(() => {
    if (message.type === 'audio' && resolvedMediaUrl && !isAgent && !hasAttempted) {
      const cached = getTranscription(message.id);
      if (cached) {
        setTranscription(cached);
      } else {
        setHasAttempted(true);
        transcribeAudio(message.id, resolvedMediaUrl).then((text) => {
          if (text) setTranscription(text);
        });
      }
    }
  }, [message.id, message.type, resolvedMediaUrl, isAgent, hasAttempted, transcribeAudio, getTranscription]);

  const renderMedia = () => {
    if (!message.media_url) return null;
    
    // Mostrar loading enquanto resolve a URL
    if (isLoadingUrl) {
      return (
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando mídia...</span>
        </div>
      );
    }
    
    if (!resolvedMediaUrl) return null;

    // Helper to extract filename from content or URL
    const getFileName = (): string => {
      // If content looks like a filename (has file extension)
      if (message.content && /\.\w{2,5}$/.test(message.content) && !MEDIA_PLACEHOLDERS.includes(message.content)) {
        return message.content;
      }
      // Fallback: extract from URL path
      if (message.media_url) {
        const urlPath = message.media_url.split('/').pop()?.split('?')[0];
        if (urlPath && /\.\w{2,5}$/.test(urlPath)) {
          return urlPath;
        }
      }
      return 'Documento';
    };

    switch (message.type) {
      case 'image':
        return (
          <div className="mb-2">
            <ImageLightbox src={resolvedMediaUrl} alt="Imagem da conversa">
              <img
                src={resolvedMediaUrl}
                alt="Imagem"
                className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:brightness-95 transition-all"
                onError={(e) => {
                  console.error('[MessageBubble] Erro ao carregar imagem:', message.media_url);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </ImageLightbox>
          </div>
        );
      case 'video':
        return (
          <div className="mb-2">
            <video
              src={resolvedMediaUrl}
              controls
              className="max-w-full rounded-lg max-h-64"
            />
          </div>
        );
      case 'audio':
        return (
          <div className="mb-2 space-y-2">
            <AudioPlayer src={resolvedMediaUrl} />
            
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
                  <div className="p-2 rounded-md bg-gray-100 dark:bg-gray-800">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1 text-primary/70">
                        <Sparkles className="w-3 h-3" />
                        <span className="font-medium text-xs">Transcrição:</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleCopyTranscription}
                      >
                        {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="text-foreground/80 italic text-xs">"{transcription}"</p>
                  </div>
                )}
                
                {!isLoading(message.id) && !transcription && hasAttempted && (
                  <button
                    className="text-[#3B82F6] hover:text-[#2563EB] text-xs underline"
                    onClick={() => {
                      if (resolvedMediaUrl) {
                        transcribeAudio(message.id, resolvedMediaUrl).then((text) => {
                          if (text) setTranscription(text);
                        });
                      }
                    }}
                  >
                    Transcrever áudio
                  </button>
                )}
              </div>
            )}
          </div>
        );
      case 'document':
        return (
          <div className="mb-2">
            <DocumentPreview 
              url={resolvedMediaUrl} 
              fileName={getFileName()}
              isAgent={isAgent}
            />
          </div>
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
                : (leadAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${leadName}`)
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
          
          {message.content && !MEDIA_PLACEHOLDERS.includes(message.content) && !/\.\w{2,5}$/.test(message.content) && (
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
