import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessagePayload {
  phone: string;
  country_code?: string;
  message: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  timestamp?: string;
  external_id?: string;
  sender_name?: string;
  whatsapp_instance_id?: string;
}

// Country codes for phone parsing
const COUNTRY_CODES = [
  { code: '595', name: 'Paraguai' },
  { code: '598', name: 'Uruguai' },
  { code: '351', name: 'Portugal' },
  { code: '55', name: 'Brasil' },
  { code: '54', name: 'Argentina' },
  { code: '56', name: 'Chile' },
  { code: '57', name: 'Colômbia' },
  { code: '58', name: 'Venezuela' },
  { code: '51', name: 'Peru' },
  { code: '34', name: 'Espanha' },
  { code: '39', name: 'Itália' },
  { code: '49', name: 'Alemanha' },
  { code: '33', name: 'França' },
  { code: '44', name: 'Reino Unido' },
  { code: '1', name: 'EUA/Canadá' },
];

function parseInternationalPhone(phone: string): { countryCode: string; localNumber: string } {
  const digits = phone.replace(/\D/g, '');

  for (const { code } of COUNTRY_CODES) {
    if (digits.startsWith(code)) {
      const localNumber = digits.substring(code.length);
      if (localNumber.length >= 8) {
        return { countryCode: code, localNumber };
      }
    }
  }

  if (digits.length >= 12) {
    return {
      countryCode: digits.substring(0, digits.length - 10),
      localNumber: digits.slice(-10),
    };
  }

  return { countryCode: '55', localNumber: digits };
}

interface NormalizedPhone {
  original: string;
  withoutCountry: string;
  last11: string;
  last10: string;
  ddd: string;
}

function normalizePhoneForSearch(phone: string): NormalizedPhone {
  const digits = phone.replace(/\D/g, '');
  let withoutCountry = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    withoutCountry = digits.substring(2);
  }
  return {
    original: digits,
    withoutCountry,
    last11: digits.slice(-11),
    last10: digits.slice(-10),
    ddd: withoutCountry.substring(0, 2),
  };
}

function validatePhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 10) {
    return { valid: false, normalized, error: 'Phone number too short (min 10 digits)' };
  }
  if (normalized.length > 15) {
    return { valid: false, normalized, error: 'Phone number too long (max 15 digits)' };
  }
  return { valid: true, normalized };
}

