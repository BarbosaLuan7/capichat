import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Image, FileText, Video, Mic, Sparkles, Loader2, Copy, Clock, AlertCircle, ImageOff, VideoOff, ExternalLink, ChevronDown, ChevronUp, RotateCcw, Square, CheckSquare } from 'lucide-react';
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
import { MessageActions } from '@/components/inbox/MessageActions';
import type { Database } from '@/integrations/supabase/types';

const MAX_MESSAGE_LENGTH = 500;

// Placeholder texts to filter out from message content display
const MEDIA_PLACEHOLDERS = [
  '[Áudio]', '[audio]', '[Audio]',
  '[Imagem]', '[imagem]', '[Image]', '[image]',
  '[Video]', '[video]', '[Vídeo]', '[vídeo]',
  '[Documento]', '[documento]', '[Document]', '[document]',
  '[text]', '[Text]', '[TEXT]',
  '[media]', '[Media]', '[MEDIA]',
  '[Mídia]', '[mídia]',
];

// Detect if content looks like base64 (common in media messages)
const isBase64Content = (str: string): boolean => {
  if (!str || str.length < 100) return false;
  const base64Patterns = ['/9j/', 'iVBOR', 'R0lGOD', 'UklGR', 'AAAA', 'data:image', 'data:audio', 'data:video'];
  return base64Patterns.some(pattern => str.startsWith(pattern)) || 
         (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
};

// Extended status type including client-only statuses
type MessageStatus = 'sent' | 'delivered' | 'read' | 'pending' | 'failed' | 'sending';

type Message = Database['public']['Tables']['messages']['Row'] & {
  is_starred?: boolean;
  is_deleted_locally?: boolean;
  quoted_message?: {
    id: string;
    body: string;
    from: string;
    type?: string;
  } | null;
  reply_to_external_id?: string | null;
  isOptimistic?: boolean;
  errorMessage?: string;
};

interface MessageBubbleProps {
  message: Message;
  isAgent: boolean;
  showAvatar: boolean;
  leadName: string;
  leadAvatarUrl?: string | null;
  agentName?: string;
  onReply?: (message: Message) => void;
  onRetry?: (message: Message) => void;
  /** URL já resolvida via batch - evita chamada individual ao useSignedUrl */
  resolvedMediaUrl?: string | null;
  // Selection mode props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
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
    case 'sending':
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
  onRetry,
  resolvedMediaUrl: propResolvedUrl,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: MessageBubbleProps) {
  const { transcribeAudio, getTranscription, isLoading } = useAudioTranscription();
  const [transcription, setTranscription] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Import MessageActions
  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  // Verificar se a mensagem pode ser selecionada (não permitir mensagens otimistas)
  const canSelect = !message.isOptimistic && !message.id.startsWith('temp_');
  
  const handleToggleSelect = () => {
    if (onToggleSelect && canSelect) {
      onToggleSelect(message.id);
    }
  };
  
  // Usar URL resolvida da prop se disponível, senão fallback para hook individual
  const { signedUrl: hookSignedUrl, isLoading: isLoadingUrl } = useSignedUrl(
    propResolvedUrl ? null : message.media_url
  );
  const resolvedMediaUrl = propResolvedUrl || hookSignedUrl;
  
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
    
    // Mostrar loading apenas se não temos URL resolvida e está carregando
    if (!resolvedMediaUrl && isLoadingUrl) {
      return (
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando mídia...</span>
        </div>
      );
    }
    
    // Se ainda não tem URL, aguardar
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
        {/* Message Actions - Reply and Select */}
        <MessageActions
          show={showActions}
          isAgent={isAgent}
          isSelected={isSelected}
          selectionMode={selectionMode}
          onReply={handleReply}
          onToggleSelect={handleToggleSelect}
        />
        
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 transition-all',
            isAgent
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm',
            // Failed message styling - use string comparison for extended statuses
            (message.status as string) === 'failed' && isAgent && 'bg-destructive/80 border border-destructive',
            // Selected message styling
            isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
          onClick={selectionMode ? handleToggleSelect : undefined}
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
          
          {message.content && !MEDIA_PLACEHOLDERS.includes(message.content) && !isBase64Content(message.content) && !/\.\w{2,5}$/.test(message.content) && (
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
              status={message.status}
              createdAt={message.created_at}
              isAgent={isAgent}
            />
          </div>
          
          {/* Retry button for failed messages */}
          {(message.status as string) === 'failed' && isAgent && onRetry && (
            <div className="mt-2 pt-2 border-t border-destructive/30">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => onRetry(message)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reenviar
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

MessageBubbleComponent.displayName = 'MessageBubble';

// Memoize to prevent unnecessary re-renders
export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.media_url === nextProps.message.media_url &&
    prevProps.isAgent === nextProps.isAgent &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.isSelected === nextProps.isSelected
  );
});