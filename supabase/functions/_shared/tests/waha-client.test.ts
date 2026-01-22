/**
 * Testes para cliente WAHA
 *
 * Executar: deno test supabase/functions/_shared/tests/waha-client.test.ts --allow-net
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

// Mock do fetch global para testes
const originalFetch = globalThis.fetch;

function mockFetch(responses: Array<{ status: number; body: any }>) {
  let callIndex = 0;
  globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Import após definir mocks
import { wahaFetch, getWahaContactChatId, testWahaConnection } from '../waha-client.ts';

// ============================================
// Testes de wahaFetch
// ============================================

Deno.test('wahaFetch - deve retornar sucesso no primeiro formato (X-Api-Key)', async () => {
  mockFetch([{ status: 200, body: { success: true } }]);

  try {
    const response = await wahaFetch('https://api.example.com/test', 'test-api-key');
    assertEquals(response.status, 200);

    const data = await response.json();
    assertEquals(data.success, true);
  } finally {
    restoreFetch();
  }
});

Deno.test('wahaFetch - deve tentar Bearer se X-Api-Key retornar 401', async () => {
  mockFetch([
    { status: 401, body: { error: 'Unauthorized' } }, // X-Api-Key falha
    { status: 200, body: { success: true } }, // Bearer funciona
  ]);

  try {
    const response = await wahaFetch('https://api.example.com/test', 'test-api-key');
    assertEquals(response.status, 200);
  } finally {
    restoreFetch();
  }
});

Deno.test('wahaFetch - deve tentar terceiro formato se primeiros dois falharem', async () => {
  mockFetch([
    { status: 401, body: { error: 'Unauthorized' } }, // X-Api-Key falha
    { status: 401, body: { error: 'Unauthorized' } }, // Bearer falha
    { status: 200, body: { success: true } }, // ApiKey raw funciona
  ]);

  try {
    const response = await wahaFetch('https://api.example.com/test', 'test-api-key');
    assertEquals(response.status, 200);
  } finally {
    restoreFetch();
  }
});

Deno.test('wahaFetch - deve retornar último erro se todos falharem com 401', async () => {
  mockFetch([
    { status: 401, body: { error: 'Unauthorized' } },
    { status: 401, body: { error: 'Unauthorized' } },
    { status: 401, body: { error: 'Unauthorized' } },
  ]);

  try {
    const response = await wahaFetch('https://api.example.com/test', 'test-api-key');
    assertEquals(response.status, 401);
  } finally {
    restoreFetch();
  }
});

Deno.test('wahaFetch - deve retornar erro não-401 imediatamente', async () => {
  mockFetch([
    { status: 404, body: { error: 'Not Found' } }, // Erro diferente de 401
  ]);

  try {
    const response = await wahaFetch('https://api.example.com/test', 'test-api-key');
    assertEquals(response.status, 404);
  } finally {
    restoreFetch();
  }
});

Deno.test('wahaFetch - deve passar headers customizados', async () => {
  let capturedHeaders: Record<string, string> = {};

  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  try {
    await wahaFetch('https://api.example.com/test', 'test-api-key', {
      headers: { 'Content-Type': 'application/json' },
    });

    assertEquals(capturedHeaders['Content-Type'], 'application/json');
    // Deve ter o header de auth também
    assertEquals('X-Api-Key' in capturedHeaders || 'Authorization' in capturedHeaders, true);
  } finally {
    restoreFetch();
  }
});

// ============================================
// Testes de getWahaContactChatId
// ============================================

Deno.test('getWahaContactChatId - deve retornar chatId quando número existe', async () => {
  mockFetch([
    {
      status: 200,
      body: {
        numberExists: true,
        chatId: '5511999999999@c.us',
      },
    },
  ]);

  try {
    const result = await getWahaContactChatId(
      'https://api.example.com',
      'test-api-key',
      'default',
      '5511999999999'
    );

    assertEquals(result.exists, true);
    assertEquals(result.chatId, '5511999999999@c.us');
  } finally {
    restoreFetch();
  }
});

Deno.test(
  'getWahaContactChatId - deve retornar exists=false quando número não existe',
  async () => {
    mockFetch([
      {
        status: 200,
        body: {
          numberExists: false,
        },
      },
    ]);

    try {
      const result = await getWahaContactChatId(
        'https://api.example.com',
        'test-api-key',
        'default',
        '5511999999999'
      );

      assertEquals(result.exists, false);
    } finally {
      restoreFetch();
    }
  }
);

Deno.test('getWahaContactChatId - deve limpar telefone com +', async () => {
  let capturedUrl = '';

  globalThis.fetch = async (url: string | URL | Request, _init?: RequestInit) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ numberExists: true, chatId: '5511999999999@c.us' }), {
      status: 200,
    });
  };

  try {
    await getWahaContactChatId(
      'https://api.example.com',
      'test-api-key',
      'default',
      '+5511999999999'
    );

    assertEquals(capturedUrl.includes('5511999999999'), true);
    assertEquals(capturedUrl.includes('+'), false);
  } finally {
    restoreFetch();
  }
});

Deno.test('getWahaContactChatId - deve retornar erro em caso de falha da API', async () => {
  mockFetch([
    {
      status: 500,
      body: { error: 'Internal Server Error' },
    },
  ]);

  try {
    const result = await getWahaContactChatId(
      'https://api.example.com',
      'test-api-key',
      'default',
      '5511999999999'
    );

    assertEquals(result.exists, false);
    assertEquals(result.error?.includes('500'), true);
  } finally {
    restoreFetch();
  }
});

// ============================================
// Testes de testWahaConnection
// ============================================

Deno.test('testWahaConnection - deve retornar connected=true quando API responde', async () => {
  mockFetch([
    {
      status: 200,
      body: {
        status: 'CONNECTED',
        me: { id: '5511999999999@c.us' },
      },
    },
  ]);

  try {
    const result = await testWahaConnection('https://api.example.com', 'test-api-key', 'default');

    assertEquals(result.connected, true);
    assertEquals(result.status, 'CONNECTED');
  } finally {
    restoreFetch();
  }
});

Deno.test('testWahaConnection - deve retornar connected=false quando API falha', async () => {
  mockFetch([
    {
      status: 401,
      body: { error: 'Unauthorized' },
    },
    {
      status: 401,
      body: { error: 'Unauthorized' },
    },
    {
      status: 401,
      body: { error: 'Unauthorized' },
    },
  ]);

  try {
    const result = await testWahaConnection('https://api.example.com', 'test-api-key', 'default');

    assertEquals(result.connected, false);
    assertEquals(result.error?.includes('401'), true);
  } finally {
    restoreFetch();
  }
});

Deno.test('testWahaConnection - deve listar sessions se não passar session', async () => {
  let capturedUrl = '';

  globalThis.fetch = async (url: string | URL | Request, _init?: RequestInit) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify([{ name: 'default', status: 'CONNECTED' }]), {
      status: 200,
    });
  };

  try {
    const result = await testWahaConnection('https://api.example.com', 'test-api-key');

    assertEquals(capturedUrl.includes('/api/sessions'), true);
    assertEquals(capturedUrl.includes('/me'), false);
    assertEquals(result.connected, true);
  } finally {
    restoreFetch();
  }
});

// ============================================
// Testes de Edge Cases
// ============================================

Deno.test('Edge Case - URL com trailing slash deve ser normalizada', async () => {
  let capturedUrl = '';

  globalThis.fetch = async (url: string | URL | Request, _init?: RequestInit) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ numberExists: true, chatId: '5511999999999@c.us' }), {
      status: 200,
    });
  };

  try {
    await getWahaContactChatId(
      'https://api.example.com/',
      'test-api-key',
      'default',
      '5511999999999'
    );

    // URL deve estar bem formatada (sem // duplo no path)
    // Nota: https:// é normal, verificamos se não há /.com// ou similar
    const urlPath = capturedUrl.replace('https://', '');
    assertEquals(urlPath.includes('//'), false);
  } finally {
    restoreFetch();
  }
});

Deno.test('Edge Case - resposta com formato alternativo (exists)', async () => {
  mockFetch([
    {
      status: 200,
      body: {
        exists: true, // Campo alternativo
        jid: '5511999999999@c.us', // Campo alternativo
      },
    },
  ]);

  try {
    const result = await getWahaContactChatId(
      'https://api.example.com',
      'test-api-key',
      'default',
      '5511999999999'
    );

    assertEquals(result.exists, true);
    assertEquals(result.chatId, '5511999999999@c.us');
  } finally {
    restoreFetch();
  }
});

Deno.test('Edge Case - resposta com formato alternativo (isRegistered)', async () => {
  mockFetch([
    {
      status: 200,
      body: {
        isRegistered: true, // Campo alternativo
        id: '5511999999999@c.us', // Campo alternativo
      },
    },
  ]);

  try {
    const result = await getWahaContactChatId(
      'https://api.example.com',
      'test-api-key',
      'default',
      '5511999999999'
    );

    assertEquals(result.exists, true);
    assertEquals(result.chatId, '5511999999999@c.us');
  } finally {
    restoreFetch();
  }
});
