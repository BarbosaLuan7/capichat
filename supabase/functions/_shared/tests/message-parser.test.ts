/**
 * Testes para utilitários de parsing de mensagens WAHA
 *
 * Executar: deno test supabase/functions/_shared/tests/message-parser.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { isSystemNotification, getMessageContent } from '../message-parser.ts';

// ============================================
// Testes de isSystemNotification
// ============================================

Deno.test('isSystemNotification - deve detectar notification_template', () => {
  assertEquals(isSystemNotification({ type: 'notification_template' }), true);
  assertEquals(isSystemNotification({ _data: { type: 'notification_template' } }), true);
});

Deno.test('isSystemNotification - deve detectar e2e_notification', () => {
  assertEquals(isSystemNotification({ type: 'e2e_notification' }), true);
});

Deno.test('isSystemNotification - deve detectar protocol', () => {
  assertEquals(isSystemNotification({ type: 'protocol' }), true);
});

Deno.test('isSystemNotification - deve detectar call_log', () => {
  assertEquals(isSystemNotification({ type: 'call_log' }), true);
});

Deno.test('isSystemNotification - deve detectar revoked (mensagem apagada)', () => {
  assertEquals(isSystemNotification({ type: 'revoked' }), true);
});

Deno.test('isSystemNotification - deve detectar ciphertext', () => {
  assertEquals(isSystemNotification({ type: 'ciphertext' }), true);
});

Deno.test('isSystemNotification - deve detectar subtype contact_info_card', () => {
  assertEquals(isSystemNotification({ subtype: 'contact_info_card' }), true);
  assertEquals(isSystemNotification({ _data: { subtype: 'contact_info_card' } }), true);
});

Deno.test('isSystemNotification - deve retornar false para mensagem de texto', () => {
  assertEquals(isSystemNotification({ type: 'chat' }), false);
  assertEquals(isSystemNotification({ type: 'text' }), false);
});

Deno.test('isSystemNotification - deve retornar false para mensagem de mídia', () => {
  assertEquals(isSystemNotification({ type: 'image' }), false);
  assertEquals(isSystemNotification({ type: 'audio' }), false);
  assertEquals(isSystemNotification({ type: 'video' }), false);
  assertEquals(isSystemNotification({ type: 'document' }), false);
  assertEquals(isSystemNotification({ type: 'ptt' }), false);
});

// ============================================
// Testes de getMessageContent - Texto
// ============================================

Deno.test('getMessageContent - deve extrair texto de mensagem chat', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: 'Olá, tudo bem?',
    hasMedia: false,
    type: 'chat' as const,
    fromMe: false,
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.content, 'Olá, tudo bem?');
  assertEquals(result.type, 'text');
  assertEquals(result.isSystemMessage, undefined);
});

Deno.test('getMessageContent - deve retornar vazio para notificação do sistema', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: false,
    type: 'protocol' as const,
    fromMe: false,
  };

  // Cast para any pois 'protocol' não está no tipo WAHAMessage
  const result = getMessageContent(payload as any, 'waha');
  assertEquals(result.content, '');
  assertEquals(result.isSystemMessage, true);
});

// ============================================
// Testes de getMessageContent - Mídia
// ============================================

Deno.test('getMessageContent - deve detectar tipo image', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: 'Legenda da foto',
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/image.jpg',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.type, 'image');
  assertEquals(result.content, 'Legenda da foto');
  assertEquals(result.mediaUrl, 'https://example.com/image.jpg');
});

Deno.test('getMessageContent - deve detectar tipo audio', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'audio' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/audio.ogg',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.type, 'audio');
});

Deno.test('getMessageContent - deve detectar tipo ptt como audio', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'ptt' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/voice.ogg',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.type, 'audio');
});

Deno.test('getMessageContent - deve detectar tipo video', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'video' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/video.mp4',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.type, 'video');
});

Deno.test('getMessageContent - deve detectar tipo document', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'document' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/doc.pdf',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.type, 'document');
});

// ============================================
// Testes de getMessageContent - Media URL
// ============================================

Deno.test('getMessageContent - deve extrair mediaUrl de payload.mediaUrl', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/direct.jpg',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.mediaUrl, 'https://example.com/direct.jpg');
});

Deno.test('getMessageContent - deve extrair mediaUrl de payload.media.url', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    media: {
      url: 'https://example.com/nested.jpg',
      mimetype: 'image/jpeg',
    },
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.mediaUrl, 'https://example.com/nested.jpg');
});

// ============================================
// Testes de getMessageContent - Base64 Detection
// ============================================

Deno.test('getMessageContent - deve ignorar body com base64 JPEG', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '/9j/4AAQSkZJRgABAQEASABIAAD' + 'A'.repeat(500), // Base64 JPEG
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/image.jpg',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.content, ''); // Deve ignorar base64
  assertEquals(result.type, 'image');
});

Deno.test('getMessageContent - deve ignorar body com base64 PNG', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: 'iVBORw0KGgoAAAANSUhEUgAAAAUA' + 'A'.repeat(500), // Base64 PNG
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/image.png',
  };

  const result = getMessageContent(payload, 'waha');
  assertEquals(result.content, '');
});

// ============================================
// Testes de getMessageContent - Caption
// ============================================

Deno.test('getMessageContent - deve extrair caption de mídia', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    mediaUrl: 'https://example.com/image.jpg',
    caption: 'Esta é a legenda da imagem',
  };

  // Adicionar caption ao payload
  const payloadWithCaption = { ...payload, caption: 'Esta é a legenda da imagem' };
  const result = getMessageContent(payloadWithCaption as any, 'waha');
  assertEquals(result.content, 'Esta é a legenda da imagem');
});

// ============================================
// Testes de getMessageContent - Quoted Message
// ============================================

Deno.test('getMessageContent - deve extrair quotedMessage', () => {
  const payload = {
    id: 'msg123',
    timestamp: Date.now(),
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: 'Resposta para a mensagem',
    hasMedia: false,
    type: 'chat' as const,
    fromMe: false,
    quotedMsg: {
      id: 'quoted123',
      body: 'Mensagem original',
      from: '5521888888888@c.us',
      type: 'chat',
    },
  };

  const payloadWithQuote = { ...payload, quotedMsg: payload.quotedMsg };
  const result = getMessageContent(payloadWithQuote as any, 'waha');

  assertEquals(result.content, 'Resposta para a mensagem');
  assertEquals(result.quotedMessage?.body, 'Mensagem original');
});

// ============================================
// Testes de Cenários Reais WAHA
// ============================================

Deno.test('Cenário Real - mensagem de texto simples WAHA', () => {
  const wahaPayload = {
    id: 'true_5511999999999@c.us_3EB0F7A2B4C5D6E7F8',
    timestamp: 1705412345,
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: 'Bom dia! Gostaria de mais informações.',
    hasMedia: false,
    type: 'chat' as const,
    fromMe: false,
    pushName: 'João Silva',
  };

  const result = getMessageContent(wahaPayload, 'waha');
  assertEquals(result.content, 'Bom dia! Gostaria de mais informações.');
  assertEquals(result.type, 'text');
  assertEquals(result.isSystemMessage, undefined);
});

Deno.test('Cenário Real - áudio de voz (PTT) WAHA', () => {
  const wahaPayload = {
    id: 'true_5511999999999@c.us_3EB0F7A2B4C5D6E7F8',
    timestamp: 1705412345,
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: true,
    type: 'ptt' as const,
    fromMe: false,
    mediaUrl: 'http://localhost:3000/api/files/audio.ogg',
    media: {
      mimetype: 'audio/ogg; codecs=opus',
    },
  };

  const result = getMessageContent(wahaPayload, 'waha');
  assertEquals(result.type, 'audio');
  assertEquals(result.content, '');
  assertEquals(result.mediaUrl, 'http://localhost:3000/api/files/audio.ogg');
});

Deno.test('Cenário Real - imagem com legenda WAHA', () => {
  const wahaPayload = {
    id: 'true_5511999999999@c.us_3EB0F7A2B4C5D6E7F8',
    timestamp: 1705412345,
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: 'Segue o comprovante de pagamento',
    hasMedia: true,
    type: 'image' as const,
    fromMe: false,
    mediaUrl: 'http://localhost:3000/api/files/image.jpg',
    media: {
      mimetype: 'image/jpeg',
    },
  };

  const result = getMessageContent(wahaPayload, 'waha');
  assertEquals(result.type, 'image');
  assertEquals(result.content, 'Segue o comprovante de pagamento');
  assertEquals(result.mediaUrl, 'http://localhost:3000/api/files/image.jpg');
});

Deno.test('Cenário Real - notificação de criptografia (ignorar)', () => {
  const wahaPayload = {
    id: 'false_5511999999999@c.us_status',
    timestamp: 1705412345,
    from: '5511999999999@c.us',
    to: '5521888888888@c.us',
    body: '',
    hasMedia: false,
    type: 'e2e_notification' as const,
    fromMe: false,
  };

  // Cast para any pois 'e2e_notification' não está no tipo WAHAMessage
  const result = getMessageContent(wahaPayload as any, 'waha');
  assertEquals(result.isSystemMessage, true);
  assertEquals(result.content, '');
});
