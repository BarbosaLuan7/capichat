import { corsHeaders, verifyWebhookSignature } from '../../_shared/index.ts';
import type { SupabaseClientType } from '../types.ts';

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Handle non-POST method requests
 */
export function handleMethodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Get signature from various possible headers (different providers use different header names)
 */
export function getSignatureFromHeaders(req: Request): string | null {
  return (
    req.headers.get('x-webhook-signature') ||
    req.headers.get('x-hub-signature-256') ||
    req.headers.get('x-signature') ||
    req.headers.get('x-waha-signature')
  );
}

/**
 * Verify webhook signature with soft validation (logs warning but continues processing)
 */
export async function verifySignature(
  supabase: SupabaseClientType,
  rawBody: string,
  signature: string | null
): Promise<{ isValid: boolean; hasSecret: boolean }> {
  // Get active WhatsApp config to retrieve webhook_secret
  const { data: activeConfig } = await supabase
    .from('whatsapp_config')
    .select('webhook_secret, provider')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!activeConfig?.webhook_secret) {
    console.log('[whatsapp-webhook] No webhook_secret configured - signature verification skipped');
    return { isValid: true, hasSecret: false };
  }

  const isValidSignature = await verifyWebhookSignature(
    rawBody,
    signature,
    activeConfig.webhook_secret
  );

  if (!isValidSignature) {
    // Soft validation: log warning but continue processing
    console.warn(
      '[whatsapp-webhook] Invalid or missing webhook signature - processing anyway (soft validation)'
    );
    console.warn('[whatsapp-webhook] Signature received:', signature?.substring(0, 50) || 'none');

    // TODO: Em produção com WAHA configurado corretamente, descomentar para rejeitar:
    // return { isValid: false, hasSecret: true };
  } else {
    console.log('[whatsapp-webhook] Webhook signature verified successfully');
  }

  return { isValid: true, hasSecret: true };
}

/**
 * Create error response with CORS headers
 */
export function createErrorResponse(error: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create success response with CORS headers
 */
export function createSuccessResponse(
  data: Record<string, unknown>,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create ignored response (for filtered events)
 */
export function createIgnoredResponse(reason: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ success: true, ignored: true, reason, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
