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
    const { messages, lead, availableLabels } = await req.json();

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

    const result = await callGemini({
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
      toolChoice: { type: 'function', function: { name: 'classify_lead' } },
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
      console.log('Classification:', result.functionCall.arguments);
      return new Response(JSON.stringify(result.functionCall.arguments), {
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
