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

// Detecta se é um broadcast/status (stories do WhatsApp) - deve ser ignorado
function isStatusBroadcast(chatId: string): boolean {
  if (!chatId) return false;
  return chatId.includes('status@broadcast') || 
         chatId === 'status@broadcast' ||
         chatId.includes('@broadcast');
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

// Busca informações do contato via WAHA API (nome salvo nos contatos + pushname)
async function getContactInfo(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  contactId: string
): Promise<{ name: string | null; pushname: string | null }> {
  try {
    // Usar apenas o número SEM @c.us
    const cleanNumber = contactId.replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
    
    const url = `${wahaBaseUrl}/api/contacts?contactId=${cleanNumber}&session=${sessionName}`;
    
    console.log('[whatsapp-webhook] 📇 Buscando info do contato:', cleanNumber);
    
    // Usar AbortController para timeout de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('[whatsapp-webhook] 📇 API contato retornou status:', response.status);
      return { name: null, pushname: null };
    }
    
    const data = await response.json();
    console.log('[whatsapp-webhook] 📇 Resposta info contato:', JSON.stringify(data).slice(0, 300));
    
    // A resposta pode ter diferentes formatos
    const name = data?.name || data?.verifiedName || null;
    const pushname = data?.pushname || data?.pushName || data?.notify || null;
    
    if (name || pushname) {
      console.log('[whatsapp-webhook] 📇 Info encontrada - name:', name, '| pushname:', pushname);
    } else {
      console.log('[whatsapp-webhook] 📇 Nenhum nome encontrado para:', cleanNumber);
    }
    
    return { name, pushname };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[whatsapp-webhook] 📇 Timeout ao buscar info do contato');
    } else {
      console.error('[whatsapp-webhook] 📇 Erro ao buscar info do contato:', error);
    }
    return { name: null, pushname: null };
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
    
    // Ignorar números muito curtos ou inválidos
    if (cleanNumber.length < 10) {
      console.log('[whatsapp-webhook] 📷 Número muito curto para buscar foto:', cleanNumber);
      return null;
    }
    
    // Adicionar refresh=true para forçar buscar do WhatsApp (evita cache vazio de 24h)
    const url = `${wahaBaseUrl}/api/contacts/profile-picture?contactId=${cleanNumber}&session=${sessionName}&refresh=true`;
    
    console.log('[whatsapp-webhook] 📷 Buscando foto de perfil para:', cleanNumber);
    
    // Usar AbortController para timeout de 8 segundos (fotos podem demorar mais)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('[whatsapp-webhook] 📷 API foto de perfil retornou status:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // A resposta pode ter diferentes formatos
    const profilePictureUrl = data?.profilePictureURL || data?.profilePicture || data?.url || data?.imgUrl;
    
    if (profilePictureUrl && typeof profilePictureUrl === 'string' && profilePictureUrl.startsWith('http')) {
      console.log('[whatsapp-webhook] 📷 Foto de perfil encontrada para:', cleanNumber);
      return profilePictureUrl;
    }
    
    console.log('[whatsapp-webhook] 📷 Foto não encontrada ou privada para:', cleanNumber);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[whatsapp-webhook] 📷 Timeout ao buscar foto de perfil');
    } else {
      console.error('[whatsapp-webhook] 📷 Erro ao buscar foto de perfil:', error);
    }
    return null;
  }
}

