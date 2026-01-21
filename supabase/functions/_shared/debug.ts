/**
 * Módulo de logging condicional para Edge Functions
 *
 * Uso:
 * import { debug, debugError } from '../_shared/debug.ts';
 *
 * debug('whatsapp-webhook', 'Mensagem recebida:', data);
 * debugError('whatsapp-webhook', 'Erro ao processar:', error);
 */

const DEBUG = Deno.env.get('DEBUG') === 'true';

/**
 * Log condicional - só loga se DEBUG=true
 */
export function debug(prefix: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[${prefix}]`, ...args);
  }
}

/**
 * Log de erro - sempre loga (erros são importantes)
 */
export function debugError(prefix: string, ...args: unknown[]): void {
  console.error(`[${prefix}]`, ...args);
}

/**
 * Log de warning - sempre loga
 */
export function debugWarn(prefix: string, ...args: unknown[]): void {
  console.warn(`[${prefix}]`, ...args);
}

/**
 * Log de info importante - sempre loga (para métricas/auditoria)
 */
export function debugInfo(prefix: string, ...args: unknown[]): void {
  console.log(`[${prefix}] ℹ️`, ...args);
}
