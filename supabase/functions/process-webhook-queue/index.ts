import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAPEAMENTOS PT-BR (copiados do dispatch-webhook para consistência)
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
  
  const semPais = normalizado.startsWith('55') ? normalizado.slice(2) : normalizado;
  const ddd = semPais.substring(0, 2);
  const numero = semPais.substring(2);
  
  let formatado: string;
  if (numero.length === 9) {
    formatado = `+55 (${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  } else if (numero.length === 8) {
    formatado = `+55 (${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  } else {
    formatado = `+55 ${semPais}`;
  }
  
  return { numero: `55${semPais}`, formatado, ddd, whatsapp: true };
}

function isHorarioComercial(): boolean {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcOffset = now.getTimezoneOffset();
  const diff = utcOffset + brasiliaOffset;
  const brasiliaTime = new Date(now.getTime() + diff * 60 * 1000);
  
  const hora = brasiliaTime.getHours();
  const diaSemana = brasiliaTime.getDay();
  
  return diaSemana >= 1 && diaSemana <= 5 && hora >= 8 && hora < 18;
}

// ============================================================================
// INTERFACES
// ============================================================================

interface WebhookQueueItem {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  headers: Record<string, string> | null;
  is_active: boolean;
}

interface EnrichedData {
  lead?: any;
  leadLabels?: Array<{ id: string; nome: string; cor: string; categoria: string }>;
  responsavel?: { id: string; nome: string; email: string };
  etapa?: { id: string; nome: string; ordem: number; cor: string };
  etapaAnterior?: { id: string; nome: string; ordem: number; cor: string };
  conversa?: any;
  mensagem?: any;
  tarefa?: any;
}

// ============================================================================
// BUSCAR DADOS ENRIQUECIDOS
// ============================================================================

async function buscarDadosEnriquecidos(
  supabase: any,
  event: string,
  data: Record<string, unknown>
): Promise<EnrichedData> {
  const enriched: EnrichedData = {};
  const innerData = (data.data as Record<string, unknown>) || data;
  
  try {
    const leadData = innerData.lead as Record<string, unknown> | undefined;
    const leadId = leadData?.id as string || innerData.lead_id as string;
    
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('*, funnel_stages(*)')
        .eq('id', leadId)
        .single();
      
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
        
        if (lead.assigned_to) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', lead.assigned_to)
            .single();
          
          if (profile) {
            enriched.responsavel = {
              id: profile.id,
              nome: profile.name,
              email: profile.email,
            };
          }
        }
        
        const { data: leadLabels } = await supabase
          .from('lead_labels')
          .select('labels(id, name, color, category)')
          .eq('lead_id', leadId);
        
        if (leadLabels) {
          enriched.leadLabels = leadLabels
            .filter((ll: any) => ll.labels)
            .map((ll: any) => ({
              id: ll.labels.id,
              nome: ll.labels.name,
              cor: ll.labels.color,
              categoria: ll.labels.category,
            }));
        }
      }
    }
    
    if (event === 'lead.stage_changed') {
      const previousStageId = innerData.previous_stage_id as string;
      if (previousStageId) {
        const { data: stage } = await supabase
          .from('funnel_stages')
          .select('*')
          .eq('id', previousStageId)
          .single();
        
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
    
    const conversationData = innerData.conversation as Record<string, unknown> | undefined;
    if (conversationData?.id) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationData.id)
        .single();
      
      if (conversation) enriched.conversa = conversation;
    }
    
    if (innerData.message) enriched.mensagem = innerData.message;
    if (innerData.task) enriched.tarefa = innerData.task;
    
  } catch (err) {
    console.error('[Webhook Queue] Erro ao buscar dados enriquecidos:', err);
  }
  
  return enriched;
}

