import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== HELPER FUNCTIONS ==========

function safeErrorResponse(internalError: unknown, publicMessage: string, status = 500) {
  console.error("Erro interno:", internalError);
  return new Response(
    JSON.stringify({ erro: publicMessage, error: publicMessage, codigo: "INTERNAL_ERROR" }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Validar se é UUID válido
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Verificar se parece um telefone
function looksLikePhone(str: string): boolean {
  const digits = str.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 && /^\d+$/.test(digits);
}

// Normalização robusta de telefone
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
    ddd: withoutCountry.substring(0, 2)
  };
}

// Buscar lead por UUID ou telefone
async function resolveLeadByIdentifier(supabase: any, identifier: string): Promise<any | null> {
  if (isValidUUID(identifier)) {
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", identifier)
      .maybeSingle();
    return lead;
  }
  
  if (looksLikePhone(identifier)) {
    const phone = normalizePhoneForSearch(identifier);
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .or(`phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}%`)
      .limit(1)
      .maybeSingle();
    return lead;
  }
  
  return null;
}

// Formatar telefone
function formatTelefone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length >= 10) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

function mapTipoToType(tipo: string): string {
  const map: Record<string, string> = {
    texto: "text",
    imagem: "image",
    audio: "audio",
    video: "video",
    documento: "document",
  };
  return map[tipo] || "text";
}

function mapTypeToTipo(type: string): string {
  const map: Record<string, string> = {
    text: "texto",
    image: "imagem",
    audio: "audio",
    video: "video",
    document: "documento",
  };
  return map[type] || type;
}

function mapTemperature(temp: string): string {
  const map: Record<string, string> = {
    cold: "frio",
    warm: "morno",
    hot: "quente",
  };
  return map[temp] || temp;
}

