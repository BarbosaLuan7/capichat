import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAPEAMENTOS PT-BR
// ============================================================================

const EVENT_NAMES_PT: Record<string, string> = {
  'lead.created': 'lead.criado',
  'lead.updated': 'lead.atualizado',
  'lead.deleted': 'lead.excluido',
  'lead.stage_changed': 'lead.etapa_alterada',
  'lead.assigned': 'lead.transferido',
  'lead.temperature_changed': 'lead.temperatura_alterada',
  'lead.label_added': 'lead.etiqueta_adicionada',
  'lead.label_removed': 'lead.etiqueta_removida',
  'message.received': 'mensagem.recebida',
  'message.sent': 'mensagem.enviada',
  'conversation.created': 'conversa.criada',
  'conversation.assigned': 'conversa.atribuida',
  'conversation.resolved': 'conversa.resolvida',
  'task.created': 'tarefa.criada',
  'task.completed': 'tarefa.concluida',
};

const TEMPERATURE_MAP: Record<string, { valor: string; emoji: string }> = {
  'cold': { valor: 'frio', emoji: '❄️' },
  'warm': { valor: 'morno', emoji: '🌡️' },
  'hot': { valor: 'quente', emoji: '🔥' },
};

const PRIORITY_MAP: Record<string, { valor: string; emoji: string }> = {
  'urgent': { valor: 'urgente', emoji: '🔴' },
  'high': { valor: 'alta', emoji: '🟠' },
  'medium': { valor: 'media', emoji: '🟡' },
  'low': { valor: 'baixa', emoji: '🟢' },
};

const TASK_STATUS_MAP: Record<string, string> = {
  'todo': 'pendente',
  'in_progress': 'em_andamento',
  'done': 'concluida',
};

const CONVERSATION_STATUS_MAP: Record<string, string> = {
  'open': 'aberta',
  'pending': 'pendente',
  'resolved': 'resolvida',
};

const MESSAGE_TYPE_MAP: Record<string, string> = {
  'text': 'texto',
  'image': 'imagem',
  'audio': 'audio',
  'video': 'video',
  'document': 'documento',
};

