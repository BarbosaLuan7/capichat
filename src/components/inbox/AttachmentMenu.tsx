import { useRef } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Paperclip,
  Image,
  Video,
  FileText,
  Mic,
  FileIcon,
} from 'lucide-react';

interface AttachmentMenuProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document') => void;
  onAudioRecordStart: () => void;
}

export function AttachmentMenu({ onFileSelect, onAudioRecordStart }: AttachmentMenuProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (type: 'image' | 'video' | 'audio' | 'document') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file, type);
    }
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange('image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange('video')}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange('audio')}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={handleFileChange('document')}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Paperclip className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm"
              onClick={() => imageInputRef.current?.click()}
            >
              <Image className="w-4 h-4 text-primary" />
              Imagem
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm"
              onClick={() => videoInputRef.current?.click()}
            >
              <Video className="w-4 h-4 text-accent" />
              Vídeo
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm"
              onClick={onAudioRecordStart}
            >
              <Mic className="w-4 h-4 text-warning" />
              Gravar Áudio
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm"
              onClick={() => audioInputRef.current?.click()}
            >
              <FileIcon className="w-4 h-4 text-warning" />
              Enviar Áudio
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm"
              onClick={() => documentInputRef.current?.click()}
            >
              <FileText className="w-4 h-4 text-destructive" />
              Documento
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
