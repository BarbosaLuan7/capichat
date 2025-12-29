import { useState, forwardRef, memo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

// Common emojis for quick selection
const commonEmojis = ['😊', '👍', '❤️', '🎉', '🔥', '✅', '👏', '🙏', '😄', '🤝', '💪', '⭐', '📞', '📧', '💼', '📝'];

// Memoized emoji button to avoid re-renders
const EmojiButton = memo(({ emoji, onClick }: { emoji: string; onClick: (emoji: string) => void }) => (
  <button
    onClick={() => onClick(emoji)}
    className="p-2 text-xl hover:bg-muted rounded transition-colors focusable"
    aria-label={`Inserir emoji ${emoji}`}
  >
    {emoji}
  </button>
));
EmojiButton.displayName = 'EmojiButton';

function EmojiPickerComponent({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Inserir emoji"
        >
          <Smile className="w-5 h-5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end" side="top">
        <div className="grid grid-cols-8 gap-1" role="grid" aria-label="Seletor de emojis">
          {commonEmojis.map((emoji) => (
            <EmojiButton key={emoji} emoji={emoji} onClick={handleSelect} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const EmojiPicker = memo(EmojiPickerComponent);
