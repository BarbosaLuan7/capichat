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

    // Buscar configuração WAHA ativa
    const { data: wahaConfig } = await supabase
      .from('whatsapp_config')
      .select('base_url, api_key, instance_name')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .limit(1)
      .maybeSingle();

    if (!wahaConfig) {
      console.log('[refresh-avatars] Nenhuma config WAHA ativa encontrada');
      return new Response(
        JSON.stringify({ success: false, error: 'No active WAHA config' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = wahaConfig.base_url.replace(/\/$/, '');
    const apiKey = wahaConfig.api_key;
    const sessionName = wahaConfig.instance_name || 'default';

    // Buscar leads sem avatar_url ou com avatar antigo (mais de 7 dias sem atualização)
    // Limitado a 50 leads por execução para não sobrecarregar a API
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, name, avatar_url, updated_at')
      .eq('status', 'active')
      .eq('is_facebook_lid', false)  // Não buscar foto para LIDs
      .or(`avatar_url.is.null,updated_at.lt.${sevenDaysAgo.toISOString()}`)
      .order('last_interaction_at', { ascending: false })  // Priorizar leads mais recentes
      .limit(50);

    if (leadsError) {
      console.error('[refresh-avatars] Erro ao buscar leads:', leadsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[refresh-avatars] Processando ${leads?.length || 0} leads...`);

    const results: { leadId: string; success: boolean; avatarUrl?: string }[] = [];
    let successCount = 0;

    for (const lead of leads || []) {
      try {
        // Adicionar delay para não sobrecarregar a API (100ms entre requests)
        await new Promise(resolve => setTimeout(resolve, 100));

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
            results.push({ leadId: lead.id, success: true, avatarUrl });
            console.log(`[refresh-avatars] Avatar atualizado para lead ${lead.id}`);
          } else {
            results.push({ leadId: lead.id, success: false });
          }
        } else {
          // Se não encontrou foto, marcar como tentativa feita atualizando updated_at
          await supabase
            .from('leads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', lead.id);
          
          results.push({ leadId: lead.id, success: false });
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
