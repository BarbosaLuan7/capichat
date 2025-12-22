import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, lead, templates } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating AI reply suggestions for lead:', lead?.name);
    console.log('Messages count:', messages?.length);

    // Build conversation context
    const conversationContext = messages
      ?.slice(-10)
      .map((m: any) => `${m.sender_type === 'lead' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n') || 'Nenhuma mensagem ainda';

    // Build templates context
    const templatesContext = templates?.length > 0
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
                        intent: { type: 'string', description: 'Intenção da resposta (greeting, info, action, closing)' }
                      },
                      required: ['text', 'intent']
                    },
                    minItems: 3,
                    maxItems: 3
                  }
                },
                required: ['suggestions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_replies' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const suggestions = JSON.parse(toolCall.function.arguments);
      console.log('Suggestions generated:', suggestions.suggestions?.length);
      return new Response(JSON.stringify(suggestions), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: parse from content if tool call not present
    const content = data.choices?.[0]?.message?.content || '';
    console.log('Fallback: parsing from content');
    
    return new Response(JSON.stringify({ 
      suggestions: [
        { text: 'Olá! Como posso ajudar você hoje?', intent: 'greeting' },
        { text: 'Vou verificar essas informações e já te retorno.', intent: 'info' },
        { text: 'Pode me enviar os documentos necessários?', intent: 'action' }
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-suggest-replies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
