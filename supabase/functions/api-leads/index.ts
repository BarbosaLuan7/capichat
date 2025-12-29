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

    // GET /api-leads - List leads or get by phone
    if (method === 'GET') {
      const phone = url.searchParams.get('phone');
      const id = url.searchParams.get('id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      if (id) {
        // Get lead by ID
        const { data, error } = await supabase
          .from('leads')
          .select('*, funnel_stages(*), lead_labels(*, labels(*))')
          .eq('id', id)
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
          JSON.stringify({ success: true, data }),
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
        
        const normalizedPhone = phoneValidation.normalized;
        
        const { data, error } = await supabase
          .from('leads')
          .select('*, funnel_stages(*), lead_labels(*, labels(*))')
          .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${phone}%`)
          .limit(10);

        if (error) {
          return safeErrorResponse(error, 'Error searching lead by phone');
        }

        console.log('Leads found by phone:', data?.length || 0);
        return new Response(
          JSON.stringify({ success: true, data }),
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
        JSON.stringify({ success: true, data, total: count, limit, offset }),
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

      const normalizedPhone = phoneValidation.normalized;

      // Check if lead already exists with same phone
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, name, phone')
        .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${body.phone}%`)
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
        .eq('id', id)
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
        .eq('id', id)
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

      // Get lead before deletion for webhook
      const { data: leadToDelete } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
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
        .eq('id', id);

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

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    return safeErrorResponse(err, 'An unexpected error occurred');
  }
});
