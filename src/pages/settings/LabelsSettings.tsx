import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  MoreVertical,
  Tag,
  Folder,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useToast } from '@/hooks/use-toast';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { LabelModal } from '@/components/labels/LabelModal';
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel } from '@/hooks/useLabels';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { getContrastTextColor } from '@/lib/utils';

type LabelCategory = Database['public']['Enums']['label_category'];
type LabelRow = Database['public']['Tables']['labels']['Row'];

const CATEGORY_LABELS: Partial<Record<LabelCategory, string>> = {
  beneficio: 'Tipo de Benefício',
  condicao_saude: 'Condição de Saúde',
  status: 'Status/Workflow',
  interesse: 'Interesse',
  desqualificacao: 'Desqualificação',
  situacao: 'Situação',
  perda: 'Motivo de Perda',
};

const CATEGORY_COLORS: Partial<Record<LabelCategory, string>> = {
  beneficio: 'bg-green-500/10 text-green-600',
  condicao_saude: 'bg-red-500/10 text-red-600',
  status: 'bg-purple-500/10 text-purple-600',
  interesse: 'bg-cyan-500/10 text-cyan-600',
  desqualificacao: 'bg-gray-500/10 text-muted-foreground',
  situacao: 'bg-yellow-500/10 text-yellow-600',
  perda: 'bg-rose-500/10 text-rose-600',
};

const LabelsSettings = () => {
  const { data: labels = [], isLoading } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<LabelRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<LabelRow | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const filteredLabels = useMemo(() => labels.filter((label) => {
    const matchesSearch = label.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || label.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [labels, debouncedSearch, categoryFilter]);

  // Group by category for stats
  const categoryStats = labels.reduce((acc, label) => {
    acc[label.category] = (acc[label.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSave = async (data: { name: string; color: string; category: LabelCategory }) => {
    try {
      if (selectedLabel) {
        await updateLabel.mutateAsync({ id: selectedLabel.id, ...data });
        toast({ title: 'Etiqueta atualizada com sucesso!' });
      } else {
        await createLabel.mutateAsync(data);
        toast({ title: 'Etiqueta criada com sucesso!' });
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar etiqueta', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!labelToDelete) return;
    try {
      await deleteLabel.mutateAsync(labelToDelete.id);
      toast({ title: 'Etiqueta excluída' });
      setDeleteDialogOpen(false);
      setLabelToDelete(null);
    } catch (error) {
      toast({ title: 'Erro ao excluir etiqueta', variant: 'destructive' });
    }
  };

  const openEditModal = (label: LabelRow) => {
    setSelectedLabel(label);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedLabel(null);
    setModalOpen(true);
  };

  const confirmDelete = (label: LabelRow) => {
    setLabelToDelete(label);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Configurações', href: '/settings' }, { label: 'Etiquetas' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Etiquetas</h1>
          <p className="text-muted-foreground">Gerencie as etiquetas do sistema</p>
        </div>
        <Button onClick={openCreateModal} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Nova Etiqueta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{labels.length}</p>
                <p className="text-sm text-muted-foreground">Total de Etiquetas</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {Object.entries(categoryStats).slice(0, 3).map(([cat, count], i) => (
          <motion.div
            key={cat}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + 1) * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Folder className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {CATEGORY_LABELS[cat as LabelCategory]}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar etiqueta..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Carregando etiquetas...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLabels.map((label) => (
                  <TableRow key={label.id}>
                    <TableCell>
                      <Badge
                        style={{ backgroundColor: label.color }}
                        className={getContrastTextColor(label.color)}
                      >
                        {label.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={CATEGORY_COLORS[label.category]} variant="secondary">
                        {CATEGORY_LABELS[label.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(label.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mais opções</TooltipContent>
                          </Tooltip>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(label)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => confirmDelete(label)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredLabels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {search || categoryFilter !== 'all'
                        ? 'Nenhuma etiqueta encontrada com os filtros aplicados'
                        : 'Nenhuma etiqueta cadastrada. Crie a primeira!'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LabelModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        label={selectedLabel}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etiqueta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etiqueta "{labelToDelete?.name}"? Esta ação
              não pode ser desfeita e removerá a etiqueta de todos os leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LabelsSettings;
