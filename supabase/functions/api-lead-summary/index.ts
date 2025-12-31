import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Return safe error response
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

    console.log('[api-lead-summary] API key validated successfully');

    const url = new URL(req.url);
    const method = req.method;
    const leadId = url.searchParams.get('lead_id');

    // Validate lead_id is required for all methods
    if (!leadId) {
      return new Response(
        JSON.stringify({ success: false, error: 'lead_id parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
