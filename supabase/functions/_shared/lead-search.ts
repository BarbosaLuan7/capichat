/**
 * Utilitários de busca flexível de leads por telefone
 * Suporta números brasileiros e internacionais com múltiplas estratégias de match
 *
 * Uso:
 * import { findLeadByPhone, findLeadByPhoneAndName } from '../_shared/lead-search.ts';
 */

import { debug, debugError, debugInfo } from './debug.ts';
import { parseInternationalPhone } from './phone.ts';

const PREFIX = 'lead-search';

// ============================================
// Busca Flexível
// ============================================

/**
 * Busca lead por telefone usando múltiplas estratégias
 * Encontra lead mesmo que o telefone esteja salvo em formato diferente
 *
 * Estratégias usadas:
 * 1. Número completo como veio
 * 2. Número local isolado (sem código do país)
 * 3. Número completo formatado (código + local)
 * 4. Variações com/sem 9° dígito (Brasil)
 * 5. Fallback: últimos 8 dígitos
 * 6. Fallback: últimos 7 dígitos com scoring
 *
 * @param supabase - Cliente Supabase
 * @param phone - Telefone para buscar (qualquer formato)
 * @returns Lead encontrado ou null
 */
export async function findLeadByPhone(supabase: any, phone: string): Promise<any> {
  const digits = phone.replace(/\D/g, '');

  // Detectar código do país
  const parsed = parseInternationalPhone(digits);

  debug(PREFIX, 'Parsed phone:', {
    original: digits,
    countryCode: parsed.countryCode,
    localNumber: parsed.localNumber,
    fullNumber: parsed.fullNumber,
  });

  // Gerar todas as variações possíveis do número
  const variations: string[] = [];

  // 1. Número como veio (completo)
  variations.push(digits);

  // 2. Número local isolado (sem código do país)
  variations.push(parsed.localNumber);

  // 3. Número completo formatado (código + local)
  variations.push(parsed.fullNumber);

  // 4. Para Brasil (55), gerar variações com/sem 9° dígito
  if (parsed.countryCode === '55') {
    const local = parsed.localNumber;
    const ddd = local.substring(0, 2);
    const rest = local.substring(2);

    // Se tem 11 dígitos (com 9° dígito), criar versão sem
    if (local.length === 11 && rest.startsWith('9')) {
      const without9 = `${ddd}${rest.substring(1)}`;
      variations.push(without9);
      variations.push(`55${without9}`);
    }

    // Se tem 10 dígitos (sem 9° dígito), criar versão com
    if (local.length === 10) {
      const with9 = `${ddd}9${rest}`;
      variations.push(with9);
      variations.push(`55${with9}`);
    }
  }

  // 5. Para números não-brasileiros curtos, tentar com 55
  if (parsed.countryCode !== '55' && digits.length >= 10 && digits.length <= 11) {
    variations.push(`55${digits}`);
  }

  // Remover duplicatas
  const uniqueVariations = [...new Set(variations)];

  debug(PREFIX, 'Buscando lead com variações:', uniqueVariations);

  // Tentar buscar por todas as variações de uma vez usando OR
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .in('phone', uniqueVariations)
    .limit(1);

  if (error) {
    debugError(PREFIX, 'Erro na busca flexível:', error);
  }

  if (leads && leads.length > 0) {
    debugInfo(
      PREFIX,
      '✅ Lead encontrado via busca flexível:',
      leads[0].id,
      'phone salvo:',
      leads[0].phone,
      'country_code salvo:',
      leads[0].country_code
    );
    return leads[0];
  }

  // Fallback 1: buscar pelos últimos 8 dígitos
  const corePart8 = digits.slice(-8);
  debug(PREFIX, 'Tentando busca por núcleo 8 dígitos:', corePart8);

  const { data: fallbackLeads8 } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart8}`)
    .limit(1);

  if (fallbackLeads8 && fallbackLeads8.length > 0) {
    debugInfo(
      PREFIX,
      '✅ Lead encontrado via fallback (8 dígitos):',
      fallbackLeads8[0].id,
      'phone salvo:',
      fallbackLeads8[0].phone
    );
    return fallbackLeads8[0];
  }

  // Fallback 2: buscar pelos últimos 7 dígitos com scoring
  const corePart7 = digits.slice(-7);
  debug(PREFIX, 'Tentando busca por núcleo 7 dígitos:', corePart7);

  const { data: fallbackLeads7 } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart7}`)
    .limit(5);

  if (fallbackLeads7 && fallbackLeads7.length > 0) {
    // Se só encontrou 1, retornar esse
    if (fallbackLeads7.length === 1) {
      debugInfo(PREFIX, '✅ Lead encontrado via fallback (7 dígitos):', fallbackLeads7[0].id);
      return fallbackLeads7[0];
    }

    // Se encontrou múltiplos, preferir o que tem mais dígitos em comum
    const bestMatch = fallbackLeads7.reduce((best: any, current: any) => {
      const bestPhone = best.phone?.replace(/\D/g, '') || '';
      const currentPhone = current.phone?.replace(/\D/g, '') || '';

      // Contar quantos dígitos do final batem
      let bestMatchCount = 0;
      let currentMatchCount = 0;

      for (let i = 1; i <= Math.min(digits.length, bestPhone.length); i++) {
        if (digits.slice(-i) === bestPhone.slice(-i)) bestMatchCount = i;
      }
      for (let i = 1; i <= Math.min(digits.length, currentPhone.length); i++) {
        if (digits.slice(-i) === currentPhone.slice(-i)) currentMatchCount = i;
      }

      return currentMatchCount > bestMatchCount ? current : best;
    });

    debugInfo(
      PREFIX,
      '✅ Lead encontrado via fallback (7 dígitos, melhor match):',
      bestMatch.id,
      'phone salvo:',
      bestMatch.phone
    );
    return bestMatch;
  }

  debug(PREFIX, 'Lead não encontrado para:', phone, '| country detectado:', parsed.countryCode);
  return null;
}

/**
 * Busca lead por telefone + nome (fallback para mensagens com pushName)
 *
 * @param supabase - Cliente Supabase
 * @param phone - Telefone para buscar
 * @param name - Nome para match adicional
 * @returns Lead encontrado ou null
 */
export async function findLeadByPhoneAndName(
  supabase: any,
  phone: string,
  name: string
): Promise<any> {
  if (!name || name.trim().length < 2) return null;

  const digits = phone.replace(/\D/g, '');
  const corePart = digits.slice(-7);
  const cleanName = name.trim().toLowerCase();

  debug(PREFIX, 'Buscando lead por telefone + nome:', {
    corePart,
    name: cleanName,
  });

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${corePart}`)
    .limit(10);

  if (!leads || leads.length === 0) return null;

  // Encontrar lead cujo nome seja similar
  const matchingLead = leads.find((lead: any) => {
    const leadName = (lead.name || '').toLowerCase();
    const leadWhatsappName = (lead.whatsapp_name || '').toLowerCase();

    // Match exato ou parcial
    return (
      leadName.includes(cleanName) ||
      cleanName.includes(leadName) ||
      leadWhatsappName.includes(cleanName) ||
      cleanName.includes(leadWhatsappName)
    );
  });

  if (matchingLead) {
    debugInfo(PREFIX, '✅ Lead encontrado por telefone + nome:', matchingLead.id);
  }

  return matchingLead || null;
}
