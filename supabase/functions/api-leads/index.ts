import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadPayload {
  name: string;
  phone: string;
  country_code?: string; // Código do país (55, 1, 595, etc)
  email?: string;
  cpf?: string;
  birth_date?: string;
  benefit_type?: string;
  nit_pis?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  source?: string;
  stage_id?: string;
  assigned_to?: string;
  temperature?: 'cold' | 'warm' | 'hot';
  custom_fields?: Record<string, unknown>;
  tenant_id?: string; // ID do tenant para multi-tenant
}

// Códigos de países conhecidos (ordenados por tamanho decrescente para match correto)
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

interface ParsedPhone {
  countryCode: string;
  localNumber: string;
}

// Detecta o código do país a partir de um número completo
function parseInternationalPhone(phone: string): ParsedPhone {
  const digits = phone.replace(/\D/g, '');
  
  // Tentar detectar código do país conhecido
  for (const { code } of COUNTRY_CODES) {
    if (digits.startsWith(code)) {
      const localNumber = digits.substring(code.length);
      if (localNumber.length >= 8) {
        return { countryCode: code, localNumber };
      }
    }
  }
  
  // Fallback: assumir Brasil (55) se não detectar
  if (digits.length >= 12) {
    return {
      countryCode: digits.substring(0, digits.length - 10),
      localNumber: digits.slice(-10),
    };
  }
  
  return { countryCode: '55', localNumber: digits };
}

// Helper: Normalize phone - extrai número local e código do país
function normalizePhoneNumber(phone: string, providedCountryCode?: string): { localNumber: string; countryCode: string } {
  // Se country_code foi fornecido, usar diretamente
  if (providedCountryCode) {
    return {
      localNumber: phone.replace(/\D/g, ''),
      countryCode: providedCountryCode,
    };
  }
  
  // Tentar detectar automaticamente
  return parseInternationalPhone(phone);
}

// ========== NORMALIZAÇÃO ROBUSTA DE TELEFONE ==========
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

// Helper: Validate phone number format
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

// Helper: Validar se é UUID válido
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper: Verificar se parece um telefone
function looksLikePhone(str: string): boolean {
  const digits = str.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 && /^\d+$/.test(digits);
}

