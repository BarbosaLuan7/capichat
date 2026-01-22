import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';

interface GetAvatarPayload {
  lead_id: string;
  phone: string;
}

// Busca URL da foto de perfil do WhatsApp via WAHA API
async function getProfilePictureUrl(
  baseUrl: string,
  apiKey: string,
  sessionName: string,
  phone: string
): Promise<string | null> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const contactId = `${phoneWithCountry}@c.us`;

    console.log(`[get-whatsapp-avatar] Buscando foto para: ${contactId}`);

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

    return null;
  } catch (error) {
    console.error('[get-whatsapp-avatar] Erro:', error);
    return null;
  }
}

// Faz download da imagem
async function downloadImage(
  imageUrl: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    console.log(`[get-whatsapp-avatar] Baixando imagem...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(imageUrl, {
      method: 'GET',
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
    console.error('[get-whatsapp-avatar] Erro no download:', error);
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

    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('id, phone, tenant_id, avatar_url')
      .eq('id', lead_id)
      .single();

    if (leadError || !leadData) {
      return new Response(JSON.stringify({ success: false, error: 'lead_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se já tem avatar no Storage, retornar
    if (leadData.avatar_url && leadData.avatar_url.includes('supabase')) {
      return new Response(
        JSON.stringify({ success: true, avatar_url: leadData.avatar_url, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar config WAHA
    const { data: wahaConfig } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!wahaConfig) {
      return new Response(
        JSON.stringify({ success: false, avatar_url: null, reason: 'no_config' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = wahaConfig.base_url.replace(/\/$/, '');
    const sessionName = wahaConfig.instance_name || 'default';

    // 1. Buscar URL da foto
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
    const imageData = await downloadImage(whatsappImageUrl);

    if (!imageData) {
      return new Response(
        JSON.stringify({ success: true, avatar_url: null, reason: 'download_failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Upload para Storage
    const ext = imageData.contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `avatars/${lead_id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('lead-avatars')
      .upload(fileName, imageData.data, {
        contentType: imageData.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[get-whatsapp-avatar] Erro no upload:', uploadError);
      return new Response(JSON.stringify({ success: false, error: 'upload_failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Gerar URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from('lead-avatars').getPublicUrl(fileName);
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // 5. Salvar no lead
    await supabase.from('leads').update({ avatar_url: avatarUrl }).eq('id', lead_id);

    console.log('[get-whatsapp-avatar] Avatar salvo no Storage:', avatarUrl);

    return new Response(
      JSON.stringify({ success: true, avatar_url: avatarUrl, saved: true, storage: true }),
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
