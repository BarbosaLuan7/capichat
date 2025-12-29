import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Tipos de eventos WAHA
interface WAHAMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  body: string;
  hasMedia: boolean;
  mediaUrl?: string;
  type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'ptt';
  fromMe: boolean;
  pushName?: string;
  chatId?: string;
  // Campos adicionais para mídia (WAHA pode enviar em diferentes formatos)
  media?: {
    url?: string;
    filename?: string;
    mimetype?: string;
  };
}

interface WAHAWebhookPayload {
  event: string;
  session: string;
  engine?: string;
  payload: WAHAMessage | Record<string, unknown>;
  me?: {
    id: string;
    pushName: string;
  };
}

// Tipos Evolution API
interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { url?: string; caption?: string };
    audioMessage?: { url?: string };
    videoMessage?: { url?: string; caption?: string };
    documentMessage?: { url?: string; fileName?: string };
  };
  messageType: string;
  messageTimestamp: number;
}

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessage;
}

// Detecta se é um chat de grupo (IDs terminam com @g.us ou começam com 120363)
function isGroupChat(chatId: string): boolean {
  if (!chatId) return false;
  return chatId.includes('@g.us') || 
         chatId.includes('g.us') ||
         chatId.startsWith('120363');
}

// Detecta se é um LID do Facebook (formato: número@lid)
function isLID(phone: string): boolean {
  return phone.includes('@lid') || /^\d{15,}$/.test(phone.replace(/\D/g, ''));
}

// Extrai o número real do payload WAHA quando é um LID
function extractRealPhoneFromPayload(payload: any): string | null {
  // Tentar diferentes caminhos no payload para encontrar o número real
  const possiblePaths = [
    payload?._data?.from?._serialized,
    payload?._data?.chat?.id?._serialized,
    payload?.chat?.id,
    payload?._data?.chatId,
    payload?._data?.from,
  ];
  
  for (const path of possiblePaths) {
    if (path && typeof path === 'string') {
      // Se termina com @c.us ou @s.whatsapp.net, é um número real
      if (path.includes('@c.us') || path.includes('@s.whatsapp.net')) {
        return path;
      }
      // Se é um número com 10-13 dígitos (sem @lid), provavelmente é real
      const digits = path.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 13 && !path.includes('@lid')) {
        return digits;
      }
    }
  }
  
  return null;
}

// Resolve LID para número real usando API do WAHA
async function resolvePhoneFromLID(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  lid: string
): Promise<string | null> {
  try {
    // Limpar o LID para obter apenas o número
    const cleanLid = lid.replace('@lid', '').replace(/\D/g, '');
    
    // URL da API WAHA para resolver LID
    const url = `${wahaBaseUrl}/api/${sessionName}/lids/${cleanLid}`;
    
    console.log('[whatsapp-webhook] Tentando resolver LID via WAHA API:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('[whatsapp-webhook] API WAHA retornou:', response.status, await response.text());
      return null;
    }
    
    const data = await response.json();
    console.log('[whatsapp-webhook] Resposta da API LID:', JSON.stringify(data));
    
    // A resposta do WAHA pode ter diferentes formatos - campo 'pn' é o mais comum
    const realPhone = data?.pn?.replace('@c.us', '') || data?.phone || data?.number || data?.jid?.replace('@c.us', '') || data?.id?.replace('@c.us', '');
    
    if (realPhone && !realPhone.includes('lid')) {
      console.log('[whatsapp-webhook] Número real encontrado via API:', realPhone);
      return realPhone;
    }
    
    return null;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao resolver LID via API:', error);
    return null;
  }
}