// Busca configuração do WAHA no banco (genérica - qualquer instância ativa)
async function getWAHAConfig(supabase: any): Promise<{ baseUrl: string; apiKey: string; sessionName: string; instanceId: string; tenantId: string | null } | null> {
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name, tenant_id')
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
        tenantId: data.tenant_id || null,
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
): Promise<{ baseUrl: string; apiKey: string; sessionName: string; instanceId: string; tenantId: string | null } | null> {
  try {
    console.log('[whatsapp-webhook] Buscando config WAHA para session:', sessionName);
    
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name, phone_number, tenant_id')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .ilike('instance_name', sessionName)  // Case-insensitive: LUAN = luan = Luan
      .limit(1)
      .maybeSingle();
    
    if (data) {
      console.log('[whatsapp-webhook] ✅ Config encontrada para session:', sessionName, 
        '| instanceId:', data.id, 
        '| instance_name:', data.instance_name,
        '| phone:', data.phone_number,
        '| tenant_id:', data.tenant_id);
      return {
        baseUrl: data.base_url.replace(/\/$/, ''),
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
        instanceId: data.id,
        tenantId: data.tenant_id || null,
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
  // 3 dígitos (DEVEM VIR PRIMEIRO!)
  { code: '595', name: 'Paraguai' },
  { code: '598', name: 'Uruguai' },
  { code: '593', name: 'Equador' },
  { code: '591', name: 'Bolívia' },
  { code: '353', name: 'Irlanda' },
  { code: '351', name: 'Portugal' },
  // 2 dígitos
  { code: '81', name: 'Japão' },
  { code: '61', name: 'Austrália' },
  { code: '55', name: 'Brasil' },
  { code: '54', name: 'Argentina' },
  { code: '56', name: 'Chile' },
  { code: '57', name: 'Colômbia' },
  { code: '58', name: 'Venezuela' },
  { code: '52', name: 'México' },
  { code: '51', name: 'Peru' },
  { code: '34', name: 'Espanha' },
  { code: '39', name: 'Itália' },
  { code: '49', name: 'Alemanha' },
  { code: '33', name: 'França' },
  { code: '44', name: 'Reino Unido' },
  // 1 dígito (por último)
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

// Formata telefone para exibição em fallback do nome (suporta internacionais)
function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const parsed = parseInternationalPhone(digits);
  
  // Formatação brasileira (55)
  if (parsed.countryCode === '55') {
    const local = parsed.localNumber;
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
  }
  
  // Formatação internacional: +{código} {número}
  return `+${parsed.countryCode} ${parsed.localNumber}`;
}

// Monta número com código do país correto para chamadas de API
function getPhoneWithCountryCode(phone: string, existingCountryCode?: string | null): string {
  const digits = phone.replace(/\D/g, '');
  const parsed = parseInternationalPhone(digits);
  
  // Se detectou um código de país diferente de 55 (Brasil), usar o número completo
  if (parsed.countryCode !== '55') {
    console.log('[whatsapp-webhook] 📞 Número internacional detectado:', {
      countryCode: parsed.countryCode,
      country: parsed.country,
      fullNumber: parsed.fullNumber,
    });
    return parsed.fullNumber;
  }
  
  // Se temos country_code do lead existente e NÃO é 55, usar ele
  if (existingCountryCode && existingCountryCode !== '55') {
    console.log('[whatsapp-webhook] 📞 Usando country_code do lead:', existingCountryCode);
    return existingCountryCode + parsed.localNumber;
  }
  
  // Fallback: usar número completo parseado (Brasil)
  return parsed.fullNumber;
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
  
  // Fallback 1: buscar pelos últimos 8 dígitos (núcleo do número sem DDD/país)
  const corePart8 = digits.slice(-8);
  console.log('[whatsapp-webhook] Tentando busca por núcleo 8 dígitos:', corePart8);
  
  const { data: fallbackLeads8 } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart8}`)
    .limit(1);
  
  if (fallbackLeads8 && fallbackLeads8.length > 0) {
    console.log('[whatsapp-webhook] ✅ Lead encontrado via fallback (8 dígitos):', fallbackLeads8[0].id, 
      'phone salvo:', fallbackLeads8[0].phone,
      'country_code salvo:', fallbackLeads8[0].country_code);
    return fallbackLeads8[0];
  }
  
  // Fallback 2: buscar pelos últimos 7 dígitos (mais agressivo para variações com/sem 9)
  const corePart7 = digits.slice(-7);
  console.log('[whatsapp-webhook] Tentando busca por núcleo 7 dígitos:', corePart7);
  
  const { data: fallbackLeads7 } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart7}`)
    .limit(5); // Pegar até 5 para escolher o melhor match
  
  if (fallbackLeads7 && fallbackLeads7.length > 0) {
    // Se só encontrou 1, retornar esse
    if (fallbackLeads7.length === 1) {
      console.log('[whatsapp-webhook] ✅ Lead encontrado via fallback (7 dígitos):', fallbackLeads7[0].id);
      return fallbackLeads7[0];
    }
    
    // Se encontrou múltiplos, preferir o que tem mais dígitos em comum
    const bestMatch = fallbackLeads7.reduce((best: any, current: any) => {
      const bestPhone = best.phone?.replace(/\D/g, '') || '';
      const currentPhone = current.phone?.replace(/\D/g, '') || '';
      
      // Contar quantos dígitos do final batem
      let bestMatchCount = 0;
      let currentMatchCount = 0;
      
      for (let i = 1; i <= Math.min(digits.length, bestPhone.length); i++) {
        if (digits.slice(-i) === bestPhone.slice(-i)) bestMatchCount = i;
      }
      for (let i = 1; i <= Math.min(digits.length, currentPhone.length); i++) {
        if (digits.slice(-i) === currentPhone.slice(-i)) currentMatchCount = i;
      }
      
      return currentMatchCount > bestMatchCount ? current : best;
    });
    
    console.log('[whatsapp-webhook] ✅ Lead encontrado via fallback (7 dígitos, melhor match):', bestMatch.id,
      'phone salvo:', bestMatch.phone);
    return bestMatch;
  }
  
  console.log('[whatsapp-webhook] Lead não encontrado para:', phone, '| country detectado:', parsed.country || parsed.countryCode);
  return null;
}

// Busca lead por telefone + nome (fallback adicional para mensagens com pushName)
async function findLeadByPhoneAndName(supabase: any, phone: string, name: string): Promise<any> {
  if (!name || name.trim().length < 2) return null;
  
  const digits = phone.replace(/\D/g, '');
  const corePart = digits.slice(-7);
  const cleanName = name.trim().toLowerCase();
  
  console.log('[whatsapp-webhook] Buscando lead por telefone + nome:', { corePart, name: cleanName });
  
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart}`)
    .limit(10);
  
  if (!leads || leads.length === 0) return null;
  
  // Encontrar lead cujo nome seja similar
  const matchingLead = leads.find((lead: any) => {
    const leadName = (lead.name || '').toLowerCase();
    const leadWhatsappName = (lead.whatsapp_name || '').toLowerCase();
    
    // Match exato ou parcial
    return leadName.includes(cleanName) || 
           cleanName.includes(leadName) ||
           leadWhatsappName.includes(cleanName) ||
           cleanName.includes(leadWhatsappName);
  });
  
  if (matchingLead) {
    console.log('[whatsapp-webhook] ✅ Lead encontrado por telefone + nome:', matchingLead.id);
  }
  
  return matchingLead || null;
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
    
    // ========== CORREÇÃO: Função para detectar base64 ==========
    const isBase64Content = (str: string): boolean => {
      if (!str || str.length < 100) return false;
      // Padrões comuns de início de base64 para diferentes tipos de mídia
      const base64Patterns = [
        '/9j/',      // JPEG
        'iVBOR',     // PNG
        'R0lGOD',    // GIF
        'UklGR',     // WEBP
        'AAAA',      // Alguns formatos de vídeo/áudio
        'data:image',
        'data:audio',
        'data:video',
      ];
      return base64Patterns.some(pattern => str.startsWith(pattern)) || 
             (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
    };
    
    // ========== CORREÇÃO: Extrair caption corretamente para mídia ==========
    // Para mensagens de mídia, usar caption em vez de body (que pode conter base64)
    let content = '';
    
    if (hasRealMedia) {
      // Para mídia: priorizar caption, depois body APENAS se não for base64
      const caption = (msg as any).caption || 
                      (msg as any)._data?.caption ||
                      '';
      const bodyContent = msg.body || (msg as any)._data?.body || '';
      
      if (caption && !isBase64Content(caption)) {
        content = caption;
      } else if (bodyContent && !isBase64Content(bodyContent)) {
        content = bodyContent;
      }
      // Se body for base64, content fica vazio (correto)
      
      console.log('[whatsapp-webhook] Mídia detectada - caption:', caption?.substring(0, 50), 'bodyIsBase64:', isBase64Content(bodyContent));
    } else {
      // Para mensagens de texto: usar body normalmente
      content = msg.body || 
                (msg as any)._data?.body || 
                (msg as any).text ||
                '';
    }
    
    // Log de debug se body estiver vazio
    if (!content) {
      console.log('[whatsapp-webhook] Body vazio, detalhes:', JSON.stringify({
        body: msg.body?.substring(0, 100),
        _data_body: (msg as any)._data?.body?.substring(0, 100),
        text: (msg as any).text,
        caption: (msg as any).caption,
        type: msg.type,
        hasMedia: msg.hasMedia,
      }));
    }
    
    // ========== CORREÇÃO: Placeholder para mídia sem caption ==========
    if (!content && hasRealMedia) {
      // Mídia sem caption - deixar content vazio (não usar placeholder)
      // O frontend vai mostrar a mídia sem texto
      content = '';
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
          
          // ========== CRIAR MENSAGEM OUTBOUND VIA ACK SE NÃO EXISTIR ==========
          if (!found && payload?.fromMe === true) {
            console.log('[whatsapp-webhook] Mensagem outbound não existe no banco, tentando criar via ACK...');
            
            try {
              // Extrair phone do destinatário (to)
              const toField = payload.to || payload.chatId || '';
              const toPhone = normalizePhone(toField);
              
              // ========== VALIDAÇÃO: Ignorar LIDs não resolvidos ==========
              if (isLID(toField)) {
                console.log('[whatsapp-webhook] ⏭️ Ignorando criação via ACK para LID não resolvido:', toField);
                return new Response(
                  JSON.stringify({ success: true, ignored: true, reason: 'ack_for_unresolved_lid' }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              // ========== VALIDAÇÃO: Ignorar se destinatário for o próprio número do WhatsApp ==========
              const wahaConfigForAck = await getWAHAConfigBySession(supabase, body.session || 'default');
              if (wahaConfigForAck) {
                const { data: whatsappConfigData } = await supabase
                  .from('whatsapp_config')
                  .select('phone_number')
                  .eq('id', wahaConfigForAck.instanceId)
                  .maybeSingle();
                
                if (whatsappConfigData?.phone_number) {
                  const ownPhone = whatsappConfigData.phone_number.replace(/\D/g, '');
                  const toPhoneDigits = toPhone.replace(/\D/g, '');
                  // Comparar últimos 10 dígitos (ignora código do país)
                  if (toPhoneDigits.slice(-10) === ownPhone.slice(-10)) {
                    console.log('[whatsapp-webhook] ⏭️ Ignorando: destinatário é o próprio número WhatsApp');
                    return new Response(
                      JSON.stringify({ success: true, ignored: true, reason: 'self_message_ack' }),
                      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                  }
                }
              }
              
              if (toPhone) {
                console.log('[whatsapp-webhook] Buscando lead pelo phone:', toPhone);
                
                // Buscar lead pelo phone
                const lead = await findLeadByPhone(supabase, toPhone);
                
                if (lead) {
                  console.log('[whatsapp-webhook] Lead encontrado:', lead.id, lead.name);
                  
                  // Buscar ou criar conversa
                  let { data: conversation } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('lead_id', lead.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (!conversation) {
                    const { data: newConv } = await supabase
                      .from('conversations')
                      .insert({
                        lead_id: lead.id,
                        status: 'open',
                        channel: 'whatsapp',
                      })
                      .select('id')
                      .single();
                    conversation = newConv;
                    console.log('[whatsapp-webhook] Nova conversa criada:', conversation?.id);
                  }
                  
                  if (conversation) {
                    // Extrair conteúdo da mensagem
                    const messageBody = payload.body || 
                                        (payload as any)._data?.body || 
                                        (payload as any).text ||
                                        (payload as any).caption || '';
                    
                    // Detectar tipo de mensagem
                    let msgType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' = 'text';
                    const rawType = (payload as any).type || (payload as any)._data?.type || '';
                    if (rawType === 'image' || payload.hasMedia && (payload as any).media?.mimetype?.startsWith('image')) {
                      msgType = 'image';
                    } else if (rawType === 'ptt' || rawType === 'audio') {
                      msgType = 'audio';
                    } else if (rawType === 'video') {
                      msgType = 'video';
                    } else if (rawType === 'document') {
                      msgType = 'document';
                    } else if (rawType === 'sticker') {
                      msgType = 'sticker';
                    }
                    
                    const finalContent = messageBody || (msgType !== 'text' ? `[${msgType}]` : '');
                    
                    // Criar timestamp a partir do payload
                    const msgTimestamp = payload.timestamp 
                      ? new Date(payload.timestamp * 1000).toISOString()
                      : new Date().toISOString();
                    
                    // Verificar se mensagem já existe pelo waha_message_id antes de criar
                    const { data: existingMsgByWaha } = await supabase
                      .from('messages')
                      .select('id')
                      .eq('waha_message_id', shortId)
                      .maybeSingle();
                    
                    if (existingMsgByWaha) {
                      console.log('[whatsapp-webhook] Mensagem já existe (waha_message_id), atualizando status apenas:', existingMsgByWaha.id);
                      // Apenas atualizar status se necessário
                      await supabase
                        .from('messages')
                        .update({ status: newStatus || 'sent' })
                        .eq('id', existingMsgByWaha.id);
                      found = true;
                    } else {
                      // Criar mensagem COM waha_message_id para prevenir duplicação
                      const { data: newMessage, error: insertError } = await supabase
                        .from('messages')
                        .insert({
                          conversation_id: conversation.id,
                          lead_id: lead.id,
                          sender_id: null, // Outbound do celular - sem sender_id
                          sender_type: 'agent',
                          content: finalContent,
                          type: msgType,
                          direction: 'outbound',
                          source: 'mobile',
                          external_id: rawMessageId,
                          waha_message_id: shortId, // Prevenir duplicação
                          status: newStatus || 'sent',
                          created_at: msgTimestamp,
                        })
                        .select('id')
                        .single();
                      
                      if (insertError) {
                        console.error('[whatsapp-webhook] Erro ao criar mensagem via ACK:', insertError);
                      } else {
                        console.log('[whatsapp-webhook] ✅ Mensagem outbound criada via ACK:', newMessage?.id);
                        found = true;
                      }
                    }
                  }
                } else {
                  console.log('[whatsapp-webhook] Lead não encontrado para phone:', toPhone);
                }
              } else {
                console.log('[whatsapp-webhook] Phone do destinatário não encontrado no ACK payload');
              }
            } catch (createError) {
              console.error('[whatsapp-webhook] Erro ao tentar criar mensagem via ACK:', createError);
            }
          } else if (!found) {
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
        
        // Processar TODAS as mensagens - tanto inbound quanto outbound
        // fromMe=true: enviada por nós (celular, CRM, bot)
        // fromMe=false: recebida do lead
        isFromMe = payload.fromMe || false;
        
        // ========== CORREÇÃO: Usar telefone correto baseado em fromMe ==========
        // Para mensagens outbound (fromMe=true): o lead é o DESTINATÁRIO (to)
        // Para mensagens inbound (fromMe=false): o lead é o REMETENTE (from)
        let rawContact: string;
        if (isFromMe) {
          // Mensagem ENVIADA por nós: o lead é o DESTINATÁRIO
          rawContact = payload.to || payload.chatId || '';
          console.log('[whatsapp-webhook] Mensagem OUTBOUND - destinatário:', rawContact);
        } else {
          // Mensagem RECEBIDA: o lead é o REMETENTE
          rawContact = payload.from || payload.chatId || '';
          console.log('[whatsapp-webhook] Mensagem INBOUND - remetente:', rawContact);
        }
        
        // ========== FILTRO DE GRUPOS - Ignorar mensagens de grupos ==========
        if (isGroupChat(rawContact)) {
          console.log('[whatsapp-webhook] Ignorando mensagem de grupo:', rawContact);
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'group_message' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // ========== FILTRO DE STATUS/BROADCAST - Ignorar stories ==========
        if (isStatusBroadcast(rawContact)) {
          console.log('[whatsapp-webhook] Ignorando mensagem de status/broadcast:', rawContact);
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'status_broadcast' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        messageData = payload;
        externalMessageId = payload.id || '';
        
        // ========== LOG DE DEBUG DETALHADO ==========
        console.log('[whatsapp-webhook] ===== MENSAGEM RECEBIDA =====');
        console.log('[whatsapp-webhook] fromMe:', isFromMe);
        console.log('[whatsapp-webhook] external_id:', externalMessageId);
        console.log('[whatsapp-webhook] rawContact (from/to):', rawContact);
        console.log('[whatsapp-webhook] body preview:', (payload.body || '').substring(0, 50));
        console.log('[whatsapp-webhook] type:', payload.type);
        console.log('[whatsapp-webhook] hasMedia:', payload.hasMedia);
        console.log('[whatsapp-webhook] ==============================');
        
        // ========== Detectar LID e extrair número real ==========
        if (isLID(rawContact)) {
          console.log('[whatsapp-webhook] Detectado LID do Facebook, buscando número real...');
          isFromFacebookLid = true;
          originalLid = rawContact.replace('@lid', '').replace(/\D/g, '');
          
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
                rawContact
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
            // ========== CORREÇÃO: Ignorar mensagens OUTBOUND para LIDs não resolvidos ==========
            // Se é mensagem outbound (fromMe) e não conseguimos resolver o LID, ignorar
            // Isso evita criar leads incorretos (usando nosso próprio número ou LID bruto)
            if (isFromMe) {
              console.log('[whatsapp-webhook] ⏭️ Ignorando mensagem outbound para LID não resolvido:', rawContact);
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  ignored: true, 
                  reason: 'outbound_to_unresolved_lid',
                  lid: rawContact 
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            // Para mensagens inbound de LID não resolvido, continuar normalmente
            console.warn('[whatsapp-webhook] Não foi possível extrair número real do LID, usando como identificador temporário');
            senderPhone = originalLid || normalizePhone(rawContact);
          }
        } else {
          senderPhone = normalizePhone(rawContact);
        }
        
        // ========== EXTRAÇÃO DO NOME DO CONTATO ==========
        // Para mensagens OUTBOUND (fromMe=true): pushName é o NOSSO nome, não do destinatário
        // Precisamos buscar o nome do destinatário via API
        if (isFromMe) {
          // Mensagem enviada por nós - buscar nome do DESTINATÁRIO via API
          console.log('[whatsapp-webhook] Mensagem outbound - buscando nome do destinatário via API...');
          
          const wahaConfigForContact = await getWAHAConfigBySession(supabase, body.session || 'default');
          if (wahaConfigForContact) {
            // Buscar lead existente para obter country_code
            const existingLeadForContact = await findLeadByPhone(supabase, senderPhone);
            const phoneWithCountry = getPhoneWithCountryCode(senderPhone, existingLeadForContact?.country_code);
            
            console.log('[whatsapp-webhook] Buscando contato para:', phoneWithCountry);
            
            const contactInfo = await getContactInfo(
              wahaConfigForContact.baseUrl,
              wahaConfigForContact.apiKey,
              wahaConfigForContact.sessionName,
              phoneWithCountry
            );
            
            // Prioridade: nome salvo nos contatos > pushname do WhatsApp
            senderName = contactInfo.name || contactInfo.pushname || '';
            console.log('[whatsapp-webhook] Nome do destinatário obtido via API:', senderName);
          } else {
            senderName = '';
            console.log('[whatsapp-webhook] Config WAHA não encontrada para buscar nome do destinatário');
          }
        } else {
          // Mensagem recebida - usar pushName do payload normalmente
          senderName = 
            payload.pushName ||
            (body.payload as any)?._data?.pushName ||
            (body.payload as any)?._data?.notifyName ||
            body.pushName ||
            (body.payload as any)?.chat?.contact?.pushname ||
            (body.payload as any)?.sender?.pushName ||
            '';
        }
        
        console.log('[whatsapp-webhook] Nome extraído:', senderName, 'phone normalizado:', senderPhone, 'isLID:', isFromFacebookLid, 'isFromMe:', isFromMe);
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

    // ========== CORREÇÃO DEFINITIVA: Verificar por waha_message_id (UNIQUE no banco) ==========
    // Calcular waha_message_id canônico a partir do external_id
    let wahaMessageId: string | null = null;
    if (externalMessageId) {
      // Extrair o ID curto (último segmento após underscore) que é único por mensagem WAHA
      // Formato: "true_554599957851@c.us_3EB0725EB8EE5F6CC14B33" → "3EB0725EB8EE5F6CC14B33"
      // Ou formato curto: "3EB0725EB8EE5F6CC14B33" → "3EB0725EB8EE5F6CC14B33"
      if (typeof externalMessageId === 'string' && externalMessageId.includes('_')) {
        const parts = externalMessageId.split('_');
        wahaMessageId = parts[parts.length - 1];
      } else {
        wahaMessageId = externalMessageId;
      }
      
      console.log('[whatsapp-webhook] 🔑 waha_message_id calculado:', wahaMessageId, '| original external_id:', externalMessageId);
      
      // ========== CORREÇÃO: Verificar duplicata usando AMBOS os formatos (curto e completo) ==========
      // O CRM salva no formato completo (true_554591570202@c.us_3EB...) mas o webhook extrai só o ID curto (3EB...)
      // Precisamos verificar ambos para evitar duplicação
      const { data: existingByWahaId } = await supabase
        .from('messages')
        .select('id, waha_message_id, media_url, type, conversation_id')
        .or(`waha_message_id.eq.${wahaMessageId},waha_message_id.eq.${externalMessageId}`)
        .limit(1)
        .maybeSingle();
      
      if (existingByWahaId) {
        // ========== CORREÇÃO CRÍTICA: Se a mensagem existe mas NÃO tem media_url, verificar se este evento tem mídia ==========
        // WAHA envia primeiro message.ack (sem mídia) e depois message.any (com mídia)
        // O primeiro evento cria a mensagem sem media_url, o segundo deve atualizar
        const isMediaType = existingByWahaId.type && ['image', 'audio', 'video', 'document'].includes(existingByWahaId.type);
        
        if (isMediaType && !existingByWahaId.media_url) {
          console.log('[whatsapp-webhook] 📎 Mensagem de mídia existente sem media_url, tentando extrair mídia deste evento...');
          
          // Extrair mídia deste evento
          const { mediaUrl: eventMediaUrl, type: eventType } = getMessageContent(messageData, provider);
          
          if (eventMediaUrl) {
            console.log('[whatsapp-webhook] 📎 Mídia encontrada neste evento, fazendo upload...');
            
            // Buscar lead e config para fazer upload
            const existingLead = await findLeadByPhone(supabase, senderPhone);
            const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
            
            if (existingLead && wahaConfig) {
              try {
                const finalMediaUrl = await uploadMediaToStorage(
                  supabase,
                  eventMediaUrl,
                  eventType,
                  existingLead.id,
                  wahaConfig
                );
                
                if (finalMediaUrl) {
                  const { error: updateError } = await supabase
                    .from('messages')
                    .update({ media_url: finalMediaUrl })
                    .eq('id', existingByWahaId.id);
                  
                  if (updateError) {
                    console.error('[whatsapp-webhook] ❌ Erro ao atualizar media_url:', updateError);
                  } else {
                    console.log('[whatsapp-webhook] ✅ media_url atualizado com sucesso:', finalMediaUrl.substring(0, 50));
                  }
                }
              } catch (uploadError) {
                console.error('[whatsapp-webhook] ❌ Erro no upload de mídia:', uploadError);
              }
            } else {
              console.log('[whatsapp-webhook] ⚠️ Não foi possível fazer upload: lead ou config não encontrados');
            }
          } else {
            console.log('[whatsapp-webhook] 📎 Nenhuma mídia neste evento para atualizar mensagem existente');
          }
        }
        
        console.log('[whatsapp-webhook] ⏭️ Mensagem já processada (waha_message_id):', wahaMessageId, 'ou', externalMessageId, '| matched:', existingByWahaId.waha_message_id);
        return new Response(
          JSON.stringify({ success: true, duplicate: true, existing_message_id: existingByWahaId.id, matched_by: 'waha_message_id', matched_value: existingByWahaId.waha_message_id }),
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
    
    // ========== CORREÇÃO: Validar conteúdo da mensagem ==========
    // Ignorar mensagens com conteúdo inválido/placeholder
    const invalidContents = ['[text]', '[Text]', '[TEXT]', '[media]', '[Media]', '[MEDIA]', '[Mídia]'];
    if (!content && !mediaUrl) {
      console.log('[whatsapp-webhook] Ignorando mensagem sem conteúdo e sem mídia');
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'empty_message' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (content && invalidContents.includes(content)) {
      console.log('[whatsapp-webhook] Ignorando mensagem com placeholder inválido:', content);
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'placeholder_content' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[whatsapp-webhook] Conteúdo:', content.substring(0, 100), 'Tipo:', type, 'MediaUrl:', mediaUrl ? 'presente' : 'nenhum');

    // ========== BUSCA FLEXÍVEL DE LEAD POR TELEFONE ==========
    // Encontra lead mesmo com formato diferente (com/sem 55, com/sem 9° dígito)
    let existingLead = await findLeadByPhone(supabase, senderPhone);
    
    // Fallback: se não encontrou por telefone, tentar por telefone + nome
    if (!existingLead && senderName) {
      console.log('[whatsapp-webhook] Lead não encontrado por telefone, tentando por nome + telefone...');
      existingLead = await findLeadByPhoneAndName(supabase, senderPhone, senderName);
    }

    let lead;
    
    if (existingLead) {
      lead = existingLead;
      console.log('[whatsapp-webhook] Lead encontrado:', lead.id, '| nome:', lead.name);

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
      if (!existingLead.avatar_url && !isFromFacebookLid) {
        console.log('[whatsapp-webhook] 📷 Lead existente sem avatar, tentando buscar...');
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        if (wahaConfig) {
          // Usar função correta para montar número com código do país
          const phoneWithCountry = getPhoneWithCountryCode(senderPhone, existingLead.country_code);
          console.log('[whatsapp-webhook] 📷 Buscando avatar para:', phoneWithCountry);
          
          const avatarUrl = await getProfilePicture(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            phoneWithCountry
          );
          if (avatarUrl) {
            updateData.avatar_url = avatarUrl;
            console.log('[whatsapp-webhook] 📷 Avatar atualizado para lead existente');
          }
        }
      }
      
      // Se lead existe mas nome é genérico e não temos nome do WhatsApp, tentar buscar via API
      if (!senderName && (existingLead.name.startsWith('Lead ') || existingLead.name.includes('via anúncio'))) {
        console.log('[whatsapp-webhook] 📇 Lead com nome genérico, tentando buscar nome real...');
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        if (wahaConfig) {
          const phoneWithCountry = getPhoneWithCountryCode(senderPhone, existingLead.country_code);
          const contactInfo = await getContactInfo(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            phoneWithCountry
          );
          if (contactInfo.pushname || contactInfo.name) {
            const newName = contactInfo.name || contactInfo.pushname;
            updateData.whatsapp_name = contactInfo.pushname || contactInfo.name;
            updateData.name = newName;
            console.log('[whatsapp-webhook] 📇 Nome atualizado via API:', newName);
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
      
      // Buscar config do WAHA para obter tenant_id
      const wahaConfigForLead = await getWAHAConfigBySession(supabase, body.session || 'default');
      const tenantIdForLead = wahaConfigForLead?.tenantId || null;
      console.log('[whatsapp-webhook] Tenant ID para novo lead:', tenantIdForLead);
      
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
      if (!isFromFacebookLid && wahaConfigForLead) {
        // Usar função correta para montar número com código do país (detecta automaticamente)
        const phoneWithCountry = getPhoneWithCountryCode(senderPhone);
        console.log('[whatsapp-webhook] 📷 Buscando avatar para novo lead:', phoneWithCountry);
        avatarUrl = await getProfilePicture(
          wahaConfigForLead.baseUrl,
          wahaConfigForLead.apiKey,
          wahaConfigForLead.sessionName,
          phoneWithCountry
        );
        if (avatarUrl) {
          console.log('[whatsapp-webhook] Avatar encontrado para novo lead');
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
          tenant_id: tenantIdForLead, // Propagar tenant_id do whatsapp_config
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

    // Buscar ou criar conversa (sem upsert - evita erro 42P10)
    let conversation;
    const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
    const whatsappInstanceId = wahaConfig?.instanceId || null;
    
    console.log('[whatsapp-webhook] Buscando conversa para lead:', lead.id, 'instância:', whatsappInstanceId);
    
    // 1. Buscar conversa existente com match exato (lead_id + whatsapp_instance_id)
    let { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('whatsapp_instance_id', whatsappInstanceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // 2. Se não encontrou, buscar qualquer conversa do lead (fallback)
    if (!existingConversation) {
      const { data: anyConversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      existingConversation = anyConversation;
    }

    if (existingConversation) {
      conversation = existingConversation;
      console.log('[whatsapp-webhook] ✅ Conversa encontrada:', conversation.id, 'status:', conversation.status);

      // Reabrir conversa se estava 'resolved' ou 'pending' e é mensagem INBOUND
      if (!isFromMe && (conversation.status === 'resolved' || conversation.status === 'pending')) {
        console.log('[whatsapp-webhook] Reabrindo conversa:', conversation.id);
        await supabase
          .from('conversations')
          .update({ status: 'open' })
          .eq('id', conversation.id);
      }
      
      // Atualizar whatsapp_instance_id se ainda não estava definido
      if (!conversation.whatsapp_instance_id && whatsappInstanceId) {
        await supabase
          .from('conversations')
          .update({ whatsapp_instance_id: whatsappInstanceId })
          .eq('id', conversation.id);
      }
    } else {
      // 3. Criar nova conversa (insert simples, sem upsert)
      console.log('[whatsapp-webhook] Criando nova conversa para lead:', lead.id);
      
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
          whatsapp_instance_id: whatsappInstanceId,
        })
        .select('*')
        .single();

      if (createConvError) {
        // Race condition: outra requisição pode ter criado a conversa
        console.log('[whatsapp-webhook] ⚠️ Erro ao criar conversa, buscando existente:', createConvError.code, createConvError.message);
        
        const { data: fallbackConv } = await supabase
          .from('conversations')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fallbackConv) {
          conversation = fallbackConv;
          console.log('[whatsapp-webhook] ✅ Conversa encontrada após fallback:', conversation.id);
        } else {
          console.error('[whatsapp-webhook] ❌ Erro ao criar conversa:', createConvError);
          return new Response(
            JSON.stringify({ success: false, error: 'Error creating conversation' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        conversation = newConversation;
        console.log('[whatsapp-webhook] ✅ Conversa criada:', conversation.id, 'whatsapp_instance_id:', whatsappInstanceId);
      }
    }

    // ========== CORREÇÃO: Se é mídia mas não veio URL, buscar via WAHA API ou usar base64 ==========
    let finalMediaUrl = mediaUrl;
    
    // Buscar config do WAHA antecipadamente (pode ser usada para buscar mídia ou fazer upload)
    const wahaConfigForMedia = await getWAHAConfigBySession(supabase, body.session || 'default');
    
    // ========== TRATAMENTO DE BASE64 DIRETO DO PAYLOAD ==========
    // Se tem base64 no payload mas não tem URL, fazer upload direto
    const base64Data = (messageData as any)?._data?.media?.data || 
                       (messageData as any)?.media?.data ||
                       (messageData as any)?.mediaData ||
                       (messageData as any)?._data?.body; // Alguns casos o base64 vem no body
    
    const base64Mimetype = (messageData as any)?._data?.media?.mimetype ||
                           (messageData as any)?.media?.mimetype ||
                           (messageData as any)?._data?.mimetype ||
                           '';
    
    // Função auxiliar para detectar base64
    const isValidBase64 = (str: string): boolean => {
      if (!str || typeof str !== 'string' || str.length < 100) return false;
      // Padrões comuns de início de base64
      const base64Patterns = ['/9j/', 'iVBOR', 'R0lGOD', 'UklGR', 'AAAA', 'GkXf', 'T2dn'];
      return base64Patterns.some(p => str.startsWith(p)) || 
             (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
    };
    
    // Se é mídia sem URL mas tem base64 no payload
    if (!mediaUrl && type !== 'text' && base64Data && isValidBase64(base64Data)) {
      console.log('[whatsapp-webhook] 📁 Base64 encontrado no payload, fazendo upload direto...');
      console.log('[whatsapp-webhook] 📁 Base64 length:', base64Data.length, 'mimetype:', base64Mimetype);
      
      try {
        // Converter base64 para ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Determinar extensão pelo mimetype ou tipo
        const extensionMap: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'audio/ogg': 'ogg',
          'audio/ogg; codecs=opus': 'ogg',
          'audio/mpeg': 'mp3',
          'audio/mp4': 'm4a',
          'video/mp4': 'mp4',
          'application/pdf': 'pdf',
        };
        
        let extension = extensionMap[base64Mimetype];
        if (!extension) {
          const typeExtMap: Record<string, string> = { image: 'jpg', audio: 'ogg', video: 'mp4', document: 'bin' };
          extension = typeExtMap[type] || 'bin';
        }
        
        const fileName = `leads/${lead.id}/${Date.now()}.${extension}`;
        const contentType = base64Mimetype || 'application/octet-stream';
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(fileName, bytes.buffer, {
            contentType,
            cacheControl: '31536000',
            upsert: false,
          });
        
        if (uploadError) {
          console.error('[whatsapp-webhook] ❌ Erro upload base64:', uploadError);
        } else {
          finalMediaUrl = `storage://message-attachments/${uploadData.path}`;
          console.log('[whatsapp-webhook] ✅ Base64 convertido e salvo:', finalMediaUrl);
        }
      } catch (b64Error) {
        console.error('[whatsapp-webhook] ❌ Erro ao processar base64:', b64Error);
      }
    }
    
    // Se AINDA não tem mídia e é mídia, tentar buscar via WAHA API
    if (!finalMediaUrl && type !== 'text' && wahaConfigForMedia && externalMessageId) {
      console.log('[whatsapp-webhook] 📁 Mídia sem URL/base64, tentando buscar via WAHA API...');
      
      // Extrair chatId e messageId para a chamada
      const rawContact = isFromMe 
        ? (messageData as WAHAMessage)?.to || (messageData as WAHAMessage)?.chatId
        : (messageData as WAHAMessage)?.from || (messageData as WAHAMessage)?.chatId;
      
      if (rawContact) {
        try {
          // GET /api/{session}/chats/{chatId}/messages/{messageId}?downloadMedia=true
          const cleanChatId = rawContact.includes('@') ? rawContact : `${rawContact}@c.us`;
          // IMPORTANTE: usar externalMessageId completo (ex: true_554599889851@c.us_3EB0...)
          const url = `${wahaConfigForMedia.baseUrl}/api/${wahaConfigForMedia.sessionName}/chats/${cleanChatId}/messages/${externalMessageId}?downloadMedia=true`;
          
          console.log('[whatsapp-webhook] 📁 Chamando WAHA para obter mídia:', url);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
          
          const mediaResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Api-Key': wahaConfigForMedia.apiKey,
              'Authorization': `Bearer ${wahaConfigForMedia.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (mediaResponse.ok) {
            const fetchedMediaData = await mediaResponse.json();
            console.log('[whatsapp-webhook] 📁 Resposta WAHA mídia:', JSON.stringify(fetchedMediaData).substring(0, 500));
            
            // Extrair URL de mídia do resultado
            const fetchedMediaUrl = fetchedMediaData?.media?.url || 
                                     fetchedMediaData?.mediaUrl || 
                                     fetchedMediaData?._data?.media?.url ||
                                     fetchedMediaData?._data?.deprecatedMms3Url;
            
            // Também checar se veio base64 na resposta da API
            const fetchedBase64 = fetchedMediaData?.media?.data || fetchedMediaData?._data?.media?.data;
            
            if (fetchedMediaUrl) {
              console.log('[whatsapp-webhook] 📁 URL de mídia recuperada via API:', fetchedMediaUrl.substring(0, 100));
              finalMediaUrl = fetchedMediaUrl;
            } else if (fetchedBase64 && isValidBase64(fetchedBase64)) {
              console.log('[whatsapp-webhook] 📁 Base64 recuperado via API, fazendo upload...');
              // Fazer upload do base64 obtido via API
              try {
                const binaryString = atob(fetchedBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                const fetchedMimetype = fetchedMediaData?.media?.mimetype || fetchedMediaData?._data?.media?.mimetype || '';
                const extMap: Record<string, string> = { image: 'jpg', audio: 'ogg', video: 'mp4', document: 'bin' };
                const ext = extMap[type] || 'bin';
                const fileName = `leads/${lead.id}/${Date.now()}.${ext}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('message-attachments')
                  .upload(fileName, bytes.buffer, {
                    contentType: fetchedMimetype || 'application/octet-stream',
                    cacheControl: '31536000',
                    upsert: false,
                  });
                
                if (!uploadError && uploadData) {
                  finalMediaUrl = `storage://message-attachments/${uploadData.path}`;
                  console.log('[whatsapp-webhook] ✅ Base64 da API convertido e salvo:', finalMediaUrl);
                }
              } catch (apiB64Error) {
                console.error('[whatsapp-webhook] ❌ Erro ao processar base64 da API:', apiB64Error);
              }
            } else {
              console.log('[whatsapp-webhook] ⚠️ WAHA retornou mas sem media.url nem base64 válido');
            }
          } else {
            console.log('[whatsapp-webhook] ⚠️ WAHA API retornou erro:', mediaResponse.status);
          }
        } catch (fetchError) {
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.log('[whatsapp-webhook] ⚠️ Timeout ao buscar mídia via WAHA API');
          } else {
            console.error('[whatsapp-webhook] ⚠️ Erro ao buscar mídia via WAHA API:', fetchError);
          }
        }
      }
    }
    
    // Se tiver mídia (original ou recuperada), fazer upload para o storage permanente
    if (finalMediaUrl && type !== 'text') {
      console.log('[whatsapp-webhook] 📁 Processando mídia para storage:', {
        type,
        mediaUrl: finalMediaUrl?.substring(0, 100),
        mediaUrlLength: finalMediaUrl?.length,
        isLocalhost: finalMediaUrl?.includes('localhost'),
        hasProtocol: finalMediaUrl?.startsWith('http'),
      });
      
      console.log('[whatsapp-webhook] 📁 WAHA config para mídia:', {
        hasConfig: !!wahaConfigForMedia,
        baseUrl: wahaConfigForMedia?.baseUrl?.substring(0, 50),
      });
      
      const storageUrl = await uploadMediaToStorage(supabase, finalMediaUrl, type, lead.id, wahaConfigForMedia);
      if (storageUrl) {
        finalMediaUrl = storageUrl;
        console.log('[whatsapp-webhook] 📁 Mídia salva no storage:', storageUrl);
      } else {
        console.log('[whatsapp-webhook] ⚠️ Falha no upload, mantendo referência original');
        // Não usar URL original como fallback se não conseguiu fazer upload
        // Deixar undefined para permitir recuperação posterior
        finalMediaUrl = undefined;
      }
    }

    // Extrair quote se houver (re-extrair do payload porque não está disponível aqui)
    const { quotedMessage } = getMessageContent(messageData, provider);
    
    // ========== VERIFICAÇÃO DE SEGURANÇA: Garantir que temos conversa ==========
    if (!conversation || !conversation.id) {
      console.error('[whatsapp-webhook] ❌ ERRO CRÍTICO: conversation é null/undefined antes de criar mensagem');
      console.error('[whatsapp-webhook] Lead:', lead?.id, 'Content:', content?.substring(0, 50));
      return new Response(
        JSON.stringify({ success: false, error: 'No conversation found - cannot create message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ========== DETERMINAR DIREÇÃO E TIPO DE REMETENTE ==========
    // isFromMe=true: mensagem enviada por nós (celular, CRM, bot)
    // isFromMe=false: mensagem recebida do lead
    const direction = isFromMe ? 'outbound' : 'inbound';
    const senderType = isFromMe ? 'agent' : 'lead';
    const source = isFromMe ? 'mobile' : 'lead'; // 'mobile' porque veio pelo celular (não pelo CRM)
    
    console.log('[whatsapp-webhook] Direção:', direction, 'Sender:', senderType, 'Source:', source);
    
    // Criar mensagem com dados de quote se existirem (usar upsert com waha_message_id)
    const messageInsertData: Record<string, unknown> = {
      conversation_id: conversation.id,
      lead_id: lead.id,
      sender_id: isFromMe ? null : lead.id,
      sender_type: senderType,
      content: content,
      type: type as 'text' | 'image' | 'audio' | 'video' | 'document',
      media_url: finalMediaUrl,
      direction: direction,
      source: source,
      status: isFromMe ? 'sent' : 'delivered',
      external_id: externalMessageId || null,
      waha_message_id: wahaMessageId, // ← ID canônico para idempotência
    };
    
    // Adicionar dados de quote se existir
    if (quotedMessage) {
      messageInsertData.reply_to_external_id = quotedMessage.id;
      messageInsertData.quoted_message = quotedMessage;
      console.log('[whatsapp-webhook] Salvando mensagem com quote:', quotedMessage.id);
    }
    
    // Usar upsert para garantir idempotência (UNIQUE constraint no waha_message_id)
    let message;
    if (wahaMessageId) {
      const { data: upsertedMessage, error: upsertMsgError } = await supabase
        .from('messages')
        .upsert(messageInsertData, {
          onConflict: 'waha_message_id',
          ignoreDuplicates: true, // Ignora se já existe (não atualiza)
        })
        .select('*')
        .maybeSingle();
      
      if (upsertMsgError) {
        // Se erro for de duplicata, buscar a mensagem existente
        if (upsertMsgError.code === '23505') {
          console.log('[whatsapp-webhook] ⏭️ Mensagem duplicada detectada no upsert, ignorando');
          const { data: existingMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('waha_message_id', wahaMessageId)
            .maybeSingle();
          
          return new Response(
            JSON.stringify({ success: true, duplicate: true, existing_message_id: existingMsg?.id, matched_by: 'upsert_conflict' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('[whatsapp-webhook] ❌ Erro ao criar mensagem:', upsertMsgError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      message = upsertedMessage;
    } else {
      // Sem waha_message_id, usar insert normal
      const { data: insertedMessage, error: insertMsgError } = await supabase
        .from('messages')
        .insert(messageInsertData)
        .select('*')
        .single();
      
      if (insertMsgError) {
        console.error('[whatsapp-webhook] ❌ Erro ao criar mensagem:', insertMsgError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      message = insertedMessage;
    }

    console.log('[whatsapp-webhook] ✅ Mensagem criada:', message?.id, 'waha_message_id:', wahaMessageId);

    // Notificações de mensagens removidas - o sino é reservado para eventos importantes
    // Alertas de novas mensagens são tratados via toast/som no frontend (useInboxRealtime)

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
