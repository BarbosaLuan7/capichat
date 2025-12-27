import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Copy, Zap, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useTemplates, useDeleteTemplate, useCreateTemplate } from '@/hooks/useTemplates';
import { TemplateModal } from '@/components/templates/TemplateModal';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Template = Database['public']['Tables']['templates']['Row'];

export default function TemplatesSettings() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const createTemplate = useCreateTemplate();

  const filteredTemplates = templates?.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      template.content.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setModalOpen(true);
  };

  const handleDelete = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      try {
        await deleteTemplate.mutateAsync(templateToDelete.id);
        toast.success('Template excluído com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir template');
      }
    }
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  const handleDuplicate = async (template: Template) => {
    try {
      await createTemplate.mutateAsync({
        name: `${template.name} (cópia)`,
        shortcut: `${template.shortcut}-copia`,
        content: template.content,
      });
      toast.success('Template duplicado com sucesso!');
    } catch (error) {
      toast.error('Erro ao duplicar template');
    }
  };

  const handleCopyShortcut = (shortcut: string) => {
    navigator.clipboard.writeText(`/${shortcut}`);
    toast.success('Atalho copiado!');
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setModalOpen(true);
  };

  const truncateContent = (content: string, maxLength = 60) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageBreadcrumb
        items={[
          { label: 'Configurações', href: '/settings' },
          { label: 'Templates' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Mensagens</h1>
          <p className="text-muted-foreground">
            Crie e gerencie mensagens rápidas com variáveis dinâmicas
          </p>
        </div>
        <Button onClick={handleNewTemplate} className="bg-gradient-to-r from-primary to-primary/80">
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Templates</CardDescription>
            <CardTitle className="text-3xl">{templates?.length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">mensagens rápidas disponíveis</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Dica de Uso</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Como usar os templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No chat, digite <Badge variant="outline">/atalho</Badge> para inserir rapidamente um
              template. As variáveis como <Badge variant="outline">{'{{nome}}'}</Badge> serão
              substituídas automaticamente pelos dados do lead.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, atalho ou conteúdo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando templates...</div>
          ) : filteredTemplates?.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {search ? 'Nenhum template encontrado' : 'Nenhum template cadastrado'}
              </p>
              {!search && (
                <Button variant="outline" className="mt-4" onClick={handleNewTemplate}>
                  Criar primeiro template
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome e Atalho</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates?.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{template.name}</p>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => handleCopyShortcut(template.shortcut)}
                          title="Clique para copiar"
                        >
                          /{template.shortcut}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">
                        {truncateContent(template.content)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(template.created_at), "dd 'de' MMM, yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mais opções</TooltipContent>
                          </Tooltip>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(template)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <TemplateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={selectedTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{templateToDelete?.name}"? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
