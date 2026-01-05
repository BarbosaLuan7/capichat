import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== NORMALIZAÇÃO ROBUSTA DE TELEFONE ==========
// Função centralizada para normalizar telefone para busca
// Suporta múltiplos formatos: com/sem código do país, DDD, etc.
interface NormalizedPhone {
  original: string;       // Número original apenas dígitos
  withoutCountry: string; // Sem código 55
  last11: string;         // Últimos 11 dígitos (DDD + 9 dígitos)
  last10: string;         // Últimos 10 dígitos (DDD + 8 dígitos)
  ddd: string;            // DDD extraído (2 dígitos)
}

function normalizePhoneForSearch(phone: string): NormalizedPhone {
  const digits = phone.replace(/\D/g, '');
  
  // Remover código 55 se presente (número com 12+ dígitos começando com 55)
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

// Helper: Return safe error response
function safeErrorResponse(
  internalError: unknown, 
  publicMessage: string, 
  status: number = 500
): Response {
  console.error('[api-lead-summary] Internal error:', internalError);
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

    console.log('[api-lead-summary] API key validated successfully');

    const url = new URL(req.url);
    const method = req.method;
    const leadIdParam = url.searchParams.get('lead_id');
    const phoneParam = url.searchParams.get('phone');

    // Validate lead_id OR phone is required for all methods
    if (!leadIdParam && !phoneParam) {
      return new Response(
        JSON.stringify({ success: false, error: 'lead_id or phone parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve lead_id from phone if needed
    let leadId = leadIdParam;
    if (phoneParam && !leadIdParam) {
      // Usar normalização robusta
      const phone = normalizePhoneForSearch(phoneParam);
      
      console.log('[api-lead-summary] Searching lead by phone:', {
        input: phoneParam,
        normalized: phone
      });
      
      // Buscar com múltiplas variações para máxima compatibilidade
      const { data: leadByPhone, error: phoneError } = await supabase
        .from('leads')
        .select('id, phone')
        .or(`phone.eq.${phone.withoutCountry},phone.eq.${phone.last11},phone.eq.${phone.last10},phone.ilike.%${phone.last10}`)
        .limit(1)
        .maybeSingle();

      if (phoneError) {
        console.error('[api-lead-summary] Error searching by phone:', phoneError);
        return safeErrorResponse(phoneError, 'Error searching lead by phone');
      }

      if (!leadByPhone) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Lead not found with this phone number',
            searched: {
              input: phoneParam,
              variations_tried: [phone.withoutCountry, phone.last11, phone.last10]
            }
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      leadId = leadByPhone.id;
      console.log('[api-lead-summary] Found lead by phone:', leadId, '| stored phone:', leadByPhone.phone);
    }

    // GET /api-lead-summary?lead_id=xxx - Get case summary
    if (method === 'GET') {
      const { data: lead, error } = await supabase
        .from('leads')
        .select('id, name, custom_fields')
        .eq('id', leadId)
        .maybeSingle();

      if (error) {
        return safeErrorResponse(error, 'Error fetching lead');
      }

      if (!lead) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const caseSummary = (lead.custom_fields as Record<string, unknown>)?.case_summary || null;

      console.log('[api-lead-summary] GET summary for lead:', leadId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            lead_id: lead.id,
            lead_name: lead.name,
            case_summary: caseSummary
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-lead-summary?lead_id=xxx - Update case summary
    if (method === 'PUT') {
      const body = await req.json();
      const summary = body.summary;

      if (summary === undefined) {
        return new Response(
          JSON.stringify({ success: false, error: 'summary field is required in body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current lead to merge custom_fields
      const { data: currentLead, error: fetchError } = await supabase
        .from('leads')
        .select('id, custom_fields')
        .eq('id', leadId)
        .maybeSingle();

      if (fetchError) {
        return safeErrorResponse(fetchError, 'Error fetching lead');
      }

      if (!currentLead) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Merge case_summary into existing custom_fields
      const existingFields = (currentLead.custom_fields as Record<string, unknown>) || {};
      const updatedFields = {
        ...existingFields,
        case_summary: summary
      };

      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update({
          custom_fields: updatedFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .select('id, name, custom_fields')
        .single();

      if (updateError) {
        return safeErrorResponse(updateError, 'Error updating lead summary');
      }

      // Dispatch webhook event for summary updated
      await supabase.from('webhook_queue').insert({
        event: 'lead.summary_updated',
        payload: {
          lead_id: leadId,
          case_summary: summary,
          action: 'updated'
        }
      });

      console.log('[api-lead-summary] PUT summary updated for lead:', leadId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            lead_id: updatedLead.id,
            lead_name: updatedLead.name,
            case_summary: (updatedLead.custom_fields as Record<string, unknown>)?.case_summary
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-lead-summary?lead_id=xxx - Remove case summary
    if (method === 'DELETE') {
      // Get current lead to remove case_summary from custom_fields
      const { data: currentLead, error: fetchError } = await supabase
        .from('leads')
        .select('id, custom_fields')
        .eq('id', leadId)
        .maybeSingle();

      if (fetchError) {
        return safeErrorResponse(fetchError, 'Error fetching lead');
      }

      if (!currentLead) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remove case_summary from custom_fields
      const existingFields = (currentLead.custom_fields as Record<string, unknown>) || {};
      const { case_summary, ...remainingFields } = existingFields;

      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update({
          custom_fields: remainingFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .select('id, name')
        .single();

      if (updateError) {
        return safeErrorResponse(updateError, 'Error removing lead summary');
      }

      // Dispatch webhook event for summary removed
      await supabase.from('webhook_queue').insert({
        event: 'lead.summary_updated',
        payload: {
          lead_id: leadId,
          case_summary: null,
          action: 'removed'
        }
      });

      console.log('[api-lead-summary] DELETE summary removed for lead:', leadId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Case summary removed successfully',
          data: {
            lead_id: updatedLead.id,
            lead_name: updatedLead.name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use GET, PUT or DELETE.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return safeErrorResponse(error, 'Internal server error');
  }
});
