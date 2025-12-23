import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// HELPERS - IDs LEGÍVEIS
// ============================================

function gerarIdLegivel(tipo: string, uuid: string): string {
  const prefixos: Record<string, string> = {
    lead: 'lead_',
    mensagem: 'msg_',
    conversa: 'conv_',
    usuario: 'user_',
    tarefa: 'task_'
  };
  const hashCurto = uuid.replace(/-/g, '').substring(0, 8);
  return (prefixos[tipo] || '') + hashCurto;
}

// ============================================
// HELPERS - FORMATAÇÃO
// ============================================

function formatarTelefone(numero: string | null | undefined): string {
  if (!numero) return '';
  const digits = numero.replace(/\D/g, '');
  
  // +55 (XX) 9XXXX-XXXX (13 dígitos com 55)
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
  }
  // +55 (XX) XXXX-XXXX (12 dígitos com 55)
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
  }
  // 11 dígitos (DDD + 9 dígitos)
  if (digits.length === 11) {
    return `+55 (${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
  // 10 dígitos (DDD + 8 dígitos)
  if (digits.length === 10) {
    return `+55 (${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  }
  
  return numero;
}

function formatarCPF(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatTimestamp(): string {
  return new Date().toISOString().replace('Z', '-03:00');
}

function traduzirTemperatura(temp: string): string {
  const map: Record<string, string> = { 'cold': 'frio', 'warm': 'morno', 'hot': 'quente' };
  return map[temp] || temp;
}

function traduzirTipoMensagem(type: string): string {
  const map: Record<string, string> = {
    'text': 'texto', 'image': 'imagem', 'audio': 'audio',
    'video': 'video', 'document': 'documento', 'sticker': 'sticker', 'location': 'localizacao'
  };
  return map[type] || type;
}

function traduzirStatusConversa(status: string): string {
  const map: Record<string, string> = { 'open': 'aberta', 'pending': 'pendente', 'resolved': 'resolvida' };
  return map[status] || status;
}

function traduzirStatusMensagem(status: string): string {
  const map: Record<string, string> = { 'sent': 'enviada', 'delivered': 'entregue', 'read': 'lida' };
  return map[status] || status;
}

// ============================================
// BUSCAR DADOS DO LEAD COMPLETO
// ============================================

async function buscarLeadCompleto(supabase: any, leadId: string) {
  if (!leadId) return null;
  
  const { data: lead } = await supabase
    .from('leads')
    .select(`*, funnel_stages (id, name, color)`)
    .eq('id', leadId)
    .maybeSingle();
  
  if (!lead) return null;
  
  // Buscar etiquetas
  const { data: leadLabels } = await supabase
    .from('lead_labels')
    .select('labels (id, name)')
    .eq('lead_id', leadId);
  
  const etiquetas = leadLabels?.map((ll: any) => ll.labels?.name).filter(Boolean) || [];
  
  // Buscar responsável
  let responsavel = null;
  if (lead.assigned_to) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', lead.assigned_to)
      .maybeSingle();
    
    if (profile) {
      responsavel = {
        id: gerarIdLegivel('usuario', profile.id),
        nome: profile.name
      };
    }
  }
  
  return {
    id: gerarIdLegivel('lead', lead.id),
    id_original: lead.id,
    nome: lead.name,
    whatsapp: formatarTelefone(lead.phone),
    email: lead.email || null,
    cpf: formatarCPF(lead.cpf),
    temperatura: traduzirTemperatura(lead.temperature),
    etapa_funil: lead.funnel_stages?.name || null,
    etiquetas,
    origem: lead.source || null,
    campanha: lead.utm_medium || null,
    beneficio: lead.benefit_type || null,
    criado_em: lead.created_at,
    responsavel,
    raw: lead
  };
}

async function buscarConversa(supabase: any, conversationId: string) {
  if (!conversationId) return null;
  
  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  
  if (!conv) return null;
  
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);
  
  return {
    id: gerarIdLegivel('conversa', conv.id),
    id_original: conv.id,
    status: traduzirStatusConversa(conv.status),
    nao_lidas: conv.unread_count || 0,
    total_mensagens: count || 0,
    lead_id: conv.lead_id
  };
}

