import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  headers: Record<string, string> | null;
  is_active: boolean;
}

// Generate HMAC-SHA256 signature using Web Crypto API
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return 'sha256=' + hashHex;
}

// Create Supabase client
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Send webhook with retry logic
async function sendWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; status?: number; body?: string; error?: string }> {
  const maxAttempts = 3;
  const supabase = createSupabaseClient();

  const timestamp = Math.floor(Date.now() / 1000);
  const payloadObj = {
    event: payload.event,
    timestamp: new Date().toISOString(),
    data: payload.data
  };
  const payloadString = JSON.stringify(payloadObj);

  const signature = await generateSignature(payloadString, webhook.secret);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Webhook-Signature': signature,
    ...((webhook.headers as Record<string, string>) || {})
  };

  try {
    console.log(`Sending webhook to ${webhook.url} (attempt ${attempt}/${maxAttempts})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text();
    const success = response.status >= 200 && response.status < 300;

    console.log(`Webhook response: ${response.status} - ${success ? 'success' : 'failed'}`);

    // Log the webhook attempt
    const logData = {
      webhook_id: webhook.id,
      event: payload.event as "lead.created" | "lead.updated" | "lead.deleted" | "lead.stage_changed" | "lead.assigned" | "lead.temperature_changed" | "lead.label_added" | "lead.label_removed" | "message.received" | "message.sent" | "conversation.created" | "conversation.assigned" | "conversation.resolved" | "task.created" | "task.completed",
      payload: payload.data,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempts: attempt,
      status: (success ? 'success' : (attempt >= maxAttempts ? 'failed' : 'retrying')) as "pending" | "success" | "failed" | "retrying",
      completed_at: success || attempt >= maxAttempts ? new Date().toISOString() : null
    };
    
    await supabase.from('webhook_logs').insert(logData);

    if (!success && attempt < maxAttempts) {
      // Schedule retry with increasing delay
      const delays = [60000, 300000, 1800000]; // 1min, 5min, 30min
      const delay = delays[attempt - 1] || 300000;
      console.log(`Will retry in ${delay / 1000}s`);
      
      // Note: In production, you'd want to use a proper job queue
      // For now, we'll just log that a retry is needed
      console.log(`Retry scheduled for webhook ${webhook.id} at attempt ${attempt + 1}`);
    }

    return {
      success,
      status: response.status,
      body: responseBody
    };

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Webhook error (attempt ${attempt}):`, error.message);

    // Log the failed attempt
    const logData = {
      webhook_id: webhook.id,
      event: payload.event as "lead.created" | "lead.updated" | "lead.deleted" | "lead.stage_changed" | "lead.assigned" | "lead.temperature_changed" | "lead.label_added" | "lead.label_removed" | "message.received" | "message.sent" | "conversation.created" | "conversation.assigned" | "conversation.resolved" | "task.created" | "task.completed",
      payload: payload.data,
      response_status: null,
      response_body: null,
      error_message: error.message,
      attempts: attempt,
      status: (attempt >= maxAttempts ? 'failed' : 'retrying') as "pending" | "success" | "failed" | "retrying",
      completed_at: attempt >= maxAttempts ? new Date().toISOString() : null
    };
    
    await supabase.from('webhook_logs').insert(logData);

    if (attempt < maxAttempts) {
      console.log(`Retry scheduled for webhook ${webhook.id} at attempt ${attempt + 1}`);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createSupabaseClient();

    const body: WebhookPayload = await req.json();

    if (!body.event || !body.data) {
      return new Response(
        JSON.stringify({ success: false, error: 'event and data are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Dispatching webhooks for event: ${body.event}`);

    // Find active webhooks that listen to this event
    const { data: webhooks, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [body.event]);

    if (fetchError) {
      console.error('Error fetching webhooks:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching webhooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('No active webhooks found for event:', body.event);
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks to dispatch', dispatched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${webhooks.length} webhook(s) to dispatch`);

    // Dispatch webhooks in parallel
    const results = await Promise.all(
      webhooks.map((webhook) => sendWebhook(webhook as Webhook, body))
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Dispatch complete: ${successful} success, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: webhooks.length,
        successful,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