function mapConversationStatus(status: string): string {
  const map: Record<string, string> = {
    open: "aberta",
    pending: "pendente",
    resolved: "finalizada",
  };
  return map[status] || status;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validar API Key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ erro: "Token não fornecido", error: "Missing token", codigo: "AUTH_INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");
    const { data: keyId, error: keyError } = await supabase.rpc("validate_api_key", {
      key_value: apiKey,
    });

    if (keyError || !keyId) {
      return new Response(
        JSON.stringify({ erro: "Token inválido ou expirado", error: "Invalid token", codigo: "AUTH_INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apenas POST é suportado
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ erro: "Método não permitido", error: "Method not allowed", codigo: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { telefone, tipo, conteudo, midia_url, instancia_id, contato_id } = body;

    // Resolve lead from contato_id (can be UUID or phone)
    let phoneToUse = telefone;
    let lead = null;

    if (contato_id) {
      console.log(`[chat-v2] Resolvendo contato_id: ${contato_id}`);
      
      lead = await resolveLeadByIdentifier(supabase, contato_id);
      
      if (!lead && !telefone) {
        return new Response(
          JSON.stringify({
            erro: "Contato não encontrado",
            error: "Contact not found",
            codigo: "LEAD_NOT_FOUND",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (lead) {
        phoneToUse = `${lead.country_code || "55"}${lead.phone}`;
        console.log(`[chat-v2] Lead resolvido: ${lead.id}, telefone: ${phoneToUse}`);
      }
    }

    // Validação de campos obrigatórios
    if (!phoneToUse && !contato_id) {
      return new Response(
        JSON.stringify({
          erro: "Campo obrigatório: telefone ou contato_id",
          error: "Required field: telefone or contato_id",
          codigo: "VALIDATION_ERROR",
          campos: ["telefone", "contato_id"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conteudo) {
      return new Response(
        JSON.stringify({
          erro: "Campo obrigatório: conteudo",
          error: "Required field: conteudo",
          codigo: "VALIDATION_ERROR",
          campos: ["conteudo"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalizar telefone
    const phoneClean = phoneToUse.replace(/\D/g, "");
    const countryCode = phoneClean.length > 11 ? phoneClean.slice(0, 2) : "55";
    const localNumber = phoneClean.length > 11 ? phoneClean.slice(2) : phoneClean;

    console.log(`[chat-v2] Enviando mensagem para: ${phoneClean}`);

    // Buscar ou criar lead (se não foi resolvido do contato_id)
    if (!lead) {
      const phone = normalizePhoneForSearch(phoneToUse);
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .or(`phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}%`)
        .limit(1)
        .maybeSingle();

      if (!existingLead) {
        console.log("[chat-v2] Lead não encontrado, criando novo...");
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            phone: localNumber,
            country_code: countryCode,
            name: "Novo Contato",
            source: "api",
            temperature: "cold",
            status: "active",
          })
          .select()
          .single();

        if (leadError) {
          console.error("[chat-v2] Erro ao criar lead:", leadError);
          throw leadError;
        }
        lead = newLead;
      } else {
        lead = existingLead;
      }
    }

    // Buscar ou criar conversa
    let { data: conversa } = await supabase
      .from("conversations")
      .select("*, leads(*)")
      .eq("lead_id", lead.id)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversa) {
      console.log("[chat-v2] Conversa não encontrada, criando nova...");
      const { data: newConversa, error: convError } = await supabase
        .from("conversations")
        .insert({
          lead_id: lead.id,
          status: "open",
          whatsapp_instance_id: instancia_id || null,
        })
        .select("*, leads(*)")
        .single();

      if (convError) {
        console.error("[chat-v2] Erro ao criar conversa:", convError);
        throw convError;
      }
      conversa = newConversa;
    }

    // Buscar instância WhatsApp
    let whatsappConfig = null;
    if (instancia_id) {
      const { data } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("id", instancia_id)
        .eq("is_active", true)
        .single();
      whatsappConfig = data;
    } else if (conversa.whatsapp_instance_id) {
      const { data } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("id", conversa.whatsapp_instance_id)
        .eq("is_active", true)
        .single();
      whatsappConfig = data;
    } else {
      const { data } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();
      whatsappConfig = data;
    }

    // Mapear tipo de mensagem
    const messageType = mapTipoToType(tipo || "texto");

    // Criar mensagem no banco
    const { data: mensagem, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversa.id,
        sender_type: "agent",
        type: messageType,
        content: conteudo,
        media_url: midia_url || null,
        direction: "outbound",
        status: "sent",
        source: "api",
      })
      .select()
      .single();

    if (msgError) {
      console.error("[chat-v2] Erro ao criar mensagem:", msgError);
      throw msgError;
    }

    console.log(`[chat-v2] Mensagem criada: ${mensagem.id}`);

    // Buscar etiquetas do lead
    const { data: leadLabels } = await supabase
      .from("lead_labels")
      .select("labels(id, name, color, category)")
      .eq("lead_id", lead.id);

    const etiquetas = (leadLabels || []).map((ll: any) => ({
      id: ll.labels?.id,
      nome: ll.labels?.name,
      name: ll.labels?.name,
      cor: ll.labels?.color,
      color: ll.labels?.color,
      categoria: ll.labels?.category,
      category: ll.labels?.category
    })).filter((e: any) => e.id);

    // Buscar responsável
    let responsavel = null;
    if (conversa.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", conversa.assigned_to)
        .single();
      if (profile) {
        responsavel = {
          id: profile.id,
          nome: profile.name,
          name: profile.name,
          email: profile.email
        };
      }
    }

    // Buscar etapa do funil
    let etapaFunil = null;
    if (lead.stage_id) {
      const { data: stage } = await supabase
        .from("funnel_stages")
        .select("id, name, color")
        .eq("id", lead.stage_id)
        .single();
      if (stage) {
        etapaFunil = {
          id: stage.id,
          nome: stage.name,
          name: stage.name,
          cor: stage.color,
          color: stage.color
        };
      }
    }

    // Montar resposta completa em português E inglês
    const response = {
      sucesso: true,
      success: true,
      request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
      mensagem_id: `msg_${mensagem.id.slice(0, 8)}`,
      message_id: mensagem.id,

      instancia_whatsapp: whatsappConfig
        ? {
            id: whatsappConfig.id,
            nome: whatsappConfig.name,
            telefone: formatTelefone(whatsappConfig.phone_number),
            identificador: whatsappConfig.instance_name,
            provider: whatsappConfig.provider
          }
        : null,
      whatsapp_instance: whatsappConfig
        ? {
            id: whatsappConfig.id,
            name: whatsappConfig.name,
            phone_number: whatsappConfig.phone_number,
            instance_name: whatsappConfig.instance_name,
            provider: whatsappConfig.provider
          }
        : null,

      mensagem: {
        id: mensagem.id,
        tipo: mapTypeToTipo(mensagem.type),
        type: mensagem.type,
        conteudo: mensagem.content,
        content: mensagem.content,
        midia_url: mensagem.media_url,
        media_url: mensagem.media_url,
        enviada_em: mensagem.created_at,
        sent_at: mensagem.created_at,
        status: "enviada",
        direcao: "saida",
        direction: "outbound",
        remetente: {
          tipo: "sistema",
          type: "system",
          id: null,
          nome: "API",
          name: "API"
        }
      },
      message: {
        id: mensagem.id,
        type: mensagem.type,
        content: mensagem.content,
        media_url: mensagem.media_url,
        sent_at: mensagem.created_at,
        status: "sent",
        direction: "outbound"
      },

      lead: {
        id: lead.id,
        nome: lead.name,
        name: lead.name,
        whatsapp: formatTelefone(`${lead.country_code || "55"}${lead.phone}`),
        telefone: formatTelefone(`${lead.country_code || "55"}${lead.phone}`),
        phone: lead.phone,
        email: lead.email,
        temperatura: mapTemperature(lead.temperature),
        temperature: lead.temperature,
        etapa_funil: etapaFunil,
        funnel_stage: etapaFunil,
        tipo_beneficio: lead.benefit_type,
        benefit_type: lead.benefit_type,
        origem: lead.source,
        source: lead.source,
        etiquetas,
        labels: etiquetas,
        responsavel,
        assigned_to: responsavel,
        criado_em: lead.created_at,
        created_at: lead.created_at
      },
      contato: {
        id: lead.id,
        nome: lead.name,
        whatsapp: formatTelefone(`${lead.country_code || "55"}${lead.phone}`),
        email: lead.email,
        temperatura: mapTemperature(lead.temperature),
        etapa_funil: etapaFunil,
        tipo_beneficio: lead.benefit_type,
        origem: lead.source,
        etiquetas,
        responsavel,
        criado_em: lead.created_at
      },

      conversa: {
        id: conversa.id,
        status: conversa.status,
        status_pt: mapConversationStatus(conversa.status),
        nao_lidas: conversa.unread_count || 0,
        unread_count: conversa.unread_count || 0,
        responsavel,
        assigned_to: responsavel,
        equipe: null,
        canal: {
          tipo: "whatsapp",
          type: "whatsapp",
          nome: whatsappConfig?.instance_name || "default",
          name: whatsappConfig?.instance_name || "default"
        },
        iniciada_em: conversa.created_at,
        created_at: conversa.created_at
      },
      conversation: {
        id: conversa.id,
        status: conversa.status,
        unread_count: conversa.unread_count || 0,
        assigned_to: responsavel,
        channel: {
          type: "whatsapp",
          name: whatsappConfig?.instance_name || "default"
        },
        created_at: conversa.created_at
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return safeErrorResponse(error, "Erro interno ao processar mensagem");
  }
});
