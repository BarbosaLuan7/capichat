import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Image, FileText, Video, Mic, Sparkles, Loader2, Copy, Clock, AlertCircle, ImageOff, VideoOff, ExternalLink, ChevronDown, ChevronUp, CornerUpLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { AudioPlayer } from '@/components/inbox/AudioPlayer';
import { ImageLightbox } from '@/components/inbox/ImageLightbox';
import { DocumentPreview } from '@/components/inbox/DocumentPreview';
import { QuotedMessage } from '@/components/inbox/QuotedMessage';
import { MessageDetailsPopover } from '@/components/inbox/MessageDetailsPopover';
import type { Database } from '@/integrations/supabase/types';

const MAX_MESSAGE_LENGTH = 500;

// Placeholder texts to filter out from message content display
const MEDIA_PLACEHOLDERS = [
  '[Áudio]', '[audio]', '[Audio]',
  '[Imagem]', '[imagem]', '[Image]', '[image]',
  '[Video]', '[video]', '[Vídeo]', '[vídeo]',
  '[Documento]', '[documento]', '[Document]', '[document]',
];

type MessageStatus = 'sent' | 'delivered' | 'read' | 'pending' | 'failed';

type Message = Database['public']['Tables']['messages']['Row'] & {
  is_starred?: boolean;
  quoted_message?: {
    id: string;
    body: string;
    from: string;
    type?: string;
  } | null;
  reply_to_external_id?: string | null;
};

interface MessageBubbleProps {
  message: Message;
  isAgent: boolean;
  showAvatar: boolean;
  leadName: string;
  leadAvatarUrl?: string | null;
  agentName?: string;
  onReply?: (message: Message) => void;
}

// Helper function for status icon configuration
function getStatusConfig(status: MessageStatus) {
  switch (status) {
    case 'read':
      return {
        icon: CheckCheck,
        className: 'text-blue-400',
        label: 'Lida',
      };
    case 'delivered':
      return {
        icon: CheckCheck,
        className: 'text-primary-foreground/70',
        label: 'Entregue',
      };
    case 'sent':
      return {
        icon: Check,
        className: 'text-primary-foreground/70',
        label: 'Enviada',
      };
    case 'pending':
      return {
        icon: Clock,
        className: 'text-primary-foreground/50 animate-pulse',
        label: 'Enviando...',
      };
    case 'failed':
      return {
        icon: AlertCircle,
        className: 'text-destructive',
        label: 'Falha ao enviar',
      };
    default:
      return {
        icon: Check,
        className: 'text-primary-foreground/70',
        label: 'Enviada',
      };
  }
}

