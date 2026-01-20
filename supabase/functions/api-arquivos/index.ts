import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Header Authorization ausente ou inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (apiKeyError || !apiKeyId) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'API key inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const nomeArquivo = url.searchParams.get('nome_arquivo');
    const tipoMime = url.searchParams.get('tipo_mime');
    const filePath = url.searchParams.get('path');

    // GET - Generate signed upload URL
    if (req.method === 'GET') {
      if (!nomeArquivo || !tipoMime) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'nome_arquivo e tipo_mime são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate unique path
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().slice(0, 8);
      const extension = nomeArquivo.split('.').pop() || '';
      const storagePath = `api-uploads/${timestamp}-${randomId}.${extension}`;

      // Create signed upload URL
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .createSignedUploadUrl(storagePath);

      if (error) {
        console.error('[api-arquivos] Error creating upload URL:', error);
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao gerar URL de upload' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          sucesso: true,
          upload: {
            url: data.signedUrl,
            token: data.token,
            path: storagePath,
            expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Confirm upload and get permanent URL
    if (req.method === 'POST') {
      const body = await req.json();

      if (!body.path) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'path é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if file exists
      const { data: fileData, error: fileError } = await supabase.storage
        .from('message-attachments')
        .list('api-uploads', {
          search: body.path.replace('api-uploads/', ''),
        });

      if (fileError || !fileData?.length) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'Arquivo não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate public URL
      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(body.path);

      return new Response(
        JSON.stringify({
          sucesso: true,
          arquivo: {
            path: body.path,
            url: urlData.publicUrl,
            nome: body.nome_original || body.path.split('/').pop(),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remove file
    if (req.method === 'DELETE') {
      if (!filePath) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'path é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.storage.from('message-attachments').remove([filePath]);

      if (error) {
        console.error('[api-arquivos] Error deleting file:', error);
        return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao remover arquivo' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ sucesso: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sucesso: false, erro: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api-arquivos] Error:', error);
    return new Response(JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
