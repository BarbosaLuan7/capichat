import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== NORMALIZAÇÃO ROBUSTA DE TELEFONE ==========
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
    ddd: withoutCountry.substring(0, 2),
  };
}

// Helper: Validate phone number format
function validatePhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 10) {
    return { valid: false, normalized, error: 'Phone number too short (min 10 digits)' };
  }
  if (normalized.length > 15) {
    return { valid: false, normalized, error: 'Phone number too long (max 15 digits)' };
  }
  return { valid: true, normalized };
}

// Helper: Validar se é UUID válido
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper: Verificar se parece um telefone
function looksLikePhone(str: string): boolean {
  const digits = str.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 && /^\d+$/.test(digits);
}

// Helper: Return safe error response (don't expose internal details)
function safeErrorResponse(
  internalError: unknown,
  publicMessage: string,
  status: number = 500
): Response {
  console.error('[api-messages-send] Internal error:', internalError);
  return new Response(
    JSON.stringify({ success: false, sucesso: false, error: publicMessage, erro: publicMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Format phone for display
function formatTelefone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length >= 10) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

// Map temperature
function mapTemperature(temp: string): string {
  const map: Record<string, string> = { cold: 'frio', warm: 'morno', hot: 'quente' };
  return map[temp] || temp;
}

// Map conversation status
function mapConversationStatus(status: string): string {
  const map: Record<string, string> = {
    open: 'aberta',
    pending: 'pendente',
    resolved: 'finalizada',
  };
  return map[status] || status;
}

interface SendMessagePayload {
  phone: string;
  message: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  lead_id?: string;
  conversation_id?: string;
  whatsapp_instance_id?: string;
}

interface WhatsAppConfig {
  id: string;
  name: string;
  provider: 'waha' | 'meta';
  base_url: string;
  api_key: string;
  instance_name: string | null;
  phone_number: string | null;
  phone_number_id?: string;
}

interface LeadData {
  id?: string;
  name?: string;
  phone?: string;
  country_code?: string;
  estimated_value?: number | null;
  benefit_type?: string | null;
  cpf?: string | null;
  email?: string | null;
  created_at?: string | null;
  temperature?: string;
  stage_id?: string | null;
  assigned_to?: string | null;
  source?: string | null;
}

/**
 * Formats a value as Brazilian currency
 */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats a date string to DD/MM/YYYY
 */
function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

/**
 * Formats phone number for display
 */
function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  let numbers = phone.replace(/\D/g, '');
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) 9${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return phone;
}

/**
 * Formats CPF for display
 */
function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Replaces template variables in message content
 */
function replaceTemplateVariables(
  content: string,
  lead: LeadData | null,
  agentName?: string
): string {
  let result = content;

  const firstName = lead?.name ? lead.name.split(' ')[0] : '';
  const now = new Date();

  const replacements: Record<string, string> = {
    nome: lead?.name || '',
    primeiro_nome: firstName,
    telefone: lead?.phone ? formatPhoneNumber(lead.phone) : '',
    valor: formatCurrency(lead?.estimated_value),
    data: now.toLocaleDateString('pt-BR'),
    hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    data_inicio: formatDateBR(lead?.created_at) || now.toLocaleDateString('pt-BR'),
    beneficio: lead?.benefit_type || '',
    tipo_beneficio: lead?.benefit_type || '',
    atendente: agentName || '',
    cpf: lead?.cpf ? formatCPF(lead.cpf) : '',
    email: lead?.email || '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    const singlePattern = new RegExp(`\\{${key}\\}`, 'gi');

    if (value) {
      result = result.replace(doublePattern, value);
      result = result.replace(singlePattern, value);
    } else {
      result = result.replace(doublePattern, '');
      result = result.replace(singlePattern, '');
    }
  }

  result = result.replace(/\{\{(\w+)\}\}/g, '');
  result = result.replace(/\{(\w+)\}/g, '');

  return result;
}

// Normaliza URL removendo barras finais
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// Tenta fazer request com múltiplos formatos de auth para WAHA
async function wahaFetch(
  url: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const authFormats: Array<{ name: string; headers: Record<string, string> }> = [
    { name: 'X-Api-Key', headers: { 'X-Api-Key': apiKey } },
    { name: 'Bearer', headers: { Authorization: `Bearer ${apiKey}` } },
    { name: 'ApiKey (sem Bearer)', headers: { Authorization: apiKey } },
  ];

  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (const authFormat of authFormats) {
    try {
      console.log(`[WAHA] Tentando ${options.method || 'GET'} ${url} com ${authFormat.name}`);

      const mergedHeaders: Record<string, string> = {
        ...((options.headers as Record<string, string>) || {}),
        ...authFormat.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      console.log(`[WAHA] ${authFormat.name} - Status: ${response.status}`);

      if (response.ok || response.status !== 401) {
        return response;
      }

      lastResponse = response;
      console.log(`[WAHA] ${authFormat.name} - Unauthorized, tentando próximo...`);
    } catch (error: unknown) {
      console.error(`[WAHA] ${authFormat.name} - Erro:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Todos os formatos de autenticação falharam');
}

// Provider-specific message sending functions
async function sendWAHA(
  config: WhatsAppConfig,
  payload: SendMessagePayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const chatId = payload.phone.replace(/\D/g, '') + '@c.us';
  const session = config.instance_name || 'default';

  let endpoint = '/api/sendText';
  let body: Record<string, unknown> = {
    chatId,
    text: payload.message,
    session,
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = '/api/sendImage';
    body = {
      chatId,
      file: { url: payload.media_url },
      caption: payload.message,
      session,
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: payload.media_url },
      session,
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: payload.media_url },
      caption: payload.message,
      session,
    };
  }

  const url = `${baseUrl}${endpoint}`;
  console.log('[WAHA] Enviando mensagem:', { url, chatId, session, type: payload.type });

  try {
    const response = await wahaFetch(url, config.api_key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('[WAHA] Resposta:', response.status, responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        return { success: false, error: errorData.message || `Erro ${response.status}` };
      } catch {
        return { success: false, error: `Erro ${response.status}: ${responseText}` };
      }
    }

    try {
      const data = JSON.parse(responseText);
      return { success: true, messageId: data.id || data.key?.id };
    } catch {
      return { success: true, messageId: undefined };
    }
  } catch (error: unknown) {
    console.error('[WAHA] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// ========== ENVIO VIA META CLOUD API ==========
async function sendMeta(
  config: WhatsAppConfig,
  payload: SendMessagePayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = config.phone_number_id;
  const accessToken = config.api_key;
  const phone = payload.phone.replace(/\D/g, '');

  if (!phoneNumberId) {
    return { success: false, error: 'Meta Cloud API: phone_number_id não configurado' };
  }

  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  let body: Record<string, unknown>;

  if (payload.type === 'text' || !payload.media_url) {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: payload.message },
    };
  } else if (payload.type === 'image') {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'image',
      image: { link: payload.media_url, caption: payload.message },
    };
  } else if (payload.type === 'audio') {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'audio',
      audio: { link: payload.media_url },
    };
  } else if (payload.type === 'video') {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'video',
      video: { link: payload.media_url, caption: payload.message },
    };
  } else if (payload.type === 'document') {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'document',
      document: { link: payload.media_url, caption: payload.message },
    };
  } else {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: payload.message },
    };
  }

  try {
    console.log('[Meta] Enviando mensagem:', { phoneNumberId, phone, type: payload.type });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Meta] Resposta:', response.status, JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.error?.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error: unknown) {
    console.error('[Meta] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// Get full lead data with labels, funnel stage, and assigned user
async function getLeadFullData(supabase: any, leadId: string) {
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();

  if (!lead) return null;

  // Get labels
  const { data: leadLabels } = await supabase
    .from('lead_labels')
    .select('labels(id, name, color, category)')
    .eq('lead_id', leadId);

  const etiquetas = (leadLabels || [])
    .map((ll: any) => ({
      id: ll.labels?.id,
      nome: ll.labels?.name,
      name: ll.labels?.name,
      cor: ll.labels?.color,
      color: ll.labels?.color,
      categoria: ll.labels?.category,
      category: ll.labels?.category,
    }))
    .filter((e: any) => e.id);

  // Get funnel stage
  let etapaFunil = null;
  if (lead.stage_id) {
    const { data: stage } = await supabase
      .from('funnel_stages')
      .select('id, name, color')
      .eq('id', lead.stage_id)
      .single();
    if (stage) {
      etapaFunil = {
        id: stage.id,
        nome: stage.name,
        name: stage.name,
        cor: stage.color,
        color: stage.color,
      };
    }
  }

  // Get assigned user
  let responsavel = null;
  if (lead.assigned_to) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', lead.assigned_to)
      .single();
    if (profile) {
      responsavel = {
        id: profile.id,
        nome: profile.name,
        name: profile.name,
        email: profile.email,
      };
    }
  }

  return {
    id: lead.id,
    nome: lead.name,
    name: lead.name,
    telefone: formatTelefone(`${lead.country_code || '55'}${lead.phone}`),
    phone: lead.phone,
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
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', erro: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Authorization header required',
          erro: 'Header de autorização obrigatório',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (apiKeyError || !apiKeyId) {
      console.error('[api-messages-send] API key inválida:', apiKeyError);
      return new Response(
        JSON.stringify({
          error: 'Invalid or inactive API key',
          erro: 'API key inválida ou inativa',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[api-messages-send] Payload:', {
      ...payload,
      message: payload.message?.substring(0, 50) + '...',
    });

    // Validate phone format
    const phoneValidation = validatePhone(payload.phone);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: phoneValidation.error,
          erro: phoneValidation.error,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.message) {
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: 'message is required',
          erro: 'Mensagem é obrigatória',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find lead data for variable replacement
    let leadData: LeadData | null = null;
    let leadId = payload.lead_id;
    let conversationId = payload.conversation_id;

    // Try to find lead by ID or phone
    if (payload.lead_id) {
      // Auto-detect: if lead_id looks like a phone (not UUID), treat as phone search
      if (!isValidUUID(payload.lead_id) && looksLikePhone(payload.lead_id)) {
        console.log(
          '[api-messages-send] lead_id looks like a phone number, treating as phone search:',
          payload.lead_id
        );

        const phone = normalizePhoneForSearch(payload.lead_id);
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .or(
            `phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}`
          )
          .limit(1)
          .maybeSingle();

        if (lead) {
          leadData = lead;
          leadId = lead.id;
          console.log('[api-messages-send] Lead encontrado por telefone (auto-detected):', lead.id);
        }
      } else if (isValidUUID(payload.lead_id)) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', payload.lead_id)
          .single();

        if (lead) {
          leadData = lead;
          leadId = lead.id;
        }
      }
    } else if (payload.phone) {
      const phone = normalizePhoneForSearch(payload.phone);
      console.log('[api-messages-send] Buscando lead por telefone:', phone);

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .or(
          `phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}`
        )
        .limit(1)
        .maybeSingle();

      if (lead) {
        leadData = lead;
        leadId = lead.id;
        console.log('[api-messages-send] Lead encontrado:', lead.id);
      }
    }

    // Replace template variables in message
    const processedMessage = replaceTemplateVariables(payload.message, leadData);
    console.log(
      '[api-messages-send] Mensagem processada:',
      processedMessage.substring(0, 50) + '...'
    );

    // Get WhatsApp config
    let config: WhatsAppConfig | null = null;

    if (payload.whatsapp_instance_id) {
      const { data: specificConfig, error: specificError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('id', payload.whatsapp_instance_id)
        .eq('is_active', true)
        .single();

      if (specificError || !specificConfig) {
        console.error(
          '[api-messages-send] Instância específica não encontrada:',
          payload.whatsapp_instance_id
        );
        return new Response(
          JSON.stringify({
            error: 'WhatsApp instance not found or inactive',
            erro: 'Instância WhatsApp não encontrada ou inativa',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      config = specificConfig as WhatsAppConfig;
    } else {
      const { data: configs, error: configError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (configError || !configs || configs.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'No active WhatsApp gateway configured',
            erro: 'Nenhum gateway WhatsApp ativo configurado',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      config = configs[0] as WhatsAppConfig;
    }

    console.log(
      '[api-messages-send] Provider:',
      config.provider,
      'Instance:',
      config.instance_name
    );

    // Create payload with processed message
    const processedPayload: SendMessagePayload = {
      ...payload,
      message: processedMessage,
    };

    // Send message based on provider
    let result: { success: boolean; messageId?: string; error?: string };

    switch (config.provider) {
      case 'waha':
        result = await sendWAHA(config, processedPayload);
        break;
      case 'meta':
        result = await sendMeta(config, processedPayload);
        break;
      default:
        result = {
          success: false,
          error: `Provider não suportado: ${config.provider}. Use 'waha' ou 'meta'.`,
        };
    }

    if (!result.success) {
      console.error('[api-messages-send] Falha ao enviar:', result.error);
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: result.error,
          erro: result.error,
          provider: config.provider,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find existing conversation if we have a lead
    if (!conversationId && leadId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .eq('whatsapp_instance_id', config.id)
        .in('status', ['open', 'pending'])
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      if (conversation) {
        conversationId = conversation.id;
      }
    }

    // Save message to database if we have a conversation
    let messageId = null;
    if (conversationId) {
      const { data: msgData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          lead_id: leadId,
          content: processedMessage,
          type: payload.type || 'text',
          media_url: payload.media_url,
          sender_type: 'agent',
          sender_id: apiKeyId,
          direction: 'outbound',
          status: 'sent',
        })
        .select()
        .single();

      if (!messageError && msgData) {
        messageId = msgData.id;
      }

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    console.log('[api-messages-send] Mensagem enviada:', result.messageId);

    // Get full lead data for response
    const leadFullData = leadId ? await getLeadFullData(supabase, leadId) : null;

    // Get conversation data
    let conversationData = null;
    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (conv) {
        conversationData = {
          id: conv.id,
          status: conv.status,
          status_pt: mapConversationStatus(conv.status),
          nao_lidas: conv.unread_count,
          unread_count: conv.unread_count,
          ultima_mensagem_em: conv.last_message_at,
          last_message_at: conv.last_message_at,
          criada_em: conv.created_at,
          created_at: conv.created_at,
        };
      }
    }

    // Build rich response (following chat-v2-mensagem pattern)
    const response = {
      sucesso: true,
      success: true,
      request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
      mensagem_id: messageId,
      message_id: messageId,
      external_message_id: result.messageId,

      instancia_whatsapp: {
        id: config.id,
        nome: config.name,
        name: config.name,
        telefone: formatTelefone(config.phone_number),
        phone_number: config.phone_number,
        identificador: config.instance_name,
        instance_name: config.instance_name,
        provider: config.provider,
      },
      whatsapp_instance: {
        id: config.id,
        name: config.name,
        phone_number: config.phone_number,
        instance_name: config.instance_name,
        provider: config.provider,
      },

      mensagem: {
        id: messageId,
        tipo: payload.type || 'text',
        type: payload.type || 'text',
        conteudo: processedMessage,
        content: processedMessage,
        midia_url: payload.media_url,
        media_url: payload.media_url,
        enviada_em: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        status: 'enviada',
        direcao: 'saida',
        direction: 'outbound',
      },
      message: {
        id: messageId,
        type: payload.type || 'text',
        content: processedMessage,
        media_url: payload.media_url,
        sent_at: new Date().toISOString(),
        status: 'sent',
        direction: 'outbound',
      },

      lead: leadFullData,
      contato: leadFullData,

      conversa: conversationData,
      conversation: conversationData,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'An unexpected error occurred');
  }
});