function MessageBubbleComponent({
  message,
  isAgent,
  showAvatar,
  leadName,
  leadAvatarUrl,
  agentName = 'Agente',
  onReply,
}: MessageBubbleProps) {
  const { transcribeAudio, getTranscription, isLoading } = useAudioTranscription();
  const [transcription, setTranscription] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  // Usar signed URL para mídias em buckets privados
  const { signedUrl: resolvedMediaUrl, isLoading: isLoadingUrl } = useSignedUrl(message.media_url);
  
  // Reset error states when media_url changes
  useEffect(() => {
    setImageError(false);
    setVideoError(false);
  }, [message.media_url]);

  const handleCopyTranscription = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      setCopied(true);
      toast.success('Transcrição copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Only load cached transcription on mount - no auto-transcribe to avoid rate limiting
  // Users can click "Transcrever áudio" to transcribe on-demand
  useEffect(() => {
    if (message.type === 'audio' && !isAgent) {
      const cached = getTranscription(message.id);
      if (cached) {
        setTranscription(cached);
        setHasAttempted(true);
      }
    }
  }, [message.id, message.type, isAgent, getTranscription]);

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
        if (imageError) {
          return (
            <div className="mb-2 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <ImageOff className="w-5 h-5" />
                <span className="text-sm">Erro ao carregar imagem</span>
              </div>
              <a 
                href={resolvedMediaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir em nova aba
              </a>
            </div>
          );
        }
        return (
          <div className="mb-2">
            <ImageLightbox src={resolvedMediaUrl} alt={`Imagem ${isAgent ? 'enviada pelo atendente' : `de ${leadName}`}`}>
              <img
                src={resolvedMediaUrl}
                alt={`Imagem ${isAgent ? 'enviada pelo atendente' : `enviada por ${leadName}`}`}
                className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:brightness-95 transition-all"
                loading="lazy"
                onError={() => {
                  logger.error('[MessageBubble] Erro ao carregar imagem:', message.media_url);
                  setImageError(true);
                }}
              />
            </ImageLightbox>
          </div>
        );
      case 'video':
        if (videoError) {
          return (
            <div className="mb-2 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <VideoOff className="w-5 h-5" />
                <span className="text-sm">Erro ao carregar vídeo</span>
              </div>
              <a 
                href={resolvedMediaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir em nova aba
              </a>
            </div>
          );
        }
        return (
          <div className="mb-2">
            <video
              src={resolvedMediaUrl}
              controls
              aria-label={`Vídeo ${isAgent ? 'enviado pelo atendente' : `de ${leadName}`}`}
              className="max-w-full rounded-lg max-h-64"
              onError={() => {
                logger.error('[MessageBubble] Erro ao carregar vídeo:', message.media_url);
                setVideoError(true);
              }}
            />
          </div>
        );
      case 'audio':
        return (
          <div className="mb-2 space-y-2">
            <AudioPlayer src={resolvedMediaUrl} aria-label={`Áudio ${isAgent ? 'enviado pelo atendente' : `de ${leadName}`}`} />
            
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
                  <div className="p-2 rounded-md bg-muted/80 border border-border/50">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1 text-success">
                        <Check className="w-3 h-3" />
                        <span className="font-medium text-xs">Transcrito</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleCopyTranscription}
                        title={copied ? 'Copiado!' : 'Copiar transcrição'}
                      >
                        {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="text-foreground/80 italic text-xs">"{transcription}"</p>
                  </div>
                )}
                
                {!isLoading(message.id) && !transcription && (
                  <button
                    className="text-primary hover:text-primary/80 text-xs underline flex items-center gap-1"
                    onClick={() => {
                      if (resolvedMediaUrl) {
                        setHasAttempted(true);
                        transcribeAudio(message.id, resolvedMediaUrl).then((text) => {
                          if (text) setTranscription(text);
                        });
                      }
                    }}
                    aria-label={hasAttempted ? 'Tentar transcrever novamente' : 'Transcrever áudio com IA'}
                  >
                    <Sparkles className="w-3 h-3" />
                    {hasAttempted ? 'Tentar novamente' : 'Transcrever áudio'}
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

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2 group', isAgent && 'flex-row-reverse')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
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
            {isAgent ? (agentName?.charAt(0) || 'A') : (leadName?.charAt(0) || '?')}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8" />
      )}

      <div className="relative max-w-[70%]">
        {/* Reply button that appears on hover */}
        {onReply && (
          <div 
            className={cn(
              "absolute top-1/2 -translate-y-1/2 transition-opacity duration-200",
              isAgent ? "-left-8" : "-right-8",
              showActions ? "opacity-100" : "opacity-0"
            )}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border/50"
                    onClick={handleReply}
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isAgent ? "left" : "right"} className="text-xs">
                  Responder
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isAgent
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm'
          )}
        >
          {/* Quoted message if this is a reply */}
          {message.quoted_message && (
            <QuotedMessage
              quote={message.quoted_message}
              isAgentMessage={isAgent}
              leadName={leadName}
              agentName={agentName}
            />
          )}
          
          {renderMedia()}
          
          {message.content && !MEDIA_PLACEHOLDERS.includes(message.content) && !/\.\w{2,5}$/.test(message.content) && (
            <>
              {message.content.length > MAX_MESSAGE_LENGTH && !isExpanded ? (
                <div>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content.slice(0, MAX_MESSAGE_LENGTH)}...
                  </p>
                  <button
                    onClick={() => setIsExpanded(true)}
                    aria-expanded="false"
                    className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center gap-0.5 underline"
                  >
                    <ChevronDown className="w-3 h-3" aria-hidden="true" />
                    Ver mais
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.content.length > MAX_MESSAGE_LENGTH && isExpanded && (
                    <button
                      onClick={() => setIsExpanded(false)}
                      aria-expanded="true"
                      className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center gap-0.5 underline"
                    >
                      <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      Ver menos
                    </button>
                  )}
                </div>
              )}
            </>
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
            {isAgent && (() => {
              const statusConfig = getStatusConfig(message.status as MessageStatus);
              const StatusIcon = statusConfig.icon;
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={statusConfig.className}>
                        <StatusIcon className="w-3.5 h-3.5" aria-label={statusConfig.label} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {statusConfig.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
            <MessageDetailsPopover
              source={message.source}
              status={message.status as MessageStatus}
              createdAt={message.created_at}
              isAgent={isAgent}
            />
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// Memoize to prevent unnecessary re-renders
export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.is_starred === nextProps.message.is_starred &&
    prevProps.isAgent === nextProps.isAgent &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.onReply === nextProps.onReply
  );
});