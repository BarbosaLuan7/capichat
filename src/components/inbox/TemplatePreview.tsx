import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Eye, Send, X, Zap, Search, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { replaceTemplateVariables, type LeadData } from '@/lib/templateVariables';

interface TemplatePreviewProps {
  onSend: (content: string) => void;
  lead?: LeadData;
  agentName?: string;
  disabled?: boolean;
  // Legacy props for backwards compatibility
  leadName?: string;
  leadPhone?: string;
  leadBenefitType?: string;
}

export function TemplatePreview({
  onSend,
  lead,
  agentName,
  disabled,
  // Legacy props
  leadName,
  leadPhone,
  leadBenefitType,
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

  const debouncedSearch = useDebounce(search, 200);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!debouncedSearch.trim()) return templates;
    const term = debouncedSearch.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.shortcut.toLowerCase().includes(term) ||
        t.content.toLowerCase().includes(term)
    );
  }, [templates, debouncedSearch]);

  // Build lead data from props (support both new and legacy props)
  const leadData: LeadData = lead || {
    name: leadName,
    phone: leadPhone,
    benefit_type: leadBenefitType,
  };

  // Processa variáveis do template com dados reais
  const processContent = (content: string) => {
    return replaceTemplateVariables(content, {
      lead: leadData,
      agentName,
      removeUnmatched: false,
    });
  };

  const previewContent = useMemo(() => {
    if (!selectedTemplate) return '';
    return processContent(selectedTemplate.content);
  }, [selectedTemplate, leadData, agentName]);

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
            <Zap className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start" side="top">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              <div className="p-4 text-center text-muted-foreground">Carregando...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum template encontrado
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="group rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        /{template.shortcut}
                      </Badge>
                    </div>
                    <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                      {template.content}
                    </p>
                    <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() =>
                          handleSelectTemplate({
                            name: template.name,
                            content: template.content,
                            shortcut: template.shortcut,
                          })
                        }
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Visualizar
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleSendDirect(template.content)}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        Enviar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />
          <div className="p-2 text-center text-xs text-muted-foreground">
            Clique em "Visualizar" para ver o preview com dados do lead
          </div>
        </PopoverContent>
      </Popover>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
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
              <div className="mb-4 flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">👤 {leadName}</Badge>
                {leadPhone && <Badge variant="secondary">📱 {leadPhone}</Badge>}
                {leadBenefitType && <Badge variant="secondary">📋 {leadBenefitType}</Badge>}
              </div>
            )}

            {/* Message preview */}
            <div className="relative">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <div className="absolute -top-2 left-4 bg-background px-2 text-xs text-muted-foreground">
                  Mensagem
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{previewContent}</p>
              </div>
            </div>

            {/* Variables legend */}
            <div className="mt-4 rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Variáveis substituídas:
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-success">
                  {'{{nome}}'} → {leadName || '[não informado]'}
                </span>
                {leadPhone && (
                  <span className="text-success">
                    {'{{telefone}}'} → {leadPhone}
                  </span>
                )}
                {agentName && (
                  <span className="text-success">
                    {'{{atendente}}'} → {agentName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSend}>
              <Send className="mr-2 h-4 w-4" />
              Enviar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
