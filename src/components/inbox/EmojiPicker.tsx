import { useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
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

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: any) => {
    onEmojiSelect(emoji.native);
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
      <PopoverContent className="w-auto p-0 border-0" align="end" side="top">
        <Picker
          data={data}
          onEmojiSelect={handleSelect}
          theme="auto"
          locale="pt"
          previewPosition="none"
          skinTonePosition="search"
        />
      </PopoverContent>
    </Popover>
  );
}
