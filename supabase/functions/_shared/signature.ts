/**
 * Utilitários para verificação de assinatura de webhooks
 * Implementação HMAC-SHA256 para Meta/WAHA webhooks
 *
 * Uso:
 * import { verifyWebhookSignature } from '../_shared/signature.ts';
 */

import { debug, debugError } from './debug.ts';

const PREFIX = 'signature';

// ============================================
// Verificação HMAC
// ============================================

/**
 * Verifica assinatura do webhook usando HMAC-SHA256
 * Implementa comparação constant-time para prevenir timing attacks
 *
 * @param rawBody - Body da requisição como string
 * @param signature - Header de assinatura (pode ter prefixo 'sha256=')
 * @param secret - Segredo compartilhado para HMAC
 * @returns true se assinatura for válida
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    debug(PREFIX, 'Assinatura ou segredo ausente');
    return false;
  }

  try {
    // Limpar assinatura - remover prefixo 'sha256=' se existir
    const cleanSignature = signature.replace(/^sha256=/, '').toLowerCase();

    // Criar HMAC-SHA256 hash usando Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(rawBody);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Comparação constant-time para prevenir timing attacks
    if (cleanSignature.length !== expectedSignature.length) {
      debug(PREFIX, 'Tamanho da assinatura incompatível');
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < cleanSignature.length; i++) {
      mismatch |= cleanSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    const isValid = mismatch === 0;
    debug(PREFIX, 'Verificação de assinatura:', isValid ? 'válida' : 'inválida');
    return isValid;
  } catch (error) {
    debugError(PREFIX, 'Erro ao verificar assinatura:', error);
    return false;
  }
}

/**
 * Gera assinatura HMAC-SHA256 para um payload
 * Útil para testes ou para assinar requisições outbound
 *
 * @param payload - String do payload para assinar
 * @param secret - Segredo para HMAC
 * @returns Assinatura em hex (sem prefixo sha256=)
 */
export async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gera assinatura com prefixo sha256= (formato Meta)
 *
 * @param payload - String do payload para assinar
 * @param secret - Segredo para HMAC
 * @returns Assinatura com prefixo 'sha256='
 */
export async function generateMetaSignature(payload: string, secret: string): Promise<string> {
  const signature = await generateSignature(payload, secret);
  return `sha256=${signature}`;
}