// ============================================================================
// CONSTRUIR PAYLOAD V2.0
// ============================================================================

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
  
  let dados: Record<string, unknown> = {};
  let contexto: Record<string, unknown> = {
    empresa: 'GaranteDireito',
    fuso_horario: 'America/Sao_Paulo',
  };
  
  // Build lead object if available
  const lead = enriched.lead || innerData.lead as Record<string, unknown>;
  if (lead && event.startsWith('lead.')) {
    const telefone = formatarTelefone(lead.phone as string);
    const temperatura = TEMPERATURE_MAP[lead.temperature as string] || { valor: lead.temperature || 'desconhecido', emoji: '' };
    
    dados.lead = {
      id: lead.id,
      codigo: gerarCodigoLead(lead.id as string, lead.created_at as string),
      nome: lead.name,
      telefone,
      email: lead.email || null,
      temperatura,
      funil: enriched.etapa || null,
      responsavel: enriched.responsavel || null,
      etiquetas: enriched.leadLabels || [],
      criado_em: lead.created_at ? formatDateBrasilia(lead.created_at as string) : null,
    };
    
    // Event-specific data
    if (event === 'lead.stage_changed') {
      dados.etapa_anterior = enriched.etapaAnterior || { id: innerData.previous_stage_id };
      dados.etapa_nova = enriched.etapa || { id: innerData.new_stage_id };
    } else if (event === 'lead.temperature_changed') {
      dados.temperatura_anterior = TEMPERATURE_MAP[innerData.previous_temperature as string] || { valor: innerData.previous_temperature };
      dados.temperatura_nova = TEMPERATURE_MAP[innerData.new_temperature as string] || { valor: innerData.new_temperature };
    } else if (event === 'lead.label_added' || event === 'lead.label_removed') {
      dados.etiqueta = {
        id: innerData.label_id,
        nome: innerData.label_name,
        cor: innerData.label_color,
        categoria: innerData.label_category,
      };
      dados.todas_etiquetas = enriched.leadLabels || [];
    }
  }
  
  // Message events
  if (event.startsWith('message.')) {
    const message = enriched.mensagem || innerData.message as Record<string, unknown>;
    if (message) {
      dados.mensagem = {
        id: message.id,
        tipo: MESSAGE_TYPE_MAP[message.type as string] || message.type,
        conteudo: message.content,
        midia: message.media_url ? { url: message.media_url } : null,
        criado_em: message.created_at ? formatDateBrasilia(message.created_at as string) : timestamp,
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
    contexto.canal = 'whatsapp';
    contexto.horario_comercial = isHorarioComercial();
  }
  
  // Conversation events
  if (event.startsWith('conversation.')) {
    const conversation = enriched.conversa || innerData.conversation as Record<string, unknown>;
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
  }
  
  // Task events
  if (event.startsWith('task.')) {
    const task = enriched.tarefa || innerData.task as Record<string, unknown>;
    if (task) {
      dados.tarefa = {
        id: task.id,
        titulo: task.title,
        descricao: task.description,
        prioridade: PRIORITY_MAP[task.priority as string] || { valor: task.priority },
        status: TASK_STATUS_MAP[task.status as string] || task.status,
      };
    }
    dados.responsavel = enriched.responsavel || null;
  }
  
  return {
    evento: eventoPtBr,
    versao: '2.0',
    ambiente: Deno.env.get('ENVIRONMENT') || 'producao',
    timestamp,
    entrega: { id: idEntrega, tentativa: attempt, max_tentativas: 3 },
    dados,
    contexto,
    assinatura: { algoritmo: 'sha256', hash: '', timestamp: timestampUnix },
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

async function sendWebhook(
  supabase: any,
  webhook: Webhook,
  queueItem: WebhookQueueItem,
  attempt: number = 1
): Promise<{ success: boolean; status?: number; error?: string }> {
  const maxAttempts = 3;
  
  const enriched = await buscarDadosEnriquecidos(supabase, queueItem.event, queueItem.payload);
  const payloadObj = buildPayloadV2(queueItem.event, queueItem.payload, enriched, webhook.id, attempt);
  
  const payloadSemAssinatura = JSON.stringify({ ...payloadObj, assinatura: undefined });
  const hash = await generateSignature(payloadSemAssinatura, webhook.secret);
  (payloadObj.assinatura as Record<string, unknown>).hash = hash;
  
  const payloadString = JSON.stringify(payloadObj);
  const timestamp = (payloadObj.assinatura as Record<string, unknown>).timestamp as number;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Webhook-Evento': payloadObj.evento as string,
    'X-Webhook-Versao': '2.0',
    'X-Webhook-Ambiente': payloadObj.ambiente as string,
    'X-Webhook-ID-Entrega': (payloadObj.entrega as Record<string, unknown>).id as string,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Webhook-Assinatura': `sha256=${hash}`,
    ...(webhook.headers || {}),
  };
  
  try {
    console.log(`[Webhook Queue v2.0] Enviando ${queueItem.event} -> ${payloadObj.evento} para ${webhook.url} (tentativa ${attempt}/${maxAttempts})`);
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
    });
    
    const responseBody = await response.text();
    const success = response.ok;
    
    console.log(`[Webhook Queue v2.0] Resposta: ${response.status} - ${success ? 'sucesso' : 'falha'}`);
    
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event: queueItem.event,
      payload: payloadObj,
      status: success ? 'success' : (attempt < maxAttempts ? 'retrying' : 'failed'),
      response_status: response.status,
      response_body: responseBody.substring(0, 10000),
      attempts: attempt,
      completed_at: success ? new Date().toISOString() : null,
      error_message: success ? null : `HTTP ${response.status}`,
    });
    
    if (!success && attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(supabase, webhook, queueItem, attempt + 1);
    }
    
    return { success, status: response.status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[Webhook Queue v2.0] Erro:`, errorMessage);
    
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event: queueItem.event,
      payload: payloadObj,
      status: attempt < maxAttempts ? 'retrying' : 'failed',
      attempts: attempt,
      error_message: errorMessage,
    });
    
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(supabase, webhook, queueItem, attempt + 1);
    }
    
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: queueItems, error: queueError } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (queueError) throw queueError;
    
    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ mensagem: 'Nenhum item para processar', processados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Webhook Queue v2.0] Processando ${queueItems.length} itens`);
    
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true);
    
    if (webhooksError) throw webhooksError;
    
    if (!webhooks || webhooks.length === 0) {
      const ids = queueItems.map(item => item.id);
      await supabase
        .from('webhook_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .in('id', ids);
      
      return new Response(
        JSON.stringify({ mensagem: 'Nenhum webhook ativo', processados: queueItems.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const results: { fila_id: string; evento: string; webhooks_enviados: number; erros: number }[] = [];
    
    for (const item of queueItems) {
      const matchingWebhooks = webhooks.filter(w => w.events.includes(item.event));
      
      let sent = 0;
      let errors = 0;
      
      for (const webhook of matchingWebhooks) {
        const result = await sendWebhook(supabase, webhook, item);
        if (result.success) sent++;
        else errors++;
      }
      
      results.push({ fila_id: item.id, evento: item.event, webhooks_enviados: sent, erros: errors });
      
      await supabase
        .from('webhook_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', item.id);
    }
    
    return new Response(
      JSON.stringify({
        mensagem: 'Fila processada com sucesso',
        versao: '2.0',
        processados: queueItems.length,
        resultados: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Webhook Queue v2.0] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ erro: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
