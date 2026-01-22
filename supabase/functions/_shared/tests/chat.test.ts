/**
 * Testes para utilitários de detecção de tipo de chat
 *
 * Executar: deno test supabase/functions/_shared/tests/chat.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
  isGroupChat,
  isStatusBroadcast,
  isLID,
  buildChatId,
  extractPhoneFromChatId,
} from '../chat.ts';

// ============================================
// Testes de isGroupChat
// ============================================

Deno.test('isGroupChat - deve detectar grupo com @g.us', () => {
  assertEquals(isGroupChat('120363123456789@g.us'), true);
  assertEquals(isGroupChat('123456789@g.us'), true);
});

Deno.test('isGroupChat - deve detectar grupo por prefixo 120363', () => {
  assertEquals(isGroupChat('120363123456789'), true);
  assertEquals(isGroupChat('1203631234567890123'), true);
});

Deno.test('isGroupChat - deve retornar false para chat individual', () => {
  assertEquals(isGroupChat('5511999999999@c.us'), false);
  assertEquals(isGroupChat('5511999999999'), false);
});

Deno.test('isGroupChat - deve retornar false para entrada inválida', () => {
  assertEquals(isGroupChat(''), false);
  assertEquals(isGroupChat(null as unknown as string), false);
  assertEquals(isGroupChat(undefined as unknown as string), false);
});

// ============================================
// Testes de isStatusBroadcast
// ============================================

Deno.test('isStatusBroadcast - deve detectar status@broadcast', () => {
  assertEquals(isStatusBroadcast('status@broadcast'), true);
  assertEquals(isStatusBroadcast('alguma_coisa_status@broadcast'), true);
});

Deno.test('isStatusBroadcast - deve detectar @broadcast', () => {
  assertEquals(isStatusBroadcast('qualquer@broadcast'), true);
});

Deno.test('isStatusBroadcast - deve retornar false para chat normal', () => {
  assertEquals(isStatusBroadcast('5511999999999@c.us'), false);
  assertEquals(isStatusBroadcast('5511999999999'), false);
});

Deno.test('isStatusBroadcast - deve retornar false para entrada inválida', () => {
  assertEquals(isStatusBroadcast(''), false);
  assertEquals(isStatusBroadcast(null as unknown as string), false);
});

// ============================================
// Testes de isLID
// ============================================

Deno.test('isLID - deve detectar LID com @lid', () => {
  assertEquals(isLID('174621106159626@lid'), true);
  assertEquals(isLID('123456789012345@lid'), true);
});

Deno.test('isLID - deve detectar LID por tamanho (15+ dígitos sem @c.us)', () => {
  assertEquals(isLID('174621106159626'), true);
  assertEquals(isLID('123456789012345'), true);
});

Deno.test('isLID - deve retornar false para número normal com 15+ dígitos e @c.us', () => {
  // Número muito longo mas com @c.us não é LID
  assertEquals(isLID('123456789012345@c.us'), false);
});

Deno.test('isLID - deve retornar false para número brasileiro normal', () => {
  assertEquals(isLID('5511999999999'), false);
  assertEquals(isLID('5511999999999@c.us'), false);
  assertEquals(isLID('11999999999'), false);
});

Deno.test('isLID - deve retornar false para entrada inválida', () => {
  assertEquals(isLID(''), false);
  assertEquals(isLID(null as unknown as string), false);
});

// ============================================
// Testes de buildChatId
// ============================================

Deno.test('buildChatId - deve adicionar @c.us se não tiver', () => {
  assertEquals(buildChatId('5511999999999'), '5511999999999@c.us');
});

Deno.test('buildChatId - deve limpar caracteres não numéricos', () => {
  assertEquals(buildChatId('+55 (11) 99999-9999'), '5511999999999@c.us');
});

Deno.test('buildChatId - deve reconstruir chatId corretamente', () => {
  // buildChatId sempre extrai apenas dígitos e adiciona @c.us
  // Se entrada já tem @c.us, os caracteres não-numéricos são removidos
  const result = buildChatId('5511999999999@c.us');
  assertEquals(result, '5511999999999@c.us');
});

// ============================================
// Testes de extractPhoneFromChatId
// ============================================

Deno.test('extractPhoneFromChatId - deve remover @c.us', () => {
  assertEquals(extractPhoneFromChatId('5511999999999@c.us'), '5511999999999');
});

Deno.test('extractPhoneFromChatId - deve remover @s.whatsapp.net', () => {
  assertEquals(extractPhoneFromChatId('5511999999999@s.whatsapp.net'), '5511999999999');
});

Deno.test('extractPhoneFromChatId - deve remover @lid', () => {
  assertEquals(extractPhoneFromChatId('174621106159626@lid'), '174621106159626');
});

Deno.test('extractPhoneFromChatId - deve remover @g.us (grupo)', () => {
  assertEquals(extractPhoneFromChatId('120363123456789@g.us'), '120363123456789');
});

Deno.test('extractPhoneFromChatId - deve retornar apenas dígitos', () => {
  assertEquals(extractPhoneFromChatId('+55 11 99999-9999'), '5511999999999');
});

// ============================================
// Testes de Cenários Reais
// ============================================

Deno.test('Cenário Real - webhook de mensagem individual', () => {
  const chatId = '5545988428644@c.us';

  assertEquals(isGroupChat(chatId), false);
  assertEquals(isStatusBroadcast(chatId), false);
  assertEquals(isLID(chatId), false);

  const phone = extractPhoneFromChatId(chatId);
  assertEquals(phone, '5545988428644');
});

Deno.test('Cenário Real - webhook de grupo', () => {
  const chatId = '120363123456789123456@g.us';

  assertEquals(isGroupChat(chatId), true);
  assertEquals(isStatusBroadcast(chatId), false);
  // Grupos com @g.us NÃO são LIDs (mesmo tendo 15+ dígitos)
  assertEquals(isLID(chatId), false);
});

Deno.test('Cenário Real - webhook de status/stories', () => {
  const chatId = 'status@broadcast';

  assertEquals(isGroupChat(chatId), false);
  assertEquals(isStatusBroadcast(chatId), true);
  assertEquals(isLID(chatId), false);
});

Deno.test('Cenário Real - webhook de Facebook Ads (LID)', () => {
  const chatId = '174621106159626@lid';

  assertEquals(isGroupChat(chatId), false);
  assertEquals(isStatusBroadcast(chatId), false);
  assertEquals(isLID(chatId), true);

  const lid = extractPhoneFromChatId(chatId);
  assertEquals(lid, '174621106159626');
});
