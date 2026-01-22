import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { transcribeAudio } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      throw new Error('No audio URL provided');
    }

    console.log('Transcribing audio from:', audioUrl);

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio file');
    }

    const audioBlob = await audioResponse.blob();
    const audioBuffer = await audioBlob.arrayBuffer();

    // Converter para base64 de forma segura (sem spread operator que causa stack overflow)
    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binaryString);

    // Detectar mime type baseado na URL
    let mimeType = 'audio/webm';
    if (audioUrl.includes('.ogg')) mimeType = 'audio/ogg';
    else if (audioUrl.includes('.mp3')) mimeType = 'audio/mp3';
    else if (audioUrl.includes('.wav')) mimeType = 'audio/wav';
    else if (audioUrl.includes('.m4a')) mimeType = 'audio/m4a';

    // Use Gemini for transcription
    const result = await transcribeAudio(base64Audio, mimeType);

    if (!result.success) {
      console.error('Transcription error:', result.error);
      throw new Error(result.error || 'Transcription failed');
    }

    console.log('Transcription result:', result.text);

    return new Response(
      JSON.stringify({
        text: result.text,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[transcribe-audio] Error:', {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
    });

    // Retornar mensagem amigável baseada no tipo de erro
    let userMessage = 'Erro ao transcrever áudio';
    if (errorMessage.includes('fetch audio')) {
      userMessage = 'Não foi possível acessar o arquivo de áudio';
    } else if (errorMessage.includes('API')) {
      userMessage = 'Serviço de transcrição temporariamente indisponível';
    } else if (errorMessage.includes('GEMINI_API_KEY')) {
      userMessage = 'Configuração de API não encontrada';
    }

    return new Response(
      JSON.stringify({
        error: userMessage,
        details: errorMessage,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
