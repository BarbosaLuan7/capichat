import { useState, useEffect, memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  StickyNote, 
  Send, 
  Loader2, 
  Check, 
  Pencil, 
  Trash2, 
  X,
  MoreVertical 
} from 'lucide-react';
import { 
  useInternalNotes, 
  useCreateInternalNote, 
  useUpdateInternalNote, 
  useDeleteInternalNote 
} from '@/hooks/useInternalNotes';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface InternalNotesProps {
  conversationId: string;
}

function InternalNotesComponent({ conversationId }: InternalNotesProps) {
  const [note, setNote] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  
  const { data: notes, isLoading } = useInternalNotes(conversationId);
  const createNote = useCreateInternalNote();
  const updateNote = useUpdateInternalNote();
  const deleteNote = useDeleteInternalNote();

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

  const handleEditNote = (noteId: string, content: string) => {
    setEditingNoteId(noteId);
    setEditingContent(content);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editingContent.trim()) return;

    try {
      await updateNote.mutateAsync({
        noteId: editingNoteId,
        content: editingContent,
      });
      setEditingNoteId(null);
      setEditingContent('');
      toast.success('Nota atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar nota');
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;

    try {
      await deleteNote.mutateAsync(deleteNoteId);
      setDeleteNoteId(null);
      toast.success('Nota excluída');
    } catch (error) {
      toast.error('Erro ao excluir nota');
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
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
            {notes?.map((noteItem) => (
              <div
                key={noteItem.id}
                className="p-3 bg-warning/10 border border-warning/20 rounded-lg group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={
                        (noteItem as any).profiles?.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${(noteItem as any).profiles?.name}`
                      }
                    />
                    <AvatarFallback className="text-xs">
                      {(noteItem as any).profiles?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">
                    {(noteItem as any).profiles?.name || 'Usuário'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(noteItem.created_at), "dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                  
                  {/* Edit/Delete Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity"
                        aria-label="Opções da nota"
                      >
                        <MoreVertical className="w-3 h-3" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditNote(noteItem.id, noteItem.content)}>
                        <Pencil className="w-3 h-3 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeleteNoteId(noteItem.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {editingNoteId === noteItem.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateNote.isPending}
                        className="h-7 text-xs"
                      >
                        {updateNote.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Salvar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-7 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground">{noteItem.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A nota será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNote.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Memoize para evitar re-renders desnecessários
export const InternalNotes = memo(InternalNotesComponent);
