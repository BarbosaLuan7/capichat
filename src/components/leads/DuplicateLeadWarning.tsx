import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Users, ExternalLink, GitMerge, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface DuplicateLead {
  id: string;
  name: string;
  phone: string;
  source: string;
  created_at: string;
}

interface DuplicateLeadWarningProps {
  currentLeadId: string;
  duplicates: DuplicateLead[];
  onMerge?: () => void;
  onDismiss?: () => void;
}

export function DuplicateLeadWarning({
  currentLeadId,
  duplicates,
  onMerge,
  onDismiss,
}: DuplicateLeadWarningProps) {
  const navigate = useNavigate();
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateLead | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  if (duplicates.length === 0) return null;

  const handleViewLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleMerge = async (keepLeadId: string, deleteLeadId: string) => {
    setIsMerging(true);
    try {
      // Transferir conversas do lead a ser deletado para o lead a manter
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ lead_id: keepLeadId })
        .eq('lead_id', deleteLeadId);

      if (updateError) throw updateError;

      // Transferir atividades
      await supabase
        .from('lead_activities')
        .update({ lead_id: keepLeadId })
        .eq('lead_id', deleteLeadId);

      // Deletar lead duplicado
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('id', deleteLeadId);

      if (deleteError) throw deleteError;

      toast.success('Leads mesclados com sucesso!');
      setShowMergeDialog(false);
      onMerge?.();
    } catch (error) {
      logger.error('Erro ao mesclar leads:', error);
      toast.error('Erro ao mesclar leads');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <>
      <Alert variant="destructive" className="border-warning bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Possíveis duplicatas encontradas</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            {duplicates.slice(0, 3).map((dup) => (
              <div 
                key={dup.id} 
                className="flex items-center justify-between p-2 bg-background/50 rounded-md"
              >
                <div>
                  <span className="font-medium">{dup.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {dup.phone}
                  </span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {dup.source}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewLead(dup.id)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDuplicate(dup);
                      setShowMergeDialog(true);
                    }}
                  >
                    <GitMerge className="w-3 h-3 mr-1" />
                    Mesclar
                  </Button>
                </div>
              </div>
            ))}
            {duplicates.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{duplicates.length - 3} outras duplicatas
              </p>
            )}
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={onDismiss}
            >
              <X className="w-3 h-3 mr-1" />
              Dispensar
            </Button>
          )}
        </AlertDescription>
      </Alert>

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5" />
              Mesclar Leads
            </DialogTitle>
            <DialogDescription>
              Escolha qual lead manter. As conversas e atividades serão transferidas.
            </DialogDescription>
          </DialogHeader>

          {selectedDuplicate && (
            <div className="space-y-4 py-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Lead atual</p>
                <p className="font-medium">Lead ID: {currentLeadId.slice(0, 8)}...</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Lead duplicado</p>
                <p className="font-medium">{selectedDuplicate.name}</p>
                <p className="text-sm text-muted-foreground">{selectedDuplicate.phone}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowMergeDialog(false)}
              disabled={isMerging}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => selectedDuplicate && handleMerge(currentLeadId, selectedDuplicate.id)}
              disabled={isMerging}
            >
              {isMerging ? 'Mesclando...' : 'Manter lead atual'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => selectedDuplicate && handleMerge(selectedDuplicate.id, currentLeadId)}
              disabled={isMerging}
            >
              {isMerging ? 'Mesclando...' : 'Manter duplicado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook para detectar leads duplicados
export function useDuplicateLeads(phone: string | undefined, currentLeadId?: string) {
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkDuplicates = async () => {
    if (!phone || phone.length < 8) {
      setDuplicates([]);
      return;
    }

    setIsChecking(true);
    try {
      // Normalizar telefone para busca
      const normalizedPhone = phone.replace(/\D/g, '');
      const last8Digits = normalizedPhone.slice(-8);

      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, source, created_at')
        .like('phone', `%${last8Digits}`)
        .neq('id', currentLeadId || '')
        .limit(10);

      if (error) throw error;

      setDuplicates(data || []);
    } catch (error) {
      logger.error('Erro ao verificar duplicatas:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return { duplicates, isChecking, checkDuplicates };
}
