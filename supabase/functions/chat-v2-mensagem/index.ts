import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeErrorResponse(internalError: unknown, publicMessage: string, status = 500) {
  console.error("Erro interno:", internalError);
  return new Response(
    JSON.stringify({ erro: publicMessage, codigo: "INTERNAL_ERROR" }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
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
        JSON.stringify({ erro: "Token não fornecido", codigo: "AUTH_INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");
    const { data: keyId, error: keyError } = await supabase.rpc("validate_api_key", {
      key_value: apiKey,
    });

    if (keyError || !keyId) {
      return new Response(
        JSON.stringify({ erro: "Token inválido ou expirado", codigo: "AUTH_INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apenas POST é suportado
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ erro: "Método não permitido", codigo: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { telefone, tipo, conteudo, midia_url, instancia_id, contato_id } = body;

    // Resolve phone from contato_id if provided
    let phoneToUse = telefone;
    let lead = null;

    if (contato_id && !telefone) {
      console.log(`[chat-v2] Buscando lead por contato_id: ${contato_id}`);
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", contato_id)
        .maybeSingle();

      if (leadError || !leadData) {
        return new Response(
          JSON.stringify({
            erro: "Contato não encontrado",
            codigo: "LEAD_NOT_FOUND",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lead = leadData;
      phoneToUse = `${lead.country_code || "55"}${lead.phone}`;
      console.log(`[chat-v2] Telefone resolvido do contato: ${phoneToUse}`);
    }

    // Validação de campos obrigatórios
    if (!phoneToUse && !contato_id) {
      return new Response(
        JSON.stringify({
          erro: "Campo obrigatório: telefone ou contato_id",
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
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .eq("phone", localNumber)
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
      .select("labels(id, name, color)")
      .eq("lead_id", lead.id);

    const etiquetas = (leadLabels || []).map((ll: any) => ll.labels?.name).filter(Boolean);

    // Buscar responsável
    let responsavel = null;
    if (conversa.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", conversa.assigned_to)
        .single();
      if (profile) {
        responsavel = {
          id: `usr_${profile.id.slice(0, 8)}`,
          nome: profile.name,
        };
      }
    }

    // Buscar etapa do funil
    let etapaFunil = "✍ Atendimento Inicial";
    if (lead.stage_id) {
      const { data: stage } = await supabase
        .from("funnel_stages")
        .select("name")
        .eq("id", lead.stage_id)
        .single();
      if (stage) {
        etapaFunil = stage.name;
      }
    }

    // Montar resposta completa em português
    const response = {
      sucesso: true,
      request_id: `req_${crypto.randomUUID().slice(0, 8)}`,
      mensagem_id: `msg_${mensagem.id.slice(0, 8)}`,

      instancia_whatsapp: whatsappConfig
        ? {
            id: `inst_${whatsappConfig.id.slice(0, 8)}`,
            nome: whatsappConfig.name,
            telefone: formatTelefone(whatsappConfig.phone_number),
            identificador: whatsappConfig.instance_name,
          }
        : null,

      mensagem: {
        id: `msg_${mensagem.id.slice(0, 8)}`,
        tipo: mapTypeToTipo(mensagem.type),
        conteudo: mensagem.content,
        midia_url: mensagem.media_url,
        enviada_em: mensagem.created_at,
        status: "enviada",
        direcao: "saida",
        remetente: {
          tipo: "sistema",
          id: null,
          nome: "API",
        },
      },

      lead: {
        id: `lead_${lead.id.slice(0, 8)}`,
        nome: lead.name,
        whatsapp: formatTelefone(`${lead.country_code || "55"}${lead.phone}`),
        email: lead.email,
        temperatura: mapTemperature(lead.temperature),
        etapa_funil: etapaFunil,
        tipo_beneficio: lead.benefit_type,
        origem: lead.source,
        etiquetas,
        responsavel,
        criado_em: lead.created_at,
      },

      conversa: {
        id: `conv_${conversa.id.slice(0, 8)}`,
        status: mapConversationStatus(conversa.status),
        nao_lidas: conversa.unread_count || 0,
        responsavel,
        equipe: null,
        canal: {
          tipo: "whatsapp",
          nome: whatsappConfig?.instance_name || "default",
        },
        iniciada_em: conversa.created_at,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return safeErrorResponse(error, "Erro interno ao processar mensagem");
  }
});

// Helpers
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
