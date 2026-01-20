import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessagePayload {
  conversation_id: string;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  reply_to_external_id?: string; // ID externo da mensagem sendo respondida
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

// Helper para verificar se o texto é um placeholder de mídia
function isMediaPlaceholder(text: string | undefined | null): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Verifica se é placeholder como [image], [video], [audio], [document], [Áudio]
  return /^\[(image|video|audio|document|Áudio)\]$/i.test(trimmed);
}

// Helper para obter caption limpo (undefined se for placeholder)
function getCleanCaption(message: string | undefined | null): string | undefined {
  if (isMediaPlaceholder(message)) return undefined;
  return message || undefined;
}

// Gera preview do conteúdo da mensagem para exibição na lista
function getMessagePreview(content: string, type: string): string {
  switch (type) {
    case 'image': return '📷 Imagem';
    case 'audio': return '🎵 Áudio';
    case 'video': return '🎬 Vídeo';
    case 'document': return '📄 Documento';
    case 'sticker': return '🏷️ Figurinha';
    default: return content?.substring(0, 100) || '';
  }
}

// Converte storage:// URLs para signed URLs públicas
// deno-lint-ignore no-explicit-any
async function resolveStorageUrl(
  supabase: any,
  storageUrl: string | undefined
): Promise<string | undefined> {
  if (!storageUrl) {
    return undefined;
  }

  // Se não é storage://, retorna como está
  if (!storageUrl.startsWith('storage://')) {
    return storageUrl;
  }

  console.log('[send-whatsapp-message] Convertendo storage URL:', storageUrl);

  // storage://bucket-name/path/to/file.ext
  const withoutProtocol = storageUrl.replace('storage://', '');
  const [bucket, ...pathParts] = withoutProtocol.split('/');
  const path = pathParts.join('/');

  if (!bucket || !path) {
    console.error('[send-whatsapp-message] URL storage:// malformada:', storageUrl);
    throw new Error(`URL de mídia inválida: ${storageUrl}`);
  }

  // Gerar signed URL com validade de 1 hora
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600); // 1 hora

  if (error || !data?.signedUrl) {
    console.error('[send-whatsapp-message] Erro ao gerar signed URL:', error);
    throw new Error(
      `Falha ao gerar URL pública para mídia: ${error?.message || 'erro desconhecido'}`
    );
  }

  console.log(
    '[send-whatsapp-message] Signed URL gerada:',
    data.signedUrl.substring(0, 80) + '...'
  );
  return data.signedUrl;
}

// DDDs válidos do Brasil (11-99, excluindo alguns inexistentes)
const VALID_DDDS = new Set([
  // Região Sudeste
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19, // São Paulo
  21,
  22,
  24, // Rio de Janeiro
  27,
  28, // Espírito Santo
  31,
  32,
  33,
  34,
  35,
  37,
  38, // Minas Gerais
  // Região Sul
  41,
  42,
  43,
  44,
  45,
  46, // Paraná
  47,
  48,
  49, // Santa Catarina
  51,
  53,
  54,
  55, // Rio Grande do Sul
  // Região Centro-Oeste
  61, // Distrito Federal
  62,
  64, // Goiás
  63, // Tocantins
  65,
  66, // Mato Grosso
  67, // Mato Grosso do Sul
  // Região Nordeste
  71,
  73,
  74,
  75,
  77, // Bahia
  79, // Sergipe
  81,
  87, // Pernambuco
  82, // Alagoas
  83, // Paraíba
  84, // Rio Grande do Norte
  85,
  88, // Ceará
  86,
  89, // Piauí
  // Região Norte
  91,
  93,
  94, // Pará
  92,
  97, // Amazonas
  95, // Roraima
  96, // Amapá
  98,
  99, // Maranhão
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
      error: `Número de telefone muito curto (${numbers.length} dígitos). Formato esperado: (DDD) 9XXXX-XXXX`,
    };
  }

  // Verifica tamanho máximo (13 dígitos com código país: 55 + DDD + 9 dígitos)
  if (numbers.length > 13) {
    return {
      valid: false,
      error: `Número de telefone muito longo (${numbers.length} dígitos). Verifique se há dígitos extras.`,
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
        error: 'Número com código 55 deve ter 12-13 dígitos (55 + DDD + número)',
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
        error: 'Número sem código do país deve ter 10-11 dígitos (DDD + número)',
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
      error: `DDD ${ddd} não é válido no Brasil. Verifique o código de área.`,
    };
  }

  // Valida número (8 ou 9 dígitos)
  if (phoneNumber.length < 8 || phoneNumber.length > 9) {
    return {
      valid: false,
      error: `Número após DDD deve ter 8-9 dígitos, mas tem ${phoneNumber.length}`,
    };
  }

  // Celulares brasileiros começam com 9
  if (phoneNumber.length === 9 && !phoneNumber.startsWith('9')) {
    return {
      valid: false,
      error: 'Celulares brasileiros com 9 dígitos devem começar com 9',
    };
  }

  // Verifica se não são todos dígitos iguais (número inválido)
  if (/^(\d)\1+$/.test(phoneNumber)) {
    return {
      valid: false,
      error: 'Número de telefone inválido (todos os dígitos são iguais)',
    };
  }

  return { valid: true, normalized };
}