async function buscarUsuario(supabase: any, userId: string) {
  if (!userId) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', userId)
    .maybeSingle();
  
  if (!profile) return null;
  return { id: gerarIdLegivel('usuario', profile.id), nome: profile.name };
}

// ============================================
// PAYLOAD BUILDERS - LIMPOS E SIMPLES
// ============================================

async function buildMensagemRecebida(supabase: any, eventData: any) {
  const msg = eventData?.message || eventData;
  const leadId = msg?.lead_id || eventData?.lead_id;
  const convId = msg?.conversation_id || eventData?.conversation_id;
  
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  const conversa = convId ? await buscarConversa(supabase, convId) : null;
  
  return {
    evento: 'mensagem.recebida',
    timestamp: formatTimestamp(),
    mensagem: {
      id: msg?.id ? gerarIdLegivel('mensagem', msg.id) : null,
      tipo: traduzirTipoMensagem(msg?.type || 'text'),
      conteudo: msg?.content || null,
      midia_url: msg?.media_url || null,
      recebida_em: msg?.created_at || formatTimestamp()
    },
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      temperatura: lead.temperatura,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null,
    conversa: conversa ? {
      id: conversa.id,
      status: conversa.status,
      nao_lidas: conversa.nao_lidas
    } : null,
    responsavel: lead?.responsavel || null
  };
}

async function buildMensagemEnviada(supabase: any, eventData: any) {
  const msg = eventData?.message || eventData;
  const leadId = msg?.lead_id || eventData?.lead_id;
  const convId = msg?.conversation_id || eventData?.conversation_id;
  
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  const conversa = convId ? await buscarConversa(supabase, convId) : null;
  const enviadaPor = msg?.sender_id ? await buscarUsuario(supabase, msg.sender_id) : null;
  
  return {
    evento: 'mensagem.enviada',
    timestamp: formatTimestamp(),
    mensagem: {
      id: msg?.id ? gerarIdLegivel('mensagem', msg.id) : null,
      tipo: traduzirTipoMensagem(msg?.type || 'text'),
      conteudo: msg?.content || null,
      midia_url: msg?.media_url || null,
      enviada_em: msg?.created_at || formatTimestamp(),
      status: traduzirStatusMensagem(msg?.status || 'sent')
    },
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      temperatura: lead.temperatura,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null,
    conversa: conversa ? { id: conversa.id, status: conversa.status } : null,
    enviada_por: enviadaPor
  };
}

async function buildLeadCriado(supabase: any, eventData: any) {
  const leadData = eventData?.lead || eventData;
  const lead = leadData?.id ? await buscarLeadCompleto(supabase, leadData.id) : null;
  
  return {
    evento: 'lead.criado',
    timestamp: formatTimestamp(),
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      email: lead.email,
      cpf: lead.cpf,
      temperatura: lead.temperatura,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas,
      origem: lead.origem,
      campanha: lead.campanha,
      beneficio: lead.beneficio,
      criado_em: lead.criado_em
    } : null,
    responsavel: lead?.responsavel || null
  };
}

async function buildLeadAtualizado(supabase: any, eventData: any) {
  const leadData = eventData?.lead || eventData;
  const lead = leadData?.id ? await buscarLeadCompleto(supabase, leadData.id) : null;
  
  return {
    evento: 'lead.atualizado',
    timestamp: formatTimestamp(),
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      temperatura: lead.temperatura,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null
  };
}

async function buildLeadEtapaAlterada(supabase: any, eventData: any) {
  const leadData = eventData?.lead || eventData;
  const leadId = leadData?.id || eventData?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  
  // Buscar nome da etapa anterior
  let etapaAnterior = null;
  if (eventData?.previous_stage_id) {
    const { data: stage } = await supabase
      .from('funnel_stages')
      .select('name')
      .eq('id', eventData.previous_stage_id)
      .maybeSingle();
    etapaAnterior = stage?.name || null;
  }
  
  // Buscar nome da etapa nova
  let etapaNova = null;
  if (eventData?.new_stage_id) {
    const { data: stage } = await supabase
      .from('funnel_stages')
      .select('name')
      .eq('id', eventData.new_stage_id)
      .maybeSingle();
    etapaNova = stage?.name || null;
  }
  
  return {
    evento: 'lead.etapa_alterada',
    timestamp: formatTimestamp(),
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      temperatura: lead.temperatura,
      etiquetas: lead.etiquetas
    } : null,
    etapa_anterior: etapaAnterior,
    etapa_nova: etapaNova || lead?.etapa_funil,
    alterado_por: lead?.responsavel || null
  };
}

