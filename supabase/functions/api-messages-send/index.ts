import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    ddd: withoutCountry.substring(0, 2)
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
    JSON.stringify({ success: false, error: publicMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

interface SendMessagePayload {
  phone: string;
  message: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  lead_id?: string;
  conversation_id?: string;
  whatsapp_instance_id?: string; // ID da instância WhatsApp específica a usar
}

interface WhatsAppConfig {
  id: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name: string | null;
}

interface LeadData {
  name?: string;
  phone?: string;
  estimated_value?: number | null;
  benefit_type?: string | null;
  cpf?: string | null;
  email?: string | null;
  created_at?: string | null;
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
  // Remove country code if present
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }
  // Format as (XX) 9XXXX-XXXX
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
 * Supports both {{variable}} and {variable} formats
 */
function replaceTemplateVariables(content: string, lead: LeadData | null, agentName?: string): string {
  let result = content;
  
  const firstName = lead?.name ? lead.name.split(' ')[0] : '';
  const now = new Date();
  
  // Build replacements map
  const replacements: Record<string, string> = {
    'nome': lead?.name || '',
    'primeiro_nome': firstName,
    'telefone': lead?.phone ? formatPhoneNumber(lead.phone) : '',
    'valor': formatCurrency(lead?.estimated_value),
    'data': now.toLocaleDateString('pt-BR'),
    'hora': now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    'data_inicio': formatDateBR(lead?.created_at) || now.toLocaleDateString('pt-BR'),
    'beneficio': lead?.benefit_type || '',
    'tipo_beneficio': lead?.benefit_type || '',
    'atendente': agentName || '',
    'cpf': lead?.cpf ? formatCPF(lead.cpf) : '',
    'email': lead?.email || '',
  };
  
  // Replace {{variable}} and {variable} patterns
  for (const [key, value] of Object.entries(replacements)) {
    const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    const singlePattern = new RegExp(`\\{${key}\\}`, 'gi');
    
    if (value) {
      result = result.replace(doublePattern, value);
      result = result.replace(singlePattern, value);
    } else {
      // Remove unmatched variables
      result = result.replace(doublePattern, '');
      result = result.replace(singlePattern, '');
    }
  }
  
  // Remove any remaining unmatched variables
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
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'ApiKey (sem Bearer)', headers: { 'Authorization': apiKey } },
  ];

  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (const authFormat of authFormats) {
    try {
      console.log(`[WAHA] Tentando ${options.method || 'GET'} ${url} com ${authFormat.name}`);
      
      const mergedHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
        ...authFormat.headers,
      };
      
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      console.log(`[WAHA] ${authFormat.name} - Status: ${response.status}`);

      // Se deu certo ou não é erro de auth, retorna
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

  // Se chegou aqui, nenhum formato funcionou
  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('Todos os formatos de autenticação falharam');
}

// Provider-specific message sending functions
async function sendWAHA(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
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

async function sendEvolution(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const number = payload.phone.replace(/\D/g, '');
  const instance = config.instance_name || 'default';
  
  let endpoint = `/message/sendText/${instance}`;
  let body: Record<string, unknown> = {
    number,
    text: payload.message,
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'image',
      media: payload.media_url,
      caption: payload.message,
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = `/message/sendWhatsAppAudio/${instance}`;
    body = {
      number,
      audio: payload.media_url,
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'document',
      media: payload.media_url,
      caption: payload.message,
    };
  }

  try {
    console.log('[Evolution] Enviando mensagem:', { baseUrl, endpoint, number });
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Evolution] Resposta:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.key?.id };
  } catch (error: unknown) {
    console.error('[Evolution] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendZAPI(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const phone = payload.phone.replace(/\D/g, '');
  
  let endpoint = '/send-text';
  let body: Record<string, unknown> = {
    phone,
    message: payload.message,
  };

  if (payload.type === 'image' && payload.media_url) {
    endpoint = '/send-image';
    body = {
      phone,
      image: payload.media_url,
      caption: payload.message,
    };
  } else if (payload.type === 'audio' && payload.media_url) {
    endpoint = '/send-audio';
    body = {
      phone,
      audio: payload.media_url,
    };
  } else if (payload.type === 'document' && payload.media_url) {
    endpoint = '/send-document';
    body = {
      phone,
      document: payload.media_url,
    };
  }

  try {
    console.log('[Z-API] Enviando mensagem:', { baseUrl, endpoint, phone });
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.api_key,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Z-API] Resposta:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.messageId };
  } catch (error: unknown) {
    console.error('[Z-API] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendCustom(config: WhatsAppConfig, payload: SendMessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  
  try {
    console.log('[Custom] Enviando mensagem:', { baseUrl });
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        phone: payload.phone,
        message: payload.message,
        type: payload.type || 'text',
        media_url: payload.media_url,
      }),
    });

    const data = await response.json();
    console.log('[Custom] Resposta:', response.status, JSON.stringify(data));
    
    if (!response.ok) {
      return { success: false, error: data.message || `Erro ${response.status}` };
    }

    return { success: true, messageId: data.messageId || data.id };
  } catch (error: unknown) {
    console.error('[Custom] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
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
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', { key_value: apiKey });

    if (apiKeyError || !apiKeyId) {
      console.error('[api-messages-send] API key inválida:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'API key inválida ou inativa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[api-messages-send] Payload:', { ...payload, message: payload.message?.substring(0, 50) + '...' });

    // Validate phone format
    const phoneValidation = validatePhone(payload.phone);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: phoneValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.message) {
      return new Response(
        JSON.stringify({ success: false, error: 'message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find lead data for variable replacement
    let leadData: LeadData | null = null;
    let leadId = payload.lead_id;
    let conversationId = payload.conversation_id;
    
    // Try to find lead by ID or phone
    if (payload.lead_id) {
      // Auto-detect: se lead_id parece um telefone (não é UUID), tratar como busca por telefone
      if (!isValidUUID(payload.lead_id) && looksLikePhone(payload.lead_id)) {
        console.log('[api-messages-send] lead_id looks like a phone number, treating as phone search:', payload.lead_id);
        
        const phone = normalizePhoneForSearch(payload.lead_id);
        const { data: lead } = await supabase
          .from('leads')
          .select('id, name, phone, estimated_value, benefit_type, cpf, email, created_at')
          .or(`phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}`)
          .limit(1)
          .maybeSingle();
        
        if (lead) {
          leadData = lead;
          leadId = lead.id;
          console.log('[api-messages-send] Lead encontrado por telefone (auto-detected):', lead.id, '| stored phone:', lead.phone);
        } else {
          console.log('[api-messages-send] Lead não encontrado para telefone (em lead_id):', payload.lead_id);
        }
        
      } else if (!isValidUUID(payload.lead_id)) {
        // Não é UUID válido nem parece telefone - tentar buscar mesmo assim
        console.warn('[api-messages-send] lead_id não é UUID válido nem parece telefone:', payload.lead_id);
        
      } else {
        // É UUID válido - buscar normalmente
        const { data: lead } = await supabase
          .from('leads')
          .select('id, name, phone, estimated_value, benefit_type, cpf, email, created_at')
          .eq('id', payload.lead_id)
          .single();
        
        if (lead) {
          leadData = lead;
          leadId = lead.id;
        }
      }
    } else if (payload.phone) {
      // Usar normalização robusta para buscar lead
      const phone = normalizePhoneForSearch(payload.phone);
      console.log('[api-messages-send] Buscando lead por telefone:', phone);
      
      const { data: lead } = await supabase
        .from('leads')
        .select('id, name, phone, estimated_value, benefit_type, cpf, email, created_at')
        .or(`phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}`)
        .limit(1)
        .maybeSingle();
      
      if (lead) {
        leadData = lead;
        leadId = lead.id;
        console.log('[api-messages-send] Lead encontrado:', lead.id, '| stored phone:', lead.phone);
      } else {
        console.log('[api-messages-send] Lead não encontrado para telefone:', payload.phone);
      }
    }

    // Replace template variables in message
    const processedMessage = replaceTemplateVariables(payload.message, leadData);
    console.log('[api-messages-send] Mensagem processada:', processedMessage.substring(0, 50) + '...');

    // Get WhatsApp config - prioritize specific instance if provided
    let config: WhatsAppConfig | null = null;
    
    if (payload.whatsapp_instance_id) {
      // Use specific instance if provided
      const { data: specificConfig, error: specificError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('id', payload.whatsapp_instance_id)
        .eq('is_active', true)
        .single();
      
      if (specificError || !specificConfig) {
        console.error('[api-messages-send] Instância específica não encontrada:', payload.whatsapp_instance_id);
        return new Response(
          JSON.stringify({ error: 'Instância WhatsApp não encontrada ou inativa' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      config = specificConfig as WhatsAppConfig;
      console.log('[api-messages-send] Usando instância específica:', config.instance_name);
    } else {
      // Fallback: use first active instance
      const { data: configs, error: configError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (configError) {
        console.error('[api-messages-send] Erro ao buscar config:', configError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar configuração do WhatsApp' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!configs || configs.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhum gateway WhatsApp ativo configurado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      config = configs[0] as WhatsAppConfig;
    }
    console.log('[api-messages-send] Provider:', config.provider, 'Instance:', config.instance_name);

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
      case 'evolution':
        result = await sendEvolution(config, processedPayload);
        break;
      case 'z-api':
        result = await sendZAPI(config, processedPayload);
        break;
      case 'custom':
        result = await sendCustom(config, processedPayload);
        break;
      default:
        result = { success: false, error: 'Provider desconhecido' };
    }

    if (!result.success) {
      console.error('[api-messages-send] Falha ao enviar:', result.error);
      return new Response(
        JSON.stringify({ error: result.error, provider: config.provider }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find existing conversation if we have a lead - filter by whatsapp_instance_id
    if (!conversationId && leadId) {
      let convQuery = supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .eq('whatsapp_instance_id', config.id) // Filter by instance to separate conversations
        .in('status', ['open', 'pending'])
        .order('last_message_at', { ascending: false })
        .limit(1);

      const { data: conversation } = await convQuery.single();

      if (conversation) {
        conversationId = conversation.id;
      }
    }

    // Save message to database if we have a conversation
    if (conversationId) {
      const { error: messageError } = await supabase
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
        });

      if (messageError) {
        console.error('[api-messages-send] Erro ao salvar mensagem:', messageError);
      }

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    console.log('[api-messages-send] Mensagem enviada:', result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        provider: config.provider,
        conversation_id: conversationId,
        lead_id: leadId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return safeErrorResponse(error, 'An unexpected error occurred');
  }
});
