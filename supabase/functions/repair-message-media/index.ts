import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function para recuperar mídia de mensagens antigas que foram salvas sem media_url
 * 
 * Uso: POST /repair-message-media
 * Body: { messageId: string }
 * 
 * A função:
 * 1. Busca a mensagem no banco
 * 2. Se já tem media_url, retorna OK
 * 3. Se não tem, busca a mídia via WAHA API
 * 4. Faz upload para o storage
 * 5. Atualiza a mensagem com a nova URL
 */

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

    const { messageId } = await req.json();

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'messageId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[repair-message-media] Reparando mensagem:', messageId);

    // 1. Buscar mensagem com dados relacionados
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        lead_id,
        type,
        media_url,
        content,
        external_id,
        waha_message_id,
        direction,
        created_at,
        conversations!inner (
          id,
          lead_id,
          whatsapp_instance_id
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      console.error('[repair-message-media] Mensagem não encontrada:', msgError);
      return new Response(
        JSON.stringify({ error: 'Message not found', details: msgError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Se já tem media_url válida, não precisa reparar
    if (message.media_url && message.media_url.startsWith('storage://')) {
      console.log('[repair-message-media] Mensagem já tem media_url válida:', message.media_url);
      return new Response(
        JSON.stringify({ success: true, already_repaired: true, media_url: message.media_url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Se é texto, não faz sentido reparar
    if (message.type === 'text') {
      console.log('[repair-message-media] Mensagem é texto, não precisa de mídia');
      return new Response(
        JSON.stringify({ success: false, error: 'Message is text type, no media to repair' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Buscar config do WhatsApp
    const conversation = message.conversations as any;
    let whatsappConfig = null;

    if (conversation?.whatsapp_instance_id) {
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('id, base_url, api_key, instance_name, tenant_id')
        .eq('id', conversation.whatsapp_instance_id)
        .eq('is_active', true)
        .maybeSingle();
      whatsappConfig = config;
    }

    // Fallback: buscar qualquer config WAHA ativa
    if (!whatsappConfig) {
      const { data: fallbackConfig } = await supabase
        .from('whatsapp_config')
        .select('id, base_url, api_key, instance_name, tenant_id')
        .eq('is_active', true)
        .eq('provider', 'waha')
        .limit(1)
        .maybeSingle();
      whatsappConfig = fallbackConfig;
    }

    if (!whatsappConfig) {
      console.error('[repair-message-media] Config WhatsApp não encontrada');
      return new Response(
        JSON.stringify({ error: 'WhatsApp config not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[repair-message-media] Usando config WAHA:', whatsappConfig.instance_name);

    // 5. Buscar lead para obter o chatId
    const { data: lead } = await supabase
      .from('leads')
      .select('id, phone, country_code, whatsapp_chat_id')
      .eq('id', message.lead_id)
      .single();

    if (!lead) {
      console.error('[repair-message-media] Lead não encontrado');
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Montar chatId para a chamada WAHA
    let chatId = lead.whatsapp_chat_id;
    if (!chatId) {
      // Tentar montar a partir do phone
      const countryCode = lead.country_code || '55';
      const phone = lead.phone.replace(/\D/g, '');
      chatId = `${countryCode}${phone}@c.us`;
    }
    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }

    console.log('[repair-message-media] ChatId:', chatId);

    // 7. Chamar WAHA API para obter a mídia
    // IMPORTANTE: Usar external_id (completo, ex: true_554599889851@c.us_3EB0...)
    // O waha_message_id (curto, ex: 3EB0...) pode não funcionar para buscar mensagem
    const messageIdForApi = message.external_id || message.waha_message_id;
    console.log('[repair-message-media] IDs disponíveis - external_id:', message.external_id, '| waha_message_id:', message.waha_message_id, '| usando:', messageIdForApi);
    if (!messageIdForApi) {
      console.error('[repair-message-media] Sem external_id/waha_message_id para buscar mídia');
      return new Response(
        JSON.stringify({ error: 'No external message ID available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = whatsappConfig.base_url.replace(/\/$/, '');
    const url = `${baseUrl}/api/${whatsappConfig.instance_name}/chats/${chatId}/messages/${messageIdForApi}?downloadMedia=true`;

    console.log('[repair-message-media] Chamando WAHA API:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Api-Key': whatsappConfig.api_key,
          'Authorization': `Bearer ${whatsappConfig.api_key}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[repair-message-media] WAHA API erro:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'WAHA API error', status: response.status, details: errorText }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mediaData = await response.json();
      console.log('[repair-message-media] Resposta WAHA:', JSON.stringify(mediaData).substring(0, 500));

      // 8. Extrair URL de mídia OU base64
      const mediaUrl = mediaData?.media?.url || 
                       mediaData?.mediaUrl || 
                       mediaData?._data?.media?.url ||
                       mediaData?._data?.deprecatedMms3Url;
      
      const base64Data = mediaData?.media?.data || mediaData?._data?.media?.data;
      const base64Mimetype = mediaData?.media?.mimetype || mediaData?._data?.media?.mimetype || '';
      
      let storageUrl: string | null = null;
      
      if (mediaUrl) {
        console.log('[repair-message-media] URL de mídia obtida:', mediaUrl.substring(0, 100));
        
        // 9a. Fazer upload via URL para o storage
        storageUrl = await uploadMediaToStorage(supabase, mediaUrl, message.type, lead.id, {
          baseUrl: baseUrl,
          apiKey: whatsappConfig.api_key,
          sessionName: whatsappConfig.instance_name,
        });
      } else if (base64Data && base64Data.length > 100) {
        console.log('[repair-message-media] Base64 encontrado na resposta, fazendo upload direto...');
        
        // 9b. Fazer upload direto do base64
        try {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Determinar extensão
          const extMap: Record<string, string> = { image: 'jpg', audio: 'ogg', video: 'mp4', document: 'bin' };
          const ext = extMap[message.type] || 'bin';
          const fileName = `leads/${lead.id}/${Date.now()}.${ext}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(fileName, bytes.buffer, {
              contentType: base64Mimetype || 'application/octet-stream',
              cacheControl: '31536000',
              upsert: false,
            });
          
          if (!uploadError && uploadData) {
            storageUrl = `storage://message-attachments/${uploadData.path}`;
            console.log('[repair-message-media] ✅ Base64 convertido e salvo:', storageUrl);
          } else {
            console.error('[repair-message-media] Erro upload base64:', uploadError);
          }
        } catch (b64Error) {
          console.error('[repair-message-media] Erro ao processar base64:', b64Error);
        }
      }

      if (!storageUrl) {
        console.error('[repair-message-media] Mídia não encontrada na resposta WAHA (nem URL nem base64)');
        return new Response(
          JSON.stringify({ error: 'Media not found in WAHA response', data: { hasUrl: !!mediaUrl, hasBase64: !!(base64Data && base64Data.length > 100) } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[repair-message-media] Mídia salva no storage:', storageUrl);

      // 10. Atualizar mensagem no banco
      const updateData: Record<string, unknown> = { media_url: storageUrl };

      // Limpar content se for base64
      if (message.content && isBase64Content(message.content)) {
        updateData.content = '';
        console.log('[repair-message-media] Limpando content base64');
      }

      const { error: updateError } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageId);

      if (updateError) {
        console.error('[repair-message-media] Erro ao atualizar mensagem:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update message', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[repair-message-media] ✅ Mensagem reparada com sucesso');

      return new Response(
        JSON.stringify({ 
          success: true, 
          media_url: storageUrl,
          message_id: messageId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[repair-message-media] Timeout ao chamar WAHA API');
        return new Response(
          JSON.stringify({ error: 'WAHA API timeout' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('[repair-message-media] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== Funções auxiliares (copiadas do whatsapp-webhook) ==========

function isBase64Content(str: string): boolean {
  if (!str || str.length < 100) return false;
  const base64Patterns = ['/9j/', 'iVBOR', 'R0lGOD', 'UklGR', 'AAAA', 'data:image', 'data:audio', 'data:video'];
  return base64Patterns.some(pattern => str.startsWith(pattern)) || 
         (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
}

async function uploadMediaToStorage(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string,
  wahaConfig?: { baseUrl: string; apiKey: string; sessionName: string } | null
): Promise<string | null> {
  try {
    // Normalizar URL
    let normalizedUrl = mediaUrl;
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      normalizedUrl = `https://${mediaUrl}`;
    }
    
    // Corrigir URL localhost
    let correctedUrl = normalizedUrl;
    const urlObj = new URL(normalizedUrl);
    const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
    
    if (isLocalhost && wahaConfig?.baseUrl) {
      const wahaUrlObj = new URL(wahaConfig.baseUrl);
      correctedUrl = `${wahaUrlObj.protocol}//${wahaUrlObj.host}${urlObj.pathname}${urlObj.search}`;
      console.log('[repair-message-media] URL localhost corrigida:', correctedUrl);
    }
    
    // Preparar headers de autenticação
    const headers: Record<string, string> = {};
    const isWahaUrl = wahaConfig?.baseUrl && correctedUrl.includes(new URL(wahaConfig.baseUrl).host);
    
    if (isWahaUrl && wahaConfig?.apiKey) {
      headers['X-Api-Key'] = wahaConfig.apiKey;
      headers['Authorization'] = `Bearer ${wahaConfig.apiKey}`;
    }
    
    // Baixar o arquivo
    const response = await fetch(correctedUrl, { headers });
    if (!response.ok) {
      console.error('[repair-message-media] Erro ao baixar mídia:', response.status);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    
    // Determinar extensão
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
    };
    
    let extension = extensionMap[contentType];
    if (!extension) {
      for (const [ct, ext] of Object.entries(extensionMap)) {
        if (contentType.includes(ct.split('/')[1])) {
          extension = ext;
          break;
        }
      }
    }
    
    if (!extension) {
      const typeExtMap: Record<string, string> = {
        'image': 'jpg',
        'audio': 'ogg',
        'video': 'mp4',
        'document': 'bin',
      };
      extension = typeExtMap[type] || 'bin';
    }
    
    const fileName = `leads/${leadId}/${Date.now()}.${extension}`;
    
    // Upload
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, arrayBuffer, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      });
    
    if (error) {
      console.error('[repair-message-media] Erro no upload:', error);
      return null;
    }
    
    return `storage://message-attachments/${data.path}`;
  } catch (error) {
    console.error('[repair-message-media] Erro ao processar mídia:', error);
    return null;
  }
}
