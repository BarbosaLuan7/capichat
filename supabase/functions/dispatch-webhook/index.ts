import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de eventos para PT-BR
const EVENT_NAMES_PT: Record<string, string> = {
  'lead.created': 'lead.criado',
  'lead.updated': 'lead.atualizado',
  'lead.deleted': 'lead.excluido',
  'lead.stage_changed': 'lead.etapa_alterada',
  'lead.assigned': 'lead.atribuido',
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

// Mapeamento de temperatura para PT-BR
const TEMPERATURE_PT: Record<string, string> = {
  'cold': 'frio',
  'warm': 'morno',
  'hot': 'quente',
};

// Mapeamento de status de lead para PT-BR
const LEAD_STATUS_PT: Record<string, string> = {
  'active': 'ativo',
  'archived': 'arquivado',
  'converted': 'convertido',
  'lost': 'perdido',
};

// Mapeamento de status de conversa para PT-BR
const CONVERSATION_STATUS_PT: Record<string, string> = {
  'open': 'aberta',
  'pending': 'pendente',
  'resolved': 'resolvida',
};

// Mapeamento de status de tarefa para PT-BR
const TASK_STATUS_PT: Record<string, string> = {
  'todo': 'a_fazer',
  'in_progress': 'em_andamento',
  'done': 'concluida',
};

// Mapeamento de prioridade de tarefa para PT-BR
const TASK_PRIORITY_PT: Record<string, string> = {
  'urgent': 'urgente',
  'high': 'alta',
  'medium': 'media',
  'low': 'baixa',
};

// Mapeamento de tipo de mensagem para PT-BR
const MESSAGE_TYPE_PT: Record<string, string> = {
  'text': 'texto',
  'image': 'imagem',
  'audio': 'audio',
  'video': 'video',
  'document': 'documento',
};

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

// Formatar data em GMT-3 (São Paulo)
function formatDateBrasilia(date?: Date): string {
  const d = date || new Date();
  // Calcular offset para GMT-3
  const brasiliaOffset = -3 * 60; // minutos
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

// Traduzir campos de lead para PT-BR
function translateLead(lead: Record<string, unknown>): Record<string, unknown> {
  return {
    id: lead.id,
    nome: lead.name || lead.nome,
    telefone: lead.phone || lead.telefone,
    email: lead.email,
    cpf: lead.cpf,
    nit_pis: lead.nit_pis,
    data_nascimento: lead.birth_date || lead.data_nascimento,
    tipo_beneficio: lead.benefit_type || lead.tipo_beneficio,
    status_caso: lead.case_status || lead.status_caso,
    nome_whatsapp: lead.whatsapp_name || lead.nome_whatsapp,
    origem: lead.source || lead.origem,
    utm_medium: lead.utm_medium,
    temperatura: TEMPERATURE_PT[lead.temperature as string] || lead.temperature || lead.temperatura,
    status: LEAD_STATUS_PT[lead.status as string] || lead.status,
    etapa_id: lead.stage_id || lead.etapa_id,
    responsavel_id: lead.assigned_to || lead.responsavel_id,
    valor_estimado: lead.estimated_value || lead.valor_estimado,
    resumo_ia: lead.ai_summary || lead.resumo_ia,
    notas_internas: lead.internal_notes || lead.notas_internas,
    qualificacao: lead.qualification || lead.qualificacao,
    checklist_documentos: lead.documents_checklist || lead.checklist_documentos,
    campos_personalizados: lead.custom_fields || lead.campos_personalizados,
    criado_em: lead.created_at ? formatDateBrasilia(new Date(lead.created_at as string)) : undefined,
    atualizado_em: lead.updated_at ? formatDateBrasilia(new Date(lead.updated_at as string)) : undefined,
    ultima_interacao_em: lead.last_interaction_at ? formatDateBrasilia(new Date(lead.last_interaction_at as string)) : undefined,
  };
}

// Traduzir campos de mensagem para PT-BR
function translateMessage(message: Record<string, unknown>): Record<string, unknown> {
  return {
    id: message.id,
    conversa_id: message.conversation_id || message.conversa_id,
    lead_id: message.lead_id,
    tipo: MESSAGE_TYPE_PT[message.type as string] || message.type || message.tipo,
    conteudo: message.content || message.conteudo,
    midia_url: message.media_url || message.midia_url,
    remetente_id: message.sender_id || message.remetente_id,
    tipo_remetente: message.sender_type === 'lead' ? 'lead' : 'agente',
    direcao: message.direction === 'inbound' ? 'entrada' : 'saida',
    status: message.status,
    favorita: message.is_starred || message.favorita,
    nota_interna: message.is_internal_note || message.nota_interna,
    criado_em: message.created_at ? formatDateBrasilia(new Date(message.created_at as string)) : undefined,
  };
}

// Traduzir campos de conversa para PT-BR
function translateConversation(conversation: Record<string, unknown>): Record<string, unknown> {
  return {
    id: conversation.id,
    lead_id: conversation.lead_id,
    status: CONVERSATION_STATUS_PT[conversation.status as string] || conversation.status,
    responsavel_id: conversation.assigned_to || conversation.responsavel_id,
    mensagens_nao_lidas: conversation.unread_count || conversation.mensagens_nao_lidas,
    favorita: conversation.is_favorite || conversation.favorita,
    ultima_mensagem_em: conversation.last_message_at ? formatDateBrasilia(new Date(conversation.last_message_at as string)) : undefined,
    criado_em: conversation.created_at ? formatDateBrasilia(new Date(conversation.created_at as string)) : undefined,
  };
}

// Traduzir campos de tarefa para PT-BR
function translateTask(task: Record<string, unknown>): Record<string, unknown> {
  return {
    id: task.id,
    titulo: task.title || task.titulo,
    descricao: task.description || task.descricao,
    status: TASK_STATUS_PT[task.status as string] || task.status,
    prioridade: TASK_PRIORITY_PT[task.priority as string] || task.priority || task.prioridade,
    responsavel_id: task.assigned_to || task.responsavel_id,
    lead_id: task.lead_id,
    subtarefas: task.subtasks || task.subtarefas,
    data_vencimento: task.due_date ? formatDateBrasilia(new Date(task.due_date as string)) : undefined,
    criado_em: task.created_at ? formatDateBrasilia(new Date(task.created_at as string)) : undefined,
    atualizado_em: task.updated_at ? formatDateBrasilia(new Date(task.updated_at as string)) : undefined,
  };
}

// Construir payload padronizado em PT-BR
function buildStandardPayload(
  event: string,
  data: Record<string, unknown>,
  webhookId: string,
  attempt: number = 1
): Record<string, unknown> {
  const eventoPtBr = EVENT_NAMES_PT[event] || event;
  const idEntrega = crypto.randomUUID();
  const ambiente = Deno.env.get('ENVIRONMENT') || 'producao';
  
  // Determinar se é teste
  const isTeste = data._test === true || data._teste === true;
  
  // Traduzir dados baseado no tipo de evento
  let dadosTraduzidos: Record<string, unknown> = {};
  
  if (event.startsWith('lead.')) {
    const lead = data.lead as Record<string, unknown>;
    if (lead) {
      dadosTraduzidos.lead = translateLead(lead);
    }
    
    // Campos específicos por evento
    if (event === 'lead.stage_changed') {
      dadosTraduzidos.etapa_anterior_id = data.previous_stage_id || data.etapa_anterior_id;
      dadosTraduzidos.etapa_atual_id = data.new_stage_id || data.etapa_atual_id;
    } else if (event === 'lead.temperature_changed') {
      dadosTraduzidos.temperatura_anterior = TEMPERATURE_PT[data.previous_temperature as string] || data.previous_temperature;
      dadosTraduzidos.temperatura_atual = TEMPERATURE_PT[data.new_temperature as string] || data.new_temperature;
    } else if (event === 'lead.assigned') {
      dadosTraduzidos.responsavel_anterior_id = data.previous_assigned_to || data.responsavel_anterior_id;
      dadosTraduzidos.responsavel_atual_id = data.new_assigned_to || data.responsavel_atual_id;
    } else if (event === 'lead.label_added' || event === 'lead.label_removed') {
      dadosTraduzidos.lead_id = data.lead_id;
      dadosTraduzidos.etiqueta_id = data.label_id || data.etiqueta_id;
    }
  } else if (event.startsWith('message.')) {
    const message = data.message as Record<string, unknown>;
    if (message) {
      dadosTraduzidos.mensagem = translateMessage(message);
    }
  } else if (event.startsWith('conversation.')) {
    const conversation = data.conversation as Record<string, unknown>;
    if (conversation) {
      dadosTraduzidos.conversa = translateConversation(conversation);
    }
    
    if (event === 'conversation.assigned') {
      dadosTraduzidos.responsavel_anterior_id = data.previous_assigned_to || data.responsavel_anterior_id;
      dadosTraduzidos.responsavel_atual_id = data.new_assigned_to || data.responsavel_atual_id;
    }
  } else if (event.startsWith('task.')) {
    const task = data.task as Record<string, unknown>;
    if (task) {
      dadosTraduzidos.tarefa = translateTask(task);
    }
  }
  
  // Adicionar flag de teste se aplicável
  if (isTeste) {
    dadosTraduzidos._teste = true;
    dadosTraduzidos._descricao = 'Este é um payload de teste enviado manualmente';
  }
  
  return {
    evento: eventoPtBr,
    evento_original: event,
    versao_api: '1.0',
    ambiente: isTeste ? 'teste' : ambiente,
    data_hora: formatDateBrasilia(),
    id_entrega: idEntrega,
    dados: dadosTraduzidos,
    metadados: {
      webhook_id: webhookId,
      tentativa: attempt,
      max_tentativas: 3,
      fuso_horario: 'America/Sao_Paulo',
      formato_data: 'ISO 8601 com offset GMT-3',
    },
  };
}

// Generate HMAC-SHA256 signature using Web Crypto API
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return 'sha256=' + hashHex;
}

// Create Supabase client
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Send webhook with retry logic
async function sendWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; status?: number; body?: string; error?: string }> {
  const maxAttempts = 3;
  const supabase = createSupabaseClient();

  // Construir payload padronizado em PT-BR
  const payloadObj = buildStandardPayload(payload.event, payload.data, webhook.id, attempt);
  const payloadString = JSON.stringify(payloadObj);

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await generateSignature(payloadString, webhook.secret);

  // Headers padronizados em PT-BR
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Webhook-Evento': payloadObj.evento as string,
    'X-Webhook-Evento-Original': payload.event,
    'X-Webhook-Versao': '1.0',
    'X-Webhook-Ambiente': payloadObj.ambiente as string,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Webhook-Assinatura': signature,
    'X-Webhook-ID-Entrega': payloadObj.id_entrega as string,
    ...((webhook.headers as Record<string, string>) || {})
  };

  try {
    console.log(`[Webhook] Enviando para ${webhook.url} (tentativa ${attempt}/${maxAttempts})`);
    console.log(`[Webhook] Evento: ${payload.event} -> ${payloadObj.evento}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text();
    const success = response.status >= 200 && response.status < 300;

    console.log(`[Webhook] Resposta: ${response.status} - ${success ? 'sucesso' : 'falha'}`);

    // Log the webhook attempt
    const logData = {
      webhook_id: webhook.id,
      event: payload.event as "lead.created" | "lead.updated" | "lead.deleted" | "lead.stage_changed" | "lead.assigned" | "lead.temperature_changed" | "lead.label_added" | "lead.label_removed" | "message.received" | "message.sent" | "conversation.created" | "conversation.assigned" | "conversation.resolved" | "task.created" | "task.completed",
      payload: payloadObj,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempts: attempt,
      status: (success ? 'success' : (attempt >= maxAttempts ? 'failed' : 'retrying')) as "pending" | "success" | "failed" | "retrying",
      completed_at: success || attempt >= maxAttempts ? new Date().toISOString() : null
    };
    
    await supabase.from('webhook_logs').insert(logData);

    if (!success && attempt < maxAttempts) {
      const delays = [60000, 300000, 1800000]; // 1min, 5min, 30min
      const delay = delays[attempt - 1] || 300000;
      console.log(`[Webhook] Nova tentativa em ${delay / 1000}s`);
    }

    return {
      success,
      status: response.status,
      body: responseBody
    };

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Webhook] Erro (tentativa ${attempt}):`, error.message);

    const logData = {
      webhook_id: webhook.id,
      event: payload.event as "lead.created" | "lead.updated" | "lead.deleted" | "lead.stage_changed" | "lead.assigned" | "lead.temperature_changed" | "lead.label_added" | "lead.label_removed" | "message.received" | "message.sent" | "conversation.created" | "conversation.assigned" | "conversation.resolved" | "task.created" | "task.completed",
      payload: payloadObj,
      response_status: null,
      response_body: null,
      error_message: error.message,
      attempts: attempt,
      status: (attempt >= maxAttempts ? 'failed' : 'retrying') as "pending" | "success" | "failed" | "retrying",
      completed_at: attempt >= maxAttempts ? new Date().toISOString() : null
    };
    
    await supabase.from('webhook_logs').insert(logData);

    if (attempt < maxAttempts) {
      console.log(`[Webhook] Nova tentativa agendada para ${webhook.id}`);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log(`[Webhook] Despachando webhooks para evento: ${body.event}`);

    // Find active webhooks that listen to this event
    const { data: webhooks, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [body.event]);

    if (fetchError) {
      console.error('[Webhook] Erro ao buscar webhooks:', fetchError);
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Erro ao buscar webhooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('[Webhook] Nenhum webhook ativo encontrado para:', body.event);
      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Nenhum webhook para disparar', despachados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Webhook] Encontrados ${webhooks.length} webhook(s) para disparar`);

    // Dispatch webhooks in parallel
    const results = await Promise.all(
      webhooks.map((webhook) => sendWebhook(webhook as Webhook, body))
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[Webhook] Despacho completo: ${successful} sucesso, ${failed} falha`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        despachados: webhooks.length,
        bem_sucedidos: successful,
        falhados: failed,
        resultados: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Webhook] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
