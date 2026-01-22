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
    const { message, leadName } = await req.json();

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

    const result = await callGemini({
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
      toolChoice: { type: 'function', function: { name: 'detect_reminder' } },
    });

    if (!result.success) {
      console.error('Gemini error:', result.error);
      // Return 200 to not break the flow
      return new Response(JSON.stringify({ hasReminder: false, error: result.error }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract function call result
    if (result.functionCall?.arguments) {
      console.log('Reminder detection result:', result.functionCall.arguments);
      return new Response(JSON.stringify(result.functionCall.arguments), {
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
