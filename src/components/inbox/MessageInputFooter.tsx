import React, { Suspense } from 'react';
import { Send, Mic, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AttachmentMenu } from '@/components/inbox/AttachmentMenu';
import { TemplateSelector } from '@/components/inbox/TemplateSelector';
import { SlashCommandPopover } from '@/components/inbox/SlashCommandPopover';
import type { PendingFile } from '@/hooks/useSendMessage';

const EmojiPicker = React.lazy(() =>
  import('@/components/inbox/EmojiPicker').then((m) => ({ default: m.EmojiPicker }))
);

interface LeadInfo {
  name: string;
  phone: string;
  benefit_type?: string | null;
}

interface MessageInputFooterProps {
  messageInput: string;
  showSlashCommand: boolean;
  showAudioRecorder: boolean;
  pendingFile: PendingFile | null;
  isUploading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  lead: LeadInfo;
  agentName?: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onEmojiSelect: (emoji: string) => void;
  onTemplateSelect: (content: string) => void;
  onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document') => void;
  onAudioRecordStart: () => void;
  onSendMessage: () => void;
  onCloseSlashCommand: () => void;
}

export function MessageInputFooter({
  messageInput,
  showSlashCommand,
  showAudioRecorder,
  pendingFile,
  isUploading,
  inputRef,
  lead,
  agentName,
  onInputChange,
  onKeyDown,
  onPaste,
  onEmojiSelect,
  onTemplateSelect,
  onFileSelect,
  onAudioRecordStart,
  onSendMessage,
  onCloseSlashCommand,
}: MessageInputFooterProps) {
  const hasContent = messageInput.trim() || pendingFile;

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="flex items-center gap-1">
          <AttachmentMenu onFileSelect={onFileSelect} onAudioRecordStart={onAudioRecordStart} />
          <TemplateSelector
            onSelectTemplate={onTemplateSelect}
            leadName={lead.name}
            leadPhone={lead.phone}
            leadBenefitType={lead.benefit_type || undefined}
            agentName={agentName}
          />
        </div>

        <div className="relative flex flex-1 items-end">
          {showSlashCommand && (
            <SlashCommandPopover
              inputValue={messageInput}
              onSelectTemplate={onTemplateSelect}
              leadName={lead.name}
              leadPhone={lead.phone}
              leadBenefitType={lead.benefit_type || undefined}
              agentName={agentName}
              inputRef={inputRef}
              onClose={onCloseSlashCommand}
            />
          )}
          <Textarea
            ref={inputRef}
            value={messageInput}
            onChange={onInputChange}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            aria-label="Escrever mensagem"
            placeholder="Digite / para atalhos... (Shift+Enter para nova linha)"
            className="max-h-[120px] min-h-[40px] resize-none overflow-y-auto py-2 pr-12"
            rows={1}
          />
          <div className="absolute bottom-2 right-1">
            <Suspense fallback={null}>
              <EmojiPicker onEmojiSelect={onEmojiSelect} />
            </Suspense>
          </div>
        </div>

        {!showAudioRecorder && !hasContent ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={onAudioRecordStart}
            aria-label="Gravar audio"
          >
            <Mic className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            onClick={onSendMessage}
            disabled={!hasContent || isUploading}
            className="gradient-primary min-w-[40px] text-primary-foreground"
            aria-label={isUploading ? 'Enviando...' : 'Enviar mensagem'}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
