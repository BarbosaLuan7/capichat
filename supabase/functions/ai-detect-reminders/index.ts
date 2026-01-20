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
    const { message, leadName } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!message || message.trim().length < 10) {
      return new Response(JSON.stringify({ hasReminder: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Detecting reminders in message for lead:', leadName);

    const systemPrompt = `Você é um assistente que analisa mensagens de atendentes para detectar promessas de retorno ou compromissos.

EXEMPLOS de promessas a detectar:
- "Vou te ligar amanhã às 14h"
- "Segunda-feira envio o contrato"
- "Retorno em 2 dias com a análise"
- "Depois verifico e te aviso"
- "Vou conferir isso e já te falo"
- "Amanhã a advogada entra em contato"
- "Semana que vem fazemos a perícia"

NÃO são promessas:
- Perguntas ao cliente
- Informações gerais
- Despedidas simples

Data atual: ${new Date().toLocaleDateString('pt-BR')}`;

    const userPrompt = `Mensagem enviada pelo atendente para ${leadName || 'o cliente'}:
"${message}"

Analise se há alguma promessa ou compromisso de retorno nesta mensagem.`;

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
              name: 'detect_reminder',
              description: 'Detecta se há uma promessa de retorno na mensagem',
              parameters: {
                type: 'object',
                properties: {
                  hasReminder: {
                    type: 'boolean',
                    description: 'Se há uma promessa/compromisso detectado',
                  },
                  taskTitle: {
                    type: 'string',
                    description: 'Título curto da tarefa a criar (se hasReminder=true)',
                  },
                  taskDescription: {
                    type: 'string',
                    description: 'Descrição do que foi prometido',
                  },
                  suggestedDate: {
                    type: 'string',
                    description:
                      'Data sugerida no formato ISO (YYYY-MM-DD) ou null se não especificada',
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'urgent'],
                    description: 'Prioridade sugerida baseada na urgência',
                  },
                },
                required: ['hasReminder'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'detect_reminder' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(JSON.stringify({ hasReminder: false, error: 'Rate limit exceeded' }), {
          status: 200, // Return 200 to not break the flow
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(JSON.stringify({ hasReminder: false, error: 'Payment required' }), {
          status: 200,
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
      const result = JSON.parse(toolCall.function.arguments);
      console.log('Reminder detection result:', result);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ hasReminder: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in ai-detect-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ hasReminder: false, error: errorMessage }), {
      status: 200, // Return 200 to not break the flow
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
