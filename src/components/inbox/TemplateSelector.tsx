import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          title="Selecionar template"
        >
          <Zap className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="top">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar template ou atalho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <ScrollArea className="max-h-64">
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
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.content)}
                  className="w-full p-3 text-left rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground">
                      {template.name}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
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
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
