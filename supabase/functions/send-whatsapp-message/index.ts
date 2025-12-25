import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessagePayload {
  conversation_id: string;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
}

interface WhatsAppConfig {
  id: string;
  provider: 'waha' | 'evolution' | 'z-api' | 'custom';
  base_url: string;
  api_key: string;
  instance_name: string | null;
}

// Normaliza URL removendo barras finais
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// DDDs válidos do Brasil (11-99, excluindo alguns inexistentes)
const VALID_DDDS = new Set([
  // Região Sudeste
  11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
  21, 22, 24, // Rio de Janeiro
  27, 28, // Espírito Santo
  31, 32, 33, 34, 35, 37, 38, // Minas Gerais
  // Região Sul
  41, 42, 43, 44, 45, 46, // Paraná
  47, 48, 49, // Santa Catarina
  51, 53, 54, 55, // Rio Grande do Sul
  // Região Centro-Oeste
  61, // Distrito Federal
  62, 64, // Goiás
  63, // Tocantins
  65, 66, // Mato Grosso
  67, // Mato Grosso do Sul
  // Região Nordeste
  71, 73, 74, 75, 77, // Bahia
  79, // Sergipe
  81, 87, // Pernambuco
  82, // Alagoas
  83, // Paraíba
  84, // Rio Grande do Norte
  85, 88, // Ceará
  86, 89, // Piauí
  // Região Norte
  91, 93, 94, // Pará
  92, 97, // Amazonas
  95, // Roraima
  96, // Amapá
  98, 99, // Maranhão
  69, // Rondônia
  68, // Acre
]);

// Valida telefone brasileiro e retorna objeto com resultado
interface PhoneValidation {
  valid: boolean;
  normalized?: string;
  error?: string;
}

function validateBrazilianPhone(phone: string): PhoneValidation {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Número de telefone não informado' };
  }

  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');
  
  // Verifica tamanho mínimo (10 dígitos sem código país: DDD + 8 dígitos)
  if (numbers.length < 10) {
    return { 
      valid: false, 
      error: `Número de telefone muito curto (${numbers.length} dígitos). Formato esperado: (DDD) 9XXXX-XXXX` 
    };
  }

  // Verifica tamanho máximo (13 dígitos com código país: 55 + DDD + 9 dígitos)
  if (numbers.length > 13) {
    return { 
      valid: false, 
      error: `Número de telefone muito longo (${numbers.length} dígitos). Verifique se há dígitos extras.` 
    };
  }

  let ddd: number;
  let phoneNumber: string;
  let normalized: string;

  // Determina formato baseado no tamanho
  if (numbers.startsWith('55')) {
    // Com código do país
    if (numbers.length < 12 || numbers.length > 13) {
      return { 
        valid: false, 
        error: 'Número com código 55 deve ter 12-13 dígitos (55 + DDD + número)' 
      };
    }
    ddd = parseInt(numbers.substring(2, 4));
    phoneNumber = numbers.substring(4);
    normalized = numbers;
  } else {
    // Sem código do país
    if (numbers.length < 10 || numbers.length > 11) {
      return { 
        valid: false, 
        error: 'Número sem código do país deve ter 10-11 dígitos (DDD + número)' 
      };
    }
    ddd = parseInt(numbers.substring(0, 2));
    phoneNumber = numbers.substring(2);
    normalized = '55' + numbers;
  }

  // Valida DDD
  if (!VALID_DDDS.has(ddd)) {
    return { 
      valid: false, 
      error: `DDD ${ddd} não é válido no Brasil. Verifique o código de área.` 
    };
  }

  // Valida número (8 ou 9 dígitos)
  if (phoneNumber.length < 8 || phoneNumber.length > 9) {
    return { 
      valid: false, 
      error: `Número após DDD deve ter 8-9 dígitos, mas tem ${phoneNumber.length}` 
    };
  }

  // Celulares brasileiros começam com 9
  if (phoneNumber.length === 9 && !phoneNumber.startsWith('9')) {
    return { 
      valid: false, 
      error: 'Celulares brasileiros com 9 dígitos devem começar com 9' 
    };
  }

  // Verifica se não são todos dígitos iguais (número inválido)
  if (/^(\d)\1+$/.test(phoneNumber)) {
    return { 
      valid: false, 
      error: 'Número de telefone inválido (todos os dígitos são iguais)' 
    };
  }

  return { valid: true, normalized };
}

// Interface para lead com campos de substituição
interface LeadForTemplate {
  id: string;
  phone: string;
  name: string;
  estimated_value?: number | null;
  created_at?: string | null;
  benefit_type?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
}

