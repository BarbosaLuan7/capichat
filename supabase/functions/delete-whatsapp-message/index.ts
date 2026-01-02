import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messageIds, conversationId } = await req.json();

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messageIds é obrigatório e deve ser um array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-whatsapp-message] Deletando ${messageIds.length} mensagens da conversa ${conversationId}`);

    // Buscar a conversa para obter whatsapp_instance_id
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('whatsapp_instance_id, lead_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[delete-whatsapp-message] Conversa não encontrada:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar lead para obter whatsapp_chat_id
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone, whatsapp_chat_id')
      .eq('id', conversation.lead_id)
      .single();

    if (leadError || !lead) {
      console.error('[delete-whatsapp-message] Lead não encontrado:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chatId = lead.whatsapp_chat_id || `${lead.phone.replace(/\D/g, '')}@c.us`;

    // Buscar config do WhatsApp
    const { data: config, error: configError } = await supabase
      .rpc('get_whatsapp_config_full', { config_id: conversation.whatsapp_instance_id });

    if (configError || !config || config.length === 0) {
      console.error('[delete-whatsapp-message] Config WhatsApp não encontrada:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração WhatsApp não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wahaConfig = config[0];
    const baseUrl = wahaConfig.base_url;
    const apiKey = wahaConfig.api_key;
    const session = wahaConfig.instance_name || 'default';

    // Buscar as mensagens para obter waha_message_id
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, waha_message_id, external_id')
      .in('id', messageIds);

    if (msgError) {
      console.error('[delete-whatsapp-message] Erro ao buscar mensagens:', msgError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ messageId: string; success: boolean; error?: string }> = [];

    // Deletar cada mensagem no WAHA
    for (const message of messages || []) {
      const wahaMessageId = message.waha_message_id || message.external_id;
      
      if (!wahaMessageId) {
        console.warn(`[delete-whatsapp-message] Mensagem ${message.id} não tem waha_message_id`);
        results.push({ messageId: message.id, success: false, error: 'Sem ID do WhatsApp' });
        continue;
      }

      try {
        // WAHA API: DELETE /api/{session}/chats/{chatId}/messages/{messageId}
        const deleteUrl = `${baseUrl}/api/${session}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(wahaMessageId)}`;
        
        console.log(`[delete-whatsapp-message] Deletando mensagem: ${deleteUrl}`);
        
        const wahaResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (wahaResponse.ok) {
          // Marcar como deletado localmente no banco
          await supabase
            .from('messages')
            .update({ is_deleted_locally: true })
            .eq('id', message.id);
          
          results.push({ messageId: message.id, success: true });
          console.log(`[delete-whatsapp-message] Mensagem ${message.id} deletada com sucesso`);
        } else {
          const errorText = await wahaResponse.text();
          console.error(`[delete-whatsapp-message] Erro WAHA: ${wahaResponse.status} - ${errorText}`);
          
          // Mesmo se falhar no WAHA, marcar como deletado localmente
          await supabase
            .from('messages')
            .update({ is_deleted_locally: true })
            .eq('id', message.id);
          
          results.push({ 
            messageId: message.id, 
            success: false, 
            error: `WAHA erro: ${wahaResponse.status}` 
          });
        }
      } catch (err) {
        console.error(`[delete-whatsapp-message] Erro ao deletar mensagem ${message.id}:`, err);
        results.push({ 
          messageId: message.id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Erro desconhecido' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[delete-whatsapp-message] Finalizado: ${successCount}/${results.length} deletadas com sucesso`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[delete-whatsapp-message] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