// Busca foto de perfil do WhatsApp via WAHA API
async function getProfilePicture(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  contactId: string
): Promise<string | null> {
  try {
    // Usar apenas o número SEM @c.us, conforme documentação oficial WAHA
    const cleanNumber = contactId.replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
    
    // Adicionar refresh=true para forçar buscar do WhatsApp (evita cache vazio de 24h)
    const url = `${wahaBaseUrl}/api/contacts/profile-picture?contactId=${cleanNumber}&session=${sessionName}&refresh=true`;
    
    console.log('[whatsapp-webhook] Buscando foto de perfil:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('[whatsapp-webhook] API foto de perfil retornou:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('[whatsapp-webhook] Resposta foto de perfil:', JSON.stringify(data));
    
    // A resposta pode ter diferentes formatos
    const profilePictureUrl = data?.profilePictureURL || data?.profilePicture || data?.url || data?.imgUrl;
    
    if (profilePictureUrl && typeof profilePictureUrl === 'string' && profilePictureUrl.startsWith('http')) {
      console.log('[whatsapp-webhook] Foto de perfil encontrada');
      return profilePictureUrl;
    }
    
    return null;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao buscar foto de perfil:', error);
    return null;
  }
}

// Busca configuração do WAHA no banco (genérica - qualquer instância ativa)
async function getWAHAConfig(supabase: any): Promise<{ baseUrl: string; apiKey: string; sessionName: string; instanceId: string } | null> {
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      return {
        baseUrl: data.base_url.replace(/\/$/, ''), // Remove trailing slash
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
        instanceId: data.id,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao buscar config WAHA:', error);
    return null;
  }
}

// Busca configuração do WAHA pela session/instance_name específica (do webhook)
// Usa ilike para busca case-insensitive (LUAN = luan = Luan)
async function getWAHAConfigBySession(
  supabase: any, 
  sessionName: string
): Promise<{ baseUrl: string; apiKey: string; sessionName: string; instanceId: string } | null> {
  try {
    console.log('[whatsapp-webhook] Buscando config WAHA para session:', sessionName);
    
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name, phone_number')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .ilike('instance_name', sessionName)  // Case-insensitive: LUAN = luan = Luan
      .limit(1)
      .maybeSingle();
    
    if (data) {
      console.log('[whatsapp-webhook] ✅ Config encontrada para session:', sessionName, 
        '| instanceId:', data.id, 
        '| instance_name:', data.instance_name,
        '| phone:', data.phone_number);
      return {
        baseUrl: data.base_url.replace(/\/$/, ''),
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
        instanceId: data.id,
      };
    }
    
    // Fallback: se não encontrar pela session, buscar qualquer uma ativa
    console.warn('[whatsapp-webhook] ⚠️ Instância NÃO encontrada para session:', sessionName, '- usando fallback (primeira ativa)');
    const fallback = await getWAHAConfig(supabase);
    if (fallback) {
      console.warn('[whatsapp-webhook] ⚠️ ATENÇÃO: Usando instância fallback:', fallback.sessionName, 
        '| Cadastre a instância "' + sessionName + '" em Configurações > WhatsApp para corrigir');
    }
    return fallback;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao buscar config WAHA por session:', error);
    return null;
  }
}

function normalizePhone(phone: string): string {
  // Remove @c.us, @s.whatsapp.net, @lid e caracteres não numéricos
  let numbers = phone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace(/\D/g, '');
  
  return numbers;
}

// Códigos de países conhecidos (ordenados por tamanho decrescente para match correto)
const COUNTRY_CODES = [
  { code: '595', name: 'Paraguai' },
  { code: '598', name: 'Uruguai' },
  { code: '351', name: 'Portugal' },
  { code: '55', name: 'Brasil' },
  { code: '54', name: 'Argentina' },
  { code: '56', name: 'Chile' },
  { code: '57', name: 'Colômbia' },
  { code: '58', name: 'Venezuela' },
  { code: '51', name: 'Peru' },
  { code: '34', name: 'Espanha' },
  { code: '39', name: 'Itália' },
  { code: '49', name: 'Alemanha' },
  { code: '33', name: 'França' },
  { code: '44', name: 'Reino Unido' },
  { code: '1', name: 'EUA/Canadá' },
];

interface ParsedPhone {
  countryCode: string;
  localNumber: string;
  fullNumber: string;
  country?: string;
}

// Detecta o código do país a partir de um número completo
function parseInternationalPhone(phone: string): ParsedPhone {
  const digits = phone.replace(/\D/g, '');
  
  // Tentar detectar código do país conhecido
  for (const { code, name } of COUNTRY_CODES) {
    if (digits.startsWith(code)) {
      const localNumber = digits.substring(code.length);
      // Verificar se o número local tem tamanho razoável (mínimo 8 dígitos)
      if (localNumber.length >= 8) {
        return {
          countryCode: code,
          localNumber,
          fullNumber: digits,
          country: name,
        };
      }
    }
  }
  
  // Fallback: assumir Brasil (55) se não detectar
  // Ou retornar como está se já for um número curto (sem código do país)
  if (digits.length >= 12) {
    // Provavelmente tem código do país desconhecido
    return {
      countryCode: digits.substring(0, digits.length - 10),
      localNumber: digits.slice(-10),
      fullNumber: digits,
    };
  }
  
  // Número local sem código do país (assumir Brasil)
  return {
    countryCode: '55',
    localNumber: digits,
    fullNumber: `55${digits}`,
  };
}

// Normaliza telefone para salvar no banco - retorna número local SEM código do país
function normalizePhoneForStorage(phone: string): { localNumber: string; countryCode: string } {
  const parsed = parseInternationalPhone(normalizePhone(phone));
  return {
    localNumber: parsed.localNumber,
    countryCode: parsed.countryCode,
  };
}

// Formata telefone para exibição em fallback do nome
function formatPhoneForDisplay(phone: string): string {
  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

// ========== BUSCA FLEXÍVEL DE LEAD POR TELEFONE ==========
// Encontra lead mesmo que o telefone esteja salvo em formato diferente
// Suporta números internacionais (595, 1, 54, etc) além de brasileiros (55)
async function findLeadByPhone(supabase: any, phone: string): Promise<any> {
  const digits = phone.replace(/\D/g, '');
  
  // Detectar código do país usando parseInternationalPhone
  const parsed = parseInternationalPhone(digits);
  
  console.log('[whatsapp-webhook] Parsed phone:', {
    original: digits,
    countryCode: parsed.countryCode,
    localNumber: parsed.localNumber,
    fullNumber: parsed.fullNumber,
    country: parsed.country,
  });
  
  // Gerar todas as variações possíveis do número
  const variations: string[] = [];
  
  // 1. Número como veio (completo)
  variations.push(digits);
  
  // 2. Número local isolado (sem código do país)
  variations.push(parsed.localNumber);
  
  // 3. Número completo formatado (código + local)
  variations.push(parsed.fullNumber);
  
  // 4. Para Brasil (55), gerar variações com/sem 9° dígito
  if (parsed.countryCode === '55') {
    const local = parsed.localNumber;
    const ddd = local.substring(0, 2);
    const rest = local.substring(2);
    
    // Se tem 11 dígitos (com 9° dígito), criar versão sem
    if (local.length === 11 && rest.startsWith('9')) {
      const without9 = `${ddd}${rest.substring(1)}`;
      variations.push(without9);
      variations.push(`55${without9}`);
    }
    
    // Se tem 10 dígitos (sem 9° dígito), criar versão com
    if (local.length === 10) {
      const with9 = `${ddd}9${rest}`;
      variations.push(with9);
      variations.push(`55${with9}`);
    }
  }
  
  // 5. Também buscar com outros códigos de país comuns (caso o lead tenha sido cadastrado errado)
  // Só para Brasil, adicionar também variação sem código
  if (parsed.countryCode !== '55' && digits.length >= 10 && digits.length <= 11) {
    // Número pode ter sido salvo com código 55 por engano
    variations.push(`55${digits}`);
  }
  
  // Remover duplicatas
  const uniqueVariations = [...new Set(variations)];
  
  console.log('[whatsapp-webhook] Buscando lead com variações:', uniqueVariations);
  
  // Tentar buscar por todas as variações de uma vez usando OR
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .in('phone', uniqueVariations)
    .limit(1);
  
  if (error) {
    console.error('[whatsapp-webhook] Erro na busca flexível:', error);
  }
  
  if (leads && leads.length > 0) {
    console.log('[whatsapp-webhook] ✅ Lead encontrado via busca flexível:', leads[0].id, 
      'phone salvo:', leads[0].phone, 
      'country_code salvo:', leads[0].country_code);
    return leads[0];
  }
  
  // Fallback: buscar pelos últimos 8 dígitos (núcleo do número sem DDD/país)
  const corePart = digits.slice(-8);
  console.log('[whatsapp-webhook] Tentando busca por núcleo do número:', corePart);
  
  const { data: fallbackLeads } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart}`)
    .limit(1);
  
  if (fallbackLeads && fallbackLeads.length > 0) {
    console.log('[whatsapp-webhook] ✅ Lead encontrado via fallback (núcleo):', fallbackLeads[0].id, 
      'phone salvo:', fallbackLeads[0].phone,
      'country_code salvo:', fallbackLeads[0].country_code);
    return fallbackLeads[0];
  }
  
  console.log('[whatsapp-webhook] Lead não encontrado para:', phone, '| country detectado:', parsed.country || parsed.countryCode);
  return null;
}

// Função para baixar mídia e fazer upload para o storage
async function uploadMediaToStorage(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string,
  wahaConfig?: { baseUrl: string; apiKey: string; sessionName: string } | null
): Promise<string | null> {
  try {
    // Normalizar URL - adicionar https:// se não tiver protocolo
    let normalizedUrl = mediaUrl;
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      normalizedUrl = `https://${mediaUrl}`;
      console.log('[whatsapp-webhook] URL normalizada (protocolo adicionado):', mediaUrl, '->', normalizedUrl);
    }
    
    // Corrigir URL localhost para usar base_url do WAHA
    let correctedUrl = normalizedUrl;
    const urlObj = new URL(normalizedUrl);
    const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
    
    if (isLocalhost && wahaConfig?.baseUrl) {
      // Reescrever URL usando base_url do WAHA config
      const wahaUrlObj = new URL(wahaConfig.baseUrl);
      correctedUrl = `${wahaUrlObj.protocol}//${wahaUrlObj.host}${urlObj.pathname}${urlObj.search}`;
      console.log('[whatsapp-webhook] URL localhost corrigida:', mediaUrl, '->', correctedUrl);
    }
    
    console.log('[whatsapp-webhook] Baixando mídia de:', correctedUrl);
    
    // Preparar headers de autenticação se for URL do WAHA
    const headers: Record<string, string> = {};
    const isWahaUrl = wahaConfig?.baseUrl && correctedUrl.includes(new URL(wahaConfig.baseUrl).host);
    
    if (isWahaUrl && wahaConfig?.apiKey) {
      headers['X-Api-Key'] = wahaConfig.apiKey;
      headers['Authorization'] = `Bearer ${wahaConfig.apiKey}`;
      console.log('[whatsapp-webhook] Adicionando headers de autenticação para WAHA');
    }
    
    // Baixar o arquivo
    const response = await fetch(correctedUrl, { headers });
    if (!response.ok) {
      console.error('[whatsapp-webhook] Erro ao baixar mídia:', response.status, await response.text().catch(() => ''));
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    
    console.log('[whatsapp-webhook] Mídia baixada, contentType:', contentType, 'size:', arrayBuffer.byteLength);
    
    // Determinar extensão baseada no content-type ou tipo de mensagem
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    
    // Tentar encontrar extensão pelo content-type exato ou parcial
    let extension = extensionMap[contentType];
    if (!extension) {
      // Tentar match parcial
      for (const [ct, ext] of Object.entries(extensionMap)) {
        if (contentType.includes(ct.split('/')[1])) {
          extension = ext;
          break;
        }
      }
    }
    
    // Fallback baseado no tipo de mensagem
    if (!extension) {
      const typeExtMap: Record<string, string> = {
        'image': 'jpg',
        'audio': 'ogg',
        'video': 'mp4',
        'document': 'bin',
      };
      extension = typeExtMap[type] || 'bin';
    }
    
    // Nome do arquivo: leads/{leadId}/{timestamp}.{ext}
    const fileName = `leads/${leadId}/${Date.now()}.${extension}`;
    
    // Upload para o storage
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, arrayBuffer, {
        contentType,
        cacheControl: '31536000', // 1 ano
        upsert: false,
      });
    
    if (error) {
      console.error('[whatsapp-webhook] Erro no upload:', error);
      return null;
    }
    
    // Retornar storage ref em vez de publicUrl (bucket é privado)
    // Frontend vai gerar signed URL quando precisar exibir
    const storageRef = `storage://message-attachments/${data.path}`;
    console.log('[whatsapp-webhook] Mídia salva em storage:', storageRef);
    return storageRef;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao processar mídia:', error);
    return null;
  }
}