// Substitui variáveis de template no conteúdo da mensagem
function replaceTemplateVariables(content: string, lead: LeadForTemplate): string {
  let result = content;
  
  // Formata data de criação
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  };
  
  // Formata valor monetário
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  // Formata CPF
  const formatCPF = (cpf: string | null | undefined): string => {
    if (!cpf) return '';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return cpf;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };
  
  // Formata telefone
  const formatPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    // Remove código do país se presente
    const local = digits.startsWith('55') && digits.length >= 12 ? digits.substring(2) : digits;
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
    return phone;
  };
  
  // Substituições
  result = result.replace(/\{nome\}/gi, lead.name || '');
  result = result.replace(/\{telefone\}/gi, formatPhone(lead.phone));
  result = result.replace(/\{valor\}/gi, formatCurrency(lead.estimated_value));
  result = result.replace(/\{data_inicio\}/gi, formatDate(lead.created_at));
  result = result.replace(/\{data_criacao\}/gi, formatDate(lead.created_at));
  result = result.replace(/\{beneficio\}/gi, lead.benefit_type || '');
  result = result.replace(/\{tipo_beneficio\}/gi, lead.benefit_type || '');
  result = result.replace(/\{cpf\}/gi, formatCPF(lead.cpf));
  result = result.replace(/\{data_nascimento\}/gi, formatDate(lead.birth_date));
  
  return result;
}

