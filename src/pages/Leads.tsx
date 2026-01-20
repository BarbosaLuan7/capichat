import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { Search, Plus, ArrowUpDown, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { BulkActionsBar } from '@/components/leads/BulkActionsBar';
import { LeadFilters, LeadFiltersState } from '@/components/leads/LeadFilters';
import { LeadTableRow } from '@/components/leads/LeadTableRow';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

// Lazy load heavy modals
const LeadModal = lazy(() =>
  import('@/components/leads/LeadModal').then((m) => ({ default: m.LeadModal }))
);
const LeadImportModal = lazy(() =>
  import('@/components/leads/LeadImportModal').then((m) => ({ default: m.LeadImportModal }))
);

const PAGE_SIZE = 50;

const Leads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const { data: leadsData, isLoading } = useLeads(currentPage, PAGE_SIZE);
  const leads = leadsData?.leads || [];
  const totalCount = leadsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];

    return leads.filter((lead) => {
      // Search filter (using debounced value)
      const matchesSearch =
        lead.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        lead.phone.includes(debouncedSearchQuery) ||
        lead.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

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
        const to = filters.dateRange.to
          ? endOfDay(filters.dateRange.to)
          : endOfDay(filters.dateRange.from);

        if (!isWithinInterval(leadDate, { start: from, end: to })) return false;
      }

      return true;
    });
  }, [leads, debouncedSearchQuery, filters]);

  const getStage = (stageId: string | null) => funnelStages?.find((s) => s.id === stageId);
  const getLabels = (leadLabels: any[] | undefined) => {
    if (!leadLabels) return [];
    return leadLabels.map((ll: any) => ll.labels).filter(Boolean);
  };

  const toggleSelectAll = useCallback(() => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((l) => l.id));
    }
  }, [selectedLeads.length, filteredLeads]);

  const handleToggleSelect = useCallback((leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  }, []);

  const handleViewLead = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setModalMode('view');
    setModalOpen(true);
  }, []);

  const handleEditLead = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setModalMode('edit');
    setModalOpen(true);
  }, []);

  const handleNewLead = useCallback(() => {
    setSelectedLeadId(null);
    setModalMode('create');
    setModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((leadId: string) => {
    setLeadToDelete(leadId);
    setDeleteDialogOpen(true);
  }, []);

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

  const handleOpenConversation = useCallback(
    async (leadId: string) => {
      try {
        // Check for existing conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('lead_id', leadId)
          .maybeSingle();

        if (existingConv) {
          navigate(`/inbox?conversation=${existingConv.id}`);
        } else {
          // Create new conversation
          const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
              lead_id: leadId,
              status: 'open',
              assigned_to: user?.id,
            })
            .select('id')
            .single();

          if (error) throw error;
          navigate(`/inbox?conversation=${newConv.id}`);
        }
      } catch (error) {
        logger.error('Error opening conversation:', error);
        toast.error('Erro ao abrir conversa');
      }
    },
    [navigate, user?.id]
  );

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb items={[{ label: 'Leads' }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">
            {totalCount} leads no total · {filteredLeads.length} exibidos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button
            onClick={handleNewLead}
            className="gradient-primary gap-2 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[200px] max-w-xs" role="search">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
              aria-label="Buscar leads por nome, telefone ou email"
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
      <BulkActionsBar selectedIds={selectedLeads} onClearSelection={() => setSelectedLeads([])} />

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedLeads.length === filteredLeads.length && filteredLeads.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos os leads"
                />
              </TableHead>
              <TableHead>
                <Button variant="ghost" className="-ml-4 gap-2 font-semibold">
                  Lead
                  <ArrowUpDown className="h-4 w-4" />
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
                <LeadTableRow
                  key={lead.id}
                  lead={lead as any}
                  index={index}
                  isSelected={selectedLeads.includes(lead.id)}
                  stage={stage}
                  labels={labels}
                  onSelect={handleToggleSelect}
                  onView={handleViewLead}
                  onEdit={handleEditLead}
                  onDelete={handleDeleteClick}
                  onOpenConversation={handleOpenConversation}
                />
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={
                      currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                    }
                    aria-label="Página anterior"
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                    aria-label="Próxima página"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {/* Lead Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {modalOpen && (
          <LeadModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            leadId={selectedLeadId}
            mode={modalMode}
          />
        )}
      </Suspense>

      {/* Import Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {importModalOpen && (
          <LeadImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
        )}
      </Suspense>

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
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leads;