async function buildLeadTemperaturaAlterada(supabase: any, eventData: any) {
  const leadData = eventData?.lead || eventData;
  const leadId = leadData?.id || eventData?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  
  return {
    evento: 'lead.temperatura_alterada',
    timestamp: formatTimestamp(),
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null,
    temperatura_anterior: traduzirTemperatura(eventData?.previous_temperature || ''),
    temperatura_nova: traduzirTemperatura(eventData?.new_temperature || lead?.temperatura || ''),
    alterado_por: lead?.responsavel || null
  };
}

async function buildLeadTransferido(supabase: any, eventData: any) {
  const leadData = eventData?.lead || eventData;
  const leadId = leadData?.id || eventData?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  const de = eventData?.previous_assigned_to ? await buscarUsuario(supabase, eventData.previous_assigned_to) : null;
  const para = eventData?.new_assigned_to ? await buscarUsuario(supabase, eventData.new_assigned_to) : null;
  
  return {
    evento: 'lead.transferido',
    timestamp: formatTimestamp(),
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      temperatura: lead.temperatura,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null,
    de,
    para
  };
}

async function buildLeadEtiqueta(supabase: any, eventData: any, adicionada: boolean) {
  const leadId = eventData?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  
  return {
    evento: adicionada ? 'lead.etiqueta_adicionada' : 'lead.etiqueta_removida',
    timestamp: formatTimestamp(),
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp
    } : null,
    etiqueta: eventData?.label_name || null,
    etiquetas_atuais: lead?.etiquetas || [],
    alterado_por: lead?.responsavel || null
  };
}

async function buildConversaCriada(supabase: any, eventData: any) {
  const convData = eventData?.conversation || eventData;
  const conversa = convData?.id ? await buscarConversa(supabase, convData.id) : null;
  const leadId = convData?.lead_id || conversa?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  
  return {
    evento: 'conversa.criada',
    timestamp: formatTimestamp(),
    conversa: conversa ? { id: conversa.id, status: conversa.status } : null,
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      temperatura: lead.temperatura,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null,
    responsavel: lead?.responsavel || null
  };
}

async function buildConversaResolvida(supabase: any, eventData: any) {
  const convData = eventData?.conversation || eventData;
  const conversa = convData?.id ? await buscarConversa(supabase, convData.id) : null;
  const leadId = convData?.lead_id || conversa?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  
  // Calcular duração
  let duracaoMinutos = 0;
  if (conversa?.id_original) {
    const { data: firstMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversa.id_original)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (firstMsg) {
      duracaoMinutos = Math.round((Date.now() - new Date(firstMsg.created_at).getTime()) / 60000);
    }
  }
  
  return {
    evento: 'conversa.resolvida',
    timestamp: formatTimestamp(),
    conversa: conversa ? {
      id: conversa.id,
      total_mensagens: conversa.total_mensagens,
      duracao_minutos: duracaoMinutos
    } : null,
    lead: lead ? {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      etapa_funil: lead.etapa_funil,
      etiquetas: lead.etiquetas
    } : null,
    resolvida_por: lead?.responsavel || null
  };
}

async function buildTarefaCriada(supabase: any, eventData: any) {
  const taskData = eventData?.task || eventData;
  const leadId = taskData?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  const responsavel = taskData?.assigned_to ? await buscarUsuario(supabase, taskData.assigned_to) : null;
  
  return {
    evento: 'tarefa.criada',
    timestamp: formatTimestamp(),
    tarefa: {
      id: taskData?.id ? gerarIdLegivel('tarefa', taskData.id) : null,
      titulo: taskData?.title || null,
      descricao: taskData?.description || null,
      prioridade: taskData?.priority || 'medium',
      vencimento: taskData?.due_date || null,
      status: 'pendente'
    },
    lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp } : null,
    responsavel
  };
}

