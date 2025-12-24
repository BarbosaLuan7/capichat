import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  MessageSquare,
  Upload,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useLeads, useDeleteLead } from '@/hooks/useLeads';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useLabels } from '@/hooks/useLabels';
import { useProfiles } from '@/hooks/useProfiles';
import { LeadModal } from '@/components/leads/LeadModal';
import { LeadImportModal } from '@/components/leads/LeadImportModal';
import { BulkActionsBar } from '@/components/leads/BulkActionsBar';
import { LeadFilters, LeadFiltersState } from '@/components/leads/LeadFilters';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { cn } from '@/lib/utils';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const Leads = () => {
  const navigate = useNavigate();
  const { data: leads, isLoading } = useLeads();
  const { data: funnelStages } = useFunnelStages();
  const { data: allLabels } = useLabels();
  const { data: profiles } = useProfiles();
  const deleteLead = useDeleteLead();
  
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFiltersState>({
    stageId: null,
    labelIds: [],
    temperature: null,
    assignedTo: null,
    dateRange: undefined,
  });
  const [importModalOpen, setImportModalOpen] = useState(false);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    
    return leads.filter((lead) => {
      // Search filter
      const matchesSearch =
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Stage filter
      if (filters.stageId && lead.stage_id !== filters.stageId) return false;

      // Temperature filter
      if (filters.temperature && lead.temperature !== filters.temperature) return false;

      // Assigned to filter
      if (filters.assignedTo && lead.assigned_to !== filters.assignedTo) return false;

      // Labels filter (any of selected labels)
      if (filters.labelIds.length > 0) {
        const leadLabelIds = (lead as any).lead_labels?.map((ll: any) => ll.label_id) || [];
        const hasAnyLabel = filters.labelIds.some((labelId) => leadLabelIds.includes(labelId));
        if (!hasAnyLabel) return false;
      }

      // Date range filter
      if (filters.dateRange?.from) {
        const leadDate = new Date(lead.created_at);
        const from = startOfDay(filters.dateRange.from);
        const to = filters.dateRange.to ? endOfDay(filters.dateRange.to) : endOfDay(filters.dateRange.from);
        
        if (!isWithinInterval(leadDate, { start: from, end: to })) return false;
      }

      return true;
    });
  }, [leads, searchQuery, filters]);

  const getStage = (stageId: string | null) => funnelStages?.find((s) => s.id === stageId);
  const getLabels = (leadLabels: any[] | undefined) => {
    if (!leadLabels) return [];
    return leadLabels.map((ll: any) => ll.labels).filter(Boolean);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelect = (leadId: string) => {
    if (selectedLeads.includes(leadId)) {
      setSelectedLeads(selectedLeads.filter((id) => id !== leadId));
    } else {
      setSelectedLeads([...selectedLeads, leadId]);
    }
  };

  const handleViewLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setModalMode('view');
    setModalOpen(true);
  };

  const handleEditLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleNewLead = () => {
    setSelectedLeadId(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleDeleteClick = (leadId: string) => {
    setLeadToDelete(leadId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (leadToDelete) {
      try {
        await deleteLead.mutateAsync(leadToDelete);
        toast.success('Lead excluído');
      } catch (error) {
        toast.error('Erro ao excluir lead');
      }
    }
    setDeleteDialogOpen(false);
    setLeadToDelete(null);
  };

  return (
    <div className="p-6 space-y-6">
      <PageBreadcrumb items={[{ label: 'Leads' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">
            {leads?.length || 0} leads no total · {filteredLeads.length} exibidos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            Importar CSV
          </Button>
          <Button onClick={handleNewLead} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <LeadFilters
            filters={filters}
            onFiltersChange={setFilters}
            funnelStages={funnelStages || []}
            labels={allLabels || []}
            profiles={profiles || []}
          />
        </div>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedLeads}
        onClearSelection={() => setSelectedLeads([])}
      />

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <Button variant="ghost" className="gap-2 -ml-4 font-semibold">
                  Lead
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              </TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead, index) => {
              const stage = getStage(lead.stage_id);
              const labels = getLabels((lead as any).lead_labels);

              return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="group"
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={(lead as any).avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`} />
                        <AvatarFallback>{lead.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{lead.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {labels.slice(0, 2).map((label) => (
                            <Badge
                              key={label.id}
                              className="text-xs h-5 border-0"
                              style={{ backgroundColor: label.color, color: 'white' }}
                            >
                              {label.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {lead.phone}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[150px]">{lead.email}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="font-medium"
                      style={{ borderColor: stage?.color, color: stage?.color }}
                    >
                      {stage?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        lead.temperature === 'hot' && 'bg-destructive/10 text-destructive',
                        lead.temperature === 'warm' && 'bg-warning/10 text-warning',
                        lead.temperature === 'cold' && 'bg-primary/10 text-primary'
                      )}
                    >
                      {lead.temperature === 'hot' ? '🔥 Quente' : lead.temperature === 'warm' ? '🌡️ Morno' : '❄️ Frio'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.estimated_value ? (
                      <span className="font-semibold text-success">
                        R$ {lead.estimated_value.toLocaleString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{lead.source}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2" onClick={() => handleViewLead(lead.id)}>
                          <Eye className="w-4 h-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Abrir conversa
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => handleEditLead(lead.id)}>
                          <Pencil className="w-4 h-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDeleteClick(lead.id)}>
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Lead Modal */}
      <LeadModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        leadId={selectedLeadId}
        mode={modalMode}
      />

      {/* Import Modal */}
      <LeadImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leads;
