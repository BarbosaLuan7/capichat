import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== HELPER FUNCTIONS ==========

// Validar se é UUID válido
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Verificar se parece um telefone
function looksLikePhone(str: string): boolean {
  const digits = str.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 && /^\d+$/.test(digits);
}

// Normalização robusta de telefone
interface NormalizedPhone {
  original: string;
  withoutCountry: string;
  last11: string;
  last10: string;
  ddd: string;
}

function normalizePhoneForSearch(phone: string): NormalizedPhone {
  const digits = phone.replace(/\D/g, '');
  let withoutCountry = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    withoutCountry = digits.substring(2);
  }
  return {
    original: digits,
    withoutCountry,
    last11: digits.slice(-11),
    last10: digits.slice(-10),
    ddd: withoutCountry.substring(0, 2)
  };
}

// Formatar telefone para exibição
function formatTelefone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length >= 10) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

// Mapear temperatura
function mapTemperature(temp: string): string {
  const map: Record<string, string> = { cold: "frio", warm: "morno", hot: "quente" };
  return map[temp] || temp;
}

// Mapear status da conversa
function mapConversationStatus(status: string): string {
  const map: Record<string, string> = { open: "aberta", pending: "pendente", resolved: "finalizada" };
  return map[status] || status;
}

// Buscar lead por UUID ou telefone
async function resolveLeadId(supabase: any, identifier: string): Promise<string | null> {
  if (isValidUUID(identifier)) {
    return identifier;
  }
  
  if (looksLikePhone(identifier)) {
    const phone = normalizePhoneForSearch(identifier);
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .or(`phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}%`)
      .limit(1)
      .maybeSingle();
    
    return lead?.id || null;
  }
  
  return null;
}

// Buscar conversa por UUID ou telefone do lead
async function resolveConversationId(supabase: any, identifier: string): Promise<string | null> {
  if (isValidUUID(identifier)) {
    return identifier;
  }
  
  if (looksLikePhone(identifier)) {
    const leadId = await resolveLeadId(supabase, identifier);
    if (leadId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return conv?.id || null;
    }
  }
  
  return null;
}

