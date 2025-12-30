import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Search } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { replaceTemplateVariables, type LeadData } from '@/lib/templateVariables';
import { useDebounce } from '@/hooks/useDebounce';

interface TemplateSelectorProps {
  onSelectTemplate: (content: string) => void;
  lead?: LeadData;
  agentName?: string;
  // Legacy props for backwards compatibility
  leadName?: string;
  leadPhone?: string;
  leadBenefitType?: string;
}

export function TemplateSelector({ 
  onSelectTemplate, 
  lead,
  agentName,
  // Legacy props
  leadName, 
  leadPhone, 
  leadBenefitType,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  // Only fetch templates when popover is open (lazy loading)
  const { data: templates, isLoading } = useTemplates(open);

  const filteredTemplates = useMemo(() => templates?.filter(
    (t) =>
      t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      t.shortcut.toLowerCase().includes(debouncedSearch.toLowerCase())
  ) || [], [templates, debouncedSearch]);

  const handleSelectTemplate = (content: string) => {
    // Build lead data from props (support both new and legacy props)
    const leadData: LeadData = lead || {
      name: leadName,
      phone: leadPhone,
      benefit_type: leadBenefitType,
    };
    
    const processedContent = replaceTemplateVariables(content, {
      lead: leadData,
      agentName,
      removeUnmatched: false,
    });
    
    onSelectTemplate(processedContent);
    setOpen(false);
    setSearch('');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <Popover open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Selecionar template de mensagem"
              >
                <Zap className="w-5 h-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Usar template</TooltipContent>
          <PopoverContent className="w-80 p-0" align="start" side="top">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Buscar template ou atalho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Buscar template"
            />
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground" role="status" aria-live="polite">
              Carregando...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground" role="status" aria-live="polite">
              Nenhum template encontrado
            </div>
          ) : (
            <div className="p-2 space-y-1" role="listbox" aria-label="Lista de templates">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.content)}
                  className="w-full p-3 text-left rounded-lg hover:bg-muted/50 transition-colors focusable"
                  role="option"
                  aria-label={`Usar template ${template.name}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground">
                      {template.name}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded" aria-hidden="true">
                      /{template.shortcut}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  );
}