// Normaliza telefone para envio (adiciona código do país 55 se necessário)
// DEPRECATED: Use validateBrazilianPhone instead
function normalizePhoneForSending(phone: string): string {
  const validation = validateBrazilianPhone(phone);
  return validation.normalized || phone.replace(/\D/g, '');
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
// Nota: phone já vem validado e normalizado (formato: 5511999999999)
async function sendWAHA(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const chatId = phone + '@c.us'; // phone já está normalizado
  const session = config.instance_name || 'default';
  
  let endpoint = '/api/sendText';
  let body: Record<string, unknown> = {
    chatId,
    text: message,
    session,
  };

  if (type === 'image' && mediaUrl) {
    endpoint = '/api/sendImage';
    body = {
      chatId,
      file: { url: mediaUrl },
      caption: message,
      session,
    };
  } else if (type === 'audio' && mediaUrl) {
    // WAHA Free com GOWS engine não suporta sendFile para áudio
    // Enviar como texto informativo em vez de falhar
    endpoint = '/api/sendText';
    body = {
      chatId,
      text: message || '🎤 [Áudio]',
      session,
    };
  } else if (type === 'document' && mediaUrl) {
    endpoint = '/api/sendFile';
    body = {
      chatId,
      file: { url: mediaUrl },
      caption: message,
      session,
    };
  }

  const url = `${baseUrl}${endpoint}`;
  console.log('[WAHA] Enviando mensagem:', { url, chatId, session, type });

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
        
        // Detectar erro de versão Plus do WAHA
        if (responseText.includes('Plus version') || responseText.includes('GOWS')) {
          const mediaTypeLabel = type === 'audio' ? 'áudio' : type === 'image' ? 'imagens' : type === 'video' ? 'vídeos' : 'arquivos';
          return { 
            success: false, 
            error: `Envio de ${mediaTypeLabel} não suportado na versão gratuita do WAHA com engine GOWS. Altere o engine para WEBJS ou faça upgrade para WAHA Plus.` 
          };
        }
        
        // Detectar erro "No LID for user" - sessão não conectada ou número inválido
        if (responseText.includes('No LID for user')) {
          return { 
            success: false, 
            error: 'Sessão do WhatsApp desconectada ou número não existe no WhatsApp. Verifique a conexão do WhatsApp na configuração.' 
          };
        }
        
        // Detectar erro de sessão não encontrada
        if (responseText.includes('session') && (responseText.includes('not found') || responseText.includes('not exists'))) {
          return { 
            success: false, 
            error: 'Sessão do WhatsApp não encontrada. Verifique o nome da instância na configuração.' 
          };
        }
        
        return { success: false, error: errorData.message || errorData.exception?.message || `Erro ${response.status}` };
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

async function sendEvolution(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const number = phone; // phone já está validado e normalizado
  const instance = config.instance_name || 'default';
  
  let endpoint = `/message/sendText/${instance}`;
  let body: Record<string, unknown> = {
    number,
    text: message,
  };

  if (type === 'image' && mediaUrl) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'image',
      media: mediaUrl,
      caption: message,
    };
  } else if (type === 'audio' && mediaUrl) {
    endpoint = `/message/sendWhatsAppAudio/${instance}`;
    body = {
      number,
      audio: mediaUrl,
    };
  } else if (type === 'document' && mediaUrl) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number,
      mediatype: 'document',
      media: mediaUrl,
      caption: message,
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

async function sendZAPI(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const phoneNumber = phone; // phone já está validado e normalizado
  
  let endpoint = '/send-text';
  let body: Record<string, unknown> = {
    phone: phoneNumber,
    message: message,
  };

  if (type === 'image' && mediaUrl) {
    endpoint = '/send-image';
    body = {
      phone: phoneNumber,
      image: mediaUrl,
      caption: message,
    };
  } else if (type === 'audio' && mediaUrl) {
    endpoint = '/send-audio';
    body = {
      phone: phoneNumber,
      audio: mediaUrl,
    };
  } else if (type === 'document' && mediaUrl) {
    endpoint = '/send-document';
    body = {
      phone: phoneNumber,
      document: mediaUrl,
    };
  }

  try {
    console.log('[Z-API] Enviando mensagem:', { baseUrl, endpoint, phone: phoneNumber });
    
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

async function sendCustom(config: WhatsAppConfig, phone: string, message: string, type: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
        phone,
        message,
        type: type || 'text',
        media_url: mediaUrl,
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
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[send-whatsapp-message] User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-whatsapp-message] User:', user.id);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[send-whatsapp-message] Payload:', { 
      conversation_id: payload.conversation_id,
      content: payload.content?.substring(0, 50) + '...',
      type: payload.type
    });

    if (!payload.conversation_id || !payload.content) {
      return new Response(
        JSON.stringify({ error: 'conversation_id e content são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation with lead info (incluindo mais campos para substituição de variáveis)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        lead_id,
        leads (
          id,
          phone,
          name,
          estimated_value,
          created_at,
          benefit_type,
          cpf,
          birth_date
        )
      `)
      .eq('id', payload.conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[send-whatsapp-message] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // leads is a single object (not array) due to .single() on conversations
    const lead = conversation.leads as unknown as LeadForTemplate | null;
    if (!lead?.phone) {
      return new Response(
        JSON.stringify({ error: 'Lead não possui telefone cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar número de telefone brasileiro ANTES de tentar enviar
    const phoneValidation = validateBrazilianPhone(lead.phone);
    if (!phoneValidation.valid) {
      console.error('[send-whatsapp-message] Número inválido:', lead.phone, '-', phoneValidation.error);
      return new Response(
        JSON.stringify({ 
          error: `Número de telefone inválido: ${phoneValidation.error}`,
          phone: lead.phone,
          lead_name: lead.name
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validatedPhone = phoneValidation.normalized!;
    console.log('[send-whatsapp-message] Lead:', lead.name, 'Phone original:', lead.phone, 'Normalizado:', validatedPhone);

    // Get active WhatsApp config
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError) {
      console.error('[send-whatsapp-message] Config error:', configError);
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

    const config = configs[0] as WhatsAppConfig;
    console.log('[send-whatsapp-message] Provider:', config.provider, 'Instance:', config.instance_name);

    // Substitui variáveis de template no conteúdo da mensagem
    const messageContent = replaceTemplateVariables(payload.content, lead);
    console.log('[send-whatsapp-message] Conteúdo original:', payload.content?.substring(0, 50));
    console.log('[send-whatsapp-message] Conteúdo processado:', messageContent?.substring(0, 50));

    // Send message based on provider (usando número já validado)
    const messageType = payload.type || 'text';
    let result: { success: boolean; messageId?: string; error?: string };
    
    switch (config.provider) {
      case 'waha':
        result = await sendWAHA(config, validatedPhone, messageContent, messageType, payload.media_url);
        break;
      case 'evolution':
        result = await sendEvolution(config, validatedPhone, messageContent, messageType, payload.media_url);
        break;
      case 'z-api':
        result = await sendZAPI(config, validatedPhone, messageContent, messageType, payload.media_url);
        break;
      case 'custom':
        result = await sendCustom(config, validatedPhone, messageContent, messageType, payload.media_url);
        break;
      default:
        result = { success: false, error: 'Provider desconhecido' };
    }

    if (!result.success) {
      console.error('[send-whatsapp-message] Falha ao enviar:', result.error);
      return new Response(
        JSON.stringify({ error: result.error, provider: config.provider }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save message to database with external_id for status tracking
    // Salva o conteúdo JÁ PROCESSADO (com variáveis substituídas)
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: payload.conversation_id,
        lead_id: lead.id,
        content: messageContent, // Usar conteúdo processado
        type: messageType,
        media_url: payload.media_url,
        sender_type: 'agent',
        sender_id: user.id,
        direction: 'outbound',
        status: 'sent',
        external_id: result.messageId || null, // ID do WhatsApp para rastrear status
      })
      .select()
      .single();

    if (messageError) {
      console.error('[send-whatsapp-message] Erro ao salvar mensagem:', messageError);
      // Mensagem foi enviada, mas não salva - ainda retorna sucesso
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', payload.conversation_id);

    console.log('[send-whatsapp-message] Mensagem enviada com sucesso:', result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        message: savedMessage,
        provider: config.provider,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-whatsapp-message] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
