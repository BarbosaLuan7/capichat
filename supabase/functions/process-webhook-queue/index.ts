import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookQueueItem {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  headers: Record<string, string> | null;
  is_active: boolean;
}

// Generate HMAC-SHA256 signature
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Send webhook with retry logic
async function sendWebhook(
  supabase: SupabaseClient,
  webhook: Webhook,
  queueItem: WebhookQueueItem,
  attempt: number = 1
): Promise<{ success: boolean; status?: number; body?: string; error?: string }> {
  const maxAttempts = 3;
  const payloadString = JSON.stringify(queueItem.payload);
  
  try {
    const signature = await generateSignature(payloadString, webhook.secret);
    const timestamp = Date.now().toString();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Event': queueItem.event,
      ...(webhook.headers || {}),
    };
    
    console.log(`[Webhook] Sending ${queueItem.event} to ${webhook.url} (attempt ${attempt}/${maxAttempts})`);
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
    });
    
    const responseBody = await response.text();
    const success = response.ok;
    
    // Log the attempt
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event: queueItem.event,
      payload: queueItem.payload,
      status: success ? 'success' : (attempt < maxAttempts ? 'retrying' : 'failed'),
      response_status: response.status,
      response_body: responseBody.substring(0, 10000),
      attempts: attempt,
      completed_at: success ? new Date().toISOString() : null,
      error_message: success ? null : `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
    });
    
    if (!success && attempt < maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Webhook] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(supabase, webhook, queueItem, attempt + 1);
    }
    
    return { success, status: response.status, body: responseBody };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] Error sending to ${webhook.url}:`, errorMessage);
    
    // Log the error
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event: queueItem.event,
      payload: queueItem.payload,
      status: attempt < maxAttempts ? 'retrying' : 'failed',
      attempts: attempt,
      error_message: errorMessage,
    });
    
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Webhook] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(supabase, webhook, queueItem, attempt + 1);
    }
    
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get unprocessed items from queue (limit to 100 at a time)
    const { data: queueItems, error: queueError } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (queueError) {
      console.error('[Queue] Error fetching queue items:', queueError);
      throw queueError;
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('[Queue] No items to process');
      return new Response(
        JSON.stringify({ message: 'No items to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Queue] Processing ${queueItems.length} items`);
    
    // Get all active webhooks
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true);
    
    if (webhooksError) {
      console.error('[Webhooks] Error fetching webhooks:', webhooksError);
      throw webhooksError;
    }
    
    if (!webhooks || webhooks.length === 0) {
      console.log('[Webhooks] No active webhooks configured');
      
      // Mark all items as processed since there are no webhooks
      const ids = queueItems.map(item => item.id);
      await supabase
        .from('webhook_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .in('id', ids);
      
      return new Response(
        JSON.stringify({ message: 'No active webhooks', processed: queueItems.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const results: { queueId: string; event: string; webhooksSent: number; errors: number }[] = [];
    
    // Process each queue item
    for (const item of queueItems) {
      // Find webhooks that subscribe to this event
      const matchingWebhooks = webhooks.filter(w => w.events.includes(item.event));
      
      if (matchingWebhooks.length === 0) {
        console.log(`[Queue] No webhooks for event ${item.event}`);
      } else {
        let sent = 0;
        let errors = 0;
        
        // Send to all matching webhooks
        for (const webhook of matchingWebhooks) {
          const result = await sendWebhook(supabase, webhook, item);
          if (result.success) {
            sent++;
          } else {
            errors++;
          }
        }
        
        results.push({
          queueId: item.id,
          event: item.event,
          webhooksSent: sent,
          errors,
        });
      }
      
      // Mark item as processed
      await supabase
        .from('webhook_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', item.id);
    }
    
    console.log(`[Queue] Completed processing ${queueItems.length} items`);
    
    return new Response(
      JSON.stringify({
        message: 'Queue processed successfully',
        processed: queueItems.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Queue] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
