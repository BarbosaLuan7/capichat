import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContatoPayload {
  nome: string;
  telefone: string;
  codigo_pais?: string;
  email?: string;
  cpf?: string;
  data_nascimento?: string;
  tipo_beneficio?: string;
  nit_pis?: string;
  origem?: string;
  etapa_id?: string;
  responsavel_id?: string;
  temperatura?: 'frio' | 'morno' | 'quente';
  campos_personalizados?: Record<string, unknown>;
  tenant_id?: string;
  etiquetas?: string[];
}

interface ResultadoContato {
  indice: number;
  sucesso: boolean;
  id?: string;
  erro?: string;
  duplicado?: boolean;
}

const temperatureMap: Record<string, string> = {
  frio: 'cold',
  morno: 'warm',
  quente: 'hot',
};

function validatePhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 10) {
    return { valid: false, normalized, error: 'Telefone muito curto (mín 10 dígitos)' };
  }
  if (normalized.length > 15) {
    return { valid: false, normalized, error: 'Telefone muito longo (máx 15 dígitos)' };
  }
  return { valid: true, normalized };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Header Authorization ausente ou inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (apiKeyError || !apiKeyId) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'API key inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Método não permitido. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const contatos: ContatoPayload[] = body.contatos;

    if (!Array.isArray(contatos) || contatos.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Array "contatos" é obrigatório e não pode estar vazio',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (contatos.length > 100) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Máximo de 100 contatos por requisição' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get first funnel stage
    const { data: firstStage } = await supabase
      .from('funnel_stages')
      .select('id')
      .order('order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const resultados: ResultadoContato[] = [];
    let criados = 0;
    let duplicados = 0;
    let erros = 0;

    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];

      // Validate required fields
      if (!contato.nome || !contato.telefone) {
        resultados.push({
          indice: i,
          sucesso: false,
          erro: 'nome e telefone são obrigatórios',
        });
        erros++;
        continue;
      }

      // Validate phone
      const phoneValidation = validatePhone(contato.telefone);
      if (!phoneValidation.valid) {
        resultados.push({
          indice: i,
          sucesso: false,
          erro: phoneValidation.error,
        });
        erros++;
        continue;
      }

      // Check for duplicates
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .ilike('phone', `%${phoneValidation.normalized}%`)
        .maybeSingle();

      if (existing) {
        resultados.push({
          indice: i,
          sucesso: true,
          id: existing.id,
          duplicado: true,
        });
        duplicados++;
        continue;
      }

      // Create lead
      const leadData = {
        name: contato.nome.trim(),
        phone: phoneValidation.normalized,
        country_code: contato.codigo_pais || '55',
        email: contato.email,
        cpf: contato.cpf,
        birth_date: contato.data_nascimento,
        benefit_type: contato.tipo_beneficio,
        nit_pis: contato.nit_pis,
        source: contato.origem || 'api-lote',
        stage_id: contato.etapa_id || firstStage?.id,
        assigned_to: contato.responsavel_id,
        temperature: temperatureMap[contato.temperatura || ''] || 'cold',
        custom_fields: contato.campos_personalizados || {},
        status: 'active' as const,
        tenant_id: contato.tenant_id || null,
      };

      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert(leadData)
        .select('id')
        .single();

      if (createError) {
        resultados.push({
          indice: i,
          sucesso: false,
          erro: 'Erro ao criar contato',
        });
        erros++;
        continue;
      }

      // Add labels if provided
      if (contato.etiquetas && contato.etiquetas.length > 0 && newLead) {
        const labelInserts = contato.etiquetas.map((labelId) => ({
          lead_id: newLead.id,
          label_id: labelId,
        }));
        await supabase.from('lead_labels').insert(labelInserts);
      }

      resultados.push({
        indice: i,
        sucesso: true,
        id: newLead.id,
      });
      criados++;
    }

    console.log(
      `[api-contatos-lote] Processados: ${contatos.length}, Criados: ${criados}, Duplicados: ${duplicados}, Erros: ${erros}`
    );

    return new Response(
      JSON.stringify({
        sucesso: true,
        resumo: {
          total: contatos.length,
          criados,
          duplicados,
          erros,
        },
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[api-contatos-lote] Error:', error);
    return new Response(JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
