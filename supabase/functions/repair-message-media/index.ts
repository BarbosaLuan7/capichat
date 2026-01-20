import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function para recuperar mídia de mensagens que falharam no webhook
 *
 * Uso: POST /repair-message-media
 * Body: { messageId: string }
 *
 * Fluxo simplificado:
 * 1. Busca mensagem → 2. Valida se precisa reparar → 3. Chama WAHA API → 4. Upload → 5. Atualiza
 */

serve(async (req) => {
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { messageId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[repair-media] Iniciando reparo:', messageId);

    // 1. Buscar mensagem com dados relacionados
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select(
        `
        id, conversation_id, lead_id, type, media_url, content,
        external_id, waha_message_id,
        conversations!inner (id, lead_id, whatsapp_instance_id)
      `
      )
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      console.error('[repair-media] Mensagem não encontrada:', msgError);
      return jsonResponse({ error: 'Message not found' }, 404);
    }

    // 2. Validar se precisa reparar
    if (
      message.media_url &&
      (message.media_url.startsWith('storage://') || message.media_url.startsWith('https://'))
    ) {
      console.log('[repair-media] Já tem media_url válida');
      return jsonResponse({ success: true, already_repaired: true, media_url: message.media_url });
    }

    if (message.type === 'text') {
      return jsonResponse({ error: 'Message is text type' }, 400);
    }

    // 3. Buscar config WhatsApp
    const conversation = message.conversations as any;
    const whatsappConfig = await getWhatsAppConfig(supabase, conversation?.whatsapp_instance_id);

    if (!whatsappConfig) {
      console.error('[repair-media] Config WhatsApp não encontrada');
      return jsonResponse({ error: 'WhatsApp config not found' }, 400);
    }

    // 4. Buscar lead para chatId (incluir original_lid para Facebook)
    const { data: lead } = await supabase
      .from('leads')
      .select('id, phone, country_code, whatsapp_chat_id, original_lid')
      .eq('id', message.lead_id)
      .single();

    if (!lead) {
      return jsonResponse({ error: 'Lead not found' }, 404);
    }

    const chatId = buildChatId(lead);
    const messageIdForApi = message.external_id || message.waha_message_id;

    if (!messageIdForApi) {
      return jsonResponse({ error: 'No external message ID available' }, 400);
    }

    // 5. Chamar WAHA API com retry e timeout reduzido
    const baseUrl = whatsappConfig.base_url.replace(/\/$/, '');
    const wahaUrl = `${baseUrl}/api/${whatsappConfig.instance_name}/chats/${chatId}/messages/${messageIdForApi}?downloadMedia=true`;

    console.log('[repair-media] Chamando WAHA:', {
      chatId,
      msgId: messageIdForApi,
      url: wahaUrl.replace(whatsappConfig.api_key, '***'),
    });

    const TIMEOUT_MS = 15000; // Reduzido de 30s para 15s
    const MAX_RETRIES = 2;

    let lastError: Error | null = null;
    let mediaData: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const startTime = Date.now();

      try {
        console.log(`[repair-media] Tentativa ${attempt}/${MAX_RETRIES}...`);

        const wahaResponse = await fetch(wahaUrl, {
          method: 'GET',
          headers: {
            'X-Api-Key': whatsappConfig.api_key,
            Authorization: `Bearer ${whatsappConfig.api_key}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const elapsed = Date.now() - startTime;
        console.log(
          `[repair-media] WAHA respondeu em ${elapsed}ms, status: ${wahaResponse.status}`
        );

        if (!wahaResponse.ok) {
          const errorText = await wahaResponse.text().catch(() => '');
          console.error('[repair-media] WAHA erro:', wahaResponse.status, errorText);

          // Se for 404 (mensagem não existe mais), não tentar novamente
          if (wahaResponse.status === 404) {
            return jsonResponse(
              {
                error: 'Mídia não encontrada no WhatsApp',
                code: 'MEDIA_NOT_FOUND',
                expired: true,
              },
              404
            );
          }

          lastError = new Error(`WAHA HTTP ${wahaResponse.status}`);
          continue; // Tentar novamente
        }

        mediaData = await wahaResponse.json();
        console.log('[repair-media] Resposta WAHA recebida');
        break; // Sucesso, sair do loop
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error(`[repair-media] Timeout após ${elapsed}ms (tentativa ${attempt})`);
          lastError = new Error('WAHA não respondeu a tempo');
        } else {
          console.error(`[repair-media] Erro fetch (tentativa ${attempt}):`, fetchError);
          lastError = fetchError instanceof Error ? fetchError : new Error('Erro desconhecido');
        }

        // Aguardar um pouco antes de retry (backoff exponencial)
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }

    // Se não conseguiu após todas as tentativas
    if (!mediaData) {
      const isTimeout =
        lastError?.message?.includes('tempo') || lastError?.message?.includes('Timeout');
      return jsonResponse(
        {
          error: isTimeout
            ? 'Servidor WhatsApp não respondeu'
            : 'Falha ao recuperar mídia do WhatsApp',
          code: isTimeout ? 'TIMEOUT' : 'WAHA_ERROR',
          details: lastError?.message,
        },
        isTimeout ? 504 : 502
      );
    }

    // 6. Extrair e fazer upload da mídia
    const storageUrl = await extractAndUploadMedia(supabase, mediaData, message.type, lead.id, {
      baseUrl,
      apiKey: whatsappConfig.api_key,
    });

    if (!storageUrl) {
      return jsonResponse(
        {
          error: 'Mídia pode ter expirado no WhatsApp',
          code: 'MEDIA_EXPIRED',
          expired: true,
        },
        404
      );
    }

    // 7. Atualizar mensagem
    const updateData: Record<string, unknown> = { media_url: storageUrl };
    if (message.content && isBase64Content(message.content)) {
      updateData.content = '';
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);

    if (updateError) {
      console.error('[repair-media] Erro ao atualizar:', updateError);
      return jsonResponse({ error: 'Falha ao salvar mídia' }, 500);
    }

    console.log('[repair-media] ✅ Sucesso:', storageUrl);
    return jsonResponse({ success: true, media_url: storageUrl, message_id: messageId });
  } catch (error) {
    console.error('[repair-media] Erro:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});

// ========== Funções auxiliares ==========

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getWhatsAppConfig(supabase: any, instanceId?: string) {
  if (instanceId) {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name')
      .eq('id', instanceId)
      .eq('is_active', true)
      .maybeSingle();
    if (data) return data;
  }

  // Fallback: qualquer config WAHA ativa
  const { data } = await supabase
    .from('whatsapp_config')
    .select('id, base_url, api_key, instance_name')
    .eq('is_active', true)
    .eq('provider', 'waha')
    .limit(1)
    .maybeSingle();
  return data;
}

function buildChatId(lead: {
  phone: string;
  country_code?: string | null;
  whatsapp_chat_id?: string | null;
  original_lid?: string | null;
}) {
  // Prioridade: whatsapp_chat_id > original_lid > telefone
  if (lead.whatsapp_chat_id?.includes('@')) {
    console.log('[repair-media] Usando whatsapp_chat_id:', lead.whatsapp_chat_id);
    return lead.whatsapp_chat_id;
  }

  // Para leads de Facebook, usar o LID
  if (lead.original_lid) {
    const lidChatId = `${lead.original_lid}@lid`;
    console.log('[repair-media] Usando LID do Facebook:', lidChatId);
    return lidChatId;
  }

  // Fallback: telefone
  const countryCode = lead.country_code || '55';
  const phone = lead.phone.replace(/\D/g, '');
  const phoneChatId = `${countryCode}${phone}@c.us`;
  console.log('[repair-media] Usando telefone:', phoneChatId);
  return phoneChatId;
}

function isBase64Content(str: string): boolean {
  if (!str || str.length < 100) return false;
  const patterns = ['/9j/', 'iVBOR', 'R0lGOD', 'UklGR', 'AAAA', 'data:image', 'data:audio'];
  return (
    patterns.some((p) => str.startsWith(p)) ||
    (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)))
  );
}

async function extractAndUploadMedia(
  supabase: any,
  wahaData: any,
  type: string,
  leadId: string,
  wahaConfig: { baseUrl: string; apiKey: string }
): Promise<string | null> {
  // Tentar URL primeiro
  const mediaUrl = wahaData?.media?.url || wahaData?.mediaUrl || wahaData?._data?.deprecatedMms3Url;

  if (mediaUrl) {
    return await uploadFromUrl(supabase, mediaUrl, type, leadId, wahaConfig);
  }

  // Fallback: base64
  const base64Data = wahaData?.media?.data || wahaData?._data?.media?.data;
  const mimetype = wahaData?.media?.mimetype || wahaData?._data?.media?.mimetype || '';

  if (base64Data && base64Data.length > 100) {
    return await uploadFromBase64(supabase, base64Data, mimetype, type, leadId);
  }

  return null;
}

async function uploadFromUrl(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string,
  wahaConfig: { baseUrl: string; apiKey: string }
): Promise<string | null> {
  try {
    let url = mediaUrl.startsWith('http') ? mediaUrl : `https://${mediaUrl}`;

    // Corrigir localhost para URL pública
    const urlObj = new URL(url);
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      const wahaHost = new URL(wahaConfig.baseUrl).host;
      url = `https://${wahaHost}${urlObj.pathname}${urlObj.search}`;
    }

    const headers: Record<string, string> = {};
    if (url.includes(new URL(wahaConfig.baseUrl).host)) {
      headers['X-Api-Key'] = wahaConfig.apiKey;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error('[repair-media] Download falhou:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const ext = getExtension(contentType, type);
    const fileName = `leads/${leadId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, arrayBuffer, { contentType, cacheControl: '31536000' });

    if (error) {
      console.error('[repair-media] Upload erro:', error);
      return null;
    }

    return `storage://message-attachments/${data.path}`;
  } catch (e) {
    console.error('[repair-media] Erro uploadFromUrl:', e);
    return null;
  }
}

async function uploadFromBase64(
  supabase: any,
  base64Data: string,
  mimetype: string,
  type: string,
  leadId: string
): Promise<string | null> {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const ext = getExtension(mimetype, type);
    const fileName = `leads/${leadId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, bytes.buffer, {
        contentType: mimetype || 'application/octet-stream',
        cacheControl: '31536000',
      });

    if (error) {
      console.error('[repair-media] Upload base64 erro:', error);
      return null;
    }

    return `storage://message-attachments/${data.path}`;
  } catch (e) {
    console.error('[repair-media] Erro uploadFromBase64:', e);
    return null;
  }
}

function getExtension(contentType: string, messageType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
  };

  for (const [ct, ext] of Object.entries(map)) {
    if (contentType.includes(ct.split('/')[1])) return ext;
  }

  const fallback: Record<string, string> = {
    image: 'jpg',
    audio: 'ogg',
    video: 'mp4',
    document: 'bin',
  };
  return fallback[messageType] || 'bin';
}
