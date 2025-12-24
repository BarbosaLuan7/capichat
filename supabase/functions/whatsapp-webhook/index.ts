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
    // Format contact ID para API
    const formattedContact = contactId.includes('@') ? contactId : `${contactId}@c.us`;
    
    const url = `${wahaBaseUrl}/api/contacts/profile-picture?contactId=${encodeURIComponent(formattedContact)}&session=${sessionName}`;
    
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

// Busca configuração do WAHA no banco
async function getWAHAConfig(supabase: any): Promise<{ baseUrl: string; apiKey: string; sessionName: string } | null> {
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('base_url, api_key, instance_name')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      return {
        baseUrl: data.base_url.replace(/\/$/, ''), // Remove trailing slash
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
      };
    }
    
    return null;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao buscar config WAHA:', error);
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
  
  // Remove código do país (55) se presente e número tem 12+ dígitos
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }
  
  return numbers;
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

// Função para baixar mídia e fazer upload para o storage
async function uploadMediaToStorage(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string
): Promise<string | null> {
  try {
    console.log('[whatsapp-webhook] Baixando mídia de:', mediaUrl);
    
    // Baixar o arquivo
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      console.error('[whatsapp-webhook] Erro ao baixar mídia:', response.status);
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
    
    // Gerar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(data.path);
    
    console.log('[whatsapp-webhook] Mídia salva em:', publicUrl);
    return publicUrl;
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

function getMessageContent(payload: WAHAMessage | EvolutionMessage, provider: 'waha' | 'evolution'): { content: string; type: string; mediaUrl?: string; isSystemMessage?: boolean } {
  if (provider === 'waha') {
    const msg = payload as WAHAMessage & { _data?: any };
    
    // Verificar se é notificação do sistema
    if (isSystemNotification(msg)) {
      return { content: '', type: 'text', isSystemMessage: true };
    }
    
    let type = 'text';
    
    if (msg.type === 'ptt' || msg.type === 'audio') {
      type = 'audio';
    } else if (msg.type === 'image') {
      type = 'image';
    } else if (msg.type === 'video') {
      type = 'video';
    } else if (msg.type === 'document') {
      type = 'document';
    }
    
    // Só mostrar [Mídia] se realmente tiver mídia
    const hasRealMedia = msg.hasMedia === true && (msg.mediaUrl || type !== 'text');
    let content = msg.body || '';
    
    if (!content && hasRealMedia) {
      const mediaLabels: Record<string, string> = {
        'image': '[Imagem]',
        'audio': '[Áudio]',
        'video': '[Vídeo]',
        'document': '[Documento]',
      };
      content = mediaLabels[type] || '[Mídia]';
    } else if (!content) {
      // Mensagem vazia sem mídia - provavelmente notificação do sistema
      return { content: '', type: 'text', isSystemMessage: true };
    }
    
    return {
      content,
      type,
      mediaUrl: msg.mediaUrl,
    };
  } else {
    const msg = payload as EvolutionMessage;
    const message = msg.message;
    
    if (!message) {
      return { content: '[Mensagem vazia]', type: 'text' };
    }
    
    if (message.conversation) {
      return { content: message.conversation, type: 'text' };
    }
    
    if (message.extendedTextMessage?.text) {
      return { content: message.extendedTextMessage.text, type: 'text' };
    }
    
    if (message.imageMessage) {
      return {
        content: message.imageMessage.caption || '[Imagem]',
        type: 'image',
        mediaUrl: message.imageMessage.url,
      };
    }
    
    if (message.audioMessage) {
      return {
        content: '[Áudio]',
        type: 'audio',
        mediaUrl: message.audioMessage.url,
      };
    }
    
    if (message.videoMessage) {
      return {
        content: message.videoMessage.caption || '[Vídeo]',
        type: 'video',
        mediaUrl: message.videoMessage.url,
      };
    }
    
    if (message.documentMessage) {
      return {
        content: message.documentMessage.fileName || '[Documento]',
        type: 'document',
        mediaUrl: message.documentMessage.url,
      };
    }
    
    return { content: '[Mensagem não suportada]', type: 'text' };
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

    const body = await req.json();
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
        const messageId = payload.id || payload.key?.id || payload.ids?.[0];
        const ackName = payload.ackName || payload.receipt_type || payload.ack;
        const ackNumber = payload.ack;
        
        console.log('[whatsapp-webhook] ACK recebido:', { messageId, ackName, ackNumber });
        
        let newStatus: 'delivered' | 'read' | null = null;
        
        // WAHA usa ackName: 'DEVICE' (entregue), 'READ' (lida), 'PLAYED' (áudio reproduzido)
        // Ou ack: 2 (delivered), 3 (read)
        if (['DEVICE', 'delivered', 'DELIVERY_ACK'].includes(ackName) || ackNumber === 2) {
          newStatus = 'delivered';
        } else if (['READ', 'read', 'PLAYED'].includes(ackName) || ackNumber === 3) {
          newStatus = 'read';
        }
        
        if (newStatus && messageId) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('external_id', messageId);
          
          if (updateError) {
            console.error('[whatsapp-webhook] Erro ao atualizar status:', updateError);
          } else {
            console.log('[whatsapp-webhook] Status atualizado para:', newStatus, 'messageId:', messageId);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, event: 'ack', status: newStatus, messageId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Eventos de mensagem do WAHA
      if (event === 'message' || event === 'message.any') {
        const payload = body.payload as WAHAMessage & { _data?: any };
        
        // Ignorar mensagens enviadas por nós
        if (payload.fromMe) {
          console.log('[whatsapp-webhook] Ignorando mensagem enviada por nós');
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'fromMe' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        messageData = payload;
        externalMessageId = payload.id || '';
        
        // ========== CORREÇÃO 3: Detectar LID e extrair número real ==========
        const rawFrom = payload.from || payload.chatId || '';
        console.log('[whatsapp-webhook] Raw from:', rawFrom);
        
        if (isLID(rawFrom)) {
          console.log('[whatsapp-webhook] Detectado LID do Facebook, buscando número real...');
          isFromFacebookLid = true;
          originalLid = rawFrom.replace('@lid', '').replace(/\D/g, '');
          
          // Primeiro tenta extrair do payload
          let realPhone = extractRealPhoneFromPayload(body.payload);
          
          // Se não conseguiu, tenta via API do WAHA
          if (!realPhone) {
            const wahaConfig = await getWAHAConfig(supabase);
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
        
        // Ignorar mensagens enviadas por nós
        if (payload.key?.fromMe) {
          console.log('[whatsapp-webhook] Ignorando mensagem enviada por nós');
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'fromMe' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        messageData = payload;
        externalMessageId = payload.key?.id || '';
        senderPhone = normalizePhone(payload.key?.remoteJid || '');
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

    // ========== CORREÇÃO 2: Usar upsert para evitar leads duplicados ==========
    // Primeiro, buscar se já existe um lead com esse telefone
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', senderPhone)
      .maybeSingle();

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
        const wahaConfig = await getWAHAConfig(supabase);
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
        const wahaConfig = await getWAHAConfig(supabase);
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

      const { data: upsertedLead, error: upsertError } = await supabase
        .from('leads')
        .upsert({
          name: leadName,
          phone: senderPhone,
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
        
        // Se falhou por conflito, tentar buscar o existente
        if (upsertError.code === '23505') {
          const { data: conflictLead } = await supabase
            .from('leads')
            .select('*')
            .eq('phone', senderPhone)
            .single();
          
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

      // Apenas reabrir conversa se estava pendente - o trigger cuida do unread_count e last_message_at
      await supabase
        .from('conversations')
        .update({
          status: 'open',
        })
        .eq('id', conversation.id);
    } else {
      // Criar nova conversa - o trigger cuida do unread_count e last_message_at quando a mensagem for inserida
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
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
      console.log('[whatsapp-webhook] Conversa criada:', conversation.id);
    }

    // Se tiver mídia, fazer upload para o storage permanente
    let finalMediaUrl = mediaUrl;
    if (mediaUrl && type !== 'text') {
      console.log('[whatsapp-webhook] Processando mídia para storage...');
      const storageUrl = await uploadMediaToStorage(supabase, mediaUrl, type, lead.id);
      if (storageUrl) {
        finalMediaUrl = storageUrl;
        console.log('[whatsapp-webhook] Mídia salva no storage:', storageUrl);
      } else {
        console.log('[whatsapp-webhook] Falha no upload, usando URL original como fallback');
      }
    }

    // Criar mensagem
    const { data: message, error: createMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        lead_id: lead.id,
        sender_id: lead.id,
        sender_type: 'lead',
        content: content,
        type: type as 'text' | 'image' | 'audio' | 'video' | 'document',
        media_url: finalMediaUrl,
        direction: 'inbound',
        status: 'delivered',
        external_id: externalMessageId || null,
      })
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

    // Criar notificação para o usuário atribuído
    if (conversation.assigned_to) {
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
