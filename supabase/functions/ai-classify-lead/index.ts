import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
    const { messages, lead, availableLabels } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Classifying lead:', lead?.name);
    console.log('Messages count:', messages?.length);

    // Build conversation context
    const conversationContext =
      messages
        ?.map((m: any) => `${m.sender_type === 'lead' ? 'Cliente' : 'Atendente'}: ${m.content}`)
        .join('\n') || 'Nenhuma mensagem ainda';

    // Group labels by category
    const labelsByCategory: Record<string, string[]> = {};
    availableLabels?.forEach((label: any) => {
      if (!labelsByCategory[label.category]) {
        labelsByCategory[label.category] = [];
      }
      labelsByCategory[label.category].push(label.name);
    });

    const systemPrompt = `Você é um assistente jurídico especializado em Direito Previdenciário (INSS) da GaranteDireito.

Analise a conversa e classifique o lead de acordo com as informações mencionadas.

Tipos de benefícios que trabalhamos:
- BPC/LOAS Idoso (65+ anos, baixa renda)
- BPC/LOAS Deficiente (pessoas com deficiência, baixa renda)
- BPC Autista (crianças/adultos com TEA)
- Aposentadoria por Idade
- Aposentadoria por Tempo de Contribuição
- Aposentadoria Especial (atividades insalubres)
- Aposentadoria Rural
- Auxílio-Doença
- Auxílio-Acidente
- Pensão por Morte
- Salário-Maternidade
- Auxílio-Reclusão

Etiquetas disponíveis por categoria:
${Object.entries(labelsByCategory)
  .map(([cat, labels]) => `- ${cat}: ${labels.join(', ')}`)
  .join('\n')}

REGRAS:
1. Sugira apenas benefícios mencionados ou claramente aplicáveis
2. Temperatura: "hot" se urgente/muito interessado, "warm" se interessado, "cold" se incerto
3. Sugira etiquetas baseadas no que foi mencionado
4. Seja conservador - só sugira o que tem evidência na conversa`;

    const userPrompt = `Conversa completa:
${conversationContext}

Dados atuais do lead:
- Nome: ${lead?.name || 'Não informado'}
- Temperatura atual: ${lead?.temperature || 'Não definida'}
- Etiquetas atuais: ${lead?.labels?.map((l: any) => l.name).join(', ') || 'Nenhuma'}

Analise e sugira classificações.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'classify_lead',
              description: 'Classifica o lead baseado na conversa',
              parameters: {
                type: 'object',
                properties: {
                  suggestedBenefit: {
                    type: 'string',
                    description: 'Tipo de benefício provável (ex: BPC Idoso, Aposentadoria, etc)',
                  },
                  suggestedTemperature: {
                    type: 'string',
                    enum: ['cold', 'warm', 'hot'],
                    description: 'Temperatura sugerida baseada no interesse demonstrado',
                  },
                  suggestedLabels: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nomes das etiquetas sugeridas (das disponíveis)',
                  },
                  healthConditions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Condições de saúde mencionadas',
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Breve justificativa das sugestões (1-2 frases)',
                  },
                  confidence: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Nível de confiança nas sugestões',
                  },
                },
                required: ['suggestedTemperature', 'suggestedLabels', 'reasoning', 'confidence'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'classify_lead' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI classification received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const classification = JSON.parse(toolCall.function.arguments);
      console.log('Classification:', classification);
      return new Response(JSON.stringify(classification), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback
    return new Response(
      JSON.stringify({
        suggestedTemperature: 'warm',
        suggestedLabels: [],
        reasoning: 'Não foi possível determinar classificação específica.',
        confidence: 'low',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in ai-classify-lead:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
