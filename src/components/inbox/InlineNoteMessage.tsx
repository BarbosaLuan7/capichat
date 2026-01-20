import { memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lock, StickyNote } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface InlineNoteMessageProps {
  note: {
    id: string;
    content: string;
    created_at: string;
    profiles: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
    } | null;
  };
}

function InlineNoteMessageComponent({ note }: InlineNoteMessageProps) {
  return (
    <div className="my-2 flex justify-center">
      <div className="w-full max-w-md rounded-lg border border-warning/30 bg-warning/10 p-3">
        <div className="flex items-start gap-2">
          <div className="rounded-full bg-warning/20 p-1.5">
            <StickyNote className="h-3.5 w-3.5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={note.profiles?.avatar || undefined} />
                <AvatarFallback className="text-2xs">
                  {note.profiles?.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-warning-foreground">
                {note.profiles?.name || 'Usuário'}
              </span>
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-2xs ml-auto text-muted-foreground">
                {format(new Date(note.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

InlineNoteMessageComponent.displayName = 'InlineNoteMessage';

export const InlineNoteMessage = memo(
  InlineNoteMessageComponent,
  (prev, next) =>
    prev.note.id === next.note.id &&
    prev.note.content === next.note.content &&
    prev.note.created_at === next.note.created_at
);
