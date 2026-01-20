import React, { useState, useEffect, memo, useRef } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Check,
  CheckCheck,
  Image,
  FileText,
  Video,
  Mic,
  Sparkles,
  Loader2,
  Copy,
  Clock,
  AlertCircle,
  ImageOff,
  VideoOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Square,
  CheckSquare,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { parseWhatsAppMarkdown } from '@/lib/whatsappMarkdown';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { AudioPlayer } from '@/components/inbox/AudioPlayer';
import { ImageLightbox } from '@/components/inbox/ImageLightbox';
import { DocumentPreview } from '@/components/inbox/DocumentPreview';
import { QuotedMessage } from '@/components/inbox/QuotedMessage';
import { MessageDetailsPopover } from '@/components/inbox/MessageDetailsPopover';
import { MessageActions } from '@/components/inbox/MessageActions';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Controle de auto-repair em nível de módulo.
 *
 * Estes Sets/Maps são mantidos fora do componente para sobreviver à virtualização,
 * evitando tentativas repetidas de repair quando componentes são remontados
 * durante o scroll.
 *
 * @see cleanupAutoRepairEntries - Limpeza periódica para evitar memory leaks
 */
const autoRepairAttempted = new Set<string>(); // IDs já tentados
const autoRepairInFlight = new Set<string>(); // Repairs em andamento
const COOLDOWN_MS = 5 * 60 * 1000; // Cooldown entre tentativas
const lastAttemptTime = new Map<string, number>(); // Timestamp da última tentativa
const MAX_MESSAGE_LENGTH = 500;
const MAX_REPAIR_ENTRIES = 500; // Limite para evitar crescimento ilimitado

/**
 * Limpa entradas antigas dos Sets de controle de auto-repair.
 *
 * Executada periodicamente (1 min) para evitar memory leaks em sessões longas.
 * Remove entries mais antigas que 5 minutos e, se ainda houver muitas,
 * remove as 100 mais antigas como fallback.
 */
function cleanupAutoRepairEntries() {
  const now = Date.now();
  const threshold = now - 5 * 60 * 1000; // 5 minutos (mais agressivo)

  for (const [id, time] of lastAttemptTime.entries()) {
    if (time < threshold) {
      autoRepairAttempted.delete(id);
      autoRepairInFlight.delete(id); // Limpar também os in-flight expirados
      lastAttemptTime.delete(id);
    }
  }

  // Fallback: se ainda tiver muitas entries, limpar as mais antigas
  if (autoRepairAttempted.size > MAX_REPAIR_ENTRIES) {
    const entriesToRemove = [...lastAttemptTime.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 100);

    for (const [id] of entriesToRemove) {
      autoRepairAttempted.delete(id);
      autoRepairInFlight.delete(id);
      lastAttemptTime.delete(id);
    }
  }
}

// Executar limpeza periodicamente (a cada 1 minuto - mais frequente para evitar acúmulo)
// Usar variável global para evitar múltiplos intervals em hot reload
if (typeof window !== 'undefined') {
  const CLEANUP_INTERVAL_KEY = '__messageBubbleCleanupInterval__';
  if ((window as unknown as Record<string, number>)[CLEANUP_INTERVAL_KEY]) {
    clearInterval((window as unknown as Record<string, number>)[CLEANUP_INTERVAL_KEY]);
  }
  (window as unknown as Record<string, number>)[CLEANUP_INTERVAL_KEY] = setInterval(
    cleanupAutoRepairEntries,
    60 * 1000 // 1 minuto
  ) as unknown as number;
}

// Constantes estáticas para tipos de mídia (evitar recriação)
const MEDIA_LABELS: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
};

const MEDIA_ICONS_MAP = {
  image: ImageOff,
  video: VideoOff,
  audio: Mic,
  document: FileText,
} as const;

// Placeholder texts to filter out from message content display
const MEDIA_PLACEHOLDERS = [
  '[Áudio]',
  '[audio]',
  '[Audio]',
  '[Imagem]',
  '[imagem]',
  '[Image]',
  '[image]',
  '[Video]',
  '[video]',
  '[Vídeo]',
  '[vídeo]',
  '[Documento]',
  '[documento]',
  '[Document]',
  '[document]',
  '[text]',
  '[Text]',
  '[TEXT]',
  '[media]',
  '[Media]',
  '[MEDIA]',
  '[Mídia]',
  '[mídia]',
];