function safeErrorResponse(
  internalError: unknown,
  publicMessage: string,
  status: number = 500
): Response {
  console.error('Internal error:', internalError);
  return new Response(
    JSON.stringify({ success: false, sucesso: false, error: publicMessage, erro: publicMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Format phone for display
function formatTelefone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length >= 10) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

// Map temperature
function mapTemperature(temp: string): string {
  const map: Record<string, string> = { cold: 'frio', warm: 'morno', hot: 'quente' };
  return map[temp] || temp;
}

// Map conversation status
function mapConversationStatus(status: string): string {
  const map: Record<string, string> = {
    open: 'aberta',
    pending: 'pendente',
    resolved: 'finalizada',
  };
  return map[status] || status;
}

// Map message type
function mapTypeToTipo(type: string): string {
  const map: Record<string, string> = {
    text: 'texto',
    image: 'imagem',
    audio: 'audio',
    video: 'video',
    document: 'documento',
  };
  return map[type] || type;
}

// Gera preview do conteúdo da mensagem para exibição na lista
function getMessagePreview(content: string, type: string): string {
  switch (type) {
    case 'image':
      return '📷 Imagem';
    case 'audio':
      return '🎵 Áudio';
    case 'video':
      return '🎬 Vídeo';
    case 'document':
      return '📄 Documento';
    case 'sticker':
      return '🏷️ Figurinha';
    default:
      return content?.substring(0, 100) || '';
  }
}

// Get full lead data with labels, funnel stage, and assigned user
async function getLeadFullData(supabase: any, leadId: string) {
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();

  if (!lead) return null;

  // Get labels
  const { data: leadLabels } = await supabase
    .from('lead_labels')
    .select('labels(id, name, color, category)')
    .eq('lead_id', leadId);

  const etiquetas = (leadLabels || [])
    .map((ll: any) => ({
      id: ll.labels?.id,
      nome: ll.labels?.name,
      name: ll.labels?.name,
      cor: ll.labels?.color,
      color: ll.labels?.color,
      categoria: ll.labels?.category,
      category: ll.labels?.category,
    }))
    .filter((e: any) => e.id);

  // Get funnel stage
  let etapaFunil = null;
  if (lead.stage_id) {
    const { data: stage } = await supabase
      .from('funnel_stages')
      .select('id, name, color')
      .eq('id', lead.stage_id)
      .single();
    if (stage) {
      etapaFunil = {
        id: stage.id,
        nome: stage.name,
        name: stage.name,
        cor: stage.color,
        color: stage.color,
      };
    }
  }

  // Get assigned user
  let responsavel = null;
  if (lead.assigned_to) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', lead.assigned_to)
      .single();
    if (profile) {
      responsavel = {
        id: profile.id,
        nome: profile.name,
        name: profile.name,
        email: profile.email,
      };
    }
  }

  return {
    id: lead.id,
    nome: lead.name,
    name: lead.name,
    telefone: formatTelefone(`${lead.country_code || '55'}${lead.phone}`),
    phone: lead.phone,
    email: lead.email,
    cpf: lead.cpf,
    temperatura: mapTemperature(lead.temperature),
    temperature: lead.temperature,
    etapa_funil: etapaFunil,
    funnel_stage: etapaFunil,
    etiquetas,
    labels: etiquetas,
    responsavel,
    assigned_to: responsavel,
    origem: lead.source,
    source: lead.source,
    tipo_beneficio: lead.benefit_type,
    benefit_type: lead.benefit_type,
    avatar_url: lead.avatar_url,
    is_new: false,
    criado_em: lead.created_at,
    created_at: lead.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        sucesso: false,
        error: 'Method not allowed',
        erro: 'Método não permitido',
      }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: 'Missing or invalid Authorization header',
          erro: 'Header de autorização ausente ou inválido',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (apiKeyError || !apiKeyId) {
      console.error('Invalid API key');
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: 'Invalid API key',
          erro: 'API key inválida',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('API key validated successfully');

    const body: MessagePayload = await req.json();

    // Validate required fields
    if (!body.phone || !body.message) {
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: 'phone and message are required',
          erro: 'telefone e mensagem são obrigatórios',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone format
    const phoneValidation = validatePhone(body.phone);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          sucesso: false,
          error: phoneValidation.error,
          erro: phoneValidation.error,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received message from phone');

    const phoneNorm = normalizePhoneForSearch(body.phone);
    console.log('[api-messages-receive] Buscando lead:', phoneNorm);

    const formatPhoneForDisplay = (phone: string): string => {
      if (phone.length === 11) {
        return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
      }
      if (phone.length === 10) {
        return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
      }
      return phone;
    };

    // Find or create lead
    let lead;
    let isNewLead = false;
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .or(
        `phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`
      )
      .maybeSingle();

    if (existingLead) {
      lead = existingLead;
      console.log('Found existing lead');

      // Update lead
      if (body.sender_name && !existingLead.whatsapp_name) {
        await supabase
          .from('leads')
          .update({
            whatsapp_name: body.sender_name,
            last_interaction_at: new Date().toISOString(),
          })
          .eq('id', lead.id);
      } else {
        await supabase
          .from('leads')
          .update({ last_interaction_at: new Date().toISOString() })
          .eq('id', lead.id);
      }
    } else {
      isNewLead = true;
      const phoneData = body.country_code
        ? { countryCode: body.country_code, localNumber: phoneNorm.withoutCountry }
        : parseInternationalPhone(phoneValidation.normalized);

      const { data: firstStage } = await supabase
        .from('funnel_stages')
        .select('id')
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: newLead, error: createLeadError } = await supabase
        .from('leads')
        .insert({
          name: body.sender_name || `Lead ${formatPhoneForDisplay(phoneData.localNumber)}`,
          phone: phoneData.localNumber,
          country_code: phoneData.countryCode,
          whatsapp_name: body.sender_name,
          source: 'whatsapp',
          temperature: 'warm',
          stage_id: firstStage?.id,
          status: 'active',
          last_interaction_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (createLeadError) {
        return safeErrorResponse(createLeadError, 'Error creating lead');
      }

      lead = newLead;
      console.log('Created new lead');

      // Dispatch webhook
      try {
        await supabase.functions.invoke('dispatch-webhook', {
          body: { event: 'lead.created', data: { lead: newLead } },
        });
      } catch (webhookError) {
        console.error('Error dispatching lead.created webhook:', webhookError);
      }
    }

    // Find or create conversation
    let conversation;
    let isNewConversation = false;
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
      console.log('Found existing conversation');

      const messageType = body.type || 'text';
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_content: getMessagePreview(body.message, messageType),
          unread_count: (conversation.unread_count || 0) + 1,
          status: 'open',
        })
        .eq('id', conversation.id);
    } else {
      isNewConversation = true;
      const messageType = body.type || 'text';
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
          last_message_at: new Date().toISOString(),
          last_message_content: getMessagePreview(body.message, messageType),
          unread_count: 1,
          whatsapp_instance_id: body.whatsapp_instance_id || null,
        })
        .select('*')
        .single();

      if (createConvError) {
        return safeErrorResponse(createConvError, 'Error creating conversation');
      }

      conversation = newConversation;
      console.log('Created new conversation');

      try {
        await supabase.functions.invoke('dispatch-webhook', {
          body: { event: 'conversation.created', data: { conversation: newConversation, lead } },
        });
      } catch (webhookError) {
        console.error('Error dispatching conversation.created webhook:', webhookError);
      }
    }

    // Create message
    const messageType = body.type || 'text';
    const { data: message, error: createMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        lead_id: lead.id,
        sender_id: lead.id,
        sender_type: 'lead',
        content: body.message,
        type: messageType,
        media_url: body.media_url,
        direction: 'inbound',
        status: 'delivered',
        external_id: body.external_id,
        created_at: body.timestamp || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createMsgError) {
      return safeErrorResponse(createMsgError, 'Error creating message');
    }

    console.log('Message created successfully');

    // Dispatch webhook
    try {
      await supabase.functions.invoke('dispatch-webhook', {
        body: { event: 'message.received', data: { message, lead, conversation } },
      });
    } catch (webhookError) {
      console.error('Error dispatching message.received webhook:', webhookError);
    }

    // Get full lead data
    const leadFullData = await getLeadFullData(supabase, lead.id);
    if (leadFullData) {
      leadFullData.is_new = isNewLead;
    }

    // Get WhatsApp instance data
    let instanciaWhatsapp = null;
    if (conversation.whatsapp_instance_id) {
      const { data: whatsapp } = await supabase
        .from('whatsapp_config')
        .select('id, name, phone_number, instance_name, provider')
        .eq('id', conversation.whatsapp_instance_id)
        .single();
      if (whatsapp) {
        instanciaWhatsapp = {
          id: whatsapp.id,
          nome: whatsapp.name,
          name: whatsapp.name,
          telefone: formatTelefone(whatsapp.phone_number),
          phone_number: whatsapp.phone_number,
          identificador: whatsapp.instance_name,
          instance_name: whatsapp.instance_name,
          provider: whatsapp.provider,
        };
      }
    }

    // Build rich response
    const response = {
      sucesso: true,
      success: true,
      request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
      mensagem_id: message.id,
      message_id: message.id,

      instancia_whatsapp: instanciaWhatsapp,
      whatsapp_instance: instanciaWhatsapp,

      mensagem: {
        id: message.id,
        tipo: mapTypeToTipo(message.type),
        type: message.type,
        conteudo: message.content,
        content: message.content,
        midia_url: message.media_url,
        media_url: message.media_url,
        recebida_em: message.created_at,
        received_at: message.created_at,
        status: 'entregue',
        direcao: 'entrada',
        direction: 'inbound',
        external_id: message.external_id,
        remetente: {
          tipo: 'lead',
          type: 'lead',
          id: lead.id,
          nome: lead.name,
          name: lead.name,
        },
      },
      message: {
        id: message.id,
        type: message.type,
        content: message.content,
        media_url: message.media_url,
        received_at: message.created_at,
        status: 'delivered',
        direction: 'inbound',
        external_id: message.external_id,
      },

      lead: leadFullData,
      contato: leadFullData,

      conversa: {
        id: conversation.id,
        status: conversation.status,
        status_pt: mapConversationStatus(conversation.status),
        nao_lidas: (conversation.unread_count || 0) + 1,
        unread_count: (conversation.unread_count || 0) + 1,
        is_new: isNewConversation,
        nova: isNewConversation,
        responsavel: leadFullData?.responsavel || null,
        assigned_to: leadFullData?.assigned_to || null,
        ultima_mensagem_em: message.created_at,
        last_message_at: message.created_at,
        criada_em: conversation.created_at,
        created_at: conversation.created_at,
      },
      conversation: {
        id: conversation.id,
        status: conversation.status,
        unread_count: (conversation.unread_count || 0) + 1,
        is_new: isNewConversation,
        assigned_to: leadFullData?.assigned_to || null,
        last_message_at: message.created_at,
        created_at: conversation.created_at,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'An unexpected error occurred');
  }
});
