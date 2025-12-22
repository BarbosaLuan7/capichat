import { useState, lazy, Suspense } from 'react';
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

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
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
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end" side="top">
        <div className="grid grid-cols-8 gap-1">
          {commonEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="p-2 text-xl hover:bg-muted rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