// Buscar dados completos do lead
async function getLeadFullData(supabase: any, leadId: string) {
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  
  if (!lead) return null;
  
  // Buscar etiquetas
  const { data: leadLabels } = await supabase
    .from('lead_labels')
    .select('labels(id, name, color, category)')
    .eq('lead_id', leadId);
  
  const etiquetas = (leadLabels || []).map((ll: any) => ({
    id: ll.labels?.id,
    nome: ll.labels?.name,
    cor: ll.labels?.color,
    categoria: ll.labels?.category
  })).filter((e: any) => e.id);
  
  // Buscar etapa do funil
  let etapaFunil = null;
  if (lead.stage_id) {
    const { data: stage } = await supabase
      .from('funnel_stages')
      .select('id, name, color')
      .eq('id', lead.stage_id)
      .single();
    if (stage) {
      etapaFunil = { id: stage.id, nome: stage.name, cor: stage.color };
    }
  }
  
  // Buscar responsável
  let responsavel = null;
  if (lead.assigned_to) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', lead.assigned_to)
      .single();
    if (profile) {
      responsavel = { id: profile.id, nome: profile.name, email: profile.email };
    }
  }
  
  return {
    id: lead.id,
    nome: lead.name,
    telefone: formatTelefone(`${lead.country_code || '55'}${lead.phone}`),
    telefone_raw: lead.phone,
    email: lead.email,
    cpf: lead.cpf,
    temperatura: mapTemperature(lead.temperature),
    temperature: lead.temperature,
    etapa_funil: etapaFunil,
    funnel_stage: etapaFunil,
    etiquetas,
    labels: etiquetas,
    responsavel,
    assigned_to: responsavel,
    origem: lead.source,
    source: lead.source,
    tipo_beneficio: lead.benefit_type,
    benefit_type: lead.benefit_type,
    avatar_url: lead.avatar_url,
    criado_em: lead.created_at,
    created_at: lead.created_at,
    atualizado_em: lead.updated_at,
    updated_at: lead.updated_at
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ erro: 'Header de autorização ausente ou inválido', error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: keyId, error: keyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (keyError || !keyId) {
      return new Response(
        JSON.stringify({ erro: 'API key inválida', error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    let id = url.searchParams.get('id');
    const status = url.searchParams.get('status');
    const assignedTo = url.searchParams.get('assigned_to') || url.searchParams.get('responsavel_id');
    let leadIdParam = url.searchParams.get('lead_id') || url.searchParams.get('contato_id');
    const page = parseInt(url.searchParams.get('page') || url.searchParams.get('pagina') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || url.searchParams.get('por_pagina') || '50');
    const action = url.searchParams.get('action');

    // Resolver ID de conversa (pode ser UUID ou telefone)
    if (id && !isValidUUID(id)) {
      console.log('[api-conversations] ID não é UUID, tentando resolver como telefone:', id);
      const resolvedId = await resolveConversationId(supabase, id);
      if (resolvedId) {
        console.log('[api-conversations] ID resolvido:', resolvedId);
        id = resolvedId;
      } else {
        console.log('[api-conversations] Não foi possível resolver ID:', id);
      }
    }

    // Resolver lead_id (pode ser UUID ou telefone)
    if (leadIdParam && !isValidUUID(leadIdParam)) {
      console.log('[api-conversations] lead_id não é UUID, tentando resolver como telefone:', leadIdParam);
      const resolvedLeadId = await resolveLeadId(supabase, leadIdParam);
      if (resolvedLeadId) {
        console.log('[api-conversations] lead_id resolvido:', resolvedLeadId);
        leadIdParam = resolvedLeadId;
      } else {
        console.log('[api-conversations] Não foi possível resolver lead_id:', leadIdParam);
      }
    }

    // GET/POST for notes: /api-conversations?id=xxx&action=notas
    if (id && action === 'notas') {
      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('internal_notes')
          .select(`
            *,
            author:profiles!internal_notes_author_id_fkey(id, name)
          `)
          .eq('conversation_id', id)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ erro: error.message, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const notes = (data || []).map((n: any) => ({
          id: n.id,
          conteudo: n.content,
          content: n.content,
          autor: n.author ? { id: n.author.id, nome: n.author.name } : null,
          author: n.author ? { id: n.author.id, name: n.author.name } : null,
          criada_em: n.created_at,
          created_at: n.created_at
        }));

        return new Response(
          JSON.stringify({ sucesso: true, success: true, dados: notes, data: notes }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'POST') {
        const body = await req.json();
        
        if (!body.conteudo && !body.content) {
          return new Response(
            JSON.stringify({ erro: 'Campo conteudo é obrigatório', error: 'content field is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('internal_notes')
          .insert({
            conversation_id: id,
            content: body.conteudo || body.content,
            author_id: body.author_id || null
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ erro: error.message, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            sucesso: true,
            success: true,
            nota: {
              id: data.id,
              conteudo: data.content,
              content: data.content,
              criada_em: data.created_at,
              created_at: data.created_at
            }
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET - List conversations or get single
    if (req.method === 'GET') {
      if (id) {
        // Get single conversation with messages
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select(`
            *,
            lead:leads(id, name, phone, avatar_url, country_code, temperature, stage_id, assigned_to)
          `)
          .eq('id', id)
          .single();

        if (convError) {
          return new Response(
            JSON.stringify({ erro: convError.message, error: convError.message }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get messages
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true });

        // Get full lead data
        const leadFullData = conversation.lead_id ? await getLeadFullData(supabase, conversation.lead_id) : null;

        // Get WhatsApp instance
        let instanciaWhatsapp = null;
        if (conversation.whatsapp_instance_id) {
          const { data: whatsapp } = await supabase
            .from('whatsapp_config')
            .select('id, name, phone_number, instance_name, provider')
            .eq('id', conversation.whatsapp_instance_id)
            .single();
          if (whatsapp) {
            instanciaWhatsapp = {
              id: whatsapp.id,
              nome: whatsapp.name,
              name: whatsapp.name,
              telefone: formatTelefone(whatsapp.phone_number),
              phone_number: whatsapp.phone_number,
              identificador: whatsapp.instance_name,
              instance_name: whatsapp.instance_name,
              provider: whatsapp.provider
            };
          }
        }

        // Get assigned user
        let responsavel = null;
        if (conversation.assigned_to) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', conversation.assigned_to)
            .single();
          if (profile) {
            responsavel = { id: profile.id, nome: profile.name, name: profile.name, email: profile.email };
          }
        }

        const response = {
          sucesso: true,
          success: true,
          conversa: {
            id: conversation.id,
            status: conversation.status,
            status_pt: mapConversationStatus(conversation.status),
            nao_lidas: conversation.unread_count,
            unread_count: conversation.unread_count,
            favorita: conversation.is_favorite,
            is_favorite: conversation.is_favorite,
            responsavel,
            assigned_to: responsavel,
            instancia_whatsapp: instanciaWhatsapp,
            whatsapp_instance: instanciaWhatsapp,
            ultima_mensagem_em: conversation.last_message_at,
            last_message_at: conversation.last_message_at,
            ultima_mensagem: conversation.last_message_content,
            last_message_content: conversation.last_message_content,
            criada_em: conversation.created_at,
            created_at: conversation.created_at
          },
          conversation: {
            id: conversation.id,
            status: conversation.status,
            unread_count: conversation.unread_count,
            is_favorite: conversation.is_favorite,
            assigned_to: responsavel,
            whatsapp_instance: instanciaWhatsapp,
            last_message_at: conversation.last_message_at,
            last_message_content: conversation.last_message_content,
            created_at: conversation.created_at
          },
          lead: leadFullData,
          contato: leadFullData,
          mensagens: messages || [],
          messages: messages || []
        };

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List conversations with filters
      let query = supabase
        .from('conversations')
        .select(`
          *,
          lead:leads(id, name, phone, avatar_url, country_code, temperature)
        `, { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (leadIdParam) query = query.eq('lead_id', leadIdParam);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('last_message_at', { ascending: false })
        .range(from, to);

      if (error) {
        return new Response(
          JSON.stringify({ erro: error.message, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[api-conversations] Retornando', data?.length || 0, 'conversas');

      // Format conversations
      const conversasFormatadas = (data || []).map((c: any) => ({
        id: c.id,
        status: c.status,
        status_pt: mapConversationStatus(c.status),
        nao_lidas: c.unread_count,
        unread_count: c.unread_count,
        favorita: c.is_favorite,
        is_favorite: c.is_favorite,
        ultima_mensagem_em: c.last_message_at,
        last_message_at: c.last_message_at,
        ultima_mensagem: c.last_message_content,
        last_message_content: c.last_message_content,
        lead: c.lead ? {
          id: c.lead.id,
          nome: c.lead.name,
          name: c.lead.name,
          telefone: formatTelefone(`${c.lead.country_code || '55'}${c.lead.phone}`),
          phone: c.lead.phone,
          avatar_url: c.lead.avatar_url,
          temperatura: mapTemperature(c.lead.temperature || 'cold'),
          temperature: c.lead.temperature
        } : null,
        contato: c.lead ? {
          id: c.lead.id,
          nome: c.lead.name,
          telefone: formatTelefone(`${c.lead.country_code || '55'}${c.lead.phone}`),
          avatar_url: c.lead.avatar_url,
          temperatura: mapTemperature(c.lead.temperature || 'cold')
        } : null,
        criada_em: c.created_at,
        created_at: c.created_at
      }));

      return new Response(
        JSON.stringify({
          sucesso: true,
          success: true,
          dados: conversasFormatadas,
          data: conversasFormatadas,
          paginacao: {
            pagina: page,
            por_pagina: pageSize,
            total: count,
            total_paginas: Math.ceil((count || 0) / pageSize)
          },
          pagination: {
            page,
            page_size: pageSize,
            total: count,
            total_pages: Math.ceil((count || 0) / pageSize)
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create conversation
    if (req.method === 'POST') {
      const body = await req.json();
      let contatoId = body.lead_id || body.contato_id;

      if (!contatoId) {
        return new Response(
          JSON.stringify({ erro: 'Campo lead_id ou contato_id é obrigatório', error: 'lead_id or contato_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolver lead_id se for telefone
      if (!isValidUUID(contatoId) && looksLikePhone(contatoId)) {
        console.log('[api-conversations] contatoId parece telefone, resolvendo:', contatoId);
        const resolvedId = await resolveLeadId(supabase, contatoId);
        if (resolvedId) {
          contatoId = resolvedId;
        } else {
          return new Response(
            JSON.stringify({ erro: 'Lead não encontrado para o telefone informado', error: 'Lead not found for provided phone' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          lead_id: contatoId,
          assigned_to: body.assigned_to || body.responsavel_id || null,
          status: body.status || 'open',
          whatsapp_instance_id: body.whatsapp_instance_id || body.instancia_id || null
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ erro: error.message, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get full lead data
      const leadFullData = await getLeadFullData(supabase, contatoId);

      console.log('[api-conversations] Conversa criada:', data.id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          success: true,
          conversa: {
            id: data.id,
            status: data.status,
            status_pt: mapConversationStatus(data.status),
            criada_em: data.created_at,
            created_at: data.created_at
          },
          conversation: {
            id: data.id,
            status: data.status,
            created_at: data.created_at
          },
          lead: leadFullData,
          contato: leadFullData
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update conversation
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(
          JSON.stringify({ erro: 'Parâmetro id é obrigatório', error: 'id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json().catch(() => ({}));

      // Helper para retornar resposta de ação
      const buildActionResponse = async (data: any, actionType: string) => {
        const leadFullData = data.lead_id ? await getLeadFullData(supabase, data.lead_id) : null;
        
        return {
          sucesso: true,
          success: true,
          acao: actionType,
          action: actionType,
          conversa: {
            id: data.id,
            status: data.status,
            status_pt: mapConversationStatus(data.status),
            atualizada_em: new Date().toISOString()
          },
          conversation: {
            id: data.id,
            status: data.status,
            updated_at: new Date().toISOString()
          },
          lead: leadFullData,
          contato: leadFullData
        };
      };

      // PUT /api-conversations?id=xxx&action=transferir
      if (action === 'transferir') {
        const updateData: Record<string, unknown> = {};
        
        if (body.tipo === 'usuario' && (body.usuario_id || body.responsavel_id)) {
          updateData.assigned_to = body.usuario_id || body.responsavel_id;
        } else if (body.tipo === 'equipe' && body.equipe_id) {
          updateData.assigned_to = null;
        }

        const { data, error } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ erro: error.message, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const baseResponse = await buildActionResponse(data, 'transferir');
        const transferInfo = body.tipo === 'usuario' 
          ? { tipo: 'usuario', id: body.usuario_id || body.responsavel_id }
          : { tipo: 'equipe', id: body.equipe_id };
        
        const response = {
          ...baseResponse,
          transferido_para: transferInfo,
          transferred_to: transferInfo
        };

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-conversations?id=xxx&action=atribuir
      if (action === 'atribuir') {
        const userId = body.usuario_id || body.responsavel_id || body.user_id || body.assigned_to;
        const { data, error } = await supabase
          .from('conversations')
          .update({ assigned_to: userId })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ erro: error.message, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(await buildActionResponse(data, 'atribuir')),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-conversations?id=xxx&action=finalizar
      if (action === 'finalizar') {
        const { data, error } = await supabase
          .from('conversations')
          .update({ status: 'resolved' })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ erro: error.message, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(await buildActionResponse(data, 'finalizar')),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT /api-conversations?id=xxx&action=reabrir
      if (action === 'reabrir') {
        const updateData: Record<string, unknown> = { status: 'open' };
        if (body.responsavel_id || body.assigned_to) {
          updateData.assigned_to = body.responsavel_id || body.assigned_to;
        }

        const { data, error } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ erro: error.message, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(await buildActionResponse(data, 'reabrir')),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Default PUT - update conversation fields
      const updateData: Record<string, unknown> = {};

      if (body.status !== undefined) updateData.status = body.status;
      if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to;
      if (body.responsavel_id !== undefined) updateData.assigned_to = body.responsavel_id;
      if (body.is_favorite !== undefined) updateData.is_favorite = body.is_favorite;
      if (body.favorito !== undefined) updateData.is_favorite = body.favorito;

      const { data, error } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ erro: error.message, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(await buildActionResponse(data, 'atualizar')),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete conversation
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ erro: 'Parâmetro id é obrigatório', error: 'id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) {
        return new Response(
          JSON.stringify({ erro: error.message, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sucesso: true, success: true, mensagem: 'Conversa removida com sucesso', message: 'Conversation deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ erro: 'Método não permitido', error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-conversations] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ erro: message, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
