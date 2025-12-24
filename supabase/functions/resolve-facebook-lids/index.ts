import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Resolve LID para número real usando API do WAHA
async function resolvePhoneFromLID(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  lid: string
): Promise<string | null> {
  try {
    const cleanLid = lid.replace('@lid', '').replace(/\D/g, '');
    const url = `${wahaBaseUrl}/api/${sessionName}/lids/${cleanLid}`;
    
    console.log('[resolve-lids] Tentando resolver LID:', cleanLid);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('[resolve-lids] API retornou:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('[resolve-lids] Resposta da API:', JSON.stringify(data));
    
    // Campo 'pn' é o mais comum na resposta do WAHA
    const realPhone = data?.pn?.replace('@c.us', '') || data?.phone || data?.number || data?.jid?.replace('@c.us', '') || data?.id?.replace('@c.us', '');
    
    if (realPhone && !realPhone.includes('lid')) {
      return realPhone;
    }
    
    return null;
  } catch (error) {
    console.error('[resolve-lids] Erro ao resolver LID:', error);
    return null;
  }
}

function normalizePhone(phone: string): string {
  let numbers = phone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace(/\D/g, '');
  
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }
  
  return numbers;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[resolve-lids] Iniciando resolução de LIDs...');

    // Buscar configuração do WAHA
    const { data: wahaConfig } = await supabase
      .from('whatsapp_config')
      .select('base_url, api_key, instance_name')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .limit(1)
      .maybeSingle();

    if (!wahaConfig) {
      console.log('[resolve-lids] Nenhuma configuração WAHA ativa encontrada');
      return new Response(
        JSON.stringify({ success: true, message: 'No WAHA config found', resolved: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = wahaConfig.base_url.replace(/\/$/, '');
    const sessionName = wahaConfig.instance_name || 'default';

    // Buscar leads com LID não resolvido (limitar a 20 por execução para evitar timeout)
    const { data: pendingLeads, error: fetchError } = await supabase
      .from('leads')
      .select('id, name, phone, original_lid, whatsapp_name')
      .eq('is_facebook_lid', true)
      .not('original_lid', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('[resolve-lids] Erro ao buscar leads:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      console.log('[resolve-lids] Nenhum lead com LID pendente');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending LIDs', resolved: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[resolve-lids] Processando ${pendingLeads.length} leads com LID`);

    let resolved = 0;
    const results: { leadId: string; status: string; phone?: string }[] = [];

    for (const lead of pendingLeads) {
      try {
        const realPhone = await resolvePhoneFromLID(
          baseUrl,
          wahaConfig.api_key,
          sessionName,
          lead.original_lid
        );

        if (realPhone) {
          const normalizedPhone = normalizePhone(realPhone);
          
          // Verificar se já existe um lead com esse telefone
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', normalizedPhone)
            .neq('id', lead.id)
            .maybeSingle();

          if (existingLead) {
            // Já existe outro lead com esse número - marcar para merge manual
            console.log(`[resolve-lids] Lead ${lead.id}: número ${normalizedPhone} já existe em outro lead (${existingLead.id})`);
            results.push({ leadId: lead.id, status: 'duplicate', phone: normalizedPhone });
            
            // Atualizar o lead atual com nota sobre duplicidade
            await supabase
              .from('leads')
              .update({
                internal_notes: `Número real encontrado: ${normalizedPhone}. Já existe lead com este número (ID: ${existingLead.id}). Verificar merge.`
              })
              .eq('id', lead.id);
          } else {
            // Atualizar o lead com o número real
            const newName = lead.whatsapp_name || lead.name.replace(' (via anúncio)', '').replace(/Lead via anúncio \d+/, `Lead ${normalizedPhone}`);
            
            const { error: updateError } = await supabase
              .from('leads')
              .update({
                phone: normalizedPhone,
                is_facebook_lid: false,
                name: newName,
                source: 'facebook_ads_resolved'
              })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`[resolve-lids] Erro ao atualizar lead ${lead.id}:`, updateError);
              results.push({ leadId: lead.id, status: 'error' });
            } else {
              console.log(`[resolve-lids] Lead ${lead.id} resolvido: ${normalizedPhone}`);
              resolved++;
              results.push({ leadId: lead.id, status: 'resolved', phone: normalizedPhone });
            }
          }
        } else {
          results.push({ leadId: lead.id, status: 'not_found' });
        }

        // Pequeno delay entre chamadas para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[resolve-lids] Erro processando lead ${lead.id}:`, error);
        results.push({ leadId: lead.id, status: 'error' });
      }
    }

    console.log(`[resolve-lids] Concluído: ${resolved}/${pendingLeads.length} resolvidos`);

    return new Response(
      JSON.stringify({
        success: true,
        total: pendingLeads.length,
        resolved,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[resolve-lids] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
