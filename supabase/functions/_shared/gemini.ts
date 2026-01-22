/**
 * Gemini AI Client - Substitui o gateway do Lovable
 * Usa a API do Google AI diretamente
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface GeminiRequest {
  systemPrompt?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  toolChoice?: { type: 'function'; function: { name: string } };
  maxTokens?: number;
}

export interface GeminiResponse {
  success: boolean;
  content?: string;
  functionCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  error?: string;
}

/**
 * Converte mensagens do formato OpenAI para Gemini
 */
function convertMessages(
  messages: GeminiRequest['messages'],
  systemPrompt?: string
): GeminiMessage[] {
  const geminiMessages: GeminiMessage[] = [];

  // Se tem system prompt, adiciona como primeira mensagem do usuário
  let systemText = systemPrompt || '';
  const systemMsg = messages.find((m) => m.role === 'system');
  if (systemMsg) {
    systemText = systemMsg.content + (systemText ? '\n\n' + systemText : '');
  }

  // Adiciona system como contexto na primeira mensagem user
  let addedSystem = false;

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    const role = msg.role === 'assistant' ? 'model' : 'user';
    let content = msg.content;

    // Adiciona system prompt na primeira mensagem user
    if (role === 'user' && !addedSystem && systemText) {
      content = `[Instruções do Sistema]\n${systemText}\n\n[Mensagem do Usuário]\n${content}`;
      addedSystem = true;
    }

    geminiMessages.push({
      role,
      parts: [{ text: content }],
    });
  }

  return geminiMessages;
}

/**
 * Converte tools do formato OpenAI para Gemini
 */
function convertTools(tools: GeminiRequest['tools']): GeminiFunctionDeclaration[] {
  if (!tools) return [];

  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters as GeminiFunctionDeclaration['parameters'],
  }));
}

/**
 * Chama a API do Gemini
 */
export async function callGemini(request: GeminiRequest): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not configured',
    };
  }

  const contents = convertMessages(request.messages, request.systemPrompt);
  const functionDeclarations = convertTools(request.tools);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: request.maxTokens || 2048,
      temperature: 0.7,
    },
  };

  // Adiciona tools se houver
  if (functionDeclarations.length > 0) {
    body.tools = [{ functionDeclarations }];

    // Se tem toolChoice específico, força a função
    if (request.toolChoice?.function?.name) {
      body.toolConfig = {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [request.toolChoice.function.name],
        },
      };
    }
  }

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);

      if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded. Please try again later.' };
      }
      if (response.status === 403) {
        return { success: false, error: 'Invalid API key or access denied.' };
      }

      return { success: false, error: `Gemini API error: ${response.status}` };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      return { success: false, error: 'No response from Gemini' };
    }

    // Verifica se tem function call
    const functionCallPart = candidate.content?.parts?.find(
      (p: { functionCall?: unknown }) => p.functionCall
    );

    if (functionCallPart?.functionCall) {
      return {
        success: true,
        functionCall: {
          name: functionCallPart.functionCall.name,
          arguments: functionCallPart.functionCall.args || {},
        },
      };
    }

    // Extrai texto da resposta
    const textPart = candidate.content?.parts?.find((p: { text?: string }) => p.text);
    if (textPart?.text) {
      return {
        success: true,
        content: textPart.text,
      };
    }

    return { success: false, error: 'Empty response from Gemini' };
  } catch (error) {
    console.error('[Gemini] Request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper para transcrição de áudio com Gemini
 */
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string = 'audio/webm'
): Promise<{ success: boolean; text?: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Transcreva o áudio a seguir. Retorne APENAS o texto falado, sem explicações adicionais. Se não conseguir entender, responda "Áudio inaudível".',
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] Transcription error:', response.status, errorText);
      return { success: false, error: `Gemini API error: ${response.status}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      return { success: true, text: text.trim() };
    }

    return { success: false, error: 'No transcription returned' };
  } catch (error) {
    console.error('[Gemini] Transcription request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
