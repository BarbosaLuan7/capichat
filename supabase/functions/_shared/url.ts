/**
 * Utilitários de URL para Edge Functions
 *
 * Uso:
 * import { normalizeUrl } from '../_shared/url.ts';
 */

/**
 * Remove barras finais da URL para evitar //api/ duplicado
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