const MESSAGE_STATUS_MAP: Record<string, { valor: string; emoji: string }> = {
  'sent': { valor: 'enviada', emoji: '✓' },
  'delivered': { valor: 'entregue', emoji: '✓✓' },
  'read': { valor: 'lida', emoji: '✓✓' },
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function formatDateBrasilia(date?: Date | string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const brasiliaOffset = -3 * 60;
  const utcOffset = d.getTimezoneOffset();
  const diff = utcOffset + brasiliaOffset;
  const brasiliaTime = new Date(d.getTime() + diff * 60 * 1000);
  
  const year = brasiliaTime.getFullYear();
  const month = String(brasiliaTime.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaTime.getDate()).padStart(2, '0');
  const hours = String(brasiliaTime.getHours()).padStart(2, '0');
  const minutes = String(brasiliaTime.getMinutes()).padStart(2, '0');
  const seconds = String(brasiliaTime.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
}

function gerarCodigoLead(leadId: string, createdAt?: string): string {
  const date = createdAt ? new Date(createdAt) : new Date();
  const ano = date.getFullYear();
  const hash = leadId.replace(/-/g, '').substring(0, 8);
  const num = parseInt(hash, 16) % 1000000;
  return `L-${ano}-${String(num).padStart(6, '0')}`;
}

function formatarTelefone(phone: string | null | undefined): {
  numero: string;
  formatado: string;
  ddd: string;
  whatsapp: boolean;
} | null {
  if (!phone) return null;
  
  const normalizado = phone.replace(/\D/g, '');
  if (normalizado.length < 10) return null;
  
  // Remove 55 do início se existir
  const semPais = normalizado.startsWith('55') ? normalizado.slice(2) : normalizado;
  const ddd = semPais.substring(0, 2);
  const numero = semPais.substring(2);
  
  // Formatar número
  let formatado: string;
  if (numero.length === 9) {
    formatado = `+55 (${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  } else if (numero.length === 8) {
    formatado = `+55 (${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  } else {
    formatado = `+55 ${semPais}`;
  }
  
  return {
    numero: `55${semPais}`,
    formatado,
    ddd,
    whatsapp: true,
  };
}

function formatarCPF(cpf: string | null | undefined): { numero: string; formatado: string } | null {
  if (!cpf) return null;
  
  const numeros = cpf.replace(/\D/g, '');
  if (numeros.length !== 11) return null;
  
  return {
    numero: numeros,
    formatado: `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`,
  };
}

function calcularTempoLegivel(segundos: number): { texto: string; segundos: number } {
  if (segundos < 60) {
    return { texto: `${segundos} segundo${segundos !== 1 ? 's' : ''}`, segundos };
  }
  if (segundos < 3600) {
    const mins = Math.floor(segundos / 60);
    return { texto: `${mins} minuto${mins !== 1 ? 's' : ''}`, segundos };
  }
  if (segundos < 86400) {
    const horas = Math.floor(segundos / 3600);
    const mins = Math.floor((segundos % 3600) / 60);
    if (mins === 0) {
      return { texto: `${horas} hora${horas !== 1 ? 's' : ''}`, segundos };
    }
    return { texto: `${horas} hora${horas !== 1 ? 's' : ''} e ${mins} minuto${mins !== 1 ? 's' : ''}`, segundos };
  }
  
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  if (horas === 0) {
    return { texto: `${dias} dia${dias !== 1 ? 's' : ''}`, segundos };
  }
  return { texto: `${dias} dia${dias !== 1 ? 's' : ''} e ${horas} hora${horas !== 1 ? 's' : ''}`, segundos };
}

function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isHorarioComercial(): boolean {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcOffset = now.getTimezoneOffset();
  const diff = utcOffset + brasiliaOffset;
  const brasiliaTime = new Date(now.getTime() + diff * 60 * 1000);
  
  const hora = brasiliaTime.getHours();
  const diaSemana = brasiliaTime.getDay();
  
  // Segunda a sexta, 8h às 18h
  return diaSemana >= 1 && diaSemana <= 5 && hora >= 8 && hora < 18;
}

// ============================================================================
// INTERFACES
// ============================================================================

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  headers: Record<string, string> | null;
  is_active: boolean;
}

interface EnrichedData {
  lead?: Record<string, unknown>;
  leadLabels?: Array<{ id: string; nome: string; cor: string; categoria: string }>;
  responsavel?: { id: string; nome: string; email: string };
  etapa?: { id: string; nome: string; ordem: number; cor: string };
  etapaAnterior?: { id: string; nome: string; ordem: number; cor: string };
  conversa?: Record<string, unknown>;
  mensagem?: Record<string, unknown>;
  tarefa?: Record<string, unknown>;
}

// ============================================================================
// BUSCAR DADOS RELACIONADOS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarDadosEnriquecidos(
  supabase: any,
  event: string,
  data: Record<string, unknown>
): Promise<EnrichedData> {
  const enriched: EnrichedData = {};
  const innerData = (data.data as Record<string, unknown>) || data;
  
  try {
    // Buscar lead se aplicável
    const leadData = innerData.lead as Record<string, unknown> | undefined;
    const leadId = leadData?.id as string || innerData.lead_id as string;
    
    if (leadId) {
      const { data: leadResult } = await supabase
        .from('leads')
        .select('*, funnel_stages(*)')
        .eq('id', leadId)
        .single();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lead = leadResult as any;
      
      if (lead) {
        enriched.lead = lead;
        
        if (lead.funnel_stages) {
          enriched.etapa = {
            id: lead.funnel_stages.id,
            nome: lead.funnel_stages.name,
            ordem: lead.funnel_stages.order,
            cor: lead.funnel_stages.color,
          };
        }
        
        // Buscar responsável
        if (lead.assigned_to) {
          const { data: profileResult } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', lead.assigned_to)
            .single();
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profile = profileResult as any;
          
          if (profile) {
            enriched.responsavel = {
              id: profile.id,
              nome: profile.name,
              email: profile.email,
            };
          }
        }
        
        // Buscar etiquetas do lead
        const { data: leadLabelsResult } = await supabase
          .from('lead_labels')
          .select('labels(id, name, color, category)')
          .eq('lead_id', leadId);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const leadLabels = leadLabelsResult as any[];
        
        if (leadLabels) {
          enriched.leadLabels = leadLabels
            .filter(ll => ll.labels)
            .map(ll => ({
              id: ll.labels.id as string,
              nome: ll.labels.name as string,
              cor: ll.labels.color as string,
              categoria: ll.labels.category as string,
            }));
        }
      }
    }
    
    // Buscar etapa anterior para eventos de mudança de etapa
    if (event === 'lead.stage_changed') {
      const previousStageId = innerData.previous_stage_id as string;
      if (previousStageId) {
        const { data: stageResult } = await supabase
          .from('funnel_stages')
          .select('*')
          .eq('id', previousStageId)
          .single();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stage = stageResult as any;
        
        if (stage) {
          enriched.etapaAnterior = {
            id: stage.id,
            nome: stage.name,
            ordem: stage.order,
            cor: stage.color,
          };
        }
      }
    }
    
    // Buscar responsável anterior/novo para transferência
    if (event === 'lead.assigned') {
      const previousAssignedTo = innerData.previous_assigned_to as string;
      const newAssignedTo = innerData.new_assigned_to as string;
      
      if (previousAssignedTo) {
        const { data: prevProfileResult } = await supabase
          .from('profiles')
          .select('id, name, email, teams(name)')
          .eq('id', previousAssignedTo)
          .single();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevProfile = prevProfileResult as any;
        
        if (prevProfile) {
          (enriched as Record<string, unknown>).responsavelAnterior = {
            id: prevProfile.id,
            nome: prevProfile.name,
            email: prevProfile.email,
            equipe: prevProfile.teams?.name || null,
          };
        }
      }
      
      if (newAssignedTo) {
        const { data: newProfileResult } = await supabase
          .from('profiles')
          .select('id, name, email, teams(name)')
          .eq('id', newAssignedTo)
          .single();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newProfile = newProfileResult as any;
        
        if (newProfile) {
          (enriched as Record<string, unknown>).responsavelNovo = {
            id: newProfile.id,
            nome: newProfile.name,
            email: newProfile.email,
            equipe: newProfile.teams?.name || null,
          };
        }
      }
    }
    
    // Buscar conversa se aplicável
    const conversationData = innerData.conversation as Record<string, unknown> | undefined;
    const conversationId = conversationData?.id as string;
    
    if (conversationId) {
      const { data: conversationResult } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      if (conversationResult) {
        enriched.conversa = conversationResult as Record<string, unknown>;
      }
    }
    
    // Buscar mensagem se aplicável
    const messageData = innerData.message as Record<string, unknown> | undefined;
    if (messageData) {
      enriched.mensagem = messageData;
    }
    
    // Buscar tarefa se aplicável
    const taskData = innerData.task as Record<string, unknown> | undefined;
    if (taskData) {
      enriched.tarefa = taskData;
      
      // Buscar responsável da tarefa
      const taskAssignedTo = taskData.assigned_to as string;
      if (taskAssignedTo && !enriched.responsavel) {
        const { data: profileResult } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('id', taskAssignedTo)
          .single();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile = profileResult as any;
        
        if (profile) {
          enriched.responsavel = {
            id: profile.id,
            nome: profile.name,
            email: profile.email,
          };
        }
      }
    }
    
  } catch (err) {
    console.error('[Webhook] Erro ao buscar dados enriquecidos:', err);
  }
  
  return enriched;
}

// ============================================================================
// CONSTRUIR PAYLOAD V2.0
// ============================================================================

function buildLeadObject(
  lead: Record<string, unknown>,
  enriched: EnrichedData
): Record<string, unknown> {
  const telefone = formatarTelefone(lead.phone as string);
  const cpf = formatarCPF(lead.cpf as string);
  const temperatura = TEMPERATURE_MAP[lead.temperature as string] || { valor: lead.temperature || 'desconhecido', emoji: '' };
  
  return {
    id: lead.id,
    codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
    nome: lead.name || lead.nome,
    telefone,
    email: lead.email || null,
    cpf,
    nit_pis: lead.nit_pis || null,
    data_nascimento: lead.birth_date || null,
    nome_whatsapp: lead.whatsapp_name || null,
    temperatura,
    origem: {
      tipo: lead.source || 'manual',
      utm_medium: lead.utm_medium || null,
    },
    beneficio: lead.benefit_type ? {
      tipo: lead.benefit_type,
      nome: lead.benefit_type,
    } : null,
    funil: enriched.etapa ? {
      etapa_id: enriched.etapa.id,
      etapa_nome: enriched.etapa.nome,
      etapa_ordem: enriched.etapa.ordem,
      etapa_cor: enriched.etapa.cor,
    } : null,
    responsavel: enriched.responsavel || null,
    etiquetas: enriched.leadLabels || [],
    criado_em: lead.created_at ? formatDateBrasilia(lead.created_at as string) : null,
  };
}

function buildPayloadV2(
  event: string,
  data: Record<string, unknown>,
  enriched: EnrichedData,
  webhookId: string,
  attempt: number
): Record<string, unknown> {
  const eventoPtBr = EVENT_NAMES_PT[event] || event;
  const idEntrega = crypto.randomUUID();
  const timestamp = formatDateBrasilia();
  const timestampUnix = Math.floor(Date.now() / 1000);
  const innerData = (data.data as Record<string, unknown>) || data;
  
  // Construir dados específicos por evento
  let dados: Record<string, unknown> = {};
  let contexto: Record<string, unknown> = {
    empresa: 'GaranteDireito',
    fuso_horario: 'America/Sao_Paulo',
  };
  
  // -------------------------------------------------------------------------
  // EVENTOS DE LEAD
  // -------------------------------------------------------------------------
  
  if (event === 'lead.created') {
    const lead = enriched.lead || innerData.lead as Record<string, unknown>;
    if (lead) {
      dados.lead = buildLeadObject(lead, enriched);
    }
    contexto.horario_comercial = isHorarioComercial();
  }
  
  else if (event === 'lead.updated') {
    const lead = enriched.lead || innerData.lead as Record<string, unknown>;
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    // TODO: Comparar campos alterados quando houver dados anteriores
    dados.alteracoes = [];
  }
  
  else if (event === 'lead.stage_changed') {
    const lead = enriched.lead || innerData.lead as Record<string, unknown>;
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    
    dados.etapa_anterior = enriched.etapaAnterior || {
      id: innerData.previous_stage_id,
      nome: null,
      ordem: null,
      cor: null,
    };
    
    dados.etapa_nova = enriched.etapa || {
      id: innerData.new_stage_id,
      nome: null,
      ordem: null,
      cor: null,
    };
    
    // Calcular tempo na etapa anterior (se tiver dados)
    if (lead?.updated_at && lead?.created_at) {
      const tempoSegundos = Math.floor(
        (new Date(lead.updated_at as string).getTime() - new Date(lead.created_at as string).getTime()) / 1000
      );
      dados.tempo_na_etapa_anterior = calcularTempoLegivel(tempoSegundos);
    }
    
    dados.movido_por = enriched.responsavel ? {
      id: enriched.responsavel.id,
      nome: enriched.responsavel.nome,
      tipo: 'usuario',
    } : { tipo: 'sistema' };
  }
  
  else if (event === 'lead.temperature_changed') {
    const lead = enriched.lead || innerData.lead as Record<string, unknown>;
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    
    const tempAnterior = innerData.previous_temperature as string;
    const tempNova = innerData.new_temperature as string;
    
    dados.temperatura_anterior = TEMPERATURE_MAP[tempAnterior] || { valor: tempAnterior, emoji: '' };
    dados.temperatura_nova = TEMPERATURE_MAP[tempNova] || { valor: tempNova, emoji: '' };
    
    dados.alterado_por = enriched.responsavel || { tipo: 'sistema' };
  }
  
  else if (event === 'lead.assigned') {
    const lead = enriched.lead || innerData.lead as Record<string, unknown>;
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    
    dados.de = (enriched as Record<string, unknown>).responsavelAnterior || {
      id: innerData.previous_assigned_to,
      nome: null,
    };
    
    dados.para = (enriched as Record<string, unknown>).responsavelNovo || {
      id: innerData.new_assigned_to,
      nome: null,
    };
    
    dados.motivo = null; // Pode ser adicionado futuramente
    dados.transferido_por = { tipo: 'sistema' };
  }
  
  else if (event === 'lead.label_added') {
    const lead = enriched.lead;
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    } else {
      dados.lead = { id: innerData.lead_id };
    }
    
    dados.etiqueta = {
      id: innerData.label_id,
      nome: innerData.label_name,
      cor: innerData.label_color,
      categoria: innerData.label_category,
    };
    
    dados.todas_etiquetas = enriched.leadLabels || [];
    dados.adicionada_por = enriched.responsavel || { tipo: 'sistema' };
    
    contexto.total_etiquetas = enriched.leadLabels?.length || 1;
  }
  
  else if (event === 'lead.label_removed') {
    const lead = enriched.lead;
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    } else {
      dados.lead = { id: innerData.lead_id };
    }
    
    dados.etiqueta_removida = {
      id: innerData.label_id,
      nome: innerData.label_name,
      cor: innerData.label_color,
      categoria: innerData.label_category,
    };
    
    dados.etiquetas_restantes = enriched.leadLabels || [];
    dados.removida_por = enriched.responsavel || { tipo: 'sistema' };
    
    contexto.total_etiquetas = enriched.leadLabels?.length || 0;
  }
  
  // -------------------------------------------------------------------------
  // EVENTOS DE MENSAGEM
  // -------------------------------------------------------------------------
  
  else if (event === 'message.received' || event === 'message.sent') {
    const message = enriched.mensagem || innerData.message as Record<string, unknown>;
    const lead = enriched.lead;
    
    if (message) {
      const tipo = MESSAGE_TYPE_MAP[message.type as string] || message.type || 'texto';
      
      dados.mensagem = {
        id: message.id,
        tipo,
        conteudo: message.content || null,
        midia: message.media_url ? {
          tipo,
          url: message.media_url,
        } : null,
        recebida_em: message.created_at ? formatDateBrasilia(message.created_at as string) : timestamp,
        enviada_em: message.created_at ? formatDateBrasilia(message.created_at as string) : timestamp,
        status: MESSAGE_STATUS_MAP[message.status as string]?.valor || message.status,
      };
      
      if (enriched.conversa) {
        dados.conversa = {
          id: enriched.conversa.id,
          status: CONVERSATION_STATUS_MAP[enriched.conversa.status as string] || enriched.conversa.status,
          total_mensagens: null, // Pode ser calculado
          nao_lidas: enriched.conversa.unread_count,
        };
      }
    }
    
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
        temperatura: TEMPERATURE_MAP[lead.temperature as string] || { valor: lead.temperature, emoji: '' },
        etiquetas: enriched.leadLabels || [],
      };
    }
    
    dados.responsavel = enriched.responsavel || null;
    
    if (event === 'message.sent') {
      dados.enviada_por = enriched.responsavel ? {
        id: enriched.responsavel.id,
        nome: enriched.responsavel.nome,
        tipo: 'usuario',
      } : { tipo: 'sistema' };
    }
    
    contexto.horario_comercial = isHorarioComercial();
    contexto.canal = 'whatsapp';
  }
  
  // -------------------------------------------------------------------------
  // EVENTOS DE CONVERSA
  // -------------------------------------------------------------------------
  
  else if (event === 'conversation.created') {
    const conversation = enriched.conversa || innerData.conversation as Record<string, unknown>;
    const lead = enriched.lead;
    
    if (conversation) {
      dados.conversa = {
        id: conversation.id,
        status: CONVERSATION_STATUS_MAP[conversation.status as string] || 'aberta',
        criada_em: conversation.created_at ? formatDateBrasilia(conversation.created_at as string) : timestamp,
      };
    }
    
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
        novo: true,
      };
    }
    
    dados.responsavel = enriched.responsavel || null;
    dados.atribuicao = enriched.responsavel ? 'automatica' : 'nao_atribuida';
    
    contexto.canal = 'whatsapp';
    contexto.horario_comercial = isHorarioComercial();
  }
  
  else if (event === 'conversation.resolved') {
    const conversation = enriched.conversa || innerData.conversation as Record<string, unknown>;
    const lead = enriched.lead;
    
    if (conversation) {
      dados.conversa = {
        id: conversation.id,
        status_anterior: 'aberta',
        status_novo: 'resolvida',
        total_mensagens: null,
      };
    }
    
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    
    dados.resolvida_por = enriched.responsavel || { tipo: 'sistema' };
  }
  
  else if (event === 'conversation.assigned') {
    const conversation = enriched.conversa || innerData.conversation as Record<string, unknown>;
    const lead = enriched.lead;
    
    if (conversation) {
      dados.conversa = {
        id: conversation.id,
        status: CONVERSATION_STATUS_MAP[conversation.status as string] || conversation.status,
      };
    }
    
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    
    dados.de = (enriched as Record<string, unknown>).responsavelAnterior || {
      id: innerData.previous_assigned_to,
    };
    
    dados.para = (enriched as Record<string, unknown>).responsavelNovo || {
      id: innerData.new_assigned_to,
    };
  }
  
  // -------------------------------------------------------------------------
  // EVENTOS DE TAREFA
  // -------------------------------------------------------------------------
  
  else if (event === 'task.created') {
    const task = enriched.tarefa || innerData.task as Record<string, unknown>;
    const lead = enriched.lead;
    
    if (task) {
      const prioridade = PRIORITY_MAP[task.priority as string] || { valor: task.priority, emoji: '' };
      const vencimento = task.due_date ? new Date(task.due_date as string) : null;
      const agora = new Date();
      
      dados.tarefa = {
        id: task.id,
        titulo: task.title,
        descricao: task.description || null,
        prioridade,
        vencimento: vencimento ? {
          data: formatDateBrasilia(vencimento),
          texto: vencimento.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
          em_atraso: vencimento < agora,
        } : null,
        status: TASK_STATUS_MAP[task.status as string] || 'pendente',
      };
    }
    
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
        telefone: formatarTelefone(lead.phone as string),
      };
    }
    
    dados.responsavel = enriched.responsavel || null;
    dados.criada_por = enriched.responsavel || { tipo: 'sistema' };
  }
  
  else if (event === 'task.completed') {
    const task = enriched.tarefa || innerData.task as Record<string, unknown>;
    const lead = enriched.lead;
    
    if (task) {
      const vencimento = task.due_date ? new Date(task.due_date as string) : null;
      const agora = new Date();
      
      dados.tarefa = {
        id: task.id,
        titulo: task.title,
        status: 'concluida',
        concluida_em: timestamp,
        foi_no_prazo: vencimento ? agora <= vencimento : true,
      };
    }
    
    if (lead) {
      dados.lead = {
        id: lead.id,
        codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
        nome: lead.name,
      };
    }
    
    dados.concluida_por = enriched.responsavel || { tipo: 'sistema' };
  }
  
  // -------------------------------------------------------------------------
  // PAYLOAD FINAL
  // -------------------------------------------------------------------------
  
  return {
    evento: eventoPtBr,
    versao: '2.0',
    ambiente: Deno.env.get('ENVIRONMENT') || 'producao',
    timestamp,
    entrega: {
      id: idEntrega,
      tentativa: attempt,
      max_tentativas: 3,
    },
    dados,
    contexto,
    assinatura: {
      algoritmo: 'sha256',
      hash: '', // Será preenchido depois
      timestamp: timestampUnix,
    },
  };
}

