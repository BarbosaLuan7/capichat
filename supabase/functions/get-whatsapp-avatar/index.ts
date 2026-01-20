import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetAvatarPayload {
  lead_id: string;
  phone: string;
}

// Busca foto de perfil do WhatsApp via WAHA API
async function getProfilePictureUrl(
  baseUrl: string,
  apiKey: string,
  sessionName: string,
  phone: string
): Promise<string | null> {
  try {
    // Formatar telefone: remover tudo que não é número, adicionar 55 se necessário
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    // WAHA exige formato com @c.us no final
    const contactId = `${phoneWithCountry}@c.us`;

    console.log(`[get-whatsapp-avatar] Buscando foto para: ${contactId}`);

    // Usar endpoint padrão do WAHA
    const url = `${baseUrl}/api/contacts/profile-picture?contactId=${contactId}&session=${sessionName}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[get-whatsapp-avatar] API retornou ${response.status}`);
      return null;
    }

    const data = await response.json();
    const profilePictureUrl =
      data?.profilePictureURL || data?.profilePicture || data?.url || data?.imgUrl;

    if (
      profilePictureUrl &&
      typeof profilePictureUrl === 'string' &&
      profilePictureUrl.startsWith('http')
    ) {
      console.log(`[get-whatsapp-avatar] URL da foto encontrada!`);
      return profilePictureUrl;
    }

    console.log(`[get-whatsapp-avatar] Sem URL de foto na resposta`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[get-whatsapp-avatar] Timeout`);
    } else {
      console.error('[get-whatsapp-avatar] Erro:', error);
    }
    return null;
  }
}

// Faz download da imagem e retorna como ArrayBuffer
async function downloadImage(
  imageUrl: string,
  apiKey: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    console.log(`[get-whatsapp-avatar] Baixando imagem...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[get-whatsapp-avatar] Download falhou: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const data = await response.arrayBuffer();

    console.log(`[get-whatsapp-avatar] Imagem baixada: ${data.byteLength} bytes`);
    return { data, contentType };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[get-whatsapp-avatar] Timeout no download`);
    } else {
      console.error('[get-whatsapp-avatar] Erro no download:', error);
    }
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: GetAvatarPayload = await req.json();
    const { lead_id, phone } = payload;

    if (!lead_id || !phone) {
      return new Response(JSON.stringify({ error: 'lead_id e phone são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-whatsapp-avatar] Buscando avatar para lead:', lead_id);

    // Validar que o lead existe antes de prosseguir
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('id, phone, tenant_id, avatar_url')
      .eq('id', lead_id)
      .single();

    if (leadError || !leadData) {
      console.log('[get-whatsapp-avatar] Lead não encontrado:', lead_id);
      return new Response(JSON.stringify({ success: false, error: 'lead_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se já tem avatar no Storage, retornar
    if (leadData.avatar_url && leadData.avatar_url.includes('supabase')) {
      console.log('[get-whatsapp-avatar] Lead já tem avatar no Storage');
      return new Response(
        JSON.stringify({ success: true, avatar_url: leadData.avatar_url, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração WAHA ativa, preferencialmente do tenant do lead
    let wahaConfig = null;
    let configError = null;

    // Se lead tem tenant, buscar config desse tenant primeiro
    if (leadData.tenant_id) {
      const { data: tenantConfig, error: tenantErr } = await supabase
        .from('whatsapp_config')
        .select('id, base_url, api_key, instance_name')
        .eq('is_active', true)
        .eq('provider', 'waha')
        .eq('tenant_id', leadData.tenant_id)
        .limit(1)
        .maybeSingle();

      if (!tenantErr && tenantConfig) {
        wahaConfig = tenantConfig;
        console.log(`[get-whatsapp-avatar] Usando config do tenant ${leadData.tenant_id}`);
      }
      configError = tenantErr;
    }

    // Fallback: pegar qualquer config ativa (mais recente)
    if (!wahaConfig) {
      const { data: anyConfig, error: anyErr } = await supabase
        .from('whatsapp_config')
        .select('id, base_url, api_key, instance_name')
        .eq('is_active', true)
        .eq('provider', 'waha')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      wahaConfig = anyConfig;
      configError = anyErr;
      if (wahaConfig) {
        console.log(`[get-whatsapp-avatar] Usando config fallback: ${wahaConfig.instance_name}`);
      }
    }

    if (configError || !wahaConfig) {
      console.log('[get-whatsapp-avatar] Nenhuma config WAHA ativa');
      return new Response(
        JSON.stringify({ success: false, avatar_url: null, reason: 'no_config' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = wahaConfig.base_url.replace(/\/$/, '');
    const sessionName = wahaConfig.instance_name || 'default';

    // 1. Buscar URL da foto do WhatsApp
    const whatsappImageUrl = await getProfilePictureUrl(
      baseUrl,
      wahaConfig.api_key,
      sessionName,
      phone
    );

    if (!whatsappImageUrl) {
      return new Response(
        JSON.stringify({ success: true, avatar_url: null, reason: 'not_available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fazer download da imagem
    const imageData = await downloadImage(whatsappImageUrl, wahaConfig.api_key);

    if (!imageData) {
      console.log('[get-whatsapp-avatar] Falha no download, salvando URL direta como fallback');
      // Fallback: salvar URL direta (pode não funcionar no browser)
      await supabase.from('leads').update({ avatar_url: whatsappImageUrl }).eq('id', lead_id);
      return new Response(
        JSON.stringify({
          success: true,
          avatar_url: whatsappImageUrl,
          saved: true,
          storage: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Determinar extensão do arquivo
    const ext = imageData.contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `avatars/${lead_id}.${ext}`;

    // 4. Upload para Supabase Storage
    console.log(`[get-whatsapp-avatar] Fazendo upload para Storage: ${fileName}`);

    const { error: uploadError } = await supabase.storage
      .from('lead-avatars')
      .upload(fileName, imageData.data, {
        contentType: imageData.contentType,
        upsert: true, // Sobrescrever se existir
      });

    if (uploadError) {
      console.error('[get-whatsapp-avatar] Erro no upload:', uploadError);
      // Fallback: salvar URL direta
      await supabase.from('leads').update({ avatar_url: whatsappImageUrl }).eq('id', lead_id);
      return new Response(
        JSON.stringify({
          success: true,
          avatar_url: whatsappImageUrl,
          saved: true,
          storage: false,
          upload_error: uploadError.message,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Gerar URL pública do Storage
    const {
      data: { publicUrl },
    } = supabase.storage.from('lead-avatars').getPublicUrl(fileName);

    // Adicionar timestamp para cache busting
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    console.log(`[get-whatsapp-avatar] Avatar salvo no Storage: ${avatarUrl}`);

    // 6. Salvar URL no lead
    const { error: updateError } = await supabase
      .from('leads')
      .update({ avatar_url: avatarUrl })
      .eq('id', lead_id);

    if (updateError) {
      console.error('[get-whatsapp-avatar] Erro ao salvar URL no lead:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        avatar_url: avatarUrl,
        saved: !updateError,
        storage: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[get-whatsapp-avatar] Erro:', error);
    return new Response(JSON.stringify({ success: false, error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
