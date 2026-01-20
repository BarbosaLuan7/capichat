import { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { normalizePhoneNumber } from '@/lib/masks';
import { supabase } from '@/integrations/supabase/client';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface LeadImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedLead {
  name: string;
  phone: string;
  normalizedPhone: string;
  stageName: string;
  mappedStageId: string | null;
  internalNotes: string;
  isValid: boolean;
  isDuplicate?: boolean;
  error?: string;
}

// Mapeamento de fases do CSV para os stages do sistema
const STAGE_MAPPING: Record<string, string> = {
  '🟢📞 atendimento inicial': '📞 Atendimento Inicial',
  'atendimento inicial': '📞 Atendimento Inicial',
  '📅📌 reunião agendada': '📅 Reunião Agendada',
  'reunião agendada': '📅 Reunião Agendada',
  '📎🗂 aguardando docs. complementares': '📎 Aguardando Docs',
  'aguardando docs. complementares': '📎 Aguardando Docs',
  'aguardando docs': '📎 Aguardando Docs',
  '✍️✅ assinado': '✍️ Assinado',
  assinado: '✍️ Assinado',
  '❌ lead perdido': '🔴 Encerrado',
  'lead perdido': '🔴 Encerrado',
  '⏰ chamar no próximo mês': '📅 Reunião Agendada',
  'chamar no próximo mês': '📅 Reunião Agendada',
  '🚨 elaborar pasta': '🚨 Elaborar Pasta',
  'elaborar pasta': '🚨 Elaborar Pasta',
  '📃 contrato enviado': '📃 Contrato Enviado',
  'contrato enviado': '📃 Contrato Enviado',
  '⏳ aguardando processual': '⏳ Aguardando Processual',
  'aguardando processual': '⏳ Aguardando Processual',
  '🏛️ andamento processual': '🏛️ Andamento Processual',
  'andamento processual': '🏛️ Andamento Processual',
  '🗂️ aguardando inss': '🗂️ Aguardando INSS',
  'aguardando inss': '🗂️ Aguardando INSS',
  '❌ em recurso': '❌ Em Recurso',
  'em recurso': '❌ Em Recurso',
  '🎉 benefício concedido': '🎉 Benefício Concedido',
  'benefício concedido': '🎉 Benefício Concedido',
  encerrado: '🔴 Encerrado',
};

type Step = 'upload' | 'preview' | 'importing' | 'complete';

export function LeadImportModal({ open, onOpenChange }: LeadImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const { data: funnelStages } = useFunnelStages();
  const queryClient = useQueryClient();

  const getStageIdByName = useCallback(
    (stageName: string): string | null => {
      if (!funnelStages || !stageName) return null;

      const normalizedInput = stageName.toLowerCase().trim();
      const mappedName = STAGE_MAPPING[normalizedInput];

      if (mappedName) {
        const stage = funnelStages.find((s) => s.name === mappedName);
        return stage?.id || null;
      }

      // Fallback: busca direta pelo nome
      const stage = funnelStages.find(
        (s) =>
          s.name.toLowerCase().includes(normalizedInput) ||
          normalizedInput.includes(s.name.toLowerCase())
      );
      return stage?.id || null;
    },
    [funnelStages]
  );

  const parseCSV = useCallback(
    (text: string): ParsedLead[] => {
      const lines = text.split('\n');
      if (lines.length < 2) return [];

      // Parse header
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine);

      // Find column indices
      const nameIdx = headers.findIndex(
        (h) => h.toLowerCase().includes('contato-1') || h.toLowerCase() === 'nome'
      );
      const phoneIdx = headers.findIndex(
        (h) => h.toLowerCase().includes('contatotelefone') || h.toLowerCase().includes('telefone')
      );
      const stageIdx = headers.findIndex(
        (h) => h.toLowerCase() === 'fase' || h.toLowerCase() === 'etapa'
      );
      const descIdx = headers.findIndex(
        (h) =>
          h.toLowerCase() === 'descrição' ||
          h.toLowerCase() === 'descricao' ||
          h.toLowerCase() === 'observações'
      );

      const leads: ParsedLead[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);

        const name = values[nameIdx]?.trim() || '';
        const phone = values[phoneIdx]?.trim() || '';
        const stageName = values[stageIdx]?.trim() || '';
        const internalNotes = values[descIdx]?.trim() || '';

        if (!name && !phone) continue;

        const normalizedPhone = normalizePhoneNumber(phone);
        const mappedStageId = getStageIdByName(stageName);

        const isValid = !!name && normalizedPhone.length >= 10 && normalizedPhone.length <= 11;

        leads.push({
          name,
          phone,
          normalizedPhone,
          stageName,
          mappedStageId,
          internalNotes,
          isValid,
          error: !name
            ? 'Nome obrigatório'
            : normalizedPhone.length < 10
              ? 'Telefone inválido'
              : undefined,
        });
      }

      return leads;
    },
    [getStageIdByName]
  );

  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV');
        return;
      }

      const text = await file.text();
      const leads = parseCSV(text);

      if (leads.length === 0) {
        toast.error('Nenhum lead encontrado no arquivo');
        return;
      }

      // Check for duplicates against existing leads
      const { data: existingLeads } = await supabase.from('leads').select('phone');

      const existingPhones = new Set(
        existingLeads?.map((l) => normalizePhoneNumber(l.phone)) || []
      );

      const leadsWithDuplicates = leads.map((lead) => ({
        ...lead,
        isDuplicate: existingPhones.has(lead.normalizedPhone),
      }));

      setParsedLeads(leadsWithDuplicates);
      setStep('preview');
    },
    [parseCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const validLeads = useMemo(
    () => parsedLeads.filter((l) => l.isValid && !l.isDuplicate),
    [parsedLeads]
  );

  const duplicateLeads = useMemo(() => parsedLeads.filter((l) => l.isDuplicate), [parsedLeads]);

  const invalidLeads = useMemo(() => parsedLeads.filter((l) => !l.isValid), [parsedLeads]);

  const handleImport = async () => {
    if (validLeads.length === 0) {
      toast.error('Nenhum lead válido para importar');
      return;
    }

    setStep('importing');
    setProgress(0);
    setImportedCount(0);
    setSkippedCount(duplicateLeads.length);
    setErrorCount(invalidLeads.length);

    const batchSize = 50;
    const batches = Math.ceil(validLeads.length / batchSize);
    let imported = 0;
    let errors = invalidLeads.length;

    for (let i = 0; i < batches; i++) {
      const batch = validLeads.slice(i * batchSize, (i + 1) * batchSize);

      const leadsToInsert = batch.map((lead) => ({
        name: lead.name,
        phone: lead.normalizedPhone,
        stage_id: lead.mappedStageId,
        internal_notes: lead.internalNotes || null,
        source: 'importação',
      }));

      const { error } = await supabase.from('leads').insert(leadsToInsert);

      if (error) {
        logger.error('Batch insert error:', error);
        errors += batch.length;
      } else {
        imported += batch.length;
      }

      setImportedCount(imported);
      setErrorCount(errors);
      setProgress(Math.round(((i + 1) / batches) * 100));
    }

    setStep('complete');
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    toast.success(`${imported} leads importados com sucesso!`);
  };

  const handleClose = () => {
    setStep('upload');
    setParsedLeads([]);
    setProgress(0);
    setImportedCount(0);
    setSkippedCount(0);
    setErrorCount(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Leads via CSV
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Arraste ou selecione um arquivo CSV para importar leads.'}
            {step === 'preview' &&
              `${parsedLeads.length} leads encontrados. Revise antes de importar.`}
            {step === 'importing' && 'Importando leads em lotes...'}
            {step === 'complete' && 'Importação concluída!'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'} `}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium">Arraste seu arquivo CSV aqui</p>
              <p className="mb-4 text-sm text-muted-foreground">ou clique para selecionar</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>Selecionar arquivo</span>
                </Button>
              </label>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="flex h-full flex-col gap-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-4">
                <Badge variant="outline" className="gap-2 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {validLeads.length} válidos
                </Badge>
                <Badge variant="outline" className="gap-2 px-3 py-1.5">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  {duplicateLeads.length} duplicados
                </Badge>
                <Badge variant="outline" className="gap-2 px-3 py-1.5">
                  <X className="h-4 w-4 text-destructive" />
                  {invalidLeads.length} inválidos
                </Badge>
              </div>

              {/* Preview Table */}
              <ScrollArea className="flex-1 rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedLeads.slice(0, 100).map((lead, idx) => (
                      <TableRow
                        key={idx}
                        className={lead.isDuplicate || !lead.isValid ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          {lead.isDuplicate ? (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          ) : lead.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <X className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{lead.name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {lead.normalizedPhone || lead.phone}
                        </TableCell>
                        <TableCell>
                          {lead.mappedStageId ? (
                            <Badge variant="outline" className="text-xs">
                              {funnelStages?.find((s) => s.id === lead.mappedStageId)?.name}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {lead.stageName || '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {lead.internalNotes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedLeads.length > 100 && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    ... e mais {parsedLeads.length - 100} leads
                  </p>
                )}
              </ScrollArea>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button onClick={handleImport} disabled={validLeads.length === 0}>
                  Importar {validLeads.length} leads
                </Button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-lg">Importando leads...</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="text-center text-muted-foreground">
                {importedCount} de {validLeads.length} leads importados ({progress}%)
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="space-y-6 py-8 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
              <div>
                <h3 className="mb-2 text-xl font-semibold">Importação Concluída!</h3>
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    <strong className="text-success">{importedCount}</strong> leads importados com
                    sucesso
                  </p>
                  {skippedCount > 0 && (
                    <p>
                      <strong className="text-warning">{skippedCount}</strong> duplicados ignorados
                    </p>
                  )}
                  {errorCount > 0 && (
                    <p>
                      <strong className="text-destructive">{errorCount}</strong> com erros
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
