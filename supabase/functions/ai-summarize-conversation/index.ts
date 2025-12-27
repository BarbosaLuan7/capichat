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
    const { messages, lead } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ 
        summary: 'Nenhuma mensagem para resumir.',
        structured: null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Summarizing conversation for lead:', lead?.name);
    console.log('Messages count:', messages?.length);

    // Build conversation context
    const conversationContext = messages
      ?.map((m: any) => {
        const date = new Date(m.created_at).toLocaleDateString('pt-BR');
        return `[${date}] ${m.sender_type === 'lead' ? 'Cliente' : 'Atendente'}: ${m.content}`;
      })
      .join('\n') || '';

    const leadName = lead?.name || 'Cliente';
    
    const systemPrompt = `Você é um assistente jurídico da GaranteDireito, especializado em Direito Previdenciário.

Seu objetivo é criar um resumo estruturado da conversa para que advogados e atendentes entendam rapidamente o caso.

REGRAS CRÍTICAS DE CONTEXTO:
- Você está analisando EXCLUSIVAMENTE a conversa com o cliente "${leadName}"
- NÃO mencione nomes de outros clientes ou contextos de outras conversas
- Use APENAS as informações fornecidas nas mensagens abaixo
- Se mencionar o cliente, use o nome "${leadName}"

O resumo deve destacar:
1. SITUAÇÃO: Breve descrição do caso/pedido do cliente
2. BENEFÍCIO: Tipo de benefício que o cliente precisa (BPC, Aposentadoria, etc)
3. CONDIÇÕES: Doenças, deficiências ou condições mencionadas
4. DOCUMENTOS: Quais foram enviados ou estão pendentes
5. DATAS: Perícias, prazos ou compromissos importantes
6. PENDÊNCIAS: Próximos passos necessários
7. OBSERVAÇÕES: Informações relevantes para o advogado

REGRAS DE FORMATO:
- Seja objetivo e conciso
- Use bullet points
- Destaque informações críticas
- Se alguma seção não tiver informação, omita ela`;

    const userPrompt = `Dados do lead:
- Nome: ${lead?.name || 'Não informado'}
- Telefone: ${lead?.phone || 'Não informado'}
- Origem: ${lead?.source || 'Não informada'}
- Etapa: ${lead?.stage || 'Não definida'}

Conversa completa:
${conversationContext}

Crie um resumo estruturado desta conversa.`;

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
              name: 'summarize_conversation',
              description: 'Cria um resumo estruturado da conversa',
              parameters: {
                type: 'object',
                properties: {
                  situation: { 
                    type: 'string', 
                    description: 'Breve descrição do caso/pedido' 
                  },
                  benefit: { 
                    type: 'string', 
                    description: 'Tipo de benefício que o cliente precisa' 
                  },
                  healthConditions: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Condições de saúde mencionadas' 
                  },
                  documentsReceived: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Documentos já recebidos' 
                  },
                  documentsPending: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Documentos pendentes' 
                  },
                  importantDates: { 
                    type: 'array', 
                    items: { 
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        description: { type: 'string' }
                      }
                    },
                    description: 'Datas importantes (perícias, prazos)' 
                  },
                  nextSteps: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Próximos passos necessários' 
                  },
                  observations: { 
                    type: 'string', 
                    description: 'Observações relevantes para o advogado' 
                  },
                  summaryText: {
                    type: 'string',
                    description: 'Resumo em texto corrido (2-3 frases)'
                  }
                },
                required: ['situation', 'summaryText']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'summarize_conversation' } }
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
    console.log('AI summary received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const structured = JSON.parse(toolCall.function.arguments);
      console.log('Summary generated');
      return new Response(JSON.stringify({ 
        summary: structured.summaryText,
        structured 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      summary: 'Não foi possível gerar o resumo.',
      structured: null 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-summarize-conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