// Helper: Return safe error response (don't expose internal details)
function safeErrorResponse(
  internalError: unknown, 
  publicMessage: string, 
  status: number = 500
): Response {
  console.error('Internal error:', internalError);
  return new Response(
    JSON.stringify({ success: false, error: publicMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    // Validate API key using database function
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey
    });

    if (apiKeyError || !apiKeyId) {
      console.error('Invalid API key');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('API key validated successfully');

    const url = new URL(req.url);
    const method = req.method;
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    // GET /api-leads - List leads or get by phone
    if (method === 'GET') {
      const phone = url.searchParams.get('phone');
      const id = url.searchParams.get('id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      if (id) {
        let resolvedId = id;
        
        // Auto-detect: se id parece um telefone (não é UUID), tratar como busca por telefone
        if (!isValidUUID(id) && looksLikePhone(id)) {
          console.log('[api-leads] GET id looks like a phone number, treating as phone search:', id);
          
          const phoneNorm = normalizePhoneForSearch(id);
          const { data: leadByPhone, error: phoneError } = await supabase
            .from('leads')
            .select('id')
            .or(`phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`)
            .limit(1)
            .maybeSingle();

          if (phoneError) {
            return safeErrorResponse(phoneError, 'Error searching lead by phone');
          }

          if (!leadByPhone) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Lead not found with this phone number',
                hint: 'You passed a phone number in id parameter. Use ?phone=XXXX or a valid UUID for id.',
                searched: { input: id, variations_tried: [phoneNorm.withoutCountry, phoneNorm.last11, phoneNorm.last10] }
              }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          resolvedId = leadByPhone.id;
          console.log('[api-leads] Found lead by phone (auto-detected):', resolvedId);
          
        } else if (!isValidUUID(id)) {
          // Não é UUID válido nem parece telefone
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Invalid id format',
              hint: 'id must be a valid UUID. For phone search, use ?phone=XXXX or pass a valid phone number.'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get lead by resolved ID
        const { data, error } = await supabase
          .from('leads')
          .select('*, funnel_stages(*), lead_labels(*, labels(*))')
          .eq('id', resolvedId)
          .maybeSingle();

        if (error) {
          return safeErrorResponse(error, 'Error fetching lead');
        }

        if (!data) {
          return new Response(
            JSON.stringify({ success: false, error: 'Lead not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Lead found by ID');
        return new Response(
          JSON.stringify({ success: true, dados: data, data }), // PT + EN
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (phone) {
        // Validate phone format
        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: phoneValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Usar normalização robusta para buscar
        const phoneNorm = normalizePhoneForSearch(phone);
        console.log('[api-leads] Buscando por telefone:', phoneNorm);
        
        const { data, error } = await supabase
          .from('leads')
          .select('*, funnel_stages(*), lead_labels(*, labels(*))')
          .or(`phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`)
          .limit(10);

        if (error) {
          return safeErrorResponse(error, 'Error searching lead by phone');
        }

        console.log('Leads found by phone:', data?.length || 0);
        return new Response(
          JSON.stringify({ success: true, dados: data, data }), // PT + EN
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List all leads with pagination
      const { data, error, count } = await supabase
        .from('leads')
        .select('*, funnel_stages(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return safeErrorResponse(error, 'Error listing leads');
      }

      console.log('Leads listed:', data?.length || 0);
      return new Response(
        JSON.stringify({ 
          success: true, 
          dados: data, // PT format
          data, // Retrocompatibilidade EN
          total: count, 
          limit, 
          offset 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-leads - Create lead
    if (method === 'POST') {
      const body: LeadPayload = await req.json();

      // Validate required fields
      if (!body.name || !body.phone) {
        return new Response(
          JSON.stringify({ success: false, error: 'name and phone are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate name length
      if (body.name.trim().length < 2) {
        return new Response(
          JSON.stringify({ success: false, error: 'name must have at least 2 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate phone format
      const phoneValidation = validatePhone(body.phone);
      if (!phoneValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: phoneValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Usar normalização robusta para verificar duplicidade
      const phoneNorm = normalizePhoneForSearch(body.phone);
      console.log('[api-leads] Verificando duplicidade:', phoneNorm);

      // Check if lead already exists with same phone
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, name, phone')
        .or(`phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`)
        .maybeSingle();

      if (existingLead) {
        console.log('Lead already exists');
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: existingLead, 
            message: 'Lead already exists',
            is_duplicate: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get first funnel stage if not provided
      let stageId = body.stage_id;
      if (!stageId) {
        const { data: firstStage } = await supabase
          .from('funnel_stages')
          .select('id')
          .order('order', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        stageId = firstStage?.id;
      }

      // Create lead - normalizar telefone separando código do país
      const phoneData = normalizePhoneNumber(body.phone, body.country_code);
      console.log('[api-leads] Normalizando telefone:', body.phone, '->', phoneData);
      
      const leadData = {
        name: body.name.trim(),
        phone: phoneData.localNumber, // Número local sem código do país
        country_code: phoneData.countryCode, // Código do país separado
        email: body.email,
        cpf: body.cpf,
        birth_date: body.birth_date,
        benefit_type: body.benefit_type,
        nit_pis: body.nit_pis,
        source: body.utm_source || body.source || 'api',
        utm_medium: body.utm_medium,
        stage_id: stageId,
        assigned_to: body.assigned_to,
        temperature: body.temperature || 'cold',
        custom_fields: body.custom_fields || {},
        status: 'active',
        tenant_id: body.tenant_id || null, // Propagar tenant_id se fornecido
      };

      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert(leadData)
        .select('*')
        .single();

      if (createError) {
        return safeErrorResponse(createError, 'Error creating lead');
      }

      console.log('Lead created successfully');

      // Dispatch webhook for lead.created
      try {
        await supabase.functions.invoke('dispatch-webhook', {
          body: {
            event: 'lead.created',
            data: {
              lead: newLead
            }
          }
        });
      } catch (webhookError) {
        console.error('Error dispatching webhook:', webhookError);
        // Don't fail the request if webhook fails
      }

      return new Response(
        JSON.stringify({ success: true, data: newLead }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-leads - Update lead
    if (method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: 'id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let resolvedId = id;
      
      // Auto-detect: se id parece um telefone (não é UUID), tratar como busca por telefone
      if (!isValidUUID(id) && looksLikePhone(id)) {
        console.log('[api-leads] PUT id looks like a phone number, treating as phone search:', id);
        
        const phoneNorm = normalizePhoneForSearch(id);
        const { data: leadByPhone, error: phoneError } = await supabase
          .from('leads')
          .select('id')
          .or(`phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`)
          .limit(1)
          .maybeSingle();

        if (phoneError) {
          return safeErrorResponse(phoneError, 'Error searching lead by phone');
        }

        if (!leadByPhone) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Lead not found with this phone number',
              hint: 'You passed a phone number in id parameter. Use ?phone=XXXX or a valid UUID for id.',
              searched: { input: id, variations_tried: [phoneNorm.withoutCountry, phoneNorm.last11, phoneNorm.last10] }
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        resolvedId = leadByPhone.id;
        console.log('[api-leads] Found lead by phone (auto-detected) for update:', resolvedId);
        
      } else if (!isValidUUID(id)) {
        // Não é UUID válido nem parece telefone
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid id format',
            hint: 'id must be a valid UUID. For phone search, use ?phone=XXXX or pass a valid phone number.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();

      // Validate phone if provided
      if (body.phone) {
        const phoneValidation = validatePhone(body.phone);
        if (!phoneValidation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: phoneValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Get current lead state for webhook comparison
      const { data: currentLead } = await supabase
        .from('leads')
        .select('*, funnel_stages(*)')
        .eq('id', resolvedId)
        .maybeSingle();

      if (!currentLead) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update lead
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update({
          ...body,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedId)
        .select('*, funnel_stages(*)')
        .single();

      if (updateError) {
        return safeErrorResponse(updateError, 'Error updating lead');
      }

      console.log('Lead updated successfully');

      // Dispatch webhooks based on what changed
      try {
        // General update webhook
        await supabase.functions.invoke('dispatch-webhook', {
          body: {
            event: 'lead.updated',
            data: {
              lead: updatedLead,
              previous: currentLead
            }
          }
        });

        // Stage change webhook
        if (body.stage_id && body.stage_id !== currentLead.stage_id) {
          await supabase.functions.invoke('dispatch-webhook', {
            body: {
              event: 'lead.stage_changed',
              data: {
                lead: updatedLead,
                previous_stage: currentLead.funnel_stages,
                new_stage: updatedLead.funnel_stages
              }
            }
          });
        }

        // Temperature change webhook
        if (body.temperature && body.temperature !== currentLead.temperature) {
          await supabase.functions.invoke('dispatch-webhook', {
            body: {
              event: 'lead.temperature_changed',
              data: {
                lead: updatedLead,
                previous_temperature: currentLead.temperature,
                new_temperature: body.temperature
              }
            }
          });
        }

        // Assignment change webhook
        if (body.assigned_to && body.assigned_to !== currentLead.assigned_to) {
          await supabase.functions.invoke('dispatch-webhook', {
            body: {
              event: 'lead.assigned',
              data: {
                lead: updatedLead,
                previous_assigned_to: currentLead.assigned_to,
                new_assigned_to: body.assigned_to
              }
            }
          });
        }
      } catch (webhookError) {
        console.error('Error dispatching webhooks:', webhookError);
      }

      return new Response(
        JSON.stringify({ success: true, data: updatedLead }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-leads - Delete lead
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: 'id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let resolvedId = id;
      
      // Auto-detect: se id parece um telefone (não é UUID), tratar como busca por telefone
      if (!isValidUUID(id) && looksLikePhone(id)) {
        console.log('[api-leads] DELETE id looks like a phone number, treating as phone search:', id);
        
        const phoneNorm = normalizePhoneForSearch(id);
        const { data: leadByPhone, error: phoneError } = await supabase
          .from('leads')
          .select('id')
          .or(`phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`)
          .limit(1)
          .maybeSingle();

        if (phoneError) {
          return safeErrorResponse(phoneError, 'Error searching lead by phone');
        }

        if (!leadByPhone) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Lead not found with this phone number',
              hint: 'You passed a phone number in id parameter. Use ?phone=XXXX or a valid UUID for id.',
              searched: { input: id, variations_tried: [phoneNorm.withoutCountry, phoneNorm.last11, phoneNorm.last10] }
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        resolvedId = leadByPhone.id;
        console.log('[api-leads] Found lead by phone (auto-detected) for delete:', resolvedId);
        
      } else if (!isValidUUID(id)) {
        // Não é UUID válido nem parece telefone
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid id format',
            hint: 'id must be a valid UUID. For phone search, use ?phone=XXXX or pass a valid phone number.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get lead before deletion for webhook
      const { data: leadToDelete } = await supabase
        .from('leads')
        .select('*')
        .eq('id', resolvedId)
        .maybeSingle();

      if (!leadToDelete) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('id', resolvedId);

      if (deleteError) {
        return safeErrorResponse(deleteError, 'Error deleting lead');
      }

      console.log('Lead deleted successfully');

      // Dispatch webhook for lead.deleted
      try {
        await supabase.functions.invoke('dispatch-webhook', {
          body: {
            event: 'lead.deleted',
            data: {
              lead: leadToDelete
            }
          }
        });
      } catch (webhookError) {
        console.error('Error dispatching webhook:', webhookError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Lead deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-leads?action=filtro - Advanced filter search
    if (method === 'POST' && action === 'filtro') {
      const body = await req.json();
      const etiquetas = body.etiquetas || [];
      const campos = body.campos || {};
      const periodo = body.periodo || {};
      const temperatura = body.temperatura || body.temperature;
      const etapaFunil = body.etapa_funil || body.stage_id;
      const responsavel = body.responsavel || body.assigned_to;
      const tenantId = body.tenant_id;
      const pagina = body.pagina || body.page || 1;
      const porPagina = body.por_pagina || body.page_size || 50;
      const offset = (pagina - 1) * porPagina;

      console.log('[api-leads] Filtro avançado:', { etiquetas, campos, periodo, temperatura, etapaFunil, responsavel });

      let query = supabase
        .from('leads')
        .select('*, funnel_stages(*), lead_labels(*, labels(*))', { count: 'exact' });

      // Filter by tenant
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      // Filter by labels (leads that have ALL specified labels)
      if (etiquetas.length > 0) {
        const { data: leadIdsWithLabels } = await supabase
          .from('lead_labels')
          .select('lead_id')
          .in('label_id', etiquetas);

        if (leadIdsWithLabels && leadIdsWithLabels.length > 0) {
          const leadIds = [...new Set(leadIdsWithLabels.map(l => l.lead_id))];
          query = query.in('id', leadIds);
        } else {
          // No leads with these labels - return empty
          return new Response(
            JSON.stringify({
              dados: [],
              paginacao: { pagina, por_pagina: porPagina, total: 0, total_paginas: 0 }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Filter by custom fields
      if (Object.keys(campos).length > 0) {
        for (const [key, value] of Object.entries(campos)) {
          query = query.contains('custom_fields', { [key]: value });
        }
      }

      // Filter by period
      if (periodo.inicio) {
        query = query.gte('created_at', periodo.inicio);
      }
      if (periodo.fim) {
        query = query.lte('created_at', periodo.fim);
      }

      // Filter by temperature
      if (temperatura) {
        query = query.eq('temperature', temperatura);
      }

      // Filter by funnel stage
      if (etapaFunil) {
        // Handle prefixed stage IDs
        const stageId = etapaFunil.startsWith('etapa_') 
          ? etapaFunil.replace('etapa_', '') 
          : etapaFunil;
        query = query.ilike('stage_id', `${stageId}%`);
      }

      // Filter by assigned user
      if (responsavel) {
        const userId = responsavel.startsWith('usr_') 
          ? responsavel.replace('usr_', '') 
          : responsavel;
        query = query.ilike('assigned_to', `${userId}%`);
      }

      // Apply pagination
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + porPagina - 1);

      if (error) {
        return safeErrorResponse(error, 'Error filtering leads');
      }

      const totalPaginas = Math.ceil((count || 0) / porPagina);

      console.log('[api-leads] Filtro retornou:', data?.length || 0, 'leads');

      return new Response(
        JSON.stringify({
          dados: data || [],
          paginacao: {
            pagina,
            por_pagina: porPagina,
            total: count || 0,
            total_paginas: totalPaginas
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-leads?id=xxx&action=etiquetas - Update lead labels
    if (method === 'POST' && id && action === 'etiquetas') {
      const body = await req.json();
      const adicionar = body.adicionar || body.add || [];
      const remover = body.remover || body.remove || [];

      // Add labels
      if (adicionar.length > 0) {
        const inserts = adicionar.map((labelId: string) => ({
          lead_id: id,
          label_id: labelId
        }));
        
        await supabase
          .from('lead_labels')
          .upsert(inserts, { onConflict: 'lead_id,label_id' });
      }

      // Remove labels
      if (remover.length > 0) {
        await supabase
          .from('lead_labels')
          .delete()
          .eq('lead_id', id)
          .in('label_id', remover);
      }

      console.log('Lead labels updated:', id);

      return new Response(
        JSON.stringify({ success: true, message: 'Labels updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-leads?action=lote - Batch create leads
    if (method === 'POST' && url.searchParams.get('action') === 'lote') {
      const body = await req.json();
      const contatos = body.contatos || body.leads || [];

      if (!Array.isArray(contatos) || contatos.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'contatos array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Limit batch size
      if (contatos.length > 100) {
        return new Response(
          JSON.stringify({ success: false, error: 'Maximum 100 leads per batch' }),
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

      const results = {
        criados: 0,
        duplicados: 0,
        erros: [] as { phone: string; error: string }[]
      };

      for (const contato of contatos) {
        if (!contato.name || !contato.phone) {
          results.erros.push({ phone: contato.phone || 'N/A', error: 'name and phone required' });
          continue;
        }

        const phoneValidation = validatePhone(contato.phone);
        if (!phoneValidation.valid) {
          results.erros.push({ phone: contato.phone, error: phoneValidation.error || 'Invalid phone' });
          continue;
        }

        // Usar normalização robusta para verificar duplicidade no batch
        const phoneNorm = normalizePhoneForSearch(contato.phone);
        
        // Check for duplicate
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .or(`phone.eq.${phoneNorm.withoutCountry},phone.eq.${phoneNorm.last11},phone.eq.${phoneNorm.last10},phone.ilike.%${phoneNorm.last10}%`)
          .maybeSingle();

        if (existing) {
          results.duplicados++;
          continue;
        }

        const phoneData = normalizePhoneNumber(contato.phone, contato.country_code);
        
        const { error: insertError } = await supabase
          .from('leads')
          .insert({
            name: contato.name.trim(),
            phone: phoneData.localNumber,
            country_code: phoneData.countryCode,
            email: contato.email,
            source: contato.source || 'api_batch',
            temperature: contato.temperature || 'cold',
            stage_id: firstStage?.id,
            status: 'active'
          });

        if (insertError) {
          results.erros.push({ phone: contato.phone, error: 'Insert error' });
        } else {
          results.criados++;
        }
      }

      console.log('Batch create completed:', results);

      return new Response(
        JSON.stringify({
          success: true,
          criados: results.criados,
          duplicados: results.duplicados,
          erros: results.erros
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    return safeErrorResponse(err, 'An unexpected error occurred');
  }
});
