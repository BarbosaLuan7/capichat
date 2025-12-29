import { useState, useEffect, useMemo, forwardRef } from 'react';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { useCreateLead } from '@/hooks/useLeads';
import { useCreateConversation } from '@/hooks/useConversations';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useWhatsAppConfigs } from '@/hooks/useWhatsAppConfig';
import { formatPhoneNumber } from '@/lib/masks';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated?: (conversationId: string) => void;
}

interface ExistingLead {
  id: string;
  name: string;
  phone: string;
}

// Códigos de país com Brasil no topo
const COUNTRY_CODES = [
  { code: '55', country: 'Brasil', flag: '🇧🇷' },
  { code: '1', country: 'EUA/Canadá', flag: '🇺🇸' },
  { code: '54', country: 'Argentina', flag: '🇦🇷' },
  { code: '595', country: 'Paraguai', flag: '🇵🇾' },
  { code: '598', country: 'Uruguai', flag: '🇺🇾' },
  { code: '56', country: 'Chile', flag: '🇨🇱' },
  { code: '57', country: 'Colômbia', flag: '🇨🇴' },
  { code: '51', country: 'Peru', flag: '🇵🇪' },
  { code: '58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '351', country: 'Portugal', flag: '🇵🇹' },
  { code: '34', country: 'Espanha', flag: '🇪🇸' },
  { code: '39', country: 'Itália', flag: '🇮🇹' },
  { code: '49', country: 'Alemanha', flag: '🇩🇪' },
  { code: '33', country: 'França', flag: '🇫🇷' },
  { code: '44', country: 'Reino Unido', flag: '🇬🇧' },
];

export const NewConversationModal = forwardRef<HTMLDivElement, NewConversationModalProps>(
  function NewConversationModal({
    open,
    onOpenChange,
    onConversationCreated,
  }, ref) {
  const { user } = useAuth();
  
  // Form state
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [countryCode, setCountryCode] = useState('55'); // Brasil padrão
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  
  // Validation state
  const [isCheckingDuplicity, setIsCheckingDuplicity] = useState(false);
  const [existingLead, setExistingLead] = useState<ExistingLead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Hooks
  const createLead = useCreateLead();
  const createConversation = useCreateConversation();
  const { data: funnelStages } = useFunnelStages();
  const { data: whatsappConfigs, isLoading: isLoadingConfigs } = useWhatsAppConfigs();
  
  // Filter active WhatsApp instances
  const activeInstances = useMemo(() => {
    return whatsappConfigs?.filter(c => c.is_active) || [];
  }, [whatsappConfigs]);
  
  // Auto-select if only one instance
  useEffect(() => {
    if (activeInstances.length === 1 && !selectedInstanceId) {
      setSelectedInstanceId(activeInstances[0].id);
    }
  }, [activeInstances, selectedInstanceId]);
  
  // Get first funnel stage
  const firstStage = useMemo(() => {
    if (!funnelStages || funnelStages.length === 0) return null;
    return funnelStages.sort((a, b) => a.order - b.order)[0];
  }, [funnelStages]);
  
  // Phone normalization - remove non-digits
  const normalizedPhone = useMemo(() => {
    return phone.replace(/\D/g, '');
  }, [phone]);
  
  // Full phone with country code
  const fullPhoneNumber = useMemo(() => {
    return `${countryCode}${normalizedPhone}`;
  }, [countryCode, normalizedPhone]);
  
  // Phone validation - basic length check
  const isPhoneValid = useMemo(() => {
    // Mínimo de 8 dígitos para números internacionais
    if (normalizedPhone.length < 8) return false;
    
    // Para Brasil, validar DDD e 9º dígito para celular
    if (countryCode === '55') {
      if (normalizedPhone.length < 10 || normalizedPhone.length > 11) return false;
      // Se tem 11 dígitos, deve começar com 9 (celular)
      if (normalizedPhone.length === 11 && normalizedPhone[2] !== '9') return false;
    }
    
    return true;
  }, [normalizedPhone, countryCode]);
  
  // Check for duplicate phone with debounce
  useEffect(() => {
    if (!isPhoneValid || normalizedPhone.length < 8) {
      setExistingLead(null);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setIsCheckingDuplicity(true);
      try {
        // Buscar pelo número completo com código do país
        const { data, error } = await supabase
          .from('leads')
          .select('id, name, phone')
          .eq('phone', fullPhoneNumber)
          .maybeSingle();
        
        if (error) {
          logger.error('[NewConversation] Error checking phone duplicity:', error);
        } else {
          setExistingLead(data);
        }
      } catch (error) {
        logger.error('[NewConversation] Error checking phone duplicity:', error);
      } finally {
        setIsCheckingDuplicity(false);
      }
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [fullPhoneNumber, isPhoneValid, normalizedPhone.length]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setPhone('');
      setName('');
      setCountryCode('55');
      setExistingLead(null);
      // Manter instância selecionada se só tiver uma
      if (activeInstances.length !== 1) {
        setSelectedInstanceId('');
      }
    }
  }, [open, activeInstances.length]);
  
  // Generate default name from phone
  const getDefaultName = () => {
    if (name.trim()) return name.trim();
    const lastDigits = normalizedPhone.slice(-4);
    return `Lead +${countryCode} ...${lastDigits}`;
  };
  
  // Open existing conversation
  const handleOpenExisting = async () => {
    if (!existingLead) return;
    
    // Find existing conversation for this lead
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('lead_id', existingLead.id)
      .maybeSingle();
    
    if (existingConversation) {
      onOpenChange(false);
      onConversationCreated?.(existingConversation.id);
    } else {
      toast.info('Lead existe mas não tem conversa. Criando nova conversa...');
      // Create conversation for existing lead
      await createConversationForLead(existingLead.id);
    }
  };
  
  // Create conversation for a lead
  const createConversationForLead = async (leadId: string) => {
    try {
      const conversation = await createConversation.mutateAsync({
        lead_id: leadId,
        assigned_to: user?.id,
        status: 'open',
        whatsapp_instance_id: selectedInstanceId || null,
      });
      
      toast.success('Conversa criada com sucesso!');
      onOpenChange(false);
      onConversationCreated?.(conversation.id);
      return conversation;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar conversa';
      toast.error(msg);
      throw error;
    }
  };
  
  // Main creation flow
  const handleCreate = async () => {
    if (!isPhoneValid || !user) {
      toast.error('Número de telefone inválido');
      return;
    }
    
    if (!selectedInstanceId) {
      toast.error('Selecione uma instância WhatsApp');
      return;
    }
    
    if (existingLead) {
      toast.error('Este número já está cadastrado');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 1. Create lead
      const lead = await createLead.mutateAsync({
        name: getDefaultName(),
        phone: fullPhoneNumber,
        source: 'manual',
        stage_id: firstStage?.id || null,
        assigned_to: user.id,
        temperature: 'warm',
      });
      
      logger.log('[NewConversation] Lead created:', lead.id);
      
      // 2. Create conversation with whatsapp_instance_id
      const conversation = await createConversation.mutateAsync({
        lead_id: lead.id,
        assigned_to: user.id,
        status: 'open',
        whatsapp_instance_id: selectedInstanceId,
      });
      
      logger.log('[NewConversation] Conversation created:', conversation.id);
      
      toast.success('Conversa criada com sucesso!');
      
      // 3. Close modal and select conversation
      onOpenChange(false);
      onConversationCreated?.(conversation.id);
      
    } catch (error) {
      logger.error('[NewConversation] Error:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao criar conversa';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle schedule (placeholder for future functionality)
  const handleSchedule = () => {
    toast.info('Funcionalidade de agendamento em breve!');
  };
  
  // Validation state indicator
  const PhoneValidationIndicator = () => {
    if (isCheckingDuplicity) {
      return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    }
    if (normalizedPhone.length >= 8) {
      if (existingLead) {
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      }
      if (isPhoneValid) {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      }
    }
    return null;
  };
  
  const canSubmit = isPhoneValid && !existingLead && !isSubmitting && !isCheckingDuplicity && !!selectedInstanceId;
  
  // Format display for selected instance
  const getInstanceDisplay = (config: typeof activeInstances[0]) => {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="truncate">{config.name}</span>
        {config.phone_number && (
          <span className="text-muted-foreground text-xs">
            ({formatPhoneNumber(config.phone_number)})
          </span>
        )}
      </div>
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Nova conversa
          </DialogTitle>
          <DialogDescription>
            Inicie um novo atendimento no WhatsApp
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* WhatsApp Instance Selector */}
          <div className="space-y-2">
            <Label htmlFor="instance">Instância WhatsApp *</Label>
            {isLoadingConfigs ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando instâncias...
              </div>
            ) : activeInstances.length === 0 ? (
              <Alert>
                <AlertDescription className="text-sm">
                  Nenhuma instância WhatsApp configurada.{' '}
                  <a href="/settings/whatsapp" className="text-primary hover:underline">
                    Configurar agora →
                  </a>
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância..." />
                </SelectTrigger>
                <SelectContent>
                  {activeInstances.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {getInstanceDisplay(config)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Phone Field with Country Selector */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp *</Label>
            <div className="flex gap-2">
              {/* Country Code Selector */}
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[110px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-1.5">
                        <span>{c.flag}</span>
                        <span>+{c.code}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Phone Input */}
              <div className="relative flex-1">
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={countryCode === '55' ? '45 99999-5785' : 'Número'}
                  className="pr-10"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <PhoneValidationIndicator />
                </div>
              </div>
            </div>
            
            {/* Duplicate Warning */}
            {existingLead && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sm">
                    Número cadastrado como <strong>{existingLead.name}</strong>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenExisting}
                    className="ml-2 gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Abrir
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          {/* Name Field (Secondary) */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome do contato <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deixe em branco se desconhecido"
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, será criado como "Lead +{countryCode} ...{normalizedPhone.slice(-4) || 'XXXX'}"
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {/* Schedule Option */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleSchedule}
            disabled={!canSubmit}
          >
            <Clock className="w-4 h-4" />
            Agendar
          </Button>
          
          {/* Main Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Iniciar Atendimento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
