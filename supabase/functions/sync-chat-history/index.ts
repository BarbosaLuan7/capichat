import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncPayload {
  conversation_id: string;
  limit?: number; // default 50
}

interface WAHAMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  body: string;
  hasMedia: boolean;
  type: string;
  fromMe: boolean;
  chatId?: string;
  ack?: number;
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
      console.log(`[sync-chat-history] Tentando ${options.method || 'GET'} ${url} com ${authFormat.name}`);
      
      const mergedHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
        ...authFormat.headers,
      };
      
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      console.log(`[sync-chat-history] ${authFormat.name} - Status: ${response.status}`);

      if (response.ok || response.status !== 401) {
        return response;
      }
      
      lastResponse = response;
      console.log(`[sync-chat-history] ${authFormat.name} - Unauthorized, tentando próximo...`);
      
    } catch (error: unknown) {
      console.error(`[sync-chat-history] ${authFormat.name} - Erro:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('Todos os formatos de autenticação falharam');
}

// Mapeia tipo WAHA para nosso enum
function mapWahaType(wahaType: string): 'text' | 'image' | 'audio' | 'video' | 'document' {
  const typeMap: Record<string, 'text' | 'image' | 'audio' | 'video' | 'document'> = {
    'chat': 'text',
    'image': 'image',
    'ptt': 'audio',
    'audio': 'audio',
    'video': 'video',
    'document': 'document',
  };
  return typeMap[wahaType] || 'text';
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: SyncPayload = await req.json();
    const { conversation_id, limit = 50 } = payload;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-chat-history] Iniciando sync para conversa:', conversation_id, 'limit:', limit);

    // Buscar conversa e lead
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, lead:leads(*)')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[sync-chat-history] Conversa não encontrada:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = conversation.lead;
    if (!lead) {
      return new Response(
        JSON.stringify({ error: 'Lead not found for conversation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar config do WhatsApp (WAHA)
    const { data: wahaConfig, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .limit(1)
      .maybeSingle();

    if (configError || !wahaConfig) {
      console.error('[sync-chat-history] Config WAHA não encontrada:', configError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar chatId
    const countryCode = lead.country_code || '55';
    const phoneWithCountry = lead.phone.startsWith(countryCode) ? lead.phone : `${countryCode}${lead.phone}`;
    const chatId = lead.whatsapp_chat_id || `${phoneWithCountry}@c.us`;
    
    console.log('[sync-chat-history] Buscando mensagens do WAHA para chatId:', chatId);

    // Buscar mensagens do WAHA
    const baseUrl = wahaConfig.base_url.replace(/\/+$/, '');
    const session = wahaConfig.instance_name || 'default';
    const messagesUrl = `${baseUrl}/api/messages?chatId=${encodeURIComponent(chatId)}&limit=${limit}&session=${session}`;
    
    let wahaMessages: WAHAMessage[] = [];
    
    try {
      const response = await wahaFetch(messagesUrl, wahaConfig.api_key, { method: 'GET' });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sync-chat-history] Erro ao buscar mensagens do WAHA:', response.status, errorText);
        
        // Erros conhecidos do WAHA que não são falhas reais:
        // - "No LID for user" = chat não existe no WhatsApp (nunca houve conversa)
        // - 404 = chat não encontrado
        const isKnownNonError = 
          errorText.includes('No LID for user') || 
          errorText.includes('Chat not found') ||
          response.status === 404;
        
        if (isKnownNonError) {
          console.log('[sync-chat-history] Chat não existe no WhatsApp - retornando vazio');
          return new Response(
            JSON.stringify({
              success: true,
              synced: 0,
              skipped: 0,
              total: 0,
              message: 'Chat não encontrado no WhatsApp - nenhuma mensagem para sincronizar',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Outros erros são reais
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages from WhatsApp', details: errorText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      wahaMessages = await response.json();
    } catch (fetchError) {
      console.error('[sync-chat-history] Erro de rede ao buscar mensagens:', fetchError);
      // Erro de rede/timeout - retornar graciosamente
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          skipped: 0,
          total: 0,
          message: 'Não foi possível conectar ao WhatsApp - tente novamente',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-chat-history] Mensagens recebidas do WAHA:', wahaMessages.length);

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const msg of wahaMessages) {
      try {
        // Verificar se já existe pelo external_id
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('external_id', msg.id)
          .maybeSingle();
        
        if (existing) {
          skipped++;
          continue;
        }

        // Determinar direção, sender_type e source
        const direction = msg.fromMe ? 'outbound' : 'inbound';
        const senderType = msg.fromMe ? 'agent' : 'lead';
        const source = msg.fromMe ? 'mobile' : 'lead';
        const messageType = mapWahaType(msg.type);
        const content = msg.body || `[${messageType}]`;

        // Determinar status baseado em ack
        let status: 'sent' | 'delivered' | 'read' = 'sent';
        if (msg.ack !== undefined) {
          if (msg.ack >= 3) status = 'read';
          else if (msg.ack >= 2) status = 'delivered';
        }

        // Inserir mensagem
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversation_id,
            lead_id: lead.id,
            sender_id: senderType === 'lead' ? lead.id : null,
            sender_type: senderType,
            content: content,
            type: messageType,
            direction: direction,
            source: source,
            status: status,
            external_id: msg.id,
            created_at: new Date(msg.timestamp * 1000).toISOString(),
          });

        if (insertError) {
          console.error('[sync-chat-history] Erro ao inserir mensagem:', msg.id, insertError);
          errors.push(`Msg ${msg.id}: ${insertError.message}`);
        } else {
          synced++;
          console.log('[sync-chat-history] Mensagem sincronizada:', msg.id, direction);
        }
      } catch (msgError) {
        console.error('[sync-chat-history] Erro ao processar mensagem:', msg.id, msgError);
        errors.push(`Msg ${msg.id}: ${msgError instanceof Error ? msgError.message : 'Unknown error'}`);
      }
    }

    console.log('[sync-chat-history] Sync concluído:', { synced, skipped, errors: errors.length });

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        total: wahaMessages.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sync-chat-history] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