// Interface para lead com campos de substituição
interface LeadForTemplate {
  id: string;
  phone: string;
  name: string;
  country_code?: string | null; // Código do país (55, 1, 595, etc)
  estimated_value?: number | null;
  created_at?: string | null;
  benefit_type?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  whatsapp_chat_id?: string | null;
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

// Verifica se um número existe no WhatsApp e obtém o chatId correto
// Isso resolve o problema "No LID for user" para números novos
async function getWahaContactChatId(
  baseUrl: string,
  apiKey: string,
  session: string,
  phone: string
): Promise<{ exists: boolean; chatId?: string; error?: string }> {
  try {
    // Remove o + se existir e garante formato limpo
    const cleanPhone = phone.replace(/^\+/, '');

    const url = `${baseUrl}/api/contacts/check-exists?phone=${cleanPhone}&session=${session}`;
    console.log('[WAHA] Verificando existência do número:', url);

    const response = await wahaFetch(url, apiKey, { method: 'GET' });
    const responseText = await response.text();
    console.log('[WAHA] check-exists resposta:', response.status, responseText);

    if (!response.ok) {
      // Se endpoint não existe (versão antiga WAHA), usar formato padrão @c.us
      if (response.status === 404) {
        console.log('[WAHA] Endpoint check-exists não encontrado, usando formato @c.us padrão');
        return { exists: true, chatId: `${cleanPhone}@c.us` };
      }
      return { exists: false, error: `Erro ao verificar número: ${response.status}` };
    }

    const data = JSON.parse(responseText);
    // Resposta esperada: { "numberExists": true, "chatId": "5545988428644@c.us" }
    // ou para LID: { "numberExists": true, "chatId": "5545988428644@lid" }

    console.log('[WAHA] Resultado check-exists:', data);

    if (!data.numberExists) {
      return {
        exists: false,
        error: 'Este número não está registrado no WhatsApp. Verifique se o número está correto.',
      };
    }

    // Usar o chatId retornado pela API (pode ser @c.us ou @lid)
    const chatId = data.chatId || `${cleanPhone}@c.us`;
    console.log('[WAHA] ChatId obtido:', chatId);

    return { exists: true, chatId };
  } catch (error) {
    console.error('[WAHA] Erro ao verificar existência:', error);
    // Em caso de erro, tenta com formato padrão @c.us
    return { exists: true, chatId: `${phone}@c.us` };
  }
}

// Provider-specific message sending functions
// Nota: phone já vem validado e normalizado (formato: 5511999999999)
// cachedChatId: chatId cacheado do banco de dados (evita chamada à API check-exists)
async function sendWAHA(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  type: string,
  mediaUrl?: string,
  cachedChatId?: string | null,
  replyToExternalId?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string; chatId?: string }> {
  const baseUrl = normalizeUrl(config.base_url);
  const session = config.instance_name || 'default';

  let chatId: string;

  // Se temos chatId cacheado, usar direto (evita chamada à API)
  if (cachedChatId) {
    chatId = cachedChatId;
    console.log('[WAHA] Usando chatId cacheado:', chatId);
  } else {
    // Verificar número e obter chatId correto ANTES de enviar
    // Isso resolve o problema "No LID for user" para números novos
    const checkResult = await getWahaContactChatId(baseUrl, config.api_key, session, phone);

    if (!checkResult.exists || !checkResult.chatId) {
      console.log('[WAHA] Número não existe no WhatsApp:', checkResult.error);
      return {
        success: false,
        error: checkResult.error || 'Número não existe no WhatsApp',
      };
    }

    chatId = checkResult.chatId;
    console.log('[WAHA] ChatId obtido da API:', chatId);
  }

  let endpoint = '/api/sendText';
  let body: Record<string, unknown> = {
    chatId,
    text: message,
    session,
  };

  // Adicionar reply_to se estiver respondendo uma mensagem
  if (replyToExternalId) {
    body.reply_to = replyToExternalId;
    console.log('[WAHA] Enviando como reply para:', replyToExternalId);
  }

  if (type === 'image' && mediaUrl) {
    endpoint = '/api/sendImage';
    const cleanCaption = getCleanCaption(message);
    body = {
      chatId,
      file: { url: mediaUrl },
      ...(cleanCaption && { caption: cleanCaption }), // Só incluir se tiver texto real
      session,
    };
    if (replyToExternalId) body.reply_to = replyToExternalId;
  } else if (type === 'video' && mediaUrl) {
    // Suporte a vídeo
    endpoint = '/api/sendVideo';
    const cleanCaption = getCleanCaption(message);
    body = {
      chatId,
      file: { url: mediaUrl },
      ...(cleanCaption && { caption: cleanCaption }),
      session,
    };
    if (replyToExternalId) body.reply_to = replyToExternalId;
  } else if (type === 'audio' && mediaUrl) {
    // Usar endpoint específico para áudio/voz
    endpoint = '/api/sendVoice';
    body = {
      chatId,
      file: {
        url: mediaUrl,
        mimetype: 'audio/ogg; codecs=opus',
      },
      convert: true, // Converte automaticamente para formato opus
      session,
    };
    if (replyToExternalId) body.reply_to = replyToExternalId;
  } else if (type === 'document' && mediaUrl) {
    endpoint = '/api/sendFile';
    const cleanCaption = getCleanCaption(message);
    body = {
      chatId,
      file: { url: mediaUrl },
      ...(cleanCaption && { caption: cleanCaption }), // Só incluir se tiver texto real
      session,
    };
    if (replyToExternalId) body.reply_to = replyToExternalId;
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
          const mediaTypeLabel =
            type === 'audio'
              ? 'áudio'
              : type === 'image'
                ? 'imagens'
                : type === 'video'
                  ? 'vídeos'
                  : 'arquivos';
          return {
            success: false,
            error: `Envio de ${mediaTypeLabel} não suportado na versão gratuita do WAHA com engine GOWS. Altere o engine para WEBJS ou faça upgrade para WAHA Plus.`,
          };
        }

        // Detectar erro "No LID for user" - agora não deveria ocorrer pois verificamos antes
        if (responseText.includes('No LID for user')) {
          return {
            success: false,
            error:
              'Falha ao resolver identificador do contato no WhatsApp. Tente novamente ou verifique a conexão.',
          };
        }

        // Detectar erro de sessão não encontrada
        if (
          responseText.includes('session') &&
          (responseText.includes('not found') || responseText.includes('not exists'))
        ) {
          return {
            success: false,
            error:
              'Sessão do WhatsApp não encontrada. Verifique o nome da instância na configuração.',
          };
        }

        return {
          success: false,
          error: errorData.message || errorData.exception?.message || `Erro ${response.status}`,
        };
      } catch {
        return { success: false, error: `Erro ${response.status}: ${responseText}` };
      }
    }

    try {
      const data = JSON.parse(responseText);
      // Extrair ID corretamente - WAHA retorna em formato aninhado
      // Estrutura: { id: { fromMe: true, id: "3EB0...", _serialized: "true_555..._3EB0..." }, _data: {...} }
      let messageId: string | undefined;

      // Formato 1: data.id é string direta (raro)
      if (typeof data.id === 'string') {
        messageId = data.id;
      }
      // Formato 2: data.id é objeto com ._serialized (priorizar formato completo para DELETE funcionar)
      else if (data.id && typeof data.id === 'object') {
        // IMPORTANTE: Priorizar _serialized pois contém formato completo necessário para DELETE no WAHA
        messageId = data.id._serialized || data.id.id;
      }
      // Formato 3: data.key.id
      else if (data.key && typeof data.key.id === 'string') {
        messageId = data.key.id;
      }
      // Formato 4: data._data.id (fallback) - também priorizar _serialized
      else if (data._data?.id && typeof data._data.id === 'object') {
        messageId = data._data.id._serialized || data._data.id.id;
      }

      console.log(
        '[WAHA] MessageId extraído:',
        messageId,
        'raw:',
        JSON.stringify({ id: data.id?.id, serialized: data.id?._serialized })
      );
      // Retorna também o chatId para atualização do cache
      return { success: true, messageId, chatId };
    } catch {
      return { success: true, messageId: undefined, chatId };
    }
  } catch (error: unknown) {
    console.error('[WAHA] Erro de request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendEvolution(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  type: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
        apikey: config.api_key,
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

async function sendZAPI(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  type: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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

async function sendCustom(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  type: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = normalizeUrl(config.base_url);

  try {
    console.log('[Custom] Enviando mensagem:', { baseUrl });

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[send-whatsapp-message] User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-whatsapp-message] User:', user.id);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    console.log('[send-whatsapp-message] Payload:', {
      conversation_id: payload.conversation_id,
      content: payload.content?.substring(0, 50) + '...',
      type: payload.type,
    });

    // Validação: conversation_id sempre obrigatório
    // content obrigatório apenas para tipo 'text' - mídias podem ter content vazio
    const isMediaType =
      payload.type && ['image', 'audio', 'video', 'document'].includes(payload.type);
    const hasMedia = !!payload.media_url;

    if (!payload.conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Para texto, content é obrigatório. Para mídia, content pode ser vazio se tiver media_url
    if (!payload.content && !hasMedia) {
      return new Response(
        JSON.stringify({ error: 'content é obrigatório para mensagens de texto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation with lead info (incluindo mais campos para substituição de variáveis)
    // IMPORTANTE: Incluir whatsapp_instance_id para usar a mesma instância que recebeu
    // IMPORTANTE: Incluir assigned_to para auto-atribuição quando responder
    // IMPORTANTE: Incluir country_code para suporte internacional
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(
        `
        id,
        lead_id,
        whatsapp_instance_id,
        assigned_to,
        leads (
          id,
          phone,
          name,
          country_code,
          estimated_value,
          created_at,
          benefit_type,
          cpf,
          birth_date,
          whatsapp_chat_id
        )
      `
      )
      .eq('id', payload.conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[send-whatsapp-message] Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // leads is a single object (not array) due to .single() on conversations
    const lead = conversation.leads as unknown as LeadForTemplate | null;
    if (!lead?.phone) {
      return new Response(JSON.stringify({ error: 'Lead não possui telefone cadastrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Montar número completo com código do país
    const countryCode = (lead as LeadForTemplate).country_code || '55';
    const fullPhoneNumber = `${countryCode}${lead.phone.replace(/\D/g, '')}`;
    console.log(
      '[send-whatsapp-message] Lead:',
      lead.name,
      'Phone local:',
      lead.phone,
      'Country:',
      countryCode,
      'Full:',
      fullPhoneNumber
    );

    // Validação flexível - só para Brasil fazer validação rigorosa
    if (countryCode === '55') {
      const phoneValidation = validateBrazilianPhone(lead.phone);
      if (!phoneValidation.valid) {
        console.error(
          '[send-whatsapp-message] Número brasileiro inválido:',
          lead.phone,
          '-',
          phoneValidation.error
        );
        return new Response(
          JSON.stringify({
            error: `Número de telefone inválido: ${phoneValidation.error}`,
            phone: lead.phone,
            lead_name: lead.name,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Para números internacionais, apenas verificar tamanho mínimo
      const digits = lead.phone.replace(/\D/g, '');
      if (digits.length < 8) {
        console.error('[send-whatsapp-message] Número internacional muito curto:', lead.phone);
        return new Response(
          JSON.stringify({
            error: `Número de telefone muito curto (${digits.length} dígitos). Mínimo: 8 dígitos.`,
            phone: lead.phone,
            country_code: countryCode,
            lead_name: lead.name,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(
      '[send-whatsapp-message] Conversa whatsapp_instance_id:',
      conversation.whatsapp_instance_id
    );

    // Get WhatsApp config - PRIORIZAR a instância específica da conversa
    let configQuery = supabase.from('whatsapp_config').select('*').eq('is_active', true);

    // Se a conversa tem uma instância específica, usar ela
    if (conversation.whatsapp_instance_id) {
      console.log(
        '[send-whatsapp-message] Usando instância específica da conversa:',
        conversation.whatsapp_instance_id
      );
      configQuery = configQuery.eq('id', conversation.whatsapp_instance_id);
    } else {
      console.log(
        '[send-whatsapp-message] Conversa sem instância específica, usando qualquer ativa'
      );
      configQuery = configQuery.limit(1);
    }

    const { data: configs, error: configError } = await configQuery;

    if (configError) {
      console.error('[send-whatsapp-message] Config error:', configError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar configuração do WhatsApp' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum gateway WhatsApp ativo configurado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = configs[0] as WhatsAppConfig;
    console.log(
      '[send-whatsapp-message] Provider:',
      config.provider,
      'Instance:',
      config.instance_name
    );

    // Substitui variáveis de template no conteúdo da mensagem
    const messageContent = replaceTemplateVariables(payload.content, lead);
    console.log('[send-whatsapp-message] Conteúdo original:', payload.content?.substring(0, 50));
    console.log('[send-whatsapp-message] Conteúdo processado:', messageContent?.substring(0, 50));

    // Send message based on provider (usando número já validado)
    const messageType = payload.type || 'text';
    let result: { success: boolean; messageId?: string; error?: string; chatId?: string };

    // Converter storage:// URL para signed URL pública antes de enviar
    let resolvedMediaUrl: string | undefined;
    try {
      resolvedMediaUrl = await resolveStorageUrl(supabase, payload.media_url);
    } catch (urlError) {
      console.error('[send-whatsapp-message] Erro ao resolver URL de mídia:', urlError);
      return new Response(
        JSON.stringify({
          success: false,
          error: urlError instanceof Error ? urlError.message : 'Erro ao processar URL de mídia',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (config.provider) {
      case 'waha':
        // Passar chatId cacheado e reply_to_external_id para o WAHA
        result = await sendWAHA(
          config,
          fullPhoneNumber,
          messageContent,
          messageType,
          resolvedMediaUrl,
          lead.whatsapp_chat_id,
          payload.reply_to_external_id
        );
        break;
      case 'evolution':
        result = await sendEvolution(
          config,
          fullPhoneNumber,
          messageContent,
          messageType,
          resolvedMediaUrl
        );
        break;
      case 'z-api':
        result = await sendZAPI(
          config,
          fullPhoneNumber,
          messageContent,
          messageType,
          resolvedMediaUrl
        );
        break;
      case 'custom':
        result = await sendCustom(
          config,
          fullPhoneNumber,
          messageContent,
          messageType,
          resolvedMediaUrl
        );
        break;
      default:
        result = { success: false, error: 'Provider desconhecido' };
    }

    if (!result.success) {
      console.error('[send-whatsapp-message] Falha ao enviar:', result.error);
      // Importante: retornar 200 para evitar que o client trate como "erro de edge function" (422)
      // e possa exibir uma mensagem amigável via `data.success === false`.
      return new Response(
        JSON.stringify({ success: false, error: result.error, provider: config.provider }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CACHE: Se obtivemos um chatId novo (não estava cacheado), salvar no banco
    if (config.provider === 'waha' && result.chatId && result.chatId !== lead.whatsapp_chat_id) {
      console.log('[send-whatsapp-message] Atualizando cache de whatsapp_chat_id:', result.chatId);
      await supabase.from('leads').update({ whatsapp_chat_id: result.chatId }).eq('id', lead.id);
    }

    // Save message to database with external_id for status tracking
    // Salva o conteúdo JÁ PROCESSADO (com variáveis substituídas)
    // Também salva reply_to_external_id se estiver respondendo
    const messageInsertData: Record<string, unknown> = {
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
      source: 'crm', // Marca que foi enviada pelo CRM
      waha_message_id: result.messageId || null, // Prevenir duplicação quando webhook receber echo
    };

    // Adicionar reply_to_external_id e buscar mensagem original para quoted_message
    if (payload.reply_to_external_id) {
      messageInsertData.reply_to_external_id = payload.reply_to_external_id;
      console.log(
        '[send-whatsapp-message] Salvando mensagem como reply para:',
        payload.reply_to_external_id
      );

      // Buscar mensagem original pelo external_id para popular quoted_message
      const { data: originalMessage, error: originalError } = await supabase
        .from('messages')
        .select('id, content, type, sender_type, sender_id, lead_id')
        .eq('external_id', payload.reply_to_external_id)
        .single();

      if (originalMessage && !originalError) {
        // Determinar quem enviou a mensagem original
        let fromName = 'Lead';
        if (originalMessage.sender_type === 'agent') {
          const { data: agent } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', originalMessage.sender_id)
            .single();
          fromName = agent?.name || 'Agente';
        } else if (originalMessage.lead_id) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('name')
            .eq('id', originalMessage.lead_id)
            .single();
          fromName = leadData?.name || 'Lead';
        }

        // Preencher quoted_message com os dados
        messageInsertData.quoted_message = {
          id: payload.reply_to_external_id,
          body: originalMessage.content || '',
          from: fromName,
          type: originalMessage.type || 'text',
        };

        console.log('[send-whatsapp-message] Quote populado:', messageInsertData.quoted_message);
      } else {
        console.warn(
          '[send-whatsapp-message] Mensagem original não encontrada para quote:',
          payload.reply_to_external_id,
          originalError
        );
      }
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert(messageInsertData)
      .select()
      .single();

    if (messageError) {
      console.error('[send-whatsapp-message] Erro ao salvar mensagem:', messageError);
      // Mensagem foi enviada, mas não salva - ainda retorna sucesso
    }

    // Update conversation last_message_at and last_message_content
    // AUTO-ATRIBUIÇÃO: Se a conversa não tem atendente, atribuir ao usuário que está respondendo
    // Nota: messageType já definido na linha ~1051
    const updateData: { last_message_at: string; last_message_content: string; assigned_to?: string } = {
      last_message_at: new Date().toISOString(),
      last_message_content: getMessagePreview(payload.content, messageType),
    };

    if (!conversation.assigned_to) {
      console.log('[send-whatsapp-message] Auto-atribuindo conversa ao usuário:', user.id);
      updateData.assigned_to = user.id;

      // Atribuir lead também para manter sincronizado
      await supabase.from('leads').update({ assigned_to: user.id }).eq('id', lead.id);
    }

    await supabase.from('conversations').update(updateData).eq('id', payload.conversation_id);

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
      JSON.stringify({ error: 'Ocorreu um erro ao processar sua solicitação.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
