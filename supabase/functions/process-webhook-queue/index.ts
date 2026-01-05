import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// HELPERS
// ============================================

function gerarIdLegivel(tipo: string, uuid: string): string {
  const prefixos: Record<string, string> = {
    lead: 'lead_', mensagem: 'msg_', conversa: 'conv_', usuario: 'user_', tarefa: 'task_', instancia: 'inst_'
  };
  return (prefixos[tipo] || '') + uuid.replace(/-/g, '').substring(0, 8);
}

function formatarTelefone(numero: string | null | undefined): string {
  if (!numero) return '';
  const digits = numero.replace(/\D/g, '');
  
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `+55 (${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
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
// DATA FETCHING
// ============================================

async function buscarLeadCompleto(supabase: any, leadId: string) {
  if (!leadId) return null;
  
  const { data: lead } = await supabase
    .from('leads')
    .select(`*, funnel_stages (id, name)`)
    .eq('id', leadId)
    .maybeSingle();
  
  if (!lead) return null;
  
  const { data: leadLabels } = await supabase
    .from('lead_labels')
    .select('labels (name)')
    .eq('lead_id', leadId);
  
  const etiquetas = leadLabels?.map((ll: any) => ll.labels?.name).filter(Boolean) || [];
  
  let responsavel = null;
  if (lead.assigned_to) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', lead.assigned_to)
      .maybeSingle();
    
    if (profile) {
      responsavel = { id: gerarIdLegivel('usuario', profile.id), nome: profile.name };
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
    responsavel
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
  
  // Buscar responsável da conversa
  let responsavel = null;
  if (conv.assigned_to) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', conv.assigned_to)
      .maybeSingle();
    
    if (profile) {
      responsavel = {
        id: gerarIdLegivel('usuario', profile.id),
        nome: profile.name
      };
    }
  }

  // Buscar equipe via team_members do responsável
  let equipe = null;
  if (conv.assigned_to) {
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', conv.assigned_to)
      .limit(1)
      .maybeSingle();
    
    if (teamMember?.teams) {
      equipe = {
        id: `eqp_${teamMember.teams.id.slice(0, 8)}`,
        nome: teamMember.teams.name
      };
    }
  }

  // Buscar canal WhatsApp
  let canal = null;
  if (conv.whatsapp_instance_id) {
    const { data: instance } = await supabase
      .from('whatsapp_config')
      .select('id, name, instance_name')
      .eq('id', conv.whatsapp_instance_id)
      .maybeSingle();
    
    if (instance) {
      canal = {
        tipo: 'whatsapp',
        nome: instance.instance_name || instance.name
      };
    }
  }
  
  return {
    id: gerarIdLegivel('conversa', conv.id),
    id_original: conv.id,
    status: traduzirStatusConversa(conv.status),
    nao_lidas: conv.unread_count || 0,
    total_mensagens: count || 0,
    lead_id: conv.lead_id,
    whatsapp_instance_id: conv.whatsapp_instance_id,
    responsavel,
    equipe,
    canal,
    iniciada_em: conv.created_at
  };
}

async function buscarInstanciaWhatsApp(supabase: any, instanceId: string) {
  if (!instanceId) return null;
  
  const { data: instance } = await supabase
    .from('whatsapp_config')
    .select('id, name, instance_name, phone_number')
    .eq('id', instanceId)
    .maybeSingle();
  
  if (!instance) return null;
  
  return {
    id: gerarIdLegivel('instancia', instance.id),
    nome: instance.name,
    telefone: formatarTelefone(instance.phone_number),
    identificador: instance.instance_name
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

async function buscarInstanciaDoLead(supabase: any, leadId: string) {
  if (!leadId) return null;
  
  // Buscar a conversa mais recente do lead para obter a instância
  const { data: conv } = await supabase
    .from('conversations')
    .select('whatsapp_instance_id')
    .eq('lead_id', leadId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!conv?.whatsapp_instance_id) return null;
  return await buscarInstanciaWhatsApp(supabase, conv.whatsapp_instance_id);
}

// ============================================
// PAYLOAD BUILDER
// ============================================

async function buildPayload(supabase: any, evento: string, dados: any): Promise<any> {
  const eventData = dados?.data || dados;
  
  switch (evento) {
    case 'message.received': {
      const msg = eventData?.message || eventData;
      const lead = msg?.lead_id ? await buscarLeadCompleto(supabase, msg.lead_id) : null;
      const conversa = msg?.conversation_id ? await buscarConversa(supabase, msg.conversation_id) : null;
      const instancia = conversa?.whatsapp_instance_id ? await buscarInstanciaWhatsApp(supabase, conversa.whatsapp_instance_id) : null;
      
      // Remetente é o contato (lead)
      const remetente = lead ? {
        tipo: 'contato',
        id: lead.id,
        nome: lead.nome
      } : null;
      
      return {
        evento: 'mensagem.recebida',
        timestamp: formatTimestamp(),
        request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
        instancia_whatsapp: instancia,
        mensagem: {
          id: msg?.id ? gerarIdLegivel('mensagem', msg.id) : null,
          tipo: traduzirTipoMensagem(msg?.type || 'text'),
          conteudo: msg?.content || null,
          midia_url: msg?.media_url || null,
          recebida_em: msg?.created_at || formatTimestamp(),
          direcao: 'entrada',
          remetente
        },
        lead: lead ? {
          id: lead.id,
          nome: lead.nome,
          whatsapp: lead.whatsapp,
          email: lead.email,
          temperatura: lead.temperatura,
          etapa_funil: lead.etapa_funil,
          tipo_beneficio: lead.beneficio,
          origem: lead.origem,
          etiquetas: lead.etiquetas,
          responsavel: lead.responsavel,
          criado_em: lead.criado_em
        } : null,
        conversa: conversa ? {
          id: conversa.id,
          status: conversa.status,
          nao_lidas: conversa.nao_lidas,
          responsavel: conversa.responsavel,
          equipe: conversa.equipe,
          canal: conversa.canal,
          iniciada_em: conversa.iniciada_em
        } : null
      };
    }
    
    case 'message.sent': {
      const msg = eventData?.message || eventData;
      const lead = msg?.lead_id ? await buscarLeadCompleto(supabase, msg.lead_id) : null;
      const conversa = msg?.conversation_id ? await buscarConversa(supabase, msg.conversation_id) : null;
      const enviadaPor = msg?.sender_id ? await buscarUsuario(supabase, msg.sender_id) : null;
      const instancia = conversa?.whatsapp_instance_id ? await buscarInstanciaWhatsApp(supabase, conversa.whatsapp_instance_id) : null;
      
      // Remetente é o atendente
      const remetente = enviadaPor ? {
        tipo: 'atendente',
        id: enviadaPor.id,
        nome: enviadaPor.nome
      } : null;
      
      return {
        evento: 'mensagem.enviada',
        timestamp: formatTimestamp(),
        request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
        instancia_whatsapp: instancia,
        mensagem: {
          id: msg?.id ? gerarIdLegivel('mensagem', msg.id) : null,
          tipo: traduzirTipoMensagem(msg?.type || 'text'),
          conteudo: msg?.content || null,
          midia_url: msg?.media_url || null,
          enviada_em: msg?.created_at || formatTimestamp(),
          status: traduzirStatusMensagem(msg?.status || 'sent'),
          direcao: 'saida',
          remetente
        },
        lead: lead ? {
          id: lead.id,
          nome: lead.nome,
          whatsapp: lead.whatsapp,
          email: lead.email,
          temperatura: lead.temperatura,
          etapa_funil: lead.etapa_funil,
          tipo_beneficio: lead.beneficio,
          origem: lead.origem,
          etiquetas: lead.etiquetas,
          responsavel: lead.responsavel,
          criado_em: lead.criado_em
        } : null,
        conversa: conversa ? {
          id: conversa.id,
          status: conversa.status,
          nao_lidas: conversa.nao_lidas,
          responsavel: conversa.responsavel,
          equipe: conversa.equipe,
          canal: conversa.canal,
          iniciada_em: conversa.iniciada_em
        } : null
      };
    }
    
    case 'lead.created': {
      const leadData = eventData?.lead || eventData;
      const lead = leadData?.id ? await buscarLeadCompleto(supabase, leadData.id) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      
      return {
        evento: 'lead.criado',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? {
          id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, email: lead.email, cpf: lead.cpf,
          temperatura: lead.temperatura, etapa_funil: lead.etapa_funil, etiquetas: lead.etiquetas,
          origem: lead.origem, campanha: lead.campanha, beneficio: lead.beneficio, criado_em: lead.criado_em
        } : null,
        responsavel: lead?.responsavel || null
      };
    }
    
    case 'lead.updated': {
      const leadData = eventData?.lead || eventData;
      const lead = leadData?.id ? await buscarLeadCompleto(supabase, leadData.id) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      
      return {
        evento: 'lead.atualizado',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? {
          id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp,
          temperatura: lead.temperatura, etapa_funil: lead.etapa_funil, etiquetas: lead.etiquetas
        } : null
      };
    }
    
    case 'lead.stage_changed': {
      const leadId = eventData?.lead?.id || eventData?.lead_id;
      const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      
      let etapaAnterior = null, etapaNova = null;
      if (eventData?.previous_stage_id) {
        const { data: stage } = await supabase.from('funnel_stages').select('name').eq('id', eventData.previous_stage_id).maybeSingle();
        etapaAnterior = stage?.name || null;
      }
      if (eventData?.new_stage_id) {
        const { data: stage } = await supabase.from('funnel_stages').select('name').eq('id', eventData.new_stage_id).maybeSingle();
        etapaNova = stage?.name || null;
      }
      
      return {
        evento: 'lead.etapa_alterada',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, temperatura: lead.temperatura, etiquetas: lead.etiquetas } : null,
        etapa_anterior: etapaAnterior,
        etapa_nova: etapaNova || lead?.etapa_funil,
        alterado_por: lead?.responsavel || null
      };
    }
    
    case 'lead.temperature_changed': {
      const leadId = eventData?.lead?.id || eventData?.lead_id;
      const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      
      return {
        evento: 'lead.temperatura_alterada',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, etapa_funil: lead.etapa_funil, etiquetas: lead.etiquetas } : null,
        temperatura_anterior: traduzirTemperatura(eventData?.previous_temperature || ''),
        temperatura_nova: traduzirTemperatura(eventData?.new_temperature || lead?.temperatura || ''),
        alterado_por: lead?.responsavel || null
      };
    }
    
    case 'lead.assigned': {
      const leadId = eventData?.lead?.id || eventData?.lead_id;
      const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      const de = eventData?.previous_assigned_to ? await buscarUsuario(supabase, eventData.previous_assigned_to) : null;
      const para = eventData?.new_assigned_to ? await buscarUsuario(supabase, eventData.new_assigned_to) : null;
      
      return {
        evento: 'lead.transferido',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, temperatura: lead.temperatura, etapa_funil: lead.etapa_funil, etiquetas: lead.etiquetas } : null,
        de, para
      };
    }
    
    case 'lead.label_added':
    case 'lead.label_removed': {
      const leadId = eventData?.lead_id;
      const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      
      return {
        evento: evento === 'lead.label_added' ? 'lead.etiqueta_adicionada' : 'lead.etiqueta_removida',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp } : null,
        etiqueta: eventData?.label_name || null,
        etiquetas_atuais: lead?.etiquetas || [],
        alterado_por: lead?.responsavel || null
      };
    }
    
    case 'conversation.created': {
      const convData = eventData?.conversation || eventData;
      const conversa = convData?.id ? await buscarConversa(supabase, convData.id) : null;
      const lead = (convData?.lead_id || conversa?.lead_id) ? await buscarLeadCompleto(supabase, convData?.lead_id || conversa?.lead_id) : null;
      const instancia = conversa?.whatsapp_instance_id ? await buscarInstanciaWhatsApp(supabase, conversa.whatsapp_instance_id) : null;
      
      return {
        evento: 'conversa.criada',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        conversa: conversa ? { id: conversa.id, status: conversa.status } : null,
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, temperatura: lead.temperatura, etapa_funil: lead.etapa_funil, etiquetas: lead.etiquetas } : null,
        responsavel: lead?.responsavel || null
      };
    }
    
    case 'conversation.resolved': {
      const convData = eventData?.conversation || eventData;
      const conversa = convData?.id ? await buscarConversa(supabase, convData.id) : null;
      const lead = (convData?.lead_id || conversa?.lead_id) ? await buscarLeadCompleto(supabase, convData?.lead_id || conversa?.lead_id) : null;
      const instancia = conversa?.whatsapp_instance_id ? await buscarInstanciaWhatsApp(supabase, conversa.whatsapp_instance_id) : null;
      
      let duracaoMinutos = 0;
      if (conversa?.id_original) {
        const { data: firstMsg } = await supabase.from('messages').select('created_at').eq('conversation_id', conversa.id_original).order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (firstMsg) duracaoMinutos = Math.round((Date.now() - new Date(firstMsg.created_at).getTime()) / 60000);
      }
      
      return {
        evento: 'conversa.resolvida',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        conversa: conversa ? { id: conversa.id, total_mensagens: conversa.total_mensagens, duracao_minutos: duracaoMinutos } : null,
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp, etapa_funil: lead.etapa_funil, etiquetas: lead.etiquetas } : null,
        resolvida_por: lead?.responsavel || null
      };
    }
    
    case 'task.created': {
      const task = eventData?.task || eventData;
      const lead = task?.lead_id ? await buscarLeadCompleto(supabase, task.lead_id) : null;
      const responsavel = task?.assigned_to ? await buscarUsuario(supabase, task.assigned_to) : null;
      
      return {
        evento: 'tarefa.criada',
        timestamp: formatTimestamp(),
        tarefa: { id: task?.id ? gerarIdLegivel('tarefa', task.id) : null, titulo: task?.title, descricao: task?.description, prioridade: task?.priority || 'medium', vencimento: task?.due_date, status: 'pendente' },
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp } : null,
        responsavel
      };
    }
    
    case 'task.completed': {
      const task = eventData?.task || eventData;
      const lead = task?.lead_id ? await buscarLeadCompleto(supabase, task.lead_id) : null;
      const responsavel = task?.assigned_to ? await buscarUsuario(supabase, task.assigned_to) : null;
      
      return {
        evento: 'tarefa.concluida',
        timestamp: formatTimestamp(),
        tarefa: { id: task?.id ? gerarIdLegivel('tarefa', task.id) : null, titulo: task?.title, concluida_em: formatTimestamp() },
        lead: lead ? { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp } : null,
        concluida_por: responsavel
      };
    }
    
    case 'lead.summary_updated': {
      const leadId = eventData?.lead_id;
      const lead = leadId ? await buscarLeadCompleto(supabase, leadId) : null;
      const instancia = lead?.id_original ? await buscarInstanciaDoLead(supabase, lead.id_original) : null;
      
      return {
        evento: 'lead.resumo_atualizado',
        timestamp: formatTimestamp(),
        instancia_whatsapp: instancia,
        lead: lead ? {
          id: lead.id,
          nome: lead.nome,
          whatsapp: lead.whatsapp,
          temperatura: lead.temperatura,
          etapa_funil: lead.etapa_funil,
          etiquetas: lead.etiquetas
        } : null,
        resumo_caso: eventData?.case_summary || null,
        acao: eventData?.action === 'removed' ? 'removido' : 'atualizado'
      };
    }
    
    default:
      return { evento: evento.replace('.', '_'), timestamp: formatTimestamp(), dados: eventData };
  }
}

// ============================================
// SIGNATURE & SEND
// ============================================

async function generateSignature(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));
  return `sha256=${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

async function sendWebhook(supabase: any, webhook: any, payload: any, queueId: string): Promise<boolean> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
      
      console.log(`[WebhookQueue] ${webhook.name} tentativa ${attempt}/${maxRetries}`);
      
      const response = await fetch(webhook.url, { method: 'POST', headers, body: JSON.stringify(payload) });
      const responseText = await response.text();
      
      await supabase.from('webhook_logs').insert({
        webhook_id: webhook.id,
        event: payload.evento,
        payload,
        status: response.ok ? 'success' : (attempt < maxRetries ? 'retrying' : 'failed'),
        response_status: response.status,
        response_body: responseText.substring(0, 1000),
        attempts: attempt,
        completed_at: response.ok ? new Date().toISOString() : null
      });
      
      if (response.ok) {
        console.log(`[WebhookQueue] ${webhook.name}: OK`);
        return true;
      }
      
      console.log(`[WebhookQueue] ${webhook.name}: ${response.status}`);
      
    } catch (error: any) {
      console.error(`[WebhookQueue] Erro:`, error);
      
      await supabase.from('webhook_logs').insert({
        webhook_id: webhook.id,
        event: payload.evento,
        payload,
        status: attempt < maxRetries ? 'retrying' : 'failed',
        error_message: error?.message || 'Erro desconhecido',
        attempts: attempt
      });
    }
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  
  return false;
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

    // Buscar fila
    const { data: queueItems } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[WebhookQueue] Processando ${queueItems.length} itens`);

    // Buscar webhooks ativos
    const { data: webhooks } = await supabase.from('webhooks').select('*').eq('is_active', true);

    if (!webhooks || webhooks.length === 0) {
      for (const item of queueItems) {
        await supabase.from('webhook_queue').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', item.id);
      }
      return new Response(JSON.stringify({ success: true, processed: queueItems.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processedCount = 0;

    for (const item of queueItems) {
      const webhooksForEvent = webhooks.filter(w => w.events?.includes(item.event));
      
      if (webhooksForEvent.length === 0) {
        await supabase.from('webhook_queue').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', item.id);
        processedCount++;
        continue;
      }

      // Construir payload limpo
      const payload = await buildPayload(supabase, item.event, item.payload);
      
      console.log(`[WebhookQueue] ${item.event} ->`, JSON.stringify(payload, null, 2));

      for (const webhook of webhooksForEvent) {
        await sendWebhook(supabase, webhook, payload, item.id);
      }

      await supabase.from('webhook_queue').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', item.id);
      processedCount++;
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[WebhookQueue] Erro:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