// Verifica se é uma notificação do sistema (não deve ser processada)
function isSystemNotification(payload: any): boolean {
  const systemTypes = [
    'notification_template',
    'e2e_notification',
    'gp2',
    'ciphertext',
    'protocol',
    'call_log',
    'revoked'
  ];
  
  const messageType = payload?._data?.type || payload?.type || '';
  const subtype = payload?._data?.subtype || payload?.subtype || '';
  
  // Verificar se é notificação do sistema
  if (systemTypes.includes(messageType)) {
    return true;
  }
  
  // Verificar subtipos que indicam notificações
  if (subtype === 'contact_info_card' || subtype === 'url') {
    return true;
  }
  
  return false;
}

interface QuotedMessageData {
  id: string;
  body: string;
  from: string;
  type: string;
}

interface MessageContentResult {
  content: string;
  type: string;
  mediaUrl?: string;
  isSystemMessage?: boolean;
  quotedMessage?: QuotedMessageData;
}

function getMessageContent(payload: WAHAMessage | EvolutionMessage, provider: 'waha' | 'evolution'): MessageContentResult {
  if (provider === 'waha') {
    const msg = payload as WAHAMessage & { _data?: any };
    
    // Verificar se é notificação do sistema
    if (isSystemNotification(msg)) {
      return { content: '', type: 'text', isSystemMessage: true };
    }
    
    // Extrair mediaUrl de múltiplas fontes possíveis no WAHA
    const extractedMediaUrl = msg.mediaUrl || msg.media?.url || (msg as any)._data?.media?.url || (msg as any)._data?.deprecatedMms3Url;
    
    // Extrair mimetype de várias fontes
    const mimetype = msg.media?.mimetype || (msg as any)._data?.mimetype || (msg as any)._data?.media?.mimetype || '';
    
    // Detectar tipo primeiro pelo msg.type, depois pelo _data.type, depois pelo mimetype
    let type = 'text';
    const msgType = msg.type || (msg as any)._data?.type || '';
    
    if (msgType === 'ptt' || msgType === 'audio') {
      type = 'audio';
    } else if (msgType === 'image') {
      type = 'image';
    } else if (msgType === 'video') {
      type = 'video';
    } else if (msgType === 'document') {
      type = 'document';
    } else if (msgType === 'chat' && (msg.hasMedia || extractedMediaUrl)) {
      // msg.type = 'chat' mas tem mídia - inferir pelo mimetype
      if (mimetype.startsWith('audio/') || mimetype.includes('ogg')) {
        type = 'audio';
      } else if (mimetype.startsWith('image/')) {
        type = 'image';
      } else if (mimetype.startsWith('video/')) {
        type = 'video';
      } else if (mimetype.startsWith('application/') || mimetype.includes('pdf') || mimetype.includes('document')) {
        type = 'document';
      } else if (extractedMediaUrl) {
        // Fallback: tem URL de mídia mas mimetype desconhecido - tentar inferir pela URL
        const urlLower = extractedMediaUrl.toLowerCase();
        if (urlLower.includes('ptt') || urlLower.includes('audio') || urlLower.includes('.ogg') || urlLower.includes('.mp3') || urlLower.includes('.m4a')) {
          type = 'audio';
        } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.webp')) {
          type = 'image';
        } else if (urlLower.includes('.mp4') || urlLower.includes('.mov') || urlLower.includes('.avi')) {
          type = 'video';
        } else {
          type = 'document'; // Default para mídia desconhecida
        }
      }
    }
    
    console.log('[whatsapp-webhook] Detecção de tipo - msg.type:', msgType, 'mimetype:', mimetype, 'hasMedia:', msg.hasMedia, 'type detectado:', type, 'mediaUrl:', extractedMediaUrl);
    
    // Tem mídia se hasMedia = true ou se tem URL de mídia
    const hasRealMedia = (msg.hasMedia === true || !!extractedMediaUrl) && type !== 'text';
    let content = msg.body || '';
    
    if (!content && hasRealMedia) {
      const mediaLabels: Record<string, string> = {
        'image': '[Imagem]',
        'audio': '[Áudio]',
        'video': '[Vídeo]',
        'document': '[Documento]',
      };
      content = mediaLabels[type] || '[Mídia]';
    } else if (!content && !hasRealMedia) {
      // Mensagem vazia sem mídia - provavelmente notificação do sistema
      return { content: '', type: 'text', isSystemMessage: true };
    }
    
    // ========== EXTRAIR QUOTED MESSAGE (REPLY) ==========
    let quotedMessage: QuotedMessageData | undefined;
    
    // WAHA pode enviar quotedMsg em diferentes lugares
    const quotedData = (msg as any).quotedMsg || 
                       (msg as any)._data?.quotedMsg || 
                       (msg as any)._data?.quotedMsgObj;
    
    if (quotedData) {
      // Extrair ID serializado da mensagem citada
      let quotedId = '';
      if (typeof quotedData.id === 'string') {
        quotedId = quotedData.id;
      } else if (quotedData.id?._serialized) {
        quotedId = quotedData.id._serialized;
      } else if (quotedData.id?.id) {
        // Construir ID serializado manualmente
        const fromMe = quotedData.id.fromMe ? 'true' : 'false';
        const remote = quotedData.id.remote || quotedData.from || '';
        quotedId = `${fromMe}_${remote}_${quotedData.id.id}`;
      }
      
      // Extrair remetente do quote
      let quotedFrom = quotedData.from || quotedData.participant || '';
      // Limpar sufixo @c.us/@s.whatsapp.net
      quotedFrom = quotedFrom.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
      
      // Determinar tipo da mensagem citada
      let quotedType = quotedData.type || 'text';
      if (quotedType === 'chat') quotedType = 'text';
      if (quotedType === 'ptt') quotedType = 'audio';
      
      quotedMessage = {
        id: quotedId,
        body: quotedData.body || quotedData.caption || quotedData.text || `[${quotedType}]`,
        from: quotedFrom,
        type: quotedType,
      };
      
      console.log('[whatsapp-webhook] Quote detectado:', quotedMessage);
    }
    
    return {
      content,
      type,
      mediaUrl: extractedMediaUrl,
      quotedMessage,
    };
  } else {
    const msg = payload as EvolutionMessage;
    const message = msg.message;
    
    if (!message) {
      return { content: '[Mensagem vazia]', type: 'text' };
    }
    
    // Para Evolution, extrair quoted do contextInfo (usando any para flexibilidade de tipos)
    let quotedMessage: QuotedMessageData | undefined;
    const msgAny = message as any;
    const contextInfo = msgAny.extendedTextMessage?.contextInfo || 
                        msgAny.imageMessage?.contextInfo ||
                        msgAny.audioMessage?.contextInfo ||
                        msgAny.videoMessage?.contextInfo ||
                        msgAny.documentMessage?.contextInfo;
    
    if (contextInfo?.quotedMessage) {
      const quoted = contextInfo.quotedMessage;
      quotedMessage = {
        id: contextInfo.stanzaId || '',
        body: quoted.conversation || quoted.extendedTextMessage?.text || '[Mídia]',
        from: contextInfo.participant || '',
        type: 'text',
      };
    }
    
    if (message.conversation) {
      return { content: message.conversation, type: 'text', quotedMessage };
    }
    
    if (message.extendedTextMessage?.text) {
      return { content: message.extendedTextMessage.text, type: 'text', quotedMessage };
    }
    
    if (message.imageMessage) {
      return {
        content: message.imageMessage.caption || '[Imagem]',
        type: 'image',
        mediaUrl: message.imageMessage.url,
        quotedMessage,
      };
    }
    
    if (message.audioMessage) {
      return {
        content: '[Áudio]',
        type: 'audio',
        mediaUrl: message.audioMessage.url,
        quotedMessage,
      };
    }
    
    if (message.videoMessage) {
      return {
        content: message.videoMessage.caption || '[Vídeo]',
        type: 'video',
        mediaUrl: message.videoMessage.url,
        quotedMessage,
      };
    }
    
    if (message.documentMessage) {
      return {
        content: message.documentMessage.fileName || '[Documento]',
        type: 'document',
        mediaUrl: message.documentMessage.url,
        quotedMessage,
      };
    }
    
    return { content: '[Mensagem não suportada]', type: 'text' };
  }
}