async function buildTarefaConcluida(supabase: any, eventData: any) {
  const taskData = eventData?.task || eventData;
  const leadId = taskData?.lead_id;
  const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
  const responsavel = taskData?.assigned_to ? await buscarUsuario(supabase, taskData.assigned_to) : null;
  
  return {
    evento: 'tarefa.concluida',
    timestamp: formatTimestamp(),
    tarefa: {
      id: taskData?.id ? gerarIdLegivel('tarefa', taskData.id) : null,
      titulo: taskData?.title || null,
      concluida_em: formatTimestamp()
    },
    lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp } : null,
    concluida_por: responsavel
  };
}

// ============================================
// MAIN PAYLOAD BUILDER
// ============================================

async function buildPayload(supabase: any, evento: string, dados: any): Promise<any> {
  const eventData = dados?.data || dados;
  
  console.log(`[Webhook] Construindo payload limpo para: ${evento}`);
  
  switch (evento) {
    case 'message.received':
      return await buildMensagemRecebida(supabase, eventData);
    case 'message.sent':
      return await buildMensagemEnviada(supabase, eventData);
    case 'lead.created':
      return await buildLeadCriado(supabase, eventData);
    case 'lead.updated':
      return await buildLeadAtualizado(supabase, eventData);
    case 'lead.stage_changed':
      return await buildLeadEtapaAlterada(supabase, eventData);
    case 'lead.temperature_changed':
      return await buildLeadTemperaturaAlterada(supabase, eventData);
    case 'lead.assigned':
      return await buildLeadTransferido(supabase, eventData);
    case 'lead.label_added':
      return await buildLeadEtiqueta(supabase, eventData, true);
    case 'lead.label_removed':
      return await buildLeadEtiqueta(supabase, eventData, false);
    case 'conversation.created':
      return await buildConversaCriada(supabase, eventData);
    case 'conversation.resolved':
      return await buildConversaResolvida(supabase, eventData);
    case 'task.created':
      return await buildTarefaCriada(supabase, eventData);
    case 'task.completed':
      return await buildTarefaConcluida(supabase, eventData);
    default:
      return { evento: evento.replace('.', '_'), timestamp: formatTimestamp(), dados: eventData };
  }
}

// ============================================
// SIGNATURE
// ============================================

async function generateSignature(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return `sha256=${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event, payload: rawPayload, webhook_id } = await req.json();
    
    console.log(`[Webhook] Evento recebido: ${event}`);
    
    // Buscar webhooks
    let webhooksQuery = supabase.from('webhooks').select('*').eq('is_active', true);
    if (webhook_id) webhooksQuery = webhooksQuery.eq('id', webhook_id);
    
    const { data: webhooks, error: webhooksError } = await webhooksQuery;
    
    if (webhooksError) throw webhooksError;
    
    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum webhook ativo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Filtrar webhooks para este evento
    const webhooksToSend = webhooks.filter(w => w.events?.includes(event));
    
    if (webhooksToSend.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum webhook para este evento' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Construir payload LIMPO
    const payload = await buildPayload(supabase, event, rawPayload);
    
    console.log(`[Webhook] Payload:`, JSON.stringify(payload, null, 2));
    
    // Enviar para cada webhook
    const results = [];
    for (const webhook of webhooksToSend) {
      try {
        const signature = await generateSignature(payload, webhook.secret);
        const timestamp = Math.floor(Date.now() / 1000);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Evento': payload.evento,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Assinatura': signature,
          ...(webhook.headers || {})
        };
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        const responseText = await response.text();
        
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event,
          payload,
          status: response.ok ? 'success' : 'failed',
          response_status: response.status,
          response_body: responseText.substring(0, 1000),
          completed_at: response.ok ? new Date().toISOString() : null
        });
        
        results.push({ webhook_id: webhook.id, success: response.ok, status: response.status });
        console.log(`[Webhook] ${webhook.name}: ${response.status}`);
        
      } catch (error: any) {
        console.error(`[Webhook] Erro ${webhook.name}:`, error);
        
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event,
          payload,
          status: 'failed',
          error_message: error?.message || 'Erro desconhecido'
        });
        
        results.push({ webhook_id: webhook.id, success: false, error: error?.message });
      }
    }
    
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Webhook] Erro:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