// Detect if content looks like base64 (common in media messages)
const isBase64Content = (str: string): boolean => {
  if (!str || str.length < 100) return false;
  const base64Patterns = [
    '/9j/',
    'iVBOR',
    'R0lGOD',
    'UklGR',
    'AAAA',
    'data:image',
    'data:audio',
    'data:video',
  ];
  return (
    base64Patterns.some((pattern) => str.startsWith(pattern)) ||
    (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)))
  );
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
  transcription?: string | null;
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
  const queryClient = useQueryClient();
  const { transcribeAudio, getTranscription, setTranscriptionFromDb, isLoading } =
    useAudioTranscription();
  const [transcription, setTranscription] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isRepairingMedia, setIsRepairingMedia] = useState(false);
  const [autoRepairFailed, setAutoRepairFailed] = useState(false);
  const autoRepairTriggered = useRef(false);

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
  // Importante: só desativar o hook se propResolvedUrl é uma URL válida (não storage://)
  const shouldUseHook = !propResolvedUrl || propResolvedUrl.startsWith('storage://');
  const { signedUrl: hookSignedUrl, isLoading: isLoadingUrl } = useSignedUrl(
    shouldUseHook ? message.media_url : null
  );

  // URL final resolvida - priorizar prop se for URL válida
  const resolvedMediaUrl =
    propResolvedUrl && !propResolvedUrl.startsWith('storage://') ? propResolvedUrl : hookSignedUrl;

  // Reset error states when media_url OR resolvedMediaUrl changes
  useEffect(() => {
    setImageError(false);
    setVideoError(false);
  }, [message.media_url, resolvedMediaUrl]);

  const handleCopyTranscription = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      setCopied(true);
      toast.success('Transcrição copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Load transcription from memory cache or from message.transcription (DB cache)
  // No auto-transcribe to avoid rate limiting - users click "Transcrever áudio" on-demand
  useEffect(() => {
    if (message.type === 'audio' && !isAgent) {
      // First check memory cache
      const cached = getTranscription(message.id);
      if (cached) {
        setTranscription(cached);
        setHasAttempted(true);
      }
      // Then check if message has transcription from DB (loaded via query)
      else if (message.transcription) {
        setTranscriptionFromDb(message.id, message.transcription);
        setTranscription(message.transcription);
        setHasAttempted(true);
      }
    }
  }, [
    message.id,
    message.type,
    message.transcription,
    isAgent,
    getTranscription,
    setTranscriptionFromDb,
  ]);

  // Mensagem de erro detalhada para exibir ao usuário
  const [repairErrorMessage, setRepairErrorMessage] = useState<string | null>(null);
  const [mediaExpired, setMediaExpired] = useState(false);

  // Função para reparar mídia faltante (usada por auto-repair e botão manual)
  const handleRepairMedia = async (silent = false) => {
    if (isRepairingMedia || autoRepairInFlight.has(message.id)) return false;

    setIsRepairingMedia(true);
    setRepairErrorMessage(null);
    autoRepairInFlight.add(message.id);

    // Timeout do cliente (20s) - fallback se a edge function não responder
    const clientTimeout = new Promise<{ error: string; code: string }>((resolve) => {
      setTimeout(() => resolve({ error: 'Tempo limite excedido', code: 'CLIENT_TIMEOUT' }), 20000);
    });

    try {
      const invokePromise = supabase.functions.invoke('repair-message-media', {
        body: { messageId: message.id },
      });

      const result = await Promise.race([
        invokePromise,
        clientTimeout.then((timeoutResult) => ({ data: timeoutResult, error: null })),
      ]);

      const { data, error } = result;

      if (error) throw error;

      if (data?.success || data?.already_repaired) {
        // Atualizar cache sem reload da página
        queryClient.invalidateQueries({ queryKey: ['messages-infinite', message.conversation_id] });
        if (!silent) {
          toast.success('Mídia recuperada!');
        }
        setRepairErrorMessage(null);
        setMediaExpired(false);
        return true;
      } else {
        // Verificar se mídia expirou
        if (data?.expired || data?.code === 'MEDIA_EXPIRED' || data?.code === 'MEDIA_NOT_FOUND') {
          setMediaExpired(true);
          setRepairErrorMessage('Mídia expirou no WhatsApp');
        } else if (data?.code === 'TIMEOUT' || data?.code === 'CLIENT_TIMEOUT') {
          setRepairErrorMessage('Servidor não respondeu');
        } else {
          setRepairErrorMessage(data?.error || 'Não foi possível recuperar');
        }

        if (!silent) {
          const msg = data?.expired
            ? 'Mídia pode ter expirado'
            : data?.error || 'Não foi possível recuperar a mídia';
          toast.error(msg);
        }
        return false;
      }
    } catch (err) {
      logger.error('[MessageBubble] Erro ao reparar mídia:', err);
      setRepairErrorMessage('Erro ao tentar recuperar');
      if (!silent) {
        toast.error('Erro ao tentar recuperar mídia');
      }
      return false;
    } finally {
      setIsRepairingMedia(false);
      autoRepairInFlight.delete(message.id);
    }
  };

  // Auto-repair: tentar recuperar mídia automaticamente ao montar
  useEffect(() => {
    // Condições para auto-repair
    const needsRepair = message.type !== 'text' && !message.media_url;
    const isOptimistic = message.isOptimistic || message.id.startsWith('temp_');
    const alreadyAttempted = autoRepairAttempted.has(message.id);
    const inCooldown = (lastAttemptTime.get(message.id) || 0) + COOLDOWN_MS > Date.now();

    if (
      !needsRepair ||
      isOptimistic ||
      alreadyAttempted ||
      inCooldown ||
      autoRepairTriggered.current
    ) {
      return;
    }

    // Marcar como tentado e disparar
    autoRepairTriggered.current = true;
    autoRepairAttempted.add(message.id);
    lastAttemptTime.set(message.id, Date.now());

    logger.info('[MessageBubble] Auto-repair iniciado para:', message.id);

    handleRepairMedia(true).then((success) => {
      if (!success) {
        setAutoRepairFailed(true);
        logger.warn('[MessageBubble] Auto-repair falhou para:', message.id);
      }
    });
  }, [message.id, message.type, message.media_url, message.isOptimistic]);

  const renderMedia = () => {
    // Se é mensagem de mídia mas NÃO tem media_url, mostrar placeholder com botão de recuperar
    if (message.type !== 'text' && !message.media_url) {
      const IconComponent =
        MEDIA_ICONS_MAP[message.type as keyof typeof MEDIA_ICONS_MAP] || FileText;

      return (
        <div className="mb-2 rounded-lg border border-border bg-muted/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <IconComponent className="h-5 w-5" />
            <span className="text-sm">
              {mediaExpired
                ? `${MEDIA_LABELS[message.type] || 'Mídia'} expirou`
                : `${MEDIA_LABELS[message.type] || 'Mídia'} indisponível`}
            </span>
          </div>

          {isRepairingMedia ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Recuperando...</span>
            </div>
          ) : mediaExpired ? (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">A mídia não está mais disponível no WhatsApp.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRepairMedia(false)}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Tentar novamente
              </Button>
            </div>
          ) : autoRepairFailed ? (
            <div className="space-y-1">
              {repairErrorMessage && (
                <p className="text-xs text-muted-foreground">{repairErrorMessage}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRepairMedia(false)}
                className="text-xs"
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                Tentar recuperar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Recuperando...</span>
            </div>
          )}
        </div>
      );
    }

    if (!message.media_url) return null;

    // Mostrar loading apenas se não temos URL resolvida e está carregando
    if (!resolvedMediaUrl && isLoadingUrl) {
      return (
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando mídia...</span>
        </div>
      );
    }

    // Se ainda não tem URL, aguardar
    if (!resolvedMediaUrl) return null;

    // Helper to extract filename from content or URL
    const getFileName = (): string => {
      // If content looks like a filename (has file extension)
      if (
        message.content &&
        /\.\w{2,5}$/.test(message.content) &&
        !MEDIA_PLACEHOLDERS.includes(message.content)
      ) {
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
            <div className="mb-2 rounded-lg border border-border bg-muted/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <ImageOff className="h-5 w-5" />
                <span className="text-sm">Erro ao carregar imagem</span>
              </div>
              <a
                href={resolvedMediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir em nova aba
              </a>
            </div>
          );
        }
        return (
          <div className="mb-2">
            <ImageLightbox
              src={resolvedMediaUrl}
              alt={`Imagem ${isAgent ? 'enviada pelo atendente' : `de ${leadName}`}`}
            >
              <img
                src={resolvedMediaUrl}
                alt={`Imagem ${isAgent ? 'enviada pelo atendente' : `enviada por ${leadName}`}`}
                className="max-h-64 max-w-full cursor-pointer rounded-lg object-cover transition-all hover:brightness-95"
                loading="lazy"
                decoding="async"
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
            <div className="mb-2 rounded-lg border border-border bg-muted/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <VideoOff className="h-5 w-5" />
                <span className="text-sm">Erro ao carregar vídeo</span>
              </div>
              <a
                href={resolvedMediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
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
              className="max-h-64 max-w-full rounded-lg"
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
            <AudioPlayer
              src={resolvedMediaUrl}
              aria-label={`Áudio ${isAgent ? 'enviado pelo atendente' : `de ${leadName}`}`}
            />

            {/* Transcription section */}
            {!isAgent && (
              <div className="text-xs">
                {isLoading(message.id) && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Transcrevendo...</span>
                  </div>
                )}

                {transcription && (
                  <div className="rounded-md border border-border/50 bg-muted/80 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-success">
                        <Check className="h-3 w-3" />
                        <span className="text-xs font-medium">Transcrito</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleCopyTranscription}
                        title={copied ? 'Copiado!' : 'Copiar transcrição'}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs italic text-foreground/80">"{transcription}"</p>
                  </div>
                )}

                {!isLoading(message.id) && !transcription && (
                  <button
                    className="flex items-center gap-1 text-xs text-primary underline hover:text-primary/80"
                    onClick={() => {
                      if (resolvedMediaUrl) {
                        setHasAttempted(true);
                        transcribeAudio(message.id, resolvedMediaUrl).then((text) => {
                          if (text) setTranscription(text);
                        });
                      }
                    }}
                    aria-label={
                      hasAttempted ? 'Tentar transcrever novamente' : 'Transcrever áudio com IA'
                    }
                  >
                    <Sparkles className="h-3 w-3" />
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
            <DocumentPreview url={resolvedMediaUrl} fileName={getFileName()} isAgent={isAgent} />
          </div>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = () => {
    switch (message.type) {
      case 'image':
        return <Image className="h-3 w-3" />;
      case 'video':
        return <Video className="h-3 w-3" />;
      case 'audio':
        return <Mic className="h-3 w-3" />;
      case 'document':
        return <FileText className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('group flex gap-2', isAgent && 'flex-row-reverse')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {showAvatar ? (
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={
              isAgent
                ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentName}`
                : leadAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${leadName}`
            }
          />
          <AvatarFallback>
            {isAgent ? agentName?.charAt(0) || 'A' : leadName?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8" />
      )}

      <div className="relative max-w-[70%]">
        {/* Message Actions - Reply, Copy and Select */}
        <MessageActions
          show={showActions}
          isAgent={isAgent}
          isSelected={isSelected}
          selectionMode={selectionMode}
          content={message.content}
          onReply={handleReply}
          onToggleSelect={handleToggleSelect}
        />

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 transition-all',
            isAgent
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm border border-border bg-card',
            // Failed message styling - use string comparison for extended statuses
            (message.status as string) === 'failed' &&
              isAgent &&
              'border border-destructive bg-destructive/80',
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

          {message.content &&
            !MEDIA_PLACEHOLDERS.includes(message.content) &&
            !isBase64Content(message.content) &&
            !/\.\w{2,5}$/.test(message.content) && (
              <>
                {message.content.length > MAX_MESSAGE_LENGTH && !isExpanded ? (
                  <div>
                    <div className="whitespace-pre-wrap text-sm">
                      {parseWhatsAppMarkdown(message.content.slice(0, MAX_MESSAGE_LENGTH))}...
                    </div>
                    <button
                      onClick={() => setIsExpanded(true)}
                      aria-expanded={isExpanded}
                      className="mt-1 flex items-center gap-0.5 text-xs text-primary underline hover:text-primary/80"
                    >
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      Ver mais
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="whitespace-pre-wrap text-sm">
                      {parseWhatsAppMarkdown(message.content)}
                    </div>
                    {message.content.length > MAX_MESSAGE_LENGTH && isExpanded && (
                      <button
                        onClick={() => setIsExpanded(false)}
                        aria-expanded={isExpanded}
                        className="mt-1 flex items-center gap-0.5 text-xs text-primary underline hover:text-primary/80"
                      >
                        <ChevronUp className="h-3 w-3" aria-hidden="true" />
                        Ver menos
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

          <div className={cn('mt-1 flex items-center gap-1', isAgent && 'justify-end')}>
            {getTypeIcon()}
            <span
              className={cn(
                'text-xs',
                isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
            </span>
            {isAgent &&
              (() => {
                const statusConfig = getStatusConfig(message.status as MessageStatus);
                const StatusIcon = statusConfig.icon;
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={statusConfig.className}>
                          <StatusIcon className="h-3.5 w-3.5" aria-label={statusConfig.label} />
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
            <div className="mt-2 border-t border-destructive/30 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                onClick={() => onRetry(message)}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
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
    prevProps.message.is_starred === nextProps.message.is_starred &&
    (prevProps.message as any).transcription === (nextProps.message as any).transcription &&
    (prevProps.message as any).isOptimistic === (nextProps.message as any).isOptimistic &&
    (prevProps.message as any).errorMessage === (nextProps.message as any).errorMessage &&
    prevProps.isAgent === nextProps.isAgent &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.resolvedMediaUrl === nextProps.resolvedMediaUrl
  );
});
