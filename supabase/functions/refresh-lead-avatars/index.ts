import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const profilePictureUrl = data?.profilePictureURL || data?.profilePicture || data?.url || data?.imgUrl;
    
    if (profilePictureUrl && typeof profilePictureUrl === 'string' && profilePictureUrl.startsWith('http')) {
      return profilePictureUrl;
    }
    
    return null;
  } catch (error) {
    console.error('[refresh-avatars] Erro ao buscar foto:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[refresh-avatars] Iniciando refresh de avatares...');

    // Buscar TODAS as configurações WAHA ativas
    const { data: wahaConfigs, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name')
      .eq('is_active', true)
      .eq('provider', 'waha');

    if (configError || !wahaConfigs || wahaConfigs.length === 0) {
      console.log('[refresh-avatars] Nenhuma config WAHA ativa encontrada');
      return new Response(
        JSON.stringify({ success: false, error: 'No active WAHA config' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[refresh-avatars] Encontradas ${wahaConfigs.length} instâncias WAHA ativas`);

    // Verificar se foi passado um lead_id específico para forçar refresh
    let targetLeadId: string | null = null;
    try {
      const body = await req.json();
      targetLeadId = body?.lead_id || null;
    } catch {
      // Sem body, continuar normalmente
    }

    // Buscar leads sem avatar_url ou com avatar antigo (mais de 7 dias sem atualização)
    // Limitado a 50 leads por execução para não sobrecarregar a API
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Buscar leads COM suas conversas para identificar a instância correta
    let query = supabase
      .from('leads')
      .select(`
        id, phone, name, avatar_url, updated_at,
        conversations(whatsapp_instance_id)
      `)
      .eq('status', 'active')
      .eq('is_facebook_lid', false);

    if (targetLeadId) {
      // Se foi passado um lead específico, buscar apenas ele (forçar refresh)
      console.log(`[refresh-avatars] Forçando refresh para lead específico: ${targetLeadId}`);
      query = query.eq('id', targetLeadId);
    } else {
      // Busca normal: leads SEM avatar OU leads COM avatar antigo (updated_at > 7 dias)
      // Corrigido: avatar_url.is.null captura leads sem foto independente de updated_at
      query = query.or(`avatar_url.is.null,and(avatar_url.neq.null,updated_at.lt.${sevenDaysAgo.toISOString()})`);
    }

    const { data: leads, error: leadsError } = await query
      .order('last_interaction_at', { ascending: false })
      .limit(targetLeadId ? 1 : 50);

    if (leadsError) {
      console.error('[refresh-avatars] Erro ao buscar leads:', leadsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[refresh-avatars] Processando ${leads?.length || 0} leads...`);

    const results: { leadId: string; success: boolean; avatarUrl?: string; instance?: string }[] = [];
    let successCount = 0;

    // Primeira instância como fallback
    const defaultConfig = wahaConfigs[0];

    for (const lead of leads || []) {
      try {
        // Adicionar delay para não sobrecarregar a API (100ms entre requests)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Identificar a instância correta baseada na conversa do lead
        const conversations = lead.conversations as { whatsapp_instance_id: string | null }[] | null;
        const instanceId = conversations?.[0]?.whatsapp_instance_id;
        
        // Usar a instância da conversa ou fallback para a primeira
        const wahaConfig = instanceId 
          ? wahaConfigs.find(c => c.id === instanceId) || defaultConfig
          : defaultConfig;

        const baseUrl = wahaConfig.base_url.replace(/\/$/, '');
        const apiKey = wahaConfig.api_key;
        const sessionName = wahaConfig.instance_name || 'default';

        // Usar número com código do país (55) para a API
        const phoneWithCountry = lead.phone.startsWith('55') ? lead.phone : `55${lead.phone}`;
        const avatarUrl = await getProfilePicture(baseUrl, apiKey, sessionName, phoneWithCountry);

        if (avatarUrl) {
          // Atualizar lead com novo avatar
          const { error: updateError } = await supabase
            .from('leads')
            .update({ 
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', lead.id);

          if (!updateError) {
            successCount++;
            results.push({ leadId: lead.id, success: true, avatarUrl, instance: sessionName });
            console.log(`[refresh-avatars] Avatar atualizado para lead ${lead.id} via ${sessionName}`);
          } else {
            results.push({ leadId: lead.id, success: false, instance: sessionName });
          }
        } else {
          // Se não encontrou foto, marcar como tentativa feita atualizando updated_at
          await supabase
            .from('leads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', lead.id);
          
          results.push({ leadId: lead.id, success: false, instance: sessionName });
        }
      } catch (error) {
        console.error(`[refresh-avatars] Erro ao processar lead ${lead.id}:`, error);
        results.push({ leadId: lead.id, success: false });
      }
    }

    console.log(`[refresh-avatars] Concluído: ${successCount}/${leads?.length || 0} avatares atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: leads?.length || 0,
        updated: successCount,
        instances: wahaConfigs.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[refresh-avatars] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
