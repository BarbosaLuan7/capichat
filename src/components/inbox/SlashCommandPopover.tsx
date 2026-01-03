import { useState, useEffect, useCallback, useRef, memo, forwardRef } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import { replaceTemplateVariables, type LeadData } from '@/lib/templateVariables';

interface SlashCommandPopoverProps {
  inputValue: string;
  onSelectTemplate: (content: string) => void;
  lead?: LeadData;
  agentName?: string;
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  onClose: () => void;
  // Legacy props for backwards compatibility
  leadName?: string;
  leadPhone?: string;
  leadBenefitType?: string;
}

// Usando forwardRef para evitar warning do React quando componente recebe ref
const SlashCommandPopoverComponent = forwardRef<HTMLDivElement, SlashCommandPopoverProps>(
  function SlashCommandPopoverComponent({
    inputValue,
    onSelectTemplate,
    lead,
    agentName,
    inputRef,
    onClose,
    // Legacy props
    leadName,
    leadPhone,
    leadBenefitType,
  }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data: templates } = useTemplates();
  const listRef = useRef<HTMLDivElement>(null);

  // Extract search query after "/"
  const slashIndex = inputValue.lastIndexOf('/');
  const isOpen = slashIndex !== -1;
  const searchQuery = isOpen ? inputValue.slice(slashIndex + 1).toLowerCase() : '';

  // Filter templates
  const filteredTemplates = templates?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery) ||
      t.shortcut.toLowerCase().includes(searchQuery)
  ) || [];

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle template selection
  const handleSelect = useCallback((template: { content: string; shortcut: string }) => {
    if (!template) return;

    // Build lead data from props (support both new and legacy props)
    const leadData: LeadData = lead || {
      name: leadName,
      phone: leadPhone,
      benefit_type: leadBenefitType,
    };
    
    const processedContent = replaceTemplateVariables(template.content, {
      lead: leadData,
      agentName,
      removeUnmatched: false,
    });
    
    // Get text before the "/"
    const textBefore = inputValue.slice(0, slashIndex);
    onSelectTemplate(textBefore + processedContent);
    onClose();
  }, [inputValue, slashIndex, lead, leadName, leadPhone, leadBenefitType, agentName, onSelectTemplate, onClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || filteredTemplates.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredTemplates.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(filteredTemplates[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        if (filteredTemplates.length > 0) {
          handleSelect(filteredTemplates[selectedIndex]);
        }
        break;
    }
  }, [isOpen, filteredTemplates, selectedIndex, handleSelect, onClose]);

  useEffect(() => {
    const input = inputRef.current;
    if (input && isOpen) {
      input.addEventListener('keydown', handleKeyDown);
      return () => input.removeEventListener('keydown', handleKeyDown);
    }
  }, [inputRef, isOpen, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  const shouldShow = isOpen && filteredTemplates.length > 0;

  return (
    <Popover open={shouldShow}>
      <PopoverAnchor asChild>
        <div className="absolute bottom-full left-0 right-0 mb-2" />
      </PopoverAnchor>
      <PopoverContent 
        className="w-80 p-0" 
        align="start" 
        side="top"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b border-border">
          <p className="text-xs text-muted-foreground">
            Digite para filtrar templates · <kbd className="px-1 py-0.5 text-xs bg-muted rounded">↑↓</kbd> navegar · <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Enter</kbd> selecionar
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <div ref={listRef} className="p-2 space-y-1">
            {filteredTemplates.map((template, index) => (
              <button
                key={template.id}
                data-index={index}
                onClick={() => handleSelect(template)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'w-full p-3 text-left rounded-lg transition-colors',
                  index === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
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
        </div>
      </PopoverContent>
    </Popover>
  );
});

// Memoize to prevent re-renders when parent re-renders
export const SlashCommandPopover = memo(SlashCommandPopoverComponent, (prev, next) => {
  return (
    prev.inputValue === next.inputValue &&
    prev.agentName === next.agentName &&
    prev.lead?.name === next.lead?.name &&
    prev.lead?.phone === next.lead?.phone
  );
});

SlashCommandPopover.displayName = 'SlashCommandPopover';
