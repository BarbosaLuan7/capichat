import { useState, useMemo } from 'react';
import { Eye, Send, X, Zap, Search, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';

interface TemplatePreviewProps {
  onSend: (content: string) => void;
  leadName?: string;
  leadPhone?: string;
  leadBenefitType?: string;
  agentName?: string;
  disabled?: boolean;
}

export function TemplatePreview({
  onSend,
  leadName,
  leadPhone,
  leadBenefitType,
  agentName,
  disabled,
}: TemplatePreviewProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<{
    name: string;
    content: string;
    shortcut: string;
  } | null>(null);

  const { data: templates, isLoading } = useTemplates();

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!search.trim()) return templates;
    const term = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.shortcut.toLowerCase().includes(term) ||
        t.content.toLowerCase().includes(term)
    );
  }, [templates, search]);

  // Processa variáveis do template com dados reais
  const processContent = (content: string) => {
    const firstName = leadName ? leadName.split(' ')[0] : '';
    
    return content
      .replace(/\{\{nome\}\}/gi, leadName || '[nome do cliente]')
      .replace(/\{\{primeiro_nome\}\}/gi, firstName || '[primeiro nome]')
      .replace(/\{\{telefone\}\}/gi, leadPhone || '[telefone]')
      .replace(/\{\{beneficio\}\}/gi, leadBenefitType || '[tipo de benefício]')
      .replace(/\{\{atendente\}\}/gi, agentName || '[nome do atendente]')
      .replace(/\{\{(\w+)\}\}/g, '[$1]'); // Variáveis não mapeadas
  };

  const previewContent = useMemo(() => {
    if (!selectedTemplate) return '';
    return processContent(selectedTemplate.content);
  }, [selectedTemplate, leadName, leadPhone, leadBenefitType, agentName]);

  const handleSelectTemplate = (template: typeof selectedTemplate) => {
    setSelectedTemplate(template);
    setPopoverOpen(false);
    setPreviewOpen(true);
  };

  const handleSend = () => {
    if (!previewContent) return;
    onSend(previewContent);
    setPreviewOpen(false);
    setSelectedTemplate(null);
  };

  const handleSendDirect = (content: string) => {
    const processed = processContent(content);
    onSend(processed);
    setPopoverOpen(false);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground"
          >
            <Zap className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start" side="top">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum template encontrado
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-foreground">
                        {template.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        /{template.shortcut}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {template.content}
                    </p>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleSelectTemplate({
                          name: template.name,
                          content: template.content,
                          shortcut: template.shortcut,
                        })}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Visualizar
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleSendDirect(template.content)}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Enviar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />
          <div className="p-2 text-xs text-muted-foreground text-center">
            Clique em "Visualizar" para ver o preview com dados do lead
          </div>
        </PopoverContent>
      </Popover>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Preview da Mensagem
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name && (
                <Badge variant="outline" className="mt-1">
                  /{selectedTemplate.shortcut}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Lead info */}
            {leadName && (
              <div className="flex flex-wrap gap-2 mb-4 text-sm">
                <Badge variant="secondary">
                  👤 {leadName}
                </Badge>
                {leadPhone && (
                  <Badge variant="secondary">
                    📱 {leadPhone}
                  </Badge>
                )}
                {leadBenefitType && (
                  <Badge variant="secondary">
                    📋 {leadBenefitType}
                  </Badge>
                )}
              </div>
            )}

            {/* Message preview */}
            <div className="relative">
              <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                <div className="absolute -top-2 left-4 bg-background px-2 text-xs text-muted-foreground">
                  Mensagem
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {previewContent}
                </p>
              </div>
            </div>

            {/* Variables legend */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Variáveis substituídas:
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-success">{'{{nome}}'} → {leadName || '[não informado]'}</span>
                {leadPhone && <span className="text-success">{'{{telefone}}'} → {leadPhone}</span>}
                {agentName && <span className="text-success">{'{{atendente}}'} → {agentName}</span>}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSend}>
              <Send className="w-4 h-4 mr-2" />
              Enviar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
