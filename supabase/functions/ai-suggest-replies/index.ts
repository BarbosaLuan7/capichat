import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callGemini } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, lead, templates } = await req.json();

    console.log('Generating AI reply suggestions for lead:', lead?.name);
    console.log('Messages count:', messages?.length);

    // Build conversation context
    const conversationContext =
      messages
        ?.slice(-10)
        .map((m: any) => `${m.sender_type === 'lead' ? 'Cliente' : 'Atendente'}: ${m.content}`)
        .join('\n') || 'Nenhuma mensagem ainda';

    // Build templates context
    const templatesContext =
      templates?.length > 0
        ? `\nTemplates disponíveis que podem ser adaptados:\n${templates.map((t: any) => `- ${t.name}: ${t.content}`).join('\n')}`
        : '';

    const systemPrompt = `Você é um assistente do escritório GaranteDireito, especializado em Direito Previdenciário (BPC/LOAS, Aposentadorias, Auxílios).

Seu objetivo é sugerir 3 respostas curtas e profissionais para o atendente usar no WhatsApp.

Contexto do lead:
- Nome: ${lead?.name || 'Não informado'}
- Etapa do funil: ${lead?.stage || 'Não definida'}
- Temperatura: ${lead?.temperature === 'hot' ? 'Quente (muito interessado)' : lead?.temperature === 'warm' ? 'Morno (interessado)' : 'Frio (pouco interesse)'}
- Origem: ${lead?.source || 'Não informada'}
${lead?.labels?.length > 0 ? `- Etiquetas: ${lead.labels.map((l: any) => l.name).join(', ')}` : ''}
${templatesContext}

REGRAS:
1. Respostas devem ser curtas (máximo 2 linhas)
2. Tom empático e profissional
3. Usar "você" (não "o senhor/a senhora")
4. Focar em avançar o atendimento
5. Considerar o histórico da conversa
6. Se o cliente mencionou alguma condição de saúde ou benefício, mencione na resposta`;

    const userPrompt = `Última conversa:
${conversationContext}

Sugira 3 respostas curtas e úteis que o atendente pode enviar agora.`;

    const result = await callGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'suggest_replies',
            description: 'Retorna 3 sugestões de resposta para o atendente',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: 'Texto da resposta sugerida' },
                      intent: {
                        type: 'string',
                        description: 'Intenção da resposta (greeting, info, action, closing)',
                      },
                    },
                    required: ['text', 'intent'],
                  },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ['suggestions'],
            },
          },
        },
      ],
      toolChoice: { type: 'function', function: { name: 'suggest_replies' } },
    });

    if (!result.success) {
      console.error('Gemini error:', result.error);

      if (result.error?.includes('Rate limit')) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(result.error || 'AI error');
    }

    // Extract function call result
    if (result.functionCall?.arguments) {
      console.log('Suggestions generated:', result.functionCall.arguments);
      return new Response(JSON.stringify(result.functionCall.arguments), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback
    console.log('Fallback: using default suggestions');
    return new Response(
      JSON.stringify({
        suggestions: [
          { text: 'Olá! Como posso ajudar você hoje?', intent: 'greeting' },
          { text: 'Vou verificar essas informações e já te retorno.', intent: 'info' },
          { text: 'Pode me enviar os documentos necessários?', intent: 'action' },
        ],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in ai-suggest-replies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