// ============================================================================
// ASSINATURA E ENVIO
// ============================================================================

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function sendWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; status?: number; body?: string; error?: string }> {
  const maxAttempts = 3;
  const supabase = createSupabaseClient();
  
  // Buscar dados enriquecidos
  const enriched = await buscarDadosEnriquecidos(supabase, payload.event, payload.data);
  
  // Construir payload v2.0
  const payloadObj = buildPayloadV2(payload.event, payload.data, enriched, webhook.id, attempt);
  
  // Gerar assinatura
  const payloadSemAssinatura = JSON.stringify({ ...payloadObj, assinatura: undefined });
  const hash = await generateSignature(payloadSemAssinatura, webhook.secret);
  (payloadObj.assinatura as Record<string, unknown>).hash = hash;
  
  const payloadString = JSON.stringify(payloadObj);
  const timestamp = (payloadObj.assinatura as Record<string, unknown>).timestamp as number;
  
  // Headers padronizados v2.0
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Webhook-Evento': payloadObj.evento as string,
    'X-Webhook-Versao': '2.0',
    'X-Webhook-Ambiente': payloadObj.ambiente as string,
    'X-Webhook-ID-Entrega': (payloadObj.entrega as Record<string, unknown>).id as string,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Webhook-Assinatura': `sha256=${hash}`,
    ...((webhook.headers as Record<string, string>) || {}),
  };
  
  try {
    console.log(`[Webhook v2.0] Enviando ${payload.event} -> ${payloadObj.evento} para ${webhook.url} (tentativa ${attempt}/${maxAttempts})`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseBody = await response.text();
    const success = response.status >= 200 && response.status < 300;
    
    console.log(`[Webhook v2.0] Resposta: ${response.status} - ${success ? 'sucesso' : 'falha'}`);
    
    // Log no banco
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event: payload.event,
      payload: payloadObj,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempts: attempt,
      status: success ? 'success' : (attempt >= maxAttempts ? 'failed' : 'retrying'),
      completed_at: success || attempt >= maxAttempts ? new Date().toISOString() : null,
    });
    
    return { success, status: response.status, body: responseBody };
    
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Webhook v2.0] Erro (tentativa ${attempt}):`, error.message);
    
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event: payload.event,
      payload: payloadObj,
      error_message: error.message,
      attempts: attempt,
      status: attempt >= maxAttempts ? 'failed' : 'retrying',
      completed_at: attempt >= maxAttempts ? new Date().toISOString() : null,
    });
    
    return { success: false, error: error.message };
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const supabase = createSupabaseClient();
    const body: WebhookPayload = await req.json();
    
    if (!body.event || !body.data) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Os campos "event" e "data" são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Webhook v2.0] Despachando para evento: ${body.event}`);
    
    const { data: webhooks, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [body.event]);
    
    if (fetchError) {
      console.error('[Webhook v2.0] Erro ao buscar webhooks:', fetchError);
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Erro ao buscar webhooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!webhooks || webhooks.length === 0) {
      console.log('[Webhook v2.0] Nenhum webhook ativo para:', body.event);
      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Nenhum webhook para disparar', despachados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Webhook v2.0] Encontrados ${webhooks.length} webhook(s)`);
    
    const results = await Promise.all(
      webhooks.map(webhook => sendWebhook(webhook as Webhook, body))
    );
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    return new Response(
      JSON.stringify({
        sucesso: true,
        versao: '2.0',
        despachados: webhooks.length,
        sucesso_count: successCount,
        falha_count: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Webhook v2.0] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