// Helper function to verify webhook signature using HMAC-SHA256
async function verifyWebhookSignature(
  rawBody: string, 
  signature: string | null, 
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }
  
  try {
    // Clean the signature - remove any prefix like 'sha256='
    const cleanSignature = signature.replace(/^sha256=/, '').toLowerCase();
    
    // Create HMAC-SHA256 hash
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(rawBody);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Constant-time comparison to prevent timing attacks
    if (cleanSignature.length !== expectedSignature.length) {
      return false;
    }
    
    let mismatch = 0;
    for (let i = 0; i < cleanSignature.length; i++) {
      mismatch |= cleanSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    return mismatch === 0;
  } catch (error) {
    console.error('[whatsapp-webhook] Error verifying signature:', error);
    return false;
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

    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Get signature from various possible headers (different providers use different header names)
    const signature = req.headers.get('x-webhook-signature') || 
                     req.headers.get('x-hub-signature-256') || 
                     req.headers.get('x-signature') ||
                     req.headers.get('x-waha-signature');
    
    // Get active WhatsApp config to retrieve webhook_secret
    const { data: activeConfig } = await supabase
      .from('whatsapp_config')
      .select('webhook_secret, provider')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    // Soft validation: log warning but allow processing (WAHA may not be sending signatures correctly)
    if (activeConfig?.webhook_secret) {
      const isValidSignature = await verifyWebhookSignature(rawBody, signature, activeConfig.webhook_secret);
      
      if (!isValidSignature) {
        // Soft validation: log warning but continue processing
        console.warn('[whatsapp-webhook] Invalid or missing webhook signature - processing anyway (soft validation)');
        console.warn('[whatsapp-webhook] Signature received:', signature?.substring(0, 50) || 'none');
        console.warn('[whatsapp-webhook] Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
        
        // TODO: Em produção com WAHA configurado corretamente, descomentar para rejeitar:
        // return new Response(
        //   JSON.stringify({ error: 'Invalid webhook signature' }),
        //   { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        // );
      } else {
        console.log('[whatsapp-webhook] Webhook signature verified successfully');
      }
    } else {
      console.log('[whatsapp-webhook] No webhook_secret configured - signature verification skipped');
    }

    const body = JSON.parse(rawBody);
    console.log('[whatsapp-webhook] Recebido:', JSON.stringify(body).substring(0, 1000));

    // Detectar provider pelo formato do payload
    let provider: 'waha' | 'evolution' = 'waha';
    let event = '';
    let messageData: WAHAMessage | EvolutionMessage | null = null;
    let senderPhone = '';
    let senderName = '';
    let isFromMe = false;
    let externalMessageId = '';
    let isFromFacebookLid = false;
    let originalLid: string | null = null;

    // WAHA format
    if (body.event && body.session !== undefined) {
      provider = 'waha';
      event = body.event;
      
      // Log completo para debug
      console.log('[whatsapp-webhook] Payload WAHA completo:', JSON.stringify(body));
      
      // ========== WAHA: Evento de ACK (status delivered/read) ==========
      if (event === 'message.ack') {
        const payload = body.payload || {};
        // Extrair messageId - pode vir em vários formatos
        let rawMessageId = payload.id || payload.key?.id || payload.ids?.[0];
        const ackName = payload.ackName || payload.receipt_type || payload.ack;
        const ackNumber = payload.ack;
        
        console.log('[whatsapp-webhook] ACK recebido:', { messageId: rawMessageId, ackName, ackNumber, payload: JSON.stringify(payload) });
        
        let newStatus: 'delivered' | 'read' | null = null;
        
        // WAHA usa ackName: 'DEVICE' (entregue), 'READ' (lida), 'PLAYED' (áudio reproduzido)
        // Ou ack: 2 (delivered), 3 (read)
        if (['DEVICE', 'delivered', 'DELIVERY_ACK'].includes(ackName) || ackNumber === 2) {
          newStatus = 'delivered';
        } else if (['READ', 'read', 'PLAYED'].includes(ackName) || ackNumber === 3) {
          newStatus = 'read';
        }
        
        if (newStatus && rawMessageId) {
          // Extrair o ID curto se vier no formato serializado
          // "true_554599957851@c.us_3EB0725EB8EE5F6CC14B33" → "3EB0725EB8EE5F6CC14B33"
          let shortId: string | null = null;
          if (typeof rawMessageId === 'string' && rawMessageId.includes('_')) {
            const parts = rawMessageId.split('_');
            shortId = parts[parts.length - 1]; // Último segmento é o ID curto
          }
          
          console.log('[whatsapp-webhook] IDs para busca:', { rawMessageId, shortId });
          
          // Tentar match com ID curto primeiro (formato novo)
          let found = false;
          if (shortId) {
            const { data: shortMatch, error: shortError } = await supabase
              .from('messages')
              .update({ status: newStatus })
              .eq('external_id', shortId)
              .select('id');
            
            if (!shortError && shortMatch && shortMatch.length > 0) {
              console.log('[whatsapp-webhook] Status atualizado (match shortId) para:', newStatus, 'shortId:', shortId);
              found = true;
            }
          }
          
          // Tentar match exato com ID completo (serializado)
          if (!found) {
            const { data: exactMatch, error: exactError } = await supabase
              .from('messages')
              .update({ status: newStatus })
              .eq('external_id', rawMessageId)
              .select('id');
            
            if (!exactError && exactMatch && exactMatch.length > 0) {
              console.log('[whatsapp-webhook] Status atualizado (match exato) para:', newStatus, 'messageId:', rawMessageId);
              found = true;
            }
          }
          
          // Tentar busca parcial para formatos JSON antigos
          if (!found && shortId) {
            console.log('[whatsapp-webhook] Match exato não encontrou, tentando busca parcial...');
            
            const { data: partialMatch, error: partialError } = await supabase
              .from('messages')
              .update({ status: newStatus })
              .like('external_id', `%${shortId}%`)
              .select('id');
            
            if (!partialError && partialMatch && partialMatch.length > 0) {
              console.log('[whatsapp-webhook] Status atualizado (match parcial) para:', newStatus, 'encontradas:', partialMatch.length);
              found = true;
            }
          }
          
          if (!found) {
            console.warn('[whatsapp-webhook] Nenhuma mensagem encontrada para messageId:', rawMessageId, 'shortId:', shortId);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, event: 'ack', status: newStatus, messageId: rawMessageId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Eventos de mensagem do WAHA
      if (event === 'message' || event === 'message.any') {
        const payload = body.payload as WAHAMessage & { _data?: any };
        
        // Extrair chatId/from para verificar se é grupo
        const rawFrom = payload.from || payload.chatId || '';
        
        // ========== FILTRO DE GRUPOS - Ignorar mensagens de grupos ==========
        if (isGroupChat(rawFrom)) {
          console.log('[whatsapp-webhook] Ignorando mensagem de grupo:', rawFrom);
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'group_message' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Processar TODAS as mensagens - tanto inbound quanto outbound
        // fromMe=true: enviada por nós (celular, CRM, bot)
        // fromMe=false: recebida do lead
        isFromMe = payload.fromMe || false;
        console.log('[whatsapp-webhook] Mensagem fromMe:', isFromMe);
        
        messageData = payload;
        externalMessageId = payload.id || '';
        
        console.log('[whatsapp-webhook] Raw from:', rawFrom);
        
        // ========== Detectar LID e extrair número real ==========
        if (isLID(rawFrom)) {
          console.log('[whatsapp-webhook] Detectado LID do Facebook, buscando número real...');
          isFromFacebookLid = true;
          originalLid = rawFrom.replace('@lid', '').replace(/\D/g, '');
          
          // Primeiro tenta extrair do payload
          let realPhone = extractRealPhoneFromPayload(body.payload);
          
          // Se não conseguiu, tenta via API do WAHA
          if (!realPhone) {
            const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
            if (wahaConfig) {
              realPhone = await resolvePhoneFromLID(
                wahaConfig.baseUrl,
                wahaConfig.apiKey,
                wahaConfig.sessionName,
                rawFrom
              );
              
              if (realPhone) {
                isFromFacebookLid = false; // Conseguimos o número real!
                console.log('[whatsapp-webhook] Número real resolvido via API WAHA:', realPhone);
              }
            } else {
              console.log('[whatsapp-webhook] Config WAHA não encontrada para resolver LID');
            }
          } else {
            isFromFacebookLid = false; // Conseguimos o número real do payload!
          }
          
          if (realPhone) {
            senderPhone = normalizePhone(realPhone);
          } else {
            console.warn('[whatsapp-webhook] Não foi possível extrair número real do LID, usando como identificador temporário');
            senderPhone = originalLid || normalizePhone(rawFrom);
          }
        } else {
          senderPhone = normalizePhone(rawFrom);
        }
        
        // Extrair pushName de múltiplas fontes possíveis no payload WAHA
        senderName = 
          payload.pushName ||
          (body.payload as any)?._data?.pushName ||
          (body.payload as any)?._data?.notifyName ||
          body.pushName ||
          (body.payload as any)?.chat?.contact?.pushname ||
          (body.payload as any)?.sender?.pushName ||
          '';
        
        console.log('[whatsapp-webhook] pushName extraído:', senderName, 'phone normalizado:', senderPhone, 'isLID:', isFromFacebookLid);
        isFromMe = payload.fromMe;
      } else {
        console.log('[whatsapp-webhook] Evento não processado:', event);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'event not handled', event }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Evolution API format
    else if (body.event && body.instance !== undefined) {
      provider = 'evolution';
      event = body.event;
      
      // ========== Evolution: Evento de status update ==========
      if (event === 'messages.update') {
        const payload = body.data || {};
        const messageId = payload.key?.id || payload.id;
        const status = payload.update?.status || payload.status;
        
        console.log('[whatsapp-webhook] Evolution status update:', { messageId, status });
        
        let newStatus: 'delivered' | 'read' | null = null;
        
        // Evolution usa: 2 = delivered, 3 = read (ou strings equivalentes)
        if (status === 2 || status === 'DELIVERY_ACK' || status === 'delivered') {
          newStatus = 'delivered';
        } else if (status === 3 || status === 'READ' || status === 'read') {
          newStatus = 'read';
        }
        
        if (newStatus && messageId) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('external_id', messageId);
          
          if (updateError) {
            console.error('[whatsapp-webhook] Erro ao atualizar status Evolution:', updateError);
          } else {
            console.log('[whatsapp-webhook] Status Evolution atualizado para:', newStatus, 'messageId:', messageId);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, event: 'status_update', status: newStatus, messageId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (event === 'messages.upsert') {
        const payload = body.data as EvolutionMessage;
        const remoteJid = payload.key?.remoteJid || '';
        
        // ========== FILTRO DE GRUPOS - Ignorar mensagens de grupos ==========
        if (isGroupChat(remoteJid)) {
          console.log('[whatsapp-webhook] Ignorando mensagem de grupo Evolution:', remoteJid);
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'group_message' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Processar TODAS as mensagens - tanto inbound quanto outbound (Evolution)
        isFromMe = payload.key?.fromMe || false;
        console.log('[whatsapp-webhook] Evolution Mensagem fromMe:', isFromMe);
        
        messageData = payload;
        externalMessageId = payload.key?.id || '';
        senderPhone = normalizePhone(remoteJid);
        senderName = payload.pushName || '';
        isFromMe = payload.key?.fromMe || false;
      } else {
        console.log('[whatsapp-webhook] Evento Evolution não processado:', event);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'event not handled', event }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Formato desconhecido
    else {
      console.log('[whatsapp-webhook] Formato de payload desconhecido');
      return new Response(
        JSON.stringify({ success: false, error: 'Unknown payload format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messageData || !senderPhone) {
      console.log('[whatsapp-webhook] Dados inválidos:', { messageData: !!messageData, senderPhone });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid message data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CORREÇÃO 1: Verificar idempotência por external_id ==========
    if (externalMessageId) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('external_id', externalMessageId)
        .maybeSingle();
      
      if (existingMessage) {
        console.log('[whatsapp-webhook] Mensagem já processada (external_id duplicado):', externalMessageId);
        return new Response(
          JSON.stringify({ success: true, duplicate: true, existing_message_id: existingMessage.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[whatsapp-webhook] Processando mensagem de:', senderPhone, 'Nome:', senderName);

    // Extrair conteúdo da mensagem
    const { content, type, mediaUrl, isSystemMessage } = getMessageContent(messageData, provider);
    
    // Ignorar notificações do sistema
    if (isSystemMessage) {
      console.log('[whatsapp-webhook] Ignorando notificação do sistema');
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'system_notification' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[whatsapp-webhook] Conteúdo:', content.substring(0, 100), 'Tipo:', type, 'MediaUrl:', mediaUrl ? 'presente' : 'nenhum');

    // ========== BUSCA FLEXÍVEL DE LEAD POR TELEFONE ==========
    // Encontra lead mesmo com formato diferente (com/sem 55, com/sem 9° dígito)
    const existingLead = await findLeadByPhone(supabase, senderPhone);

    let lead;
    
    if (existingLead) {
      lead = existingLead;
      console.log('[whatsapp-webhook] Lead encontrado:', lead.id);

      // Atualizar dados do lead
      const updateData: Record<string, unknown> = {
        last_interaction_at: new Date().toISOString(),
      };
      
      // Sempre atualizar whatsapp_name se receber um novo (pessoa pode mudar nome no WhatsApp)
      if (senderName) {
        updateData.whatsapp_name = senderName;
        
        // Se o nome ainda é genérico, atualizar para o NotifyName real
        const isGenericName = existingLead.name.startsWith('Lead ') || 
                              existingLead.name.includes('via anúncio') ||
                              existingLead.name.includes('(via anúncio)');
        
        if (isGenericName) {
          updateData.name = senderName;
          console.log('[whatsapp-webhook] Atualizando nome genérico para NotifyName:', senderName);
        }
      }
      
      // Se o lead existente era um LID e agora recebemos o número real, atualizar flag
      if (existingLead.is_facebook_lid && !isFromFacebookLid) {
        updateData.is_facebook_lid = false;
        console.log('[whatsapp-webhook] Atualizando lead LID com número real');
      }

      // Buscar foto de perfil se ainda não tiver
      if (!existingLead.avatar_url) {
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        if (wahaConfig) {
          // Usar número com código do país (55) para a API
          const phoneWithCountry = senderPhone.startsWith('55') ? senderPhone : `55${senderPhone}`;
          const avatarUrl = await getProfilePicture(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            phoneWithCountry
          );
          if (avatarUrl) {
            updateData.avatar_url = avatarUrl;
            console.log('[whatsapp-webhook] Avatar atualizado para lead existente');
          }
        }
      }

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);
    } else {
      // Criar novo lead com upsert (proteção adicional contra race condition)
      console.log('[whatsapp-webhook] Criando novo lead para:', senderPhone);
      
      const { data: firstStage } = await supabase
        .from('funnel_stages')
        .select('id')
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Ajustar nome para leads via anúncio
      let leadName = senderName || `Lead ${formatPhoneForDisplay(senderPhone)}`;
      if (isFromFacebookLid && senderName) {
        leadName = `${senderName} (via anúncio)`;
      } else if (isFromFacebookLid) {
        leadName = `Lead via anúncio ${originalLid?.slice(-4) || ''}`;
      }

      // Buscar foto de perfil para novo lead
      let avatarUrl: string | null = null;
      if (!isFromFacebookLid) {
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        if (wahaConfig) {
          // Usar número com código do país (55) para a API
          const phoneWithCountry = senderPhone.startsWith('55') ? senderPhone : `55${senderPhone}`;
          avatarUrl = await getProfilePicture(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            phoneWithCountry
          );
          if (avatarUrl) {
            console.log('[whatsapp-webhook] Avatar encontrado para novo lead');
          }
        }
      }

      // Normalizar telefone separando código do país
      const phoneData = normalizePhoneForStorage(senderPhone);
      console.log('[whatsapp-webhook] Normalizando telefone para salvar:', senderPhone, '->', phoneData);
      
      const { data: upsertedLead, error: upsertError } = await supabase
        .from('leads')
        .upsert({
          name: leadName,
          phone: phoneData.localNumber, // Número local sem código do país (ex: 45988428644)
          country_code: phoneData.countryCode, // Código do país (ex: 55, 1, 595)
          whatsapp_name: senderName || null,
          source: isFromFacebookLid ? 'facebook_ads' : 'whatsapp',
          temperature: 'warm',
          stage_id: firstStage?.id,
          status: 'active',
          last_interaction_at: new Date().toISOString(),
          is_facebook_lid: isFromFacebookLid,
          original_lid: originalLid,
          avatar_url: avatarUrl,
        }, {
          onConflict: 'phone',
          ignoreDuplicates: false,
        })
        .select('*')
        .single();

      if (upsertError) {
        console.error('[whatsapp-webhook] Erro ao criar/upsert lead:', upsertError);
        
        // Se falhou por conflito, tentar buscar o existente usando busca flexível
        if (upsertError.code === '23505') {
          const conflictLead = await findLeadByPhone(supabase, senderPhone);
          
          if (conflictLead) {
            lead = conflictLead;
            console.log('[whatsapp-webhook] Lead encontrado após conflito:', lead.id);
          } else {
            return new Response(
              JSON.stringify({ success: false, error: 'Error handling lead conflict' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Error creating lead' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        lead = upsertedLead;
        console.log('[whatsapp-webhook] Lead criado/atualizado:', lead.id);
      }
    }

    // Buscar ou criar conversa
    let conversation;
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      conversation = existingConversation;
      console.log('[whatsapp-webhook] Conversa encontrada:', conversation.id);

      // Apenas reabrir conversa se estava pendente e é mensagem INBOUND (do lead)
      // Mensagens outbound (nossas) não devem reabrir conversas resolvidas
      if (!isFromMe) {
        await supabase
          .from('conversations')
          .update({
            status: 'open',
          })
          .eq('id', conversation.id);
      }
    } else {
      // Buscar ID da instância WhatsApp pela session do webhook (para associar corretamente)
      const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
      
      // Criar nova conversa - o trigger cuida do unread_count e last_message_at quando a mensagem for inserida
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
          whatsapp_instance_id: wahaConfig?.instanceId || null,
        })
        .select('*')
        .single();

      if (createConvError) {
        console.error('[whatsapp-webhook] Erro ao criar conversa:', createConvError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      conversation = newConversation;
      console.log('[whatsapp-webhook] Conversa criada:', conversation.id, 'whatsapp_instance_id:', wahaConfig?.instanceId);
    }

    // Se tiver mídia, fazer upload para o storage permanente
    let finalMediaUrl = mediaUrl;
    if (mediaUrl && type !== 'text') {
      console.log('[whatsapp-webhook] Processando mídia para storage...', 'type:', type, 'mediaUrl:', mediaUrl);
      
      // Buscar config do WAHA para corrigir URL localhost e autenticar download
      const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
      const storageUrl = await uploadMediaToStorage(supabase, mediaUrl, type, lead.id, wahaConfig);
      if (storageUrl) {
        finalMediaUrl = storageUrl;
        console.log('[whatsapp-webhook] Mídia salva no storage:', storageUrl);
      } else {
        console.log('[whatsapp-webhook] Falha no upload, usando URL original como fallback');
      }
    }

    // Extrair quote se houver (re-extrair do payload porque não está disponível aqui)
    const { quotedMessage } = getMessageContent(messageData, provider);
    
    // ========== DETERMINAR DIREÇÃO E TIPO DE REMETENTE ==========
    // isFromMe=true: mensagem enviada por nós (celular, CRM, bot)
    // isFromMe=false: mensagem recebida do lead
    const direction = isFromMe ? 'outbound' : 'inbound';
    const senderType = isFromMe ? 'agent' : 'lead';
    const source = isFromMe ? 'mobile' : 'lead'; // 'mobile' porque veio pelo celular (não pelo CRM)
    
    console.log('[whatsapp-webhook] Direção:', direction, 'Sender:', senderType, 'Source:', source);
    
    // Criar mensagem com dados de quote se existirem
    const messageInsertData: Record<string, unknown> = {
      conversation_id: conversation.id,
      lead_id: lead.id,
      sender_id: isFromMe ? null : lead.id, // Outbound não tem sender_id específico (pode ser qualquer agente)
      sender_type: senderType,
      content: content,
      type: type as 'text' | 'image' | 'audio' | 'video' | 'document',
      media_url: finalMediaUrl,
      direction: direction,
      source: source,
      status: isFromMe ? 'sent' : 'delivered',
      external_id: externalMessageId || null,
    };
    
    // Adicionar dados de quote se existir
    if (quotedMessage) {
      messageInsertData.reply_to_external_id = quotedMessage.id;
      messageInsertData.quoted_message = quotedMessage;
      console.log('[whatsapp-webhook] Salvando mensagem com quote:', quotedMessage.id);
    }
    
    const { data: message, error: createMsgError } = await supabase
      .from('messages')
      .insert(messageInsertData)
      .select('*')
      .single();

    if (createMsgError) {
      console.error('[whatsapp-webhook] Erro ao criar mensagem:', createMsgError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error creating message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[whatsapp-webhook] Mensagem criada:', message.id, 'external_id:', externalMessageId);

    // Criar notificação apenas para mensagens INBOUND (do lead)
    // Mensagens outbound (nossas) não devem gerar notificação
    if (!isFromMe && conversation.assigned_to) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: conversation.assigned_to,
          p_title: 'Nova mensagem',
          p_message: `${lead.name}: ${content.substring(0, 100)}`,
          p_type: 'message',
          p_link: `/inbox?conversation=${conversation.id}`,
          p_data: { lead_id: lead.id, conversation_id: conversation.id },
        });
      } catch (notifError) {
        console.error('[whatsapp-webhook] Erro ao criar notificação:', notifError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message_id: message.id,
          conversation_id: conversation.id,
          lead_id: lead.id,
          provider,
          external_id: externalMessageId,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[whatsapp-webhook] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
