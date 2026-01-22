/**
 * Testes para utilitários de telefone
 * Foco em números brasileiros (DDDs, 9º dígito, formato)
 *
 * Executar: deno test supabase/functions/_shared/tests/phone.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
  normalizePhone,
  parseInternationalPhone,
  normalizePhoneForStorage,
  formatPhoneForDisplay,
  getPhoneWithCountryCode,
  validateBrazilianPhone,
  VALID_DDDS,
  COUNTRY_CODES,
} from '../phone.ts';

// ============================================
// Testes de Constantes
// ============================================

Deno.test('VALID_DDDS - deve conter todos os DDDs brasileiros', () => {
  // DDDs conhecidos de capitais
  assertEquals(VALID_DDDS.has(11), true, 'SP deve estar presente');
  assertEquals(VALID_DDDS.has(21), true, 'RJ deve estar presente');
  assertEquals(VALID_DDDS.has(31), true, 'MG deve estar presente');
  assertEquals(VALID_DDDS.has(71), true, 'BA deve estar presente');
  assertEquals(VALID_DDDS.has(61), true, 'DF deve estar presente');
  assertEquals(VALID_DDDS.has(41), true, 'PR deve estar presente');
  assertEquals(VALID_DDDS.has(51), true, 'RS deve estar presente');

  // DDDs que NÃO existem
  assertEquals(VALID_DDDS.has(10), false, '10 não existe');
  assertEquals(VALID_DDDS.has(20), false, '20 não existe');
  assertEquals(VALID_DDDS.has(23), false, '23 não existe');
  assertEquals(VALID_DDDS.has(26), false, '26 não existe');
  assertEquals(VALID_DDDS.has(29), false, '29 não existe');
  assertEquals(VALID_DDDS.has(30), false, '30 não existe');
});

Deno.test('COUNTRY_CODES - deve ter códigos ordenados por tamanho', () => {
  // Primeiro deve ser código de 3 dígitos (para match correto)
  assertEquals(COUNTRY_CODES[0].code.length, 3, 'Primeiro código deve ter 3 dígitos');

  // Brasil deve estar presente
  const brasil = COUNTRY_CODES.find((c) => c.code === '55');
  assertExists(brasil, 'Brasil deve estar presente');
  assertEquals(brasil.name, 'Brasil');

  // Paraguai (595) deve vir antes do Brasil (55)
  const paraguaiIndex = COUNTRY_CODES.findIndex((c) => c.code === '595');
  const brasilIndex = COUNTRY_CODES.findIndex((c) => c.code === '55');
  assertEquals(paraguaiIndex < brasilIndex, true, 'Paraguai (595) deve vir antes do Brasil (55)');
});

// ============================================
// Testes de normalizePhone
// ============================================

Deno.test('normalizePhone - deve remover sufixos do WhatsApp', () => {
  assertEquals(normalizePhone('5511999999999@c.us'), '5511999999999');
  assertEquals(normalizePhone('5511999999999@s.whatsapp.net'), '5511999999999');
  assertEquals(normalizePhone('174621106159626@lid'), '174621106159626');
});

Deno.test('normalizePhone - deve remover caracteres não numéricos', () => {
  assertEquals(normalizePhone('+55 (11) 99999-9999'), '5511999999999');
  assertEquals(normalizePhone('55.11.99999.9999'), '5511999999999');
  assertEquals(normalizePhone('55-11-99999-9999'), '5511999999999');
});

Deno.test('normalizePhone - deve lidar com entrada vazia ou inválida', () => {
  assertEquals(normalizePhone(''), '');
  assertEquals(normalizePhone('abc'), '');
  assertEquals(normalizePhone('---'), '');
});

// ============================================
// Testes de parseInternationalPhone
// ============================================

Deno.test('parseInternationalPhone - deve detectar número brasileiro com 55', () => {
  const result = parseInternationalPhone('5511999999999');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '11999999999');
  assertEquals(result.fullNumber, '5511999999999');
  assertEquals(result.isValid, true);
});

Deno.test('parseInternationalPhone - deve detectar número brasileiro com 55', () => {
  // Nota: parseInternationalPhone requer código do país no número
  // Para números sem código, usar validateBrazilianPhone
  const result = parseInternationalPhone('5511987654321');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '11987654321');
  assertEquals(result.fullNumber, '5511987654321');
  assertEquals(result.isValid, true);
});

Deno.test('parseInternationalPhone - deve detectar número do Paraguai (595)', () => {
  const result = parseInternationalPhone('595981123456');
  assertEquals(result.countryCode, '595');
  assertEquals(result.localNumber, '981123456');
  assertEquals(result.isValid, true);
});

Deno.test('parseInternationalPhone - deve detectar número da Argentina (54)', () => {
  const result = parseInternationalPhone('5491112345678');
  assertEquals(result.countryCode, '54');
  assertEquals(result.localNumber, '91112345678');
  assertEquals(result.isValid, true);
});

Deno.test('parseInternationalPhone - deve detectar número dos EUA (1)', () => {
  const result = parseInternationalPhone('12025551234');
  assertEquals(result.countryCode, '1');
  assertEquals(result.localNumber, '2025551234');
  assertEquals(result.isValid, true);
});

// ============================================
// Testes de validateBrazilianPhone
// ============================================

Deno.test('validateBrazilianPhone - deve validar celular SP com 9 dígitos', () => {
  // Usar número real (987654321) em vez de 999999999 (todos iguais = inválido)
  const result = validateBrazilianPhone('11987654321');
  assertEquals(result.valid, true);
  assertEquals(result.normalized, '5511987654321');
  assertEquals(result.ddd, '11');
});

Deno.test('validateBrazilianPhone - deve validar celular com código 55', () => {
  // Usar número real em vez de 999999999 (todos iguais = inválido)
  const result = validateBrazilianPhone('5511987654321');
  assertEquals(result.valid, true);
  assertEquals(result.normalized, '5511987654321');
  assertEquals(result.ddd, '11');
});

Deno.test('validateBrazilianPhone - deve validar telefone fixo (8 dígitos)', () => {
  const result = validateBrazilianPhone('1133334444');
  assertEquals(result.valid, true);
  assertEquals(result.ddd, '11');
});

Deno.test('validateBrazilianPhone - deve rejeitar DDD inválido', () => {
  const result = validateBrazilianPhone('10999999999');
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('DDD'), true);
});

Deno.test('validateBrazilianPhone - deve rejeitar número muito curto', () => {
  const result = validateBrazilianPhone('11999');
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('curto'), true);
});

Deno.test('validateBrazilianPhone - deve rejeitar número muito longo', () => {
  const result = validateBrazilianPhone('551199999999999');
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('longo'), true);
});

Deno.test('validateBrazilianPhone - deve rejeitar celular 9 dígitos sem começar com 9', () => {
  const result = validateBrazilianPhone('11899999999');
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('começar com 9'), true);
});

Deno.test('validateBrazilianPhone - deve rejeitar números repetidos', () => {
  // 11999999999 tem phoneNumber=999999999 (todos 9s) - inválido
  // Nota: precisa começar com 9 para passar o check anterior
  const result = validateBrazilianPhone('11999999999');
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('iguais'), true);

  // 5521999999999 também tem todos 9s após DDD
  const result2 = validateBrazilianPhone('5521999999999');
  assertEquals(result2.valid, false);
  assertEquals(result2.error?.includes('iguais'), true);
});

Deno.test('validateBrazilianPhone - deve rejeitar entrada vazia', () => {
  const result = validateBrazilianPhone('');
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('não informado'), true);
});

// ============================================
// Testes de formatPhoneForDisplay
// ============================================

Deno.test('formatPhoneForDisplay - deve formatar celular brasileiro', () => {
  const result = formatPhoneForDisplay('5511999999999');
  assertEquals(result, '(11) 99999-9999');
});

Deno.test('formatPhoneForDisplay - deve formatar fixo brasileiro', () => {
  const result = formatPhoneForDisplay('551133334444');
  assertEquals(result, '(11) 3333-4444');
});

Deno.test('formatPhoneForDisplay - deve formatar número internacional', () => {
  const result = formatPhoneForDisplay('14155551234');
  assertEquals(result, '+1 4155551234');
});

// ============================================
// Testes de normalizePhoneForStorage
// ============================================

Deno.test('normalizePhoneForStorage - deve separar código do país', () => {
  const result = normalizePhoneForStorage('5511999999999');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '11999999999');
});

Deno.test('normalizePhoneForStorage - deve extrair código e número local', () => {
  // Com código 55 explícito
  const result = normalizePhoneForStorage('5511987654321');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '11987654321');
});

// ============================================
// Testes de getPhoneWithCountryCode
// ============================================

Deno.test('getPhoneWithCountryCode - deve usar código existente se não for BR', () => {
  // Se o número já tem código 55 detectado, e passamos 595 (Paraguai),
  // a função usa o código do Paraguai + número local
  const result = getPhoneWithCountryCode('5511987654321', '595');
  assertEquals(result, '59511987654321');
});

Deno.test('getPhoneWithCountryCode - deve manter 55 se já tiver', () => {
  const result = getPhoneWithCountryCode('5511999999999', null);
  assertEquals(result, '5511999999999');
});

Deno.test('getPhoneWithCountryCode - deve manter código detectado', () => {
  // Número brasileiro com 55 explícito
  const result = getPhoneWithCountryCode('5511987654321', null);
  assertEquals(result, '5511987654321');
});

// ============================================
// Testes de Edge Cases
// ============================================

Deno.test('Edge Case - número com caracteres especiais', () => {
  const normalized = normalizePhone('+55 (45) 98842-8644');
  assertEquals(normalized, '5545988428644');

  const validation = validateBrazilianPhone('+55 (45) 98842-8644');
  assertEquals(validation.valid, true);
  assertEquals(validation.ddd, '45');
});

Deno.test('Edge Case - número do Paraná (45) - DDD válido', () => {
  const result = validateBrazilianPhone('45988428644');
  assertEquals(result.valid, true);
  assertEquals(result.ddd, '45');
  assertEquals(result.normalized, '5545988428644');
});

Deno.test('Edge Case - número com @c.us passando por validação', () => {
  const phone = '5545988428644@c.us';
  const normalized = normalizePhone(phone);
  const result = validateBrazilianPhone(normalized);
  assertEquals(result.valid, true);
});

// ============================================
// Testes de Cenários Meta Ads / Internacionais
// ============================================

Deno.test('Meta Ads - número BR sem código 55 (DDD 11)', () => {
  // Meta Ads frequentemente envia sem código do país
  const result = parseInternationalPhone('11987654321');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '11987654321');
  assertEquals(result.fullNumber, '5511987654321');
});

Deno.test('Meta Ads - número BR sem código 55 (DDD 45)', () => {
  const result = parseInternationalPhone('45988428644');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '45988428644');
  assertEquals(result.fullNumber, '5545988428644');
});

Deno.test('Meta Ads - número BR com código 55', () => {
  const result = parseInternationalPhone('5521999887766');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '21999887766');
});

Deno.test('Internacional - Paraguai +595', () => {
  const result = parseInternationalPhone('595981123456');
  assertEquals(result.countryCode, '595');
  assertEquals(result.localNumber, '981123456');
  assertEquals(result.isValid, true);
});

Deno.test('Internacional - Argentina +54', () => {
  const result = parseInternationalPhone('5491112345678');
  assertEquals(result.countryCode, '54');
  assertEquals(result.localNumber, '91112345678');
});

Deno.test('Internacional - Uruguai +598', () => {
  const result = parseInternationalPhone('59899123456');
  assertEquals(result.countryCode, '598');
  assertEquals(result.localNumber, '99123456');
});

Deno.test('Não confundir EUA com BR - número americano típico', () => {
  // 202 não é DDD brasileiro válido, então é EUA
  const result = parseInternationalPhone('12025551234');
  assertEquals(result.countryCode, '1');
  assertEquals(result.localNumber, '2025551234');
});

Deno.test('Não confundir BR com EUA - número brasileiro DDD 11', () => {
  // 11 é DDD válido e 987654321 começa com 9 (celular)
  const result = parseInternationalPhone('11987654321');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '11987654321');
});

Deno.test('Telefone fixo BR sem código', () => {
  // Fixo: 8 dígitos, começa com 2-5
  const result = parseInternationalPhone('1133445566');
  assertEquals(result.countryCode, '55');
  assertEquals(result.localNumber, '1133445566');
});
