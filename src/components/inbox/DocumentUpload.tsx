import { useState, useRef } from 'react';
import { Upload, File, Check, X, Clock, User, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface UploadedDocument {
  id: string;
  name: string;
  url: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_at: string;
}

interface DocumentUploadProps {
  documentId: string;
  documentName: string;
  leadId: string;
  existingUploads?: UploadedDocument[];
  onUploadComplete?: (doc: UploadedDocument) => void;
}

export function DocumentUpload({
  documentId,
  documentName,
  leadId,
  existingUploads = [],
  onUploadComplete,
}: DocumentUploadProps) {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const hasUploads = existingUploads.length > 0;
  const latestUpload = existingUploads[0];

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Gerar ID único usando crypto.randomUUID() para evitar colisões
      const uniqueId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop();
      const fileName = `${leadId}/${documentId}_${uniqueId}.${fileExt}`;

      // Upload para o storage com upsert: false para evitar sobrescrita
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(fileName);

      const newDoc: UploadedDocument = {
        id: `${documentId}_${uniqueId}`,
        name: file.name,
        url: urlData.publicUrl,
        uploaded_by: user.id,
        uploaded_by_name: profile?.name || user.email || 'Desconhecido',
        uploaded_at: new Date().toISOString(),
      };

      toast.success('Documento enviado com sucesso!');
      onUploadComplete?.(newDoc);
    } catch (error) {
      logger.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar documento');
    } finally {
      setIsUploading(false);
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={hasUploads ? 'outline' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2',
                  hasUploads && 'border-success text-success hover:bg-success/10'
                )}
                onClick={handleUploadClick}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : hasUploads ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasUploads
                ? `${existingUploads.length} arquivo(s) enviado(s) - Clique para adicionar mais`
                : 'Fazer upload do documento'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {hasUploads && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setShowHistory(true)}
          >
            <Clock className="mr-1 h-3 w-3" />
            Histórico
          </Button>
        )}
      </div>

      {/* Dialog de histórico */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Histórico de Uploads: {documentName}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-96">
            {existingUploads.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <File className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Nenhum documento enviado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {existingUploads.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{doc.uploaded_by_name || 'Desconhecido'}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(doc.uploaded_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(doc.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Adicionar documento
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
