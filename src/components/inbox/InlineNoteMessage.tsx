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

export function InlineNoteMessage({ note }: InlineNoteMessageProps) {
  return (
    <div className="flex justify-center my-2">
      <div className="max-w-md w-full bg-warning/10 border border-warning/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 rounded-full bg-warning/20">
            <StickyNote className="w-3.5 h-3.5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="w-5 h-5">
                <AvatarImage src={note.profiles?.avatar || undefined} />
                <AvatarFallback className="text-[10px]">
                  {note.profiles?.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-warning-foreground">
                {note.profiles?.name || 'Usuário'}
              </span>
              <Lock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground ml-auto">
                {format(new Date(note.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {note.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
