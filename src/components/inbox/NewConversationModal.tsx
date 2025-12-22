import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Zap, ExternalLink } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MaskedInput } from '@/components/ui/masked-input';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCreateLead } from '@/hooks/useLeads';
import { useCreateConversation, useSendMessage } from '@/hooks/useConversations';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useTemplates } from '@/hooks/useTemplates';
import { normalizePhoneNumber, isValidPhone } from '@/lib/masks';

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

const BENEFIT_TYPES = [
  { value: 'bpc_idoso', label: 'BPC/LOAS Idoso (65+)' },
  { value: 'bpc_deficiente', label: 'BPC/LOAS Deficiente' },
  { value: 'bpc_autista', label: 'BPC/LOAS Autista' },
  { value: 'aposentadoria_idade', label: 'Aposentadoria por Idade' },
  { value: 'aposentadoria_tempo', label: 'Aposentadoria por Tempo' },
  { value: 'aposentadoria_especial', label: 'Aposentadoria Especial' },
  { value: 'aposentadoria_rural', label: 'Aposentadoria Rural' },
  { value: 'auxilio_doenca', label: 'Auxílio-Doença' },
  { value: 'auxilio_acidente', label: 'Auxílio-Acidente' },
  { value: 'pensao_morte', label: 'Pensão por Morte' },
  { value: 'salario_maternidade', label: 'Salário-Maternidade' },
  { value: 'auxilio_reclusao', label: 'Auxílio-Reclusão' },
  { value: 'outro', label: 'Outro' },
];

const ORIGIN_OPTIONS = [
  { value: 'facebook', label: 'Facebook Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'organico', label: 'Orgânico' },
  { value: 'manual', label: 'Manual' },
];

export function NewConversationModal({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Form state
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [benefitType, setBenefitType] = useState('');
  const [source, setSource] = useState('manual');
  const [message, setMessage] = useState('');
  
  // Validation state
  const [isCheckingDuplicity, setIsCheckingDuplicity] = useState(false);
  const [existingLead, setExistingLead] = useState<ExistingLead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Hooks
  const createLead = useCreateLead();
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const { data: funnelStages } = useFunnelStages();
  const { data: templates } = useTemplates();
  
  // Get first funnel stage
  const firstStage = useMemo(() => {
    if (!funnelStages || funnelStages.length === 0) return null;
    return funnelStages.sort((a, b) => a.order - b.order)[0];
  }, [funnelStages]);
  
  // Phone validation
  const normalizedPhone = useMemo(() => normalizePhoneNumber(phone), [phone]);
  const isPhoneValid = useMemo(() => isValidPhone(phone), [phone]);
  
  // Check for duplicate phone with debounce
  useEffect(() => {
    if (!isPhoneValid || normalizedPhone.length < 10) {
      setExistingLead(null);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setIsCheckingDuplicity(true);
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('id, name, phone')
          .eq('phone', normalizedPhone)
          .maybeSingle();
        
        if (error) {
          console.error('Error checking phone duplicity:', error);
        } else {
          setExistingLead(data);
        }
      } catch (error) {
        console.error('Error checking phone duplicity:', error);
      } finally {
        setIsCheckingDuplicity(false);
      }
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [normalizedPhone, isPhoneValid]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setPhone('');
      setName('');
      setBenefitType('');
      setSource('manual');
      setMessage('');
      setExistingLead(null);
      setShowTemplates(false);
    }
  }, [open]);
  
  // Generate default name from phone
  const getDefaultName = () => {
    if (name.trim()) return name.trim();
    const lastDigits = normalizedPhone.slice(-4);
    return `Lead ${lastDigits}`;
  };
  
  // Replace template variables
  const processMessage = (content: string) => {
    const leadName = getDefaultName();
    const firstName = leadName.split(' ')[0];
    
    return content
      .replace(/\{\{nome\}\}/gi, leadName)
      .replace(/\{\{primeiro_nome\}\}/gi, firstName);
  };
  
  // Handle template selection
  const handleSelectTemplate = (content: string) => {
    const processed = processMessage(content);
    setMessage(processed);
    setShowTemplates(false);
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
  const handleCreate = async (shouldSendMessage: boolean) => {
    if (!isPhoneValid || !user) {
      toast.error('Número de telefone inválido');
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
        phone: normalizedPhone,
        source: source,
        benefit_type: benefitType || null,
        stage_id: firstStage?.id || null,
        assigned_to: user.id,
        temperature: 'warm',
      });
      
      console.log('[NewConversation] Lead created:', lead.id);
      
      // 2. Create conversation
      const conversation = await createConversation.mutateAsync({
        lead_id: lead.id,
        assigned_to: user.id,
        status: 'open',
      });
      
      console.log('[NewConversation] Conversation created:', conversation.id);
      
      // 3. Send message if requested
      if (shouldSendMessage && message.trim()) {
        const processedMessage = processMessage(message);
        
        await sendMessage.mutateAsync({
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_type: 'agent',
          content: processedMessage,
          type: 'text',
        });
        
        console.log('[NewConversation] Message sent');
        toast.success('Conversa criada e mensagem enviada!');
      } else {
        toast.success('Conversa criada com sucesso!');
      }
      
      // 4. Close modal and select conversation
      onOpenChange(false);
      onConversationCreated?.(conversation.id);
      
    } catch (error) {
      console.error('[NewConversation] Error:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao criar conversa';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Validation state indicator
  const PhoneValidationIndicator = () => {
    if (isCheckingDuplicity) {
      return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    }
    if (normalizedPhone.length >= 10) {
      if (existingLead) {
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      }
      if (isPhoneValid) {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      }
    }
    return null;
  };
  
  const canSubmit = isPhoneValid && !existingLead && !isSubmitting && !isCheckingDuplicity;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Inicie uma nova conversa no WhatsApp
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Phone Field */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp *</Label>
            <div className="relative">
              <MaskedInput
                id="phone"
                mask="phone"
                value={phone}
                onChange={setPhone}
                placeholder="(55) 45999-5785"
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PhoneValidationIndicator />
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
          
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do contato</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Silva"
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, será usado "Lead + últimos 4 dígitos"
            </p>
          </div>
          
          {/* Benefit Type */}
          <div className="space-y-2">
            <Label htmlFor="benefitType">Tipo de Benefício</Label>
            <Select value={benefitType} onValueChange={setBenefitType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {BENEFIT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Origin/Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Origem</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ORIGIN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Initial Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Mensagem inicial</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="h-6 gap-1 text-xs"
              >
                <Zap className="w-3 h-3" />
                Templates
              </Button>
            </div>
            
            {/* Templates Dropdown */}
            {showTemplates && templates && templates.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto bg-background">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template.content)}
                    className="w-full px-3 py-2 text-left hover:bg-muted text-sm border-b last:border-b-0"
                  >
                    <span className="font-medium">{template.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      /{template.shortcut}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva a primeira mensagem..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{nome}}'} ou {'{{primeiro_nome}}'} para personalizar
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
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
            variant="secondary"
            onClick={() => handleCreate(false)}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Criar sem enviar
          </Button>
          <Button
            type="button"
            onClick={() => handleCreate(true)}
            disabled={!canSubmit || !message.trim()}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Criar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
