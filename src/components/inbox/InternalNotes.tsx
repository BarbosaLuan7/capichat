import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StickyNote, Send, Loader2, Check } from 'lucide-react';
import { useInternalNotes, useCreateInternalNote } from '@/hooks/useInternalNotes';
import { toast } from 'sonner';

interface InternalNotesProps {
  conversationId: string;
}

export function InternalNotes({ conversationId }: InternalNotesProps) {
  const [note, setNote] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const { data: notes, isLoading } = useInternalNotes(conversationId);
  const createNote = useCreateInternalNote();

  // Show "Salvo" feedback briefly after successful save
  useEffect(() => {
    if (showSaved) {
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSaved]);

  const handleAddNote = async () => {
    if (!note.trim()) return;

    try {
      await createNote.mutateAsync({
        conversationId,
        content: note,
      });
      setNote('');
      setShowSaved(true);
      toast.success('Nota adicionada');
    } catch (error) {
      toast.error('Erro ao adicionar nota');
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
        <StickyNote className="w-4 h-4" />
        NOTAS INTERNAS
      </h4>

      <div className="space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Adicionar nota interna..."
          className="min-h-[80px] resize-none"
        />
        <Button
          size="sm"
          onClick={handleAddNote}
          disabled={!note.trim() || createNote.isPending}
          className="w-full gap-2"
        >
          {createNote.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : showSaved ? (
            <>
              <Check className="w-4 h-4" />
              Salvo ✓
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Adicionar Nota
            </>
          )}
        </Button>
      </div>

      <ScrollArea className="max-h-48">
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            Carregando...
          </div>
        ) : notes?.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            Nenhuma nota ainda
          </div>
        ) : (
          <div className="space-y-3">
            {notes?.map((note) => (
              <div
                key={note.id}
                className="p-3 bg-warning/10 border border-warning/20 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={
                        (note as any).profiles?.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${(note as any).profiles?.name}`
                      }
                    />
                    <AvatarFallback className="text-xs">
                      {(note as any).profiles?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">
                    {(note as any).profiles?.name || 'Usuário'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(note.created_at), "dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <p className="text-sm text-foreground">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
