import { useState, useEffect, memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StickyNote, Send, Loader2, Check, Pencil, Trash2, X, MoreVertical } from 'lucide-react';
import {
  useInternalNotes,
  useCreateInternalNote,
  useUpdateInternalNote,
  useDeleteInternalNote,
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
      <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <StickyNote className="h-4 w-4" />
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
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : showSaved ? (
            <>
              <Check className="h-4 w-4" />
              Salvo ✓
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Adicionar Nota
            </>
          )}
        </Button>
      </div>

      <ScrollArea className="max-h-48">
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : notes?.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Nenhuma nota ainda</div>
        ) : (
          <div className="space-y-3">
            {notes?.map((noteItem) => {
              const profile = noteItem.profiles as { name?: string; avatar?: string | null } | null;
              return (
                <div
                  key={noteItem.id}
                  className="group rounded-lg border border-warning/20 bg-warning/10 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={
                          profile?.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.name}`
                        }
                      />
                      <AvatarFallback className="text-xs">
                        {profile?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">
                      {profile?.name || 'Usuário'}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
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
                          className="h-6 w-6 opacity-0 transition-opacity focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                          aria-label="Opções da nota"
                        >
                          <MoreVertical className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditNote(noteItem.id, noteItem.content)}
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteNoteId(noteItem.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
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
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 h-3 w-3" />
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
                          <X className="mr-1 h-3 w-3" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">{noteItem.content}</p>
                  )}
                </div>
              );
            })}
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
              {deleteNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Memoize para evitar re-renders desnecessários
export const InternalNotes = memo(InternalNotesComponent);
